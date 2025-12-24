/**
 * Babylon Messaging
 *
 * End-to-end encrypted messaging using Jeju L2
 * with Farcaster integration for public social data.
 *
 * @example
 * ```typescript
 * import { createMessagingClient } from '@babylon/messaging';
 *
 * const client = createMessagingClient({
 *   rpcUrl: 'https://rpc.jeju.network',
 *   address: userAddress,
 *   relayUrl: 'https://relay.jeju.network',
 *   keyRegistryAddress: '0x...',
 * });
 *
 * // Initialize with wallet signature
 * const signature = await wallet.signMessage(client.getKeyDerivationMessage());
 * await client.initialize(signature);
 *
 * // Send encrypted message
 * await client.sendMessage(recipientAddress, 'Hello, private world!');
 * ```
 */

// Crypto utilities and ABIs from @jejunetwork/messaging
export {
  bytes32ToPublicKey,
  decryptMessage,
  decryptMessageToString,
  deriveKeyPairFromWallet,
  deserializeEncryptedMessage,
  type EncryptedMessage,
  encryptMessage,
  generateKeyPair,
  generateKeyPairFromSeed,
  hexToPublicKey,
  KEY_DERIVATION_MESSAGE,
  KEY_REGISTRY_ABI,
  type KeyPair,
  MESSAGE_NODE_REGISTRY_ABI,
  publicKeyToBytes32,
  publicKeyToHex,
  type SerializedEncryptedMessage,
  serializeEncryptedMessage,
} from '@jejunetwork/messaging'

// Cross-Chain Bridge (Base, Optimism)
export {
  BaseBridgeClient,
  type BaseBridgeConfig,
  type CrossChainKeyRegistration,
  type CrossChainMessage,
  createBaseBridgeClient,
  getBaseBridgeClient,
  MessagingChain,
  resetBaseBridgeClient,
} from './bridge/base-bridge'
// Core client
export { createMessagingClient, MessagingClient } from './client'
// Messaging Service (primary entry point)
export {
  type Conversation as MessagingConversation,
  type GetMessagesRequest,
  getMessaging,
  type Message as MessagingMessage,
  MessagingService,
  resetMessaging,
  type SendMessageRequest,
} from './messaging'
// Messaging Bridge (Centralized/Decentralized Hybrid)
export {
  getMessagingBridge,
  MessagingBridge,
  type MessagingMode,
  resetMessagingBridge,
} from './messaging-bridge'
// Migration
export { createMigrationService, MigrationService } from './migration'
// Storage (CovenantSQL)
export {
  type ConsistencyLevel,
  type CQLConfig,
  createStorage,
  getStorage,
  MessageStorage,
  resetStorage,
  type StoredConversation,
  type StoredKeyBundle,
  type StoredMessage,
} from './storage'
// Types
export type {
  AnyMessage,
  CentralizedMessage,
  Conversation,
  DecryptedMessage,
  EncryptionKeyPair,
  EncryptionKeys,
  ErrorCode,
  FarcasterCast,
  FarcasterProfile,
  MessageEnvelope,
  MessageEvent,
  MessagingConfig,
  MigrationStatus,
  RelayNode,
} from './types'
export { ErrorCodes, MessagingError } from './types'
