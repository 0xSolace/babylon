import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { loadDeploymentFromDisk } from '@babylon/contracts/deployment/validation-node';
import {
  calculateNotionalFromBaseSize,
  calculatePositionPnl,
  normalizeCollateralFromRaw,
  OnchainPerpService,
  sendOnchainPerpCalls,
} from '@babylon/engine';
import { ERC20_MINIMAL_ABI, PERP_VIEW_ABI } from '@babylon/shared';
import {
  type Address,
  encodeFunctionData,
  type Hex,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  configureLocalChainEnvironment,
  ensureContractsReady,
  getLocalRpcUrl,
} from '../helpers/contract-setup';

const DEPLOYER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ORACLE_PRIVATE_KEY =
  '0x1111111111111111111111111111111111111111111111111111111111111111';
const LOCALNET_USDC_MINT_AMOUNT = 25_000_000_000n;
const ERC20_INTERFACE = parseAbi([...ERC20_MINIMAL_ABI]);
const PERP_VIEW_INTERFACE = parseAbi([...PERP_VIEW_ABI]);
const BPS = 10_000n;

setDefaultTimeout(300_000);

const localnetDescribe =
  process.env.BABYLON_RUN_LOCALNET_TESTS === '1' ? describe : describe.skip;

function calculateReduceSettlement(params: {
  positionCollateral: bigint;
  positionSize: bigint;
  closeSize: bigint;
  pnl: bigint;
  closeFee: bigint;
}): bigint {
  const totalEquity = params.positionCollateral + params.pnl;
  const equitySlice = (totalEquity * params.closeSize) / params.positionSize;
  return equitySlice - params.closeFee;
}

