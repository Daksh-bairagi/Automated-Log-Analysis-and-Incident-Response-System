import json
import os
import shutil
import subprocess

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from torch.utils.data import Dataset
from transformers import (
    DistilBertForSequenceClassification,
    DistilBertTokenizer,
    Trainer,
    TrainingArguments,
)

# One-cell Kaggle script:
# 1) installs dependency
# 2) loads CSV (tries Kaggle + your local Windows path)
# 3) builds text from structured columns
# 4) trains DistilBERT
# 5) evaluates and saves model + metadata
subprocess.run(["pip", "install", "-q", "accelerate==0.29.3"], check=False)


def resolve_csv_path():
    candidates = [
        "/kaggle/input/log-severity-training-data/training_data.csv",
        "/kaggle/input/logging-monitoring-anomalies/logging_monitoring_anomalies.csv",
        "/kaggle/working/logging_monitoring_anomalies.csv",
        r"C:\Users\jadon\OneDrive\Desktop\p - Copy\logging_monitoring_anomalies.csv",
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    raise FileNotFoundError(
        "CSV not found. Put logging_monitoring_anomalies.csv in Kaggle input, /kaggle/working, or the local Windows path."
    )


csv_path = resolve_csv_path()

df = pd.read_csv(csv_path)
print(f"Loaded: {csv_path}")
print(f"Shape: {df.shape}")

required_columns = [
    "Anomaly_Type",
    "Source",
    "Status",
    "CPU_Usage_Percent",
    "Memory_Usage_MB",
    "Disk_Usage_Percent",
    "Response_Time_ms",
    "Login_Attempts",
    "Failed_Transactions",
    "Retry_Count",
    "Alert_Method",
    "Service_Type",
    "Severity",
]
missing = [c for c in required_columns if c not in df.columns]
if missing:
    raise ValueError(f"Missing required columns: {missing}")

label_order = ["Low", "Medium", "High", "Critical"]
present_labels = [l for l in label_order if l in set(df["Severity"].astype(str).str.strip())]
if not present_labels:
    present_labels = sorted(df["Severity"].dropna().astype(str).str.strip().unique().tolist())

label2id = {l: i for i, l in enumerate(present_labels)}
id2label = {i: l for l, i in label2id.items()}

for c in required_columns:
    if c != "Severity":
        df[c] = df[c].astype(str)

def build_message(row):
    return (
        f"{row['Anomaly_Type']} anomaly detected from {row['Source']}. "
        f"Status: {row['Status']}. "
        f"CPU usage {row['CPU_Usage_Percent']}%, memory {row['Memory_Usage_MB']}MB, "
        f"disk {row['Disk_Usage_Percent']}%. Response time {row['Response_Time_ms']}ms. "
        f"Login attempts: {row['Login_Attempts']}, failed transactions: {row['Failed_Transactions']}, "
        f"retry count: {row['Retry_Count']}. Alert via {row['Alert_Method']}. "
        f"Service type: {row['Service_Type']}."
    )

df["message"] = df.apply(build_message, axis=1)
df["label"] = df["Severity"].astype(str).str.strip().map(label2id)
df = df.dropna(subset=["label"]).copy()
df["label"] = df["label"].astype(int)

if df.empty:
    raise ValueError("No rows remain after filtering labels. Check the Severity values in the CSV.")

print("\nLabel distribution:")
print(df["label"].value_counts().sort_index())

tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")

class LogDataset(Dataset):
    def __init__(self, texts, labels):
        self.enc = tokenizer(texts, truncation=True, padding=True, max_length=128)
        self.labels = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        item = {k: torch.tensor(v[idx]) for k, v in self.enc.items()}
        item["labels"] = torch.tensor(self.labels[idx])
        return item

label_counts = df["label"].value_counts()
can_stratify = df["label"].nunique() > 1 and label_counts.min() >= 2
stratify_col = df["label"] if can_stratify else None
train_df, val_df = train_test_split(
    df, test_size=0.2, random_state=42, stratify=stratify_col
)
train_ds = LogDataset(train_df["message"].tolist(), train_df["label"].tolist())
val_ds = LogDataset(val_df["message"].tolist(), val_df["label"].tolist())

model = DistilBertForSequenceClassification.from_pretrained(
    "distilbert-base-uncased",
    num_labels=len(present_labels),
    id2label=id2label,
    label2id=label2id,
)

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {"accuracy": float((preds == labels).mean())}

training_args = TrainingArguments(
    output_dir="/kaggle/working/results" if os.path.exists("/kaggle") else "./results",
    num_train_epochs=3,
    per_device_train_batch_size=32,
    per_device_eval_batch_size=64,
    warmup_steps=100,
    weight_decay=0.01,
    fp16=torch.cuda.is_available(),
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss",
    logging_steps=50,
    report_to="none",
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    compute_metrics=compute_metrics,
)
trainer.train()

pred_out = trainer.predict(val_ds)
preds = np.argmax(pred_out.predictions, axis=-1)
print("\n=== Classification Report ===")
print(
    classification_report(
        val_df["label"].tolist(),
        preds,
        target_names=[id2label[i] for i in sorted(id2label.keys())],
        zero_division=0,
    )
)

is_kaggle = os.path.exists("/kaggle")
work_dir = "/kaggle/working" if is_kaggle else "."
save_dir = os.path.join(work_dir, "log_classifier_model")
metadata_path = os.path.join(work_dir, "model_metadata.json")

os.makedirs(save_dir, exist_ok=True)
model.save_pretrained(save_dir)
tokenizer.save_pretrained(save_dir)

metadata = {
    "csv_path_used": csv_path,
    "format": (
        "{Anomaly_Type} anomaly detected from {Source}. Status: {Status}. "
        "CPU usage {CPU_Usage_Percent}%, memory {Memory_Usage_MB}MB, disk {Disk_Usage_Percent}%. "
        "Response time {Response_Time_ms}ms. Login attempts: {Login_Attempts}, "
        "failed transactions: {Failed_Transactions}, retry count: {Retry_Count}. "
        "Alert via {Alert_Method}. Service type: {Service_Type}."
    ),
    "labels": present_labels,
    "label2id": label2id,
    "id2label": id2label,
}
with open(metadata_path, "w", encoding="utf-8") as f:
    json.dump(metadata, f, indent=2)

shutil.copy(metadata_path, os.path.join(save_dir, "model_metadata.json"))
archive_base = os.path.join(work_dir, "log_classifier_model")
shutil.make_archive(archive_base, "zip", save_dir)

print("\nDone.")
print(f"Model folder: {save_dir}")
print(f"Model zip: {archive_base}.zip")
print(f"Metadata: {metadata_path}")
