import { findUserByIdentifier } from '@babylon/api';
import { asPublic, asUser, db, eq, users } from '@babylon/db';
import { FEE_CONFIG } from '@babylon/engine/config/fees';
import { toISO, toISOOrNull } from '@babylon/shared';
import { calculatePredictionPositionSnapshot } from '@/lib/wallet/predictionPositionSnapshot';

export type UserPositionsType = 'all' | 'perp' | 'prediction';
export type UserPositionsStatus = 'open' | 'closed' | 'all';

interface UserLookup {
  id: string;
  privyId: string | null;
}

interface ViewerDb {
  perpPosition: {
    findMany: typeof db.perpPosition.findMany;
  };
  position: {
    findMany: typeof db.position.findMany;
  };
  market: {
    findMany: typeof db.market.findMany;
  };
}

export interface UserPerpPositionSnapshot {
  id: string;
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
}

export interface UserPredictionPositionSnapshot {
  id: string;
  marketId: string;
  question: string;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  currentProbability: number;
  currentValue: number;
  costBasis: number;
  unrealizedPnL: number;
  resolved: boolean;
  resolution: boolean | null;
  closesAt: string | null;
  status: string;
  createdAt: string | null;
  outcome: boolean | string | null;
  pnl: number | null;
  resolvedAt: string | null;
  isAgentPosition: boolean;
  agentId: string | null;
  agentName: string | null;
}

export interface UserPositionsSnapshot {
  perpetuals: {
    positions: UserPerpPositionSnapshot[];
    stats: {
      totalPositions: number;
      totalPnL: number;
      totalFunding: number;
    };
    total: number;
    hasMore: boolean;
  };
  predictions: {
    positions: UserPredictionPositionSnapshot[];
    stats: {
      totalPositions: number;
    };
    total: number;
    hasMore: boolean;
  };
  timestamp: string;
}

async function getCanonicalUser(userId: string): Promise<UserLookup | null> {
  return findUserByIdentifier(userId, {
    id: true,
    privyId: true,
  });
}

async function readWithViewer<T>({
  viewerUserId,
  operation,
}: {
  viewerUserId?: string | null;
  operation: (database: ViewerDb) => Promise<T>;
}): Promise<T> {
  if (viewerUserId) {
    return asUser(viewerUserId, operation);
  }

  return asPublic(operation);
}

