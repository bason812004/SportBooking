import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

from feature_engineering import FEATURES, TARGET, chronological_split


def main() -> None:
    data_path = Path(os.environ.get("TRAINING_DATA_PATH", "ml/models/demand_training_data.csv"))
    model_path = Path(os.environ.get("MODEL_PATH", "ml/models/demand_model.joblib"))
    if not data_path.exists():
        raise SystemExit(f"Training data not found: {data_path}")

    data = pd.read_csv(data_path)
    if len(data) < 50:
        raise SystemExit("Not enough rows to train a reliable model. Keep using rule-based prediction.")

    train, test = chronological_split(data)
    x_train, y_train = train[FEATURES], train[TARGET]
    x_test = test[FEATURES]

    preprocessor = ColumnTransformer(
        transformers=[("sport", OneHotEncoder(handle_unknown="ignore"), ["sport_type"])],
        remainder="passthrough",
    )
    model = Pipeline([("preprocessor", preprocessor), ("regressor", RandomForestRegressor(n_estimators=200, random_state=42))])
    model.fit(x_train, y_train)

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "features": FEATURES, "test_rows": len(x_test)}, model_path)
    print(f"Saved model to {model_path} (trained on {len(x_train)} rows, held out {len(x_test)} rows from later weeks)")


if __name__ == "__main__":
    main()
