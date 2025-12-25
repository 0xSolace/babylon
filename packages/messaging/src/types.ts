import { JejuError as BabylonError } from '@jejunetwork/shared'
import type { Address, Hex } from 'viem'

/**
 * Configuration for decentralized messaging client
 */
export interface MessagingConfig {
  /** Jeju L2 RPC URL */
  rpcUrl: string
  /** User's wallet address */
  address: Address
  /** KeyRegistry contract address */
  keyRegistryAddress?: Address
  /** MessageNodeRegistry contract address */
  nodeRegistryAddress?: Address
  /** Direct relay URL (bypasses node discovery) */
  relayUrl?: string
  /** Farcaster Hub URL for public data sync */
  farcasterHubUrl?: string
}

/**
 * Encryption key pair for E2EE messaging
 */
export interface EncryptionKeys {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

/** Type alias for backwards compatibility */
export type EncryptionKeyPair = EncryptionKeys

/**
 * Encrypted message envelope
 */
export interface MessageEnvelope {
  id: string
  from: Address
  to: Address
  ciphertext: Uint8Array
  nonce: Uint8Array
  ephemeralPublicKey: Uint8Array
  timestamp: number
  signature?: Hex
  ipfsCid?: string
}

/**
 * Decrypted message content
 */
export interface DecryptedMessage {
  id: string
  from: Address
  to: Address
  content: string
  timestamp: Date
  isDecentralized: true
}

/**
 * Centralized message (from existing Babylon DB)
 */
export interface CentralizedMessage {
  id: string
  chatId: string
  senderId: string
  content: string
  createdAt: Date
  isDecentralized: false
}

/**
 * Union type for messages during migration
 */
export type AnyMessage = DecryptedMessage | CentralizedMessage

/**
 * Relay node info
 */
export interface RelayNode {
  nodeId: Hex
  operator: Address
  endpoint: string
  region: string
  isHealthy: boolean
}

/**
 * Conversation thread metadata
 */
export interface Conversation {
  id: string
  participant: Address
  lastMessage?: DecryptedMessage
  unreadCount: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Farcaster user profile
 */
export interface FarcasterProfile {
  fid: number
  username: string
  displayName: string
  bio: string
  pfpUrl: string
  followerCount: number
  followingCount: number
  verifiedAddresses: Address[]
}

/**
 * Farcaster cast (public post)
 */
export interface FarcasterCast {
  hash: string
  fid: number
  text: string
  timestamp: Date
  embeds: string[]
  mentions: number[]
  parentCastHash?: string
  parentUrl?: string
  reactions: {
    likes: number
    recasts: number
  }
}

/**
 * Message event types for real-time updates
 */
export type MessageEvent =
  | { type: 'message:new'; data: DecryptedMessage }
  | { type: 'message:delivered'; data: { messageId: string } }
  | { type: 'message:read'; data: { messageId: string; by: Address } }
  | { type: 'connection:status'; data: { connected: boolean } }
  | { type: 'keys:registered'; data: { address: Address } }

/**
 * Migration status for a DM conversation
 */
export interface MigrationStatus {
  chatId: string
  participant1: string
  participant2: string
  totalMessages: number
  migratedMessages: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  error?: string
  startedAt?: Date
  completedAt?: Date
}

/**
 * Error codes for messaging operations
 */
export const ErrorCodes = {
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  NO_KEY_BUNDLE: 'NO_KEY_BUNDLE',
  RECIPIENT_KEY_NOT_FOUND: 'RECIPIENT_KEY_NOT_FOUND',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  RELAY_UNAVAILABLE: 'RELAY_UNAVAILABLE',
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  FARCASTER_UNAVAILABLE: 'FARCASTER_UNAVAILABLE',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

/**
 * Custom error for messaging operations
 */
export class MessagingError extends BabylonError {
  constructor(message: string, code: ErrorCode) {
    super(message, code, 500, true)
  }
}
