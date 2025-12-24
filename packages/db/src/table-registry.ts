/**
 * Table Registry
 *
 * Provides table metadata for CQL operations.
 * Maps table objects to their database names.
 */

import type * as SchemaTypes from './cql-schema-types'

// ============================================================================
// Table Metadata
// ============================================================================

/**
 * Table metadata for CQL operations.
 */
export interface TableMeta {
  /** Database table name */
  name: string
  /** Primary key column(s) */
  primaryKey: string[]
  /** Column names */
  columns: string[]
}

/**
 * Symbol used for CQL table names.
 */
export const CQL_NAME_SYMBOL = Symbol.for('cql:Name')

/**
 * Column reference for CQL queries.
 * Returned when accessing table.columnName (e.g., users.id)
 */
export interface ColumnRef {
  /** Column name for the query builder */
  name: string
  /** Table name this column belongs to (optional for unqualified columns) */
  table?: string
  /** Type marker for runtime type checking (optional) */
  _type?: 'column'
}

/**
 * Typed column reference that preserves the column type for query building.
 * The T parameter is the runtime type of the column value (e.g., string, number, Date).
 */
export type TypedColumnRef<T> = ColumnRef & { readonly __columnType?: T }

/**
 * Maps a schema type to typed column refs.
 * When you access `users.id`, it returns `TypedColumnRef<string>`.
 */
export type SchemaColumns<TSchema> = {
  [K in keyof TSchema]: TypedColumnRef<TSchema[K]>
}

/**
 * Table reference with column accessors.
 * Supports column access via Proxy (e.g., users.id returns ColumnRef)
 */
export type TableWithColumns = {
  _: { name: string }
  /** Access any column by name - returns ColumnRef for query building */
  [column: string]: ColumnRef | { name: string }
}

/**
 * Typed table reference that preserves the schema type.
 * TSchema is the row type returned from queries on this table.
 * Column access (e.g., users.id) returns TypedColumnRef<typeof id>.
 */
export type TypedTable<TSchema> = {
  /** Internal metadata - table name */
  readonly _: { readonly name: string }
  /** Phantom type for schema inference - never accessed at runtime */
  readonly __schema?: TSchema
} & SchemaColumns<TSchema>

/**
 * Table reference type - matches the structure created by schema files.
 */
export interface TableRef {
  _?: { name?: string }
}

/**
 * Type guard to check if an object has a TableRef-like config.
 */
function hasTableRefConfig(value: object): value is TableRef {
  if (!('_' in value)) return false
  // After 'in' check, _ property is accessible
  return typeof value._ === 'object' && value._ !== null
}

/**
 * Type guard to check if an object has _ config with name property.
 */
function hasUnderscoreConfig(value: object): value is { _: { name?: string } } {
  if (!('_' in value)) return false
  // After 'in' check, _ property is accessible
  return typeof value._ === 'object' && value._ !== null
}

// ============================================================================
// Table Name Registry
// ============================================================================

/**
 * Registry mapping table objects to their metadata.
 * We use WeakMap to avoid memory leaks with table objects.
 */
const tableRegistry = new WeakMap<object, TableMeta>()

/**
 * Fallback table name map for when WeakMap lookup fails.
 * Maps table name strings to metadata.
 */
const tableNameMap = new Map<string, TableMeta>()

/**
 * Register a table with its metadata.
 */
export function registerTable(table: object, meta: TableMeta): void {
  tableRegistry.set(table, meta)
  tableNameMap.set(meta.name, meta)
}

/**
 * Get table metadata.
 */
export function getTableMeta(table: object | string): TableMeta | undefined {
  if (typeof table === 'string') {
    return tableNameMap.get(table)
  }
  return tableRegistry.get(table)
}

/**
 * Get table name from a table object.
 *
 * Supports:
 * - Tables with _: { name }
 * - Tables with Symbol.for('cql:Name')
 * - Registered tables in the registry
 */
