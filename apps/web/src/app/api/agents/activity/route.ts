/**
 * All Agents Activity API
 *
 * @route GET /api/agents/activity - Get activity from all user's agents
 * @access Authenticated
 *
 * @description
 * Returns recent activity from all agents owned by the authenticated user.
 * Used for the "My Moves" dashboard showing aggregate agent activity.
 */

import { authenticateUser, withErrorHandling } from '@babylon/api';
import {
  selectAgentTradesActivityForAgentsOrderExecutedDescLimit,
  selectCommentsForAuthorsOrderCreatedDescLimit,
  selectManagedAgentsDisplayRows,
  selectMarketQuestionsByIds,
  selectPostsForAuthorsOrderCreatedDescLimit,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import { toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  type: z.enum(['all', 'trade', 'post', 'comment']).optional().default('all'),
});

interface AgentInfo {
  id: string;
  name: string;
  profileImageUrl: string | null;
}

interface TradeActivity {
  type: 'trade';
  id: string;
  timestamp: string;
  agent: AgentInfo;
  data: {
    tradeId: string;
    marketType: 'prediction' | 'perp';
    marketId: string | null;
    ticker: string | null;
    marketQuestion: string | null;
    action: string;
    side: string | null;
    amount: number;
    price: number;
    pnl: number | null;
    reasoning: string | null;
  };
}

interface PostActivity {
  type: 'post';
  id: string;
  timestamp: string;
  agent: AgentInfo;
  data: {
    postId: string;
    contentPreview: string;
  };
}

interface CommentActivity {
  type: 'comment';
  id: string;
  timestamp: string;
  agent: AgentInfo;
  data: {
    commentId: string;
    postId: string;
    contentPreview: string;
    parentCommentId: string | null;
  };
}

type AgentActivity = TradeActivity | PostActivity | CommentActivity;

export const GET = withErrorHandling(async function GET(req: NextRequest) {
  const user = await authenticateUser(req);

  const { searchParams } = new URL(req.url);
  const { limit, type } = QuerySchema.parse({
    limit: searchParams.get('limit'),
    type: searchParams.get('type'),
  });

  const {
    ownedAgents,
    trades,
    marketsData,
    agentPosts,
    agentComments,
    mightHaveMore,
  } = await asUser(user.id, async (tx) => {
    const agentRows = await selectManagedAgentsDisplayRows(tx, user.id);

    if (agentRows.length === 0) {
      return {
        ownedAgents: agentRows,
        trades: [] as Array<{
          id: string;
          agentUserId: string;
          marketType: string;
          marketId: string | null;
          ticker: string | null;
          action: string;
          side: string | null;
          amount: number;
          price: number;
          pnl: number | null;
          reasoning: string | null;
          executedAt: Date;
        }>,
        marketsData: [] as Array<{ id: string; question: string }>,
        agentPosts: [] as Array<{
          id: string;
          authorId: string;
          content: string;
          createdAt: Date;
        }>,
        agentComments: [] as Array<{
          id: string;
          authorId: string;
          postId: string;
          content: string;
          parentCommentId: string | null;
          createdAt: Date;
        }>,
        mightHaveMore: false,
      };
    }

    const agentIds = agentRows.map((a) => a.id);
    let more = false;

    const tradeRows =
      type === 'all' || type === 'trade'
        ? await selectAgentTradesActivityForAgentsOrderExecutedDescLimit(
            tx,
            agentIds,
            limit
          )
        : [];

    if (tradeRows.length >= limit) more = true;

    const marketIds = [
      ...new Set(
        tradeRows
          .filter((t) => t.marketType === 'prediction' && t.marketId)
          .map((t) => t.marketId!)
      ),
    ];

    const marketRows =
      marketIds.length > 0
        ? await selectMarketQuestionsByIds(tx, marketIds)
        : [];

    const postRows =
      type === 'all' || type === 'post'
        ? await selectPostsForAuthorsOrderCreatedDescLimit(tx, agentIds, limit)
        : [];

    if (postRows.length >= limit) more = true;

    const commentRows =
      type === 'all' || type === 'comment'
        ? await selectCommentsForAuthorsOrderCreatedDescLimit(
            tx,
            agentIds,
            limit
          )
        : [];

    if (commentRows.length >= limit) more = true;

    return {
      ownedAgents: agentRows,
      trades: tradeRows,
      marketsData: marketRows,
      agentPosts: postRows,
      agentComments: commentRows,
      mightHaveMore: more,
    };
  });

  if (ownedAgents.length === 0) {
    return NextResponse.json({
      success: true,
      activities: [],
      pagination: {
        limit,
        count: 0,
        hasMore: false,
      },
    });
  }

  const agentMap = new Map(
    ownedAgents.map((a) => [
      a.id,
      {
        id: a.id,
        name: a.displayName ?? 'Agent',
        profileImageUrl: a.profileImageUrl,
      },
    ])
  );

  const activities: AgentActivity[] = [];

  const marketQuestions = new Map<string, string>();
  for (const m of marketsData) {
    marketQuestions.set(m.id, m.question);
  }

  for (const trade of trades) {
    const agentInfo = agentMap.get(trade.agentUserId);
    if (!agentInfo) continue;

    activities.push({
      type: 'trade',
      id: trade.id,
      timestamp: toISO(trade.executedAt),
      agent: agentInfo,
      data: {
        tradeId: trade.id,
        marketType: trade.marketType as 'prediction' | 'perp',
        marketId: trade.marketId,
        ticker: trade.ticker,
        marketQuestion: trade.marketId
          ? (marketQuestions.get(trade.marketId) ?? null)
          : null,
        action: trade.action,
        side: trade.side,
        amount: trade.amount,
        price: trade.price,
        pnl: trade.pnl,
        reasoning: trade.reasoning,
      },
    });
  }

  for (const post of agentPosts) {
    const agentInfo = agentMap.get(post.authorId);
    if (!agentInfo) continue;

    activities.push({
      type: 'post',
      id: post.id,
      timestamp: toISO(post.createdAt),
      agent: agentInfo,
      data: {
        postId: post.id,
        contentPreview: post.content.substring(0, 200),
      },
    });
  }

  for (const comment of agentComments) {
    const agentInfo = agentMap.get(comment.authorId);
    if (!agentInfo) continue;

    activities.push({
      type: 'comment',
      id: comment.id,
      timestamp: toISO(comment.createdAt),
      agent: agentInfo,
      data: {
        commentId: comment.id,
        postId: comment.postId,
        contentPreview: comment.content.substring(0, 200),
        parentCommentId: comment.parentCommentId,
      },
    });
  }

  // Sort all activities by timestamp descending
  activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Limit total results
  const limitedActivities = activities.slice(0, limit);

  // hasMore is true if combined results exceed limit OR if any individual type
  // returned >= limit results (indicating more might exist in DB)
  return NextResponse.json({
    success: true,
    activities: limitedActivities,
    pagination: {
      limit,
      count: limitedActivities.length,
      hasMore: activities.length > limit || mightHaveMore,
    },
  });
});
