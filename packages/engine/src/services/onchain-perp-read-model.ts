import {
  and,
  db,
  eq,
  inArray,
  isNotNull,
  isNull,
  organizations,
  perpMarketSnapshots,
  perpPositions,
  users,
} from '@babylon/db';
import { isOnchainPerpSettlementMode, logger } from '@babylon/shared';
import { type Address, formatUnits, type Hex, isAddress } from 'viem';
import {
  type OnchainPerpPositionSnapshot,
  OnchainPerpService,
} from './onchain-perp-service';

type UserWalletRow = {
  id: string;
  walletAddress: string | null;
};

type SyncedOnchainPerpPosition = OnchainPerpPositionSnapshot & {
  userId: string;
  walletAddress: Address;
};

function normalizeMaxLeverage(value: number): number {
  return Math.max(1, Math.round(value));
}

function normalizeMinOrderSize(value: number): number {
  return Math.max(1, Math.ceil(value));
}

async function getUserWalletRow(userId: string): Promise<UserWalletRow | null> {
  const [row] = await db
    .select({
      id: users.id,
      walletAddress: users.walletAddress,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row ?? null;
}

function normalizeWalletAddress(
  walletAddress: string | null | undefined
): Address | null {
  if (!walletAddress || !isAddress(walletAddress)) {
    return null;
  }

  return walletAddress.toLowerCase() as Address;
}

function buildOnchainPerpReadModelPositionId(
  walletAddress: Address,
  marketId: Hex
): string {
  return `onchain-${walletAddress.toLowerCase()}-${marketId.toLowerCase()}`;
}

export async function getOnchainPerpWalletAddressForUser(
  userId: string
): Promise<Address | null> {
  if (!isOnchainPerpSettlementMode()) {
    return null;
  }

  const row = await getUserWalletRow(userId);
  return normalizeWalletAddress(row?.walletAddress);
}

export async function getOnchainPerpAvailableBalanceForUser(
  userId: string,
  service?: OnchainPerpService
): Promise<number | null> {
  if (!isOnchainPerpSettlementMode()) {
    return null;
  }

  const walletAddress = await getOnchainPerpWalletAddressForUser(userId);
  if (!walletAddress) {
    return null;
  }

  const onchainService = service ?? new OnchainPerpService();
  const freeCollateral = await onchainService.getFreeCollateral(walletAddress);
  return Number(formatUnits(freeCollateral, 18));
}

export async function getOnchainPerpPositionSnapshotsForUser(
  userId: string,
  service?: OnchainPerpService
): Promise<SyncedOnchainPerpPosition[]> {
  if (!isOnchainPerpSettlementMode()) {
    return [];
  }

  const walletAddress = await getOnchainPerpWalletAddressForUser(userId);
  if (!walletAddress) {
    return [];
  }

  return getOnchainPerpPositionSnapshotsForWallet(
    userId,
    walletAddress,
    service
  );
}

async function getOnchainPerpPositionSnapshotsForWallet(
  userId: string,
  walletAddress: Address,
  service?: OnchainPerpService
): Promise<SyncedOnchainPerpPosition[]> {
  const onchainService = service ?? new OnchainPerpService();
  const positions = await onchainService.getPositionSnapshots(walletAddress);

  return positions.map((position) => ({
    ...position,
    userId,
    walletAddress,
  }));
}

export async function syncOnchainPerpMarketSnapshots(
  service?: OnchainPerpService
): Promise<number> {
  if (!isOnchainPerpSettlementMode()) {
    return 0;
  }

  const onchainService = service ?? new OnchainPerpService();
  const snapshots = await onchainService.getMarketSnapshots();
  if (snapshots.length === 0) {
    return 0;
  }

  const tickers = snapshots.map((snapshot) => snapshot.ticker);
  const [existingRows, organizationRows] = await Promise.all([
    db
      .select({
        ticker: perpMarketSnapshots.ticker,
        organizationId: perpMarketSnapshots.organizationId,
      })
      .from(perpMarketSnapshots)
      .where(inArray(perpMarketSnapshots.ticker, tickers)),
    db
      .select({
        id: organizations.id,
        ticker: organizations.ticker,
      })
      .from(organizations)
      .where(inArray(organizations.ticker, tickers)),
  ]);

  const organizationIdByTicker = new Map<string, string>();
  for (const row of existingRows) {
    organizationIdByTicker.set(row.ticker.toUpperCase(), row.organizationId);
  }
  for (const row of organizationRows) {
    if (!row.ticker) {
      continue;
    }
    organizationIdByTicker.set(row.ticker.toUpperCase(), row.id);
  }

  let syncedCount = 0;
  for (const snapshot of snapshots) {
    const organizationId = organizationIdByTicker.get(
      snapshot.ticker.toUpperCase()
    );
    if (!organizationId) {
      logger.warn(
        'Skipping on-chain perp market snapshot sync with no organization mapping',
        { ticker: snapshot.ticker },
        'OnchainPerpReadModel'
      );
      continue;
    }

    const maxLeverage = normalizeMaxLeverage(snapshot.maxLeverage);
    const minOrderSize = normalizeMinOrderSize(snapshot.minOrderSize);

    await db
      .insert(perpMarketSnapshots)
      .values({
        ticker: snapshot.ticker,
        organizationId,
        name: snapshot.name,
        currentPrice: snapshot.currentPrice,
        change24h: snapshot.change24h,
        changePercent24h: snapshot.changePercent24h,
        high24h: snapshot.high24h,
        low24h: snapshot.low24h,
        volume24h: snapshot.volume24h,
        openInterest: snapshot.openInterest,
        fundingRate: snapshot.fundingRate,
        maxLeverage,
        minOrderSize,
        markPrice: snapshot.markPrice,
        indexPrice: snapshot.indexPrice,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: perpMarketSnapshots.ticker,
        set: {
          organizationId,
          name: snapshot.name,
          currentPrice: snapshot.currentPrice,
          change24h: snapshot.change24h,
          changePercent24h: snapshot.changePercent24h,
          high24h: snapshot.high24h,
          low24h: snapshot.low24h,
          volume24h: snapshot.volume24h,
          openInterest: snapshot.openInterest,
          fundingRate: snapshot.fundingRate,
          maxLeverage,
          minOrderSize,
          markPrice: snapshot.markPrice,
          indexPrice: snapshot.indexPrice,
          updatedAt: new Date(),
        },
      });

    syncedCount += 1;
  }

  return syncedCount;
}

export async function syncOnchainPerpPositionsForUser(
  userId: string,
  service?: OnchainPerpService
): Promise<SyncedOnchainPerpPosition[]> {
  if (!isOnchainPerpSettlementMode()) {
    return [];
  }

  const walletAddress = await getOnchainPerpWalletAddressForUser(userId);
  if (!walletAddress) {
    return [];
  }

  const onchainService = service ?? new OnchainPerpService();
  return syncOnchainPerpPositionsForWallet(
    userId,
    walletAddress,
    onchainService
  );
}

async function syncOnchainPerpPositionsForWallet(
  userId: string,
  walletAddress: Address,
  service: OnchainPerpService
): Promise<SyncedOnchainPerpPosition[]> {
  const syncedPositions = await getOnchainPerpPositionSnapshotsForWallet(
    userId,
    walletAddress,
    service
  );
  const tickers = syncedPositions.map((position) => position.ticker);

  const [existingSnapshotRows, organizationRows] =
    tickers.length > 0
      ? await Promise.all([
          db
            .select({
              ticker: perpMarketSnapshots.ticker,
              organizationId: perpMarketSnapshots.organizationId,
            })
            .from(perpMarketSnapshots)
            .where(inArray(perpMarketSnapshots.ticker, tickers)),
          db
            .select({
              id: organizations.id,
              ticker: organizations.ticker,
            })
            .from(organizations)
            .where(inArray(organizations.ticker, tickers)),
        ])
      : [[], []];

  const organizationIdByTicker = new Map<string, string>();
  for (const row of existingSnapshotRows) {
    organizationIdByTicker.set(row.ticker.toUpperCase(), row.organizationId);
  }
  for (const row of organizationRows) {
    if (!row.ticker) {
      continue;
    }
    organizationIdByTicker.set(row.ticker.toUpperCase(), row.id);
  }

  const now = new Date();
  const openTrackedRows = await db
    .select({
      id: perpPositions.id,
    })
    .from(perpPositions)
    .where(
      and(
        eq(perpPositions.userId, userId),
        eq(perpPositions.settledToChain, true),
        isNull(perpPositions.closedAt)
      )
    );
  const openTrackedIds = new Set(openTrackedRows.map((row) => row.id));
  const syncedIds = new Set<string>();

  for (const position of syncedPositions) {
    const organizationId = organizationIdByTicker.get(
      position.ticker.toUpperCase()
    );
    if (!organizationId) {
      logger.warn(
        'Skipping on-chain perp position sync with no organization mapping',
        { ticker: position.ticker, userId },
        'OnchainPerpReadModel'
      );
      continue;
    }

    const leverage = Math.max(1, Math.round(position.leverage));
    const positionId = buildOnchainPerpReadModelPositionId(
      walletAddress,
      position.marketId
    );
    syncedIds.add(positionId);

    await db
      .insert(perpPositions)
      .values({
        id: positionId,
        userId,
        ticker: position.ticker,
        organizationId,
        side: position.side,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        size: position.size,
        leverage,
        liquidationPrice: position.liquidationPrice,
        unrealizedPnL: position.unrealizedPnL,
        unrealizedPnLPercent: position.unrealizedPnLPercent,
        fundingPaid: position.fundingPaid,
        openedAt: new Date(position.openedAt),
        lastUpdated: now,
        settledToChain: true,
        settledAt: now,
      })
      .onConflictDoUpdate({
        target: perpPositions.id,
        set: {
          ticker: position.ticker,
          organizationId,
          side: position.side,
          entryPrice: position.entryPrice,
          currentPrice: position.currentPrice,
          size: position.size,
          leverage,
          liquidationPrice: position.liquidationPrice,
          unrealizedPnL: position.unrealizedPnL,
          unrealizedPnLPercent: position.unrealizedPnLPercent,
          fundingPaid: position.fundingPaid,
          lastUpdated: now,
          closedAt: null,
          settledToChain: true,
          settledAt: now,
        },
      });
  }

  const staleTrackedIds = [...openTrackedIds].filter(
    (id) => !syncedIds.has(id)
  );
  if (staleTrackedIds.length > 0) {
    await db
      .update(perpPositions)
      .set({
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        closedAt: now,
        lastUpdated: now,
        settledAt: now,
      })
      .where(
        and(
          eq(perpPositions.userId, userId),
          eq(perpPositions.settledToChain, true),
          inArray(perpPositions.id, staleTrackedIds)
        )
      );
  }

  return syncedPositions;
}

export async function syncOnchainPerpPositionsForTrackedUsers(
  service?: OnchainPerpService
): Promise<{ syncedUsers: number; syncedPositions: number }> {
  if (!isOnchainPerpSettlementMode()) {
    return { syncedUsers: 0, syncedPositions: 0 };
  }

  const trackedUsers = await db
    .select({
      id: users.id,
      walletAddress: users.walletAddress,
    })
    .from(users)
    .where(isNotNull(users.walletAddress));

  const onchainService = service ?? new OnchainPerpService();
  let syncedUsers = 0;
  let syncedPositions = 0;

  for (const user of trackedUsers) {
    const walletAddress = normalizeWalletAddress(user.walletAddress);
    if (!walletAddress) {
      continue;
    }

    const positions = await syncOnchainPerpPositionsForWallet(
      user.id,
      walletAddress,
      onchainService
    );
    syncedUsers += 1;
    syncedPositions += positions.length;
  }

  return { syncedUsers, syncedPositions };
}