export function getTableName(table: object | string): string {
  if (typeof table === 'string') {
    return table
  }

  // Check registry first
  const meta = tableRegistry.get(table)
  if (meta) {
    return meta.name
  }

  // Try name extraction from config object
  if (hasTableRefConfig(table)) {
    if (table._ && typeof table._.name === 'string') {
      return table._.name
    }
  }

  // Try Symbol-based name
  const cqlNameSymbol = Symbol.for('cql:Name')
  if (cqlNameSymbol in table) {
    // Symbol is in object, access via computed property
    const tableWithSymbol = table as { [key: symbol]: unknown }
    const symbolName = tableWithSymbol[cqlNameSymbol]
    if (typeof symbolName === 'string') {
      return symbolName
    }
  }

  // Try config-style extraction
  if (hasUnderscoreConfig(table)) {
    const config = table._
    if (config.name) {
      return config.name
    }
  }

  throw new Error(
    '[TableRegistry] Cannot extract table name. Register the table or use a string name.',
  )
}

// ============================================================================
// Table Name Constants
// ============================================================================

/**
 * All Babylon database table names.
 */
export const TABLE_NAMES = {
  // Users
  users: 'User',
  onboardingIntents: 'OnboardingIntent',
  follows: 'Follow',
  followStatuses: 'FollowStatus',
  favorites: 'Favorite',
  userBlocks: 'UserBlock',
  userMutes: 'UserMute',
  referrals: 'Referral',
  profileUpdateLogs: 'ProfileUpdateLog',
  twitterOAuthTokens: 'TwitterOAuthToken',
  userActorFollows: 'UserActorFollow',
  userInteractions: 'UserInteraction',
  userApiKeys: 'UserApiKey',

  // Actors
  actorState: 'ActorState',
  actorFollows: 'ActorFollow',
  actorRelationships: 'ActorRelationship',
  npcInteractions: 'NPCInteraction',
  npcTrades: 'NPCTrade',

  // Agents
  agentRegistries: 'AgentRegistry',
  agentCapabilities: 'AgentCapability',
  agentLogs: 'AgentLog',
  agentMessages: 'AgentMessage',
  agentPerformanceMetrics: 'AgentPerformanceMetrics',
  agentGoals: 'AgentGoal',
  agentGoalActions: 'AgentGoalAction',
  agentPointsTransactions: 'AgentPointsTransaction',
  agentTrades: 'AgentTrade',
  externalAgentConnections: 'ExternalAgentConnection',
  userAgentConfigs: 'UserAgentConfig',

  // Posts
  posts: 'Post',
  comments: 'Comment',
  reactions: 'Reaction',
  shares: 'Share',
  shareActions: 'ShareAction',
  tags: 'Tag',
  postTags: 'PostTag',
  trendingTags: 'TrendingTag',

  // Markets
  markets: 'Market',
  questions: 'Question',
  positions: 'Position',
  predictionPriceHistories: 'PredictionPriceHistory',
  organizations: 'Organization',
  stockPrices: 'StockPrice',
  perpPositions: 'PerpPosition',
  perpMarketSnapshots: 'PerpMarketSnapshot',
  marketOutcomes: 'MarketOutcome',

  // Pools
  pools: 'Pool',
  poolPositions: 'PoolPosition',
  poolDeposits: 'PoolDeposit',

  // Messaging
  chats: 'Chat',
  chatParticipants: 'ChatParticipant',
  chatAdmins: 'ChatAdmin',
  chatInvites: 'ChatInvite',
  messages: 'Message',
  dmAcceptances: 'DMAcceptance',
  groupChatMemberships: 'GroupChatMembership',
  notifications: 'Notification',
  userGroups: 'UserGroup',
  userGroupAdmins: 'UserGroupAdmin',
  userGroupInvites: 'UserGroupInvite',
  userGroupMembers: 'UserGroupMember',
  pendingGroupInviteCandidates: 'PendingGroupInviteCandidate',
  userMessagingKeys: 'UserMessagingKey',
  messagingPreKeys: 'MessagingPreKey',
  messageReceipts: 'MessageReceipt',

  // Trading
  tradingFees: 'TradingFee',
  balanceTransactions: 'BalanceTransaction',
  pointsTransactions: 'PointsTransaction',
  feedbacks: 'Feedback',
  reports: 'Report',
  moderationEscrows: 'ModerationEscrow',

  // Training
  trajectories: 'Trajectory',
  rewardJudgments: 'RewardJudgment',
  trainingBatches: 'TrainingBatch',
  trainedModels: 'TrainedModel',
  benchmarkResults: 'BenchmarkResult',
  llmCallLogs: 'LlmCallLog',

  // Misc
  games: 'Game',
  gameConfigs: 'GameConfig',
  realtimeOutboxes: 'RealtimeOutbox',
  oAuthStates: 'OAuthState',
  oracleCommitments: 'OracleCommitment',
  oracleTransactions: 'OracleTransaction',
  widgetCaches: 'WidgetCache',
  worldEvents: 'WorldEvent',
  worldFacts: 'WorldFact',
  systemSettings: 'SystemSettings',
  generationLocks: 'GenerationLock',
  rssFeedSources: 'RSSFeedSource',
  rssHeadlines: 'RSSHeadline',
  parodyHeadlines: 'ParodyHeadline',
  tickTokenStats: 'TickTokenStats',
  questionArcPlans: 'QuestionArcPlan',

  // State
  actorStateTable: 'ActorState',
  organizationState: 'OrganizationState',

  // Tokens
  tokenBalances: 'TokenBalance',
  tokenTransactions: 'TokenTransaction',
  airdropAllocations: 'AirdropAllocation',
  airdropClaims: 'AirdropClaim',
  vestingSchedules: 'VestingSchedule',
  tokenDeployments: 'TokenDeployment',
  elizaHolders: 'ElizaHolder',
  elizaHolderAllocations: 'ElizaHolderAllocation',

  // Engagement
  dailyEngagement: 'DailyEngagement',
  feeAccumulator: 'FeeAccumulator',
  buybackRecords: 'BuybackRecord',
  feeContributions: 'FeeContribution',
} as const

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES]

