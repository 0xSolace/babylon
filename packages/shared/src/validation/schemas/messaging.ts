/**
 * E2E Messaging validation schemas
 *
 * Schemas for decentralized end-to-end encrypted messaging between users.
 */

import { z } from 'zod';
import { WalletAddressSchema } from './common';

// ============================================================================
// Encryption Key Schemas
// ============================================================================

/**
 * Public key schema - 32-byte hex string (64 hex chars)
 */
export const MessagingPublicKeySchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid public key format');

/**
 * Register encryption keys schema for decentralized messaging
 */
export const RegisterKeysSchema = z.object({
  publicKey: MessagingPublicKeySchema,
  signedPreKey: MessagingPublicKeySchema.optional(),
  signature: z.string().optional(), // For on-chain registration verification
});
export type RegisterKeys = z.infer<typeof RegisterKeysSchema>;

/**
 * User messaging key response schema
 */
export const UserMessagingKeySchema = z.object({
  userId: z.string(),
  publicKey: MessagingPublicKeySchema,
  signedPreKey: MessagingPublicKeySchema.optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserMessagingKey = z.infer<typeof UserMessagingKeySchema>;

// ============================================================================
// Message Schemas
// ============================================================================

/**
 * Send encrypted message schema
 */
export const SendMessageSchema = z.object({
  to: z.string().min(1, 'Recipient address required'),
  encryptedContent: z.string().min(1, 'Encrypted content required'),
  timestamp: z.number().optional(),
});
export type SendMessage = z.infer<typeof SendMessageSchema>;

/**
 * Relay message schema - message from the relay network
 */
export const RelayMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  encryptedContent: z.string(),
  timestamp: z.number(),
  cid: z.string(), // IPFS/content ID
  receivedAt: z.number(),
});
export type RelayMessage = z.infer<typeof RelayMessageSchema>;

/**
 * Inbox query parameters schema
 */
export const InboxQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  since: z.coerce.number().optional(), // Timestamp to fetch messages since
  before: z.coerce.number().optional(), // Timestamp to fetch messages before
});
export type InboxQuery = z.infer<typeof InboxQuerySchema>;

/**
 * Inbox response schema
 */
export const InboxResponseSchema = z.object({
  messages: z.array(RelayMessageSchema),
  hasMore: z.boolean(),
});
export type InboxResponse = z.infer<typeof InboxResponseSchema>;

// ============================================================================
// Key Lookup Schemas
// ============================================================================

/**
 * Get public key by address params schema
 */
export const GetPublicKeyParamsSchema = z.object({
  address: WalletAddressSchema,
});
export type GetPublicKeyParams = z.infer<typeof GetPublicKeyParamsSchema>;

/**
 * Public key response schema
 */
export const PublicKeyResponseSchema = z.object({
  address: WalletAddressSchema,
  publicKey: MessagingPublicKeySchema,
  signedPreKey: MessagingPublicKeySchema.optional(),
});
export type PublicKeyResponse = z.infer<typeof PublicKeyResponseSchema>;

// ============================================================================
// Conversation Schemas
// ============================================================================

/**
 * Conversation participant schema
 */
export const ConversationParticipantSchema = z.object({
  userId: z.string(),
  walletAddress: WalletAddressSchema,
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  publicKey: MessagingPublicKeySchema.optional(),
});
export type ConversationParticipant = z.infer<
  typeof ConversationParticipantSchema
>;

/**
 * Conversation schema
 */
export const ConversationSchema = z.object({
  id: z.string(),
  participants: z.array(ConversationParticipantSchema),
  lastMessageAt: z.string().datetime().nullable(),
  unreadCount: z.number(),
});
export type Conversation = z.infer<typeof ConversationSchema>;