localnetDescribe('Onchain perp exactness', () => {
  let service: OnchainPerpService;
  let oraclePublisherPrivateKey: Hex;

  async function setWalletEthBalance(address: Address, value: bigint) {
    await (
      service.publicClient as {
        request: (request: {
          method: string;
          params?: unknown[];
        }) => Promise<unknown>;
      }
    ).request({
      method: 'anvil_setBalance',
      params: [address, `0x${value.toString(16)}`],
    });
  }

  async function mintUsdc(
    recipient: Address,
    description: string,
    amount: bigint = LOCALNET_USDC_MINT_AMOUNT
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
            args: [recipient, amount],
          }),
          description,
        },
      ],
    });
  }

  async function publishOracleVersion(marketId: Hex, price: bigint) {
    const market = await service.getMarket(marketId);
    const latestVersion = await service.getLatestOracleVersion(
      marketId,
      market.latestVersion
    );
    const nextTimestamp = latestVersion.timestamp + 1;

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: oraclePublisherPrivateKey,
      calls: [
        await service.publishOraclePrices({
          marketIds: [marketId],
          prices: [price],
          timestamp: nextTimestamp,
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

    const engineConfig = await service.getEngineConfig();
    const oracleUpdater = engineConfig.oracleUpdater.toLowerCase();
    const deployerAddress = privateKeyToAccount(
      DEPLOYER_PRIVATE_KEY as Hex
    ).address.toLowerCase();
    const oracleAddress = privateKeyToAccount(
      ORACLE_PRIVATE_KEY as Hex
    ).address.toLowerCase();

    if (oracleUpdater === oracleAddress) {
      oraclePublisherPrivateKey = ORACLE_PRIVATE_KEY as Hex;
    } else if (oracleUpdater === deployerAddress) {
      oraclePublisherPrivateKey = DEPLOYER_PRIVATE_KEY as Hex;
    } else {
      throw new Error(`Unsupported oracle updater ${engineConfig.oracleUpdater}`);
    }
  });

  test.serial(
    'single-user open and close math matches preview prices, fees, and onchain settlement exactly',
    async () => {
      const traderPrivateKey = `0x${randomBytes(32).toString('hex')}` as Hex;
      const traderAccount = privateKeyToAccount(traderPrivateKey);
      const market = await service.findMarketBySymbol('ETH');
      const latestBeforeOpen = await service.getLatestOracleVersion(
        market.id,
        market.latestVersion
      );

      await setWalletEthBalance(traderAccount.address, 5n * 10n ** 18n);
      await mintUsdc(
        traderAccount.address,
        `mint-exactness-usdc-${traderAccount.address}`
      );

      const openOrder = await service.prepareOpenOrder({
        account: traderAccount.address,
        ticker: market.symbol,
        side: 'long',
        sizeUsd: Math.max(
          Math.ceil(
            (Number(
              calculateNotionalFromBaseSize(
                market.minTradeSize,
                latestBeforeOpen.price
              )
            ) /
              10 ** 18) *
              2
          ),
          1000
        ),
        leverage: Math.min(2, Math.floor(10_000 / market.initialMarginBps)),
        orderType: 'market',
      });

      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: traderPrivateKey,
        calls: openOrder.calls,
      });

      await publishOracleVersion(market.id, latestBeforeOpen.price);
      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: DEPLOYER_PRIVATE_KEY as Hex,
        calls: [await service.buildExecuteOrderCall(openOrder.orderId)],
      });

      const engineConfig = await service.getEngineConfig();
      const openingCollateralDust =
        normalizeCollateralFromRaw(
          openOrder.collateralRequiredRaw,
          engineConfig.collateralDecimals
        ) - openOrder.collateralRequired;

      const openPosition = await service.getPosition(traderAccount.address, market.id);
      expect(openPosition).not.toBeNull();
      if (!openPosition) {
        throw new Error('Expected position to exist after opening');
      }

      expect(openPosition.side).toBe('long');
      expect(openPosition.size).toBe(openOrder.sizeDelta);
      expect(openPosition.entryPrice).toBe(openOrder.estimatedExecutionPrice);
      expect(openPosition.collateral).toBe(
        openOrder.collateralRequired - openOrder.estimatedFee
      );
      expect(await service.getFreeCollateral(traderAccount.address)).toBe(
        openingCollateralDust
      );

      const closeOrder = await service.prepareCloseOrder({
        account: traderAccount.address,
        marketId: market.id,
        orderType: 'market',
      });

      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: traderPrivateKey,
        calls: closeOrder.calls,
      });

      await publishOracleVersion(market.id, latestBeforeOpen.price);

      const marketBeforeCloseExecution = await service.getMarket(market.id);
      const closeVersion = await service.getLatestOracleVersion(
        market.id,
        marketBeforeCloseExecution.latestVersion
      );
      const closePreviewPrice = (await service.publicClient.readContract({
        address: service.diamondAddress,
        abi: PERP_VIEW_INTERFACE,
        functionName: 'previewPerpExecutionPrice',
        args: [market.id, closeVersion.price, 0, true, openPosition.size],
      })) as bigint;
      const closeNotional = calculateNotionalFromBaseSize(
        openPosition.size,
        closePreviewPrice
      );
      const closeFee = (closeNotional * BigInt(market.closeFeeBps)) / BPS;
      const realizedPnl = calculatePositionPnl({
        position: openPosition,
        price: closePreviewPrice,
        cumulativeFunding: closeVersion.cumulativeFunding,
      });
      const expectedSettlement = calculateReduceSettlement({
        positionCollateral: openPosition.collateral,
        positionSize: openPosition.size,
        closeSize: openPosition.size,
        pnl: realizedPnl,
        closeFee,
      });

      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: DEPLOYER_PRIVATE_KEY as Hex,
        calls: [await service.buildExecuteOrderCall(closeOrder.orderId)],
      });

      expect(await service.getPosition(traderAccount.address, market.id)).toBeNull();
      expect(await service.getFreeCollateral(traderAccount.address)).toBe(
        openingCollateralDust + expectedSettlement
      );
    }
  );
});
