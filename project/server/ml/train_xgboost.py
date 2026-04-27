from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from severity_features import (
    SEVERITY_CATEGORICAL_FEATURES,
    SEVERITY_FEATURE_COLUMNS,
    SEVERITY_LABELS,
    SEVERITY_NUMERIC_FEATURES,
    SEVERITY_TARGET,
    ensure_feature_columns,
    normalize_severity_labels,
)

try:
    from xgboost import XGBClassifier

    HAS_XGBOOST = True
except Exception:
    HAS_XGBOOST = False
    XGBClassifier = None


DEFAULT_CSV_PATH = (
    Path(__file__).resolve().parent
    / "data"
    / "normalized"
    / "severity"
    / "logging_monitoring_anomalies_normalized.csv"
)
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "model.joblib"
DEFAULT_METADATA_PATH = Path(__file__).resolve().parent / "model_metadata.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the structured severity classifier.")
    parser.add_argument("--csv-path", default=str(DEFAULT_CSV_PATH), help="Training CSV path.")
    parser.add_argument("--model-out", default=str(DEFAULT_MODEL_PATH), help="Joblib output path.")
    parser.add_argument(
        "--metadata-out",
        default=str(DEFAULT_METADATA_PATH),
        help="JSON metadata output path.",
    )
    parser.add_argument("--test-size", type=float, default=0.2, help="Test split ratio.")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed.")
    return parser.parse_args()


def build_classifier(random_state: int):
    if HAS_XGBOOST:
        return XGBClassifier(
            n_estimators=300,
            max_depth=8,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="multi:softprob",
            num_class=len(SEVERITY_LABELS),
            eval_metric="mlogloss",
            tree_method="hist",
            random_state=random_state,
            n_jobs=-1,
        )

    return RandomForestClassifier(
        n_estimators=250,
        max_depth=18,
        min_samples_leaf=2,
        random_state=random_state,
        n_jobs=-1,
    )


def build_pipeline(random_state: int) -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                SEVERITY_NUMERIC_FEATURES,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                SEVERITY_CATEGORICAL_FEATURES,
            ),
        ]
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", build_classifier(random_state)),
        ]
    )


def load_training_frame(csv_path: Path) -> pd.DataFrame:
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Training CSV not found at {csv_path}. Run normalize_datasets.py first or pass --csv-path."
        )

    df = pd.read_csv(csv_path, low_memory=False)
    df.columns = [column.strip() for column in df.columns]
    df[SEVERITY_TARGET] = normalize_severity_labels(df[SEVERITY_TARGET])
    df = df[df[SEVERITY_TARGET].isin(SEVERITY_LABELS)].copy()
    return df


def encode_labels(labels: pd.Series) -> pd.Series:
    label_to_id = {label: idx for idx, label in enumerate(SEVERITY_LABELS)}
    return labels.map(label_to_id)


def build_metadata(
    csv_path: Path,
    model_name: str,
    report: Dict[str, Dict[str, float]],
    accuracy: float,
) -> Dict[str, object]:
    return {
        "task": "severity_classification",
        "dataset_path": str(csv_path),
        "model_type": model_name,
        "labels": SEVERITY_LABELS,
        "target_column": SEVERITY_TARGET,
        "feature_columns": SEVERITY_FEATURE_COLUMNS,
        "numeric_features": SEVERITY_NUMERIC_FEATURES,
        "categorical_features": SEVERITY_CATEGORICAL_FEATURES,
        "accuracy": accuracy,
        "macro_f1": report["macro avg"]["f1-score"],
        "weighted_f1": report["weighted avg"]["f1-score"],
        "classification_report": report,
    }


def main() -> None:
    args = parse_args()
    csv_path = Path(args.csv_path)
    model_out = Path(args.model_out)
    metadata_out = Path(args.metadata_out)

    print(f"Loading severity data from {csv_path}...")
    df = load_training_frame(csv_path)
    print(f"Dataset shape: {df.shape}")
    print("\nClass Distribution:")
    print(df[SEVERITY_TARGET].value_counts())

    X = ensure_feature_columns(df)
    y = encode_labels(df[SEVERITY_TARGET])

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=args.random_state,
        stratify=y,
    )

    pipeline = build_pipeline(args.random_state)
    print("\nTraining severity model...")
    pipeline.fit(X_train, y_train)

    pred_ids = pipeline.predict(X_test)
    y_true_labels: List[str] = [SEVERITY_LABELS[int(idx)] for idx in y_test.tolist()]
    y_pred_labels: List[str] = [SEVERITY_LABELS[int(idx)] for idx in pred_ids.tolist()]

    accuracy = float(accuracy_score(y_true_labels, y_pred_labels))
    report = classification_report(
        y_true_labels,
        y_pred_labels,
        labels=SEVERITY_LABELS,
        output_dict=True,
        zero_division=0,
    )

    model_name = type(pipeline.named_steps["classifier"]).__name__
    metadata = build_metadata(csv_path, model_name, report, accuracy)

    artifact = {
        "pipeline": pipeline,
        "metadata": metadata,
        "labels": SEVERITY_LABELS,
    }

    model_out.parent.mkdir(parents=True, exist_ok=True)
    metadata_out.parent.mkdir(parents=True, exist_ok=True)

    print(f"\nAccuracy: {accuracy:.4f}")
    print(
        classification_report(
            y_true_labels,
            y_pred_labels,
            labels=SEVERITY_LABELS,
            zero_division=0,
        )
    )

    print(f"Saving model artifact to {model_out}...")
    joblib.dump(artifact, model_out)

    print(f"Saving metadata to {metadata_out}...")
    with open(metadata_out, "w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)

    print("Training complete.")


if __name__ == "__main__":
    main()
