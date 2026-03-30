/**
 * User Positions API
 *
 * @route GET /api/markets/positions/[userId] - Get user positions
 * @access Public (RLS applies)
 *
 * @description
 * Returns user's positions in both perpetual markets and prediction markets.
 * Supports filtering by type and status. Includes position details, P&L, and
 * market information.
 *
 * @openapi
 * /api/markets/positions/{userId}:
 *   get:
 *     tags:
 *       - Markets
 *     summary: Get user positions
 *     description: Returns user's positions in perpetuals and prediction markets
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, perps, predictions]
 *           default: all
 *         description: Position type filter
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, closed, all]
 *           default: open
 *         description: Position status filter
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Results per page
 *     responses:
 *       200:
 *         description: Positions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 positions:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 hasMore:
 *                   type: boolean
 *       404:
 *         description: User not found
 *
 * @example
 * ```typescript
 * const response = await fetch(`/api/markets/positions/${userId}?type=all&status=open`);
 * const { positions, total } = await response.json();
 * ```
 *
 * @see {@link /lib/db/context} RLS context
 */

import {
  findUserByIdentifier,
  optionalAuth,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { asPublic, asUser, db, eq, users } from '@babylon/db';
import { FEE_CONFIG } from '@babylon/engine/config/fees';
import {
  logger,
  UserIdParamSchema,
  UserPositionsQuerySchema,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { calculatePredictionPositionSnapshot } from '@/lib/wallet/predictionPositionSnapshot';
import {
  getOnchainPerpService,
  isOnchainPerpModeEnabled,
  logOnchainPerpRoute,
  resolveManagedWalletsForUser,
} from '../../perps/_onchain';

/**
 * GET /api/markets/positions/[userId]
 * Get user's positions in perpetuals and prediction markets
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    const { userId } = UserIdParamSchema.parse(await context.params);

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      userId,
      type: searchParams.get('type') || 'all',
      status: searchParams.get('status') || 'open',
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    };
    const parsed = UserPositionsQuerySchema.parse(queryParams);
    const page = parsed.page;
    const limit = parsed.limit;

    // Optional auth - positions are public for leaderboard but RLS still applies
    const authUser = await optionalAuth(request).catch(() => null);
    const dbUser = await findUserByIdentifier(userId, {
      id: true,
      privyId: true,
    });
    const canonicalUserId = dbUser?.id ?? userId;
    const positionUserIds = dbUser
      ? [
          ...new Set(
            [dbUser.id, dbUser.privyId].filter(
              (candidate): candidate is string => Boolean(candidate)
            )
          ),
        ]
      : [userId];

    const status = parsed.status;

    // Build closedAt filter based on status query param
    const closedAtFilter =
      status === 'closed' ? { not: null } : status === 'all' ? undefined : null; // default: open

    // Build prediction status filter based on status query param
    const predictionStatusFilter =
      status === 'closed' ? { in: ['closed', 'resolved'] } : undefined; // open and all: no filter (existing behavior)

    // Get user's agents to include their positions
    const userAgents = await asPublic(async () => {
      return await db
        .select({
          id: users.id,
          displayName: users.displayName,
        })
        .from(users)
        .where(eq(users.managedBy, canonicalUserId));
    });

    const agentIds = userAgents.map((a) => a.id);
    const agentMap = new Map(userAgents.map((a) => [a.id, a.displayName]));

    const onchainPerpMode = isOnchainPerpModeEnabled();
    const mappedPerps: Array<{
      id: string;
      marketId?: string;
      ticker: string;
      side: 'long' | 'short';
      entryPrice: number;
      currentPrice: number;
      size: number;
      leverage: number;
      unrealizedPnL: number;
      unrealizedPnLPercent: number;
      liquidationPrice: number;
      fundingPaid: number;
      realizedPnL: number;
      openedAt: string;
      closedAt: string | null;
      isAgentPosition: boolean;
      agentId: string | null;
      agentName: string | null;
    }> = [];

    if (onchainPerpMode) {
      logOnchainPerpRoute('GET /api/markets/positions/[userId]');

      if (status !== 'closed') {
        const service = getOnchainPerpService();
        const [ownerWalletRow] = await asPublic(async () => {
          return await db
            .select({ walletAddress: users.walletAddress })
            .from(users)
            .where(eq(users.id, canonicalUserId))
            .limit(1);
        });
        const managedWallets =
          await resolveManagedWalletsForUser(canonicalUserId);
        const wallets = [
          ...(ownerWalletRow?.walletAddress
            ? [
                {
                  walletAddress: ownerWalletRow.walletAddress.toLowerCase(),
                  isAgentPosition: false,
                  agentId: null as string | null,
                  agentName: null as string | null,
                },
              ]
            : []),
          ...managedWallets.map((wallet) => ({
            walletAddress: wallet.walletAddress,
            isAgentPosition: true,
            agentId: wallet.userId,
            agentName: wallet.displayName,
          })),
        ];

        for (const wallet of wallets) {
          const snapshots = await service.getPositionSnapshots(
            wallet.walletAddress as `0x${string}`
          );
          for (const snapshot of snapshots) {
            mappedPerps.push({
              id: snapshot.id,
              marketId: snapshot.marketId,
              ticker: snapshot.ticker,
              side: snapshot.side,
              entryPrice: snapshot.entryPrice,
              currentPrice: snapshot.currentPrice,
              size: snapshot.size,
              leverage: snapshot.leverage,
              unrealizedPnL: snapshot.unrealizedPnL,
              unrealizedPnLPercent: snapshot.unrealizedPnLPercent,
              liquidationPrice: snapshot.liquidationPrice,
              fundingPaid: snapshot.fundingPaid,
              realizedPnL: 0,
              openedAt: snapshot.openedAt,
              closedAt: null,
              isAgentPosition: wallet.isAgentPosition,
              agentId: wallet.agentId,
              agentName: wallet.agentName,
            });
          }
        }
      }
    } else {
      const perpWhereBase = {
        userId:
          positionUserIds.length === 1
            ? canonicalUserId
            : { in: positionUserIds },
        ...(closedAtFilter !== undefined ? { closedAt: closedAtFilter } : {}),
      };

      const agentPerpWhereBase = {
        userId: { in: agentIds },
        ...(closedAtFilter !== undefined ? { closedAt: closedAtFilter } : {}),
      };

      const userPerpPositions =
        authUser && authUser.userId
          ? await asUser(authUser, async (db) => {
              return await db.perpPosition.findMany({
                where: perpWhereBase,
              });
            })
          : await asPublic(async (db) => {
              return await db.perpPosition.findMany({
                where: perpWhereBase,
              });
            });

      const agentPerpPositions =
        agentIds.length > 0
          ? await asPublic(async (db) => {
              return await db.perpPosition.findMany({
                where: agentPerpWhereBase,
              });
            })
          : [];

      const perpPositions = [
        ...userPerpPositions.map((p) => ({
          ...p,
          isAgentPosition: false,
          agentId: null as string | null,
          agentName: null as string | null,
        })),
        ...agentPerpPositions.map((p) => ({
          ...p,
          isAgentPosition: true,
          agentId: p.userId,
          agentName: agentMap.get(p.userId) ?? null,
        })),
      ];

      mappedPerps.push(
        ...perpPositions.map((p: (typeof perpPositions)[number]) => ({
          id: p.id,
          ticker: p.ticker,
          side: (p.side as string).toLowerCase() as 'long' | 'short',
          entryPrice: Number(p.entryPrice),
          currentPrice: Number(p.currentPrice),
          size: Number(p.size),
          leverage: Number(p.leverage),
          unrealizedPnL: Number(p.unrealizedPnL),
          unrealizedPnLPercent: Number(p.unrealizedPnLPercent),
          liquidationPrice: Number(p.liquidationPrice),
          fundingPaid: Number(p.fundingPaid),
          realizedPnL: Number((p as Record<string, unknown>).realizedPnL ?? 0),
          openedAt: p.openedAt.toISOString(),
          closedAt: p.closedAt?.toISOString() ?? null,
          isAgentPosition: p.isAgentPosition,
          agentId: p.agentId ?? null,
          agentName: p.agentName ?? null,
        }))
      );
    }

    // Get prediction market positions with RLS
    const predictionWhereBase = {
      userId:
        positionUserIds.length === 1
          ? canonicalUserId
          : { in: positionUserIds },
      ...(predictionStatusFilter ? { status: predictionStatusFilter } : {}),
    };

    const agentPredictionWhereBase = {
      userId: { in: agentIds },
      ...(predictionStatusFilter ? { status: predictionStatusFilter } : {}),
    };

    const userPredictionPositionsRaw =
      authUser && authUser.userId
        ? await asUser(authUser, async (db) => {
            return await db.position.findMany({
              where: predictionWhereBase,
            });
          })
        : await asPublic(async (db) => {
            return await db.position.findMany({
              where: predictionWhereBase,
            });
          });

    // Get agent prediction positions if user has agents
    const agentPredictionPositionsRaw =
      agentIds.length > 0
        ? await asPublic(async (db) => {
            return await db.position.findMany({
              where: agentPredictionWhereBase,
            });
          })
        : [];

    // Combine user and agent prediction positions with agent metadata
    const predictionPositionsRaw = [
      ...userPredictionPositionsRaw.map((p) => ({
        ...p,
        isAgentPosition: false,
        agentId: null as string | null,
        agentName: null as string | null,
      })),
      ...agentPredictionPositionsRaw.map((p) => ({
        ...p,
        isAgentPosition: true,
        agentId: p.userId,
        agentName: agentMap.get(p.userId) ?? null,
      })),
    ];

    // Get markets for positions
    const marketIds = [
      ...new Set(predictionPositionsRaw.map((p) => p.marketId)),
    ];
    const markets =
      marketIds.length > 0
        ? authUser && authUser.userId
          ? await asUser(authUser, async (db) => {
              return await db.market.findMany({
                where: {
                  id: { in: marketIds },
                },
                select: {
                  id: true,
                  question: true,
                  endDate: true,
                  resolved: true,
                  resolution: true,
                  yesShares: true,
                  noShares: true,
                },
              });
            })
          : await asPublic(async (db) => {
              return await db.market.findMany({
                where: {
                  id: { in: marketIds },
                },
                select: {
                  id: true,
                  question: true,
                  endDate: true,
                  resolved: true,
                  resolution: true,
                  yesShares: true,
                  noShares: true,
                },
              });
            })
        : [];

    const marketMap = new Map(markets.map((m) => [m.id, m]));

    // Join positions with markets
    const predictionPositions = predictionPositionsRaw.map((p) => ({
      ...p,
      Market: marketMap.get(p.marketId),
    }));

    const perpStats = {
      totalPositions: mappedPerps.length,
      totalPnL: mappedPerps.reduce((sum, p) => sum + p.unrealizedPnL, 0),
      totalFunding: mappedPerps.reduce((sum, p) => sum + p.fundingPaid, 0),
    };

    logger.info(
      'User positions fetched successfully',
      {
        userId: canonicalUserId,
        perpPositions: perpStats.totalPositions,
        predictionPositions: predictionPositions.length,
      },
      'GET /api/markets/positions/[userId]'
    );

    // Map prediction positions to response format
    const mappedPredictions = predictionPositions
      .map((p: (typeof predictionPositions)[number]) => {
        const market = p.Market;
        if (!market) return null;
        const yesShares = Number(market.yesShares);
        const noShares = Number(market.noShares);
        const shares = Number(p.shares);
        const avgPrice = Number(p.avgPrice);
        const sideKey = p.side ? 'yes' : 'no';
        const feeRate = FEE_CONFIG.TRADING_FEE_RATE;
        const {
          currentValue,
          currentUnitPrice,
          currentProbability,
          costBasis,
          unrealizedPnL,
        } = calculatePredictionPositionSnapshot({
          shares,
          avgPrice,
          sideKey,
          yesShares,
          noShares,
          feeRate,
        });

        return {
          id: p.id,
          marketId: p.marketId,
          question: market.question,
          side: p.side ? 'YES' : 'NO',
          shares,
          avgPrice,
          currentPrice: currentUnitPrice,
          currentProbability,
          currentValue,
          costBasis,
          unrealizedPnL,
          resolved: market.resolved,
          resolution: market.resolution,
          closesAt: market.endDate?.toISOString() ?? null,
          status: p.status as string,
          createdAt: p.createdAt?.toISOString() ?? null,
          outcome: p.outcome ?? null,
          pnl: p.pnl ? Number(p.pnl) : null,
          resolvedAt: p.resolvedAt?.toISOString() ?? null,
          isAgentPosition: p.isAgentPosition,
          agentId: p.agentId ?? null,
          agentName: p.agentName ?? null,
        };
      })
      .filter(
        (p): p is NonNullable<typeof p> => p !== null && p.shares >= 0.01
      );

    // Sort closed positions by date descending and apply pagination
    if (status === 'closed') {
      mappedPerps.sort(
        (a, b) =>
          new Date(b.closedAt ?? 0).getTime() -
          new Date(a.closedAt ?? 0).getTime()
      );
      mappedPredictions.sort(
        (a, b) =>
          new Date(b.resolvedAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.resolvedAt ?? a.createdAt ?? 0).getTime()
      );
    }

    const perpTotal = mappedPerps.length;
    const predictionTotal = mappedPredictions.length;

    // Apply pagination for closed positions
    const paginatedPerps =
      status === 'closed'
        ? mappedPerps.slice((page - 1) * limit, page * limit)
        : mappedPerps;
    const paginatedPredictions =
      status === 'closed'
        ? mappedPredictions.slice((page - 1) * limit, page * limit)
        : mappedPredictions;

    return successResponse({
      perpetuals: {
        positions: paginatedPerps,
        stats: perpStats,
        total: perpTotal,
        hasMore: page * limit < perpTotal,
      },
      predictions: {
        positions: paginatedPredictions,
        stats: {
          totalPositions: predictionTotal,
        },
        total: predictionTotal,
        hasMore: page * limit < predictionTotal,
      },
      timestamp: new Date().toISOString(),
    });
  }
);
