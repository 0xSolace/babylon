from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parent.parent / "scripts" / "manage_rlvr_release.py"


def build_report(path: Path, adapter: Path, score: Path, label: str) -> Path:
    report_path = path / f"{label}-report.json"
    report_path.write_text(
        json.dumps(
            {
                "config": {"model": "Qwen/Qwen3.5-4B"},
                "phases": {
                    "distill": {"status": "completed", "adapter_path": str(adapter)},
                    "eval_distill": {
                        "status": "completed",
                        "overall_score": 0.89,
                        "score_path": str(score),
                        "output_path": str(path / f"{label}-decisions.json"),
                    },
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return report_path


def test_manage_rlvr_release_promote_and_rollback(tmp_path: Path) -> None:
    release_root = tmp_path / "release-root"

    adapter_one = tmp_path / "adapter-one.safetensors"
    adapter_one.write_text("adapter-one", encoding="utf-8")
    score_one = tmp_path / "score-one.json"
    score_one.write_text(json.dumps({"overallScore": 0.89}), encoding="utf-8")
    report_one = build_report(tmp_path, adapter_one, score_one, "one")

    promote_one = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "promote",
            "--report",
            str(report_one),
            "--release-root",
            str(release_root),
            "--label",
            "candidate-one",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    payload_one = json.loads(promote_one.stdout)
    assert payload_one["release_id"].startswith("candidate-one-")
    assert (release_root / "current").is_symlink()

    adapter_two = tmp_path / "adapter-two.safetensors"
    adapter_two.write_text("adapter-two", encoding="utf-8")
    score_two = tmp_path / "score-two.json"
    score_two.write_text(json.dumps({"overallScore": 0.93}), encoding="utf-8")
    report_two = build_report(tmp_path, adapter_two, score_two, "two")

    promote_two = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "promote",
            "--report",
            str(report_two),
            "--release-root",
            str(release_root),
            "--label",
            "candidate-two",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    payload_two = json.loads(promote_two.stdout)
    current = json.loads((release_root / "current.json").read_text(encoding="utf-8"))
    previous = json.loads((release_root / "previous.json").read_text(encoding="utf-8"))
    assert current["release_id"] == payload_two["release_id"]
    assert previous["release_id"] == payload_one["release_id"]

    rollback = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "rollback",
            "--release-root",
            str(release_root),
            "--target-release-id",
            payload_one["release_id"],
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    rollback_event = json.loads(rollback.stdout)
    current_after = json.loads((release_root / "current.json").read_text(encoding="utf-8"))
    assert rollback_event["to_release_id"] == payload_one["release_id"]
    assert current_after["release_id"] == payload_one["release_id"]
