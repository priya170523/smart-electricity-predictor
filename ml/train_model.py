import json
import os
import urllib.request
from datetime import datetime

import joblib
import numpy as np

from sklearn.dummy import DummyRegressor
from sklearn.ensemble import (
    GradientBoostingRegressor,
    RandomForestRegressor,
)
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


# ==================================================
# CONFIGURATION
# ==================================================

API_URL = os.environ.get(
    "SMARTENERGY_API_URL",
    "http://localhost:5001/api/consumption",
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "electricity_model.pkl")

ELECTRICITY_RATE = 5.0
MINIMUM_RECORDS = 7
RANDOM_STATE = 42


# ==================================================
# FETCH CONSUMPTION DATA
# ==================================================

def fetch_consumption_data():
    print("Fetching electricity consumption data...")

    auth_token = os.environ.get("SMARTENERGY_AUTH_TOKEN", "")

    headers = {"Accept": "application/json"}

    if auth_token:
        headers["Authorization"] = auth_token

    request = urllib.request.Request(
        API_URL,
        headers=headers,
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))

    except Exception as error:
        raise RuntimeError(
            f"Could not fetch data from {API_URL}. "
            "Check the backend, authentication token, and endpoint. "
            f"Details: {error}"
        ) from error

    if isinstance(data, dict):
        for key in ("data", "consumptions", "records"):
            if isinstance(data.get(key), list):
                data = data[key]
                break

    if not isinstance(data, list):
        raise ValueError(
            "The consumption API must return a list of records."
        )

    if not data:
        raise ValueError(
            "No consumption records were returned."
        )

    print(f"Fetched {len(data)} consumption records.")

    return data


# ==================================================
# PARSE DATES
# ==================================================

def parse_date(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)

    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value)
        except (ValueError, OverflowError, OSError):
            return None

    if not isinstance(value, str):
        return None

    value = value.strip()

    try:
        return datetime.fromisoformat(
            value.replace("Z", "+00:00")
        ).replace(tzinfo=None)

    except ValueError:
        pass

    for date_format in (
        "%Y-%m",
        "%Y-%m-%d",
        "%B %Y",
        "%b %Y",
        "%m/%Y",
    ):
        try:
            return datetime.strptime(value, date_format)
        except ValueError:
            continue

    return None


# ==================================================
# PREPARE MONTHLY DATA
# ==================================================

def prepare_monthly_data(records):
    monthly_data = {}

    for record in records:
        if not isinstance(record, dict):
            continue

        consumption = None

        for key in (
            "units",
            "consumption",
            "unitsConsumed",
            "kwh",
        ):
            if record.get(key) is not None:
                consumption = record[key]
                break

        date_value = None

        for key in (
            "month",
            "date",
            "billingMonth",
            "createdAt",
        ):
            if record.get(key) is not None:
                date_value = record[key]
                break

        if consumption is None or date_value is None:
            continue

        try:
            consumption = float(consumption)
            parsed_date = parse_date(date_value)

            if (
                not np.isfinite(consumption)
                or consumption < 0
                or parsed_date is None
            ):
                continue

            month_key = parsed_date.strftime("%Y-%m")

            # Preserve the existing behavior of combining records
            # that belong to the same month.
            monthly_data[month_key] = (
                monthly_data.get(month_key, 0.0) + consumption
            )

        except (TypeError, ValueError, OverflowError, OSError):
            continue

    if not monthly_data:
        raise ValueError(
            "No valid monthly records found. Check the fields "
            "returned by the consumption API."
        )

    sorted_months = sorted(monthly_data)

    month_dates = [
        datetime.strptime(month, "%Y-%m")
        for month in sorted_months
    ]

    for previous, current in zip(
        month_dates,
        month_dates[1:],
    ):
        difference = (
            (current.year - previous.year) * 12
            + current.month - previous.month
        )

        if difference != 1:
            raise ValueError(
                f"Missing monthly data between "
                f"{previous:%B %Y} and {current:%B %Y}. "
                "Check the historical records before training."
            )

    values = [
        float(monthly_data[month])
        for month in sorted_months
    ]

    return sorted_months, values


