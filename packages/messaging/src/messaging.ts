/**
 * Messaging Service
 *
 * Routes all messaging (DMs, group chats) through decentralized storage.
 * Uses CovenantSQL for storage and Jeju KMS for encryption.
 *
 * This service is the single entry point for ALL messaging in Babylon.
 */

import { logger } from '@babylon/shared'
import {
  encryptMessage,
  hexToPublicKey,
  serializeEncryptedMessage,
} from '@jejunetwork/messaging'
import type { Address } from 'viem'
import { z } from 'zod'
import { type CQLConfig, createStorage, type MessageStorage } from './storage'

/** Browser-friendly random bytes using WebCrypto API */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Validation schemas for messaging service
const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/)

const SendMessageRequestSchema = z.object({
  conversationId: z.string().min(1),
  senderAddress: AddressSchema,
  recipientAddress: AddressSchema.optional(),
  content: z.string().min(1).max(10000),
  messageType: z.enum(['dm', 'group', 'channel']),
  encrypt: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const KmsKeyResponseSchema = z.object({
  publicKey: z.string(),
  metadata: z.object({
    id: z.string(),
  }),
})

const MetadataSchema = z.record(z.string(), z.unknown())
const ParticipantsSchema = z.array(z.string())

// Database row schemas for type-safe mapping
const KeyRowSchema = z.object({
  encryption_public_key: z.string(),
  signing_public_key: z.string(),
})

const MessageRowSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  sender: z.string(),
  recipient: z.string().nullable(),
  content: z.string(),
  encrypted_content: z.string().nullable().optional(),
  timestamp: z.number(),
  message_type: z.enum(['dm', 'group', 'channel']),
  delivery_status: z.enum(['pending', 'delivered', 'read']),
  metadata: z.string().nullable().optional(),
  participants: z.string().nullable().optional(),
})

const ConversationRowSchema = z.object({
  id: z.string(),
  type: z.enum(['dm', 'group', 'channel']),
  name: z.string().nullable().optional(),
  created_at: z.number(),
  last_message_at: z.number(),
  last_message_preview: z.string().nullable().optional(),
  participants: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
})

export interface Message {
  id: string
  conversationId: string
  sender: Address
  recipient: Address | null // null for group messages
  content: string
  encryptedContent?: string
  timestamp: number
  messageType: 'dm' | 'group' | 'channel'
  deliveryStatus: 'pending' | 'delivered' | 'read'
  metadata?: Record<string, unknown>
}

export interface Conversation {
  id: string
  type: 'dm' | 'group' | 'channel'
  participants: Address[]
  name?: string
  createdAt: number
  lastMessageAt: number
  lastMessagePreview?: string
  metadata?: Record<string, unknown>
}

export interface SendMessageRequest {
  conversationId: string
  senderAddress: Address
  recipientAddress?: Address
  content: string
  messageType: 'dm' | 'group' | 'channel'
  encrypt?: boolean
  metadata?: Record<string, unknown>
}

export interface GetMessagesRequest {
  conversationId: string
  limit?: number
  before?: number
  after?: number
}

export class MessagingService {
  private storage: MessageStorage
  private initialized = false
  private kmsEndpoint: string
  private useEncryption: boolean

  constructor(options?: {
    kmsEndpoint?: string
    useEncryption?: boolean
    storageConfig?: CQLConfig
  }) {
    this.kmsEndpoint =
      options?.kmsEndpoint ??
      process.env.KMS_ENDPOINT ??
      'http://localhost:3300'
    this.useEncryption =
      options?.useEncryption ?? process.env.USE_MESSAGE_ENCRYPTION === 'true'
    this.storage = createStorage(options?.storageConfig)
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    await this.storage.initialize()
    logger.info('Connected to CovenantSQL', undefined, 'Messaging')
    this.initialized = true
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize()
  }

