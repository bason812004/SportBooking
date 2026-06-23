import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, accuracy_score
from sklearn.model_selection import train_test_split


def level(score: float) -> str:
    if score >= 80:
        return "VERY_HIGH"
    if score >= 60:
        return "HIGH"
    if score >= 35:
        return "MEDIUM"
    return "LOW"


def demand_score(row: pd.Series) -> float:
    base = min(float(row["booking_count"]) * 20.0, 70.0)
    weekend = 10.0 if bool(row["is_weekend"]) else 0.0
    cancellation_penalty = min(float(row["cancellation_count"]) * 5.0, 20.0)
    return max(0.0, min(100.0, base + weekend - cancellation_penalty))


def main() -> None:
    data_path = Path(os.environ.get("TRAINING_DATA_PATH", "ml/models/demand_training_data.csv"))
    model_path = Path(os.environ.get("MODEL_PATH", "ml/models/demand_model.joblib"))
    if not data_path.exists() or not model_path.exists():
        raise SystemExit("Training data and model artifact are required")

    artifact = joblib.load(model_path)
    data = pd.read_csv(data_path)
    data["target_demand_score"] = data.apply(demand_score, axis=1)
    _, x_test, _, y_test = train_test_split(data[artifact["features"]], data["target_demand_score"], test_size=0.2, random_state=42)

    predictions = artifact["model"].predict(x_test)
    mae = mean_absolute_error(y_test, predictions)
    rmse = mean_squared_error(y_test, predictions, squared=False)
    accuracy = accuracy_score([level(v) for v in y_test], [level(v) for v in predictions])

    print({"mae": mae, "rmse": rmse, "level_accuracy": accuracy})


if __name__ == "__main__":
    main()
