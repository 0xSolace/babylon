import { z } from 'zod';

export const ActorTierSchema = z.enum([
  'S_TIER',
  'A_TIER',
  'B_TIER',
  'C_TIER',
  'D_TIER',
]);

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
});

export const SelectedActorSchema = ActorSchema.extend({
  tier: ActorTierSchema,
  role: z.string(),
  initialLuck: z.enum(['low', 'medium', 'high']),
  initialMood: z.number().min(-1).max(1),
});

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
      })
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
});

export const ScenarioSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  mainActors: z.array(z.string()),
  involvedOrganizations: z.array(z.string()).optional(),
  theme: z.string(),
});

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
});

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
});

export const GroupChatMessageSchema = z.object({
  from: z.string(),
  message: z.string(),
  timestamp: z.string(),
  clueStrength: z.number(),
});

export const GroupChatSchema = z.object({
  id: z.string(),
  name: z.string(),
  admin: z.string(),
  members: z.array(z.string()),
  theme: z.string(),
});

export const FeedPostSchema = z.object({
  id: z.string(),
  day: z.number().optional(),
  timestamp: z.string(),
  createdAt: z.string().optional(),
  type: z.string().optional(), // PostType
  content: z.string(),
  fullContent: z.string().nullable().optional(),
  articleTitle: z.string().nullable().optional(),
  byline: z.string().nullable().optional(),
  biasScore: z.number().nullable().optional(),
  sentiment: z.number().nullable().optional(),
  slant: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  author: z.string(),
  authorId: z.string().optional(),
  authorName: z.string(),
  authorUsername: z.string().nullable().optional(),
  authorProfileImageUrl: z.string().nullable().optional(),
  replyTo: z.string().optional(),
  relatedQuestion: z.number().optional(),
  relatedEvent: z.string().nullable().optional(),
  gameId: z.string().nullable().optional(),
  dayNumber: z.number().nullable().optional(),
  clueStrength: z.number().optional(),
  pointsToward: z.boolean().nullable().optional(),
  likeCount: z.number().optional(),
  commentCount: z.number().optional(),
  shareCount: z.number().optional(),
  isLiked: z.boolean().optional(),
  isShared: z.boolean().optional(),
  isRepost: z.boolean().optional(),
  isQuote: z.boolean().optional(),
  quoteComment: z.string().nullable().optional(),
  originalPostId: z.string().nullable().optional(),
  // originalPost: ... (recursive, simplified for now)
  originalAuthorId: z.string().nullable().optional(),
  originalAuthorName: z.string().nullable().optional(),
  originalAuthorUsername: z.string().nullable().optional(),
  originalAuthorProfileImageUrl: z.string().nullable().optional(),
  originalContent: z.string().nullable().optional(),
});

export const LuckChangeSchema = z.object({
  actor: z.string(),
  from: z.string(),
  to: z.string(),
  reason: z.string(),
});

export const MoodChangeSchema = z.object({
  actor: z.string(),
  from: z.number(),
  to: z.number(),
  reason: z.string(),
});

export const DayTimelineSchema = z.object({
  day: z.number(),
  summary: z.string(),
  events: z.array(WorldEventSchema),
  groupChats: z.record(z.array(GroupChatMessageSchema)),
  feedPosts: z.array(FeedPostSchema),
  luckChanges: z.array(LuckChangeSchema),
  moodChanges: z.array(MoodChangeSchema),
});

export const QuestionOutcomeSchema = z.object({
  questionId: z.union([z.number(), z.string()]),
  answer: z.boolean(),
  explanation: z.string(),
  keyEvents: z.array(z.string()),
});

export const GameResolutionSchema = z.object({
  day: z.literal(30),
  outcomes: z.array(QuestionOutcomeSchema),
  finalNarrative: z.string(),
});

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
    })
  ),
});

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
        })
      ),
      lastGeneratedDate: z.string(),
    })
    .optional(),
});

export const QuestionInputSchema = z.object({
  text: z.string(),
  resolutionDate: z.union([z.date(), z.string()]),
  scenarioId: z.number().optional(),
});

export const PostInputSchema = z.object({
  authorId: z.string(),
  content: z.string(),
  type: z.enum(['post', 'article', 'reply']),
  timestamp: z.union([z.date(), z.string()]),
});

export const EventInputSchema = z.object({
  type: z.string(),
  description: z.string(),
  day: z.number(),
  hour: z.number(),
  actors: z.array(z.string()),
  visibility: z.enum(['public', 'leaked', 'private']),
  pointsToward: z.enum(['YES', 'NO']).optional(),
  relatedQuestion: z.number().optional(),
});

export const ArticleInputSchema = z.object({
  title: z.string(),
  content: z.string(),
  summary: z.string(),
  authorOrgId: z.string(),
  timestamp: z.union([z.date(), z.string()]),
  category: z.string().optional(),
});

export const TradeInputSchema = z.object({
  actorId: z.string(),
  marketId: z.string(),
  side: z.enum(['YES', 'NO']),
  amount: z.number(),
});

export const MarketActionSchema = z.enum([
  'open_long',
  'open_short',
  'buy_yes',
  'buy_no',
  'close_position',
  'hold',
]);

export const MarketTypeSchema = z.enum(['perp', 'prediction']);

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
});

export const ExecutedTradeSchema = z.object({
  npcId: z.string(),
  npcName: z.string(),
  poolId: z.string(),
  marketType: MarketTypeSchema,
  ticker: z.string().optional(),
  marketId: z.string().optional(),
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
});

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
});
