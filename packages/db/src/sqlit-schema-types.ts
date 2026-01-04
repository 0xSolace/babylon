/**
 * SQLit Schema Types for Babylon
 *
 * Type definitions for all database tables.
 * Re-exports from model-types.ts for backward compatibility.
 */

// Re-export all types from model-types
export type {
  ActorRef,
  AgentGoalWithActions,
  BalanceTransactionWithUser,
  Chat,
  ChatInvite,
  ChatParticipant,
  ChatWithParticipants,
  ChatWithParticipantsAndMessages,
  ChatWithRelations,
  Comment,
  ExternalAgentConnectionWithRegistry,
  Market,
  Message,
  MessageWithSender,
  ModerationEscrowWithRelations,
  Notification,
  PerpPosition,
  Pool,
  PoolPosition,
  PoolWithActorState,
  Position,
  Post,
  PostWithRelations,
  Question,
  Reaction,
  Report,
  TradingFeeWithUser,
  TrainedModel,
  TrainingBatch,
  Trajectory,
  User,
  UserInsert,
  UserWithAgentRelations,
  UserWithMetrics,
} from './model-types'

// Define missing types that index.ts expects
export interface ActorStateRow {
  id: string
  [key: string]: unknown
}

export interface AgentCapability {
  id: string
  agentId: string
  capability: string
  [key: string]: unknown
}

export interface AgentRegistry {
  id: string
  agentId: string
  [key: string]: unknown
}

export interface AgentTrade {
  id: string
  agentId: string
  marketId: string
  [key: string]: unknown
}

export interface BenchmarkResult {
  id: string
  modelId: string
  metric: string
  value: number
  [key: string]: unknown
}

export interface DailyEngagement {
  id: string
  userId: string
  date: string
  [key: string]: unknown
}

export interface ExternalAgentConnection {
  id: string
  userId: string
  agentId: string
  [key: string]: unknown
}

export interface Game {
  id: string
  name: string
  [key: string]: unknown
}

export interface GameConfig {
  id: string
  gameId: string
  [key: string]: unknown
}

export interface GroupChatMembership {
  id: string
  groupId: string
  userId: string
  [key: string]: unknown
}

export interface NewMarket {
  title: string
  description: string
  [key: string]: unknown
}

export interface NewPosition {
  marketId: string
  userId: string
  [key: string]: unknown
}

export interface NewPredictionPriceHistory {
  predictionId: string
  price: string
  [key: string]: unknown
}

export interface NPCTrade {
  id: string
  npcId: string
  [key: string]: unknown
}

export interface OrganizationStateRow {
  id: string
  [key: string]: unknown
}

export interface PredictionPriceHistory {
  id: string
  predictionId: string
  price: string
  [key: string]: unknown
}

export interface RSSHeadline {
  id: string
  title: string
  url: string
  [key: string]: unknown
}

export interface UserAgentConfig {
  id: string
  userId: string
  [key: string]: unknown
}

export interface UserApiKey {
  id: string
  userId: string
  key: string
  [key: string]: unknown
}

export interface WorldEvent {
  id: string
  title: string
  [key: string]: unknown
}

export interface WorldFact {
  id: string
  content: string
  [key: string]: unknown
}