// ============================================================================
// Table Reference Exports (for CQL query builder API)
// ============================================================================

/**
 * Creates a table reference object for use with db.select().from(tableRef)
 * Returns a Proxy that handles column access (e.g., users.id returns ColumnRef)
 *
 * @param tableName - The database table name
 * @returns A typed table reference with column accessors
 */
function createTableRef<TSchema = Record<string, unknown>>(
  tableName: string,
): TypedTable<TSchema> {
  // Include __schema as a phantom type property for TypeScript inference
  // This is never accessed at runtime but helps TypeScript infer the schema type
  const base: { _: { name: string }; __schema: TSchema | undefined } = {
    _: { name: tableName },
    __schema: undefined,
  }

  return new Proxy(base, {
    get(
      target,
      prop: string | symbol,
    ): { name: string } | ColumnRef | TSchema | undefined {
      // Return internal properties as-is
      if (prop === '_') {
        return target._
      }
      if (prop === '__schema') {
        return target.__schema
      }
      if (typeof prop === 'symbol') {
        return undefined
      }

      // Return column reference for any other property access
      const columnRef: ColumnRef = { name: prop, table: tableName }
      return columnRef
    },
  }) as TypedTable<TSchema>
}

// User tables
export const users = createTableRef<SchemaTypes.User>(TABLE_NAMES.users)
export const onboardingIntents = createTableRef<SchemaTypes.OnboardingIntent>(
  TABLE_NAMES.onboardingIntents,
)
export const follows = createTableRef<SchemaTypes.Follow>(TABLE_NAMES.follows)
export const followStatuses = createTableRef<SchemaTypes.FollowStatus>(
  TABLE_NAMES.followStatuses,
)
export const favorites = createTableRef<SchemaTypes.Favorite>(
  TABLE_NAMES.favorites,
)
export const userBlocks = createTableRef<SchemaTypes.UserBlock>(
  TABLE_NAMES.userBlocks,
)
export const userMutes = createTableRef<SchemaTypes.UserMute>(
  TABLE_NAMES.userMutes,
)
export const referrals = createTableRef<SchemaTypes.Referral>(
  TABLE_NAMES.referrals,
)
export const profileUpdateLogs = createTableRef<SchemaTypes.ProfileUpdateLog>(
  TABLE_NAMES.profileUpdateLogs,
)
export const twitterOAuthTokens = createTableRef<SchemaTypes.TwitterOAuthToken>(
  TABLE_NAMES.twitterOAuthTokens,
)
export const userActorFollows = createTableRef<SchemaTypes.UserActorFollow>(
  TABLE_NAMES.userActorFollows,
)
export const userInteractions = createTableRef<SchemaTypes.UserInteraction>(
  TABLE_NAMES.userInteractions,
)
export const userApiKeys = createTableRef<SchemaTypes.UserApiKey>(
  TABLE_NAMES.userApiKeys,
)

