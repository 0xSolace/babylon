/**
 * NPC Memory Service
 *
 * Manages bounded, summarized memory for NPCs to provide continuity.
 * Memories are stored in actorState.recentMemories (JSONB column).
 * Memory is capped at MAX_MEMORIES entries, with oldest evicted first.
 *
 * Uses optimistic locking with retry to prevent race conditions
 * when multiple concurrent updates occur.
 */

import {
  fetchActorStateRecentMemoriesJson,
  fetchActorStateRelationshipsJson,
  type NpcMemory,
  type RelationshipState,
  runNpcActivityStateUpdateTransaction,
  runNpcMemoryAddTransaction,
  runNpcRelationshipUpdateTransaction,
} from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';
import { first } from '../utils/array-utils';
import { getGameDayNumber } from '../utils/date-utils';
import { formatError } from '../utils/error-utils';
import { parseMemoriesSafe, parseRelationshipsSafe } from './jsonb-validators';

/**
 * Maximum memories per NPC before oldest are evicted.
 * 50 memories balances context richness against:
 * - LLM token limits (~4K tokens for memory context)
 * - Prompt latency (more memories = slower inference)
 * - Memory relevance decay (older memories less useful)
 * At ~80 tokens/memory, 50 memories ≈ 4000 tokens.
 */
const MAX_MEMORIES = 50;

/**
 * Maximum relationship notes per actor pair.
 * 10 notes captures recent interaction patterns while:
 * - Keeping JSONB column size manageable
 * - Maintaining relevance (oldest notes less meaningful)
 * - Balancing read/write performance
 */
const MAX_RELATIONSHIP_NOTES = 10;

/**
 * Maximum retries for optimistic locking conflicts.
 * 3 retries with exponential backoff handles:
 * - Typical contention during concurrent NPC ticks
 * - Total max wait: 50 + 100 + 200 = 350ms
 * - Avoids excessive delays while ensuring eventual success
 */
const MAX_RETRIES = 3;

/**
 * Base delay between retries (doubles each attempt).
 * 50ms base yields 50ms, 100ms, 200ms backoff sequence.
 */
const RETRY_BASE_DELAY_MS = 50;

/**
 * Check if an error is transient and should trigger a retry.
 * Transient errors include connection resets, timeouts, and network issues.
 */
function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('connection') ||
    message.includes('timeout')
  );
}

/**
 * NPC Memory Service
 *
 * Provides memory management for NPC continuity:
 * - Add memories with automatic eviction of oldest
 * - Query recent memories for prompt context
 * - Track relationships between actors
 */