  /**
   * Send a message to a conversation (DM, group, or channel)
   */
  async sendMessage(request: SendMessageRequest): Promise<Message> {
    // Validate request at boundary
    const validated = SendMessageRequestSchema.parse(request)
    await this.ensureInitialized()

    const messageId = `msg-${Date.now()}-${randomHex(4)}`
    const timestamp = Date.now()

    // Use validated fields - schemas already ensure correct format
    const conversationId = validated.conversationId
    const senderAddress: Address = validated.senderAddress as Address
    const recipientAddress: Address | undefined = validated.recipientAddress
      ? (validated.recipientAddress as Address)
      : undefined
    const messageType = validated.messageType
    const metadata = validated.metadata

    let content = validated.content
    let encryptedContent: string | undefined
    let ephemeralPublicKey: string | undefined
    let nonce: string | undefined

    // Encrypt message if requested
    if (this.useEncryption && validated.encrypt !== false && recipientAddress) {
      const encrypted = await this.encryptMessage(content, recipientAddress)
      encryptedContent = encrypted.ciphertext
      ephemeralPublicKey = encrypted.ephemeralPublicKey
      nonce = encrypted.nonce
      content = '[encrypted]' // Store placeholder for unencrypted view
    }

    if (!this.storage) throw new Error('CQL not initialized')

    await this.storage.exec(
      `INSERT INTO messages (id, conversation_id, sender, recipient, content, encrypted_content, ephemeral_public_key, nonce, timestamp, message_type, delivery_status, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        messageId,
        conversationId,
        senderAddress,
        recipientAddress ?? null,
        content,
        encryptedContent ?? null,
        ephemeralPublicKey ?? null,
        nonce ?? null,
        timestamp,
        messageType,
        'pending',
        metadata ? JSON.stringify(metadata) : null,
      ],
    )

    // Update conversation
    await this.storage.exec(
      `UPDATE conversations SET last_message_at = $1, last_message_preview = $2 WHERE id = $3`,
      [timestamp, validated.content.slice(0, 50), conversationId],
    )

    return {
      id: messageId,
      conversationId,
      sender: senderAddress,
      recipient: recipientAddress ?? null,
      content: validated.content,
      encryptedContent,
      timestamp,
      messageType,
      deliveryStatus: 'pending',
      metadata,
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(request: GetMessagesRequest): Promise<Message[]> {
    await this.ensureInitialized()
    if (!this.storage) throw new Error('CQL not initialized')

    const limit = request.limit ?? 50

    let sql: string
    let params: (string | number)[]

    if (request.before) {
      sql = `SELECT * FROM messages WHERE conversation_id = $1 AND timestamp < $2 ORDER BY timestamp DESC LIMIT $3`
      params = [request.conversationId, request.before, limit]
    } else if (request.after) {
      sql = `SELECT * FROM messages WHERE conversation_id = $1 AND timestamp > $2 ORDER BY timestamp ASC LIMIT $3`
      params = [request.conversationId, request.after, limit]
    } else {
      sql = `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp DESC LIMIT $2`
      params = [request.conversationId, limit]
    }

    const result = await this.storage.query<Record<string, unknown>>(
      sql,
      params,
    )
    return result.rows.map(this.mapMessageRow)
  }

  /**
   * Get pending messages for a user (undelivered)
   */
  async getPendingMessages(address: Address, limit = 100): Promise<Message[]> {
    await this.ensureInitialized()
    if (!this.storage) throw new Error('CQL not initialized')

    const result = await this.storage.query<Record<string, unknown>>(
      `SELECT * FROM messages WHERE recipient = $1 AND delivery_status = 'pending' ORDER BY timestamp ASC LIMIT $2`,
      [address, limit],
    )
    return result.rows.map(this.mapMessageRow)
  }

  /**
   * Mark message as delivered or read
   */
  async updateDeliveryStatus(
    messageId: string,
    status: 'delivered' | 'read',
  ): Promise<void> {
    await this.ensureInitialized()
    if (!this.storage) throw new Error('CQL not initialized')

    await this.storage.exec(
      `UPDATE messages SET delivery_status = $1 WHERE id = $2`,
      [status, messageId],
    )
  }

  /**
   * Create or get a DM conversation between two users
   */
  async getOrCreateDMConversation(
    user1: Address,
    user2: Address,
  ): Promise<Conversation> {
    await this.ensureInitialized()
    if (!this.storage) throw new Error('CQL not initialized')

    // Deterministic conversation ID
    const sortedAddresses = [user1.toLowerCase(), user2.toLowerCase()].sort()
    const conversationId = `dm-${sortedAddresses[0]}-${sortedAddresses[1]}`

    // Check if exists
    const existing = await this.storage.query<Record<string, unknown>>(
      `SELECT * FROM conversations WHERE id = $1`,
      [conversationId],
    )

    const existingRow = existing.rows[0]
    if (existingRow) {
      return this.mapConversationRow(existingRow)
    }

    // Create new
    const now = Date.now()
    await this.storage.exec(
      `INSERT INTO conversations (id, type, participants, created_at, last_message_at) VALUES ($1, $2, $3, $4, $5)`,
      [conversationId, 'dm', JSON.stringify(sortedAddresses), now, now],
    )

    return {
      id: conversationId,
      type: 'dm',
      participants: sortedAddresses as Address[],
      createdAt: now,
      lastMessageAt: now,
    }
  }

  /**
   * Create a group conversation
   */
  async createGroupConversation(
    creator: Address,
    participants: Address[],
    name?: string,
    metadata?: Record<string, unknown>,
  ): Promise<Conversation> {
    await this.ensureInitialized()
    if (!this.storage) throw new Error('CQL not initialized')

    const conversationId = `group-${Date.now()}-${randomHex(4)}`
    const allParticipants = [
      creator,
      ...participants.filter((p) => p !== creator),
    ]
    const now = Date.now()

    await this.storage.exec(
      `INSERT INTO conversations (id, type, name, participants, created_at, last_message_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        conversationId,
        'group',
        name ?? null,
        JSON.stringify(allParticipants),
        now,
        now,
        metadata ? JSON.stringify(metadata) : null,
      ],
    )

    return {
      id: conversationId,
      type: 'group',
      name,
      participants: allParticipants as Address[],
      createdAt: now,
      lastMessageAt: now,
      metadata,
    }
  }

