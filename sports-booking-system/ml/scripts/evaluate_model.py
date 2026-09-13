import json
import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, accuracy_score

from feature_engineering import FEATURES, TARGET, WEEK_COLUMN, chronological_split, level


def main() -> None:
    data_path = Path(os.environ.get("TRAINING_DATA_PATH", "ml/models/demand_training_data.csv"))
    model_path = Path(os.environ.get("MODEL_PATH", "ml/models/demand_model.joblib"))
    report_path = Path(os.environ.get("EVAL_REPORT_PATH", "ml/models/eval_report.json"))
    if not data_path.exists() or not model_path.exists():
        raise SystemExit("Training data and model artifact are required")

    artifact = joblib.load(model_path)
    data = pd.read_csv(data_path)

    # Same chronological split as training, so the reported metrics are a genuine
    # backtest against weeks the model never trained on -- not a random re-shuffle
    # that could reuse rows from the same week the model already saw.
    _, test = chronological_split(data)
    x_test, y_test = test[FEATURES], test[TARGET]

    predictions = artifact["model"].predict(x_test)
    mae = mean_absolute_error(y_test, predictions)
    rmse = mean_squared_error(y_test, predictions, squared=False)
    accuracy = accuracy_score([level(v) for v in y_test], [level(v) for v in predictions])

    report = {
        "methodology": "Chronological backtest: model trained on earlier weeks, evaluated on the most recent weeks it never saw. Target is the actual booking count observed in that later week, not a formula over the same row's features.",
        "training_data_path": str(data_path),
        "total_rows": len(data),
        "test_rows": len(test),
        "test_week_range": [str(test[WEEK_COLUMN].min()), str(test[WEEK_COLUMN].max())] if len(test) else None,
        "mae": mae,
        "rmse": rmse,
        "level_accuracy": accuracy,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2))

    print(report)
    print(f"Wrote evaluation report to {report_path}")


if __name__ == "__main__":
    main()
