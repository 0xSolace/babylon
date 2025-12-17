/**
 * Messaging Service
 *
 * Routes all messaging (DMs, group chats) through decentralized storage.
 * Uses CovenantSQL for storage and Jeju KMS for encryption.
 *
 * This service is the single entry point for ALL messaging in Babylon.
 */

import { type CQLClient, getCQL } from '@jeju/db';
import { randomBytes } from 'crypto';
import { type Address } from 'viem';
import {
  encryptMessage,
  hexToBytes,
  serializeEncryptedMessage,
} from './crypto';

export interface Message {
  id: string;
  conversationId: string;
  sender: Address;
  recipient: Address | null; // null for group messages
  content: string;
  encryptedContent?: string;
  timestamp: number;
  messageType: 'dm' | 'group' | 'channel';
  deliveryStatus: 'pending' | 'delivered' | 'read';
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  type: 'dm' | 'group' | 'channel';
  participants: Address[];
  name?: string;
  createdAt: number;
  lastMessageAt: number;
  lastMessagePreview?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageRequest {
  conversationId: string;
  senderAddress: Address;
  recipientAddress?: Address;
  content: string;
  messageType: 'dm' | 'group' | 'channel';
  encrypt?: boolean;
  metadata?: Record<string, unknown>;
}

export interface GetMessagesRequest {
  conversationId: string;
  limit?: number;
  before?: number;
  after?: number;
}

export class MessagingService {
  private cql: CQLClient | null = null;
  private initialized = false;
  private kmsEndpoint: string;
  private useEncryption: boolean;

  constructor(options?: { kmsEndpoint?: string; useEncryption?: boolean }) {
    this.kmsEndpoint =
      options?.kmsEndpoint ??
      process.env.KMS_ENDPOINT ??
      'http://localhost:3300';
    this.useEncryption =
      options?.useEncryption ?? process.env.USE_MESSAGE_ENCRYPTION === 'true';
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.cql = getCQL({
      blockProducerEndpoint:
        process.env.CQL_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:4300',
      databaseId: process.env.CQL_DATABASE_ID ?? 'babylon-messaging',
      privateKey: process.env.CQL_PRIVATE_KEY as `0x${string}` | undefined,
    });

    const healthy = await this.cql.isHealthy();
    if (!healthy) {
      throw new Error(
        '[Messaging] CovenantSQL is not healthy - decentralized messaging requires CQL. Run `jeju dev` to start all services.'
      );
    }

    await this.createTables();
    console.log('[Messaging] Connected to CovenantSQL');
    this.initialized = true;
  }

