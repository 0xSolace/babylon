/**
 * Babylon Messaging
 *
 * Thin wrapper around @jejunetwork/messaging with Babylon-specific configuration.
 * Provides unified messaging that works with both wallet addresses and Farcaster FIDs.
 *
 * For core messaging utilities (crypto, ABIs), import directly from @jejunetwork/messaging:
 * - encryptMessage, decryptMessage, generateKeyPair
 * - KEY_REGISTRY_ABI, MESSAGE_NODE_REGISTRY_ABI
 * - publicKeyToHex, hexToPublicKey, etc.
 *
 * @example
 * ```typescript
 * import { getMessagingBridge, MessagingBridge } from '@babylon/messaging';
 * import { generateKeyPair, encryptMessage } from '@jejunetwork/messaging';
 *
 * const bridge = getMessagingBridge();
 * await bridge.initialize();
 *
 * // Use Jeju crypto directly
 * const keys = generateKeyPair();
 * const encrypted = encryptMessage(message, recipientPublicKey);
 * ```
 */

// Babylon-specific wrappers - Base bridge for cross-chain messaging
export {
  BaseBridgeClient,
  type BaseBridgeConfig,
  createBaseBridgeClient,
  getBaseBridgeClient,
  resetBaseBridgeClient,
} from './bridge/base-bridge'
// Babylon-specific messaging client with additional convenience methods
export { createMessagingClient, MessagingClient } from './client'
// Export types from messaging.ts - these are the types used by MessagingBridge
export type {
  Conversation,
  Conversation as MessagingConversation,
  GetMessagesRequest,
  Message,
  Message as MessagingMessage,
  SendMessageRequest,
} from './messaging'
// Babylon-specific messaging bridge (for backward compatibility)
export {
  getMessagingBridge,
  MessagingBridge,
  type MessagingMode,
  resetMessagingBridge,
} from './messaging-bridge'
// Migration utilities
export { createMigrationService, MigrationService } from './migration'
// Babylon-specific types from types.ts
export type {
  AnyMessage,
  CentralizedMessage,
  Conversation as BasicConversation, // Renamed to avoid conflict with messaging.ts Conversation
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
