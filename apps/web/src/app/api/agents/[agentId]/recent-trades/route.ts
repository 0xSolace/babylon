/**
 * Agent Recent Trades API
 *
 * @route GET /api/agents/[agentId]/recent-trades - Get agent's recent trades
 * @access Public
 *
 * @description
 * Returns recent trades for an agent. This endpoint is public so it can be
 * displayed on agent profile pages and banners. Only returns trade metadata,
 * not sensitive information.
 */

import {
  checkRateLimitAsync,
  getClientIp,
  RATE_LIMIT_CONFIGS,
  withErrorHandling,
} from '@babylon/api';
import {
  countAgentTradesForAgentUserId,
  countNpcTradesForNpcActorId,
  selectMarketQuestionsByIdsForRecentTrades,
  selectRecentAgentTradesForPublicProfileOrderExecutedDescLimit,
  selectRecentNpcTradesForActorOrderExecutedDescLimit,
  selectUserDisplayNameAndIsAgentById,
} from '@babylon/db';
import { asPublic } from '@babylon/db/engine-storage';
import { StaticDataRegistry } from '@babylon/engine';
import { logger, toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

interface RecentTrade {
  id: string;
  marketType: 'prediction' | 'perp';
  ticker: string | null;
  marketQuestion: string | null;
  action: 'open' | 'close';
  side: string | null;
  amount: number;
  pnl: number | null;
  executedAt: string;
}

interface RecentTradesResponse {
  success: boolean;
  agentId: string;
  agentName: string | null;
  isAgent: boolean;
  trades: RecentTrade[];
  totalTrades: number;
}

export const GET = withErrorHandling(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ agentId: string }> }
  ) => {
    // IP-based rate limiting for public endpoint
    const clientIp = getClientIp(req.headers);
    const rateLimitKey = clientIp ? `ip:${clientIp}` : 'ip:anonymous';
    const rateLimitConfig = clientIp
      ? RATE_LIMIT_CONFIGS.PUBLIC_BALANCE_FETCH
      : RATE_LIMIT_CONFIGS.PUBLIC_BALANCE_FETCH_ANONYMOUS;

    const rateLimit = await checkRateLimitAsync(rateLimitKey, rateLimitConfig);
    if (!rateLimit.allowed) {
      const retryAfterSeconds = rateLimit.retryAfter || 60;
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests',
          retryAfter: retryAfterSeconds,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const { agentId } = await params;

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      limit: searchParams.get('limit'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { limit } = parsed.data;

    // Check if this is an NPC from static registry
    const npcActor = StaticDataRegistry.getActor(agentId);
    const isNpc = !!npcActor;

    const { agentName, isValidAgent, trades, totalTrades, marketQuestions } =
      await asPublic(async (tx) => {
        let name: string | null = null;
        let validAgent = isNpc;

        if (!isNpc) {
          const userRow = await selectUserDisplayNameAndIsAgentById(
            tx,
            agentId
          );

          if (!userRow) {
            return {
              agentName: null,
              isValidAgent: false,
              trades: [],
              totalTrades: 0,
              marketQuestions: new Map<string, string>(),
            };
          }

          validAgent = userRow.isAgent ?? false;
          if (!validAgent) {
            return {
              agentName: null,
              isValidAgent: false,
              trades: [],
              totalTrades: 0,
              marketQuestions: new Map<string, string>(),
            };
          }
          name = userRow.displayName;
        } else {
          name = npcActor.name;
        }

        const tradeRows = isNpc
          ? await selectRecentNpcTradesForActorOrderExecutedDescLimit(
              tx,
              agentId,
              limit
            )
          : await selectRecentAgentTradesForPublicProfileOrderExecutedDescLimit(
              tx,
              agentId,
              limit
            );

        const total = isNpc
          ? await countNpcTradesForNpcActorId(tx, agentId)
          : await countAgentTradesForAgentUserId(tx, agentId);

        const marketIds = [
          ...new Set(
            tradeRows
              .filter((t) => t.marketType === 'prediction' && t.marketId)
              .map((t) => t.marketId!)
          ),
        ];

        const mq = new Map<string, string>();
        if (marketIds.length > 0) {
          const marketsData = await selectMarketQuestionsByIdsForRecentTrades(
            tx,
            marketIds
          );

          for (const m of marketsData) {
            mq.set(m.id, m.question);
          }
        }

        return {
          agentName: name,
          isValidAgent: validAgent,
          trades: tradeRows,
          totalTrades: total,
          marketQuestions: mq,
        };
      });

    if (!isValidAgent) {
      return NextResponse.json({
        success: true,
        agentId,
        agentName: null,
        isAgent: false,
        trades: [],
        totalTrades: 0,
      } satisfies RecentTradesResponse);
    }

    // Valid values for runtime validation
    const validMarketTypes = ['prediction', 'perp'] as const;
    const validActions = ['open', 'close'] as const;

    // Format response
    const recentTrades: RecentTrade[] = trades.map((trade) => {
      // Runtime validation with defaults
      const marketType = validMarketTypes.includes(
        trade.marketType as (typeof validMarketTypes)[number]
      )
        ? (trade.marketType as 'prediction' | 'perp')
        : 'prediction';

      const action = validActions.includes(
        trade.action as (typeof validActions)[number]
      )
        ? (trade.action as 'open' | 'close')
        : 'open';

      return {
        id: trade.id,
        marketType,
        ticker: trade.ticker,
        marketQuestion: trade.marketId
          ? (marketQuestions.get(trade.marketId) ?? null)
          : null,
        action,
        side: trade.side,
        amount: Number(trade.amount),
        pnl: trade.pnl !== null ? Number(trade.pnl) : null,
        executedAt: toISO(trade.executedAt),
      };
    });

    logger.debug(
      'Fetched recent trades for agent',
      { agentId, tradeCount: recentTrades.length },
      'GET /api/agents/[agentId]/recent-trades'
    );

    const response: RecentTradesResponse = {
      success: true,
      agentId,
      agentName,
      isAgent: isValidAgent,
      trades: recentTrades,
      totalTrades,
    };

    return NextResponse.json(response);
  }
);
