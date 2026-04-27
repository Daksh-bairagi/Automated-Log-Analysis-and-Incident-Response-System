"""
Normalize the datasets downloaded into the Desktop dataset folder.

Outputs are written under server/ml/data/normalized so each downstream model
can train on a clean, task-specific dataset instead of mixing incompatible rows.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List

import pandas as pd

from severity_features import (
    SEVERITY_CATEGORICAL_FEATURES,
    SEVERITY_FEATURE_COLUMNS,
    SEVERITY_LABELS,
    SEVERITY_NUMERIC_FEATURES,
    SEVERITY_TARGET,
    normalize_severity_labels,
)

DEFAULT_DATASET_ROOT = Path(r"C:\Users\jadon\OneDrive\Desktop\dataset")
DEFAULT_OUTPUT_ROOT = Path(__file__).resolve().parent / "data" / "normalized"

NETWORK_LABEL_MAP = {
    "BENIGN": "BENIGN",
    "DDOS": "DDOS",
    "PORTSCAN": "PORTSCAN",
    "BOT": "BOT",
    "INFILTRATION": "INFILTRATION",
    "HEARTBLEED": "HEARTBLEED",
    "FTP-PATATOR": "BRUTE_FORCE",
    "SSH-PATATOR": "BRUTE_FORCE",
    "WEB ATTACK - BRUTE FORCE": "WEB_ATTACK_BRUTE_FORCE",
    "WEB ATTACK - XSS": "WEB_ATTACK_XSS",
    "WEB ATTACK - SQL INJECTION": "WEB_ATTACK_SQL_INJECTION",
    "DOS SLOWLORIS": "DOS_SLOWLORIS",
    "DOS SLOWHTTPTEST": "DOS_SLOWHTTPTEST",
    "DOS HULK": "DOS_HULK",
    "DOS GOLDENEYE": "DOS_GOLDENEYE",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize downloaded ML datasets.")
    parser.add_argument(
        "--dataset-root",
        default=str(DEFAULT_DATASET_ROOT),
        help="Folder that contains the downloaded CSV files.",
    )
    parser.add_argument(
        "--output-root",
        default=str(DEFAULT_OUTPUT_ROOT),
        help="Folder where normalized CSVs will be written.",
    )
    parser.add_argument(
        "--task",
        choices=["all", "severity", "cloud", "network", "logs"],
        default="all",
        help="Subset of normalizers to run.",
    )
    return parser.parse_args()


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def read_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, low_memory=False)
    df.columns = [column.strip() for column in df.columns]
    return df


def sanitize_label(value: object) -> str:
    text = str(value).strip()
    text = text.replace("\ufffd", "-")
    text = re.sub(r"\s+", " ", text)
    return NETWORK_LABEL_MAP.get(text.upper(), text.upper().replace(" ", "_").replace("-", "_"))


def normalize_severity_dataset(dataset_root: Path, output_root: Path) -> Dict[str, object]:
    source_path = dataset_root / "logging_monitoring_anomalies.csv"
    output_path = output_root / "severity" / "logging_monitoring_anomalies_normalized.csv"

    df = read_csv(source_path)
    df[SEVERITY_TARGET] = normalize_severity_labels(df[SEVERITY_TARGET])
    df = df[df[SEVERITY_TARGET].isin(SEVERITY_LABELS)].copy()

    for column in SEVERITY_NUMERIC_FEATURES:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    for column in SEVERITY_CATEGORICAL_FEATURES:
        df[column] = df[column].fillna("Unknown").astype(str).str.strip()

    normalized = df[
        ["Timestamp", "Anomaly_ID", SEVERITY_TARGET] + SEVERITY_FEATURE_COLUMNS
    ].copy()
    normalized["source_dataset"] = source_path.name

    ensure_parent(output_path)
    normalized.to_csv(output_path, index=False)

    return {
        "task": "severity",
        "path": str(output_path),
        "rows": int(len(normalized)),
        "labels": normalized[SEVERITY_TARGET].value_counts().to_dict(),
    }


def normalize_cloud_dataset(dataset_root: Path, output_root: Path) -> Dict[str, object]:
    source_path = dataset_root / "cloud_dataset.csv"
    output_path = output_root / "cloud" / "cloud_dataset_normalized.csv"

    df = read_csv(source_path).rename(
        columns={
            "Timestamp": "timestamp",
            "CPU_Usage": "cpu_usage",
            "Memory_Usage": "memory_usage",
            "Disk_IO": "disk_io",
            "Network_IO": "network_io",
            "Workload_Type": "workload_type",
            "User_ID": "user_id",
            "Anomaly_Label": "anomaly_label",
        }
    )

    numeric_columns = ["cpu_usage", "memory_usage", "disk_io", "network_io"]
    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df["anomaly_label"] = pd.to_numeric(df["anomaly_label"], errors="coerce").fillna(0).astype(int)
    df["source_dataset"] = source_path.name

    ensure_parent(output_path)
    df.to_csv(output_path, index=False)

    return {
        "task": "cloud",
        "path": str(output_path),
        "rows": int(len(df)),
        "labels": df["anomaly_label"].value_counts().to_dict(),
    }


def normalize_apache_logs(dataset_root: Path, output_root: Path) -> Dict[str, object]:
    source_path = dataset_root / "Apache_2k.log_structured.csv"
    output_path = output_root / "logs" / "apache_normalized.csv"

    df = read_csv(source_path)
    normalized = pd.DataFrame(
        {
            "timestamp": df["Time"],
            "level": df["Level"].astype(str).str.upper(),
            "source": "apache",
            "message": df["Content"],
            "event_id": df["EventId"],
            "event_template": df["EventTemplate"],
            "source_dataset": source_path.name,
        }
    )

    ensure_parent(output_path)
    normalized.to_csv(output_path, index=False)
    return {"task": "logs", "path": str(output_path), "rows": int(len(normalized))}


def normalize_openssh_logs(dataset_root: Path, output_root: Path) -> Dict[str, object]:
    source_path = dataset_root / "OpenSSH_2k.log_structured.csv"
    output_path = output_root / "logs" / "openssh_normalized.csv"

    df = read_csv(source_path)
    timestamp = df["Date"].astype(str) + " " + df["Day"].astype(str) + " " + df["Time"].astype(str)
    normalized = pd.DataFrame(
        {
            "timestamp": timestamp,
            "level": "INFO",
            "source": df["Component"].fillna("openssh").astype(str),
            "message": df["Content"],
            "event_id": df["EventId"],
            "event_template": df["EventTemplate"],
            "process_id": df["Pid"],
            "source_dataset": source_path.name,
        }
    )

    ensure_parent(output_path)
    normalized.to_csv(output_path, index=False)
    return {"task": "logs", "path": str(output_path), "rows": int(len(normalized))}


def normalize_openstack_logs(dataset_root: Path, output_root: Path) -> Dict[str, object]:
    source_path = dataset_root / "OpenStack_2k.log_structured.csv"
    output_path = output_root / "logs" / "openstack_normalized.csv"

    df = read_csv(source_path)
    method = df["Content"].astype(str).str.extract(r'"([A-Z]+)\s+')[0]
    status_code = pd.to_numeric(df["Content"].astype(str).str.extract(r"status:\s+(\d+)")[0], errors="coerce")
    latency_seconds = pd.to_numeric(
        df["Content"].astype(str).str.extract(r"time:\s+([0-9.]+)")[0], errors="coerce"
    )

    normalized = pd.DataFrame(
        {
            "timestamp": df["Date"].astype(str) + " " + df["Time"].astype(str),
            "level": df["Level"].astype(str).str.upper(),
            "source": df["Component"].fillna("openstack").astype(str),
            "message": df["Content"],
            "event_id": df["EventId"],
            "event_template": df["EventTemplate"],
            "request_id": df["ADDR"],
            "http_method": method.fillna("UNKNOWN"),
            "status_code": status_code,
            "response_time_ms": latency_seconds * 1000.0,
            "source_dataset": source_path.name,
        }
    )

    ensure_parent(output_path)
    normalized.to_csv(output_path, index=False)
    return {"task": "logs", "path": str(output_path), "rows": int(len(normalized))}


def normalize_network_datasets(dataset_root: Path, output_root: Path) -> List[Dict[str, object]]:
    archive_root = dataset_root / "archive"
    network_output_root = output_root / "network"
    network_output_root.mkdir(parents=True, exist_ok=True)

    summaries: List[Dict[str, object]] = []

    for source_path in sorted(archive_root.glob("*.csv")):
        df = read_csv(source_path)

        if "Label" not in df.columns:
            continue

        df = df.rename(columns={"Label": "attack_label"})
        df["attack_label"] = df["attack_label"].map(sanitize_label)
        df["source_dataset"] = source_path.name

        output_path = network_output_root / f"{source_path.stem}_normalized.csv"
        df.to_csv(output_path, index=False)

        summaries.append(
            {
                "task": "network",
                "path": str(output_path),
                "rows": int(len(df)),
                "labels": df["attack_label"].value_counts().head(10).to_dict(),
            }
        )

    return summaries


def write_manifest(output_root: Path, manifest: List[Dict[str, object]]) -> None:
    manifest_path = output_root / "manifest.json"
    ensure_parent(manifest_path)
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)


def main() -> None:
    args = parse_args()
    dataset_root = Path(args.dataset_root)
    output_root = Path(args.output_root)
    manifest: List[Dict[str, object]] = []

    if args.task in {"all", "severity"}:
        manifest.append(normalize_severity_dataset(dataset_root, output_root))
    if args.task in {"all", "cloud"}:
        manifest.append(normalize_cloud_dataset(dataset_root, output_root))
    if args.task in {"all", "logs"}:
        manifest.append(normalize_apache_logs(dataset_root, output_root))
        manifest.append(normalize_openssh_logs(dataset_root, output_root))
        manifest.append(normalize_openstack_logs(dataset_root, output_root))
    if args.task in {"all", "network"}:
        manifest.extend(normalize_network_datasets(dataset_root, output_root))

    write_manifest(output_root, manifest)

    print("Normalization complete.")
    for item in manifest:
        print(f"- {item['task']}: {item['path']}")


if __name__ == "__main__":
    main()
