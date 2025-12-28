/**
 * Typed Table References for EQLite
 *
 * This module provides strongly-typed table references that carry their schema type.
 * When used with db.select().from(typedTable), the result will be properly typed
 * instead of returning Record<string, unknown>.
 *
 * Usage:
 *   import { typedTables } from '@babylon/db'
 *   const questions = await db.select().from(typedTables.questions) // Question[]
 */

import type * as SchemaTypes from './eqlite-schema-types'
import { type ColumnRef, TABLE_NAMES } from './table-registry'

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Type helper to extract the row type from a typed table reference.
 * @example
 * type User = InferSelectModel<typeof typedTables.users>
 */
export type InferSelectModel<T> = T extends TypedTableRef<infer R> ? R : never

// ============================================================================
// Typed Table Reference
// ============================================================================

/**
 * Base interface for typed table reference internal structure.
 */
interface TypedTableBase<TSchema> {
  /** Table configuration */
  readonly _: { readonly name: string }
  /** Phantom type for schema inference - used by SelectBuilder */
  readonly $inferSelect: TSchema
}

/**
 * Typed column accessors - maps column names to ColumnRef.
 */
type TypedColumns<TSchema> = {
  readonly [K in keyof TSchema]: ColumnRef
}

/**
 * Table reference with typed schema for query result inference.
 * The TSchema type parameter is the row type returned from queries.
 */
export type TypedTableRef<TSchema> = TypedTableBase<TSchema> &
  TypedColumns<TSchema>

/**
 * Creates a typed table reference for use with db.select().from(table).
 * The result type is inferred from TSchema.
 */
function createTypedTableRef<TSchema>(
  tableName: string,
): TypedTableRef<TSchema> {
  // $inferSelect is a phantom type property used only for TypeScript type inference.
  // It's never accessed at runtime, so we cast to satisfy the type.
  const base = {
    _: { name: tableName },
    $inferSelect: undefined as TSchema,
  } as { readonly _: { readonly name: string }; readonly $inferSelect: TSchema }

  return new Proxy(base, {
    get(
      target,
      prop: string | symbol,
    ): { name: string } | ColumnRef | TSchema | undefined {
      // Return internal properties as-is
      if (prop === '_') {
        return target._
      }
      if (prop === '$inferSelect') {
        return target.$inferSelect
      }
      if (typeof prop === 'symbol') {
        return undefined
      }

      // Return column reference for any other property access
      const columnRef: ColumnRef = { name: prop, table: tableName }
      return columnRef
    },
  }) as TypedTableRef<TSchema>
}

// ============================================================================
// Typed Table Exports
// ============================================================================

/**
 * Typed table references for all database tables.
 * Use these with db.select().from() to get properly typed results.
 *
 * @example
 * import { db, typedTables } from '@babylon/db'
 * const users = await db.select().from(typedTables.users)
 * // users is typed as User[]
 */
