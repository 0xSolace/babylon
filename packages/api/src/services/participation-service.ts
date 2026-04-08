/**
 * Participation Service
 *
 * @description Tracks off-chain user participation metrics including posts,
 * comments, shares, reactions, and market participation. Calculates total
 * activity scores and tracks last activity timestamps.
 */

import { fetchParticipationAggregates } from '@babylon/db';
import { db } from '@babylon/db/engine-storage';

/**
 * Participation statistics for a user
 *
 * @description Contains aggregated participation metrics including counts
 * for various activity types and last activity timestamp.
 */
export interface ParticipationStats {
  postsCreated: number;
  commentsMade: number;
  sharesMade: number;
  reactionsGiven: number;
  marketsParticipated: number;
  totalActivity: number;
  lastActivityAt: Date;
}

/**
 * Participation Service Class
 *
 * @description Static service class for tracking user participation metrics.
 * Provides methods for retrieving participation statistics and calculating
 * activity scores.
 */
export class ParticipationService {
  /**
   * Get participation statistics for a user
   *
   * @description Retrieves comprehensive participation statistics for a user
   * including posts, comments, shares, reactions, and market participation.
   * Calculates total activity score and last activity timestamp.
   *
   * @param {string} userId - User ID to get stats for
   * @returns {Promise<ParticipationStats | null>} Participation stats or null if user not found
   */
  static async getStats(userId: string): Promise<ParticipationStats | null> {
    const agg = await fetchParticipationAggregates(db, userId);

    const postsCreated = agg.postsCreated;
    const commentsMade = agg.commentsMade;
    const sharesMade = agg.sharesMade;
    const reactionsGiven = agg.reactionsGiven;
    const marketsParticipated = agg.marketsParticipated;

    // Weighted scoring: posts=10, comments=5, shares=3, reactions=1, markets=5
    const totalActivity =
      postsCreated * 10 +
      commentsMade * 5 +
      sharesMade * 3 +
      reactionsGiven * 1 +
      marketsParticipated * 5;

    const activityTimestamps = [
      agg.lastPostAt,
      agg.lastCommentAt,
      agg.lastShareAt,
      agg.lastReactionAt,
      agg.lastPositionAt,
    ].filter((date): date is Date => date !== null && date !== undefined);

    const lastActivityAt =
      activityTimestamps.length > 0
        ? new Date(Math.max(...activityTimestamps.map((d) => d.getTime())))
        : new Date();

    return {
      postsCreated,
      commentsMade,
      sharesMade,
      reactionsGiven,
      marketsParticipated,
      totalActivity,
      lastActivityAt,
    };
  }
}
