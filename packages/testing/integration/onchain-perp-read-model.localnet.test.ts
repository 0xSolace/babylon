import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { loadDeploymentFromDisk } from '@babylon/contracts/deployment/validation-node';
import {
  and,
  db,
  eq,
  isNull,
  perpPositions,
  userPnLSnapshots,
  users,
} from '@babylon/db';
import {
  calculatePortfolioBreakdown,
  calculatePortfolioPnL,
  calculateNotionalFromBaseSize,
  OnchainPerpService,
  sendOnchainPerpCalls,
  syncOnchainPerpMarketSnapshots,
  syncOnchainPerpPositionsForTrackedUsers,
  TotalPointsService,
} from '@babylon/engine';
import { ERC20_MINIMAL_ABI } from '@babylon/shared';
import {
  type Address,
  createWalletClient,
  encodeFunctionData,
  type Hex,
  http,
  parseAbi,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  getHourBoundary,
  loadCurrentUserPnlMetrics,
  snapshotAllUserPnlMetrics,
} from '@/lib/wallet/pnlHistory';
import {
  configureLocalChainEnvironment,
  ensureContractsReady,
  getLocalRpcUrl,
} from '../helpers/contract-setup';

const DEPLOYER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ERC20_INTERFACE = parseAbi([...ERC20_MINIMAL_ABI]);
const LOCALNET_USDC_MINT_AMOUNT = 25_000_000_000n;

setDefaultTimeout(300_000);

const localnetDescribe =
  process.env.BABYLON_RUN_LOCALNET_TESTS === '1' ? describe : describe.skip;

