/**
 * Salience Scoring
 *
 * WHY SALIENCE EXISTS:
 * ===================
 * Not all memories are equally relevant right now. Consider:
 * - "User likes coffee" is salient when discussing drinks
 * - "User likes coffee" is not salient when debugging code
 *
 * Without salience, providers dump all memories into context, wasting tokens
 * and potentially confusing the agent with irrelevant information.
 *
 * HOW IT WORKS:
 * ============
 * Salience is calculated from multiple factors:
 * 1. RECENCY: Fresher memories are more salient
 * 2. RELEVANCE: Keyword/topic overlap with current context
 * 3. CONFIDENCE: Higher confidence = more salient
 * 4. INTERACTION: Memories involving current entity are more salient
 *
 * The final score determines:
 * - Which memories to include in provider output
 * - What order to show them (most salient first)
 * - Whether to show at all (below threshold = skip)
 */

import type { Memory } from '@elizaos/core';
import {
  calculateDecayMultiplier,
  DECAY_PRESETS,
  type DecayConfig,
} from './decay.ts';

// =============================================================================
// Salience Configuration
// =============================================================================

export interface SalienceConfig {
  /** Weight for recency factor (0-1) */
  recencyWeight: number;
  /** Weight for relevance factor (0-1) */
  relevanceWeight: number;
  /** Weight for confidence factor (0-1) */
  confidenceWeight: number;
  /** Weight for entity match factor (0-1) */
  entityMatchWeight: number;
  /** Minimum salience score to include in output (0-1) */
  threshold: number;
  /** Maximum memories to return (even if above threshold) */
  maxResults: number;
  /** Decay config for recency calculation */
  decayConfig: DecayConfig;
}

export const DEFAULT_SALIENCE_CONFIG: SalienceConfig = {
  recencyWeight: 0.3, // 30% weight on freshness
  relevanceWeight: 0.35, // 35% weight on topic match
  confidenceWeight: 0.2, // 20% weight on confidence
  entityMatchWeight: 0.15, // 15% weight on entity match
  threshold: 0.2, // Include if salience >= 20%
  maxResults: 10, // At most 10 memories
  decayConfig: DECAY_PRESETS.standard,
};

// =============================================================================
// Context for Salience Calculation
// =============================================================================

/**
 * Context provided for salience calculation.
 * WHY: Salience is relative—we need to know what's happening now.
 */
export interface SalienceContext {
  /** Current message being processed */
  message: Memory;
  /** Keywords from current context (extracted or provided) */
  keywords?: string[];
  /** Topics from current context */
  topics?: string[];
  /** Current entity ID (for entity match scoring) */
  entityId?: string;
  /** Current room ID */
  roomId?: string;
  /** Current timestamp (default: Date.now()) */
  now?: number;
}

// =============================================================================
// Salience Calculation
// =============================================================================

/**
 * Extract keywords from text for relevance matching.
 *
 * WHY SIMPLE EXTRACTION:
 * Full NLP is expensive. Simple word extraction + stopword removal
 * gets us 80% of the benefit at 1% of the cost.
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];

  // WHY THESE STOPWORDS: Common words that don't carry meaning.
  // Not exhaustive, but covers the most common cases.
  const stopwords = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'dare',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'as',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'and',
    'but',
    'or',
    'nor',
    'so',
    'yet',
    'both',
    'either',
    'neither',
    'not',
    'only',
    'own',
    'same',
    'than',
    'too',
    'very',
    'just',
    'i',
    'me',
    'my',
    'myself',
    'we',
    'our',
    'ours',
    'ourselves',
    'you',
    'your',
    'yours',
    'yourself',
    'yourselves',
    'he',
    'him',
    'his',
    'himself',
    'she',
    'her',
    'hers',
    'herself',
    'it',
    'its',
    'itself',
    'they',
    'them',
    'their',
    'theirs',
    'themselves',
    'what',
    'which',
    'who',
    'whom',
    'this',
    'that',
    'these',
    'those',
    'am',
    'if',
    'then',
    'because',
    'while',
    'although',
    'where',
    'when',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Remove punctuation
    .split(/\s+/) // Split on whitespace
    .filter((word) => word.length > 2 && !stopwords.has(word)) // Filter short/stop words
    .slice(0, 20); // Limit to prevent huge arrays
}

/**
 * Calculate keyword overlap between two sets.
 * Returns 0-1 score based on Jaccard similarity.
 */
function calculateKeywordOverlap(
  keywords1: string[],
  keywords2: string[]
): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);

  let intersection = 0;
  for (let i = 0; i < keywords1.length; i++) {
    if (set2.has(keywords1[i])) intersection++;
  }

  // WHY JACCARD: Handles different-sized sets fairly.
  // Union = |A| + |B| - |A∩B|
  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Calculate recency score (0-1) based on memory age.
 */
function calculateRecencyScore(
  createdAt: number | undefined,
  config: DecayConfig,
  now: number
): number {
  if (!createdAt) return 0.5; // Unknown age = neutral
  return calculateDecayMultiplier(now - createdAt, config);
}

/**
 * Calculate confidence score (0-1) from metadata.
 */
function calculateConfidenceScore(metadata: Record<string, unknown>): number {
  const confidence = metadata.confidence as number | undefined;
  if (confidence === undefined) return 0.5; // Unknown = neutral
  return confidence / 100; // Normalize 0-100 to 0-1
}

/**
 * Calculate entity match score (0 or 1).
 */