  /**
   * Get conversations for a user
   */
  async getUserConversations(
    address: Address,
    limit = 50,
  ): Promise<Conversation[]> {
    await this.ensureInitialized()
    if (!this.storage) throw new Error('CQL not initialized')

    const result = await this.storage.query<Record<string, unknown>>(
      `SELECT * FROM conversations WHERE participants LIKE $1 ORDER BY last_message_at DESC LIMIT $2`,
      [`%${address.toLowerCase()}%`, limit],
    )
    return result.rows.map(this.mapConversationRow)
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    await this.ensureInitialized()
    if (!this.storage) throw new Error('CQL not initialized')

    const result = await this.storage.query<Record<string, unknown>>(
      `SELECT * FROM conversations WHERE id = $1`,
      [conversationId],
    )
    const row = result.rows[0]
    return row ? this.mapConversationRow(row) : null
  }

  /**
   * Encrypt a message for a recipient using their public key
   */
  private async encryptMessage(
    content: string,
    recipientAddress: Address,
  ): Promise<{
    ciphertext: string
    ephemeralPublicKey: string
    nonce: string
  }> {
    // Get recipient's encryption key from KMS
    const keyBundle = await this.getOrCreateUserKeys(recipientAddress)

    if (!keyBundle || !keyBundle.encryptionPublicKey) {
      // If recipient doesn't have keys, store unencrypted with marker
      return {
        ciphertext: Buffer.from(content).toString('base64'),
        ephemeralPublicKey: '',
        nonce: '',
      }
    }

    // Parse recipient's public key
    const recipientPublicKey = hexToPublicKey(keyBundle.encryptionPublicKey)

    // Encrypt using X25519 + AES-256-GCM
    // encryptMessage generates ephemeral keys internally for forward secrecy
    const encrypted = encryptMessage(content, recipientPublicKey)
    const serialized = serializeEncryptedMessage(encrypted)

    return {
      ciphertext: serialized.ciphertext,
      ephemeralPublicKey: serialized.ephemeralPublicKey,
      nonce: serialized.nonce,
    }
  }

