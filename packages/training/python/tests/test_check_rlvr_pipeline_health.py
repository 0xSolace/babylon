from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parent.parent / "scripts" / "check_rlvr_pipeline_health.py"
)


def test_check_rlvr_pipeline_health_reports_healthy_run(tmp_path: Path) -> None:
    adapter = tmp_path / "adapters.safetensors"
    adapter.write_text("adapter", encoding="utf-8")
    score = tmp_path / "eval-score.json"
    score.write_text(json.dumps({"overallScore": 0.91}), encoding="utf-8")
    metrics = tmp_path / "training_metrics.jsonl"
    metrics.write_text(json.dumps({"loss": 0.32}) + "\n", encoding="utf-8")
    scenario_manifest = tmp_path / "scenario_manifest.json"
    scenario_manifest.write_text(json.dumps({"scenarioCount": 1}), encoding="utf-8")
    best_cots = tmp_path / "best_cots.jsonl"
    best_cots.write_text(json.dumps({"scenario_id": "scenario-1"}) + "\n", encoding="utf-8")
    report_path = tmp_path / "rlvr_pipeline_report.json"
    report_path.write_text(
        json.dumps(
            {
                "pipeline": "rlvr",
                "phases": {
                    "sft": {"status": "completed", "adapter_path": str(adapter)},
                    "eval_sft": {"status": "completed", "score_path": str(score), "overall_score": 0.91},
                    "grpo": {
                        "status": "completed",
                        "metrics_path": str(metrics),
                        "scenario_manifest": str(scenario_manifest),
                        "best_cots_path": str(best_cots),
                        "best_cots_count": 1,
                    },
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    proc = subprocess.run(
        [sys.executable, str(SCRIPT_PATH), "--report", str(report_path)],
        capture_output=True,
        text=True,
        check=False,
    )

    assert proc.returncode == 0
    health = json.loads(proc.stdout)
    assert health["status"] == "healthy"
    assert health["alert_count"] == 0


def test_check_rlvr_pipeline_health_reports_critical_missing_artifacts(tmp_path: Path) -> None:
    report_path = tmp_path / "rlvr_pipeline_report.json"
    report_path.write_text(
        json.dumps(
            {
                "pipeline": "rlvr",
                "phases": {
                    "distill": {"status": "completed", "adapter_path": str(tmp_path / "missing")},
                    "eval_distill": {"status": "completed", "score_path": str(tmp_path / "missing-score"), "overall_score": 0.1},
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    proc = subprocess.run(
        [sys.executable, str(SCRIPT_PATH), "--report", str(report_path)],
        capture_output=True,
        text=True,
        check=False,
    )

    assert proc.returncode == 1
    health = json.loads(proc.stdout)
    assert health["status"] == "critical"
    assert any(alert["code"] == "distill-missing-adapter" for alert in health["alerts"])

