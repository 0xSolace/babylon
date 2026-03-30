import {
  authenticateWithDbUser,
  BusinessLogicError,
  getOnChainPredictionMarketService,
} from '@babylon/api';
import { PredictionPricing } from '@babylon/core/markets/prediction';
import { db } from '@babylon/db';
import type { NextRequest } from 'next/server';
import type { Address, Hex } from 'viem';

type PredictionTradeSide = 'YES' | 'NO';

type PredictionTradeSync =
  | {
      kind: 'buy';
      side: PredictionTradeSide;
      sharesDelta: number;
      collateralDelta: number;
    }
  | {
      kind: 'switch';
      fromSide: PredictionTradeSide;
      sharesIn: number;
      sharesOut: number;
    }
  | {
      kind: 'claim';
    };

type ExistingPosition = Awaited<
  ReturnType<typeof db.position.findMany>
>[number];

function normalizeAmount(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

function sideFlag(side: PredictionTradeSide): boolean {
  return side === 'YES';
}

function findExistingPosition(
  positions: ExistingPosition[],
  side: PredictionTradeSide
): ExistingPosition | undefined {
  return positions.find((position) => position.side === sideFlag(side));
}

function normalizedPositionId(
  marketId: string,
  side: PredictionTradeSide,
  walletAddress: Address
): string {
  return `onchain-${marketId}-${side.toLowerCase()}-${walletAddress.toLowerCase()}`;
}

function computeAvgPrice(params: {
  side: PredictionTradeSide;
  currentShares: number;
  fallbackPrice: number;
  existing?: ExistingPosition;
  oppositeExisting?: ExistingPosition;
  trade?: PredictionTradeSync;
}): number {
  if (params.currentShares <= 0) {
    return 0;
  }

  const existingAvg =
    params.existing !== undefined
      ? Number(params.existing.avgPrice)
      : params.fallbackPrice;
  const existingShares =
    params.existing !== undefined ? Number(params.existing.shares) : 0;

  if (
    params.trade?.kind === 'buy' &&
    params.trade.side === params.side &&
    params.trade.sharesDelta > 0
  ) {
    const totalCost =
      existingShares * existingAvg + params.trade.collateralDelta;
    const totalShares = existingShares + params.trade.sharesDelta;

    return totalShares > 0 ? totalCost / totalShares : params.fallbackPrice;
  }

  if (
    params.trade?.kind === 'switch' &&
    params.trade.fromSide !== params.side &&
    params.trade.sharesOut > 0
  ) {
    const fromExisting = params.oppositeExisting;
    const transferredAvg =
      fromExisting !== undefined
        ? Number(fromExisting.avgPrice)
        : params.fallbackPrice;
    const transferredCost = params.trade.sharesIn * transferredAvg;
    const retainedShares = Math.max(
      params.currentShares - params.trade.sharesOut,
      0
    );
    const retainedCost =
      existingShares > 0 && retainedShares > 0
        ? Math.min(existingShares, retainedShares) * existingAvg
        : 0;
    const totalCost = retainedCost + transferredCost;

    return params.currentShares > 0
      ? totalCost / params.currentShares
      : params.fallbackPrice;
  }

  return existingAvg;
}

async function upsertPredictionPosition(params: {
  userId: string;
  marketId: string;
  walletAddress: Address;
  side: PredictionTradeSide;
  shares: number;
  avgPrice: number;
  existing?: ExistingPosition;
}): Promise<void> {
  if (params.shares <= 0) {
    if (params.existing) {
      await db.position.delete({ where: { id: params.existing.id } });
    }
    return;
  }

  const positionId =
    params.existing?.id ??
    normalizedPositionId(params.marketId, params.side, params.walletAddress);
  const amount = params.shares * params.avgPrice;

  await db.position.upsert({
    where: { id: positionId },
    update: {
      shares: String(params.shares),
      avgPrice: String(params.avgPrice),
      amount: String(amount),
      status: 'active',
      updatedAt: new Date(),
    },
    create: {
      id: positionId,
      userId: params.userId,
      marketId: params.marketId,
      side: sideFlag(params.side),
      shares: String(params.shares),
      avgPrice: String(params.avgPrice),
      amount: String(amount),
      status: 'active',
      updatedAt: new Date(),
    },
  });
}

export async function resolvePredictionTradeContext(
  request: NextRequest,
  marketId: string,
  walletAddress: string
): Promise<{
  userId: string;
  marketKey: Hex;
  walletAddress: Address;
  service: ReturnType<typeof getOnChainPredictionMarketService>;
}> {
  const authUser = await authenticateWithDbUser(request);
  const normalizedWallet = walletAddress.toLowerCase() as Address;

  const [userRecord, marketRecord] = await Promise.all([
    db.user.findUnique({
      where: { id: authUser.dbUserId },
      select: { walletAddress: true },
    }),
    db.market.findUnique({
      where: { id: marketId },
      select: {
        onChainMarketId: true,
      },
    }),
  ]);

  if (
    !userRecord?.walletAddress ||
    userRecord.walletAddress.toLowerCase() !== normalizedWallet
  ) {
    throw new BusinessLogicError('Wallet address mismatch', 'WALLET_MISMATCH');
  }

  if (!marketRecord?.onChainMarketId) {
    throw new BusinessLogicError(
      'Market is not live on-chain',
      'MARKET_NOT_ONCHAIN'
    );
  }

  return {
    userId: authUser.dbUserId,
    marketKey: marketRecord.onChainMarketId as Hex,
    walletAddress: normalizedWallet,
    service: getOnChainPredictionMarketService(),
  };
}

export async function syncPredictionOnchainState(params: {
  userId: string;
  marketId: string;
  marketKey: Hex;
  walletAddress: Address;
  trade?: PredictionTradeSync;
}): Promise<{
  decimals: number;
  marketAddress: Address;
  marketState: number;
  marketOutcome: number;
  yesShares: number;
  noShares: number;
  liquidity: number;
  yesProbability: number;
  noProbability: number;
  userYesShares: number;
  userNoShares: number;
}> {
  const service = getOnChainPredictionMarketService();
  const [marketSnapshot, userPosition, decimals, existingPositions] =
    await Promise.all([
      service.getMarket(params.marketKey),
      service.getPosition(params.walletAddress, params.marketKey),
      service.getCollateralDecimals(),
      db.position.findMany({
        where: {
          userId: params.userId,
          marketId: params.marketId,
        },
      }),
    ]);

  const yesShares = normalizeAmount(marketSnapshot.reserveYes, decimals);
  const noShares = normalizeAmount(marketSnapshot.reserveNo, decimals);
  const liquidity = normalizeAmount(marketSnapshot.liquidity, decimals);
  const userYesShares = normalizeAmount(userPosition.yesBalance, decimals);
  const userNoShares = normalizeAmount(userPosition.noBalance, decimals);
  const yesProbability = Number(marketSnapshot.priceYesWad) / 1e18;
  const noProbability = Number(marketSnapshot.priceNoWad) / 1e18;

  const existingYes = findExistingPosition(existingPositions, 'YES');
  const existingNo = findExistingPosition(existingPositions, 'NO');
  const fallbackYesPrice = PredictionPricing.getCurrentPrice(
    yesShares,
    noShares,
    'yes'
  );
  const fallbackNoPrice = PredictionPricing.getCurrentPrice(
    yesShares,
    noShares,
    'no'
  );

  const nextYesAvgPrice =
    params.trade?.kind === 'claim'
      ? 0
      : computeAvgPrice({
          side: 'YES',
          currentShares: userYesShares,
          fallbackPrice: fallbackYesPrice,
          existing: existingYes,
          oppositeExisting: existingNo,
          trade: params.trade,
        });
  const nextNoAvgPrice =
    params.trade?.kind === 'claim'
      ? 0
      : computeAvgPrice({
          side: 'NO',
          currentShares: userNoShares,
          fallbackPrice: fallbackNoPrice,
          existing: existingNo,
          oppositeExisting: existingYes,
          trade: params.trade,
        });

  await Promise.all([
    upsertPredictionPosition({
      userId: params.userId,
      marketId: params.marketId,
      walletAddress: params.walletAddress,
      side: 'YES',
      shares: userYesShares,
      avgPrice: nextYesAvgPrice,
      existing: existingYes,
    }),
    upsertPredictionPosition({
      userId: params.userId,
      marketId: params.marketId,
      walletAddress: params.walletAddress,
      side: 'NO',
      shares: userNoShares,
      avgPrice: nextNoAvgPrice,
      existing: existingNo,
    }),
    db.market.update({
      where: { id: params.marketId },
      data: {
        yesShares: String(yesShares),
        noShares: String(noShares),
        liquidity: String(liquidity),
        updatedAt: new Date(),
      },
    }),
  ]);

  return {
    decimals,
    marketAddress: marketSnapshot.marketAddress,
    marketState: marketSnapshot.state,
    marketOutcome: marketSnapshot.outcome,
    yesShares,
    noShares,
    liquidity,
    yesProbability,
    noProbability,
    userYesShares,
    userNoShares,
  };
}
