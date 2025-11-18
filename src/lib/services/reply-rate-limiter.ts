/**
 * Reply Rate Limiter Service
 *
 * Enforces exactly 1 reply per hour per NPC for each player.
 * - Too fast: returns error with time until next allowed reply
 * - Too slow: returns warning that consistent replies are needed
 * - Just right: allows reply and tracks timing
 */

import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';

export type RateLimitResult = {
  allowed: boolean;
  reason?: string;
  nextAllowedAt?: Date;
  minutesUntilNextReply?: number;
  lastReplyAt?: Date;
  replyStreak?: number; // How many consecutive hours they've replied
  expectedNextReply?: Date; // Expected next reply time based on ideal interval
};

export class ReplyRateLimiter {
  // Use IDEAL_REPLY_INTERVAL_MS to calculate expected next reply time
  static getExpectedNextReplyTime(lastReplyTime: Date): Date {
    return new Date(lastReplyTime.getTime() + ReplyRateLimiter.IDEAL_REPLY_INTERVAL_MS);
  }

  /**
   * Check if user can reply to an NPC's post
   */
  static async canReply(userId: string, npcId: string): Promise<RateLimitResult> {
    // Get last interaction with this NPC
    const lastInteraction = await prisma.userInteraction.findFirst({
      where: {
        userId,
        npcId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // First reply to this NPC - always allowed
    if (!lastInteraction) {
      return {
        allowed: true,
        replyStreak: 0,
      };
    }

    const now = new Date();
    const timeSinceLastReply = now.getTime() - lastInteraction.timestamp.getTime();

    // Calculate expected next reply time using IDEAL_REPLY_INTERVAL_MS
    const expectedNextReply = ReplyRateLimiter.getExpectedNextReplyTime(lastInteraction.timestamp);

    // Too soon - need to wait
    if (timeSinceLastReply < ReplyRateLimiter.MIN_REPLY_INTERVAL_MS) {
      const nextAllowedAt = new Date(
        lastInteraction.timestamp.getTime() + ReplyRateLimiter.MIN_REPLY_INTERVAL_MS
      );
      const minutesUntilNextReply = Math.ceil(
        (nextAllowedAt.getTime() - now.getTime()) / (60 * 1000)
      );

      // Use expectedNextReply for user messaging
      const minutesUntilExpected = Math.ceil(
        (expectedNextReply.getTime() - now.getTime()) / (60 * 1000)
      );

      return {
        allowed: false,
        reason: `You must wait at least 55 minutes between replies to the same NPC. Expected next reply time: ${minutesUntilExpected} minutes. Please wait ${minutesUntilNextReply} more minutes.`,
        nextAllowedAt,
        minutesUntilNextReply,
        lastReplyAt: lastInteraction.timestamp,
        expectedNextReply,
      };
    }

    // Calculate streak (consecutive hourly replies)
    const streak = await ReplyRateLimiter.calculateReplyStreak(userId, npcId);

    // Too late - warn but allow (breaks consistency for following chance)
    if (timeSinceLastReply > ReplyRateLimiter.MAX_REPLY_INTERVAL_MS) {
      return {
        allowed: true,
        reason: `It's been ${Math.floor(timeSinceLastReply / (60 * 60 * 1000))} hours since your last reply. For best chance of being followed, reply every hour.`,
        lastReplyAt: lastInteraction.timestamp,
        replyStreak: 0, // Streak broken
      };
    }

    // Just right - within 55-65 minute window
    return {
      allowed: true,
      lastReplyAt: lastInteraction.timestamp,
      replyStreak: streak + 1, // Continue streak
    };
  }

  /**
   * Record a reply interaction
   */
  static async recordReply(
    userId: string,
    npcId: string,
    postId: string,
    commentId: string,
    qualityScore: number
  ): Promise<void> {
    await prisma.userInteraction.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        npcId,
        postId,
        commentId,
        qualityScore,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Get user's reply statistics for an NPC
   */
  static async getReplyStats(userId: string, npcId: string) {
    const interactions = await prisma.userInteraction.findMany({
      where: {
        userId,
        npcId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    if (interactions.length === 0) {
      return {
        totalReplies: 0,
        currentStreak: 0,
        longestStreak: 0,
        averageQuality: 0,
        lastReplyAt: null,
      };
    }

    const currentStreak = await ReplyRateLimiter.calculateReplyStreak(userId, npcId);
    const averageQuality =
      interactions.reduce((sum, i) => sum + i.qualityScore, 0) / interactions.length;

    // Calculate longest streak from all historical interactions
    const longestStreak = await ReplyRateLimiter.calculateLongestStreak(
      userId,
      npcId,
      interactions
    );

    return {
      totalReplies: interactions.length,
      currentStreak,
      longestStreak,
      averageQuality,
      lastReplyAt: interactions[0]?.timestamp,
    };
  }

  /**
   * Get all NPCs user has replied to with their stats
   */
  static async getAllReplyStats(userId: string) {
    const interactions = await prisma.userInteraction.findMany({
      where: {
        userId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Group by NPC
    const npcMap = new Map<string, typeof interactions>();
    for (const interaction of interactions) {
      if (!npcMap.has(interaction.npcId)) {
        npcMap.set(interaction.npcId, []);
      }
      npcMap.get(interaction.npcId)?.push(interaction);
    }

    // Calculate stats for each NPC
    const stats = await Promise.all(
      Array.from(npcMap.keys()).map(async (npcId) => {
        const npcStats = await ReplyRateLimiter.getReplyStats(userId, npcId);
        return {
          npcId,
          ...npcStats,
        };
      })
    );

    return stats;
  }
}
