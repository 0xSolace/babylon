/**
 * Babylon Database Layer
 *
 * CovenantSQL (CQL) database for decentralized data persistence.
 *
 * API:
 * - Raw SQL: db.query(sql, params), db.exec(sql, params)
 * - Template literals: db.$queryRaw`SELECT * FROM users WHERE id = ${id}`
 * - Repositories: db.user.findUnique({ where: { id } })
 * - Transactions: db.transaction(async (tx) => { ... })
 */

import type { JsonValue, SQLValue } from './types'

// ============================================================================
// CQL Client (Decentralized Database)
// ============================================================================

export {
  type CQLClient,
  createCQLClient,
  getCQLClient,
  resetCQLClient,
} from './cql-client'

export {
  CQLTableRepository,
  type DB,
  getDB,
  initializeDB,
  resetDB,
} from './cql-repository'

export type { QueryTransaction } from './decentralized/cql-compat'

import { type CQLClient, db as cqlDatabase } from './cql-client'
export { cqlDatabase as cqlDb }

// ============================================================================
// Type Exports
// ============================================================================

// Export schema types for external use
export type {
  ActorStateRow,
  AgentCapability,
  AgentRegistry,
  AgentTrade,
  BenchmarkResult,
  Chat,
  ChatInvite,
  ChatParticipant,
  Comment,
  DailyEngagement,
  ExternalAgentConnection,
  Game,
  GameConfig,
  GroupChatMembership,
  Market,
  Message,
  NewMarket,
  NewPosition,
  NewPredictionPriceHistory,
  Notification,
  NPCTrade,
  OrganizationStateRow,
  PerpPosition as PerpPositionRow,
  PerpPosition,
  Pool,
  PoolPosition,
  Position,
  Post,
  PredictionPriceHistory,
  Question,
  Reaction,
  Report,
  RSSHeadline,
  TrainedModel as TrainedModelSchema,
  TrainingBatch as TrainingBatchSchema,
  Trajectory,
  User,
  UserAgentConfig,
  UserApiKey,
  UserInsert,
  WorldEvent,
  WorldFact,
} from './cql-schema-types'

// Export Decimal class from types
export { Decimal } from './types'

export type { JsonValue, SQLValue }

export type {
  ActorRef,
  AgentGoalWithActions,
  BalanceTransactionWithUser,
  ChatWithParticipants,
  ChatWithParticipantsAndMessages,
  ChatWithRelations,
  ExternalAgentConnectionWithRegistry,
  MessageWithSender,
  ModerationEscrowWithRelations,
  PoolWithActorState,
  PostWithRelations,
  TradingFeeWithUser,
  TrainedModel,
  TrainingBatch,
  UserWithAgentRelations,
  UserWithMetrics,
} from './model-types'
export {
  DatabaseError,
  type DatabaseErrorType,
  Decimal as DecimalClass,
  type InputJsonValue,
  isUniqueConstraintError,
  toDatabaseErrorType,
} from './types'

// ============================================================================
// Types
// ============================================================================

export type DbClient = CQLClient
export type Database = CQLClient

// Transaction type matches what db.transaction() provides
export type Transaction = CQLClient

export const db: DbClient = cqlDatabase

// ============================================================================
// SQL Query Helpers (Native Implementation)
// ============================================================================

export {
  and,
  asc,
  avg,
  between,
  type ColumnRef,
  col,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isColumnRef,
  isNotNull,
  isNull,
  isSQLCondition,
  isSQLExpression,
  like,
  lt,
  lte,
  max,
  min,
  ne,
  not,
  notExists,
  notInArray,
  or,
  type SQLCondition,
  type SQLExpression,
  sql,
  sum,
} from './sql-helpers'

// ============================================================================
// Transaction Support
// ============================================================================

export async function withTransaction<T>(
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  await initializeDB()
  return db.transaction(fn)
}

/** User identifier - can be a string ID or an object with userId property */
export type UserIdOrUser = string | { userId: string }

/**
 * Execute as a specific user (with RLS)
 * Note: CQL doesn't support Postgres RLS, so this just runs the operation
 */
export async function asUser<T>(
  userIdOrUser: UserIdOrUser,
  operation: (database: DbClient) => Promise<T>,
): Promise<T> {
  void userIdOrUser // RLS not supported in CQL
  return operation(db)
}

/**
 * Execute as system (bypass RLS)
 * Note: CQL doesn't support Postgres RLS, so this just runs the operation
 */
export async function asSystem<T>(
  operation: (database: DbClient) => Promise<T>,
  _operationName?: string,
): Promise<T> {
  return operation(db)
}

/**
 * Execute as public (unauthenticated)
 */
export async function asPublic<T>(
  operation: (database: DbClient) => Promise<T>,
): Promise<T> {
  return operation(db)
}