// Actor tables
export const actorState = createTableRef<SchemaTypes.ActorStateRow>(
  TABLE_NAMES.actorState,
)
export const actorFollows = createTableRef<SchemaTypes.ActorFollow>(
  TABLE_NAMES.actorFollows,
)
export const actorRelationships = createTableRef<SchemaTypes.ActorRelationship>(
  TABLE_NAMES.actorRelationships,
)
export const npcInteractions = createTableRef<SchemaTypes.NPCInteraction>(
  TABLE_NAMES.npcInteractions,
)
export const npcTrades = createTableRef<SchemaTypes.NPCTrade>(
  TABLE_NAMES.npcTrades,
)

// Agent tables
export const agentRegistries = createTableRef<SchemaTypes.AgentRegistry>(
  TABLE_NAMES.agentRegistries,
)
export const agentCapabilities = createTableRef<SchemaTypes.AgentCapability>(
  TABLE_NAMES.agentCapabilities,
)
export const agentLogs = createTableRef<SchemaTypes.AgentLog>(
  TABLE_NAMES.agentLogs,
)
export const agentMessages = createTableRef<SchemaTypes.AgentMessage>(
  TABLE_NAMES.agentMessages,
)
export const agentPerformanceMetrics =
  createTableRef<SchemaTypes.AgentPerformanceMetrics>(
    TABLE_NAMES.agentPerformanceMetrics,
  )
export const agentGoals = createTableRef<SchemaTypes.AgentGoal>(
  TABLE_NAMES.agentGoals,
)
export const agentGoalActions = createTableRef<SchemaTypes.AgentGoalAction>(
  TABLE_NAMES.agentGoalActions,
)
export const agentPointsTransactions =
  createTableRef<SchemaTypes.AgentPointsTransaction>(
    TABLE_NAMES.agentPointsTransactions,
  )
export const agentTrades = createTableRef<SchemaTypes.AgentTrade>(
  TABLE_NAMES.agentTrades,
)
export const externalAgentConnections =
  createTableRef<SchemaTypes.ExternalAgentConnection>(
    TABLE_NAMES.externalAgentConnections,
  )
export const userAgentConfigs = createTableRef<SchemaTypes.UserAgentConfig>(
  TABLE_NAMES.userAgentConfigs,
)

// Post tables
export const posts = createTableRef<SchemaTypes.Post>(TABLE_NAMES.posts)
export const comments = createTableRef<SchemaTypes.Comment>(
  TABLE_NAMES.comments,
)
export const reactions = createTableRef<SchemaTypes.Reaction>(
  TABLE_NAMES.reactions,
)
export const shares = createTableRef<SchemaTypes.Share>(TABLE_NAMES.shares)
export const shareActions = createTableRef<SchemaTypes.ShareAction>(
  TABLE_NAMES.shareActions,
)
export const tags = createTableRef<SchemaTypes.Tag>(TABLE_NAMES.tags)
export const postTags = createTableRef<SchemaTypes.PostTag>(
  TABLE_NAMES.postTags,
)
export const trendingTags = createTableRef<SchemaTypes.TrendingTag>(
  TABLE_NAMES.trendingTags,
)

// Market tables
export const markets = createTableRef<SchemaTypes.Market>(TABLE_NAMES.markets)
export const questions = createTableRef<SchemaTypes.Question>(
  TABLE_NAMES.questions,
)
export const positions = createTableRef<SchemaTypes.Position>(
  TABLE_NAMES.positions,
)
export const predictionPriceHistories =
  createTableRef<SchemaTypes.PredictionPriceHistory>(
    TABLE_NAMES.predictionPriceHistories,
  )
export const organizations = createTableRef<SchemaTypes.Organization>(
  TABLE_NAMES.organizations,
)
export const stockPrices = createTableRef<SchemaTypes.StockPrice>(
  TABLE_NAMES.stockPrices,
)
export const perpPositions = createTableRef<SchemaTypes.PerpPosition>(
  TABLE_NAMES.perpPositions,
)
export const perpMarketSnapshots =
  createTableRef<SchemaTypes.PerpMarketSnapshot>(
    TABLE_NAMES.perpMarketSnapshots,
  )
