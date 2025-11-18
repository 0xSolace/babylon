/**
 * NPC Trading Service
 *
 * @deprecated This keyword-based trading system has been replaced by LLM-driven market decisions.
 * See: MarketDecisionEngine, TradeExecutionService, MarketContextService
 *
 * The new system generates trading decisions using the LLM based on:
 * - Feed posts
 * - Group chat messages (insider info)
 * - Market conditions
 * - NPC personality and tier
 *
 * This file is kept for reference but should not be used.
 */

import { logger } from './logger';
import { prisma } from './prisma';

type MarketContext = {
  perpMarkets: Array<{
    ticker: string;
    organizationId: string;
    currentPrice: number;
  }>;
  predictionMarkets: Array<{
    id: string;
    text: string;
    yesShares: number;
    noShares: number;
  }>;
};

export class NPCTradingService {
  /**
   * Analyze a post and determine if NPC should trade
   */
  static async analyzePostAndTrade(
    postId: string,
    postContent: string,
    npcActorId: string,
    marketContext: MarketContext
  ): Promise<void> {
    const actor = await prisma.actor.findUnique({
      where: { id: npcActorId },
      include: {
        Pool: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!actor) {
      logger.warn(`NPC actor not found: ${npcActorId}`);
      return;
    }

    const signals = NPCTradingService.extractTradingSignals(postContent, marketContext, {
      tier: actor.tier ?? undefined,
      personality: actor.personality ?? undefined,
    });
    if (signals.length === 0) return;

    for (const signal of signals) {
      await NPCTradingService.executePersonalTrade(actor, signal, postId);

      if (actor.Pool.length > 0) {
        await NPCTradingService.executePoolTrade(actor, signal, postId, actor.Pool[0]?.id);
      }
    }
  }

  /**
   * Process all recent posts and execute NPC trades
   */
  static async processRecentPosts(marketContext: MarketContext): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const recentPosts = await prisma.post.findMany({
      where: {
        timestamp: {
          gte: oneHourAgo,
          lte: now, // ✅ No future posts
        },
        deletedAt: null, // Filter out deleted posts
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    logger.info(`Processing ${recentPosts.length} recent posts for NPC trading`);

    for (const post of recentPosts) {
      await NPCTradingService.analyzePostAndTrade(
        post.id,
        post.content,
        post.authorId,
        marketContext
      );
    }
  }
}