  private async createTables(): Promise<void> {
    if (!this.cql) throw new Error('CQL not initialized');

    const tables = [
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        recipient TEXT,
        content TEXT NOT NULL,
        encrypted_content TEXT,
        ephemeral_public_key TEXT,
        nonce TEXT,
        timestamp INTEGER NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'dm',
        delivery_status TEXT NOT NULL DEFAULT 'pending',
        metadata TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'dm',
        name TEXT,
        participants TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_message_at INTEGER NOT NULL,
        last_message_preview TEXT,
        metadata TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS user_keys (
        address TEXT PRIMARY KEY,
        encryption_public_key TEXT NOT NULL,
        signing_public_key TEXT NOT NULL,
        kms_key_id TEXT NOT NULL,
        registered_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, timestamp DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages (recipient, delivery_status)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender, timestamp DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_participant ON conversations (participants)`,
    ];

    for (const sql of tables) {
      await this.cql.exec(sql);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize();
  }

  /**
   * Send a message to a conversation (DM, group, or channel)
   */
  async sendMessage(request: SendMessageRequest): Promise<Message> {
    await this.ensureInitialized();

    const messageId = `msg-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const timestamp = Date.now();

    let content = request.content;
    let encryptedContent: string | undefined;
    let ephemeralPublicKey: string | undefined;
    let nonce: string | undefined;

    // Encrypt message if requested
    if (
      this.useEncryption &&
      request.encrypt !== false &&
      request.recipientAddress
    ) {
      const encrypted = await this.encryptMessage(
        content,
        request.recipientAddress
      );
      encryptedContent = encrypted.ciphertext;
      ephemeralPublicKey = encrypted.ephemeralPublicKey;
      nonce = encrypted.nonce;
      content = '[encrypted]'; // Store placeholder for unencrypted view
    }

    if (!this.cql) throw new Error('CQL not initialized');

    await this.cql.exec(
      `INSERT INTO messages (id, conversation_id, sender, recipient, content, encrypted_content, ephemeral_public_key, nonce, timestamp, message_type, delivery_status, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        messageId,
        request.conversationId,
        request.senderAddress,
        request.recipientAddress ?? null,
        content,
        encryptedContent ?? null,
        ephemeralPublicKey ?? null,
        nonce ?? null,
        timestamp,
        request.messageType,
        'pending',
        request.metadata ? JSON.stringify(request.metadata) : null,
      ]
    );

    // Update conversation
    await this.cql.exec(
      `UPDATE conversations SET last_message_at = $1, last_message_preview = $2 WHERE id = $3`,
      [timestamp, request.content.slice(0, 50), request.conversationId]
    );

    return {
      id: messageId,
      conversationId: request.conversationId,
      sender: request.senderAddress,
      recipient: request.recipientAddress ?? null,
      content: request.content,
      encryptedContent,
      timestamp,
      messageType: request.messageType,
      deliveryStatus: 'pending',
      metadata: request.metadata,
    };
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(request: GetMessagesRequest): Promise<Message[]> {
    await this.ensureInitialized();
    if (!this.cql) throw new Error('CQL not initialized');

    const limit = request.limit ?? 50;

    let sql: string;
    let params: (string | number)[];

    if (request.before) {
      sql = `SELECT * FROM messages WHERE conversation_id = $1 AND timestamp < $2 ORDER BY timestamp DESC LIMIT $3`;
      params = [request.conversationId, request.before, limit];
    } else if (request.after) {
      sql = `SELECT * FROM messages WHERE conversation_id = $1 AND timestamp > $2 ORDER BY timestamp ASC LIMIT $3`;
      params = [request.conversationId, request.after, limit];
    } else {
      sql = `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp DESC LIMIT $2`;
      params = [request.conversationId, limit];
    }

    const result = await this.cql.query<Record<string, unknown>>(sql, params);
    return result.rows.map(this.mapMessageRow);
  }

  /**
   * Get pending messages for a user (undelivered)
   */
  async getPendingMessages(address: Address, limit = 100): Promise<Message[]> {
    await this.ensureInitialized();
    if (!this.cql) throw new Error('CQL not initialized');

    const result = await this.cql.query<Record<string, unknown>>(
      `SELECT * FROM messages WHERE recipient = $1 AND delivery_status = 'pending' ORDER BY timestamp ASC LIMIT $2`,
      [address, limit]
    );
    return result.rows.map(this.mapMessageRow);
  }

  /**
   * Mark message as delivered or read
   */
  async updateDeliveryStatus(
    messageId: string,
    status: 'delivered' | 'read'
  ): Promise<void> {
    await this.ensureInitialized();
    if (!this.cql) throw new Error('CQL not initialized');

    await this.cql.exec(
      `UPDATE messages SET delivery_status = $1 WHERE id = $2`,
      [status, messageId]
    );
  }

  /**
   * Create or get a DM conversation between two users
   */
  async getOrCreateDMConversation(
    user1: Address,
    user2: Address
  ): Promise<Conversation> {
    await this.ensureInitialized();
    if (!this.cql) throw new Error('CQL not initialized');

    // Deterministic conversation ID
    const sortedAddresses = [user1.toLowerCase(), user2.toLowerCase()].sort();
    const conversationId = `dm-${sortedAddresses[0]}-${sortedAddresses[1]}`;

    // Check if exists
    const existing = await this.cql.query<Record<string, unknown>>(
      `SELECT * FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (existing.rows.length > 0) {
      return this.mapConversationRow(existing.rows[0]!);
    }

    // Create new
    const now = Date.now();
    await this.cql.exec(
      `INSERT INTO conversations (id, type, participants, created_at, last_message_at) VALUES ($1, $2, $3, $4, $5)`,
      [conversationId, 'dm', JSON.stringify(sortedAddresses), now, now]
    );

    return {
      id: conversationId,
      type: 'dm',
      participants: sortedAddresses as Address[],
      createdAt: now,
      lastMessageAt: now,
    };
  }

  /**
   * Create a group conversation
   */
  async createGroupConversation(
    creator: Address,
    participants: Address[],
    name?: string,
    metadata?: Record<string, unknown>
  ): Promise<Conversation> {
    await this.ensureInitialized();
    if (!this.cql) throw new Error('CQL not initialized');

    const conversationId = `group-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const allParticipants = [
      creator,
      ...participants.filter((p) => p !== creator),
    ];
    const now = Date.now();

    await this.cql.exec(
      `INSERT INTO conversations (id, type, name, participants, created_at, last_message_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        conversationId,
        'group',
        name ?? null,
        JSON.stringify(allParticipants),
        now,
        now,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    return {
      id: conversationId,
      type: 'group',
      name,
      participants: allParticipants as Address[],
      createdAt: now,
      lastMessageAt: now,
      metadata,
    };
  }

  /**
   * Get conversations for a user
   */
  async getUserConversations(
    address: Address,
    limit = 50
  ): Promise<Conversation[]> {
    await this.ensureInitialized();
    if (!this.cql) throw new Error('CQL not initialized');

    const result = await this.cql.query<Record<string, unknown>>(
      `SELECT * FROM conversations WHERE participants LIKE $1 ORDER BY last_message_at DESC LIMIT $2`,
      [`%${address.toLowerCase()}%`, limit]
    );
    return result.rows.map(this.mapConversationRow);
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    await this.ensureInitialized();
    if (!this.cql) throw new Error('CQL not initialized');

    const result = await this.cql.query<Record<string, unknown>>(
      `SELECT * FROM conversations WHERE id = $1`,
      [conversationId]
    );
    return result.rows.length > 0
      ? this.mapConversationRow(result.rows[0]!)
      : null;
  }

  /**
   * Encrypt a message for a recipient using their public key
   */
  private async encryptMessage(
    content: string,
    recipientAddress: Address
  ): Promise<{
    ciphertext: string;
    ephemeralPublicKey: string;
    nonce: string;
  }> {
    // Get recipient's encryption key from KMS
    const keyBundle = await this.getOrCreateUserKeys(recipientAddress);

    if (!keyBundle || !keyBundle.encryptionPublicKey) {
      // If recipient doesn't have keys, store unencrypted with marker
      return {
        ciphertext: Buffer.from(content).toString('base64'),
        ephemeralPublicKey: '',
        nonce: '',
      };
    }

    // Parse recipient's public key
    const recipientPublicKey = hexToBytes(keyBundle.encryptionPublicKey);

    // Encrypt using X25519 + AES-256-GCM
    // Note: encryptMessage expects sender keys but we use ephemeral key internally
    const encrypted = encryptMessage(content, recipientPublicKey, {
      publicKey: new Uint8Array(32),
      privateKey: new Uint8Array(32),
    });
    const serialized = JSON.parse(serializeEncryptedMessage(encrypted)) as {
      ciphertext: string;
      nonce: string;
      ephemeralPublicKey: string;
    };

    return {
      ciphertext: serialized.ciphertext,
      ephemeralPublicKey: serialized.ephemeralPublicKey,
      nonce: serialized.nonce,
    };
  }

  /**
   * Get or create encryption keys for a user
   */
  private async getOrCreateUserKeys(
    address: Address
  ): Promise<{ encryptionPublicKey: string; signingPublicKey: string } | null> {
    if (!this.cql) return null;

    const result = await this.cql.query<Record<string, unknown>>(
      `SELECT * FROM user_keys WHERE address = $1`,
      [address]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0]!;
      return {
        encryptionPublicKey: row.encryption_public_key as string,
        signingPublicKey: row.signing_public_key as string,
      };
    }

    // Generate new keys via KMS
    try {
      const response = await fetch(`${this.kmsEndpoint}/keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'encryption',
          curve: 'x25519',
          owner: address,
        }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as {
        publicKey: string;
        metadata: { id: string };
      };

      await this.cql.exec(
        `INSERT INTO user_keys (address, encryption_public_key, signing_public_key, kms_key_id, registered_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          address,
          data.publicKey,
          data.publicKey,
          data.metadata.id,
          Date.now(),
          Date.now(),
        ]
      );

      return {
        encryptionPublicKey: data.publicKey,
        signingPublicKey: data.publicKey,
      };
    } catch {
      return null;
    }
  }

  private mapMessageRow(row: Record<string, unknown>): Message {
    return {
      id: row.id as string,
      conversationId: row.conversation_id as string,
      sender: row.sender as Address,
      recipient: row.recipient as Address | null,
      content: row.content as string,
      encryptedContent: row.encrypted_content as string | undefined,
      timestamp: row.timestamp as number,
      messageType: row.message_type as 'dm' | 'group' | 'channel',
      deliveryStatus: row.delivery_status as 'pending' | 'delivered' | 'read',
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    };
  }

  private mapConversationRow(row: Record<string, unknown>): Conversation {
    return {
      id: row.id as string,
      type: row.type as 'dm' | 'group' | 'channel',
      name: row.name as string | undefined,
      participants: JSON.parse(row.participants as string) as Address[],
      createdAt: row.created_at as number,
      lastMessageAt: row.last_message_at as number,
      lastMessagePreview: row.last_message_preview as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    };
  }
}

// Singleton instance
let messagingServiceInstance: MessagingService | null = null;

export function getMessaging(): MessagingService {
  if (!messagingServiceInstance) {
    messagingServiceInstance = new MessagingService();
  }
  return messagingServiceInstance;
}

export function resetMessaging(): void {
  messagingServiceInstance = null;
}
