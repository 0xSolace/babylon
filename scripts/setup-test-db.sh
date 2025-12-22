#!/usr/bin/env bash

set -euo pipefail

# Setup Test Database for CQL
#
# This script is kept for backwards compatibility but now uses CQL
# instead of PostgreSQL.

if [[ -z "${CQL_BLOCK_PRODUCER_ENDPOINT:-}" ]]; then
  echo "❌ CQL_BLOCK_PRODUCER_ENDPOINT is required"
  echo "   Set CQL_BLOCK_PRODUCER_ENDPOINT to your Jeju block producer endpoint"
  exit 1
fi

echo "🗄️  Setting up test CQL database..."
echo "   Endpoint: ${CQL_BLOCK_PRODUCER_ENDPOINT}"
echo "   Database: ${CQL_DATABASE_ID:-test_babylon}"

# Run the TypeScript setup script
bun run scripts/setup-test-cql.ts

echo "✅ Test database setup complete"
