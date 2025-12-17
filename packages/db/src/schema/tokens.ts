/**
 * Token Schema
 *
 * @description Database schema for BBLN token tracking, airdrop allocations,
 * and token transactions. This tracks the off-chain state that mirrors
 * on-chain token balances and facilitates the airdrop drip mechanism.
 */

import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// =============================================================================
// TOKEN BALANCES (Off-chain tracking for UI/UX)
// =============================================================================

/**
 * Token Balances
 *
 * Tracks user BBLN token balances off-chain for fast queries.
 * On-chain balances are the source of truth; this is for UI convenience.
 */
export const tokenBalances = pgTable(
  'TokenBalance',
  {
    userId: text('userId').primaryKey().notNull(),
    /** Balance in wei (as string for precision) */
    balance: text('balance').notNull().default('0'),
    /** Last time balance was synced from chain */
    lastSyncedAt: timestamp('lastSyncedAt', { mode: 'date' }),
    /** Block number of last sync */
    lastSyncedBlock: text('lastSyncedBlock'),
    /** Wallet address (if different from user primary wallet) */
    walletAddress: text('walletAddress'),
    /** Created timestamp */
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    /** Updated timestamp */
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('TokenBalance_walletAddress_idx').on(table.walletAddress),
    index('TokenBalance_updatedAt_idx').on(table.updatedAt),
  ]
);

// =============================================================================
// TOKEN TRANSACTIONS (Off-chain tracking)
// =============================================================================

/**
 * Token Transactions
 *
 * Records all token movements for audit and analytics.
 * Mirrors on-chain transactions plus internal movements.
 */
export const tokenTransactions = pgTable(
  'TokenTransaction',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    /** Amount in wei (as string, positive for credit, negative for debit) */
    amount: text('amount').notNull(),
    /** Balance before transaction */
    balanceBefore: text('balanceBefore').notNull(),
    /** Balance after transaction */
    balanceAfter: text('balanceAfter').notNull(),
    /** Transaction type */
    type: text('type').notNull(),
    /** Additional metadata as JSON string */
    metadata: text('metadata'),
    /** On-chain transaction hash (if applicable) */
    txHash: text('txHash'),
    /** Chain ID where transaction occurred */
    chainId: integer('chainId'),
    /** Block number */
    blockNumber: text('blockNumber'),
    /** Related entity ID (trade, referral, etc.) */
    relatedId: text('relatedId'),
    /** Created timestamp */
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('TokenTransaction_userId_createdAt_idx').on(
      table.userId,
      table.createdAt
    ),
    index('TokenTransaction_type_idx').on(table.type),
    index('TokenTransaction_txHash_idx').on(table.txHash),
    index('TokenTransaction_createdAt_idx').on(table.createdAt),
  ]
);

// =============================================================================
// AIRDROP ALLOCATIONS
// =============================================================================

/**
 * Airdrop Allocations
 *
 * Tracks each user's airdrop allocation and drip progress.
 * Used to calculate Merkle proofs for on-chain claims.
 */
export const airdropAllocations = pgTable(
  'AirdropAllocation',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull().unique(),
    /** Wallet address for claiming */
    walletAddress: text('walletAddress').notNull(),
    /** Total allocation in wei */
    totalAllocation: text('totalAllocation').notNull(),
    /** Bonus multiplier (100 = 1x, 150 = 1.5x for ELIZA holders) */
    bonusMultiplier: integer('bonusMultiplier').notNull().default(100),
    /** Number of drips unlocked (0-20) */
    dripsUnlocked: integer('dripsUnlocked').notNull().default(0),
    /** Total tokens claimed from airdrop */
    totalClaimed: text('totalClaimed').notNull().default('0'),
    /** Timestamp of last drip unlock */
    lastDripTime: timestamp('lastDripTime', { mode: 'date' }),
    /** Action that triggered last drip */
    lastDripAction: text('lastDripAction'),
    /** Whether user has registered on-chain */
    registeredOnChain: boolean('registeredOnChain').notNull().default(false),
    /** On-chain registration transaction hash */
    registrationTxHash: text('registrationTxHash'),
    /** Points balance at snapshot */
    snapshotPoints: integer('snapshotPoints').notNull().default(0),
    /** Trading volume at snapshot */
    snapshotVolume: text('snapshotVolume'),
    /** Trading P&L at snapshot */
    snapshotPnL: text('snapshotPnL'),
    /** Referral count at snapshot */
    snapshotReferrals: integer('snapshotReferrals'),
    /** Ecosystem score at snapshot */
    snapshotEcosystemScore: integer('snapshotEcosystemScore'),
    /** Whether user is ELIZA token holder */
    isElizaHolder: boolean('isElizaHolder').notNull().default(false),
    /** Merkle proof (cached for gas efficiency) */
    merkleProof: text('merkleProof'),
    /** Launch date for bonus period tracking */
    launchDate: timestamp('launchDate', { mode: 'date' }),
    /** End of 90-day bonus period */
    bonusPeriodEnd: timestamp('bonusPeriodEnd', { mode: 'date' }),
    /** Points earned during bonus period */
    pointsEarnedDuringBonus: integer('pointsEarnedDuringBonus')
      .notNull()
      .default(0),
    /** Bonus allocation from 90-day period (in wei) */
    bonusAllocation: text('bonusAllocation').notNull().default('0'),
    /** Leaderboard position at bonus period end */
    leaderboardPosition: integer('leaderboardPosition'),
    /** Leaderboard multiplier applied (1-10) */
    leaderboardMultiplier: integer('leaderboardMultiplier')
      .notNull()
      .default(1),
    /** Created timestamp */
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    /** Updated timestamp */
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('AirdropAllocation_userId_idx').on(table.userId),
    index('AirdropAllocation_walletAddress_idx').on(table.walletAddress),
    index('AirdropAllocation_dripsUnlocked_idx').on(table.dripsUnlocked),
    index('AirdropAllocation_registeredOnChain_idx').on(
      table.registeredOnChain
    ),
    index('AirdropAllocation_lastDripTime_idx').on(table.lastDripTime),
    index('AirdropAllocation_leaderboardPosition_idx').on(
      table.leaderboardPosition
    ),
  ]
);

