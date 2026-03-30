import { beforeAll, describe, expect, test } from 'bun:test';
import {
  calculateNotionalFromBaseSize,
  OnchainPerpService,
  sendOnchainPerpCalls,
  toPriceUnits,
} from '@babylon/engine';
import { ERC20_MINIMAL_ABI, type Hex } from '@babylon/shared';
import { encodeFunctionData, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  configureLocalChainEnvironment,
  ensureContractsReady,
  getLocalRpcUrl,
} from '../helpers/contract-setup';

const DEPLOYER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const AGENT0_PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const ERC20_INTERFACE = parseAbi([...ERC20_MINIMAL_ABI]);

describe('Localnet onchain perp flow', () => {
  let service: OnchainPerpService;
  let agent0Address: `0x${string}`;

  async function setNextBlockTimestamp(timestamp: number): Promise<void> {
    await (
      service.publicClient as {
        request: (request: {
          method: string;
          params?: unknown[];
        }) => Promise<unknown>;
      }
    ).request({
      method: 'evm_setNextBlockTimestamp',
      params: [timestamp],
    });
  }

  beforeAll(async () => {
    configureLocalChainEnvironment();
    expect(await ensureContractsReady()).toBe(true);

    service = new OnchainPerpService({ rpcUrl: getLocalRpcUrl() });
    agent0Address = privateKeyToAccount(AGENT0_PRIVATE_KEY as Hex).address;
  });

  test('opens with a market order and closes with a trigger order on localnet', async () => {
    const market = await service.findMarketBySymbol('ETH');
    const latestBeforeOpen = await service.getLatestOracleVersion(
      market.id,
      market.latestVersion
    );
    const minimumNotionalUsd =
      Number(
        calculateNotionalFromBaseSize(
          market.minTradeSize,
          latestBeforeOpen.price
        )
      ) /
      10 ** 18;
    const sizeUsd = Math.max(Math.ceil(minimumNotionalUsd * 2), 1000);
    const leverage = Math.min(2, Math.floor(10_000 / market.initialMarginBps));

    expect(await service.getPosition(agent0Address, market.id)).toBeNull();

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: [
        {
          to: (await service.getEngineConfig()).collateralToken,
          data: encodeFunctionData({
            abi: ERC20_INTERFACE,
            functionName: 'mint',
            args: [agent0Address, 25_000_000_000n],
          }),
          description: 'mint-agent0-localnet-usdc',
        },
      ],
    });

    const openOrder = await service.prepareOpenOrder({
      account: agent0Address,
      ticker: market.symbol,
      side: 'long',
      sizeUsd,
      leverage,
      orderType: 'market',
    });

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: AGENT0_PRIVATE_KEY as Hex,
      calls: openOrder.calls,
    });

    const queuedOpenOrder = await service.getOrder(openOrder.orderId);
    expect(queuedOpenOrder?.active).toBe(true);
    expect(queuedOpenOrder?.executableAtVersion).toBe(
      latestBeforeOpen.version + 1n
    );

    const openExecutionTimestamp = latestBeforeOpen.timestamp + 1;
    await setNextBlockTimestamp(openExecutionTimestamp);
    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: [
        await service.publishOraclePrices({
          marketIds: [market.id],
          prices: [latestBeforeOpen.price + latestBeforeOpen.price / 100n],
          timestamp: openExecutionTimestamp,
        }),
      ],
    });

    const executableAfterOpen = await service.getExecutableOrders();
    expect(
      executableAfterOpen.some((order) => order.id === openOrder.orderId)
    ).toBe(true);

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: [await service.buildExecuteOrderCall(openOrder.orderId)],
    });

    const openedPosition = await service.getPosition(agent0Address, market.id);
    expect(openedPosition).not.toBeNull();
    if (!openedPosition) {
      throw new Error('Expected market order execution to open a position');
    }
    expect(openedPosition.size).toBeGreaterThan(0n);

    const latestBeforeClose = await service.getLatestOracleVersion(
      market.id,
      (await service.getMarket(market.id)).latestVersion
    );
    const closeLimitPrice =
      Number(latestBeforeClose.price + latestBeforeClose.price / 200n) /
      10 ** 8;

    const closeOrder = await service.prepareCloseOrder({
      account: agent0Address,
      marketId: market.id,
      percentage: 1,
      orderType: 'limit',
      limitPrice: closeLimitPrice,
    });

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: AGENT0_PRIVATE_KEY as Hex,
      calls: closeOrder.calls,
    });

    const queuedCloseOrder = await service.getOrder(closeOrder.orderId);
    expect(queuedCloseOrder?.active).toBe(true);
    if (!queuedCloseOrder) {
      throw new Error('Expected limit close order to remain queued');
    }
    expect(queuedCloseOrder.triggerPrice).toBe(toPriceUnits(closeLimitPrice));
    const closeExecutionPrice =
      queuedCloseOrder.triggerPrice + queuedCloseOrder.triggerPrice / 20n;

    const closeExecutionTimestamp = latestBeforeClose.timestamp + 1;
    await setNextBlockTimestamp(closeExecutionTimestamp);
    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: [
        await service.publishOraclePrices({
          marketIds: [market.id],
          prices: [closeExecutionPrice],
          timestamp: closeExecutionTimestamp,
        }),
      ],
    });

    const executableAfterClose = await service.getExecutableOrders();
    expect(
      executableAfterClose.some((order) => order.id === closeOrder.orderId)
    ).toBe(true);

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: [await service.buildExecuteOrderCall(closeOrder.orderId)],
    });

    expect(await service.getPosition(agent0Address, market.id)).toBeNull();

    const finalOpenOrder = await service.getOrder(openOrder.orderId);
    const finalCloseOrder = await service.getOrder(closeOrder.orderId);

    expect(finalOpenOrder?.active ?? false).toBe(false);
    expect(finalCloseOrder?.active ?? false).toBe(false);
  });
});
