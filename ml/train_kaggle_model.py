"""
AI-Based Smart Electricity Consumption Predictor
------------------------------------------------
1. Loads household electricity consumption data.
2. Converts minute-level readings into hourly consumption.
3. Creates time-based and lag features.
4. Evaluates ML models using a chronological split.
5. Compares models against simple baselines.
6. Selects the model with the lowest MAE.
7. Saves the trained model and evaluation metrics.
8. Forecasts the next month using historical data.

Dataset:
ml/datasets/household_power_consumption.txt
"""

import json
import warnings
import joblib
from pathlib import Path

import numpy as np
import pandas as pd

from sklearn.ensemble import (
    RandomForestRegressor,
    HistGradientBoostingRegressor,
)

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)

warnings.filterwarnings("ignore")


# ============================================================
# 1. PATHS AND CONFIGURATION
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATA_PATH = (
    PROJECT_ROOT
    / "ml"
    / "datasets"
    / "household_power_consumption.txt"
)

MODEL_DIR = PROJECT_ROOT / "ml" / "models"

MODEL_PATH = MODEL_DIR / "electricity_kaggle_model.pkl"

METRICS_PATH = (
    MODEL_DIR / "electricity_kaggle_model_metrics.json"
)

ELECTRICITY_RATE = 5.0

TEST_SIZE = 0.20

RANDOM_STATE = 42

MODEL_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# 2. FEATURE CONFIGURATION
# ============================================================

FEATURES = [
    "hour",
    "dayofweek",
    "dayofyear",
    "month",
    "is_weekend",
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_24",
    "lag_48",
    "lag_168",
    "mean_24",
    "mean_168",
]


# ============================================================
# 3. LOAD AND CLEAN DATASET
# ============================================================

def load_data():
    """Load and clean the household electricity dataset."""

    print("\n" + "=" * 65)
    print("LOADING ELECTRICITY DATASET")
    print("=" * 65)

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"\nDataset not found:\n{DATA_PATH}\n"
            "Check that the dataset exists in ml/datasets/."
        )

    df = pd.read_csv(
        DATA_PATH,
        sep=";",
        na_values=["?", "nan", "NaN", ""],
        low_memory=False,
    )

    df.columns = df.columns.str.strip()

    required_columns = [
        "Date",
        "Time",
        "Global_active_power",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Required columns are missing: {missing_columns}"
        )

    df["datetime"] = pd.to_datetime(
        df["Date"].astype(str).str.strip()
        + " "
        + df["Time"].astype(str).str.strip(),
        format="%d/%m/%Y %H:%M:%S",
        errors="coerce",
    )

    df["Global_active_power"] = pd.to_numeric(
        df["Global_active_power"],
        errors="coerce",
    )

    df = df.dropna(
        subset=["datetime", "Global_active_power"]
    )

    df = df.sort_values("datetime")

    df = df.drop_duplicates(
        subset=["datetime"],
        keep="last",
    )

    if df.empty:
        raise ValueError(
            "No valid electricity readings were found."
        )

    df = df.set_index("datetime")

    hourly_energy = (
        df["Global_active_power"]
        .resample("h")
        .agg(["count", "mean"])
    )

    hourly_energy = hourly_energy[
        hourly_energy["count"] >= 45
    ].copy()

    hourly_energy["consumption_kwh"] = (
        hourly_energy["mean"]
    )

    hourly = hourly_energy[
        ["consumption_kwh"]
    ].copy()

    hourly = hourly.replace(
        [np.inf, -np.inf],
        np.nan,
    )

    hourly["consumption_kwh"] = (
        hourly["consumption_kwh"]
        .interpolate(
            method="time",
            limit=3,
            limit_area="inside",
        )
    )

    hourly = hourly.dropna()

    if len(hourly) < 500:
        raise ValueError(
            "Not enough usable hourly observations: "
            f"{len(hourly)}"
        )

    print(f"Usable hourly samples: {len(hourly):,}")
    print(f"Start date: {hourly.index.min()}")
    print(f"End date:   {hourly.index.max()}")

    return hourly


# ============================================================
# 4. CREATE FEATURES
# ============================================================

