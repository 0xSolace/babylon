# Babylon Decentralization Status

## Current Status: FULLY DECENTRALIZED

Babylon runs on Jeju's fully decentralized infrastructure with **no centralized fallbacks**.

### Decentralized Stack

| Service | Status | Implementation |
|---------|--------|----------------|
| Database | ✅ CQL | `packages/db/src/decentralized/` |
| Cache | ✅ Jeju Cache | `packages/api/src/cache/cache.ts` |
| Storage | ✅ Jeju Storage (IPFS) | `packages/api/src/storage/storage.ts` |
| Secrets | ✅ Jeju KMS | `packages/api/src/secrets/kms-client.ts` |
| Auth | ✅ OAuth3 | `packages/auth/src/oauth3/` |
| LLM Inference | ✅ Jeju Compute | `packages/api/src/llm/inference-client.ts` |
| Agent Runtime | ✅ Decentralized Runner | `packages/agents/src/runner/` |

### What Was Removed

All centralized dependencies have been removed:
- ❌ PostgreSQL → CQL
- ❌ Redis → Jeju Cache
- ❌ S3/MinIO/Vercel Blob → Jeju Storage (IPFS)
- ❌ Privy → OAuth3
- ❌ Groq/OpenAI/Anthropic API keys → Jeju Compute Marketplace

### Environment Variables

Required for operation (all decentralized):

```env
# Database (CQL)
CQL_BLOCK_PRODUCER_ENDPOINT=http://localhost:15151

# Cache
JEJU_CACHE_SERVICE_URL=http://localhost:8080/cache

# Storage
JEJU_STORAGE_SERVICE_URL=http://localhost:8080/storage

# Compute (LLM Inference)
JEJU_COMPUTE_API_URL=http://localhost:8080/compute
JEJU_USER_ADDRESS=0x...

# KMS (optional, for advanced key management)
JEJU_KMS_URL=http://localhost:8080/kms

# OAuth3
OAUTH3_ISSUER_URL=http://localhost:8080/oauth3

# Blockchain
RPC_URL=http://localhost:8545
CHAIN_ID=31337
```

### No Fallbacks Policy

The codebase enforces no fallback behavior:

```typescript
// This pattern is NOT allowed:
if (!decentralizedService) {
  return centralizedFallback();
}

// Instead, services throw if unavailable:
if (!decentralizedService) {
  throw new Error('Decentralized service required but not available');
}
```

### Testing

Run decentralized integration tests:
```bash
bun test packages/testing/integration/decentralized-stack.integration.test.ts
```

### Contract Deployment

Contracts auto-deploy via Jeju CLI when `autoStart: true` in `jeju-manifest.json`:
- BabylonTreasury
- BanManager  
- ModerationMarketplace
- X402Facilitator
- BabylonPaymaster
- AgentExecutionRegistry

### Development

Start the full decentralized stack:
```bash
# From Jeju monorepo root
bun run dev

# Then in vendor/babylon
bun run dev:web
```