export const marketOutcomes = createTableRef<SchemaTypes.MarketOutcome>(
  TABLE_NAMES.marketOutcomes,
)

// Pool tables
export const pools = createTableRef<SchemaTypes.Pool>(TABLE_NAMES.pools)
export const poolPositions = createTableRef<SchemaTypes.PoolPosition>(
  TABLE_NAMES.poolPositions,
)
export const poolDeposits = createTableRef<SchemaTypes.PoolDeposit>(
  TABLE_NAMES.poolDeposits,
)

// Messaging tables
export const chats = createTableRef<SchemaTypes.Chat>(TABLE_NAMES.chats)
export const chatParticipants = createTableRef<SchemaTypes.ChatParticipant>(
  TABLE_NAMES.chatParticipants,
)
export const chatAdmins = createTableRef<SchemaTypes.ChatAdmin>(
  TABLE_NAMES.chatAdmins,
)
export const chatInvites = createTableRef<SchemaTypes.ChatInvite>(
  TABLE_NAMES.chatInvites,
)
export const messages = createTableRef<SchemaTypes.Message>(
  TABLE_NAMES.messages,
)
export const dmAcceptances = createTableRef<SchemaTypes.DMAcceptance>(
  TABLE_NAMES.dmAcceptances,
)
export const groupChatMemberships =
  createTableRef<SchemaTypes.GroupChatMembership>(
    TABLE_NAMES.groupChatMemberships,
  )
export const notifications = createTableRef<SchemaTypes.Notification>(
  TABLE_NAMES.notifications,
)
export const userGroups = createTableRef<SchemaTypes.UserGroup>(
  TABLE_NAMES.userGroups,
)
export const userGroupAdmins = createTableRef<SchemaTypes.UserGroupAdmin>(
  TABLE_NAMES.userGroupAdmins,
)
export const userGroupInvites = createTableRef<SchemaTypes.UserGroupInvite>(
  TABLE_NAMES.userGroupInvites,
)
export const userGroupMembers = createTableRef<SchemaTypes.UserGroupMember>(
  TABLE_NAMES.userGroupMembers,
)
export const pendingGroupInviteCandidates =
  createTableRef<SchemaTypes.PendingGroupInviteCandidate>(
    TABLE_NAMES.pendingGroupInviteCandidates,
  )
export const userMessagingKeys = createTableRef<SchemaTypes.UserMessagingKey>(
  TABLE_NAMES.userMessagingKeys,
)
export const messagingPreKeys = createTableRef<SchemaTypes.MessagingPreKey>(
  TABLE_NAMES.messagingPreKeys,
)
export const messageReceipts = createTableRef<SchemaTypes.MessageReceipt>(
  TABLE_NAMES.messageReceipts,
)

// Trading tables
export const tradingFees = createTableRef<SchemaTypes.TradingFee>(
  TABLE_NAMES.tradingFees,
)
export const balanceTransactions =
  createTableRef<SchemaTypes.BalanceTransaction>(
    TABLE_NAMES.balanceTransactions,
  )
export const pointsTransactions = createTableRef<SchemaTypes.PointsTransaction>(
  TABLE_NAMES.pointsTransactions,
)
export const feedbacks = createTableRef<SchemaTypes.Feedback>(
  TABLE_NAMES.feedbacks,
)
export const reports = createTableRef<SchemaTypes.Report>(TABLE_NAMES.reports)
export const moderationEscrows = createTableRef<SchemaTypes.ModerationEscrow>(
  TABLE_NAMES.moderationEscrows,
)

// Training tables
export const trajectories = createTableRef<SchemaTypes.Trajectory>(
  TABLE_NAMES.trajectories,
)
export const rewardJudgments = createTableRef<SchemaTypes.RewardJudgment>(
  TABLE_NAMES.rewardJudgments,
)
export const trainingBatches = createTableRef<SchemaTypes.TrainingBatch>(
  TABLE_NAMES.trainingBatches,
)
export const trainedModels = createTableRef<SchemaTypes.TrainedModel>(
  TABLE_NAMES.trainedModels,
)
export const benchmarkResults = createTableRef<SchemaTypes.BenchmarkResult>(
  TABLE_NAMES.benchmarkResults,
)
export const llmCallLogs = createTableRef<SchemaTypes.LlmCallLog>(
  TABLE_NAMES.llmCallLogs,
)