// =============================================================================
// AIRDROP CLAIMS (Drip History)
// =============================================================================

/**
 * Airdrop Claims
 *
 * Records each drip claim action for audit and engagement tracking.
 */
export const airdropClaims = pgTable(
  'AirdropClaim',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    /** Which drip day (1-20) */
    dripDay: integer('dripDay').notNull(),
    /** Action that triggered the drip */
    action: text('action').notNull(),
    /** Amount unlocked in this drip */
    amount: text('amount').notNull(),
    /** Whether tokens have been claimed on-chain */
    claimedOnChain: boolean('claimedOnChain').notNull().default(false),
    /** On-chain claim transaction hash */
    claimTxHash: text('claimTxHash'),
    /** Timestamp when action was recorded */
    claimedAt: timestamp('claimedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('AirdropClaim_userId_dripDay_idx').on(table.userId, table.dripDay),
    index('AirdropClaim_userId_claimedAt_idx').on(
      table.userId,
      table.claimedAt
    ),
    index('AirdropClaim_action_idx').on(table.action),
  ]
);

// =============================================================================
// ELIZA HOLDER ALLOCATIONS
// =============================================================================

/**
 * elizaOS Holder Allocations
 *
 * Tracks allocations for ELIZA token holders.
 * 10% of BBLN supply allocated to ELIZA holders.
 * Same vesting as regular users: 10% initial + 2% daily.
 * 180-day claim period, unclaimed tokens return to Eliza Foundation.
 */
export const elizaHolderAllocations = pgTable(
  'ElizaHolderAllocation',
  {
    id: text('id').primaryKey(),
    /** Wallet address */
    walletAddress: text('walletAddress').notNull(),
    /** ELIZA balance at snapshot (across all chains) in wei */
    elizaBalanceSnapshot: text('elizaBalanceSnapshot').notNull(),
    /** Chain breakdown of ELIZA balance (JSON) */
    chainBalances: text('chainBalances'),
    /** Snapshot block number for primary chain (Ethereum) */
    snapshotBlock: text('snapshotBlock'),
    /** Snapshot timestamp */
    snapshotTime: timestamp('snapshotTime', { mode: 'date' }),
    /** Total BBLN allocation in wei */
    bblnAllocation: text('bblnAllocation').notNull(),
    /** Number of drips unlocked (0-46) */
    dripsUnlocked: integer('dripsUnlocked').notNull().default(0),
    /** Total amount claimed so far */
    totalClaimed: text('totalClaimed').notNull().default('0'),
    /** Last drip action timestamp */
    lastDripTime: timestamp('lastDripTime', { mode: 'date' }),
    /** Last drip action type */
    lastDripAction: text('lastDripAction'),
    /** Whether fully claimed */
    fullyClaimed: boolean('fullyClaimed').notNull().default(false),
    /** Whether on-chain registration complete */
    registeredOnChain: boolean('registeredOnChain').notNull().default(false),
    /** On-chain claim transaction hash */
    claimTxHash: text('claimTxHash'),
    /** Claim deadline (180 days from snapshot) */
    claimDeadline: timestamp('claimDeadline', { mode: 'date' }),
    /** Whether claim period has expired */
    expired: boolean('expired').notNull().default(false),
    /** Created timestamp */
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    /** Updated timestamp */
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('ElizaHolderAllocation_walletAddress_idx').on(table.walletAddress),
    index('ElizaHolderAllocation_dripsUnlocked_idx').on(table.dripsUnlocked),
    index('ElizaHolderAllocation_claimDeadline_idx').on(table.claimDeadline),
    index('ElizaHolderAllocation_expired_idx').on(table.expired),
  ]
);