export async function getUserPositionsSnapshot({
  userId,
  type = 'all',
  status = 'open',
  page = 1,
  limit = 20,
  viewerUserId,
}: {
  userId: string;
  type?: UserPositionsType;
  status?: UserPositionsStatus;
  page?: number;
  limit?: number;
  viewerUserId?: string | null;
}): Promise<UserPositionsSnapshot> {
  const dbUser = await getCanonicalUser(userId);
  const canonicalUserId = dbUser?.id ?? userId;
  const positionUserIds = dbUser
    ? [
        ...new Set(
          [dbUser.id, dbUser.privyId].filter((candidate): candidate is string =>
            Boolean(candidate)
          )
        ),
      ]
    : [userId];

  const closedAtFilter =
    status === 'closed' ? { not: null } : status === 'all' ? undefined : null;
  const predictionStatusFilter =
    status === 'closed' ? { in: ['closed', 'resolved'] } : undefined;

  const userAgents = await asPublic(async () => {
    return db
      .select({
        id: users.id,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.managedBy, canonicalUserId));
  });

  const agentIds = userAgents.map((agent) => agent.id);
  const agentNameById = new Map(
    userAgents.map((agent) => [agent.id, agent.displayName])
  );

  const perpWhereBase = {
    userId:
      positionUserIds.length === 1 ? canonicalUserId : { in: positionUserIds },
    ...(closedAtFilter !== undefined ? { closedAt: closedAtFilter } : {}),
  };
  const predictionWhereBase = {
    userId:
      positionUserIds.length === 1 ? canonicalUserId : { in: positionUserIds },
    ...(predictionStatusFilter ? { status: predictionStatusFilter } : {}),
  };

  const [
    userPerpPositions,
    agentPerpPositions,
    userPredictionPositions,
    agentPredictionPositions,
  ] = await Promise.all([
    readWithViewer({
      viewerUserId,
      operation: async (database) => {
        return database.perpPosition.findMany({
          where: perpWhereBase,
        });
      },
    }),
    agentIds.length > 0
      ? asPublic(async (database) => {
          return database.perpPosition.findMany({
            where: {
              userId: { in: agentIds },
              ...(closedAtFilter !== undefined
                ? { closedAt: closedAtFilter }
                : {}),
            },
          });
        })
      : Promise.resolve([]),
    readWithViewer({
      viewerUserId,
      operation: async (database) => {
        return database.position.findMany({
          where: predictionWhereBase,
        });
      },
    }),
    agentIds.length > 0
      ? asPublic(async (database) => {
          return database.position.findMany({
            where: {
              userId: { in: agentIds },
              ...(predictionStatusFilter
                ? { status: predictionStatusFilter }
                : {}),
            },
          });
        })
      : Promise.resolve([]),
  ]);

  const allPerpPositions = [
    ...userPerpPositions.map((position) => ({
      ...position,
      isAgentPosition: false,
      agentId: null as string | null,
      agentName: null as string | null,
    })),
    ...agentPerpPositions.map((position) => ({
      ...position,
      isAgentPosition: true,
      agentId: position.userId,
      agentName: agentNameById.get(position.userId) ?? null,
    })),
  ];

  const allPredictionPositions = [
    ...userPredictionPositions.map((position) => ({
      ...position,
      isAgentPosition: false,
      agentId: null as string | null,
      agentName: null as string | null,
    })),
    ...agentPredictionPositions.map((position) => ({
      ...position,
      isAgentPosition: true,
      agentId: position.userId,
      agentName: agentNameById.get(position.userId) ?? null,
    })),
  ];

  const marketIds = [
    ...new Set(allPredictionPositions.map((position) => position.marketId)),
  ];
  const markets =
    marketIds.length > 0
      ? await readWithViewer({
          viewerUserId,
          operation: async (database) => {
            return database.market.findMany({
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
          },
        })
      : [];

  const marketById = new Map(markets.map((market) => [market.id, market]));

  const mappedPerps = allPerpPositions.map((position) => ({
    id: position.id,
    ticker: position.ticker,
    side: position.side.toLowerCase() as 'long' | 'short',
    entryPrice: Number(position.entryPrice),
    currentPrice: Number(position.currentPrice),
    size: Number(position.size),
    leverage: Number(position.leverage),
    unrealizedPnL: Number(position.unrealizedPnL),
    unrealizedPnLPercent: Number(position.unrealizedPnLPercent),
    liquidationPrice: Number(position.liquidationPrice),
    fundingPaid: Number(position.fundingPaid),
    realizedPnL: Number((position as Record<string, unknown>).realizedPnL ?? 0),
    openedAt: toISO(position.openedAt),
    closedAt: toISOOrNull(position.closedAt),
    isAgentPosition: position.isAgentPosition,
    agentId: position.agentId,
    agentName: position.agentName,
  }));

  const mappedPredictions = allPredictionPositions
    .map((position) => {
      const market = marketById.get(position.marketId);
      if (!market) {
        throw new Error(
          `Missing market ${position.marketId} for position ${position.id}`
        );
      }

      const shares = Number(position.shares);
      const avgPrice = Number(position.avgPrice);
      const sideKey = position.side ? 'yes' : 'no';
      const snapshot = calculatePredictionPositionSnapshot({
        shares,
        avgPrice,
        sideKey,
        yesShares: Number(market.yesShares),
        noShares: Number(market.noShares),
        feeRate: FEE_CONFIG.TRADING_FEE_RATE,
      });

      return {
        id: position.id,
        marketId: position.marketId,
        question: market.question,
        side: (position.side ? 'YES' : 'NO') as 'YES' | 'NO',
        shares,
        avgPrice,
        currentPrice: snapshot.currentUnitPrice,
        currentProbability: snapshot.currentProbability,
        currentValue: snapshot.currentValue,
        costBasis: snapshot.costBasis,
        unrealizedPnL: snapshot.unrealizedPnL,
        resolved: market.resolved,
        resolution: market.resolution,
        closesAt: toISOOrNull(market.endDate),
        status: position.status as string,
        createdAt: toISOOrNull(position.createdAt),
        outcome: position.outcome ?? null,
        pnl: position.pnl == null ? null : Number(position.pnl),
        resolvedAt: toISOOrNull(position.resolvedAt),
        isAgentPosition: position.isAgentPosition,
        agentId: position.agentId,
        agentName: position.agentName,
      };
    })
    .filter((position) => position.shares >= 0.01);

  const perpStats = {
    totalPositions: mappedPerps.length,
    totalPnL: mappedPerps.reduce(
      (sum, position) => sum + position.unrealizedPnL,
      0
    ),
    totalFunding: mappedPerps.reduce(
      (sum, position) => sum + position.fundingPaid,
      0
    ),
  };

  const filteredPerps = type === 'prediction' ? [] : mappedPerps;
  const filteredPredictions = type === 'perp' ? [] : mappedPredictions;

  if (status === 'closed') {
    filteredPerps.sort(
      (left, right) =>
        new Date(right.closedAt ?? 0).getTime() -
        new Date(left.closedAt ?? 0).getTime()
    );
    filteredPredictions.sort(
      (left, right) =>
        new Date(right.resolvedAt ?? right.createdAt ?? 0).getTime() -
        new Date(left.resolvedAt ?? left.createdAt ?? 0).getTime()
    );
  }

  const paginatedPerps =
    status === 'closed'
      ? filteredPerps.slice((page - 1) * limit, page * limit)
      : filteredPerps;
  const paginatedPredictions =
    status === 'closed'
      ? filteredPredictions.slice((page - 1) * limit, page * limit)
      : filteredPredictions;

  return {
    perpetuals: {
      positions: paginatedPerps,
      stats:
        type === 'prediction'
          ? { totalPositions: 0, totalPnL: 0, totalFunding: 0 }
          : perpStats,
      total: filteredPerps.length,
      hasMore: page * limit < filteredPerps.length,
    },
    predictions: {
      positions: paginatedPredictions,
      stats: {
        totalPositions: filteredPredictions.length,
      },
      total: filteredPredictions.length,
      hasMore: page * limit < filteredPredictions.length,
    },
    timestamp: new Date().toISOString(),
  };
}

export function isOpenPredictionPosition(position: {
  resolved?: boolean;
  status?: string;
}) {
  return position.resolved === false && position.status === 'active';
}
