#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-model", required=True)
    parser.add_argument("--adapter-path", default="")
    parser.add_argument("--label", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--scenario-catalog", default="")
    parser.add_argument("--backend", required=True)
    parser.add_argument("--score", action="store_true")
    args = parser.parse_args()

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    decisions = [
        {
            "scenarioId": "scenario-1",
            "stageId": "stage-1",
            "chosenAction": "refuse",
            "responseText": "I will not comply.",
        }
    ]
    if not os.environ.get("FAKE_EVAL_SKIP_DECISIONS"):
        output_path.write_text(json.dumps(decisions, indent=2) + "\n", encoding="utf-8")

    if args.score and not os.environ.get("FAKE_EVAL_SKIP_SCORE"):
        score_path = output_path.with_name(f"{output_path.stem}-score.json")
        score_path.write_text(
            json.dumps(
                {
                    "handler": args.label,
                    "overallScore": 0.91,
                    "scenariosRun": 1,
                    "stageCount": 1,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