# ==================================================
# FEATURE ENGINEERING
# ==================================================

def make_features(history, target_index):
    """
    Create features using only consumption values available
    before the month being predicted.

    Features:
    1. Month index
    2. Previous month's consumption
    3. Consumption from two months earlier
    4. Average consumption over the last three months
    """

    if len(history) < 3:
        raise ValueError(
            "At least three previous months are needed "
            "to construct forecasting features."
        )

    return [
        float(target_index),
        float(history[-1]),
        float(history[-2]),
        float(np.mean(history[-3:])),
    ]


def build_supervised_data(values, end_index):
    """
    Build training examples for target months from index 3
    up to, but not including, end_index.

    Every training feature uses only data from months
    preceding its own target month.
    """

    X = []
    y = []

    for target_index in range(3, end_index):
        history = values[:target_index]

        X.append(
            make_features(history, target_index)
        )

        y.append(
            float(values[target_index])
        )

    return (
        np.asarray(X, dtype=float).reshape(-1, 4),
        np.asarray(y, dtype=float),
    )


# ==================================================
# MODEL CANDIDATES
# ==================================================

def build_models():
    return {
        "Linear Regression": LinearRegression(),

        "Ridge Regression": make_pipeline(
            StandardScaler(),
            Ridge(alpha=1.0),
        ),

        "Random Forest": RandomForestRegressor(
            n_estimators=200,
            max_depth=3,
            min_samples_leaf=2,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),

        "Gradient Boosting": GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.03,
            max_depth=2,
            loss="huber",
            random_state=RANDOM_STATE,
        ),
    }


# ==================================================
# CHRONOLOGICAL VALIDATION
# ==================================================

def evaluate_models(values):
    """
    Expanding-window, one-step-ahead validation.

    The initial training period is followed by a chronological
    validation period. For every validation month, models are
    trained only on earlier observations.

    The two baseline forecasts are:
    - Previous Month: repeat the latest observed consumption.
    - Historical Average: use the average of past consumption.
    """

    number_of_values = len(values)

    # Reserve approximately 40% of the series for validation,
    # while ensuring at least four earlier months are available.
    validation_start = max(
        4,
        int(number_of_values * 0.60),
    )

    if validation_start >= number_of_values:
        raise ValueError(
            "Not enough historical months for chronological "
            "validation. Add more monthly records."
        )

    predictions = {
        "Previous Month Baseline": [],
        "Historical Average": [],
    }

    for name in build_models():
        predictions[name] = []

    actual_values = []

    for test_index in range(
        validation_start,
        number_of_values,
    ):
        history = values[:test_index]
        actual = float(values[test_index])

        # Baseline 1: use the previous month's consumption.
        predictions["Previous Month Baseline"].append(
            max(0.0, float(history[-1]))
        )

        # Baseline 2: use only the historical average.
        predictions["Historical Average"].append(
            max(0.0, float(np.mean(history)))
        )

        X_train, y_train = build_supervised_data(
            values,
            end_index=test_index,
        )

        X_test = np.asarray(
            [make_features(history, test_index)],
            dtype=float,
        )

        if len(y_train) == 0:
            raise ValueError(
                "Not enough earlier observations to train "
                "the forecasting models."
            )

        for name, model in build_models().items():
            model.fit(X_train, y_train)

            prediction = float(
                model.predict(X_test)[0]
            )

            predictions[name].append(
                max(0.0, prediction)
            )

        actual_values.append(actual)

    scores = {}

    for name, model_predictions in predictions.items():
        mae = mean_absolute_error(
            actual_values,
            model_predictions,
        )

        rmse = float(
            np.sqrt(
                mean_squared_error(
                    actual_values,
                    model_predictions,
                )
            )
        )

        scores[name] = {
            "mae": float(mae),
            "rmse": rmse,
        }

    return scores


# ==================================================
# TRAIN AND SAVE SELECTED MODEL
# ==================================================

