/**
 * Following Mechanics Service
 *
 * Determines when NPCs follow players based on:
 * - Reply consistency (streak of hourly replies)
 * - Quality of replies (average quality score)
 * - Time invested (total number of quality replies)
 *
 * Following probability increases with:
 * - Longer streaks (5+ hourly replies in a row)
 * - Higher quality scores (0.7+)
 * - More total interactions (10+ quality replies)
 */

import {
  countFollowingMechanicsActiveFollows,
  deactivateNpcFollow,
  fetchFollowingChanceContext,
  fetchNpcFollowActive,
  listActiveNpcFollowRowsForUser,
  listFollowingMechanicsActiveFollowBatch,
  listFollowingMechanicsActiveFollowPairs,
  listFollowingMechanicsActivePlayerRows,
  listFollowingMechanicsEngagementCounts,
  listFollowingMechanicsInteractionsForUnfollowSweep,
  listFollowingMechanicsReactionCountsSince,
  listRecentUserNpcInteractionSlice,
  upsertNpcFollowAndMarkInteractions,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import { NPC_FOLLOWING_CONFIG } from '../config/npc-activity';
import { secureRandom } from '../utils/entropy';
import { formatError } from '../utils/error-utils';
import { StaticDataRegistry } from './static-data-registry';

/**
 * Fisher-Yates shuffle for uniform random sampling.
 * Shuffles in place and returns the array.
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(secureRandom() * (i + 1));
    const temp = array[i]!;
    array[i] = array[j]!;
    array[j] = temp;
  }
  return array;
}

/**
 * Notifier interface for follow events.
 * Allows engine to emit follow notifications without depending on @babylon/api.
 */
export interface FollowNotifier {
  notifyFollow(userId: string, npcId: string): Promise<void>;
}

/**
 * Injectable notifier for follow events.
 * Set this from the API layer to enable notifications.
 * When null, follow notifications are silently skipped.
 */
let followNotifier: FollowNotifier | null = null;

/**
 * Set the follow notifier. Call this from the API layer during initialization.
 */
export function setFollowNotifier(notifier: FollowNotifier | null): void {
  followNotifier = notifier;
}

/**
 * Get the current follow notifier (for testing).
 */
export function getFollowNotifier(): FollowNotifier | null {
  return followNotifier;
}

export interface FollowingChance {
  willFollow: boolean;
  probability: number; // 0-1
  reasons: string[];
  factors: {
    streak: number;
    quality: number;
    volume: number;
  };
}

export class FollowingMechanics {
  // Following probability factors
  private static readonly MIN_STREAK_FOR_FOLLOW = 5; // 5 consecutive hourly replies
  private static readonly MIN_QUALITY_SCORE = 0.7;
  private static readonly MIN_TOTAL_REPLIES = 10;

  // Base probabilities
  private static readonly BASE_FOLLOW_PROBABILITY = 0.05; // 5% base chance
  private static readonly MAX_FOLLOW_PROBABILITY = 0.8; // 80% max chance

  /**
   * Calculate if NPC should follow player after a reply
   */
  static async calculateFollowingChance(
    userId: string,
    npcId: string,
    currentStreak: number,
    currentQualityScore: number
  ): Promise<FollowingChance> {
    // Use currentQualityScore to calculate following probability
    // Higher quality interactions increase following chance
    const qualityMultiplier = Math.min(currentQualityScore * 1.5, 2.0); // Cap at 2x

    const { followRow, interactions } = await fetchFollowingChanceContext({
      userId,
      npcId,
    });

    if (followRow?.isActive) {
      return {
        willFollow: false,
        probability: 0,
        reasons: ['Already following'],
        factors: { streak: 0, quality: 0, volume: 0 },
      };
    }

    const totalReplies = interactions.length;
    const averageQuality =
      interactions.reduce((sum, i) => sum + i.qualityScore, 0) /
      Math.max(interactions.length, 1);

    // Calculate factor scores (0-1)
    const streakFactor = Math.min(
      currentStreak / FollowingMechanics.MIN_STREAK_FOR_FOLLOW,
      1
    );
    const qualityFactor = Math.min(
      averageQuality / FollowingMechanics.MIN_QUALITY_SCORE,
      1
    );
    const volumeFactor = Math.min(
      totalReplies / FollowingMechanics.MIN_TOTAL_REPLIES,
      1
    );

    // Calculate weighted probability
    // Streak is most important (50%), quality (30%), volume (20%)
    // Apply qualityMultiplier to boost probability for high-quality interactions
    const baseProbability =
      FollowingMechanics.BASE_FOLLOW_PROBABILITY +
      (FollowingMechanics.MAX_FOLLOW_PROBABILITY -
        FollowingMechanics.BASE_FOLLOW_PROBABILITY) *
        (streakFactor * 0.5 + qualityFactor * 0.3 + volumeFactor * 0.2);

    const probability = Math.min(
      baseProbability * qualityMultiplier,
      FollowingMechanics.MAX_FOLLOW_PROBABILITY
    );

    // Reasons for following (or not)
    const reasons: string[] = [];

    if (currentStreak >= FollowingMechanics.MIN_STREAK_FOR_FOLLOW) {
      reasons.push(`Consistent streak: ${currentStreak} hourly replies`);
    } else {
      reasons.push(
        `Need ${FollowingMechanics.MIN_STREAK_FOR_FOLLOW - currentStreak} more consecutive hourly replies`
      );
    }

    if (averageQuality >= FollowingMechanics.MIN_QUALITY_SCORE) {
      reasons.push(`High quality: ${(averageQuality * 100).toFixed(0)}% avg`);
    } else {
      reasons.push(
        `Improve quality to ${(FollowingMechanics.MIN_QUALITY_SCORE * 100).toFixed(0)}%+ for better chances`
      );
    }

    if (totalReplies >= FollowingMechanics.MIN_TOTAL_REPLIES) {
      reasons.push(`Engaged: ${totalReplies} quality replies`);
    } else {
      reasons.push(
        `Post ${FollowingMechanics.MIN_TOTAL_REPLIES - totalReplies} more quality replies`
      );
    }

    // Roll the dice
    const willFollow = secureRandom() < probability;

    return {
      willFollow,
      probability,
      reasons,
      factors: {
        streak: streakFactor,
        quality: qualityFactor,
        volume: volumeFactor,
      },
    };
  }

  /**
   * Record an NPC following a player
   */
  static async recordFollow(
    userId: string,
    npcId: string,
    reason: string
  ): Promise<void> {
    await upsertNpcFollowAndMarkInteractions({ userId, npcId, reason });

    // Create notification for the user (NPCs follow users, not the other way around)
    // For NPC follows, use the NPC's ID as actorId since they're not real users
    // Notification handled by API layer via injected notifier - engine doesn't depend on api
    if (followNotifier) {
      try {
        await followNotifier.notifyFollow(userId, npcId);
      } catch (notifyError) {
        // Log but don't fail the follow operation if notification fails
        logger.warn(
          'Failed to send follow notification',
          {
            userId,
            npcId,
            error: formatError(notifyError),
          },
          'FollowingMechanics'
        );
      }
    }
  }

  /**
   * Check if an NPC is following a player
   */
  static async isFollowing(userId: string, npcId: string): Promise<boolean> {
    return fetchNpcFollowActive(userId, npcId);
  }

  /**
   * Get all NPCs following a player
   */
  static async getFollowers(userId: string) {
    return listActiveNpcFollowRowsForUser(userId);
  }

  /**
   * Unfollow (if quality drops or streak breaks badly)
   */
  static async unfollow(
    userId: string,
    npcId: string,
    reason: string
  ): Promise<void> {
    // Log unfollow reason for analytics and monitoring
    logger.info(
      `User ${userId} unfollowed ${npcId}. Reason: ${reason}`,
      undefined,
      'FollowingMechanics'
    );

    await deactivateNpcFollow({ userId, npcId });
  }

  /**
   * Check if follow should be revoked (periodic check)
   */
  static async shouldUnfollow(userId: string, npcId: string): Promise<boolean> {
    const interactions = await listRecentUserNpcInteractionSlice({
      userId,
      npcId,
      limit: 10,
    });

    if (interactions.length === 0) return false;

    // Check for sustained low quality
    const recentQuality =
      interactions.reduce((sum, i) => sum + (i.qualityScore ?? 0), 0) /
      interactions.length;

    if (recentQuality < NPC_FOLLOWING_CONFIG.minQualityToRetainFollow) {
      return true; // Quality dropped too low
    }

    // Check for long gaps (no replies for configured inactive hours)
    if (interactions.length === 0) {
      return false; // No interactions found
    }
    const lastInteraction = interactions[0]?.timestamp;
    if (!lastInteraction) {
      return false; // No valid interaction timestamp
    }
    const hoursSinceLastReply =
      (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60);

    if (
      hoursSinceLastReply > NPC_FOLLOWING_CONFIG.maxInactiveHoursBeforeUnfollow
    ) {
      return true; // Stopped engaging
    }

    return false;
  }

  /**
   * Process proactive NPC following of active players.
   * NPCs will follow players who are actively engaging with the game.
   *
   * Called periodically from the game tick.
   *
   * @param deadline - Optional deadline timestamp; processing stops when exceeded
   * @returns Number of new follows created
   */
  static async processProactiveFollowing(deadline?: number): Promise<{
    followsCreated: number;
    playersConsidered: number;
  }> {
    const result = {
      followsCreated: 0,
      playersConsidered: 0,
    };

    // Helper to check if we should bail early
    const isTimeUp = () => deadline !== undefined && Date.now() >= deadline;

    try {
      // Get active players (users who have posted in last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const activePlayers = await listFollowingMechanicsActivePlayerRows({
        since: sevenDaysAgo,
        minPosts: NPC_FOLLOWING_CONFIG.minPostsToFollow,
        limit: NPC_FOLLOWING_CONFIG.maxActivePlayersToConsider,
      });

      // Calculate engagement scores for candidates
      // Engagement = likes given (0.5 pts each) + comments made (1 pt each)
      const playerIds = activePlayers.map((p) => p.userId);
      const engagementScores = new Map<string, number>();

      if (playerIds.length > 0) {
        // Get reaction counts (likes given by these users in last 7 days)
        const reactionCounts = await listFollowingMechanicsReactionCountsSince({
          userIds: playerIds,
          since: sevenDaysAgo,
        });

        // Calculate engagement score: posts (1pt) + reactions given (0.5pt)
        for (const player of activePlayers) {
          const reactionData = reactionCounts.find(
            (r) => r.userId === player.userId
          );
          const reactionScore = (reactionData?.reactionCount ?? 0) * 0.5;
          const postScore = Number(player.postCount);
          engagementScores.set(player.userId, postScore + reactionScore);
        }
      }

      // Filter players by minimum engagement score
      const eligiblePlayers = activePlayers.filter((player) => {
        const score = engagementScores.get(player.userId) ?? player.postCount;
        return score >= NPC_FOLLOWING_CONFIG.minEngagementToFollow;
      });

      result.playersConsidered = eligiblePlayers.length;

      if (eligiblePlayers.length === 0) {
        return result;
      }

      // Get all NPCs
      const allNpcs = StaticDataRegistry.getAllActors();
      if (allNpcs.length === 0) {
        return result;
      }

      // Batch fetch all active follows for eligible players (eliminates N+1 queries)
      const eligiblePlayerIds = eligiblePlayers.map((p) => p.userId);
      const allExistingFollows = await listFollowingMechanicsActiveFollowPairs({
        userIds: eligiblePlayerIds,
      });

      // Build Map<userId, Set<npcId>> for O(1) lookup
      const followsByUser = new Map<string, Set<string>>();
      for (const follow of allExistingFollows) {
        if (!followsByUser.has(follow.userId)) {
          followsByUser.set(follow.userId, new Set());
        }
        followsByUser.get(follow.userId)!.add(follow.npcId);
      }

      // Batch fetch engagement counts for all player-NPC pairs (eliminates N*M queries)
      // This counts how many times each player has reacted to each NPC's posts
      // Limited by time window and NPC candidate cap to prevent unbounded queries
      const engagementWindowMs =
        NPC_FOLLOWING_CONFIG.engagementWindowDays * 24 * 60 * 60 * 1000;
      const engagementWindowStart = new Date(Date.now() - engagementWindowMs);

      // Cap NPCs to evaluate to prevent unbounded work.
      // Uses an explicit total cap for clarity regardless of player count.
      // Shuffle allNpcs before slicing to avoid bias toward the start of the registry
      const maxNpcCandidates = Math.min(
        allNpcs.length,
        NPC_FOLLOWING_CONFIG.totalMaxNpcCandidatesPerTick
      );
      const shuffledNpcs = shuffleArray([...allNpcs]);
      const candidateNpcs = shuffledNpcs.slice(0, maxNpcCandidates);
      const candidateNpcIds = candidateNpcs.map((n) => n.id);

      const engagementCounts = await listFollowingMechanicsEngagementCounts({
        userIds: eligiblePlayerIds,
        authorIds: candidateNpcIds,
        since: engagementWindowStart,
      });

      // Build Map<"userId-npcId", count> for O(1) lookup
      const engagementByPair = new Map<string, number>();
      for (const row of engagementCounts) {
        const key = `${row.userId}-${row.authorId}`;
        engagementByPair.set(key, row.engagementCount);
      }

      // Track follows per player this tick
      const followsPerPlayer = new Map<string, number>();

      // Shuffle candidate NPCs once outside the per-player loop for efficiency
      // Each player will use a slice from this pre-shuffled array
      const shuffledCandidateNpcs = shuffleArray([...candidateNpcs]);
      const perPlayerCap =
        NPC_FOLLOWING_CONFIG.maxNpcCandidatesPerPlayerPerTick;

      for (const player of eligiblePlayers) {
        // Bail early if deadline exceeded
        if (isTimeUp()) {
          break;
        }

        if (result.followsCreated >= NPC_FOLLOWING_CONFIG.maxFollowsPerTick) {
          break;
        }

        const playerFollows = followsPerPlayer.get(player.userId) ?? 0;
        if (playerFollows >= NPC_FOLLOWING_CONFIG.maxFollowsPerPlayerPerTick) {
          continue;
        }

        // Get NPCs not already following this player (using pre-fetched data)
        // Use candidateNpcs (capped set) instead of allNpcs
        const followingNpcIds = followsByUser.get(player.userId) ?? new Set();

        // Sample a bounded subset of NPCs per player to cap per-player CPU work
        // Slice from the pre-shuffled array, then filter by already-following
        const sampledNpcs = shuffledCandidateNpcs.slice(0, perPlayerCap);
        const eligibleNpcs = sampledNpcs.filter(
          (npc) => !followingNpcIds.has(npc.id)
        );

        if (eligibleNpcs.length === 0) {
          continue;
        }

        // Iterate over the sampled subset (bounded by per-player cap)
        for (const npc of eligibleNpcs) {
          // Bail early if deadline exceeded
          if (isTimeUp()) {
            break;
          }

          if (result.followsCreated >= NPC_FOLLOWING_CONFIG.maxFollowsPerTick) {
            break;
          }

          const currentPlayerFollows = followsPerPlayer.get(player.userId) ?? 0;
          if (
            currentPlayerFollows >=
            NPC_FOLLOWING_CONFIG.maxFollowsPerPlayerPerTick
          ) {
            break;
          }

          // Check engagement-based boost - NPCs more likely to follow players who engage with their content
          // Use a scaled multiplier based on engagement count for more granular behavior
          const engagementKey = `${player.userId}-${npc.id}`;
          const engagementCount = engagementByPair.get(engagementKey) ?? 0;

          // Scaled boost: 1 + min(engagementCount / 10, 3) gives range [1.0, 4.0]
          // e.g., 0 engagements = 1.0x, 5 engagements = 1.5x, 10+ engagements = 2.0x, 30+ = 4.0x (max)
          const ENGAGEMENT_SCALE_DIVISOR = 10;
          const MAX_ENGAGEMENT_BOOST = 3;
          const probabilityBoost =
            1 +
            Math.min(
              engagementCount / ENGAGEMENT_SCALE_DIVISOR,
              MAX_ENGAGEMENT_BOOST
            );

          // Probability check with engagement boost applied (clamped to valid [0,1] range)
          const boostedProbability = Math.max(
            0,
            Math.min(
              1,
              NPC_FOLLOWING_CONFIG.proactiveFollowProbability * probabilityBoost
            )
          );
          if (secureRandom() > boostedProbability) {
            continue;
          }

          // Create the follow
          try {
            await FollowingMechanics.recordFollow(
              player.userId,
              npc.id,
              `Proactive follow: ${player.username} is an active player`
            );

            result.followsCreated++;
            followsPerPlayer.set(player.userId, currentPlayerFollows + 1);

            logger.info(
              `NPC ${npc.name} proactively followed player ${player.username}`,
              { npcId: npc.id, userId: player.userId },
              'FollowingMechanics'
            );
          } catch (followError) {
            logger.warn(
              'Failed to create proactive follow',
              {
                npcId: npc.id,
                userId: player.userId,
                error: formatError(followError),
              },
              'FollowingMechanics'
            );
          }
        }
      }

      return result;
    } catch (error) {
      logger.error(
        'Error in proactive following',
        { error: formatError(error) },
        'FollowingMechanics'
      );
      return result;
    }
  }

  /**
   * Process unfollow checks for inactive players.
   * Uses batch loading to avoid N+1 queries.
   *
   * @param deadline - Optional deadline timestamp; processing stops when exceeded
   * @returns Number of unfollows processed
   */
  static async processUnfollowChecks(deadline?: number): Promise<number> {
    // Only run occasionally
    if (secureRandom() > NPC_FOLLOWING_CONFIG.unfollowCheckProbability) {
      return 0;
    }

    // Helper to check if we should bail early
    const isTimeUp = () => deadline !== undefined && Date.now() >= deadline;

    let unfollowCount = 0;

    try {
      // Use deterministic ordering with a rotating offset based on current time
      // This ensures different rows are checked each run
      const batchSize = NPC_FOLLOWING_CONFIG.unfollowCheckBatchSize;

      // Get total active follows count for offset calculation
      const totalFollows = await countFollowingMechanicsActiveFollows();

      // Calculate rotating offset based on time (changes every hour)
      const hourSeed = Math.floor(Date.now() / (60 * 60 * 1000));
      const offset =
        totalFollows > batchSize
          ? (hourSeed % totalFollows) % (totalFollows - batchSize + 1)
          : 0;

      // Get active follows with deterministic ordering and rotating offset
      const activeFollows = await listFollowingMechanicsActiveFollowBatch({
        batchSize,
        offset,
      });

      if (activeFollows.length === 0) {
        return 0;
      }

      // Bail early if deadline exceeded
      if (isTimeUp()) {
        return 0;
      }

      // Batch load recent interaction data for all (userId, npcId) pairs
      // This eliminates N+1 queries from shouldUnfollow
      const userNpcPairs = activeFollows.map((f) => ({
        userId: f.userId,
        npcId: f.npcId,
      }));
      const userIds = [...new Set(userNpcPairs.map((p) => p.userId))];
      const npcIds = [...new Set(userNpcPairs.map((p) => p.npcId))];

      // Fetch all recent interactions for the user-npc pairs in one query
      // Apply time-window filter and limit to prevent unbounded result sets
      const interactionCutoffMs =
        NPC_FOLLOWING_CONFIG.engagementWindowDays * 24 * 60 * 60 * 1000;
      const interactionCutoff = new Date(Date.now() - interactionCutoffMs);
      const MAX_INTERACTIONS_QUERY_LIMIT = 1000;

      const recentInteractions =
        await listFollowingMechanicsInteractionsForUnfollowSweep({
          userIds,
          npcIds,
          since: interactionCutoff,
          limit: MAX_INTERACTIONS_QUERY_LIMIT,
        });

      // Build a map of interactions by (userId-npcId) key
      // Store the 10 most recent interactions per pair (matching shouldUnfollow logic)
      const interactionsByPair = new Map<
        string,
        Array<{ qualityScore: number; timestamp: Date }>
      >();
      for (const interaction of recentInteractions) {
        const key = `${interaction.userId}-${interaction.npcId}`;
        if (!interactionsByPair.has(key)) {
          interactionsByPair.set(key, []);
        }
        const pairInteractions = interactionsByPair.get(key)!;
        if (pairInteractions.length < 10) {
          pairInteractions.push({
            qualityScore: interaction.qualityScore,
            timestamp: interaction.timestamp,
          });
        }
      }

      // Process each follow using pre-fetched interaction data
      for (const follow of activeFollows) {
        // Bail early if deadline exceeded
        if (isTimeUp()) {
          break;
        }

        const key = `${follow.userId}-${follow.npcId}`;
        const interactions = interactionsByPair.get(key) ?? [];

        // In-memory shouldUnfollow check using shared config thresholds
        let shouldUnfollow = false;

        if (interactions.length > 0) {
          // Check for sustained low quality (uses same threshold as FollowingMechanics.shouldUnfollow)
          const recentQuality =
            interactions.reduce((sum, i) => sum + (i.qualityScore ?? 0), 0) /
            interactions.length;

          if (recentQuality < NPC_FOLLOWING_CONFIG.minQualityToRetainFollow) {
            shouldUnfollow = true; // Quality dropped too low
          }

          // Check for long gaps (uses same threshold as FollowingMechanics.shouldUnfollow)
          const lastInteraction = interactions[0]?.timestamp;
          if (lastInteraction) {
            const hoursSinceLastReply =
              (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60);

            if (
              hoursSinceLastReply >
              NPC_FOLLOWING_CONFIG.maxInactiveHoursBeforeUnfollow
            ) {
              shouldUnfollow = true; // Stopped engaging
            }
          }
        }

        if (shouldUnfollow) {
          await FollowingMechanics.unfollow(
            follow.userId,
            follow.npcId,
            'Quality dropped or inactivity'
          );
          unfollowCount++;
        }
      }

      if (unfollowCount > 0) {
        logger.info(
          `Processed ${unfollowCount} unfollows due to inactivity/quality`,
          {},
          'FollowingMechanics'
        );
      }

      return unfollowCount;
    } catch (error) {
      logger.error(
        'Error in unfollow checks',
        { error: formatError(error) },
        'FollowingMechanics'
      );
      return unfollowCount;
    }
  }
}
