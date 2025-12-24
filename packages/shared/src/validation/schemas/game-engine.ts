import { z } from 'zod'
import { FeedPostSchema } from './api-responses'

export const ActorTierSchema = z.enum([
  'S_TIER',
  'A_TIER',
  'B_TIER',
  'C_TIER',
  'D_TIER',
])

export const ActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  profileDescription: z.string().optional(),
  domain: z.array(z.string()).optional(),
  personality: z.string().optional(),
  voice: z.string().optional(),
  role: z.string().optional(),
  affiliations: z.array(z.string()).optional(),
  postStyle: z.string().optional(),
  postExample: z.array(z.string()).optional(),
  tier: ActorTierSchema.optional(),
  initialLuck: z.enum(['low', 'medium', 'high']).optional(),
  initialMood: z.number().min(-1).max(1).optional(),
  hasPool: z.boolean().optional(),
  tradingBalance: z.number().optional(),
  reputationPoints: z.number().optional(),
  profileImageUrl: z.string().optional(),
  persona: z
    .object({
      reliability: z.number().min(0).max(1),
      insiderOrgs: z.array(z.string()),
      expertise: z.array(z.string()),
      willingToLie: z.boolean(),
      selfInterest: z.enum(['wealth', 'reputation', 'ideology', 'chaos']),
      favorsActors: z.array(z.string()),
      opposesActors: z.array(z.string()),
      favorsOrgs: z.array(z.string()),
      opposesOrgs: z.array(z.string()),
    })
    .optional(),
  trackRecord: z
    .object({
      totalPosts: z.number(),
      accuratePosts: z.number(),
      historicalAccuracy: z.number(),
    })
    .optional(),
})

export const SelectedActorSchema = ActorSchema.extend({
  tier: ActorTierSchema,
  role: z.string(),
  initialLuck: z.enum(['low', 'medium', 'high']),
  initialMood: z.number().min(-1).max(1),
})

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  ticker: z.string().optional(),
  description: z.string(),
  profileDescription: z.string().optional(),
  type: z.enum([
    'company',
    'media',
    'government',
    'vc',
    'organization',
    'financial',
  ]),
  canBeInvolved: z.boolean(),
  postStyle: z.string().optional(),
  postExample: z.array(z.string()).optional(),
  initialPrice: z.number().optional(),
  currentPrice: z.number().optional(),
  priceHistory: z
    .array(
      z.object({
        price: z.number(),
        timestamp: z.string(),
        change: z.number(),
        changePercent: z.number(),
      }),
    )
    .optional(),
  markovState: z
    .object({
      trend: z.enum(['bullish', 'bearish', 'neutral']),
      volatility: z.number().min(0).max(1),
      momentum: z.number().min(-1).max(1),
    })
    .optional(),
  originalName: z.string().optional(),
  originalHandle: z.string().optional(),
  username: z.string().optional(),
  pfpDescription: z.string().optional(),
  bannerDescription: z.string().optional(),
})

export const ScenarioSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  mainActors: z.array(z.string()),
  involvedOrganizations: z.array(z.string()).optional(),
  theme: z.string(),
})

export const QuestionSchema = z.object({
  id: z.union([z.number(), z.string()]),
  text: z.string(),
  scenario: z.number(),
  outcome: z.boolean(),
  rank: z.number(),
  createdDate: z.string().optional(),
  resolutionDate: z.string().optional(),
  status: z.enum(['active', 'resolved', 'cancelled']).optional(),
  resolvedOutcome: z.boolean().optional(),
  resolutionProofUrl: z.string().optional(),
  resolutionDescription: z.string().optional(),
  timeframe: z.string().optional(),
  questionNumber: z.number().optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
  updatedAt: z.union([z.date(), z.string()]).optional(),
  scenarioId: z.number().optional(),
  metadata: z
    .object({
      arcPlan: z
        .object({
          uncertaintyPeakDay: z.number(),
          clarityOnsetDay: z.number(),
          verificationDay: z.number(),
          insiders: z.array(z.string()),
          deceivers: z.array(z.string()),
        })
        .optional(),
    })
    .optional(),
})

