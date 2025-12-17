# @babylon/auth

Permissionless decentralized authentication for Babylon using TEE-backed MPC (Multi-Party Computation).

## Features

- **🔐 MPC Key Management** - Threshold key generation and signing via TEE network
- **🆔 Decentralized Identity** - DID creation and management (`did:jeju:*`)
- **🔑 OAuth Integration** - Twitter, Discord, Farcaster with PKCE
- **💾 Key Backup** - Password-based encrypted backups
- **🎫 Permissionless Sessions** - Wallet-signed tokens, no shared secrets

## Quick Start

```typescript
import { DIDManager } from '@babylon/auth';
import { createSessionMessage, SessionManager } from '@babylon/auth/server';

// Create identity with wallet auth
const didManager = new DIDManager({
  network: 'testnet',
  mpcConfig: {
    endpoints: ['http://localhost:4010'],
    threshold: 1,
  },
});

const { did, walletAddress } = await didManager.createIdentity({
  type: 'wallet',
  address: '0x...',
  signature: '0x...',
  message: 'Sign to create identity',
});

// Create permissionless session (no shared secret needed)
const sessionManager = new SessionManager();
const { message, claims } = createSessionMessage(did, walletAddress);

// User signs message with their wallet
const signature = await wallet.signMessage(message);

// Create session token
const token = sessionManager.createToken(claims, signature);

// Verify anywhere - no secret needed, just signature verification
const verified = await sessionManager.verifyToken(token);
```

## Environment Variables

### Client Configuration
```bash
# MPC Network
MPC_ENDPOINTS=http://localhost:4010  # Comma-separated MPC node URLs
MPC_NETWORK_ID=jeju-localnet         # Network: localnet | testnet | mainnet
MPC_THRESHOLD=1                       # Signing threshold (default: 1)
MPC_TIMEOUT=30000                     # Request timeout in ms
```

### Server Configuration
```bash
# Environment
NODE_ENV=production                   # Set for production security checks

# Session expiry (optional)
SESSION_EXPIRES_IN=86400              # Token expiration in seconds (24h default)
```

> **No secrets needed!** Sessions use wallet signatures for verification.
> This is fully permissionless - anyone can verify tokens without a shared secret.

### OAuth Providers (optional)
```bash
# Twitter OAuth 2.0
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_CALLBACK_URL=

# Discord OAuth 2.0
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_CALLBACK_URL=
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│  (Web app, Mobile app, CLI)                                 │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    @babylon/auth                             │
│                                                             │
│  DIDManager      │  SessionManager  │  MPCClient            │
│  (identity)      │  (permissionless │  (keys/signing)       │
│                  │   sessions)      │                       │
│  OAuth           │  KeyBackup       │  SocialRecovery       │
│  (Twitter,       │  (encrypted      │  (guardian-based      │
│   Discord)       │   export)        │   recovery)           │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    MPC Network                               │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ MPC Node │  │ MPC Node │  │ MPC Node │                  │
│  │ (TEE)    │  │ (TEE)    │  │ (TEE)    │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                             │
│  Threshold signing: t-of-n nodes required                   │
└─────────────────────────────────────────────────────────────┘
```

## Security Model

### Permissionless Design

| Feature | How It Works |
|---------|--------------|
| Sessions | Wallet-signed, no shared secret |
| Verification | Signature recovery, anyone can verify |
| Key Management | MPC threshold signing via TEE network |
| Backups | Password-encrypted, user-controlled |

### Production Requirements

| Feature | Requirement |
|---------|-------------|
| Sessions | Use `SessionManager` (wallet-signed) |
| MPC Threshold | > 1 for production |
| PBKDF2 Iterations | ≥ 100,000 for key backups |
| TEE | Real hardware required |

### Development Mode

For local development (`NODE_ENV !== 'production'`):
- Single MPC node (threshold=1) allowed
- Simulated TEE acceptable
- Lower PBKDF2 iterations for tests

## API Reference

### DIDManager

```typescript
// Create identity
const { did, document, walletAddress } = await didManager.createIdentity(authMethod);

// Resolve DID
const document = await didManager.resolve(did);

// Link account
await didManager.linkAccount(did, authMethod);

// Find by account
const did = await didManager.findByAccount({ type: 'wallet', address: '0x...' });
```

### SessionManager (Permissionless)

```typescript
import { createSessionMessage, SessionManager } from '@babylon/auth/server';

const sessionManager = new SessionManager({ expiresIn: 86400 });

// Create message for wallet to sign
const { message, claims } = createSessionMessage(did, walletAddress);

// After user signs with wallet
const token = sessionManager.createToken(claims, signature);

// Verify - no secret needed
const claims = await sessionManager.verifyToken(token);

// Check expiration
const expired = sessionManager.isExpired(token);

// Decode without verification
const decoded = sessionManager.decodeToken(token);
```

### MPCClient

```typescript
// Initialize client
const client = new MPCClient({
  endpoints: ['http://localhost:4010'],
  threshold: 1,
});
await client.initialize();

// Generate key
const { publicKey, walletAddress } = await client.generateKey(did, authProof);

// Sign message
const { signature } = await client.sign(did, messageHash, 'message');

// Get network status
const status = await client.getNetworkStatus();
```

## Testing

```bash
# Run all tests
bun test

# Run with live MPC node
# First: cd apps/compute && bun run mpc:dev
bun test src/__tests__/mpc-live.integration.test.ts

# Run E2E flow
bun test src/__tests__/e2e-auth-flow.integration.test.ts
```

## License

MIT
