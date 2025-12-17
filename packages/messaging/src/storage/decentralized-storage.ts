/**
 * Decentralized Message Storage using @jeju/db
 */

import {
  type CQLClient,
  type CQLConfig,
  getCQL,
  type QueryParam,
} from '@jeju/db';

// Re-export CQL types
export type { CQLConfig };

import type { Address } from 'viem';

export type ConsistencyLevel = 'strong' | 'eventual';

export interface StoredMessage {
  id: string;
  conversationId: string;
  sender: Address;
  recipient: Address;
  encryptedContent: string;
  contentCid?: string;
  ephemeralPublicKey: string;
  nonce: string;
  timestamp: number;
  chainId: number;
  messageType: 'dm' | 'group' | 'channel';
  deliveryStatus: 'pending' | 'delivered' | 'read';
  signature?: string;
}

export interface StoredConversation {
  id: string;
  type: 'dm' | 'group' | 'channel';
  participants: Address[];
  createdAt: number;
  lastMessageAt: number;
  lastMessagePreview?: string;
  unreadCount: number;
  metadata?: Record<string, unknown>;
}

export interface StoredKeyBundle {
  address: Address;
  identityKey: string;
  signedPreKey: string;
  preKeySignature: string;
  oneTimePreKeys: string[];
  registeredAt: number;
  updatedAt: number;
  chainId: number;
}

export class DecentralizedMessageStorage {
  private client: CQLClient | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.client = getCQL({
      blockProducerEndpoint:
        process.env.CQL_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:4300',
      databaseId: process.env.CQL_DATABASE_ID ?? 'babylon-messaging',
      privateKey: process.env.CQL_PRIVATE_KEY as `0x${string}` | undefined,
    });

    const healthy = await this.client.isHealthy();
    if (!healthy) throw new Error('[MessageStorage] CQL not healthy');