  /**
   * Get or create encryption keys for a user
   */
  private async getOrCreateUserKeys(
    address: Address,
  ): Promise<{ encryptionPublicKey: string; signingPublicKey: string } | null> {
    if (!this.storage) return null

    const result = await this.storage.query<Record<string, unknown>>(
      `SELECT * FROM user_keys WHERE address = $1`,
      [address],
    )

    const row = result.rows[0]
    if (row) {
      const parsed = KeyRowSchema.parse(row)
      return {
        encryptionPublicKey: parsed.encryption_public_key,
        signingPublicKey: parsed.signing_public_key,
      }
    }

    // Generate new keys via KMS
    const response = await fetch(`${this.kmsEndpoint}/keys/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'encryption',
        curve: 'x25519',
        owner: address,
      }),
    })

    if (!response.ok) return null

    const parseResult = KmsKeyResponseSchema.safeParse(await response.json())
    if (!parseResult.success) {
      logger.error(
        'Invalid KMS response',
        { error: parseResult.error },
        'Messaging',
      )
      return null
    }
    const data = parseResult.data

    await this.storage.exec(
      `INSERT INTO user_keys (address, encryption_public_key, signing_public_key, kms_key_id, registered_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        address,
        data.publicKey,
        data.publicKey,
        data.metadata.id,
        Date.now(),
        Date.now(),
      ],
    )

    return {
      encryptionPublicKey: data.publicKey,
      signingPublicKey: data.publicKey,
    }
  }

  private mapMessageRow(row: Record<string, unknown>): Message {
    const parsed = MessageRowSchema.parse(row)
    let metadata: Record<string, unknown> | undefined
    if (parsed.metadata) {
      const parseResult = MetadataSchema.safeParse(JSON.parse(parsed.metadata))
      metadata = parseResult.success ? parseResult.data : undefined
    }

    return {
      id: parsed.id,
      conversationId: parsed.conversation_id,
      sender: parsed.sender as Address,
      recipient: parsed.recipient as Address | null,
      content: parsed.content,
      encryptedContent: parsed.encrypted_content ?? undefined,
      timestamp: parsed.timestamp,
      messageType: parsed.message_type,
      deliveryStatus: parsed.delivery_status,
      metadata,
    }
  }

  private mapConversationRow(row: Record<string, unknown>): Conversation {
    const parsed = ConversationRowSchema.parse(row)
    const participantsResult = ParticipantsSchema.safeParse(
      parsed.participants ? JSON.parse(parsed.participants) : [],
    )
    if (!participantsResult.success) {
      throw new Error(
        `Invalid participants data: ${participantsResult.error.message}`,
      )
    }

    let metadata: Record<string, unknown> | undefined
    if (parsed.metadata) {
      const parseResult = MetadataSchema.safeParse(JSON.parse(parsed.metadata))
      metadata = parseResult.success ? parseResult.data : undefined
    }

    return {
      id: parsed.id,
      type: parsed.type,
      name: parsed.name ?? undefined,
      participants: participantsResult.data as Address[],
      createdAt: parsed.created_at,
      lastMessageAt: parsed.last_message_at,
      lastMessagePreview: parsed.last_message_preview ?? undefined,
      metadata,
    }
  }
}

// Singleton instance
let messagingServiceInstance: MessagingService | null = null

export function getMessaging(): MessagingService {
  if (!messagingServiceInstance) {
    messagingServiceInstance = new MessagingService()
  }
  return messagingServiceInstance
}
