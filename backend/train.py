"""Train all 4 models and write metrics to RESULTS.md.

Usage:
    python ml-service/train.py

Reads CSVs from data/ (runs data/generate.py first if they are missing) and
saves one joblib bundle per model to ml-service/models/.
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest, RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score, classification_report, f1_score, mean_absolute_error,
    precision_score, r2_score, recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT.parent / "data"
MODEL_DIR = ROOT / "models"
SEED = 42

SPEED_NUM = ["slope_deg", "accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z",
             "vibration", "load_pct"]
SPEED_CAT = ["machine_type", "surface"]

FAULT_NUM = ["engine_temp_c", "vibration", "oil_pressure_psi", "rpm", "humidity",
             "engine_hours", "obstacle_cm"]

TASK_NUM = ["operator_experience_yrs", "volume_m3", "slope_deg", "temp_c"]
TASK_CAT = ["machine_type", "task_type", "soil_type", "weather", "time_of_day"]

USAGE_NUM = ["fuel_used_l", "load_cycles", "idle_min", "idle_ratio", "avg_rpm", "max_tilt_deg",
             "harsh_events", "overspeed_events", "seatbelt_off_sec", "proximity_alerts"]


def load(name: str) -> pd.DataFrame:
    path = DATA_DIR / name
    if not path.exists():
        subprocess.run([sys.executable, str(DATA_DIR / "generate.py")], check=True)
    return pd.read_csv(path)


def encoder(cat_cols, num_cols) -> ColumnTransformer:
    return ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
        ("num", "passthrough", num_cols),
    ])


def train_speed():
    df = load("speed_data.csv")
    X, y = df[SPEED_CAT + SPEED_NUM], df["optimal_speed_kmh"]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=SEED)
    model = Pipeline([
        ("enc", encoder(SPEED_CAT, SPEED_NUM)),
        ("rf", RandomForestRegressor(n_estimators=200, min_samples_leaf=2, n_jobs=-1, random_state=SEED)),
    ]).fit(Xtr, ytr)
    pred = model.predict(Xte)

    names = model.named_steps["enc"].get_feature_names_out()
    imp = pd.Series(model.named_steps["rf"].feature_importances_, index=names).sort_values(ascending=False)
    metrics = {
        "r2": round(r2_score(yte, pred), 4),
        "mae_kmh": round(mean_absolute_error(yte, pred), 3),
        "top_features": {k.split("__")[-1]: round(v, 3) for k, v in imp.head(5).items()},
    }
    return {"model": model.fit(X, y), "features": SPEED_CAT + SPEED_NUM}, metrics


def train_fault():
    df = load("engine_fault.csv")
    X, y = df[FAULT_NUM], df["fault"]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=SEED, stratify=y)
    model = RandomForestClassifier(n_estimators=200, class_weight="balanced", n_jobs=-1,
                                   random_state=SEED).fit(Xtr, ytr)
    pred = model.predict(Xte)
    metrics = {
        "accuracy": round(accuracy_score(yte, pred), 4),
        "macro_f1": round(f1_score(yte, pred, average="macro"), 4),
        "report": classification_report(yte, pred, digits=3),
    }
    return {"model": model.fit(X, y), "features": FAULT_NUM}, metrics


def train_task_time():
    df = load("task_history.csv")
    X, y = df[TASK_CAT + TASK_NUM], df["duration_min"]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=SEED)
    model = Pipeline([
        ("enc", encoder(TASK_CAT, TASK_NUM)),
        ("rf", RandomForestRegressor(n_estimators=300, min_samples_leaf=3, n_jobs=-1, random_state=SEED)),
    ]).fit(Xtr, ytr)
    pred = model.predict(Xte)
    metrics = {
        "r2": round(r2_score(yte, pred), 4),
        "mae_min": round(mean_absolute_error(yte, pred), 2),
        "mape_pct": round(float(np.mean(np.abs(pred - yte) / yte)) * 100, 1),
    }
    operators = df.groupby("operator_id")["operator_experience_yrs"].first().to_dict()
    machines = df.groupby("machine_id")["machine_type"].first().to_dict()
    bundle = {
        "model": model.fit(X, y),
        "features": TASK_CAT + TASK_NUM,
        "operators": operators,
        "machines": machines,
        "default_experience": float(np.median(list(operators.values()))),
    }
    return bundle, metrics


def train_anomaly():
    df = load("usage_logs.csv")
    X = df[USAGE_NUM]
    truth = df["label"] != "normal"
    # unsupervised: fit only on the feature columns, labels are just for evaluation
    model = IsolationForest(n_estimators=300, contamination=0.1, random_state=SEED).fit(X)
    flagged = model.predict(X) == -1
    metrics = {
        "precision": round(precision_score(truth, flagged), 4),
        "recall": round(recall_score(truth, flagged), 4),
        "f1": round(f1_score(truth, flagged), 4),
        "recall_by_type": {
            lbl: round(float(flagged[df["label"] == lbl].mean()), 3)
            for lbl in sorted(df["label"].unique()) if lbl != "normal"
        },
    }
    return {"model": model, "features": USAGE_NUM}, metrics


def write_results(all_metrics: dict) -> None:
    s, f, t, a = (all_metrics[k] for k in ("speed", "fault", "task_time", "anomaly"))
    lines = [
        "# Model results",
        "",
        f"Trained {datetime.now():%Y-%m-%d %H:%M} on synthetic data (`data/generate.py`, seed 42). "
        "Hold-out split 80/20; final models are refit on all data.",
        "",
        "| Model | Algorithm | Metric |",
        "|---|---|---|",
        f"| Smart speed | RandomForestRegressor | R² {s['r2']}, MAE {s['mae_kmh']} km/h |",
        f"| Engine fault | RandomForestClassifier | accuracy {f['accuracy']}, macro F1 {f['macro_f1']} |",
        f"| Task time | RandomForestRegressor | R² {t['r2']}, MAE {t['mae_min']} min, MAPE {t['mape_pct']}% |",
        f"| Unusual behavior | IsolationForest | precision {a['precision']}, recall {a['recall']}, F1 {a['f1']} |",
        "",
        "## Speed: top features",
        "",
        *[f"- `{k}`: {v}" for k, v in s["top_features"].items()],
        "",
        "## Engine fault: per class",
        "",
        "```",
        f["report"].rstrip(),
        "```",
        "",
        "## Anomaly: recall by anomaly type",
        "",
        *[f"- `{k}`: {v}" for k, v in a["recall_by_type"].items()],
        "",
    ]
    (ROOT / "RESULTS.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    MODEL_DIR.mkdir(exist_ok=True)
    trainers = {"speed": train_speed, "fault": train_fault,
                "task_time": train_task_time, "anomaly": train_anomaly}
    all_metrics = {}
    for name, fn in trainers.items():
        bundle, metrics = fn()
        bundle["metrics"] = {k: v for k, v in metrics.items() if k != "report"}
        joblib.dump(bundle, MODEL_DIR / f"{name}.joblib", compress=3)
        all_metrics[name] = metrics
        print(f"{name:10s} {json.dumps(bundle['metrics'])}")
    write_results(all_metrics)
    print(f"saved to {MODEL_DIR}, metrics in RESULTS.md")


if __name__ == "__main__":
    main()
