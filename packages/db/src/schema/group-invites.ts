import {
  boolean,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const pendingGroupInviteCandidates = pgTable(
  'PendingGroupInviteCandidate',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    npcId: text('npcId').notNull(),
    groupChatId: text('groupChatId'),
    engagementScore: doublePrecision('engagementScore').notNull(),
    triggerType: text('triggerType').notNull(),
    triggerId: text('triggerId'),
    queuedAt: timestamp('queuedAt', { mode: 'date' }).notNull().defaultNow(),
    processed: boolean('processed').notNull().default(false),
    outcome: text('outcome'),
    processedAt: timestamp('processedAt', { mode: 'date' }),
    priorityMultiplier: doublePrecision('priorityMultiplier').notNull().default(1.0),
  },
  (table) => [
    unique('PendingGroupInviteCandidate_userId_npcId_unprocessed').on(table.userId, table.npcId, table.processed),
    index('PendingGroupInviteCandidate_processed_queuedAt_idx').on(table.processed, table.queuedAt),
    index('PendingGroupInviteCandidate_npcId_processed_idx').on(table.npcId, table.processed),
    index('PendingGroupInviteCandidate_userId_processed_idx').on(table.userId, table.processed),
  ]
);

export type PendingGroupInviteCandidate = typeof pendingGroupInviteCandidates.$inferSelect;
export type NewPendingGroupInviteCandidate = typeof pendingGroupInviteCandidates.$inferInsert;
