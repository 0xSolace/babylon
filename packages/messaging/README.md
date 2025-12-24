# @babylon/messaging

Decentralized messaging for Babylon using Jeju L2 and Farcaster.

## Overview

This package provides end-to-end encrypted messaging with:
- **Farcaster Integration** - Public social graph (profiles, casts, reactions)
- **Decentralized Storage** - CovenantSQL for encrypted messages
- **Cross-Chain Bridge** - Base ↔ Jeju messaging
- **E2E Encryption** - X25519 key exchange, ChaCha20-Poly1305 encryption

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MESSAGING ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PUBLIC CONTENT (Farcaster)                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │ Hub Client  │───→│ Sync Service│───→│  Babylon DB │              │
│  │ (gRPC)      │    │ (polling)   │    │  (cache)    │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                      │
│  PRIVATE MESSAGES (Jeju L2 + CovenantSQL)                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │  Messaging  │───→│ CovenantSQL │───→│ Relay Nodes │              │
│  │  Client     │    │ (encrypted) │    │ (delivery)  │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                      │
│  CROSS-CHAIN (Base ↔ Jeju)                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │ Base Bridge │───→│   Relay     │───→│ Jeju Bridge │              │
│  │  Client     │    │   Nodes     │    │  Contracts  │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
bun add @babylon/messaging
```

## Quick Start

### Decentralized Messaging Client

```typescript
import { createMessagingClient } from '@babylon/messaging';

const client = createMessagingClient({
  rpcUrl: 'https://rpc.jeju.network',
  address: userAddress,
  relayUrl: 'https://relay.jeju.network',
  keyRegistryAddress: '0x...',
});

// Initialize with wallet signature
const signature = await wallet.signMessage(client.getKeyDerivationMessage());
await client.initialize(signature);

// Send encrypted message
await client.sendMessage(recipientAddress, 'Hello, private world!');

// Receive messages
client.onMessage((event) => {
  if (event.type === 'message:new') {
    console.log('New message:', event.data);
  }
});
```

### Farcaster Hub Client

```typescript
import { FarcasterClient } from '@babylon/messaging';

const client = new FarcasterClient({ hubUrl: 'nemes.farcaster.xyz:2283' });

// Get user profile
const profile = await client.getProfile(3);
console.log(profile.username, profile.displayName);

// Get user casts
const { messages: casts } = await client.getCastsByFid(3, { pageSize: 10 });

// Get links (following)
const { messages: following } = await client.getLinksByFid(followerFid);
```

### CovenantSQL Storage

```typescript
import { getDecentralizedStorage } from '@babylon/messaging';

const storage = getDecentralizedStorage();
await storage.initialize();

// Store encrypted message
await storage.storeMessage({
  id: 'msg-123',
  conversationId: 'dm:0x123:0x456',
  sender: '0x123...',
  recipient: '0x456...',
  encryptedContent: '...',
  // ... other fields
});

// Fetch messages
const messages = await storage.getConversationMessages('dm:0x123:0x456');
```

### Cross-Chain Bridge

```typescript
import { getBaseBridgeClient, MessagingChain } from '@babylon/messaging';

const bridge = getBaseBridgeClient();

// Register keys from Base
await bridge.registerKeysFromBase(keys, userAddress, signature);

// Send cross-chain message
await bridge.sendCrossChainMessage(
  sender,
  recipient,
  encryptedContent,
  ephemeralPublicKey,
  nonce,
  MessagingChain.BASE,
  MessagingChain.JEJU
);

// Check message route
const route = await bridge.getMessageRoute(sender, recipient);
```

## Environment Variables

```bash
# Jeju L2
JEJU_RPC_URL=https://rpc.jeju.network
JEJU_KEY_REGISTRY_ADDRESS=0x...

# Farcaster Hub
FARCASTER_HUB_URL=nemes.farcaster.xyz:2283

# CovenantSQL
COVENANTSQL_NODES=http://cql1.jeju.network,http://cql2.jeju.network
COVENANTSQL_DATABASE_ID=babylon-messaging
COVENANTSQL_PRIVATE_KEY=...

# Relay
RELAY_NODE_URL=https://relay.jeju.network

# Cross-Chain (optional)
BASE_RPC_URL=https://mainnet.base.org
JEJU_BRIDGE_ADDRESS=0x...
BASE_BRIDGE_ADDRESS=0x...
```

## React Integration

```typescript
import { useDecentralizedMessaging } from '@babylon/messaging/react';

function ChatComponent() {
  const {
    messages,
    sendMessage,
    isConnected,
    isLoading,
  } = useDecentralizedMessaging({
    recipientAddress,
    walletClient,
  });

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

## Migration from Centralized DMs

```typescript
import { createMigrationService } from '@babylon/messaging';

const migration = createMigrationService({
  dryRun: false,
  batchSize: 100,
});

// Migrate all existing DMs
const result = await migration.migrateAllDMs();
console.log(`Migrated ${result.messagesMigrated} messages`);
```

## Security

### Key Management

- Keys are derived deterministically from wallet signatures
- Private keys never leave the client
- Pre-keys are rotated automatically

### Encryption

- X25519 key exchange
- ChaCha20-Poly1305 authenticated encryption
- Forward secrecy via ephemeral keys

### Storage

- Messages are encrypted before storage
- Only ciphertext stored in CovenantSQL
- Metadata minimized

## Testing

```bash
bun test
```

## License

MIT