export const WorldEventSchema = z.object({
  id: z.string(),
  day: z.number(),
  type: z.enum([
    'announcement',
    'meeting',
    'leak',
    'development',
    'scandal',
    'rumor',
    'deal',
    'conflict',
    'revelation',
    'development:occurred',
    'news:published',
  ]),
  actors: z.array(z.string()),
  description: z.string(),
  relatedQuestion: z.number().nullable().optional(),
  pointsToward: z.enum(['YES', 'NO']).nullable().optional(),
  visibility: z.enum(['public', 'leaked', 'secret', 'private', 'group']),
  sentimentSignal: z.number().min(-1).max(1).optional(),
  signalClarity: z.number().min(0).max(1).optional(),
  sourceReliability: z.number().min(0).max(1).optional(),
})

export const GroupChatMessageSchema = z.object({
  from: z.string(),
  message: z.string(),
  timestamp: z.string(),
  clueStrength: z.number(),
})

export const GroupChatSchema = z.object({
  id: z.string(),
  name: z.string(),
  admin: z.string(),
  members: z.array(z.string()),
  theme: z.string(),
})

// FeedPostSchema is imported from api-responses.ts to avoid duplication

export const LuckChangeSchema = z.object({
  actor: z.string(),
  from: z.string(),
  to: z.string(),
  reason: z.string(),
})

export const MoodChangeSchema = z.object({
  actor: z.string(),
  from: z.number(),
  to: z.number(),
  reason: z.string(),
})

export const DayTimelineSchema = z.object({
  day: z.number(),
  summary: z.string(),
  events: z.array(WorldEventSchema),
  groupChats: z.record(z.string(), z.array(GroupChatMessageSchema)),
  feedPosts: z.array(FeedPostSchema),
  luckChanges: z.array(LuckChangeSchema),
  moodChanges: z.array(MoodChangeSchema),
})

export const QuestionOutcomeSchema = z.object({
  questionId: z.union([z.number(), z.string()]),
  answer: z.boolean(),
  explanation: z.string(),
  keyEvents: z.array(z.string()),
})

export const GameResolutionSchema = z.object({
  day: z.literal(30),
  outcomes: z.array(QuestionOutcomeSchema),
  finalNarrative: z.string(),
})

export const GameSetupSchema = z.object({
  mainActors: z.array(SelectedActorSchema),
  supportingActors: z.array(SelectedActorSchema),
  extras: z.array(SelectedActorSchema),
  organizations: z.array(OrganizationSchema),
  scenarios: z.array(ScenarioSchema),
  questions: z.array(QuestionSchema),
  groupChats: z.array(GroupChatSchema),
  connections: z.array(
    z.object({
      actor1: z.string(),
      actor2: z.string(),
      relationship: z.string(),
      context: z.string(),
    }),
  ),
})

export const GeneratedGameSchema = z.object({
  id: z.string(),
  version: z.string(),
  generatedAt: z.string(),
  setup: GameSetupSchema,
  timeline: z.array(DayTimelineSchema),
  resolution: GameResolutionSchema,
  gameState: z
    .object({
      id: z.string(),
      currentDay: z.number(),
      currentDate: z.string(),
      activeQuestions: z.array(QuestionSchema),
      resolvedQuestions: z.array(QuestionSchema),
      organizations: z.array(OrganizationSchema),
      priceUpdates: z.array(
        z.object({
          organizationId: z.string(),
          timestamp: z.string(),
          oldPrice: z.number(),
          newPrice: z.number(),
          change: z.number(),
          changePercent: z.number(),
          reason: z.string(),
          impact: z.enum(['major', 'moderate', 'minor']),
        }),
      ),
      lastGeneratedDate: z.string(),
    })
    .optional(),
})

export const QuestionInputSchema = z.object({
  text: z.string(),
  resolutionDate: z.union([z.date(), z.string()]),
  scenarioId: z.number().optional(),
})

export const PostInputSchema = z.object({
  authorId: z.string(),
  content: z.string(),
  type: z.enum(['post', 'article', 'reply']),
  timestamp: z.union([z.date(), z.string()]),
})

export const EventInputSchema = z.object({
  type: z.string(),
  description: z.string(),
  day: z.number(),
  hour: z.number(),
  actors: z.array(z.string()),
  visibility: z.enum(['public', 'leaked', 'private']),
  pointsToward: z.enum(['YES', 'NO']).optional(),
  relatedQuestion: z.number().optional(),
})

