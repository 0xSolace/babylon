/**
 * Narrative Beat Registry
 *
 * Tracks which topic/angle combinations have already been covered by NPCs
 * within the current 30-minute posting cycle. Prevents multiple NPCs from
 * posting about the same event from the same angle within a single cycle
 * (the "NPC slop" problem).
 *
 * ## Design
 *
 * Redis Set per 30-min window keyed by `npc:beats:{windowKey}`.
 * Values are `{topicKey}::{worldEventId|none}::{angle}` strings.
 * TTL: 2 hours (covers several windows for graceful overlap).
 *
 * Angle vocabulary (exhaustive set — 6 angles):
 *   bullish | bearish | skeptical | concerned | defensive | observational
 *
 * If all angles are saturated for a topic, the NPC should skip that topic
 * and post about something else.
 *
 * ## Graceful degradation
 *
 * No-ops when Redis is unavailable. The service is injected from the app
 * layer via `setNarrativeBeatRedis()` to avoid a direct @babylon/api dependency
 * in the engine package.
 *
 * @module services/narrative-beat-registry
 */

import { logger } from '@babylon/shared';

/**
 * Minimal Redis interface needed by this service.
 */
export interface NarrativeBeatRedisClient {
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<number>;
}

let redisClient: NarrativeBeatRedisClient | null = null;

/**
 * Inject a Redis client. Called once at startup from ensure-engine-services.ts.
 * Safe to skip — service degrades gracefully to no-op mode.
 */
export function setNarrativeBeatRedis(client: NarrativeBeatRedisClient): void {
  redisClient = client;
}

/**
 * All recognised posting angles. When all 6 are covered for a topic,
 * the topic is considered saturated for this cycle.
 */
export const ANGLE_VOCAB = [
  'bullish',
  'bearish',
  'skeptical',
  'concerned',
  'defensive',
  'observational',
] as const;

export type PostingAngle = (typeof ANGLE_VOCAB)[number];

/** Redis key TTL — 2 hours covers several 30-min windows */
const BEAT_TTL_S = 2 * 60 * 60;

/**
 * Returns the Redis key for the current 30-minute window.
 * Aligned to wall-clock 30-min boundaries so all instances share the same key.
 */
function currentWindowKey(): string {
  const now = Date.now();
  const windowStart = Math.floor(now / (30 * 60 * 1000)) * (30 * 60 * 1000);
  return `npc:beats:${windowStart}`;
}

/**
 * Builds the set member string for a topic + event + angle combination.
 */
function beatMember(
  topicKey: string,
  worldEventId: string | null,
  angle: string
): string {
  return `${topicKey}::${worldEventId ?? 'none'}::${angle}`;
}

/**
 * Returns the set of angles already covered for a topic in the current window.
 * Returns empty Set when Redis is unavailable (no-op degradation).
 */
export async function getCoveredAngles(
  topicKey: string,
  worldEventId?: string | null
): Promise<Set<string>> {
  if (!redisClient) return new Set();
  try {
    const key = currentWindowKey();
    const members = await redisClient.smembers(key);
    const prefix = `${topicKey}::${worldEventId ?? 'none'}::`;
    const angles = new Set<string>();
    for (const member of members) {
      if (member.startsWith(prefix)) {
        const angle = member.slice(prefix.length);
        if (angle) angles.add(angle);
      }
    }
    return angles;
  } catch (error) {
    logger.warn(
      'NarrativeBeatRegistry: getCoveredAngles failed, defaulting to empty',
      { error: error instanceof Error ? error.message : String(error) },
      'NarrativeBeatRegistry'
    );
    return new Set();
  }
}

/**
 * Records a beat (topic + event + angle) in the current window.
 * Fire-and-forget — errors are logged but do not throw.
 */
export async function registerBeat(
  topicKey: string,
  worldEventId: string | null,
  angle: string
): Promise<void> {
  if (!redisClient) return;
  try {
    const key = currentWindowKey();
    const member = beatMember(topicKey, worldEventId, angle);
    await redisClient.sadd(key, member);
    await redisClient.expire(key, BEAT_TTL_S);
  } catch (error) {
    logger.warn(
      'NarrativeBeatRegistry: registerBeat failed',
      { error: error instanceof Error ? error.message : String(error) },
      'NarrativeBeatRegistry'
    );
  }
}

/**
 * Returns a prompt context string instructing the NPC to take a different
 * angle than the ones already covered this cycle.
 * Returns undefined when no angles are covered yet.
 */
export function buildCoveredAnglesContext(
  coveredAngles: Set<string>
): string | undefined {
  if (coveredAngles.size === 0) return undefined;
  return `Covered angles this cycle: ${[...coveredAngles].join(', ')}. Take a DIFFERENT angle in your post.`;
}
