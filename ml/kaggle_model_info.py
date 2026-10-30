from pathlib import Path
import json
import joblib

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "electricity_kaggle_model.pkl"
METRICS_PATH = ROOT / "models" / "electricity_kaggle_model_metrics.json"


def main():
    if not MODEL_PATH.exists():
        raise FileNotFoundError("Trained Kaggle model was not found.")

    if not METRICS_PATH.exists():
        raise FileNotFoundError("Kaggle model metrics were not found.")

    artifact = joblib.load(MODEL_PATH)

    with METRICS_PATH.open("r", encoding="utf-8") as file:
        metadata = json.load(file)

    result = {
        "success": True,
        "model": artifact["model_name"],
        "trainingExamples": artifact["training_examples"],
        "featureCount": len(artifact["feature_columns"]),
        "metrics": metadata["metrics"],
        "historicalForecast": metadata["forecast"],
        "datasetNote": metadata["dataset_note"],
        "lastTrainingTimestamp": artifact["last_training_timestamp"],
        "forecastType": "experimental_historical_dataset",
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()