export const ArticleInputSchema = z.object({
  title: z.string(),
  content: z.string(),
  summary: z.string(),
  authorOrgId: z.string(),
  timestamp: z.union([z.date(), z.string()]),
  category: z.string().optional(),
})

export const TradeInputSchema = z.object({
  actorId: z.string(),
  marketId: z.string(),
  side: z.enum(['YES', 'NO']),
  amount: z.number(),
})

export const MarketActionSchema = z.enum([
  'open_long',
  'open_short',
  'buy_yes',
  'buy_no',
  'close_position',
  'hold',
])

export const MarketTypeSchema = z.enum(['perp', 'prediction'])

export const TradingDecisionSchema = z.object({
  npcId: z.string(),
  npcName: z.string(),
  action: MarketActionSchema,
  marketType: MarketTypeSchema.nullable(),
  ticker: z.string().optional(),
  marketId: z.string().optional(),
  positionId: z.string().optional(),
  amount: z.number(),
  confidence: z.number(),
  reasoning: z.string(),
  timestamp: z.string().optional(),
})

export const ExecutedTradeSchema = z.object({
  npcId: z.string(),
  npcName: z.string(),
  poolId: z.string(),
  marketType: MarketTypeSchema,
  ticker: z.string().optional().nullable(),
  marketId: z.string().optional().nullable(),
  action: MarketActionSchema,
  side: z.string(),
  amount: z.number(),
  size: z.number(),
  shares: z.number().optional(),
  executionPrice: z.number(),
  confidence: z.number(),
  reasoning: z.string(),
  positionId: z.string(),
  timestamp: z.string(),
})

export const ArticleSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  summary: z.string().min(1),
  content: z.string().min(100),
  authorOrgId: z.string(),
  authorOrgName: z.string(),
  byline: z.string().optional(),
  bylineActorId: z.string().optional(),
  biasScore: z.number().optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  slant: z.string().optional(),
  imageUrl: z.string().optional(),
  relatedEventId: z.string().optional(),
  relatedQuestion: z.number().optional(),
  relatedActorIds: z.array(z.string()),
  relatedOrgIds: z.array(z.string()),
  category: z.string().optional(),
  tags: z.array(z.string()),
  publishedAt: z.union([z.date(), z.string()]),
})

// Market context schemas for NPC trading decisions

export const PerpMarketSnapshotSchema = z.object({
  ticker: z.string(),
  organizationId: z.string(),
  name: z.string(),
  currentPrice: z.number(),
  change24h: z.number(),
  changePercent24h: z.number(),
  high24h: z.number(),
  low24h: z.number(),
  volume24h: z.number(),
  openInterest: z.number(),
})

export const PredictionMarketSnapshotSchema = z.object({
  id: z.union([z.number(), z.string()]), // Can be number or string (snowflake ID)
  text: z.string(),
  yesPrice: z.number(),
  noPrice: z.number(),
  totalVolume: z.number(),
  resolutionDate: z.string(),
  daysUntilResolution: z.number(),
})

export const NPCPositionSchema = z.object({
  id: z.string(),
  marketType: MarketTypeSchema,
  ticker: z.string().optional(),
  marketId: z.union([z.number(), z.string()]).optional(), // Can be number or string
  side: z.string(),
  entryPrice: z.number(),
  currentPrice: z.number(),
  size: z.number(),
  shares: z.number().optional(),
  unrealizedPnL: z.number(),
  openedAt: z.string(),
})

export const FeedPostContextSchema = z.object({
  author: z.string(),
  authorName: z.string(),
  content: z.string(),
  timestamp: z.string(),
  articleTitle: z.string().optional(),
})

export const GroupChatContextSchema = z.object({
  chatId: z.string(),
  chatName: z.string(),
  from: z.string(),
  fromName: z.string(),
  message: z.string(),
  timestamp: z.string(),
})

export const EventContextSchema = z.object({
  type: z.string(),
  description: z.string(),
  timestamp: z.string(),
  relatedQuestion: z.number().optional(),
  pointsToward: z.string().optional(),
  actors: z.array(z.string()).optional(),
})