/**
 * elizaOS Holder Claims
 *
 * Records individual drip claims for ELIZA holders.
 */
export const elizaHolderClaims = pgTable(
  'ElizaHolderClaim',
  {
    id: text('id').primaryKey(),
    /** Wallet address */
    walletAddress: text('walletAddress').notNull(),
    /** Which drip day (1-46) */
    dripDay: integer('dripDay').notNull(),
    /** Action that triggered the drip */
    action: text('action').notNull(),
    /** Amount unlocked in this drip */
    amount: text('amount').notNull(),
    /** Whether this was the initial 10% claim */
    isInitialClaim: boolean('isInitialClaim').notNull().default(false),
    /** Whether tokens have been claimed on-chain */
    claimedOnChain: boolean('claimedOnChain').notNull().default(false),
    /** On-chain claim transaction hash */
    claimTxHash: text('claimTxHash'),
    /** Timestamp when action was recorded */
    claimedAt: timestamp('claimedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('ElizaHolderClaim_walletAddress_dripDay_idx').on(
      table.walletAddress,
      table.dripDay
    ),
    index('ElizaHolderClaim_walletAddress_claimedAt_idx').on(
      table.walletAddress,
      table.claimedAt
    ),
    index('ElizaHolderClaim_action_idx').on(table.action),
  ]
);

// =============================================================================
// VESTING SCHEDULES (Off-chain tracking)
// =============================================================================

/**
 * Vesting Schedules
 *
 * Tracks vesting allocations for team, treasury, etc.
 * Mirrors on-chain vesting contracts for UI display.
 */
export const vestingSchedules = pgTable(
  'VestingSchedule',
  {
    id: text('id').primaryKey(),
    /** Beneficiary wallet address */
    beneficiary: text('beneficiary').notNull(),
    /** User ID if this is a team member */
    userId: text('userId'),
    /** Category: team, treasury, advisor, etc. */
    category: text('category').notNull(),
    /** Total allocation in wei */
    totalAllocation: text('totalAllocation').notNull(),
    /** Amount released so far */
    releasedAmount: text('releasedAmount').notNull().default('0'),
    /** TGE (Token Generation Event) start time */
    startTime: timestamp('startTime', { mode: 'date' }),
    /** Cliff duration in seconds */
    cliffDuration: integer('cliffDuration').notNull(),
    /** Vesting duration in seconds */
    vestingDuration: integer('vestingDuration').notNull(),
    /** TGE unlock percentage (0-100) */
    tgeUnlockPercent: integer('tgeUnlockPercent').notNull().default(0),
    /** Whether schedule is revocable */
    revocable: boolean('revocable').notNull().default(false),
    /** Whether schedule has been revoked */
    revoked: boolean('revoked').notNull().default(false),
    /** On-chain schedule ID (bytes32 as hex) */
    onChainScheduleId: text('onChainScheduleId'),
    /** Chain ID where vesting contract is deployed */
    chainId: integer('chainId'),
    /** Vesting contract address */
    contractAddress: text('contractAddress'),
    /** Created timestamp */
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    /** Updated timestamp */
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('VestingSchedule_beneficiary_idx').on(table.beneficiary),
    index('VestingSchedule_userId_idx').on(table.userId),
    index('VestingSchedule_category_idx').on(table.category),
    index('VestingSchedule_startTime_idx').on(table.startTime),
  ]
);

// =============================================================================
// TOKEN DEPLOYMENT RECORDS
// =============================================================================

/**
 * Token Deployments
 *
 * Records token contract deployments across chains.
 * Used for cross-chain address resolution.
 */
