/**
 * Reads for `NPCInteractionTracker` (alpha group engagement / trading stats).
 *
 * **Why here:** Keeps `Post` / `User` / `UserInteraction` / `Reaction` / `Share` /
 * `AgentTrade` SQL under `asSystem`.
 */

import { and, count, eq, gte, inArray, lte } from 'drizzle-orm';
import { asSystem } from './db';
import { agentTrades } from './tables/agent-trades';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';
import { users } from './tables/user';
import { userInteractions } from './tables/user-interactions';

export async function fetchNpcActorAuthorIdForPostIfActor(params: {
  postId: string;
  traceLabel: 'npc-tracker-like' | 'npc-tracker-share';
}): Promise<string | null> {
  return asSystem(async (c) => {
    const [post] = await c
      .select({ authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, params.postId))
      .limit(1);

    if (!post) return null;

    const [author] = await c
      .select({ isActor: users.isActor })
      .from(users)
      .where(eq(users.id, post.authorId))
      .limit(1);

    if (!author?.isActor) return null;
    return post.authorId;
  }, params.traceLabel);
}

export type NpcTrackerAgentCloseTradeRow = {
  pnl: number | null;
  action: string;
};

export async function listAgentCloseTradesPnlInWindow(params: {
  userId: string;
  startDate: Date;
  endDate: Date;
}): Promise<NpcTrackerAgentCloseTradeRow[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          pnl: agentTrades.pnl,
          action: agentTrades.action,
        })
        .from(agentTrades)
        .where(
          and(
            eq(agentTrades.agentUserId, params.userId),
            eq(agentTrades.action, 'close'),
            gte(agentTrades.executedAt, params.startDate),
            lte(agentTrades.executedAt, params.endDate)
          )
        ),
    'npc-tracker-trading-stats'
  );
}

export type NpcEngagementSocialSlice = {
  replyInteractions: { qualityScore: number }[];
  likeCount: number;
  shareCount: number;
};

/**
 * Post timestamps use `postsEnd` (e.g. capped “now”); reply/reaction/share windows use `interactionEnd`.
 */
export async function fetchNpcEngagementSocialSlice(params: {
  userId: string;
  npcId: string;
  startDate: Date;
  interactionEnd: Date;
  postsEnd: Date;
}): Promise<NpcEngagementSocialSlice> {
  return asSystem(async (c) => {
    const npcPosts = await c
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.authorId, params.npcId),
          gte(posts.timestamp, params.startDate),
          lte(posts.timestamp, params.postsEnd)
        )
      );

    const npcPostIds = npcPosts.map((p) => p.id);

    const replies = await c
      .select({ qualityScore: userInteractions.qualityScore })
      .from(userInteractions)
      .where(
        and(
          eq(userInteractions.userId, params.userId),
          eq(userInteractions.npcId, params.npcId),
          gte(userInteractions.timestamp, params.startDate),
          lte(userInteractions.timestamp, params.interactionEnd)
        )
      );

    let likes = 0;
    if (npcPostIds.length > 0) {
      const [likeResult] = await c
        .select({ count: count() })
        .from(reactions)
        .where(
          and(
            eq(reactions.userId, params.userId),
            inArray(reactions.postId, npcPostIds),
            eq(reactions.type, 'like'),
            gte(reactions.createdAt, params.startDate),
            lte(reactions.createdAt, params.interactionEnd)
          )
        );
      likes = likeResult?.count ?? 0;
    }

    let sharesN = 0;
    if (npcPostIds.length > 0) {
      const [shareResult] = await c
        .select({ count: count() })
        .from(shares)
        .where(
          and(
            eq(shares.userId, params.userId),
            inArray(shares.postId, npcPostIds),
            gte(shares.createdAt, params.startDate),
            lte(shares.createdAt, params.interactionEnd)
          )
        );
      sharesN = shareResult?.count ?? 0;
    }

    return {
      replyInteractions: replies,
      likeCount: likes,
      shareCount: sharesN,
    };
  }, 'npc-tracker-engagement-social');
}

export async function listCandidateUserIdsForNpcTopEngagement(params: {
  npcId: string;
  window?: { startDate: Date; endDate: Date };
  mergeRecentCloseTraders: boolean;
  /** Used when `mergeRecentCloseTraders` and `window` is undefined */
  defaultTradingWindow: { startDate: Date; endDate: Date };
}): Promise<string[]> {
  return asSystem(async (c) => {
    const conditions = [eq(userInteractions.npcId, params.npcId)];
    if (params.window) {
      conditions.push(gte(userInteractions.timestamp, params.window.startDate));
      conditions.push(lte(userInteractions.timestamp, params.window.endDate));
    }

    const interactions = await c
      .selectDistinct({ userId: userInteractions.userId })
      .from(userInteractions)
      .where(and(...conditions));

    const ids = interactions.map((i) => i.userId);

    if (params.mergeRecentCloseTraders) {
      const startDate =
        params.window?.startDate ?? params.defaultTradingWindow.startDate;
      const endDate =
        params.window?.endDate ?? params.defaultTradingWindow.endDate;

      const traders = await c
        .selectDistinct({ userId: agentTrades.agentUserId })
        .from(agentTrades)
        .where(
          and(
            eq(agentTrades.action, 'close'),
            gte(agentTrades.executedAt, startDate),
            lte(agentTrades.executedAt, endDate)
          )
        );

      for (const trader of traders) {
        if (!ids.includes(trader.userId)) {
          ids.push(trader.userId);
        }
      }
    }

    return ids;
  }, 'npc-tracker-top-engaged-users');
}

export async function listDistinctNpcIdsForUserInteractions(params: {
  userId: string;
  window?: { startDate: Date; endDate: Date };
}): Promise<string[]> {
  const conditions = [eq(userInteractions.userId, params.userId)];
  if (params.window) {
    conditions.push(gte(userInteractions.timestamp, params.window.startDate));
    conditions.push(lte(userInteractions.timestamp, params.window.endDate));
  }

  const interactions = await asSystem(
    async (c) =>
      c
        .selectDistinct({ npcId: userInteractions.npcId })
        .from(userInteractions)
        .where(and(...conditions)),
    'npc-tracker-user-engaged-npcs'
  );

  return interactions.map((i) => i.npcId);
}