export const RelationshipContextSchema = z.object({
  actorId: z.string(),
  actorName: z.string(),
  relationshipType: z.string(),
  strength: z.number(),
  sentiment: z.number(),
  history: z.string().optional(),
})

export const MarketSignalContextSchema = z.object({
  marketId: z.string(),
  yesSignal: z.number(),
  noSignal: z.number(),
  netSignal: z.number(),
  strength: z.number(),
  suggestedOutcome: z.enum(['YES', 'NO', 'UNCERTAIN']),
  confidence: z.number(),
})

export const NPCMarketContextSchema = z.object({
  npcId: z.string(),
  npcName: z.string(),
  personality: z.string(),
  tier: z.string(),
  availableBalance: z.number(),
  recentPosts: z.array(FeedPostContextSchema),
  groupChatMessages: z.array(GroupChatContextSchema),
  recentEvents: z.array(EventContextSchema),
  relationships: z.array(RelationshipContextSchema).optional(),
  perpMarkets: z.array(PerpMarketSnapshotSchema),
  predictionMarkets: z.array(PredictionMarketSnapshotSchema),
  currentPositions: z.array(NPCPositionSchema),
  marketSignals: z.array(MarketSignalContextSchema).optional(),
})

export const TradingExecutionResultSchema = z.object({
  totalDecisions: z.number(),
  successfulTrades: z.number(),
  failedTrades: z.number(),
  holdDecisions: z.number(),
  totalVolumePerp: z.number(),
  totalVolumePrediction: z.number(),
  errors: z.array(
    z.object({
      npcId: z.string(),
      decision: TradingDecisionSchema,
      error: z.string(),
    }),
  ),
  executedTrades: z.array(ExecutedTradeSchema),
})

// Trending topics schema for LLM response validation

export const TrendingTopicSchema = z.object({
  trendName: z.string(),
  description: z.string(),
})

export const TrendingTopicsResponseSchema = z.object({
  trends: z.array(TrendingTopicSchema),
})

// Relationship evolution schema for LLM response validation

export const RelationshipDescriptionSchema = z.object({
  description: z.string(),
  type: z.string(),
  sentiment: z.number(),
})

// Type exports
// Note: Core game types (Actor, Organization, Scenario, Question, etc.) are exported
// from game-types.ts as interfaces. These schemas are for runtime validation only.
// Only export NEW types that don't exist in game-types.ts.

// Input types for API/validation
export type QuestionInput = z.infer<typeof QuestionInputSchema>
export type PostInput = z.infer<typeof PostInputSchema>
export type EventInput = z.infer<typeof EventInputSchema>
export type ArticleInput = z.infer<typeof ArticleInputSchema>
export type TradeInput = z.infer<typeof TradeInputSchema>

// Market/trading types (not in game-types.ts)
export type MarketAction = z.infer<typeof MarketActionSchema>
export type MarketType = z.infer<typeof MarketTypeSchema>
export type TradingDecision = z.infer<typeof TradingDecisionSchema>
export type ExecutedTrade = z.infer<typeof ExecutedTradeSchema>

// Market context types for NPC trading (not in game-types.ts)
export type PerpMarketSnapshot = z.infer<typeof PerpMarketSnapshotSchema>
export type PredictionMarketSnapshot = z.infer<
  typeof PredictionMarketSnapshotSchema
>
export type NPCPosition = z.infer<typeof NPCPositionSchema>
export type FeedPostContext = z.infer<typeof FeedPostContextSchema>
export type GroupChatContext = z.infer<typeof GroupChatContextSchema>
export type EventContext = z.infer<typeof EventContextSchema>
export type RelationshipContext = z.infer<typeof RelationshipContextSchema>
export type MarketSignalContext = z.infer<typeof MarketSignalContextSchema>
export type NPCMarketContext = z.infer<typeof NPCMarketContextSchema>
export type TradingExecutionResult = z.infer<
  typeof TradingExecutionResultSchema
>

// LLM response validation types
export type TrendingTopic = z.infer<typeof TrendingTopicSchema>
export type TrendingTopicsResponse = z.infer<
  typeof TrendingTopicsResponseSchema
>
export type RelationshipDescription = z.infer<
  typeof RelationshipDescriptionSchema
>