def create_features(hourly):
    """Create time-based, lag, and rolling-average features."""

    data = hourly.copy()

    index = data.index

    data["hour"] = index.hour
    data["dayofweek"] = index.dayofweek
    data["dayofyear"] = index.dayofyear
    data["month"] = index.month

    data["is_weekend"] = (
        index.dayofweek >= 5
    ).astype(int)

    target = data["consumption_kwh"]

    data["lag_1"] = target.shift(1)
    data["lag_2"] = target.shift(2)
    data["lag_3"] = target.shift(3)

    data["lag_24"] = target.shift(24)
    data["lag_48"] = target.shift(48)
    data["lag_168"] = target.shift(168)

    previous = target.shift(1)

    data["mean_24"] = (
        previous
        .rolling(window=24, min_periods=24)
        .mean()
    )

    data["mean_168"] = (
        previous
        .rolling(window=168, min_periods=168)
        .mean()
    )

    data = data.replace(
        [np.inf, -np.inf],
        np.nan,
    )

    data = data.dropna(
        subset=FEATURES + ["consumption_kwh"]
    )

    return data


# ============================================================
# 5. DEFINE MACHINE LEARNING MODELS
# ============================================================

def build_models():
    """Create the candidate regression models."""

    candidates = [
        (
            "Random Forest",
            RandomForestRegressor(
                n_estimators=100,
                max_depth=18,
                min_samples_leaf=3,
                n_jobs=-1,
                random_state=RANDOM_STATE,
            ),
        ),
        (
            "HistGradientBoosting_Tuned",
            HistGradientBoostingRegressor(
                max_iter=300,
                learning_rate=0.03,
                max_leaf_nodes=63,
                min_samples_leaf=20,
                l2_regularization=0.5,
                random_state=RANDOM_STATE,
            ),
        ),
    ]

    return candidates


# ============================================================
# 6. EVALUATE MODEL PERFORMANCE
# ============================================================

def calculate_metrics(actual, predicted):
    """Calculate regression evaluation metrics."""

    mae = mean_absolute_error(
        actual,
        predicted,
    )

    rmse = np.sqrt(
        mean_squared_error(
            actual,
            predicted,
        )
    )

    r2 = r2_score(
        actual,
        predicted,
    )

    return {
        "MAE": float(mae),
        "RMSE": float(rmse),
        "R2": float(r2),
    }


# ============================================================
# 7. CHRONOLOGICAL TRAIN/TEST SPLIT
# ============================================================

def train_and_evaluate(hourly):
    """Train and compare models without randomly shuffling time."""

    print("\n" + "=" * 65)
    print("CHRONOLOGICAL MODEL EVALUATION")
    print("=" * 65)

    data = create_features(hourly)

    X = data[FEATURES]
    y = data["consumption_kwh"]

    split_index = int(
        len(data) * (1 - TEST_SIZE)
    )

    X_train = X.iloc[:split_index]
    X_test = X.iloc[split_index:]

    y_train = y.iloc[:split_index]
    y_test = y.iloc[split_index:]

    print(f"Total training examples: {len(X_train):,}")
    print(f"Total testing examples:  {len(X_test):,}")

    if len(X_train) == 0 or len(X_test) == 0:
        raise ValueError(
            "The chronological train/test split "
            "produced an empty set."
        )

    results = {}

    # Baseline 1: predict previous-hour consumption.
    persistence_predictions = (
        X_test["lag_1"].to_numpy()
    )

    results["Persistence Baseline"] = calculate_metrics(
        y_test,
        persistence_predictions,
    )

    # Baseline 2: predict the training-set average.
    mean_predictions = np.full(
        shape=len(y_test),
        fill_value=float(y_train.mean()),
    )

    results["Training Mean Baseline"] = calculate_metrics(
        y_test,
        mean_predictions,
    )

    models = build_models()

    for name, model in models:
        print(f"\nTraining: {name}")

        model.fit(
            X_train,
            y_train,
        )

        predictions = model.predict(X_test)

        results[name] = calculate_metrics(
            y_test,
            predictions,
        )

        print(
            f"MAE:  {results[name]['MAE']:.4f} kWh"
        )

        print(
            f"RMSE: {results[name]['RMSE']:.4f} kWh"
        )

        print(
            f"R²:   {results[name]['R2']:.4f}"
        )

    print("\n" + "-" * 65)
    print("MODEL COMPARISON")
    print("-" * 65)

    print(
        f"{'Model':32s}"
        f"{'MAE':>10s}"
        f"{'RMSE':>10s}"
        f"{'R²':>10s}"
    )

    print("-" * 65)

    for name, metrics in sorted(
        results.items(),
        key=lambda item: item[1]["MAE"],
    ):
        print(
            f"{name:32s}"
            f"{metrics['MAE']:10.4f}"
            f"{metrics['RMSE']:10.4f}"
            f"{metrics['R2']:10.4f}"
        )

    candidate_names = [
        name
        for name, _ in models
    ]

    best_name = min(
        candidate_names,
        key=lambda name: results[name]["MAE"],
    )

    best_metrics = results[best_name]

    persistence_mae = results[
        "Persistence Baseline"
    ]["MAE"]

    if persistence_mae > 0:
        improvement = (
            (
                persistence_mae
                - best_metrics["MAE"]
            )
            / persistence_mae
        ) * 100
    else:
        improvement = None

    print("\n" + "=" * 65)
    print("BEST MODEL")
    print("=" * 65)

    print(f"Selected model: {best_name}")
    print(f"MAE:  {best_metrics['MAE']:.4f} kWh")
    print(f"RMSE: {best_metrics['RMSE']:.4f} kWh")
    print(f"R²:   {best_metrics['R2']:.4f}")

    if improvement is not None:
        print(
            "MAE improvement over persistence baseline: "
            f"{improvement:.2f}%"
        )

    return (
        data,
        X_train,
        X_test,
        y_train,
        y_test,
        results,
        best_name,
        best_metrics,
        improvement,
    )


