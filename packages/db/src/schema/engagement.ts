/**
 * Engagement Schema
 *
 * @description Database schema for daily engagement tracking (airdrop qualification)
 * and programmatic buyback records.
 *
 * Daily Engagement:
 * - Tracks user actions for airdrop drip qualification
 * - Social track: 2 of 3 (like, comment, post)
 * - Trading track: 1 trade of any kind
 * - UTC daily reset with 4-hour grace period
 *
 * Buyback Records:
 * - Tracks programmatic buybacks from trading fees
 * - 30% BBLN (held in treasury), 20% ELIZA (to foundation), 50% treasury (ETH)
 */

import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// =============================================================================
// DAILY ENGAGEMENT TRACKING
// =============================================================================

/**
 * Daily Engagement
 *
 * Tracks user engagement actions for airdrop drip qualification.
 * Each user gets one record per UTC day.
 *
 * Qualification requirements:
 * - Social track: 2 of 3 actions (like, comment, non-spam post)
 * - Trading track: Any trade (prediction or perp)
 *
 * Grace period: 4 hours after UTC midnight
 * (actions from last 20 hours count toward "today")
 */
export const dailyEngagement = pgTable(
  'DailyEngagement',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    /** UTC date (YYYY-MM-DD format as string for easy lookup) */
    dateKey: text('dateKey').notNull(),

    // Social track actions
    /** Whether user liked a post today */
    hasLiked: boolean('hasLiked').notNull().default(false),
    /** Post ID that was liked (for audit) */
    likedPostId: text('likedPostId'),
    /** Timestamp of like action */
    likedAt: timestamp('likedAt', { mode: 'date' }),

    /** Whether user commented on a post today */
    hasCommented: boolean('hasCommented').notNull().default(false),
    /** Post ID that was commented on */
    commentedPostId: text('commentedPostId'),
    /** Comment ID created */
    commentId: text('commentId'),
    /** Timestamp of comment action */
    commentedAt: timestamp('commentedAt', { mode: 'date' }),

    /** Whether user created a qualifying post today */
    hasPosted: boolean('hasPosted').notNull().default(false),
    /** Post ID created */
    postedId: text('postedId'),
    /** Timestamp of post action */
    postedAt: timestamp('postedAt', { mode: 'date' }),

    /** Count of social actions completed (0-3) */
    socialActionsCount: integer('socialActionsCount').notNull().default(0),
    /** Whether social track is complete (2+ actions) */
    socialTrackComplete: boolean('socialTrackComplete')
      .notNull()
      .default(false),

    // Trading track actions
    /** Whether user made a trade today */
    hasTraded: boolean('hasTraded').notNull().default(false),
    /** Trade ID (for audit) */
    tradeId: text('tradeId'),
    /** Trade type: 'prediction' | 'perp' */
    tradeType: text('tradeType'),
    /** Timestamp of trade action */
    tradedAt: timestamp('tradedAt', { mode: 'date' }),
    /** Trading track is complete (1 trade) */
    tradingTrackComplete: boolean('tradingTrackComplete')
      .notNull()
      .default(false),

    // Qualification status
    /** Whether user qualifies for drip (either track complete) */
    qualifiedForDrip: boolean('qualifiedForDrip').notNull().default(false),
    /** When qualification was achieved */
    qualifiedAt: timestamp('qualifiedAt', { mode: 'date' }),

    // Drip claim status
    /** Whether drip was claimed for this day */
    dripClaimed: boolean('dripClaimed').notNull().default(false),
    /** Amount of BBLN unlocked in drip (wei as string) */
    dripAmount: text('dripAmount'),
    /** Timestamp of drip claim */
    dripClaimedAt: timestamp('dripClaimedAt', { mode: 'date' }),

    /** Created timestamp */
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    /** Updated timestamp */
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    // Each user can only have one engagement record per day
    unique('DailyEngagement_userId_dateKey_key').on(
      table.userId,
      table.dateKey
    ),
    index('DailyEngagement_userId_idx').on(table.userId),
    index('DailyEngagement_dateKey_idx').on(table.dateKey),
    index('DailyEngagement_qualifiedForDrip_idx').on(table.qualifiedForDrip),
    index('DailyEngagement_dripClaimed_idx').on(table.dripClaimed),
    index('DailyEngagement_userId_qualifiedAt_idx').on(
      table.userId,
      table.qualifiedAt
    ),
  ]
);

// =============================================================================
// BUYBACK RECORDS
// =============================================================================

/**
 * Fee Accumulator
 *
 * Tracks accumulated trading fees waiting to be distributed via buyback.
 * When threshold is reached, triggers buyback execution.
 */
export const feeAccumulator = pgTable('FeeAccumulator', {
  id: text('id').primaryKey().default('singleton'),
  /** Accumulated fees in ETH (wei as string) */
  accumulatedFees: text('accumulatedFees').notNull().default('0'),
  /** Threshold to trigger buyback (wei as string) */
  buybackThreshold: text('buybackThreshold')
    .notNull()
    .default('1000000000000000000'), // 1 ETH default
  /** Last time fees were accumulated */
  lastAccumulatedAt: timestamp('lastAccumulatedAt', { mode: 'date' }),
  /** Last time buyback was executed */
  lastBuybackAt: timestamp('lastBuybackAt', { mode: 'date' }),
  /** Total fees ever accumulated (for stats) */
  totalFeesAccumulated: text('totalFeesAccumulated').notNull().default('0'),
  /** Total buybacks executed count */
  totalBuybacksExecuted: integer('totalBuybacksExecuted').notNull().default(0),
  /** Updated timestamp */
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
});

