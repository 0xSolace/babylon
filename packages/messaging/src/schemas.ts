/**
 * Zod schemas for messaging validation
 *
 * Validates all untrusted data at system boundaries:
 * - Incoming WebSocket messages
 * - API responses
 * - Database row parsing
 * - Encrypted message deserialization
 */

import { z } from 'zod';

// Base schemas
export const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const HexStringSchema = z.string().regex(/^(0x)?[a-fA-F0-9]+$/);

// Message envelope for transport
export const MessageEnvelopeSchema = z.object({
  id: z.string().min(1),
  from: AddressSchema,
  to: AddressSchema,
  ciphertext: z.instanceof(Uint8Array),
  nonce: z.instanceof(Uint8Array),
  ephemeralPublicKey: z.instanceof(Uint8Array),
  timestamp: z.number().int().positive(),
  signature: z.string().optional(),
  ipfsCid: z.string().optional(),
});

// Send message request validation
export const SendMessageRequestSchema = z.object({
  conversationId: z.string().min(1),
  senderAddress: AddressSchema,
  recipientAddress: AddressSchema.optional(),
  content: z.string().min(1).max(10000),
  messageType: z.enum(['dm', 'group', 'channel']),
  encrypt: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Encrypted message serialized format (hex strings)
export const EncryptedMessageSchema = z.object({
  ciphertext: z.string().min(1),
  nonce: z.string().min(1),
  ephemeralPublicKey: z.string().min(1),
});

// WebSocket message format
export const WebSocketMessageSchema = z.object({
  type: z.string(),
  message: z
    .object({
      id: z.string(),
      from: z.string(),
      to: z.string(),
      ciphertext: z.string(),
      nonce: z.string(),
      ephemeralPublicKey: z.string(),
      timestamp: z.number(),
    })
    .optional(),
});

// Database row schemas
export const MessageRowSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  sender: z.string(),
  recipient: z.string().nullable(),
  content: z.string(),
  encrypted_content: z.string().nullable().optional(),
  ephemeral_public_key: z.string().nullable().optional(),
  nonce: z.string().nullable().optional(),
  timestamp: z.number(),
  message_type: z.enum(['dm', 'group', 'channel']),
  delivery_status: z.enum(['pending', 'delivered', 'read']),
  metadata: z.string().nullable().optional(),
});

export const ConversationRowSchema = z.object({
  id: z.string(),
  type: z.enum(['dm', 'group', 'channel']),
  name: z.string().nullable().optional(),
  participants: z.string(), // JSON array stored as string
  created_at: z.number(),
  last_message_at: z.number(),
  last_message_preview: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
});

// Parsed metadata schema (generic JSON object)
export const MetadataSchema = z.record(z.string(), z.unknown());

// Participants array schema
export const ParticipantsSchema = z.array(z.string());

// API response schemas
export const RelayMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  ciphertext: z.string(),
  nonce: z.string(),
  ephemeralPublicKey: z.string(),
  timestamp: z.number(),
});

export const RelayMessagesResponseSchema = z.object({
  messages: z.array(RelayMessageSchema),
});

// KMS response schema
export const KmsKeyResponseSchema = z.object({
  publicKey: z.string(),
  metadata: z.object({
    id: z.string(),
  }),
});

// Type exports
export type ValidatedSendMessageRequest = z.infer<
  typeof SendMessageRequestSchema
>;
export type ValidatedEncryptedMessage = z.infer<typeof EncryptedMessageSchema>;
export type ValidatedWebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export type ValidatedMessageRow = z.infer<typeof MessageRowSchema>;
export type ValidatedConversationRow = z.infer<typeof ConversationRowSchema>;
export type ValidatedRelayMessage = z.infer<typeof RelayMessageSchema>;