    await this.createTables();
    this.initialized = true;
  }

  private async createTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        recipient TEXT NOT NULL,
        encrypted_content TEXT NOT NULL,
        content_cid TEXT,
        ephemeral_public_key TEXT NOT NULL,
        nonce TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        chain_id INTEGER NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'dm',
        delivery_status TEXT NOT NULL DEFAULT 'pending',
        signature TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'dm',
        participants TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_message_at INTEGER NOT NULL,
        last_message_preview TEXT,
        metadata TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS key_bundles (
        address TEXT PRIMARY KEY,
        identity_key TEXT NOT NULL,
        signed_pre_key TEXT NOT NULL,
        pre_key_signature TEXT NOT NULL,
        one_time_pre_keys TEXT NOT NULL,
        registered_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        chain_id INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, timestamp DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages (recipient, delivery_status, timestamp DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_participant ON conversations (participants, last_message_at DESC)`,
    ];

    for (const sql of tables) {
      await this.client!.exec(sql);
    }
  }

  async storeMessage(message: StoredMessage): Promise<void> {
    await this.ensureInitialized();
    await this.client!.exec(
      `INSERT INTO messages (id, conversation_id, sender, recipient, encrypted_content, content_cid, ephemeral_public_key, nonce, timestamp, chain_id, message_type, delivery_status, signature) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        message.id,
        message.conversationId,
        message.sender,
        message.recipient,
        message.encryptedContent,
        message.contentCid ?? null,
        message.ephemeralPublicKey,
        message.nonce,
        message.timestamp,
        message.chainId,
        message.messageType,
        message.deliveryStatus,
        message.signature ?? null,
      ]
    );
  }

  async getConversationMessages(
    conversationId: string,
    options: { limit?: number; before?: number } = {}
  ): Promise<StoredMessage[]> {
    await this.ensureInitialized();
    const limit = options.limit ?? 50;
    const params: QueryParam[] = options.before
      ? [conversationId, options.before, limit]
      : [conversationId, limit];
    const sql = options.before
      ? `SELECT * FROM messages WHERE conversation_id = $1 AND timestamp < $2 ORDER BY timestamp DESC LIMIT $3`
      : `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp DESC LIMIT $2`;
    const result = await this.client!.query<Record<string, unknown>>(
      sql,
      params
    );
    return result.rows.map(this.mapMessageRow);
  }

  async getPendingMessages(
    recipient: Address,
    options: { limit?: number } = {}
  ): Promise<StoredMessage[]> {
    await this.ensureInitialized();
    const result = await this.client!.query<Record<string, unknown>>(
      `SELECT * FROM messages WHERE recipient = $1 AND delivery_status = 'pending' ORDER BY timestamp ASC LIMIT $2`,
      [recipient, options.limit ?? 100]
    );
    return result.rows.map(this.mapMessageRow);
  }

  async updateDeliveryStatus(
    messageId: string,
    status: 'delivered' | 'read'
  ): Promise<void> {
    await this.ensureInitialized();
    await this.client!.exec(
      `UPDATE messages SET delivery_status = $1 WHERE id = $2`,
      [status, messageId]
    );
  }

  async createConversation(
    conversation: Omit<StoredConversation, 'unreadCount'>
  ): Promise<void> {
    await this.ensureInitialized();
    await this.client!.exec(
      `INSERT INTO conversations (id, type, participants, created_at, last_message_at, last_message_preview, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        conversation.id,
        conversation.type,
        JSON.stringify(conversation.participants),
        conversation.createdAt,
        conversation.lastMessageAt,
        conversation.lastMessagePreview ?? null,
        conversation.metadata ? JSON.stringify(conversation.metadata) : null,
      ]
    );
  }

  async getConversation(id: string): Promise<StoredConversation | null> {
    await this.ensureInitialized();
    const result = await this.client!.query<Record<string, unknown>>(
      `SELECT * FROM conversations WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapConversationRow(result.rows[0]) : null;
  }

  async getUserConversations(
    address: Address,
    options: { limit?: number } = {}
  ): Promise<StoredConversation[]> {
    await this.ensureInitialized();
    const result = await this.client!.query<Record<string, unknown>>(
      `SELECT * FROM conversations WHERE participants LIKE $1 ORDER BY last_message_at DESC LIMIT $2`,
      [`%${address.toLowerCase()}%`, options.limit ?? 50]
    );
    return result.rows.map(this.mapConversationRow);
  }

  async updateConversation(
    id: string,
    update: { lastMessageAt: number; lastMessagePreview?: string }
  ): Promise<void> {
    await this.ensureInitialized();
    await this.client!.exec(
      `UPDATE conversations SET last_message_at = $1, last_message_preview = $2 WHERE id = $3`,
      [update.lastMessageAt, update.lastMessagePreview ?? null, id]
    );
  }

  async storeKeyBundle(bundle: StoredKeyBundle): Promise<void> {
    await this.ensureInitialized();
    await this.client!.exec(
      `INSERT INTO key_bundles (address, identity_key, signed_pre_key, pre_key_signature, one_time_pre_keys, registered_at, updated_at, chain_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (address) DO UPDATE SET identity_key = $2, signed_pre_key = $3, pre_key_signature = $4, one_time_pre_keys = $5, updated_at = $7`,
      [
        bundle.address,
        bundle.identityKey,
        bundle.signedPreKey,
        bundle.preKeySignature,
        JSON.stringify(bundle.oneTimePreKeys),
        bundle.registeredAt,
        bundle.updatedAt,
        bundle.chainId,
      ]
    );
  }

  async getKeyBundle(address: Address): Promise<StoredKeyBundle | null> {
    await this.ensureInitialized();
    const result = await this.client!.query<Record<string, unknown>>(
      `SELECT * FROM key_bundles WHERE address = $1`,
      [address]
    );
    return result.rows[0] ? this.mapKeyBundleRow(result.rows[0]) : null;
  }

  async consumeOneTimePreKey(address: Address): Promise<string | null> {
    await this.ensureInitialized();
    const bundle = await this.getKeyBundle(address);
    if (!bundle || bundle.oneTimePreKeys.length === 0) return null;

    const key = bundle.oneTimePreKeys.shift()!;
    await this.client!.exec(
      `UPDATE key_bundles SET one_time_pre_keys = $1, updated_at = $2 WHERE address = $3`,
      [JSON.stringify(bundle.oneTimePreKeys), Date.now(), address]
    );
    return key;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.ensureInitialized();
    await this.client!.exec(`DELETE FROM messages WHERE id = $1`, [messageId]);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.ensureInitialized();
    await this.client!.exec(`DELETE FROM messages WHERE conversation_id = $1`, [
      conversationId,
    ]);
    await this.client!.exec(`DELETE FROM conversations WHERE id = $1`, [
      conversationId,
    ]);
  }

  async getMessageCount(conversationId: string): Promise<number> {
    await this.ensureInitialized();
    const result = await this.client!.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1`,
      [conversationId]
    );
    return result.rows[0]?.count ?? 0;
  }

  async getUnreadCount(address: Address): Promise<number> {
    await this.ensureInitialized();
    const result = await this.client!.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM messages WHERE recipient = $1 AND delivery_status = 'pending'`,
      [address]
    );
    return result.rows[0]?.count ?? 0;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize();
  }

  private mapMessageRow(row: Record<string, unknown>): StoredMessage {
    return {
      id: row.id as string,
      conversationId: row.conversation_id as string,
      sender: row.sender as Address,
      recipient: row.recipient as Address,
      encryptedContent: row.encrypted_content as string,
      contentCid: row.content_cid as string | undefined,
      ephemeralPublicKey: row.ephemeral_public_key as string,
      nonce: row.nonce as string,
      timestamp: row.timestamp as number,
      chainId: row.chain_id as number,
      messageType: row.message_type as 'dm' | 'group' | 'channel',
      deliveryStatus: row.delivery_status as 'pending' | 'delivered' | 'read',
      signature: row.signature as string | undefined,
    };
  }

  private mapConversationRow(row: Record<string, unknown>): StoredConversation {
    return {
      id: row.id as string,
      type: row.type as 'dm' | 'group' | 'channel',
      participants: JSON.parse(row.participants as string) as Address[],
      createdAt: row.created_at as number,
      lastMessageAt: row.last_message_at as number,
      lastMessagePreview: row.last_message_preview as string | undefined,
      unreadCount: 0,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    };
  }

  private mapKeyBundleRow(row: Record<string, unknown>): StoredKeyBundle {
    return {
      address: row.address as Address,
      identityKey: row.identity_key as string,
      signedPreKey: row.signed_pre_key as string,
      preKeySignature: row.pre_key_signature as string,
      oneTimePreKeys: JSON.parse(row.one_time_pre_keys as string) as string[],
      registeredAt: row.registered_at as number,
      updatedAt: row.updated_at as number,
      chainId: row.chain_id as number,
    };
  }
}

let storage: DecentralizedMessageStorage | null = null;

export function createDecentralizedStorage(): DecentralizedMessageStorage {
  return new DecentralizedMessageStorage();
}

export function getDecentralizedStorage(): DecentralizedMessageStorage {
  if (!storage) storage = new DecentralizedMessageStorage();
  return storage;
}

export function resetDecentralizedStorage(): void {
  storage = null;
}
