import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { loadDeploymentFromDisk } from '@babylon/contracts/deployment/validation-node';
import {
  calculateNotionalFromBaseSize,
  OnchainPerpService,
  sendOnchainPerpCalls,
  toPriceUnits,
} from '@babylon/engine';
import { ERC20_MINIMAL_ABI } from '@babylon/shared';
import { type Address, encodeFunctionData, type Hex, parseAbi } from 'viem';
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
const LOCALNET_USDC_MINT_AMOUNT = 25_000_000_000n;
const ERC20_INTERFACE = parseAbi([...ERC20_MINIMAL_ABI]);

setDefaultTimeout(300_000);

describe('Localnet onchain perp flow', () => {
  let service: OnchainPerpService;
  let deployerAddress: `0x${string}`;
  let agent0Address: `0x${string}`;

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

  async function publishSingleMarketPrice(params: {
    marketId: Hex;
    price: bigint;
    minTimestamp: number;
  }): Promise<number> {
    const nextTimestamp = await setNextBlockTimestamp(params.minTimestamp);

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: [
        await service.publishOraclePrices({
          marketIds: [params.marketId],
          prices: [params.price],
          timestamp: nextTimestamp,
        }),
      ],
    });

    return nextTimestamp;
  }

  function diffOrderIds(before: Hex[], after: Hex[]): Hex[] {
    const previousIds = new Set(before);
    return after.filter((orderId) => !previousIds.has(orderId));
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
    deployerAddress = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as Hex).address;
    agent0Address = privateKeyToAccount(AGENT0_PRIVATE_KEY as Hex).address;
  });

  test.serial(
    'rejects invalid open-order parameters and oracle batch inputs on localnet',
    async () => {
      const market = await service.findMarketBySymbol('ETH');
      const latestVersion = await service.getLatestOracleVersion(
        market.id,
        market.latestVersion
      );
      const minimumNotionalUsd = getMinimumOrderNotionalUsd(
        latestVersion.price,
        market.minTradeSize
      );
      const validSizeUsd = Math.max(Math.ceil(minimumNotionalUsd * 2), 1000);
      const maxLeverage = Math.floor(10_000 / market.initialMarginBps);

      await expect(
        service.prepareOpenOrder({
          account: agent0Address,
          ticker: market.symbol,
          side: 'long',
          sizeUsd: Math.max(minimumNotionalUsd / 2, 0.01),
          leverage: Math.max(1, Math.min(2, maxLeverage)),
          orderType: 'market',
        })
      ).rejects.toThrow(`${market.symbol} minimum order size is`);

      await expect(
        service.prepareOpenOrder({
          account: agent0Address,
          ticker: market.symbol,
          side: 'long',
          sizeUsd: validSizeUsd,
          leverage: maxLeverage + 1,
          orderType: 'market',
        })
      ).rejects.toThrow(`${market.symbol} max leverage is ${maxLeverage}x`);

      await expect(
        service.prepareOpenOrder({
          account: agent0Address,
          ticker: market.symbol,
          side: 'long',
          sizeUsd: validSizeUsd,
          leverage: Math.max(1, Math.min(2, maxLeverage)),
          orderType: 'limit',
          limitPrice:
            Number(latestVersion.price + latestVersion.price / 100n) / 10 ** 8,
        })
      ).rejects.toThrow(
        'Limit orders must improve the current price: buy below market, sell above market'
      );

      await expect(
        service.publishOraclePrices({
          marketIds: [],
          prices: [],
        })
      ).rejects.toThrow('At least one oracle price update is required');

      await expect(
        service.publishOraclePrices({
          marketIds: [market.id],
          prices: [],
        })
      ).rejects.toThrow('Market IDs and oracle prices must be the same length');
    }
  );

  test.serial('rejects invalid close-order inputs on localnet', async () => {
    const market = await service.findMarketBySymbol('MSFT');

    await expect(
      service.prepareCloseOrder({
        account: deployerAddress,
        marketId: market.id,
      })
    ).rejects.toThrow(`No open ${market.symbol} position`);

    const latestBeforeOpen = await service.getLatestOracleVersion(
      market.id,
      market.latestVersion
    );
    const minimumNotionalUsd = getMinimumOrderNotionalUsd(
      latestBeforeOpen.price,
      market.minTradeSize
    );
    const sizeUsd = Math.max(Math.ceil(minimumNotionalUsd * 2), 1000);
    const leverage = Math.min(2, Math.floor(10_000 / market.initialMarginBps));

    await mintUsdc(deployerAddress, 'mint-deployer-localnet-msft-usdc');

    const openOrder = await service.prepareOpenOrder({
      account: deployerAddress,
      ticker: market.symbol,
      side: 'long',
      sizeUsd,
      leverage,
      maxSlippage: 0.1,
      orderType: 'market',
    });

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: openOrder.calls,
    });

    await publishSingleMarketPrice({
      marketId: market.id,
      price: latestBeforeOpen.price + latestBeforeOpen.price / 200n,
      minTimestamp: latestBeforeOpen.timestamp + 1,
    });

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: [await service.buildExecuteOrderCall(openOrder.orderId)],
    });

    expect(
      await service.getPosition(deployerAddress, market.id)
    ).not.toBeNull();

    await expect(
      service.prepareCloseOrder({
        account: deployerAddress,
        marketId: market.id,
        percentage: 0,
      })
    ).rejects.toThrow('Close percentage must be between 0 and 1');

    await expect(
      service.prepareCloseOrder({
        account: deployerAddress,
        marketId: market.id,
        percentage: 1.01,
      })
    ).rejects.toThrow('Close percentage must be between 0 and 1');

    const latestBeforeInvalidLimit = await service.getLatestOracleVersion(
      market.id,
      (await service.getMarket(market.id)).latestVersion
    );

    await expect(
      service.prepareCloseOrder({
        account: deployerAddress,
        marketId: market.id,
        percentage: 1,
        orderType: 'limit',
        limitPrice:
          Number(
            latestBeforeInvalidLimit.price -
              latestBeforeInvalidLimit.price / 100n
          ) /
          10 ** 8,
      })
    ).rejects.toThrow(
      'Reduce-only limit orders must improve the current exit price'
    );

    const cleanupCloseOrder = await service.prepareCloseOrder({
      account: deployerAddress,
      marketId: market.id,
      percentage: 1,
      orderType: 'market',
    });

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: cleanupCloseOrder.calls,
    });

    const latestBeforeCleanup = await service.getLatestOracleVersion(
      market.id,
      (await service.getMarket(market.id)).latestVersion
    );

    await publishSingleMarketPrice({
      marketId: market.id,
      price: latestBeforeCleanup.price,
      minTimestamp: latestBeforeCleanup.timestamp + 1,
    });

    await sendOnchainPerpCalls({
      rpcUrl: getLocalRpcUrl(),
      privateKey: DEPLOYER_PRIVATE_KEY as Hex,
      calls: [await service.buildExecuteOrderCall(cleanupCloseOrder.orderId)],
    });

    expect(await service.getPosition(deployerAddress, market.id)).toBeNull();
  });

  test.serial(
    'opens with a market order and closes with a trigger order on localnet',
    async () => {
      const market = await service.findMarketBySymbol('ETH');
      const latestBeforeOpen = await service.getLatestOracleVersion(
        market.id,
        market.latestVersion
      );
      const minimumNotionalUsd = getMinimumOrderNotionalUsd(
        latestBeforeOpen.price,
        market.minTradeSize
      );
      const sizeUsd = Math.max(Math.ceil(minimumNotionalUsd * 2), 1000);
      const leverage = Math.min(
        2,
        Math.floor(10_000 / market.initialMarginBps)
      );

      expect(await service.getPosition(agent0Address, market.id)).toBeNull();

      await mintUsdc(agent0Address, 'mint-agent0-localnet-usdc');

      const openOrder = await service.prepareOpenOrder({
        account: agent0Address,
        ticker: market.symbol,
        side: 'long',
        sizeUsd,
        leverage,
        maxSlippage: 0.1,
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

      const openExecutionTimestamp = await setNextBlockTimestamp(
        latestBeforeOpen.timestamp + 1
      );
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

      const openedPosition = await service.getPosition(
        agent0Address,
        market.id
      );
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

      const closeExecutionTimestamp = await setNextBlockTimestamp(
        latestBeforeClose.timestamp + 1
      );
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
    }
  );

  test.serial(
    'settles multiple queued orders against one oracle version and reflects the executed state onchain',
    async () => {
      const marketBefore = await service.findMarketBySymbol('ETH');
      const latestBeforeOpen = await service.getLatestOracleVersion(
        marketBefore.id,
        marketBefore.latestVersion
      );
      const minimumNotionalUsd = getMinimumOrderNotionalUsd(
        latestBeforeOpen.price,
        marketBefore.minTradeSize
      );
      const sizeUsd = Math.max(Math.ceil(minimumNotionalUsd * 2), 1000);
      const leverage = Math.min(
        2,
        Math.floor(10_000 / marketBefore.initialMarginBps)
      );

      await mintUsdc(agent0Address, 'mint-agent0-batched-eth-usdc');
      await mintUsdc(deployerAddress, 'mint-deployer-batched-eth-usdc');

      const activeOrderIdsBeforeOpen = await service.getActiveOrderIds();
      const [agentOpenOrder, deployerOpenOrder] = await Promise.all([
        service.prepareOpenOrder({
          account: agent0Address,
          ticker: marketBefore.symbol,
          side: 'long',
          sizeUsd,
          leverage,
          maxSlippage: 0.1,
          orderType: 'market',
        }),
        service.prepareOpenOrder({
          account: deployerAddress,
          ticker: marketBefore.symbol,
          side: 'short',
          sizeUsd,
          leverage,
          maxSlippage: 0.1,
          orderType: 'market',
        }),
      ]);

      await Promise.all([
        sendOnchainPerpCalls({
          rpcUrl: getLocalRpcUrl(),
          privateKey: AGENT0_PRIVATE_KEY as Hex,
          calls: agentOpenOrder.calls,
        }),
        sendOnchainPerpCalls({
          rpcUrl: getLocalRpcUrl(),
          privateKey: DEPLOYER_PRIVATE_KEY as Hex,
          calls: deployerOpenOrder.calls,
        }),
      ]);

      const activeOrderIdsAfterOpen = await service.getActiveOrderIds();
      const newOpenOrderIds = diffOrderIds(
        activeOrderIdsBeforeOpen,
        activeOrderIdsAfterOpen
      );
      expect(newOpenOrderIds.length).toBe(2);

      const queuedOpenOrders = await Promise.all(
        newOpenOrderIds.map(async (orderId) => await service.getOrder(orderId))
      );
      expect(queuedOpenOrders.every((order) => order?.active === true)).toBe(
        true
      );
      expect(
        queuedOpenOrders.every(
          (order) =>
            order?.executableAtVersion === latestBeforeOpen.version + 1n
        )
      ).toBe(true);
      expect(
        new Set(queuedOpenOrders.map((order) => order?.account)).size
      ).toBe(2);

      await publishSingleMarketPrice({
        marketId: marketBefore.id,
        price: latestBeforeOpen.price + latestBeforeOpen.price / 100n,
        minTimestamp: latestBeforeOpen.timestamp + 1,
      });

      const executableOpenOrders = await service.getExecutableOrders();
      const executableOpenOrderIds = new Set(
        executableOpenOrders.map((order) => order.id)
      );
      for (const orderId of newOpenOrderIds) {
        expect(executableOpenOrderIds.has(orderId)).toBe(true);
      }

      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: DEPLOYER_PRIVATE_KEY as Hex,
        calls: await Promise.all(
          newOpenOrderIds.map(
            async (orderId) => await service.buildExecuteOrderCall(orderId)
          )
        ),
      });

      const [agentPosition, deployerPosition, marketAfterOpen] =
        await Promise.all([
          service.getPosition(agent0Address, marketBefore.id),
          service.getPosition(deployerAddress, marketBefore.id),
          service.getMarket(marketBefore.id),
        ]);

      expect(agentPosition?.size).toBe(agentOpenOrder.sizeDelta);
      expect(deployerPosition?.size).toBe(deployerOpenOrder.sizeDelta);
      expect(marketAfterOpen.totalLongSize - marketBefore.totalLongSize).toBe(
        agentOpenOrder.sizeDelta
      );
      expect(marketAfterOpen.totalShortSize - marketBefore.totalShortSize).toBe(
        deployerOpenOrder.sizeDelta
      );
      expect(marketAfterOpen.latestVersion).toBe(latestBeforeOpen.version + 1n);

      const activeOrderIdsBeforeClose = await service.getActiveOrderIds();
      const [agentCloseOrder, deployerCloseOrder] = await Promise.all([
        service.prepareCloseOrder({
          account: agent0Address,
          marketId: marketBefore.id,
          percentage: 1,
          orderType: 'market',
        }),
        service.prepareCloseOrder({
          account: deployerAddress,
          marketId: marketBefore.id,
          percentage: 1,
          orderType: 'market',
        }),
      ]);

      await Promise.all([
        sendOnchainPerpCalls({
          rpcUrl: getLocalRpcUrl(),
          privateKey: AGENT0_PRIVATE_KEY as Hex,
          calls: agentCloseOrder.calls,
        }),
        sendOnchainPerpCalls({
          rpcUrl: getLocalRpcUrl(),
          privateKey: DEPLOYER_PRIVATE_KEY as Hex,
          calls: deployerCloseOrder.calls,
        }),
      ]);

      const activeOrderIdsAfterClose = await service.getActiveOrderIds();
      const newCloseOrderIds = diffOrderIds(
        activeOrderIdsBeforeClose,
        activeOrderIdsAfterClose
      );
      expect(newCloseOrderIds.length).toBe(2);

      const latestBeforeClose = await service.getLatestOracleVersion(
        marketBefore.id,
        (await service.getMarket(marketBefore.id)).latestVersion
      );

      await publishSingleMarketPrice({
        marketId: marketBefore.id,
        price: latestBeforeClose.price,
        minTimestamp: latestBeforeClose.timestamp + 1,
      });

      const executableCloseOrders = await service.getExecutableOrders();
      const executableCloseOrderIds = new Set(
        executableCloseOrders.map((order) => order.id)
      );
      for (const orderId of newCloseOrderIds) {
        expect(executableCloseOrderIds.has(orderId)).toBe(true);
      }

      await sendOnchainPerpCalls({
        rpcUrl: getLocalRpcUrl(),
        privateKey: DEPLOYER_PRIVATE_KEY as Hex,
        calls: await Promise.all(
          newCloseOrderIds.map(
            async (orderId) => await service.buildExecuteOrderCall(orderId)
          )
        ),
      });

      expect(
        await service.getPosition(agent0Address, marketBefore.id)
      ).toBeNull();
      expect(
        await service.getPosition(deployerAddress, marketBefore.id)
      ).toBeNull();

      const finalOrders = await Promise.all(
        [...newOpenOrderIds, ...newCloseOrderIds].map(
          async (orderId) => await service.getOrder(orderId)
        )
      );
      expect(finalOrders.every((order) => order?.active === false)).toBe(true);
    }
  );
});