# ============================================================
# 8. RETRAIN BEST MODEL ON ALL AVAILABLE DATA
# ============================================================

def retrain_best_model(
    data,
    best_name,
    evaluation_results,
    best_metrics,
    improvement,
):
    """Retrain the selected model and save a compatible artifact."""

    print("\n" + "=" * 65)
    print("RETRAINING BEST MODEL ON ALL DATA")
    print("=" * 65)

    X_all = data[FEATURES]
    y_all = data["consumption_kwh"]

    candidates = dict(build_models())

    best_model = candidates[best_name]

    best_model.fit(
        X_all,
        y_all,
    )

    history = (
        data["consumption_kwh"]
        .tail(168)
        .astype(float)
        .tolist()
    )

    if len(history) < 168:
        raise ValueError(
            "At least 168 hours of history are required."
        )

    # These keys must match the forecasting scripts.
    model_bundle = {
        "model": best_model,
        "feature_columns": FEATURES,
        "history": history,
        "last_training_timestamp": (
            data.index.max().isoformat()
        ),
        "electricity_rate_inr_per_kwh": ELECTRICITY_RATE,
        "model_name": best_name,
        "training_examples": int(len(data)),
    }

    # Save using joblib rather than pickle.
    joblib.dump(
        model_bundle,
        MODEL_PATH,
    )

    print(f"Model saved: {MODEL_PATH}")

    # Generate the next-month forecast summary.
    forecast_series = forecast_next_month(
        hourly=data[["consumption_kwh"]].copy(),
        model=best_model,
    )

    monthly_kwh = float(
        forecast_series.sum()
    )

    estimated_bill = (
        monthly_kwh * ELECTRICITY_RATE
    )

    forecast_summary = {
        "predictedConsumptionKwh": round(
            monthly_kwh,
            2,
        ),
        "electricityRateInrPerKwh": ELECTRICITY_RATE,
        "estimatedBillInr": round(
            estimated_bill,
            2,
        ),
        "forecastHours": int(
            len(forecast_series)
        ),
        "forecastStart": (
            forecast_series.index.min().isoformat()
        ),
        "forecastEnd": (
            forecast_series.index.max().isoformat()
        ),
    }

    metrics_output = {
        "metrics": {
            "mae_kwh": float(
                best_metrics["MAE"]
            ),
            "rmse_kwh": float(
                best_metrics["RMSE"]
            ),
            "r2": float(
                best_metrics["R2"]
            ),
        },
        "forecast": forecast_summary,
        "dataset_note": (
            "This dataset represents one household in France. "
            "Results may not generalize to other households. "
            "The electricity rate is illustrative."
        ),
        "model_name": best_name,
        "training_examples": int(len(data)),
        "model_comparison": {
            name: {
                "mae_kwh": float(values["MAE"]),
                "rmse_kwh": float(values["RMSE"]),
                "r2": float(values["R2"]),
            }
            for name, values in evaluation_results.items()
        },
        "mae_improvement_over_persistence_percent": (
            float(improvement)
            if improvement is not None
            else None
        ),
        "features": FEATURES,
        "electricity_rate_inr_per_kwh": ELECTRICITY_RATE,
        "model_path": str(MODEL_PATH),
        "evaluation_method": (
            "Chronological 80/20 train/test split"
        ),
    }

    with METRICS_PATH.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            metrics_output,
            file,
            indent=4,
        )

    print(f"Metrics saved: {METRICS_PATH}")

    return best_model


# ============================================================
# 9. FORECAST THE NEXT MONTH
# ============================================================

