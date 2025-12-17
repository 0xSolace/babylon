/**
 * Babylon Decentralized Messaging
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

// ABIs
export { KEY_REGISTRY_ABI, NODE_REGISTRY_ABI } from './abis';
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
} from './bridge/base-bridge';
// Core client
export { createMessagingClient, DecentralizedMessagingClient } from './client';
// Crypto utilities
export {
  bytes32ToPublicKey,
  bytesToHex,
  decryptMessage,
  decryptMessageToString,
  deriveKeyPair,
  deserializeEncryptedMessage,
  encryptMessage,
  generateKeyPair,
  hexToBytes,
  publicKeyToBytes32,
  publicKeyToHex,
  serializeEncryptedMessage,
} from './crypto';
// Messaging Service (primary entry point)
export {
  type Conversation as MessagingConversation,
  type GetMessagesRequest,
  getMessaging,
  type Message as MessagingMessage,
  MessagingService,
  resetMessaging,
  type SendMessageRequest,
} from './messaging';
// Messaging Bridge (Centralized/Decentralized Hybrid)
export {
  getMessagingBridge,
  MessagingBridge,
  type MessagingMode,
  resetMessagingBridge,
} from './messaging-bridge';
// Migration
export { createMigrationService, MigrationService } from './migration';
// Decentralized Storage (CovenantSQL)
export {
  type ConsistencyLevel,
  type CQLConfig,
  createDecentralizedStorage,
  DecentralizedMessageStorage,
  getDecentralizedStorage,
  resetDecentralizedStorage,
  type StoredConversation,
  type StoredKeyBundle,
  type StoredMessage,
} from './storage';
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
} from './types';
export { ErrorCodes, MessagingError } from './types';
