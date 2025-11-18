/**
 * Message Quality Checker Service
 *
 * Validates message quality based on:
 * - Length (not too short, not too long)
 * - Uniqueness (not duplicate of recent messages)
 * - Content quality (not spam, not gibberish)
 *
 * Returns a quality score (0-1) that affects:
 * - Following chances
 * - Group chat invite chances
 * - Risk of being booted from group chats
 */

import { prisma } from '@/lib/prisma';

export type QualityCheckResult = {
  score: number; // 0-1, where 1 is perfect
  passed: boolean; // Whether message meets minimum standards
  warnings: string[]; // Non-blocking issues
  errors: string[]; // Blocking issues
  factors: {
    length: number; // 0-1
    uniqueness: number; // 0-1
    contentQuality: number; // 0-1
  };
};

export class MessageQualityChecker {
  /**
   * Check message quality
   */
  static async checkQuality(
    message: string,
    userId: string,
    contextType: 'reply' | 'groupchat' | 'dm',
    contextId: string // postId, chatId, or empty for game chats
  ): Promise<QualityCheckResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check length
    const lengthScore = MessageQualityChecker.checkLength(message, errors, warnings);

    // 2. Check for duplicates
    const uniquenessScore = await MessageQualityChecker.checkUniqueness(
      message,
      userId,
      contextType,
      contextId,
      errors,
      warnings
    );

    // 3. Check content quality
    const contentScore = MessageQualityChecker.checkContent(message, errors, warnings);

    // Calculate overall score (weighted average)
    const score = lengthScore * 0.3 + uniquenessScore * 0.4 + contentScore * 0.3;

    return {
      score,
      passed: errors.length === 0 && score >= 0.5,
      warnings,
      errors,
      factors: {
        length: lengthScore,
        uniqueness: uniquenessScore,
        contentQuality: contentScore,
      },
    };
  }

  /**
   * Get user's quality statistics
   */
  static async getUserQualityStats(userId: string) {
    const interactions = await prisma.userInteraction.findMany({
      where: {
        userId,
      },
      select: {
        qualityScore: true,
      },
    });

    if (interactions.length === 0) {
      return {
        averageScore: 0,
        totalMessages: 0,
        highQualityCount: 0,
        lowQualityCount: 0,
      };
    }

    const averageScore =
      interactions.reduce((sum, i) => sum + i.qualityScore, 0) / interactions.length;
    const highQualityCount = interactions.filter((i) => i.qualityScore >= 0.8).length;
    const lowQualityCount = interactions.filter((i) => i.qualityScore < 0.5).length;

    return {
      averageScore,
      totalMessages: interactions.length,
      highQualityCount,
      lowQualityCount,
    };
  }
}
