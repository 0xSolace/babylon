# API Utilities

Server-side utilities for authentication, API key management, and common API patterns.

## API Key Management

### Overview

Secure API key management for external agent authentication (MCP and A2A). Provides functions for generating, hashing, and verifying API keys using cryptographically secure random generation and SHA-256 hashing.

### Features

- **Secure generation**: Cryptographically secure random API keys
- **Hashing**: SHA-256 one-way hashing for secure storage
- **Cached validation**: In-memory LRU cache (5 min TTL, 1000 max entries)
- **Write-back cache**: Redis-based batching for `lastUsedAt` updates (90%+ database load reduction)

### API Key Format

- **Production**: `bab_live_<32 random hex characters>`
- **Test**: `bab_test_<32 random hex characters>`

### Usage

```typescript
import {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  validateUserApiKey,
} from '@babylon/api';

// Generate new API key
const apiKey = generateApiKey();
// Returns: "bab_live_a1b2c3d4e5f6..."

// Hash for storage
const hash = hashApiKey(apiKey);

// Verify during authentication
const isValid = verifyApiKey(providedKey, storedHash);

// Validate user API key (with caching)
const result = await validateUserApiKey('bab_live_abc123...');
if (result) {
  console.log('Authenticated user:', result.userId);
}
```

### Write-Back Cache for lastUsedAt

**Why**: High-frequency `lastUsedAt` updates were overwhelming the database (1,830 executions, 115,885 seconds total).

**Solution**: Write-back cache pattern using Redis:
- Updates go to Redis first (fast writes)
- Background flusher batches and flushes to database periodically
- Reduces database load by 90%+

**Documentation**: See `API_KEY_WRITEBACK_CACHE.md` for full details.

**Configuration**: Flusher starts automatically on server startup. See `api-key-lastused-flusher.ts` for flush parameters.

## Duplicate Detection

Utilities for detecting and managing duplicate content.

**Location**: `duplicate-detector.ts`

## Environment Detection

Utilities for detecting deployment environment.

**Location**: `environment.ts`

## IP Utilities

Utilities for IP address handling and hashing.

**Location**: `ip-utils.ts`

## Token Counter

Token counting utilities for LLM context management.

**Location**: `token-counter.ts`

## Related Documentation

- **Write-Back Cache**: `API_KEY_WRITEBACK_CACHE.md`
- **Roadmap**: `ROADMAP.md`
- **Changelog**: `../../../../CHANGELOG.md`
