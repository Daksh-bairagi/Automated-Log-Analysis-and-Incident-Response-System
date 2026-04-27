"""
Shared feature definitions for the structured severity model.

This keeps training and inference aligned so the FastAPI service uses the same
feature names and defaults that the training pipeline expects.
"""

from __future__ import annotations

from typing import Dict, Iterable, List

import pandas as pd

SEVERITY_TARGET = "Severity"
SEVERITY_LABELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

SEVERITY_NUMERIC_FEATURES = [
    "CPU_Usage_Percent",
    "Memory_Usage_MB",
    "Disk_Usage_Percent",
    "Response_Time_ms",
    "Login_Attempts",
    "Failed_Transactions",
    "Retry_Count",
]

SEVERITY_CATEGORICAL_FEATURES = [
    "Anomaly_Type",
    "Source",
    "Status",
    "Alert_Method",
    "Service_Type",
]

SEVERITY_FEATURE_COLUMNS = SEVERITY_NUMERIC_FEATURES + SEVERITY_CATEGORICAL_FEATURES

REQUEST_TO_DATASET_COLUMN_MAP = {
    "anomaly_type": "Anomaly_Type",
    "source": "Source",
    "status": "Status",
    "cpu_usage": "CPU_Usage_Percent",
    "memory_usage": "Memory_Usage_MB",
    "disk_usage": "Disk_Usage_Percent",
    "response_time_ms": "Response_Time_ms",
    "login_attempts": "Login_Attempts",
    "failed_transactions": "Failed_Transactions",
    "retry_count": "Retry_Count",
    "alert_method": "Alert_Method",
    "service_type": "Service_Type",
}

NUMERIC_DEFAULTS = {
    "CPU_Usage_Percent": 0.0,
    "Memory_Usage_MB": 0.0,
    "Disk_Usage_Percent": 0.0,
    "Response_Time_ms": 0.0,
    "Login_Attempts": 0.0,
    "Failed_Transactions": 0.0,
    "Retry_Count": 0.0,
}

CATEGORICAL_DEFAULTS = {
    "Anomaly_Type": "Unknown",
    "Source": "Unknown",
    "Status": "Open",
    "Alert_Method": "Dashboard",
    "Service_Type": "Web",
}


def normalize_severity_labels(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().str.upper()


def ensure_feature_columns(frame: pd.DataFrame) -> pd.DataFrame:
    df = frame.copy()

    for column in SEVERITY_NUMERIC_FEATURES:
        if column not in df.columns:
            df[column] = NUMERIC_DEFAULTS[column]
        df[column] = pd.to_numeric(df[column], errors="coerce")

    for column in SEVERITY_CATEGORICAL_FEATURES:
        if column not in df.columns:
            df[column] = CATEGORICAL_DEFAULTS[column]
        df[column] = (
            df[column]
            .fillna(CATEGORICAL_DEFAULTS[column])
            .astype(str)
            .str.strip()
            .replace({"": CATEGORICAL_DEFAULTS[column], "nan": CATEGORICAL_DEFAULTS[column]})
        )

    return df[SEVERITY_FEATURE_COLUMNS]


def request_payload_to_row(payload: Dict[str, object]) -> Dict[str, object]:
    row = {
        column: NUMERIC_DEFAULTS.get(column, CATEGORICAL_DEFAULTS.get(column))
        for column in SEVERITY_FEATURE_COLUMNS
    }

    for request_key, dataset_column in REQUEST_TO_DATASET_COLUMN_MAP.items():
        value = payload.get(request_key)
        if value is None:
            continue
        row[dataset_column] = value

    return row


def build_inference_frame(payloads: Iterable[Dict[str, object]]) -> pd.DataFrame:
    rows: List[Dict[str, object]] = [request_payload_to_row(payload) for payload in payloads]
    return ensure_feature_columns(pd.DataFrame(rows))