export const typedTables = {
  // User tables
  users: createTypedTableRef<SchemaTypes.User>(TABLE_NAMES.users),
  onboardingIntents: createTypedTableRef<SchemaTypes.OnboardingIntent>(
    TABLE_NAMES.onboardingIntents,
  ),
  follows: createTypedTableRef<SchemaTypes.Follow>(TABLE_NAMES.follows),
  followStatuses: createTypedTableRef<SchemaTypes.FollowStatus>(
    TABLE_NAMES.followStatuses,
  ),
  favorites: createTypedTableRef<SchemaTypes.Favorite>(TABLE_NAMES.favorites),
  userBlocks: createTypedTableRef<SchemaTypes.UserBlock>(
    TABLE_NAMES.userBlocks,
  ),
  userMutes: createTypedTableRef<SchemaTypes.UserMute>(TABLE_NAMES.userMutes),
  referrals: createTypedTableRef<SchemaTypes.Referral>(TABLE_NAMES.referrals),
  profileUpdateLogs: createTypedTableRef<SchemaTypes.ProfileUpdateLog>(
    TABLE_NAMES.profileUpdateLogs,
  ),
  twitterOAuthTokens: createTypedTableRef<SchemaTypes.TwitterOAuthToken>(
    TABLE_NAMES.twitterOAuthTokens,
  ),
  userActorFollows: createTypedTableRef<SchemaTypes.UserActorFollow>(
    TABLE_NAMES.userActorFollows,
  ),
  userInteractions: createTypedTableRef<SchemaTypes.UserInteraction>(
    TABLE_NAMES.userInteractions,
  ),
  userApiKeys: createTypedTableRef<SchemaTypes.UserApiKey>(
    TABLE_NAMES.userApiKeys,
  ),

  // Actor tables
  actorState: createTypedTableRef<SchemaTypes.ActorStateRow>(
    TABLE_NAMES.actorState,
  ),
  actorFollows: createTypedTableRef<SchemaTypes.ActorFollow>(
    TABLE_NAMES.actorFollows,
  ),
  actorRelationships: createTypedTableRef<SchemaTypes.ActorRelationship>(
    TABLE_NAMES.actorRelationships,
  ),
  npcInteractions: createTypedTableRef<SchemaTypes.NPCInteraction>(
    TABLE_NAMES.npcInteractions,
  ),
  npcTrades: createTypedTableRef<SchemaTypes.NPCTrade>(TABLE_NAMES.npcTrades),

  // Agent tables
  agentRegistries: createTypedTableRef<SchemaTypes.AgentRegistry>(
    TABLE_NAMES.agentRegistries,
  ),
  agentCapabilities: createTypedTableRef<SchemaTypes.AgentCapability>(
    TABLE_NAMES.agentCapabilities,
  ),
  agentLogs: createTypedTableRef<SchemaTypes.AgentLog>(TABLE_NAMES.agentLogs),
  agentMessages: createTypedTableRef<SchemaTypes.AgentMessage>(
    TABLE_NAMES.agentMessages,
  ),
  agentPerformanceMetrics:
    createTypedTableRef<SchemaTypes.AgentPerformanceMetrics>(
      TABLE_NAMES.agentPerformanceMetrics,
    ),
  agentGoals: createTypedTableRef<SchemaTypes.AgentGoal>(
    TABLE_NAMES.agentGoals,
  ),
  agentGoalActions: createTypedTableRef<SchemaTypes.AgentGoalAction>(
    TABLE_NAMES.agentGoalActions,
  ),
  agentPointsTransactions:
    createTypedTableRef<SchemaTypes.AgentPointsTransaction>(
      TABLE_NAMES.agentPointsTransactions,
    ),
  agentTrades: createTypedTableRef<SchemaTypes.AgentTrade>(
    TABLE_NAMES.agentTrades,
  ),
  externalAgentConnections:
    createTypedTableRef<SchemaTypes.ExternalAgentConnection>(
      TABLE_NAMES.externalAgentConnections,
    ),
  userAgentConfigs: createTypedTableRef<SchemaTypes.UserAgentConfig>(
    TABLE_NAMES.userAgentConfigs,
  ),

  // Post tables
  posts: createTypedTableRef<SchemaTypes.Post>(TABLE_NAMES.posts),
  comments: createTypedTableRef<SchemaTypes.Comment>(TABLE_NAMES.comments),
  reactions: createTypedTableRef<SchemaTypes.Reaction>(TABLE_NAMES.reactions),
  shares: createTypedTableRef<SchemaTypes.Share>(TABLE_NAMES.shares),
  shareActions: createTypedTableRef<SchemaTypes.ShareAction>(
    TABLE_NAMES.shareActions,
  ),
  tags: createTypedTableRef<SchemaTypes.Tag>(TABLE_NAMES.tags),
  postTags: createTypedTableRef<SchemaTypes.PostTag>(TABLE_NAMES.postTags),
  trendingTags: createTypedTableRef<SchemaTypes.TrendingTag>(
    TABLE_NAMES.trendingTags,
  ),

  // Market tables
  markets: createTypedTableRef<SchemaTypes.Market>(TABLE_NAMES.markets),
  questions: createTypedTableRef<SchemaTypes.Question>(TABLE_NAMES.questions),
  positions: createTypedTableRef<SchemaTypes.Position>(TABLE_NAMES.positions),
  predictionPriceHistories:
    createTypedTableRef<SchemaTypes.PredictionPriceHistory>(
      TABLE_NAMES.predictionPriceHistories,
    ),
  organizations: createTypedTableRef<SchemaTypes.Organization>(
    TABLE_NAMES.organizations,
  ),
  stockPrices: createTypedTableRef<SchemaTypes.StockPrice>(
    TABLE_NAMES.stockPrices,
  ),
  perpPositions: createTypedTableRef<SchemaTypes.PerpPosition>(
    TABLE_NAMES.perpPositions,
  ),
  perpMarketSnapshots: createTypedTableRef<SchemaTypes.PerpMarketSnapshot>(
    TABLE_NAMES.perpMarketSnapshots,
  ),
  marketOutcomes: createTypedTableRef<SchemaTypes.MarketOutcome>(
    TABLE_NAMES.marketOutcomes,
  ),

  // Pool tables
  pools: createTypedTableRef<SchemaTypes.Pool>(TABLE_NAMES.pools),
  poolPositions: createTypedTableRef<SchemaTypes.PoolPosition>(
    TABLE_NAMES.poolPositions,
  ),
  poolDeposits: createTypedTableRef<SchemaTypes.PoolDeposit>(
    TABLE_NAMES.poolDeposits,
  ),

  // Messaging tables
  chats: createTypedTableRef<SchemaTypes.Chat>(TABLE_NAMES.chats),
  chatParticipants: createTypedTableRef<SchemaTypes.ChatParticipant>(
    TABLE_NAMES.chatParticipants,
  ),
  chatAdmins: createTypedTableRef<SchemaTypes.ChatAdmin>(
    TABLE_NAMES.chatAdmins,
  ),
  chatInvites: createTypedTableRef<SchemaTypes.ChatInvite>(
    TABLE_NAMES.chatInvites,
  ),
  messages: createTypedTableRef<SchemaTypes.Message>(TABLE_NAMES.messages),
  dmAcceptances: createTypedTableRef<SchemaTypes.DMAcceptance>(
    TABLE_NAMES.dmAcceptances,
  ),
  groupChatMemberships: createTypedTableRef<SchemaTypes.GroupChatMembership>(
    TABLE_NAMES.groupChatMemberships,
  ),
  notifications: createTypedTableRef<SchemaTypes.Notification>(
    TABLE_NAMES.notifications,
  ),
  userGroups: createTypedTableRef<SchemaTypes.UserGroup>(
    TABLE_NAMES.userGroups,
  ),
  userGroupAdmins: createTypedTableRef<SchemaTypes.UserGroupAdmin>(
    TABLE_NAMES.userGroupAdmins,
  ),
  userGroupInvites: createTypedTableRef<SchemaTypes.UserGroupInvite>(
    TABLE_NAMES.userGroupInvites,
  ),
  userGroupMembers: createTypedTableRef<SchemaTypes.UserGroupMember>(
    TABLE_NAMES.userGroupMembers,
  ),
  pendingGroupInviteCandidates:
    createTypedTableRef<SchemaTypes.PendingGroupInviteCandidate>(
      TABLE_NAMES.pendingGroupInviteCandidates,
    ),
  userMessagingKeys: createTypedTableRef<SchemaTypes.UserMessagingKey>(
    TABLE_NAMES.userMessagingKeys,
  ),
  messagingPreKeys: createTypedTableRef<SchemaTypes.MessagingPreKey>(
    TABLE_NAMES.messagingPreKeys,
  ),
  messageReceipts: createTypedTableRef<SchemaTypes.MessageReceipt>(
    TABLE_NAMES.messageReceipts,
  ),

  // Trading tables
  tradingFees: createTypedTableRef<SchemaTypes.TradingFee>(
    TABLE_NAMES.tradingFees,
  ),
  balanceTransactions: createTypedTableRef<SchemaTypes.BalanceTransaction>(
    TABLE_NAMES.balanceTransactions,
  ),
  pointsTransactions: createTypedTableRef<SchemaTypes.PointsTransaction>(
    TABLE_NAMES.pointsTransactions,
  ),
  feedbacks: createTypedTableRef<SchemaTypes.Feedback>(TABLE_NAMES.feedbacks),
  reports: createTypedTableRef<SchemaTypes.Report>(TABLE_NAMES.reports),
  moderationEscrows: createTypedTableRef<SchemaTypes.ModerationEscrow>(
    TABLE_NAMES.moderationEscrows,
  ),

  // Training tables
  trajectories: createTypedTableRef<SchemaTypes.Trajectory>(
    TABLE_NAMES.trajectories,
  ),
  rewardJudgments: createTypedTableRef<SchemaTypes.RewardJudgment>(
    TABLE_NAMES.rewardJudgments,
  ),
  trainingBatches: createTypedTableRef<SchemaTypes.TrainingBatch>(
    TABLE_NAMES.trainingBatches,
  ),
  trainedModels: createTypedTableRef<SchemaTypes.TrainedModel>(
    TABLE_NAMES.trainedModels,
  ),
  benchmarkResults: createTypedTableRef<SchemaTypes.BenchmarkResult>(
    TABLE_NAMES.benchmarkResults,
  ),
  llmCallLogs: createTypedTableRef<SchemaTypes.LlmCallLog>(
    TABLE_NAMES.llmCallLogs,
  ),

  // Game/World tables
  games: createTypedTableRef<SchemaTypes.Game>(TABLE_NAMES.games),
  gameConfigs: createTypedTableRef<SchemaTypes.GameConfig>(
    TABLE_NAMES.gameConfigs,
  ),
  realtimeOutboxes: createTypedTableRef<SchemaTypes.RealtimeOutbox>(
    TABLE_NAMES.realtimeOutboxes,
  ),
  oAuthStates: createTypedTableRef<SchemaTypes.OAuthState>(
    TABLE_NAMES.oAuthStates,
  ),
  oracleCommitments: createTypedTableRef<SchemaTypes.OracleCommitment>(
    TABLE_NAMES.oracleCommitments,
  ),
  oracleTransactions: createTypedTableRef<SchemaTypes.OracleTransaction>(
    TABLE_NAMES.oracleTransactions,
  ),
  widgetCaches: createTypedTableRef<SchemaTypes.WidgetCache>(
    TABLE_NAMES.widgetCaches,
  ),
  worldEvents: createTypedTableRef<SchemaTypes.WorldEvent>(
    TABLE_NAMES.worldEvents,
  ),
  worldFacts: createTypedTableRef<SchemaTypes.WorldFact>(
    TABLE_NAMES.worldFacts,
  ),
  systemSettings: createTypedTableRef<SchemaTypes.SystemSettings>(
    TABLE_NAMES.systemSettings,
  ),
  generationLocks: createTypedTableRef<SchemaTypes.GenerationLock>(
    TABLE_NAMES.generationLocks,
  ),
  rssFeedSources: createTypedTableRef<SchemaTypes.RSSFeedSource>(
    TABLE_NAMES.rssFeedSources,
  ),
  rssHeadlines: createTypedTableRef<SchemaTypes.RSSHeadline>(
    TABLE_NAMES.rssHeadlines,
  ),
  parodyHeadlines: createTypedTableRef<SchemaTypes.ParodyHeadline>(
    TABLE_NAMES.parodyHeadlines,
  ),
  tickTokenStats: createTypedTableRef<SchemaTypes.TickTokenStats>(
    TABLE_NAMES.tickTokenStats,
  ),
  questionArcPlans: createTypedTableRef<SchemaTypes.QuestionArcPlan>(
    TABLE_NAMES.questionArcPlans,
  ),

  // State tables
  organizationState: createTypedTableRef<SchemaTypes.OrganizationStateRow>(
    TABLE_NAMES.organizationState,
  ),

  // Token tables
  tokenBalances: createTypedTableRef<SchemaTypes.TokenBalance>(
    TABLE_NAMES.tokenBalances,
  ),
  tokenTransactions: createTypedTableRef<SchemaTypes.TokenTransaction>(
    TABLE_NAMES.tokenTransactions,
  ),
  airdropAllocations: createTypedTableRef<SchemaTypes.AirdropAllocation>(
    TABLE_NAMES.airdropAllocations,
  ),
  airdropClaims: createTypedTableRef<SchemaTypes.AirdropClaim>(
    TABLE_NAMES.airdropClaims,
  ),
  vestingSchedules: createTypedTableRef<SchemaTypes.VestingSchedule>(
    TABLE_NAMES.vestingSchedules,
  ),
  tokenDeployments: createTypedTableRef<SchemaTypes.TokenDeployment>(
    TABLE_NAMES.tokenDeployments,
  ),
  elizaHolders: createTypedTableRef<SchemaTypes.ElizaHolder>(
    TABLE_NAMES.elizaHolders,
  ),
  elizaHolderAllocations:
    createTypedTableRef<SchemaTypes.ElizaHolderAllocation>(
      TABLE_NAMES.elizaHolderAllocations,
    ),

  // Engagement tables
  dailyEngagement: createTypedTableRef<SchemaTypes.DailyEngagement>(
    TABLE_NAMES.dailyEngagement,
  ),
  feeAccumulator: createTypedTableRef<SchemaTypes.FeeAccumulator>(
    TABLE_NAMES.feeAccumulator,
  ),
  buybackRecords: createTypedTableRef<SchemaTypes.BuybackRecord>(
    TABLE_NAMES.buybackRecords,
  ),
  feeContributions: createTypedTableRef<SchemaTypes.FeeContribution>(
    TABLE_NAMES.feeContributions,
  ),
} as const

/**
 * Type for the typedTables object - useful for generic functions.
 */
export type TypedTables = typeof typedTables
