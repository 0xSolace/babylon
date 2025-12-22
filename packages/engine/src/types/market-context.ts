/**
 * Market Context Types
 *
 * Types for providing market information to NPCs for trading decisions.
 * Uses z.infer<> from @babylon/shared to avoid duplicate type definitions.
 */

import type {
  EventContextSchema,
  FeedPostContextSchema,
  GroupChatContextSchema,
  MarketSignalContextSchema,
  NPCMarketContextSchema,
  NPCPositionSchema,
  PerpMarketSnapshotSchema,
  PredictionMarketSnapshotSchema,
  RelationshipContextSchema,
} from '@babylon/shared';
import type { z } from 'zod';

// Re-export types derived from Zod schemas
export type PerpMarketSnapshot = z.infer<typeof PerpMarketSnapshotSchema>;
export type PredictionMarketSnapshot = z.infer<
  typeof PredictionMarketSnapshotSchema
>;
export type NPCPosition = z.infer<typeof NPCPositionSchema>;
export type FeedPostContext = z.infer<typeof FeedPostContextSchema>;
export type GroupChatContext = z.infer<typeof GroupChatContextSchema>;
export type EventContext = z.infer<typeof EventContextSchema>;
export type RelationshipContext = z.infer<typeof RelationshipContextSchema>;
export type MarketSignalContext = z.infer<typeof MarketSignalContextSchema>;
export type NPCMarketContext = z.infer<typeof NPCMarketContextSchema>;

// Additional types not in shared schemas
export interface NewsArticleContext {
  author: string;
  authorName: string;
  title: string;
  summary: string;
  timestamp: string;
}

export interface MarketSnapshots {
  perps: PerpMarketSnapshot[];
  predictions: PredictionMarketSnapshot[];
  timestamp: string;
}
