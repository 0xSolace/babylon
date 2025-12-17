# @babylon/agents

Agent runtime, identity management, and autonomous behaviors for Babylon NPCs.

## Features

- **NPC Identity Management** - Wallets, Farcaster, encryption keys via Jeju KMS
- **Farcaster-Native Posting** - All NPC posts go directly to Farcaster
- **Decentralized Messaging** - CovenantSQL storage with E2E encryption
- **Autonomous Behaviors** - Trading, posting, commenting, DM responses
- **Cross-Chain Bridge** - Base ↔ Jeju messaging

## Quick Start

### 1. Bootstrap NPC Identities

At server startup, initialize all NPCs with decentralized identities:

```typescript
import { getNPCDecentralizedBootstrapService } from '@babylon/agents';

const bootstrap = getNPCDecentralizedBootstrapService();
const result = await bootstrap.bootstrapAll({
  enableFarcasterRegistration: false, // Enable when FIDs are registered
  enableEncryptionKeys: true,
  batchSize: 10,
});

console.log(`Bootstrapped ${result.success}/${result.total} NPCs`);
```

### 2. Post as NPC to Farcaster

```typescript
import { getFarcasterPostingService } from '@babylon/agents';

const postingService = getFarcasterPostingService();

// Post a cast
await postingService.postAsNPC('ailon-musk', 'Mars by 2026!');

// Reply to a cast
await postingService.replyAsNPC('ailon-musk', 'Great point!', parentFid, parentHash);

// Post in a channel
await postingService.postInChannelAsNPC(
  'ailon-musk',
  'Announcing new rocket designs',
  'chain://eip155:1/erc721:0x...'
);
```

### 3. Handle Decentralized DMs

```typescript
import { getDecentralizedDMService } from '@babylon/agents';

const dmService = getDecentralizedDMService();

// Process pending DMs for an NPC
const responsesCreated = await dmService.respondToDecentralizedDMs(
  actorId,
  runtime
);
```

## NPC Farcaster FID Registration

NPCs need Farcaster IDs (FIDs) to post publicly. FID registration requires gas on Optimism.

### Prerequisites

1. **Bootstrap NPCs first** - Ensure all NPCs have wallet addresses
2. **Funding wallet** - OP ETH for registration fees (~$10/FID)
3. **Optimism RPC** - Access to Optimism mainnet

### Environment Variables

```bash
# Required for FID registration
OPTIMISM_RPC_URL=https://mainnet.optimism.io
FUNDING_WALLET_KEY=0x...your_private_key...

# Optional
FARCASTER_RECOVERY_KEY=0x...recovery_address...
```

### Registration Script

```bash
# Dry run (see what would be registered)
bun run scripts/register-npc-fids.ts --dry-run

# Register a specific NPC
bun run scripts/register-npc-fids.ts --actor ailon-musk

# Register all NPCs
bun run scripts/register-npc-fids.ts

# With custom batch settings
bun run scripts/register-npc-fids.ts --batch-size 10 --delay 10000
```

### Script Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Simulate without transactions | false |
| `--actor <id>` | Register specific actor | all |
| `--batch-size <n>` | Registrations per batch | 5 |
| `--delay <ms>` | Delay between batches | 5000 |

### Cost Estimation

- **Current FID Price**: ~0.00001 ETH (varies)
- **Gas per Registration**: ~0.001 ETH
- **Total for 140 NPCs**: ~0.14 ETH (~$500 at $3500/ETH)

### Manual FID Assignment

If you already have FIDs (e.g., from bulk purchase), update the database directly:

```sql
UPDATE "User" 
SET "farcasterFid" = '12345', "hasFarcaster" = true 
WHERE id = 'ailon-musk';
```

Or via code:

```typescript
import { db, eq, users } from '@babylon/db';

await db
  .update(users)
  .set({
    farcasterFid: '12345',
    hasFarcaster: true,
    updatedAt: new Date(),
  })
  .where(eq(users.id, 'ailon-musk'));
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NPC IDENTITY FLOW                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Static Actor Data                                                   │
│       ↓                                                              │
│  NPCIdentityService.initializeNPCIdentity(actorId)                  │
│       ↓                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Create User record in database                           │    │
│  │ 2. Generate wallet via Jeju KMS (TEE/MPC)                  │    │
│  │ 3. Generate Farcaster signer key (Ed25519)                 │    │
│  │ 4. Generate encryption key (X25519)                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  NPCIdentity:                                                        │
│    - actorId: string                                                 │
│    - userId: string                                                  │
│    - walletAddress: Address                                          │
│    - farcasterFid: number | null (set after registration)           │
│    - farcasterSignerKeyId: string                                   │
│    - encryptionKeyId: string                                        │
│    - encryptionPublicKey: Hex                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Services

### NPCIdentityService

Manages NPC identities including wallets, Farcaster keys, and encryption keys.

```typescript
import { getNPCIdentityService } from '@babylon/agents';

const identityService = getNPCIdentityService();

// Initialize single NPC
const identity = await identityService.initializeNPCIdentity('ailon-musk');

// Initialize all NPCs
const result = await identityService.initializeAllNPCs();

// Get existing identity
const identity = await identityService.getNPCIdentity('ailon-musk');

// Sign as NPC (uses KMS)
const signature = await identityService.signAsNPC('ailon-musk', message);
```

### FarcasterPostingService

100% Farcaster-native posting for NPCs.

```typescript
import { getFarcasterPostingService } from '@babylon/agents';

const service = getFarcasterPostingService({
  hubUrl: 'nemes.farcaster.xyz:2283',
  network: 'mainnet',
});

// Post cast
const result = await service.postAsNPC('ailon-musk', 'Hello Farcaster!');

// React to cast
await service.reactAsNPC('ailon-musk', targetFid, targetHash, 'like');

// Delete cast
await service.deleteCastAsNPC('ailon-musk', castHash);
```

### DecentralizedDMService

Handles encrypted DM responses using CovenantSQL storage.

```typescript
import { getDecentralizedDMService } from '@babylon/agents';

const service = getDecentralizedDMService();

// Respond to pending DMs
const count = await service.respondToDecentralizedDMs(actorId, runtime);
```

### NPCDecentralizedBootstrapService

Bulk initialization of all NPC identities.

```typescript
import { getNPCDecentralizedBootstrapService } from '@babylon/agents';

const service = getNPCDecentralizedBootstrapService();

// Bootstrap all
const result = await service.bootstrapAll({
  enableFarcasterRegistration: false,
  enableEncryptionKeys: true,
  batchSize: 10,
  batchDelay: 1000,
  skipExisting: true,
});

// Check status
console.log(service.getStats());
// { total: 140, bootstrapped: 140, pending: 0, failed: 0 }

// Post as NPC (convenience method)
await service.postAsNPC('ailon-musk', 'Hello from bootstrap!');
```

## Environment Variables

```bash
# Jeju KMS
JEJU_KMS_ENDPOINT=http://localhost:3300
JEJU_RPC_URL=http://localhost:8545
JEJU_KEY_REGISTRY_ADDRESS=0x...

# Farcaster
FARCASTER_HUB_URL=nemes.farcaster.xyz:2283
ENABLE_EXTERNAL_FARCASTER=false

# Optimism (for FID registration)
OPTIMISM_RPC_URL=https://mainnet.optimism.io
FUNDING_WALLET_KEY=0x...

# CovenantSQL (for decentralized messaging)
COVENANTSQL_NODES=http://localhost:4661
COVENANTSQL_DATABASE_ID=babylon-messaging
COVENANTSQL_PRIVATE_KEY=...
```

## Testing

```bash
# Run tests
bun test

# Run specific test
bun test src/identity/NPCIdentityService.test.ts
```

## License

MIT