export class NpcMemoryService {
  /**
   * Add a memory to an NPC's memory store.
   * Automatically evicts oldest memories when cap is exceeded.
   * Uses optimistic locking with retry to prevent race conditions.
   */
  async addMemory(
    actorId: string,
    memory: Omit<NpcMemory, 'id'>
  ): Promise<boolean> {
    // Generate memory ID once before the retry loop to ensure consistency across retries
    const memoryId = await generateSnowflakeId();

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const outcome = await runNpcMemoryAddTransaction({
          actorId,
          parseMemories: parseMemoriesSafe,
          buildMemories: (memories) => {
            const newMemory: NpcMemory = {
              id: memoryId,
              ...memory,
            };

            memories.push(newMemory);
            if (memories.length > MAX_MEMORIES) {
              memories.splice(0, memories.length - MAX_MEMORIES);
            }

            return {
              memories,
              memoryCount: memories.length,
              memoryType: memory.type,
            };
          },
        });

        if (outcome.kind === 'missing') {
          logger.warn(
            `Cannot add memory: ActorState not found for ${actorId}`,
            { actorId },
            'NpcMemoryService'
          );
          return false;
        }

        if (outcome.kind === 'success') {
          logger.debug(
            `Added memory for ${actorId}`,
            {
              memoryType: outcome.memoryType,
              totalMemories: outcome.memoryCount,
            },
            'NpcMemoryService'
          );
          return true;
        }

        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          logger.debug(
            `Memory update conflict for ${actorId}, retrying (attempt ${attempt + 1})`,
            { actorId },
            'NpcMemoryService'
          );
          continue;
        }
        logger.warn(
          `Memory update failed after ${MAX_RETRIES} attempts due to concurrent modification`,
          { actorId },
          'NpcMemoryService'
        );
        return false;
      } catch (error) {
        // Log the error but allow retries for transient DB errors
        logger.error(
          `Failed to add memory for ${actorId} (attempt ${attempt + 1}/${MAX_RETRIES})`,
          { error: formatError(error) },
          'NpcMemoryService'
        );

        // Check if this is a non-retryable error (e.g., constraint violation)
        const errorCode = (error as { code?: string }).code;
        const isConstraintViolation =
          errorCode === '23505' ||
          errorCode === 'P2002' ||
          errorCode === '23503';
        if (isConstraintViolation) {
          return false; // Don't retry constraint violations
        }

        // For transient errors, allow retry with backoff
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        return false;
      }
    }
    return false; // Should not reach here, but ensures return type
  }

  /**
   * Get recent memories for an NPC, optionally filtered by type.
   */
  async getRecentMemories(
    actorId: string,
    limit = 10,
    types?: NpcMemory['type'][]
  ): Promise<NpcMemory[]> {
    try {
      const state = await fetchActorStateRecentMemoriesJson(actorId);

      if (!state?.recentMemories) {
        return [];
      }

      // Parse memories with Zod validation - handles corrupted data gracefully
      let memories = parseMemoriesSafe(state.recentMemories, { actorId });

      // Filter by type if specified
      if (types && types.length > 0) {
        memories = memories.filter((m) => types.includes(m.type));
      }

      // Return most recent first, limited
      return memories.slice(-limit).reverse();
    } catch (error) {
      logger.error(
        `Failed to get memories for ${actorId}`,
        { error: formatError(error) },
        'NpcMemoryService'
      );
      return [];
    }
  }

  /**
   * Get relationship state between two actors.
   */
  async getRelationship(
    actorId: string,
    otherActorId: string
  ): Promise<RelationshipState | null> {
    try {
      const state = await fetchActorStateRelationshipsJson(actorId);

      if (!state?.relationships) {
        return null;
      }

      // Parse relationships with Zod validation - handles corrupted data gracefully
      const relationships = parseRelationshipsSafe(state.relationships, {
        actorId,
      });
      return relationships[otherActorId] ?? null;
    } catch (error) {
      logger.error(
        `Failed to get relationship`,
        {
          actorId,
          otherActorId,
          error: formatError(error),
        },
        'NpcMemoryService'
      );
      return null;
    }
  }

  /**
   * Update relationship between two actors based on an interaction.
   * Uses optimistic locking with retry to prevent race conditions.
   */
  async updateRelationship(
    actorId: string,
    otherActorId: string,
    interaction: {
      sentimentChange: number; // -1 to 1
      note?: string;
    }
  ): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const outcome = await runNpcRelationshipUpdateTransaction({
          actorId,
          otherActorId,
          parseRelationships: parseRelationshipsSafe,
          mutate: (relationships) => {
            const existing = relationships[otherActorId];
            const now = new Date();

            if (existing) {
              const newSentiment =
                existing.sentiment + interaction.sentimentChange * 0.1;
              existing.sentiment =
                Math.round(Math.max(-1, Math.min(1, newSentiment)) * 100) / 100;
              existing.lastInteraction = now.toISOString();
              existing.interactionCount += 1;

              if (interaction.note) {
                existing.notes.push(interaction.note);
                if (existing.notes.length > MAX_RELATIONSHIP_NOTES) {
                  existing.notes = existing.notes.slice(
                    -MAX_RELATIONSHIP_NOTES
                  );
                }
              }
            } else {
              relationships[otherActorId] = {
                actorId: otherActorId,
                sentiment: Math.max(
                  -1,
                  Math.min(1, interaction.sentimentChange)
                ),
                lastInteraction: now.toISOString(),
                interactionCount: 1,
                notes: interaction.note ? [interaction.note] : [],
              };
            }

            return relationships;
          },
        });

        if (outcome.kind === 'missing') {
          logger.warn(
            `Cannot update relationship: ActorState not found for ${actorId}`,
            { actorId },
            'NpcMemoryService'
          );
          return false;
        }

        if (outcome.kind === 'success') {
          logger.debug(
            `Updated relationship`,
            {
              actorId,
              otherActorId,
              newSentiment: outcome.newSentiment,
            },
            'NpcMemoryService'
          );
          return true;
        }

        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          logger.debug(
            `Relationship update conflict for ${actorId}, retrying (attempt ${attempt + 1})`,
            { actorId },
            'NpcMemoryService'
          );
          continue;
        }
        logger.warn(
          `Relationship update failed after ${MAX_RETRIES} attempts due to concurrent modification`,
          { actorId },
          'NpcMemoryService'
        );
        return false;
      } catch (error) {
        // Check if this is a transient/connection error that should be retried
        if (isTransientError(error) && attempt < MAX_RETRIES - 1) {
          // Exponential backoff before retry using shared constant
          const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        logger.error(
          `Failed to update relationship`,
          {
            actorId,
            otherActorId,
            attempt: attempt + 1,
            error: formatError(error),
          },
          'NpcMemoryService'
        );
        return false;
      }
    }
    return false; // Should not reach here, but ensures return type
  }

  /**
   * Update activity state when NPC takes an action.
   * Uses optimistic locking with retry to prevent race conditions
   * when multiple concurrent updates occur.
   *
   * @param actorId - The NPC actor ID
   * @param options.posted - Whether the NPC posted
   * @param options.active - Whether the NPC was active
   * @param options.gameStartedAt - Game start time for day calculation (optional, uses wall-clock if not provided)
   */
  async updateActivityState(
    actorId: string,
    options: {
      posted?: boolean;
      active?: boolean;
      gameStartedAt?: Date;
    } = {}
  ): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const outcome = await runNpcActivityStateUpdateTransaction({
          actorId,
          buildPatch: (state) => {
            const now = new Date();

            const set: Partial<{
              lastPostAt: Date;
              lastActiveAt: Date;
              postsToday: number;
              postsTodayResetAt: Date;
            }> = {};

            if (options.active) {
              set.lastActiveAt = now;
            }

            if (options.posted) {
              set.lastPostAt = now;

              const resetAt = state.postsTodayResetAt;
              let shouldReset = !resetAt;

              if (!shouldReset && resetAt) {
                if (options.gameStartedAt) {
                  const currentGameDay = getGameDayNumber(
                    options.gameStartedAt,
                    now
                  );
                  const lastResetGameDay = getGameDayNumber(
                    options.gameStartedAt,
                    resetAt
                  );
                  shouldReset = currentGameDay !== lastResetGameDay;
                } else {
                  shouldReset =
                    now.getTime() - resetAt.getTime() > 24 * 60 * 60 * 1000;
                }
              }

              if (shouldReset) {
                set.postsToday = 1;
                set.postsTodayResetAt = now;
              } else {
                set.postsToday = (state.postsToday ?? 0) + 1;
              }
            }

            return { kind: 'commit' as const, set };
          },
        });

        if (outcome.kind === 'missing') {
          logger.warn(
            `Actor state not found for ${actorId}`,
            { actorId },
            'NpcMemoryService'
          );
          return false;
        }

        if (outcome.kind === 'success') {
          return true;
        }

        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          logger.debug(
            `Activity state update conflict for ${actorId}, retrying (attempt ${attempt + 1})`,
            { actorId },
            'NpcMemoryService'
          );
          continue;
        }
        logger.warn(
          `Activity state update failed after ${MAX_RETRIES} attempts due to concurrent modification`,
          { actorId },
          'NpcMemoryService'
        );
        return false;
      } catch (error) {
        // Check if this is a transient/connection error that should be retried
        if (isTransientError(error) && attempt < MAX_RETRIES - 1) {
          // Exponential backoff before retry using shared constant
          const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          logger.debug(
            `Transient error updating activity state for ${actorId}, retrying (attempt ${attempt + 1})`,
            {
              actorId,
              error: formatError(error),
            },
            'NpcMemoryService'
          );
          continue;
        }

        const isTransient = isTransientError(error);
        logger.error(
          `Failed to update activity state for ${actorId}`,
          {
            error: formatError(error),
            attempt: attempt + 1,
            isTransient,
          },
          'NpcMemoryService'
        );
        return false;
      }
    }
    return false; // Should not reach here, but ensures return type
  }

  /**
   * Add the same memory to multiple NPCs concurrently.
   * Uses Promise.allSettled to provide isolation between actors,
   * ensuring failure of one actor doesn't affect others.
   *
   * @param actorIds - Array of actor IDs to add memory to
   * @param memory - Memory to add (without id, will be generated)
   * @returns Number of successfully updated actors
   */
  async addMemoryBatch(
    actorIds: string[],
    memory: Omit<NpcMemory, 'id'>
  ): Promise<number> {
    if (actorIds.length === 0) {
      return 0;
    }

    // For single actor, delegate to single method
    const singleActorId = first(actorIds);
    if (actorIds.length === 1 && singleActorId) {
      const success = await this.addMemory(singleActorId, memory);
      return success ? 1 : 0;
    }

    // Delegate to addMemory which has retry logic built in
    // Use Promise.allSettled for isolation between actors
    const updateResults = await Promise.allSettled(
      actorIds.map((actorId) => this.addMemory(actorId, memory))
    );

    // Count successes - addMemory returns boolean, so check fulfilled results with true value
    const successCount = updateResults.filter(
      (r) => r.status === 'fulfilled' && r.value === true
    ).length;

    logger.debug(
      `Batch memory added to ${successCount}/${actorIds.length} actors`,
      { memoryType: memory.type, successCount, totalActors: actorIds.length },
      'NpcMemoryService'
    );

    return successCount;
  }

  /**
   * Format memories for inclusion in NPC prompts.
   */
  formatMemoriesForPrompt(memories: NpcMemory[]): string {
    if (memories.length === 0) {
      return '';
    }

    const lines = memories.map((m) => {
      const timeAgo = this.formatTimeAgo(m.timestamp);
      return `- [${timeAgo}] ${m.summary}`;
    });

    return `## Recent Memories\n${lines.join('\n')}`;
  }

  /**
   * Format time ago string for memory display.
   * Handles both past and future timestamps gracefully.
   * @param timestamp - ISO timestamp string to format
   * @param now - Optional current time for testing (defaults to new Date())
   */
  formatTimeAgo(timestamp: string, now?: Date | string | number): string {
    const currentTime =
      now !== undefined
        ? now instanceof Date
          ? now
          : new Date(now)
        : new Date();
    const then = new Date(timestamp);
    const diffMs = currentTime.getTime() - then.getTime();

    // Handle future timestamps (negative diff)
    if (diffMs < 0) {
      const absDiffMs = Math.abs(diffMs);
      // Treat small future offsets as "just now" (clock skew tolerance)
      if (absDiffMs < 60000) {
        return 'just now';
      }
      const futureMins = Math.floor(absDiffMs / 60000);
      const futureHours = Math.floor(futureMins / 60);
      const futureDays = Math.floor(futureHours / 24);

      if (futureDays > 0) {
        return `in ${futureDays}d`;
      }
      if (futureHours > 0) {
        return `in ${futureHours}h`;
      }
      return `in ${futureMins}m`;
    }

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ago`;
    }
    if (diffHours > 0) {
      return `${diffHours}h ago`;
    }
    if (diffMins > 0) {
      return `${diffMins}m ago`;
    }
    return 'just now';
  }
}

// Singleton instance
export const npcMemoryService = new NpcMemoryService();
