import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder


def demand_score(row: pd.Series) -> float:
    base = min(float(row["booking_count"]) * 20.0, 70.0)
    weekend = 10.0 if bool(row["is_weekend"]) else 0.0
    cancellation_penalty = min(float(row["cancellation_count"]) * 5.0, 20.0)
    return max(0.0, min(100.0, base + weekend - cancellation_penalty))


def main() -> None:
    data_path = Path(os.environ.get("TRAINING_DATA_PATH", "ml/models/demand_training_data.csv"))
    model_path = Path(os.environ.get("MODEL_PATH", "ml/models/demand_model.joblib"))
    if not data_path.exists():
        raise SystemExit(f"Training data not found: {data_path}")

    data = pd.read_csv(data_path)
    if len(data) < 50:
        raise SystemExit("Not enough rows to train a reliable model. Keep using rule-based prediction.")

    data["target_demand_score"] = data.apply(demand_score, axis=1)
    features = ["hour_of_day", "day_of_week", "is_weekend", "sport_type", "booking_count", "cancellation_count", "voucher_usage_count", "average_price"]
    x_train, x_test, y_train, y_test = train_test_split(data[features], data["target_demand_score"], test_size=0.2, random_state=42)

    preprocessor = ColumnTransformer(
        transformers=[("sport", OneHotEncoder(handle_unknown="ignore"), ["sport_type"])],
        remainder="passthrough",
    )
    model = Pipeline([("preprocessor", preprocessor), ("regressor", RandomForestRegressor(n_estimators=200, random_state=42))])
    model.fit(x_train, y_train)

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "features": features, "test_rows": len(x_test)}, model_path)
    print(f"Saved model to {model_path}")


if __name__ == "__main__":
    main()