function calculateEntityMatchScore(
  memory: Memory,
  entityId: string | undefined
): number {
  if (!entityId) return 0.5; // No entity to match = neutral

  // Check both memory.entityId and metadata.entityId
  const metadata = memory.metadata as Record<string, unknown> | undefined;
  const metadataEntityId = metadata?.entityId as string | undefined;
  const memoryEntityId = memory.entityId || metadataEntityId;
  return memoryEntityId === entityId ? 1.0 : 0.0;
}

/**
 * Calculate relevance score (0-1) based on keyword/topic overlap.
 */
function calculateRelevanceScore(
  memory: Memory,
  contextKeywords: string[],
  contextTopics: string[]
): number {
  const metadata = (memory.metadata || {}) as Record<string, unknown>;

  // Extract memory keywords from various fields
  const memoryKeywords: string[] = [
    ...((metadata.keywords as string[]) || []),
    ...extractKeywords((metadata.title as string) || ''),
    ...extractKeywords((metadata.summary as string) || ''),
  ];

  const memoryTopics: string[] = (metadata.topics as string[]) || [];

  // Calculate both overlaps
  const keywordScore = calculateKeywordOverlap(contextKeywords, memoryKeywords);
  const topicScore = calculateKeywordOverlap(contextTopics, memoryTopics);

  // WHY WEIGHTED AVERAGE: Topics are more specific, so worth more.
  // But if no topics, fall back to keywords only.
  if (contextTopics.length > 0 && memoryTopics.length > 0) {
    return keywordScore * 0.4 + topicScore * 0.6;
  }
  return keywordScore;
}

/**
 * Calculate overall salience score for a memory.
 */
export function calculateSalience(
  memory: Memory,
  context: SalienceContext,
  config: SalienceConfig = DEFAULT_SALIENCE_CONFIG
): number {
  const now = context.now || Date.now();
  const metadata = memory.metadata || {};

  // Calculate component scores
  const recencyScore = calculateRecencyScore(
    memory.createdAt,
    config.decayConfig,
    now
  );

  // Extract context keywords if not provided
  const contextKeywords =
    context.keywords ||
    extractKeywords((context.message.content?.text as string) || '');
  const contextTopics = context.topics || [];

  const relevanceScore = calculateRelevanceScore(
    memory,
    contextKeywords,
    contextTopics
  );
  const confidenceScore = calculateConfidenceScore(
    metadata as Record<string, unknown>
  );
  const entityMatchScore = calculateEntityMatchScore(memory, context.entityId);

  // WHY WEIGHTED SUM: Different factors contribute differently.
  // Weights sum to 1.0 for normalized output.
  const salience =
    recencyScore * config.recencyWeight +
    relevanceScore * config.relevanceWeight +
    confidenceScore * config.confidenceWeight +
    entityMatchScore * config.entityMatchWeight;

  return Math.min(1, Math.max(0, salience)); // Clamp to 0-1
}

// =============================================================================
// Memory Filtering and Ranking
// =============================================================================

export interface ScoredMemory<T extends Memory = Memory> {
  memory: T;
  salience: number;
  components: {
    recency: number;
    relevance: number;
    confidence: number;
    entityMatch: number;
  };
}

/**
 * Score and rank memories by salience.
 *
 * WHY RETURN COMPONENTS:
 * Debugging. When a memory ranks unexpectedly, components show why.
 * "Oh, it ranked high because of entity match, not relevance."
 */
export function rankBySalience<T extends Memory>(
  memories: T[],
  context: SalienceContext,
  config: SalienceConfig = DEFAULT_SALIENCE_CONFIG
): ScoredMemory<T>[] {
  const now = context.now || Date.now();
  const contextKeywords =
    context.keywords ||
    extractKeywords((context.message.content?.text as string) || '');
  const contextTopics = context.topics || [];

  const scored: ScoredMemory<T>[] = memories.map((memory) => {
    const metadata = memory.metadata || {};

    const components = {
      recency: calculateRecencyScore(memory.createdAt, config.decayConfig, now),
      relevance: calculateRelevanceScore(
        memory,
        contextKeywords,
        contextTopics
      ),
      confidence: calculateConfidenceScore(metadata as Record<string, unknown>),
      entityMatch: calculateEntityMatchScore(memory, context.entityId),
    };

    const salience =
      components.recency * config.recencyWeight +
      components.relevance * config.relevanceWeight +
      components.confidence * config.confidenceWeight +
      components.entityMatch * config.entityMatchWeight;

    return {
      memory,
      salience: Math.min(1, Math.max(0, salience)),
      components,
    };
  });

  // Sort by salience descending
  scored.sort((a, b) => b.salience - a.salience);

  return scored;
}

/**
 * Filter memories by salience threshold and limit.
 *
 * WHY SEPARATE FROM RANK:
 * Sometimes you want all scored memories (for debugging).
 * Sometimes you want filtered results (for provider output).
 */
export function filterBySalience<T extends Memory>(
  memories: T[],
  context: SalienceContext,
  config: SalienceConfig = DEFAULT_SALIENCE_CONFIG
): T[] {
  const ranked = rankBySalience(memories, context, config);

  return ranked
    .filter((scored) => scored.salience >= config.threshold)
    .slice(0, config.maxResults)
    .map((scored) => scored.memory);
}

/**
 * Get salience label for display.
 */
export function getSalienceLabel(salience: number): string {
  if (salience >= 0.8) return 'highly relevant';
  if (salience >= 0.6) return 'relevant';
  if (salience >= 0.4) return 'somewhat relevant';
  if (salience >= 0.2) return 'marginally relevant';
  return 'not relevant';
}