export const tokenDeployments = pgTable(
  'TokenDeployment',
  {
    id: text('id').primaryKey(),
    /** Chain ID */
    chainId: integer('chainId').notNull(),
    /** Chain name for display */
    chainName: text('chainName').notNull(),
    /** Token contract address */
    tokenAddress: text('tokenAddress').notNull(),
    /** Token type: native, synthetic, collateral */
    tokenType: text('tokenType').notNull(),
    /** Vesting contract address */
    vestingAddress: text('vestingAddress'),
    /** Fee distributor address */
    feeDistributorAddress: text('feeDistributorAddress'),
    /** Airdrop contract address */
    airdropAddress: text('airdropAddress'),
    /** CCA launcher address */
    ccaLauncherAddress: text('ccaLauncherAddress'),
    /** Warp route address (for bridging) */
    warpRouteAddress: text('warpRouteAddress'),
    /** Deployment transaction hash */
    deploymentTxHash: text('deploymentTxHash'),
    /** Block number of deployment */
    deploymentBlock: text('deploymentBlock'),
    /** Whether this is the home chain */
    isHomeChain: boolean('isHomeChain').notNull().default(false),
    /** Deployment timestamp */
    deployedAt: timestamp('deployedAt', { mode: 'date' })
      .notNull()
      .defaultNow(),
    /** Updated timestamp */
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('TokenDeployment_chainId_idx').on(table.chainId),
    index('TokenDeployment_tokenAddress_idx').on(table.tokenAddress),
    index('TokenDeployment_isHomeChain_idx').on(table.isHomeChain),
  ]
);

// =============================================================================
// ELIZA HOLDERS VERIFICATION
// =============================================================================

/**
 * ELIZA Holders
 *
 * Tracks ELIZA token holder verification status for presale bonus eligibility.
 * Records holder balance across all supported chains for bonus calculations.
 */
export const elizaHolders = pgTable(
  'ElizaHolder',
  {
    userId: text('userId').primaryKey().notNull(),
    /** Wallet address verified */
    walletAddress: text('walletAddress').notNull(),
    /** Total ELIZA balance (wei, as string) */
    totalBalance: text('totalBalance').notNull().default('0'),
    /** Mainnet ELIZA balance */
    mainnetBalance: text('mainnetBalance').notNull().default('0'),
    /** Base ELIZA balance */
    baseBalance: text('baseBalance').notNull().default('0'),
    /** BSC ELIZA balance */
    bscBalance: text('bscBalance').notNull().default('0'),
    /** Whether user qualifies for bonus (>= 1000 ELIZA) */
    qualifiesForBonus: boolean('qualifiesForBonus').notNull().default(false),
    /** When verification was performed */
    verifiedAt: timestamp('verifiedAt', { mode: 'date' })
      .notNull()
      .defaultNow(),
    /** Created timestamp */
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    /** Updated timestamp */
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('ElizaHolder_walletAddress_idx').on(table.walletAddress),
    index('ElizaHolder_qualifiesForBonus_idx').on(table.qualifiesForBonus),
    index('ElizaHolder_verifiedAt_idx').on(table.verifiedAt),
  ]
);

// =============================================================================
// RELATIONS
// =============================================================================

export const elizaHoldersRelations = relations(elizaHolders, ({ one }) => ({
  user: one(users, {
    fields: [elizaHolders.userId],
    references: [users.id],
  }),
}));

export const tokenBalancesRelations = relations(tokenBalances, ({ one }) => ({
  user: one(users, {
    fields: [tokenBalances.userId],
    references: [users.id],
  }),
}));

export const tokenTransactionsRelations = relations(
  tokenTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [tokenTransactions.userId],
      references: [users.id],
    }),
  })
);

export const airdropAllocationsRelations = relations(
  airdropAllocations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [airdropAllocations.userId],
      references: [users.id],
    }),
    claims: many(airdropClaims),
  })
);

export const airdropClaimsRelations = relations(airdropClaims, ({ one }) => ({
  user: one(users, {
    fields: [airdropClaims.userId],
    references: [users.id],
  }),
  allocation: one(airdropAllocations, {
    fields: [airdropClaims.userId],
    references: [airdropAllocations.userId],
  }),
}));

export const vestingSchedulesRelations = relations(
  vestingSchedules,
  ({ one }) => ({
    user: one(users, {
      fields: [vestingSchedules.userId],
      references: [users.id],
    }),
  })
);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type TokenBalance = typeof tokenBalances.$inferSelect;
export type NewTokenBalance = typeof tokenBalances.$inferInsert;

export type TokenTransaction = typeof tokenTransactions.$inferSelect;
export type NewTokenTransaction = typeof tokenTransactions.$inferInsert;

export type AirdropAllocation = typeof airdropAllocations.$inferSelect;
export type NewAirdropAllocation = typeof airdropAllocations.$inferInsert;

export type AirdropClaim = typeof airdropClaims.$inferSelect;
export type NewAirdropClaim = typeof airdropClaims.$inferInsert;

export type VestingSchedule = typeof vestingSchedules.$inferSelect;
export type NewVestingSchedule = typeof vestingSchedules.$inferInsert;

export type TokenDeployment = typeof tokenDeployments.$inferSelect;
export type NewTokenDeployment = typeof tokenDeployments.$inferInsert;

export type ElizaHolder = typeof elizaHolders.$inferSelect;
export type NewElizaHolder = typeof elizaHolders.$inferInsert;
