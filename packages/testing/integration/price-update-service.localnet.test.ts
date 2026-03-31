import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { loadDeploymentFromDisk } from '@babylon/contracts/deployment/validation-node';
import {
  and,
  db,
  eq,
  inArray,
  isNull,
  organizationState,
  perpMarketSnapshots,
  perpPositions,
  users,
} from '@babylon/db';
import {
  calculateNotionalFromBaseSize,
  OnchainPerpService,
  PriceUpdateService,
  sendOnchainPerpCalls,
  syncOnchainPerpMarketSnapshots,
} from '@babylon/engine';
import { ERC20_MINIMAL_ABI } from '@babylon/shared';
import {
  type Address,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  type Hex,
  http,
  parseAbi,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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

function fromPriceUnits(value: bigint): number {
  return Number(formatUnits(value, 8));
}

localnetDescribe('PriceUpdateService onchain runtime flow', () => {
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
    'publishes batched futures prices onchain, executes queued orders, and syncs the read model',
    async () => {
      const walletPrivateKey = `0x${randomBytes(32).toString('hex')}` as Hex;
      const walletAccount = privateKeyToAccount(walletPrivateKey);
      const userId = `localnet-price-update-${Date.now()}`;

      await db.insert(users).values({
        id: userId,
        walletAddress: walletAccount.address.toLowerCase(),
        displayName: 'Localnet Price Update User',
        updatedAt: new Date(),
      });

      await fundGas(walletAccount.address);
      await mintUsdc(
        walletAccount.address,
        `mint-usdc-${walletAccount.address}`
      );
      await syncOnchainPerpMarketSnapshots(service);

      const [ethMarket, msftMarket] = await Promise.all([
        service.findMarketBySymbol('ETH'),
        service.findMarketBySymbol('MSFT'),
      ]);
      const [ethVersionBeforeOpen, msftVersionBefore] = await Promise.all([
        service.getLatestOracleVersion(ethMarket.id, ethMarket.latestVersion),
        service.getLatestOracleVersion(msftMarket.id, msftMarket.latestVersion),
      ]);
      const [ethSnapshotRow, msftSnapshotRow] = await db
        .select({
          ticker: perpMarketSnapshots.ticker,
          organizationId: perpMarketSnapshots.organizationId,
        })
        .from(perpMarketSnapshots)
        .where(inArray(perpMarketSnapshots.ticker, ['ETH', 'MSFT']));

      if (!ethSnapshotRow || !msftSnapshotRow) {
        throw new Error('Perp market snapshot rows for ETH/MSFT are missing');
      }

      const ethSnapshot =
        ethSnapshotRow.ticker.toUpperCase() === 'ETH'
          ? ethSnapshotRow
          : msftSnapshotRow;
      const msftSnapshot =
        ethSnapshotRow.ticker.toUpperCase() === 'MSFT'
          ? ethSnapshotRow
          : msftSnapshotRow;

      const minimumNotionalUsd = getMinimumOrderNotionalUsd(
        ethVersionBeforeOpen.price,
        ethMarket.minTradeSize
      );
      const openOrder = await service.prepareOpenOrder({
        account: walletAccount.address,
        ticker: ethMarket.symbol,
        side: 'long',
        sizeUsd: Math.max(Math.ceil(minimumNotionalUsd * 2), 1000),
        leverage: Math.min(2, Math.floor(10_000 / ethMarket.initialMarginBps)),
        orderType: 'market',
      });

      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: walletPrivateKey,
        calls: openOrder.calls,
      });

      const activeOrderIdsAfterOpen = await service.getActiveOrderIds();
      expect(activeOrderIdsAfterOpen).toContain(openOrder.orderId);

      const firstAppliedUpdates = await PriceUpdateService.applyUpdates([
        {
          organizationId: ethSnapshot.organizationId,
          newPrice: fromPriceUnits(ethVersionBeforeOpen.price) + 25,
          source: 'system',
          metadata: { ticker: 'ETH' },
        },
        {
          organizationId: msftSnapshot.organizationId,
          newPrice: fromPriceUnits(msftVersionBefore.price) + 5,
          source: 'system',
          metadata: { ticker: 'MSFT' },
        },
      ]);

      expect(firstAppliedUpdates).toHaveLength(2);

      const ethFirstUpdate = firstAppliedUpdates.find(
        (update) => update.organizationId === ethSnapshot.organizationId
      );
      const msftFirstUpdate = firstAppliedUpdates.find(
        (update) => update.organizationId === msftSnapshot.organizationId
      );
      expect(ethFirstUpdate).toBeDefined();
      expect(msftFirstUpdate).toBeDefined();
      if (!ethFirstUpdate || !msftFirstUpdate) {
        throw new Error('Expected ETH and MSFT runtime price updates to apply');
      }

      const [ethMarketAfterOpen, msftMarketAfterFirstUpdate] =
        await Promise.all([
          service.getMarket(ethMarket.id),
          service.getMarket(msftMarket.id),
        ]);
      const [ethVersionAfterOpen, msftVersionAfterFirstUpdate] =
        await Promise.all([
          service.getLatestOracleVersion(
            ethMarket.id,
            ethMarketAfterOpen.latestVersion
          ),
          service.getLatestOracleVersion(
            msftMarket.id,
            msftMarketAfterFirstUpdate.latestVersion
          ),
        ]);

      expect(ethVersionAfterOpen.version).toBeGreaterThan(
        ethVersionBeforeOpen.version
      );
      expect(msftVersionAfterFirstUpdate.version).toBeGreaterThan(
        msftVersionBefore.version
      );
      expect(ethVersionAfterOpen.price).toBe(
        BigInt(Math.round(ethFirstUpdate.newPrice * 10 ** 8))
      );
      expect(msftVersionAfterFirstUpdate.price).toBe(
        BigInt(Math.round(msftFirstUpdate.newPrice * 10 ** 8))
      );

      const executableAfterRuntimePublish = await service.getExecutableOrders();
      expect(
        executableAfterRuntimePublish.map((order) => order.id)
      ).not.toContain(openOrder.orderId);

      const openPosition = await service.getPosition(
        walletAccount.address,
        ethMarket.id
      );
      expect(openPosition).not.toBeNull();

      const stateRows = await db
        .select({
          id: organizationState.id,
          currentPrice: organizationState.currentPrice,
        })
        .from(organizationState)
        .where(
          inArray(organizationState.id, [
            ethSnapshot.organizationId,
            msftSnapshot.organizationId,
          ])
        );

      const stateByOrganizationId = new Map(
        stateRows.map((row) => [row.id, row] as const)
      );
      const ethStateRow = stateByOrganizationId.get(ethSnapshot.organizationId);
      const msftStateRow = stateByOrganizationId.get(
        msftSnapshot.organizationId
      );
      if (!ethStateRow || !msftStateRow) {
        throw new Error(
          'Expected organizationState rows for ETH and MSFT after runtime publish'
        );
      }

      expect([...stateByOrganizationId.keys()].sort()).toEqual(
        [ethSnapshot.organizationId, msftSnapshot.organizationId].sort()
      );
      expect(ethStateRow.currentPrice).toBeCloseTo(ethFirstUpdate.newPrice, 6);
      expect(msftStateRow.currentPrice).toBeCloseTo(
        msftFirstUpdate.newPrice,
        6
      );

      const snapshotRows = await db
        .select({
          ticker: perpMarketSnapshots.ticker,
          currentPrice: perpMarketSnapshots.currentPrice,
          indexPrice: perpMarketSnapshots.indexPrice,
        })
        .from(perpMarketSnapshots)
        .where(inArray(perpMarketSnapshots.ticker, ['ETH', 'MSFT']));

      const snapshotByTicker = new Map(
        snapshotRows.map((row) => [row.ticker, row] as const)
      );
      const ethPerpSnapshot = snapshotByTicker.get('ETH');
      const msftPerpSnapshot = snapshotByTicker.get('MSFT');
      if (!ethPerpSnapshot || !msftPerpSnapshot) {
        throw new Error(
          'Expected perp market snapshots for ETH and MSFT after runtime publish'
        );
      }

      expect([...snapshotByTicker.keys()].sort()).toEqual(['ETH', 'MSFT']);
      expect(ethPerpSnapshot.currentPrice).toBeCloseTo(
        ethFirstUpdate.newPrice,
        6
      );
      expect(ethPerpSnapshot.indexPrice).toBeCloseTo(
        ethFirstUpdate.newPrice,
        6
      );
      expect(msftPerpSnapshot.currentPrice).toBeCloseTo(
        msftFirstUpdate.newPrice,
        6
      );

      const [syncedOpenRow] = await db
        .select({
          id: perpPositions.id,
          ticker: perpPositions.ticker,
          currentPrice: perpPositions.currentPrice,
          settledToChain: perpPositions.settledToChain,
          closedAt: perpPositions.closedAt,
        })
        .from(perpPositions)
        .where(
          and(
            eq(perpPositions.userId, userId),
            eq(perpPositions.settledToChain, true),
            isNull(perpPositions.closedAt)
          )
        )
        .limit(1);

      expect(syncedOpenRow).toBeDefined();
      expect(syncedOpenRow?.ticker).toBe('ETH');
      expect(syncedOpenRow?.settledToChain).toBe(true);
      expect(syncedOpenRow?.currentPrice).toBeCloseTo(
        ethFirstUpdate!.newPrice,
        6
      );

      const closeOrder = await service.prepareCloseOrder({
        account: walletAccount.address,
        marketId: ethMarket.id,
        percentage: 1,
        orderType: 'market',
      });

      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: walletPrivateKey,
        calls: closeOrder.calls,
      });

      const activeOrderIdsBeforeCloseTrigger =
        await service.getActiveOrderIds();
      expect(activeOrderIdsBeforeCloseTrigger).toContain(closeOrder.orderId);

      const executableBeforeClose = await service.getExecutableOrders();
      expect(executableBeforeClose.map((order) => order.id)).not.toContain(
        closeOrder.orderId
      );

      const secondAppliedUpdates = await PriceUpdateService.applyUpdates([
        {
          organizationId: ethSnapshot.organizationId,
          newPrice: fromPriceUnits(ethVersionAfterOpen.price) + 40,
          source: 'system',
          metadata: { ticker: 'ETH' },
        },
      ]);

      expect(secondAppliedUpdates).toHaveLength(1);

      const ethSecondUpdate = secondAppliedUpdates[0];
      if (!ethSecondUpdate) {
        throw new Error('Expected a runtime close update for ETH');
      }
      const ethMarketAfterClose = await service.getMarket(ethMarket.id);
      const ethVersionAfterClose = await service.getLatestOracleVersion(
        ethMarket.id,
        ethMarketAfterClose.latestVersion
      );
      expect(ethVersionAfterClose.version).toBeGreaterThan(
        ethVersionAfterOpen.version
      );
      expect(ethVersionAfterClose.price).toBe(
        BigInt(Math.round(ethSecondUpdate.newPrice * 10 ** 8))
      );

      expect(
        await service.getPosition(walletAccount.address, ethMarket.id)
      ).toBeNull();

      const executableAfterClose = await service.getExecutableOrders();
      expect(executableAfterClose.map((order) => order.id)).not.toContain(
        closeOrder.orderId
      );

      const [closedRow] = await db
        .select({
          id: perpPositions.id,
          currentPrice: perpPositions.currentPrice,
          closedAt: perpPositions.closedAt,
        })
        .from(perpPositions)
        .where(eq(perpPositions.userId, userId))
        .orderBy(perpPositions.lastUpdated)
        .limit(1);

      expect(closedRow).toBeDefined();
      expect(closedRow?.closedAt).not.toBeNull();
      expect(closedRow?.currentPrice).toBeCloseTo(ethSecondUpdate.newPrice, 6);
    }
  );
});