def forecast_next_month(hourly, model):
    """
    Forecast the next calendar month.

    This is a recursive hourly forecast. Predictions are fed
    back into the lag features for later hours.
    """

    print("\n" + "=" * 65)
    print("NEXT-MONTH EXPERIMENTAL FORECAST")
    print("=" * 65)

    history = hourly[
        "consumption_kwh"
    ].copy()

    if len(history) < 168:
        raise ValueError(
            "At least 168 historical hours are required "
            "for forecasting."
        )

    last_timestamp = history.index.max()

    next_month_start = (
        last_timestamp.to_period("M") + 1
    ).start_time

    following_month_start = (
        next_month_start.to_period("M") + 1
    ).start_time

    forecast_index = pd.date_range(
        start=next_month_start,
        end=following_month_start,
        freq="h",
        inclusive="left",
    )

    predictions = []

    for timestamp in forecast_index:
        lag_1 = float(history.iloc[-1])
        lag_2 = float(history.iloc[-2])
        lag_3 = float(history.iloc[-3])

        lag_24 = float(history.iloc[-24])
        lag_48 = float(history.iloc[-48])
        lag_168 = float(history.iloc[-168])

        mean_24 = float(
            history.iloc[-24:].mean()
        )

        mean_168 = float(
            history.iloc[-168:].mean()
        )

        features = pd.DataFrame(
            [
                {
                    "hour": timestamp.hour,
                    "dayofweek": timestamp.dayofweek,
                    "dayofyear": timestamp.dayofyear,
                    "month": timestamp.month,
                    "is_weekend": int(
                        timestamp.dayofweek >= 5
                    ),
                    "lag_1": lag_1,
                    "lag_2": lag_2,
                    "lag_3": lag_3,
                    "lag_24": lag_24,
                    "lag_48": lag_48,
                    "lag_168": lag_168,
                    "mean_24": mean_24,
                    "mean_168": mean_168,
                }
            ],
            columns=FEATURES,
        )

        predicted_value = float(
            model.predict(features)[0]
        )

        # Electricity consumption cannot be negative.
        predicted_value = max(
            0.0,
            predicted_value,
        )

        predictions.append(
            predicted_value
        )

        # Add the prediction to history for the next hour.
        history.loc[timestamp] = predicted_value

    forecast = pd.Series(
        predictions,
        index=forecast_index,
        name="predicted_consumption_kwh",
    )

    monthly_kwh = float(
        forecast.sum()
    )

    estimated_bill = (
        monthly_kwh * ELECTRICITY_RATE
    )

    daily_summary = forecast.resample("D").sum()

    print(
        f"Forecast month: "
        f"{next_month_start.strftime('%B %Y')}"
    )

    print(
        f"Forecast hours: {len(forecast):,}"
    )

    print(
        f"Predicted monthly consumption: "
        f"{monthly_kwh:.2f} kWh"
    )

    print(
        f"Estimated bill: ₹{estimated_bill:.2f}"
    )

    print(
        f"Assumed rate: ₹{ELECTRICITY_RATE:.2f} per kWh"
    )

    print(
        f"Average daily consumption: "
        f"{daily_summary.mean():.2f} kWh"
    )

    forecast_path = (
        MODEL_DIR
        / "electricity_monthly_forecast.csv"
    )

    forecast.to_csv(
        forecast_path,
        header=True,
    )

    print(
        f"Forecast CSV saved: {forecast_path}"
    )

    return forecast


# ============================================================
# 10. MAIN PROGRAM
# ============================================================

def main():
    """Run the complete electricity model training workflow."""

    try:
        hourly = load_data()

        (
            data,
            X_train,
            X_test,
            y_train,
            y_test,
            evaluation_results,
            best_name,
            best_metrics,
            improvement,
        ) = train_and_evaluate(hourly)

        best_model = retrain_best_model(
            data=data,
            best_name=best_name,
            evaluation_results=evaluation_results,
            best_metrics=best_metrics,
            improvement=improvement,
        )

        # Generate the forecast CSV.
        forecast_next_month(
            hourly=hourly,
            model=best_model,
        )

        print("\n" + "=" * 65)
        print("TRAINING COMPLETED SUCCESSFULLY")
        print("=" * 65)

        print(f"Best model: {best_name}")
        print(f"Saved model: {MODEL_PATH}")
        print(f"Saved metrics: {METRICS_PATH}")

    except FileNotFoundError as error:
        print(f"\nFILE ERROR:\n{error}")

    except ValueError as error:
        print(f"\nDATA ERROR:\n{error}")

    except Exception as error:
        print(
            f"\nTRAINING FAILED:\n"
            f"{type(error).__name__}: {error}"
        )

        raise


if __name__ == "__main__":
    main()