// Misc tables
export const games = createTableRef<SchemaTypes.Game>(TABLE_NAMES.games)
export const gameConfigs = createTableRef<SchemaTypes.GameConfig>(
  TABLE_NAMES.gameConfigs,
)
export const realtimeOutboxes = createTableRef<SchemaTypes.RealtimeOutbox>(
  TABLE_NAMES.realtimeOutboxes,
)
export const oAuthStates = createTableRef<SchemaTypes.OAuthState>(
  TABLE_NAMES.oAuthStates,
)
export const oracleCommitments = createTableRef<SchemaTypes.OracleCommitment>(
  TABLE_NAMES.oracleCommitments,
)
export const oracleTransactions = createTableRef<SchemaTypes.OracleTransaction>(
  TABLE_NAMES.oracleTransactions,
)
export const widgetCaches = createTableRef<SchemaTypes.WidgetCache>(
  TABLE_NAMES.widgetCaches,
)
export const worldEvents = createTableRef<SchemaTypes.WorldEvent>(
  TABLE_NAMES.worldEvents,
)
export const worldFacts = createTableRef<SchemaTypes.WorldFact>(
  TABLE_NAMES.worldFacts,
)
export const systemSettings = createTableRef<SchemaTypes.SystemSettings>(
  TABLE_NAMES.systemSettings,
)
export const generationLocks = createTableRef<SchemaTypes.GenerationLock>(
  TABLE_NAMES.generationLocks,
)
export const rssFeedSources = createTableRef<SchemaTypes.RSSFeedSource>(
  TABLE_NAMES.rssFeedSources,
)
export const rssHeadlines = createTableRef<SchemaTypes.RSSHeadline>(
  TABLE_NAMES.rssHeadlines,
)
export const parodyHeadlines = createTableRef<SchemaTypes.ParodyHeadline>(
  TABLE_NAMES.parodyHeadlines,
)
export const tickTokenStats = createTableRef<SchemaTypes.TickTokenStats>(
  TABLE_NAMES.tickTokenStats,
)
export const questionArcPlans = createTableRef<SchemaTypes.QuestionArcPlan>(
  TABLE_NAMES.questionArcPlans,
)

// State tables
export const organizationState =
  createTableRef<SchemaTypes.OrganizationStateRow>(
    TABLE_NAMES.organizationState,
  )

// Token tables (types not yet defined)
export const tokenBalances = createTableRef<SchemaTypes.TokenBalance>(
  TABLE_NAMES.tokenBalances,
)
export const tokenTransactions = createTableRef<SchemaTypes.TokenTransaction>(
  TABLE_NAMES.tokenTransactions,
)
export const airdropAllocations = createTableRef<SchemaTypes.AirdropAllocation>(
  TABLE_NAMES.airdropAllocations,
)
export const airdropClaims = createTableRef<SchemaTypes.AirdropClaim>(
  TABLE_NAMES.airdropClaims,
)
export const vestingSchedules = createTableRef<SchemaTypes.VestingSchedule>(
  TABLE_NAMES.vestingSchedules,
)
export const tokenDeployments = createTableRef<SchemaTypes.TokenDeployment>(
  TABLE_NAMES.tokenDeployments,
)
export const elizaHolders = createTableRef<SchemaTypes.ElizaHolder>(
  TABLE_NAMES.elizaHolders,
)
export const elizaHolderAllocations =
  createTableRef<SchemaTypes.ElizaHolderAllocation>(
    TABLE_NAMES.elizaHolderAllocations,
  )

// Engagement tables
export const dailyEngagement = createTableRef<SchemaTypes.DailyEngagement>(
  TABLE_NAMES.dailyEngagement,
)
export const feeAccumulator = createTableRef<SchemaTypes.FeeAccumulator>(
  TABLE_NAMES.feeAccumulator,
)
export const buybackRecords = createTableRef<SchemaTypes.BuybackRecord>(
  TABLE_NAMES.buybackRecords,
)
export const feeContributions = createTableRef<SchemaTypes.FeeContribution>(
  TABLE_NAMES.feeContributions,
)
