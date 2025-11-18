/**
 * Market Context Types
 *
 * Types for providing market information to NPCs for trading decisions
 */

import type { MarketType } from './market-decisions';

export type PerpMarketSnapshot = {
  ticker: string;
  organizationId: string;
  name: string;
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
};

export type PredictionMarketSnapshot = {
  id: string; // Market ID is a Snowflake string, not an integer
  text: string;
  yesPrice: number;
  noPrice: number;
  totalVolume: number;
  resolutionDate: string;
  daysUntilResolution: number;
};

export type NPCPosition = {
  id: string;
  marketType: MarketType;
  ticker?: string;
  marketId?: string; // Market ID is a Snowflake string, not an integer
  side: string;
  entryPrice: number;
  currentPrice: number;
  size: number;
  shares?: number;
  unrealizedPnL: number;
  openedAt: string;
};

export type FeedPostContext = {
  author: string;
  authorName: string;
  content: string;
  timestamp: string;
  articleTitle?: string;
};

export type GroupChatContext = {
  chatId: string;
  chatName: string;
  from: string;
  fromName: string;
  message: string;
  timestamp: string;
};

export type EventContext = {
  type: string;
  description: string;
  timestamp: string;
  relatedQuestion?: number;
  pointsToward?: string;
  actors?: string[];
};

export type NewsArticleContext = {
  author: string;
  authorName: string;
  title: string;
  summary: string;
  timestamp: string;
};

export type RelationshipContext = {
  actorId: string;
  actorName: string;
  relationshipType: string;
  strength: number;
  sentiment: number;
  history?: string;
};

export type NPCMarketContext = {
  // NPC identity
  npcId: string;
  npcName: string;
  personality: string;
  tier: string;
  availableBalance: number;

  // Information sources
  recentPosts: FeedPostContext[];
  groupChatMessages: GroupChatContext[];
  recentEvents: EventContext[];

  // Relationships with other actors
  relationships?: RelationshipContext[];

  // Market data
  perpMarkets: PerpMarketSnapshot[];
  predictionMarkets: PredictionMarketSnapshot[];

  // Current positions
  currentPositions: NPCPosition[];
};

export type MarketSnapshots = {
  perps: PerpMarketSnapshot[];
  predictions: PredictionMarketSnapshot[];
  timestamp: string;
};