// ============================================================================
// Decentralized Database Layer
// ============================================================================

// ============================================================================
// Validation Schemas (Zod)
// ============================================================================

// ============================================================================
// Typed Table References (Recommended)
// ============================================================================

export {
  type InferSelectModel,
  type TypedTableRef,
  type TypedTables,
  typedTables,
} from './typed-tables'

// ============================================================================
// Table Registry
// ============================================================================

export {
  actorFollows,
  actorRelationships,
  actorState,
  adminAuditLogs,
  agentCapabilities,
  agentGoalActions,
  agentGoals,
  agentLogs,
  agentMessages,
  agentPerformanceMetrics,
  agentPointsTransactions,
  agentRegistries,
  agentTrades,
  airdropAllocations,
  airdropClaims,
  balanceTransactions,
  benchmarkResults,
  buybackRecords,
  CQL_NAME_SYMBOL,
  chatAdmins,
  chatInvites,
  chatParticipants,
  chats,
  comments,
  dailyEngagement,
  dmAcceptances,
  elizaHolderAllocations,
  elizaHolders,
  externalAgentConnections,
  favorites,
  feeAccumulator,
  feeContributions,
  feedbacks,
  followStatuses,
  follows,
  gameConfigs,
  games,
  generationLocks,
  // Table registry functions
  getTableMeta,
  getTableName,
  groupChatMemberships,
  llmCallLogs,
  marketOutcomes,
  markets,
  messageReceipts,
  messages,
  messagingPreKeys,
  moderationEscrows,
  notifications,
  npcInteractions,
  npcTrades,
  oAuthStates,
  onboardingIntents,
  oracleCommitments,
  oracleTransactions,
  organizationState,
  organizations,
  parodyHeadlines,
  pendingGroupInviteCandidates,
  perpMarketSnapshots,
  perpPositions,
  pointsTransactions,
  poolDeposits,
  poolPositions,
  pools,
  positions,
  posts,
  postTags,
  predictionPriceHistories,
  profileUpdateLogs,
  questionArcPlans,
  questions,
  reactions,
  realtimeOutboxes,
  referrals,
  registerTable,
  reports,
  rewardJudgments,
  rssFeedSources,
  rssHeadlines,
  shareActions,
  shares,
  stockPrices,
  systemSettings,
  TABLE_NAMES,
  type TableMeta,
  type TableName,
  type TableRef,
  tags,
  tickTokenStats,
  tokenBalances,
  tokenDeployments,
  tokenTransactions,
  tradingFees,
  trainedModels,
  trainingBatches,
  trajectories,
  trendingTags,
  twitterOAuthTokens,
  userActorFollows,
  userAgentConfigs,
  userApiKeys,
  userBlocks,
  userGroupAdmins,
  userGroupInvites,
  userGroupMembers,
  userGroups,
  userInteractions,
  userMessagingKeys,
  userMutes,
  // Table reference exports (for CQL query builder API)
  users,
  vestingSchedules,
  widgetCaches,
  worldEvents,
  worldFacts,
} from './table-registry'

// ============================================================================
// Utility Exports
// ============================================================================

export {
  DatabaseService,
  type FeedPost,
  getDbInstance,
} from './database-service'

export {
  $connect,
  $disconnect,
  $executeRaw,
  $queryRaw,
  isRetryableError,
  withRetry,
} from './helpers'

export {
  clearJsonStorage,
  exportJsonState,
  getJsonState,
  getStorageMode,
  initializeJsonMode,
  initializeMemoryMode,
  initJsonStorage,
  isJsonMode,
  isSimulationMode,
  loadJsonSnapshot,
  resetToCQLMode,
  type StorageMode,
  saveJsonSnapshot,
} from './json-storage'

export { queryMonitor } from './query-monitor'

export {
  getBlockedByUserIds,
  getBlockedUserIds,
  getMutedUserIds,
  hasBlocked,
  hasMuted,
} from './user-utils'

// ============================================================================
// Initialization
// ============================================================================

import { getDB, initializeDB, resetDB } from './cql-repository'
import { createCQLTables, generateAllDDL } from './decentralized/cql-schema'

export { generateAllDDL }

let tablesCreated = false

export async function initializeDatabase(): Promise<void> {
  if (!process.env.CQL_BLOCK_PRODUCER_ENDPOINT) {
    throw new Error(
      '[DB] CQL_BLOCK_PRODUCER_ENDPOINT is required. ' +
        'Start Jeju: cd /path/to/jeju && bun run dev',
    )
  }
  const db = await initializeDB()

  // Create tables if they don't exist (first-run schema setup)
  if (!tablesCreated) {
    await createCQLTables(db)
    tablesCreated = true
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  const cqlDb = getDB()
  return cqlDb.isHealthy()
}

export async function closeDatabase(): Promise<void> {
  resetDB()
}
