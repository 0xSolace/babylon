from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from openai_clean_proxy import sanitize_payload


def test_sanitize_payload_strips_empty_tool_keys():
    payload = {
        "model": "test",
        "messages": [{"role": "user", "content": "hello"}],
        "tools": None,
        "tool_choice": "none",
        "parallel_tool_calls": [],
        "metadata": {"keep": True},
    }

    cleaned = sanitize_payload(payload)

    assert cleaned == {
        "model": "test",
        "messages": [{"role": "user", "content": "hello"}],
        "metadata": {"keep": True},
    }
