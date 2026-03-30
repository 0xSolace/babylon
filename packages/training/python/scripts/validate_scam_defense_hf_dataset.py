#!/usr/bin/env python3
"""
Validate the local HF-ready scam-defense dataset repo.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
import logging
from pathlib import Path
from typing import Any

from assemble_scam_defense_hf_dataset import BENIGN_CATEGORY_LABELS, REQUIRED_COLUMNS, read_json, write_json


LOGGER = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate a local scam-defense HF dataset repo.")
    parser.add_argument("--dataset-dir", required=True, help="Path to the assembled dataset repo.")
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path for a validation report JSON file.",
    )
    parser.add_argument("--log-level", default="INFO")
    return parser.parse_args()


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, str(level).upper(), logging.INFO),
        format="%(levelname)s %(name)s: %(message)s",
    )


def parquet_files_by_split(dataset_dir: Path) -> dict[str, list[str]]:
    data_root = dataset_dir / "data"
    mapping: dict[str, list[str]] = {}
    for split_dir in sorted(path for path in data_root.iterdir() if path.is_dir()):
        parquet_files = sorted(str(path) for path in split_dir.glob("*.parquet"))
        if parquet_files:
            mapping[split_dir.name] = parquet_files
    return mapping


def load_dataset_splits(dataset_dir: Path) -> dict[str, Any]:
    from datasets import load_dataset

    data_files = parquet_files_by_split(dataset_dir)
    if not data_files:
        raise FileNotFoundError(f"No Parquet files found under {dataset_dir / 'data'}")
    return load_dataset("parquet", data_files=data_files)


def validate_dataset(dataset_dir: Path) -> dict[str, Any]:
    manifest_path = dataset_dir / "metadata" / "assembly_manifest.json"
    readme_path = dataset_dir / "README.md"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Missing assembly manifest: {manifest_path}")
    if not readme_path.exists():
        raise FileNotFoundError(f"Missing dataset README: {readme_path}")

    manifest = read_json(manifest_path)
    dataset = load_dataset_splits(dataset_dir)
    split_counts = {split_name: len(split_data) for split_name, split_data in dataset.items()}
    all_rows = []
    seen_record_ids: set[str] = set()
    duplicate_record_ids: set[str] = set()
    split_keys_by_split: dict[str, set[str]] = defaultdict(set)
    overlapping_split_keys: dict[str, list[str]] = defaultdict(list)
    origin_counts: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()

    for split_name, split_data in dataset.items():
        column_names = set(split_data.column_names)
        missing = REQUIRED_COLUMNS - column_names
        if missing:
            raise ValueError(f"Split {split_name} is missing required columns: {sorted(missing)}")
        for row in split_data:
            record_id = str(row["record_id"])
            if record_id in seen_record_ids:
                duplicate_record_ids.add(record_id)
            seen_record_ids.add(record_id)
            split_key = str(row["split_key"])
            if split_key in split_keys_by_split and split_key not in split_keys_by_split[split_name]:
                for other_split, other_keys in split_keys_by_split.items():
                    if other_split == split_name:
                        continue
                    if split_key in other_keys:
                        overlapping_split_keys[split_key].append(other_split)
            split_keys_by_split[split_name].add(split_key)
            origin_counts[str(row["origin_tag"])] += 1
            category_counts[str(row["category"])] += 1
            all_rows.append(row)

            if not str(row["origin_tag"]).strip():
                raise ValueError(f"Row {record_id} has an empty origin_tag")
            if not str(row["source_pool"]).strip():
                raise ValueError(f"Row {record_id} has an empty source_pool")
            if not str(row["assistant_response"]).strip():
                raise ValueError(f"Row {record_id} has an empty assistant_response")
            if str(row["category"]).lower() in BENIGN_CATEGORY_LABELS and bool(row["is_scam"]):
                raise ValueError(f"Row {record_id} is benign-labeled but marked as scam")
            if bool(row["is_scam"]) and str(row["label"]) != "scam":
                raise ValueError(f"Row {record_id} has inconsistent scam label")
            if not bool(row["is_scam"]) and str(row["label"]) != "not_scam":
                raise ValueError(f"Row {record_id} has inconsistent non-scam label")
            json.loads(str(row["messages_json"]))
            json.loads(str(row["available_actions_json"]))
            json.loads(str(row["private_analysis_json"]))
            json.loads(str(row["metadata_json"]))

    if duplicate_record_ids:
        raise ValueError(f"Duplicate record_ids across splits: {sorted(duplicate_record_ids)[:10]}")
    if overlapping_split_keys:
        sample = {
            key: sorted(set(value))
            for key, value in list(overlapping_split_keys.items())[:10]
        }
        raise ValueError(f"Split-key leakage detected: {sample}")

    manifest_split_counts = manifest.get("splitCounts") or {}
    if manifest_split_counts != split_counts:
        raise ValueError(
            f"Manifest split counts do not match Parquet rows: manifest={manifest_split_counts}, actual={split_counts}"
        )

    report = {
        "status": "pass",
        "datasetDir": str(dataset_dir),
        "generatedAt": manifest.get("generatedAt"),
        "splitCounts": split_counts,
        "rowCount": len(all_rows),
        "categoryCounts": dict(category_counts),
        "originCount": len(origin_counts),
        "splitGroupCounts": {
            split_name: len(split_keys)
            for split_name, split_keys in split_keys_by_split.items()
        },
        "requiredColumns": sorted(REQUIRED_COLUMNS),
    }
    return report


def main() -> int:
    args = parse_args()
    configure_logging(args.log_level)
    try:
        dataset_dir = Path(args.dataset_dir).resolve()
        report = validate_dataset(dataset_dir)
        if args.output:
            write_json(Path(args.output).resolve(), report)
        LOGGER.info(
            "Scam-defense HF dataset validation passed for %s with %d rows",
            dataset_dir,
            report["rowCount"],
        )
        return 0
    except Exception:
        LOGGER.exception("Scam-defense HF dataset validation failed")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
