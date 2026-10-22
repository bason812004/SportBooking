import json
import math
import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, accuracy_score, roc_auc_score

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
    # sqrt(MSE) instead of `squared=False`, which scikit-learn 1.6+ removed.
    rmse = math.sqrt(mean_squared_error(y_test, predictions))
    accuracy = accuracy_score([level(v) for v in y_test], [level(v) for v in predictions])

    # A slot's weekly label is mostly 0 or 100 (booked or not), so also score the prediction
    # as a booking probability and compare it to always predicting the training-set mean.
    train, _ = chronological_split(data)
    probability = [min(max(v / 100.0, 0.0), 1.0) for v in predictions]
    actual = [min(max(v / 100.0, 0.0), 1.0) for v in y_test]
    baseline = min(max(train[TARGET].mean() / 100.0, 0.0), 1.0)
    brier = sum((p - a) ** 2 for p, a in zip(probability, actual)) / len(actual)
    baseline_brier = sum((baseline - a) ** 2 for a in actual) / len(actual)
    booked = [int(v > 0) for v in test["target_booking_count"]]
    roc_auc = roc_auc_score(booked, probability) if len(set(booked)) == 2 else None

    report = {
        "methodology": "Chronological backtest: model trained on earlier weeks, evaluated on the most recent weeks it never saw. Target is the actual booking count observed in that later week (weeks with no booking included as zero), not a formula over the same row's features.",
        "training_data_path": str(data_path),
        "total_rows": len(data),
        "test_rows": len(test),
        "test_week_range": [str(test[WEEK_COLUMN].min()), str(test[WEEK_COLUMN].max())] if len(test) else None,
        "mae": mae,
        "rmse": rmse,
        "level_accuracy": accuracy,
        "brier_score": brier,
        "baseline_constant_brier_score": baseline_brier,
        "roc_auc_booked": roc_auc,
        "actual_booked_rate": sum(booked) / len(booked),
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2))

    print(report)
    print(f"Wrote evaluation report to {report_path}")


if __name__ == "__main__":
    main()