/**
 * Buyback Records
 *
 * Records each buyback execution for audit and analytics.
 * Distribution: 30% BBLN, 20% ELIZA, 50% Treasury
 */
export const buybackRecords = pgTable(
  'BuybackRecord',
  {
    id: text('id').primaryKey(),

    // Input
    /** Total ETH used for this buyback (wei) */
    totalEthInput: text('totalEthInput').notNull(),

    // BBLN Buyback (30%)
    /** ETH allocated for BBLN buyback (wei) */
    bblnEthAmount: text('bblnEthAmount').notNull(),
    /** BBLN tokens received from swap (wei) */
    bblnReceived: text('bblnReceived'),
    /** BBLN swap transaction hash */
    bblnSwapTxHash: text('bblnSwapTxHash'),
    /** BBLN swap status */
    bblnSwapStatus: text('bblnSwapStatus').notNull().default('pending'),

    // ELIZA Buyback (20%)
    /** ETH allocated for ELIZA buyback (wei) */
    elizaEthAmount: text('elizaEthAmount').notNull(),
    /** ELIZA tokens received from swap (wei) */
    elizaReceived: text('elizaReceived'),
    /** ELIZA swap transaction hash */
    elizaSwapTxHash: text('elizaSwapTxHash'),
    /** Address ELIZA was sent to (foundation) */
    elizaRecipient: text('elizaRecipient'),
    /** ELIZA swap status */
    elizaSwapStatus: text('elizaSwapStatus').notNull().default('pending'),

    // Treasury (50%)
    /** ETH sent to treasury (wei) */
    treasuryEthAmount: text('treasuryEthAmount').notNull(),
    /** Treasury transfer transaction hash */
    treasuryTxHash: text('treasuryTxHash'),
    /** Treasury transfer status */
    treasuryStatus: text('treasuryStatus').notNull().default('pending'),

    // Overall status
    /** Overall buyback status: pending | executing | completed | failed */
    status: text('status').notNull().default('pending'),
    /** Error message if failed */
    errorMessage: text('errorMessage'),

    // Swap details
    /** DEX used for swaps */
    dexUsed: text('dexUsed').notNull().default('jeju-dex'),
    /** BBLN swap price (ETH per BBLN) */
    bblnSwapPrice: text('bblnSwapPrice'),
    /** ELIZA swap price (ETH per ELIZA) */
    elizaSwapPrice: text('elizaSwapPrice'),
    /** Slippage tolerance used (basis points) */
    slippageBps: integer('slippageBps').notNull().default(100),

    // Timestamps
    /** When buyback was initiated */
    initiatedAt: timestamp('initiatedAt', { mode: 'date' })
      .notNull()
      .defaultNow(),
    /** When buyback completed */
    completedAt: timestamp('completedAt', { mode: 'date' }),
    /** Created timestamp */
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('BuybackRecord_status_idx').on(table.status),
    index('BuybackRecord_initiatedAt_idx').on(table.initiatedAt),
    index('BuybackRecord_completedAt_idx').on(table.completedAt),
  ]
);

/**
 * Fee Contribution
 *
 * Records individual fee contributions to the accumulator.
 * Links trades to buyback pool.
 */
export const feeContributions = pgTable(
  'FeeContribution',
  {
    id: text('id').primaryKey(),
    /** Trading fee record ID */
    tradingFeeId: text('tradingFeeId').notNull(),
    /** User who paid the fee */
    userId: text('userId').notNull(),
    /** Fee amount in ETH (wei) */
    feeAmount: text('feeAmount').notNull(),
    /** Trade type */
    tradeType: text('tradeType').notNull(),
    /** Market ID */
    marketId: text('marketId'),
    /** Whether this has been included in a buyback */
    includedInBuyback: boolean('includedInBuyback').notNull().default(false),
    /** Buyback record ID if included */
    buybackRecordId: text('buybackRecordId'),
    /** Created timestamp */
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('FeeContribution_tradingFeeId_idx').on(table.tradingFeeId),
    index('FeeContribution_userId_idx').on(table.userId),
    index('FeeContribution_includedInBuyback_idx').on(table.includedInBuyback),
    index('FeeContribution_createdAt_idx').on(table.createdAt),
  ]
);

// =============================================================================
// RELATIONS
// =============================================================================

export const dailyEngagementRelations = relations(
  dailyEngagement,
  ({ one }) => ({
    user: one(users, {
      fields: [dailyEngagement.userId],
      references: [users.id],
    }),
  })
);

export const feeContributionsRelations = relations(
  feeContributions,
  ({ one }) => ({
    user: one(users, {
      fields: [feeContributions.userId],
      references: [users.id],
    }),
    buyback: one(buybackRecords, {
      fields: [feeContributions.buybackRecordId],
      references: [buybackRecords.id],
    }),
  })
);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type DailyEngagement = typeof dailyEngagement.$inferSelect;
export type NewDailyEngagement = typeof dailyEngagement.$inferInsert;

export type FeeAccumulator = typeof feeAccumulator.$inferSelect;
export type NewFeeAccumulator = typeof feeAccumulator.$inferInsert;

export type BuybackRecord = typeof buybackRecords.$inferSelect;
export type NewBuybackRecord = typeof buybackRecords.$inferInsert;

export type FeeContribution = typeof feeContributions.$inferSelect;
export type NewFeeContribution = typeof feeContributions.$inferInsert;
