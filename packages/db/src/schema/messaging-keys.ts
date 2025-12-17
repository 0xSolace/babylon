/**
 * User Messaging Keys Schema
 *
 * Stores public encryption keys for decentralized messaging.
 * Keys are X25519 public keys stored as hex strings.
 */

import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// UserMessagingKey table
export const userMessagingKeys = pgTable(
  'UserMessagingKey',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId').notNull().unique(),
    publicKey: text('publicKey').notNull(), // X25519 public key (0x + 64 hex chars)
    signedPreKey: text('signedPreKey').notNull(), // Pre-key for offline messaging
    preKeySignature: text('preKeySignature'), // Signature of pre-key
    isActive: boolean('isActive').notNull().default(true),
    onChainRegistered: boolean('onChainRegistered').notNull().default(false),
    txHash: text('txHash'), // Transaction hash of on-chain registration
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
    revokedAt: timestamp('revokedAt', { mode: 'date' }),
  },
  (table) => [
    index('UserMessagingKey_userId_idx').on(table.userId),
    index('UserMessagingKey_publicKey_idx').on(table.publicKey),
    index('UserMessagingKey_isActive_idx').on(table.isActive),
  ]
);

// One-time pre-keys for forward secrecy
export const messagingPreKeys = pgTable(
  'MessagingPreKey',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId').notNull(),
    preKey: text('preKey').notNull(), // X25519 public key
    isUsed: boolean('isUsed').notNull().default(false),
    usedAt: timestamp('usedAt', { mode: 'date' }),
    usedBy: text('usedBy'), // Address of consumer
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('MessagingPreKey_userId_isUsed_idx').on(table.userId, table.isUsed),
  ]
);

// Message delivery receipts (for tracking)
export const messageReceipts = pgTable(
  'MessageReceipt',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    messageId: text('messageId').notNull(),
    fromAddress: text('fromAddress').notNull(),
    toAddress: text('toAddress').notNull(),
    cid: text('cid'), // IPFS CID
    status: text('status').notNull().default('pending'), // pending, delivered, read
    sentAt: timestamp('sentAt', { mode: 'date' }).notNull().defaultNow(),
    deliveredAt: timestamp('deliveredAt', { mode: 'date' }),
    readAt: timestamp('readAt', { mode: 'date' }),
  },
  (table) => [
    index('MessageReceipt_messageId_idx').on(table.messageId),
    index('MessageReceipt_toAddress_status_idx').on(
      table.toAddress,
      table.status
    ),
    index('MessageReceipt_fromAddress_idx').on(table.fromAddress),
  ]
);

// Relations
export const userMessagingKeysRelations = relations(
  userMessagingKeys,
  ({ many }) => ({
    preKeys: many(messagingPreKeys),
  })
);

export const messagingPreKeysRelations = relations(
  messagingPreKeys,
  ({ one }) => ({
    user: one(userMessagingKeys, {
      fields: [messagingPreKeys.userId],
      references: [userMessagingKeys.userId],
    }),
  })
);

// Type exports
export type UserMessagingKey = typeof userMessagingKeys.$inferSelect;
export type NewUserMessagingKey = typeof userMessagingKeys.$inferInsert;
export type MessagingPreKey = typeof messagingPreKeys.$inferSelect;
export type NewMessagingPreKey = typeof messagingPreKeys.$inferInsert;
export type MessageReceipt = typeof messageReceipts.$inferSelect;
export type NewMessageReceipt = typeof messageReceipts.$inferInsert;
