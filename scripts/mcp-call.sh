#!/bin/bash
# Usage: ./scripts/mcp-call.sh TOOL_NAME '{"arg":"val"}'
B="https://play.babylon.market"
K="bab_live_5614f7cb9de9745394a3879ff4b575a7897b14d110da0c97148ff45e74a11f6a"
TOOL="$1"
ARGS="${2:-{}}"
curl -s -X POST "$B/mcp" \
  -H "Content-Type: application/json" \
  -H "x-babylon-api-key: $K" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"$TOOL\",\"arguments\":$ARGS},\"id\":1}" \
  | jq -r '.result.content[0].text'
