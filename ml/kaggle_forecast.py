from pathlib import Path
import json
import sys

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "electricity_kaggle_model.pkl"
METRICS_PATH = ROOT / "models" / "electricity_kaggle_model_metrics.json"

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


def main():
    if not MODEL_PATH.exists():
        raise FileNotFoundError("Trained Kaggle model was not found.")

    artifact = joblib.load(MODEL_PATH)

    model = artifact["model"]
    feature_columns = artifact["feature_columns"]
    history = [float(value) for value in artifact["history"]]

    if feature_columns != FEATURES:
        raise ValueError("The saved model's feature columns do not match.")

    if len(history) < 168:
        raise ValueError("At least 168 hours of history are required.")

    if not all(np.isfinite(value) and value >= 0 for value in history):
        raise ValueError("The saved consumption history contains invalid values.")

    with METRICS_PATH.open("r", encoding="utf-8") as file:
        metadata = json.load(file)

    last_timestamp = pd.Timestamp(
        artifact["last_training_timestamp"]
    )

    next_hour = last_timestamp.floor("h") + pd.Timedelta(hours=1)
    forecasts = []

    for offset in range(24):
        timestamp = next_hour + pd.Timedelta(hours=offset)

        features = {
            "hour": timestamp.hour,
            "month": timestamp.month,
            "dayofweek": timestamp.day_of_week,
            "dayofyear": timestamp.day_of_year,
            "is_weekend": int(timestamp.day_of_week >= 5),
            "lag_1": history[-1],
            "lag_2": history[-2],
            "lag_3": history[-3],
            "lag_24": history[-24],
            "lag_48": history[-48],
            "lag_168": history[-168],
            "mean_24": float(np.mean(history[-24:])),
            "mean_168": float(np.mean(history[-168:])),
        }

        input_frame = pd.DataFrame(
            [[features[column] for column in FEATURES]],
            columns=FEATURES,
        )

        prediction = max(0.0, float(model.predict(input_frame)[0]))

        forecasts.append({
            "timestamp": timestamp.isoformat(),
            "predictedConsumptionKwh": round(prediction, 4),
        })

        history.append(prediction)

    total_kwh = sum(
        item["predictedConsumptionKwh"] for item in forecasts
    )

    rate = float(artifact["electricity_rate_inr_per_kwh"])

    result = {
        "success": True,
        "model": artifact["model_name"],
        "forecastType": "experimental_24_hour_rolling_forecast",
        "forecastHours": len(forecasts),
        "predictedConsumptionKwh": round(total_kwh, 2),
        "electricityRateInrPerKwh": rate,
        "estimatedBillInr": round(total_kwh * rate, 2),
        "hourlyForecast": forecasts,
        "metrics": metadata["metrics"],
        "trainingExamples": artifact["training_examples"],
        "lastTrainingTimestamp": artifact["last_training_timestamp"],
        "datasetNote": metadata["dataset_note"],
        "note": (
            "This forecast uses saved historical data from one household "
            "in France. It is experimental and is not a live prediction "
            "for your household. The ₹5/kWh rate is illustrative."
        ),
    }

    print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(
            json.dumps({
                "success": False,
                "message": str(error),
            }),
            file=sys.stderr,
        )
        sys.exit(1)