localnetDescribe('Onchain perp read model sync', () => {
  let service: OnchainPerpService;

  function getMinimumOrderNotionalUsd(
    price: bigint,
    minTradeSize: bigint
  ): number {
    return (
      Number(calculateNotionalFromBaseSize(minTradeSize, price)) / 10 ** 18
    );
  }

  async function mintUsdc(
    recipient: Address,
    description: string
  ): Promise<void> {
    const { collateralToken } = await service.getEngineConfig();

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: [
        {
          to: collateralToken,
          data: encodeFunctionData({
            abi: ERC20_INTERFACE,
            functionName: 'mint',
            args: [recipient, LOCALNET_USDC_MINT_AMOUNT],
          }),
          description,
        },
      ],
    });
  }

  async function fundGas(recipient: Address): Promise<void> {
    const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as Hex);
    const chain = service.publicClient.chain;
    if (!chain) {
      throw new Error('Local chain configuration is unavailable');
    }

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(getLocalRpcUrl()),
    });

    const hash = await walletClient.sendTransaction({
      account,
      chain,
      to: recipient,
      value: parseEther('1'),
    });

    await service.publicClient.waitForTransactionReceipt({ hash });
  }

  async function setNextBlockTimestamp(minTimestamp: number): Promise<number> {
    const latestBlock = await service.publicClient.getBlock({
      blockTag: 'latest',
    });
    const nextTimestamp = Math.max(
      minTimestamp,
      Number(latestBlock.timestamp) + 1
    );

    await (
      service.publicClient as {
        request: (request: {
          method: string;
          params?: unknown[];
        }) => Promise<unknown>;
      }
    ).request({
      method: 'evm_setNextBlockTimestamp',
      params: [nextTimestamp],
    });

    return nextTimestamp;
  }

  async function publishSingleMarketPrice(params: {
    marketId: Hex;
    price: bigint;
    minTimestamp: number;
  }): Promise<void> {
    const timestamp = await setNextBlockTimestamp(params.minTimestamp);

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: [
        await service.publishOraclePrices({
          marketIds: [params.marketId],
          prices: [params.price],
          timestamp,
        }),
      ],
    });
  }

  beforeAll(async () => {
    configureLocalChainEnvironment();
    expect(await ensureContractsReady()).toBe(true);

    const deployment = await loadDeploymentFromDisk('localnet');
    if (!deployment?.contracts.diamond) {
      throw new Error('Localnet diamond deployment metadata is missing');
    }

    service = new OnchainPerpService({
      diamondAddress: deployment.contracts.diamond as Address,
      rpcUrl: getLocalRpcUrl(),
    });
  });

  test.serial(
    'syncs tracked-user open and closed positions from chain into the DB read model',
    async () => {
      const walletPrivateKey = `0x${randomBytes(32).toString('hex')}` as Hex;
      const walletAccount = privateKeyToAccount(walletPrivateKey);
      const userId = `localnet-onchain-sync-${Date.now()}`;

      await db.insert(users).values({
        id: userId,
        walletAddress: walletAccount.address.toLowerCase(),
        displayName: 'Localnet Sync User',
        updatedAt: new Date(),
      });

      await fundGas(walletAccount.address);
      await mintUsdc(
        walletAccount.address,
        `mint-usdc-${walletAccount.address}`
      );

      const market = await service.findMarketBySymbol('ETH');
      const latestVersion = await service.getLatestOracleVersion(
        market.id,
        market.latestVersion
      );
      const minimumNotionalUsd = getMinimumOrderNotionalUsd(
        latestVersion.price,
        market.minTradeSize
      );
      const sizeUsd = Math.max(Math.ceil(minimumNotionalUsd * 2), 1000);
      const leverage = Math.min(
        2,
        Math.floor(10_000 / market.initialMarginBps)
      );

      const openOrder = await service.prepareOpenOrder({
        account: walletAccount.address,
        ticker: market.symbol,
        side: 'long',
        sizeUsd,
        leverage,
        orderType: 'market',
      });

      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: walletPrivateKey,
        calls: openOrder.calls,
      });

      await publishSingleMarketPrice({
        marketId: market.id,
        price: latestVersion.price + latestVersion.price / 200n,
        minTimestamp: latestVersion.timestamp + 1,
      });

      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: DEPLOYER_PRIVATE_KEY as Hex,
        calls: [await service.buildExecuteOrderCall(openOrder.orderId)],
      });

      const syncResult = await syncOnchainPerpPositionsForTrackedUsers(service);
      expect(syncResult.syncedUsers).toBeGreaterThan(0);
      expect(syncResult.syncedPositions).toBeGreaterThan(0);
      await syncOnchainPerpMarketSnapshots(service);

      const [openRow] = await db
        .select()
        .from(perpPositions)
        .where(eq(perpPositions.userId, userId))
        .limit(1);

      expect(openRow).toBeDefined();
      expect(openRow?.settledToChain).toBe(true);
      expect(openRow?.closedAt).toBeNull();
      expect(openRow?.ticker).toBe(market.symbol);

      const portfolioPnlAfterOpen = await calculatePortfolioPnL(userId);
      expect(portfolioPnlAfterOpen).not.toBeNull();
      expect(
        Math.abs(portfolioPnlAfterOpen?.unrealizedPerpPnL ?? 0)
      ).toBeGreaterThan(0);

      const portfolioBreakdownAfterOpen =
        await calculatePortfolioBreakdown(userId);
      expect(portfolioBreakdownAfterOpen).not.toBeNull();
      expect(portfolioBreakdownAfterOpen?.positions).toBeGreaterThan(0);

      const totalPointsAfterOpen =
        await TotalPointsService.recomputeTotalPoints(userId);
      expect(totalPointsAfterOpen).toBeCloseTo(
        portfolioBreakdownAfterOpen!.totalPoints,
        6
      );

      const liveMetricsAfterOpen = await loadCurrentUserPnlMetrics([userId], {
        onPredictionPricingError: 'throw',
      });
      const openMetric = liveMetricsAfterOpen.get(userId);
      expect(openMetric).toBeDefined();
      expect(openMetric?.unrealizedPnL).toBeCloseTo(
        portfolioPnlAfterOpen!.unrealizedPerpPnL,
        6
      );
      expect(openMetric?.currentPnL).toBeCloseTo(
        portfolioPnlAfterOpen!.totalPnL,
        6
      );

      const snapshotAt = new Date();
      const createdSnapshots = await snapshotAllUserPnlMetrics(snapshotAt);
      expect(createdSnapshots).toBeGreaterThan(0);

      const [pnlSnapshotRow] = await db
        .select({
          currentPnL: userPnLSnapshots.currentPnL,
          unrealizedPnL: userPnLSnapshots.unrealizedPnL,
          snapshotAt: userPnLSnapshots.snapshotAt,
        })
        .from(userPnLSnapshots)
        .where(
          and(
            eq(userPnLSnapshots.userId, userId),
            eq(userPnLSnapshots.snapshotAt, getHourBoundary(snapshotAt))
          )
        )
        .limit(1);

      expect(pnlSnapshotRow).toBeDefined();
      expect(pnlSnapshotRow?.unrealizedPnL).toBeCloseTo(
        openMetric!.unrealizedPnL,
        6
      );
      expect(pnlSnapshotRow?.currentPnL).toBeCloseTo(
        openMetric!.currentPnL,
        6
      );

      const closeOrder = await service.prepareCloseOrder({
        account: walletAccount.address,
        marketId: market.id,
        orderType: 'market',
      });

      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: walletPrivateKey,
        calls: closeOrder.calls,
      });

      const latestAfterOpen = await service.getLatestOracleVersion(
        market.id,
        (await service.getMarket(market.id)).latestVersion
      );

      await publishSingleMarketPrice({
        marketId: market.id,
        price: latestAfterOpen.price - latestAfterOpen.price / 200n,
        minTimestamp: latestAfterOpen.timestamp + 1,
      });

      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: DEPLOYER_PRIVATE_KEY as Hex,
        calls: [await service.buildExecuteOrderCall(closeOrder.orderId)],
      });

      const closeSyncResult =
        await syncOnchainPerpPositionsForTrackedUsers(service);
      expect(closeSyncResult.syncedUsers).toBeGreaterThan(0);

      const [closedRow] = await db
        .select()
        .from(perpPositions)
        .where(eq(perpPositions.id, openRow!.id))
        .limit(1);

      expect(closedRow).toBeDefined();
      expect(closedRow?.settledToChain).toBe(true);
      expect(closedRow?.closedAt).not.toBeNull();
      expect(closedRow?.unrealizedPnL).toBe(0);
      expect(closedRow?.unrealizedPnLPercent).toBe(0);

      const remainingOpenRows = await db
        .select({ id: perpPositions.id })
        .from(perpPositions)
        .where(
          and(
            eq(perpPositions.userId, userId),
            eq(perpPositions.settledToChain, true),
            isNull(perpPositions.closedAt)
          )
      );

      expect(remainingOpenRows).toHaveLength(0);

      const portfolioPnlAfterClose = await calculatePortfolioPnL(userId);
      expect(portfolioPnlAfterClose).not.toBeNull();
      expect(portfolioPnlAfterClose?.unrealizedPerpPnL).toBe(0);

      const portfolioBreakdownAfterClose =
        await calculatePortfolioBreakdown(userId);
      expect(portfolioBreakdownAfterClose).not.toBeNull();
      expect(portfolioBreakdownAfterClose?.positions).toBe(0);

      const totalPointsAfterClose =
        await TotalPointsService.recomputeTotalPoints(userId);
      expect(totalPointsAfterClose).toBeCloseTo(
        portfolioBreakdownAfterClose!.totalPoints,
        6
      );

      const liveMetricsAfterClose = await loadCurrentUserPnlMetrics([userId], {
        onPredictionPricingError: 'throw',
      });
      const closedMetric = liveMetricsAfterClose.get(userId);
      expect(closedMetric).toBeDefined();
      expect(closedMetric?.unrealizedPnL).toBe(0);
      expect(closedMetric?.currentPnL).toBeCloseTo(
        portfolioPnlAfterClose!.totalPnL,
        6
      );
    }
  );
});