def train_final_model(values, selected_model_name):
    X_train, y_train = build_supervised_data(
        values,
        end_index=len(values),
    )

    if len(y_train) == 0:
        raise ValueError(
            "Not enough historical observations to train "
            "the selected model."
        )

    if selected_model_name == "Previous Month Baseline":
        model = DummyRegressor(
            strategy="constant",
            constant=float(values[-1]),
        )

    elif selected_model_name == "Historical Average":
        model = DummyRegressor(
            strategy="mean",
        )

    else:
        models = build_models()

        if selected_model_name not in models:
            raise ValueError(
                f"Unknown model: {selected_model_name}"
            )

        model = models[selected_model_name]

    model.fit(X_train, y_train)

    os.makedirs(
        MODEL_DIR,
        exist_ok=True,
    )

    joblib.dump(
        model,
        MODEL_PATH,
    )

    return model


# ==================================================
# PREDICT NEXT MONTH
# ==================================================

def predict_next_month(model, values, latest_month):
    latest_date = datetime.strptime(
        latest_month,
        "%Y-%m",
    )

    if latest_date.month == 12:
        next_date = datetime(
            latest_date.year + 1,
            1,
            1,
        )
    else:
        next_date = datetime(
            latest_date.year,
            latest_date.month + 1,
            1,
        )

    next_features = np.asarray(
        [
            make_features(
                values,
                len(values),
            )
        ],
        dtype=float,
    )

    prediction = float(
        model.predict(next_features)[0]
    )

    prediction = max(0.0, prediction)

    estimated_bill = prediction * ELECTRICITY_RATE

    return next_date, prediction, estimated_bill


# ==================================================
# MAIN PROGRAM
# ==================================================

def main():
    print("\n" + "=" * 55)
    print("AI-BASED SMART ELECTRICITY CONSUMPTION PREDICTOR")
    print("=" * 55)

    records = fetch_consumption_data()

    months, values = prepare_monthly_data(records)

    print("\nELECTRICITY CONSUMPTION HISTORY")

    for month, value in zip(months, values):
        month_date = datetime.strptime(
            month,
            "%Y-%m",
        )

        print(
            f"{month_date:%B %Y}: {value:.2f} kWh"
        )

    if len(values) < MINIMUM_RECORDS:
        raise ValueError(
            f"At least {MINIMUM_RECORDS} consecutive monthly "
            "records are required for this model comparison. "
            "Add more historical records and try again."
        )

    print(
        f"\nTotal monthly observations: {len(values)}"
    )

    print("\nCHRONOLOGICAL MODEL EVALUATION")

    scores = evaluate_models(values)

    print(
        "\nValidation scores (lower is better for MAE and RMSE):"
    )

    for name, score in sorted(
        scores.items(),
        key=lambda item: (
            item[1]["mae"],
            item[1]["rmse"],
        ),
    ):
        print(
            f"{name} | "
            f"MAE: {score['mae']:.2f} kWh | "
            f"RMSE: {score['rmse']:.2f} kWh"
        )

    # Select using MAE, then RMSE as a tie-breaker.
    selected_model_name = min(
        scores,
        key=lambda name: (
            scores[name]["mae"],
            scores[name]["rmse"],
        ),
    )

    print(
        f"\nSelected model: {selected_model_name}"
    )

    if len(values) < 12:
        print(
            "WARNING: Fewer than 12 monthly observations are "
            "available. Forecast reliability is uncertain."
        )

    if len(values) < 20:
        print(
            "WARNING: The dataset is relatively small. "
            "Model rankings may change as more data are collected."
        )

    model = train_final_model(
        values,
        selected_model_name,
    )

    next_date, prediction, bill = predict_next_month(
        model,
        values,
        months[-1],
    )

    print("\nNEXT MONTH'S EXPERIMENTAL FORECAST")
    print(f"Month: {next_date:%B %Y}")
    print(f"Model: {selected_model_name}")
    print(f"Model saved: {MODEL_PATH}")
    print(
        f"Predicted consumption: {prediction:.2f} kWh"
    )
    print(f"Estimated bill: ₹{bill:.2f}")
    print(
        f"Assumed rate: ₹{ELECTRICITY_RATE:.2f} per kWh"
    )

    print(
        "\nIMPORTANT: This forecast is experimental. "
        "Validation scores do not guarantee future accuracy."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"\nERROR: {error}")
        raise
