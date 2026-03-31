/**
 * Service for creating, linking, and settling Babylon prediction markets on-chain.
 *
 * Production path: BabylonGameOracle + BabylonPredictionOracleAdapter +
 * BabylonPredictionAMMRouter.
 */

import {
  BABYLON_PREDICTION_AMM_ROUTER_ABI,
  getContractAddresses,
} from '@babylon/contracts';
import { db, eq, markets, questions } from '@babylon/db';
import {
  CHAIN,
  getCurrentRpcUrl,
  getTransactionReceiptConfirmations,
  logger,
} from '@babylon/shared';
import {
  type Abi,
  type Address,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  type Hex,
  http,
  keccak256,
  maxUint256,
  parseAbi,
  parseUnits,
  toBytes,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const ERC20_ALLOWANCE_ABI = parseAbi([
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]);

const DEFAULT_INITIAL_LIQUIDITY = '10000';
const DEFAULT_RESOLUTION_SOURCE = 'babylon-game';

function getPredictionInitialLiquidity(): string {
  return (
    process.env.PREDICTION_MARKET_INITIAL_LIQUIDITY ??
    process.env.BABYLON_PREDICTION_MARKET_INITIAL_LIQUIDITY ??
    DEFAULT_INITIAL_LIQUIDITY
  );
}

function getPredictionTradingShape(): {
  isDynamic: boolean;
  resolutionSource: string;
} {
  return {
    isDynamic: process.env.BABYLON_PREDICTION_MARKET_DYNAMIC === 'true',
    resolutionSource:
      process.env.BABYLON_PREDICTION_MARKET_SOURCE ?? DEFAULT_RESOLUTION_SOURCE,
  };
}

function getPredictionMarketKey(marketId: string): `0x${string}` {
  return keccak256(toBytes(marketId));
}

function requirePredictionContracts() {
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY as
    | `0x${string}`
    | undefined;
  const rpcUrl = getCurrentRpcUrl();
  const { predictionAmmRouter, mockUsdc, network } = getContractAddresses();

  const collateralToken = (process.env.PREDICTION_COLLATERAL_TOKEN ??
    process.env.PERP_COLLATERAL_TOKEN ??
    mockUsdc) as Address | undefined;

  if (!predictionAmmRouter || !collateralToken || !deployerPrivateKey) {
    logger.debug(
      'Skipping on-chain prediction market action - missing configuration',
      {
        network,
        hasRouter: Boolean(predictionAmmRouter),
        hasCollateral: Boolean(collateralToken),
        hasKey: Boolean(deployerPrivateKey),
        hasRpc: Boolean(rpcUrl),
      },
      'OnChainMarketService'
    );
    return null;
  }

  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(rpcUrl),
  });

  const deployerAccount = privateKeyToAccount(deployerPrivateKey);
  const walletClient = createWalletClient({
    account: deployerAccount,
    chain: CHAIN,
    transport: http(rpcUrl),
  });

  return {
    routerAddress: predictionAmmRouter,
    collateralToken,
    rpcUrl,
    publicClient,
    walletClient,
    deployer: deployerAccount.address,
    deployerAccount,
  };
}

type OnchainPredictionContracts = NonNullable<
  ReturnType<typeof requirePredictionContracts>
>;

async function writePredictionContract(
  contracts: OnchainPredictionContracts,
  params: {
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
  }
): Promise<Hex> {
  const feeEstimate = await contracts.publicClient.estimateFeesPerGas();
  const nonce = await contracts.publicClient.getTransactionCount({
    address: contracts.deployer,
    blockTag: 'pending',
  });
  const data = encodeFunctionData({
    abi: params.abi,
    functionName: params.functionName as never,
    args: params.args as never,
  });
  const gas = await contracts.publicClient.estimateGas({
    account: contracts.deployer,
    to: params.address,
    data,
  });
  const serializedTransaction = await contracts.walletClient.signTransaction({
    account: contracts.deployerAccount,
    chain: CHAIN,
    chainId: CHAIN.id,
    to: params.address,
    data,
    gas,
    nonce,
    ...(typeof feeEstimate.gasPrice === 'bigint'
      ? { gasPrice: feeEstimate.gasPrice, type: 'legacy' as const }
      : {
          maxFeePerGas: feeEstimate.maxFeePerGas,
          maxPriorityFeePerGas: feeEstimate.maxPriorityFeePerGas,
          type: 'eip1559' as const,
        }),
  });

  return await contracts.publicClient.sendRawTransaction({
    serializedTransaction,
  });
}

async function ensureRouterAllowance(
  contracts: OnchainPredictionContracts,
  amount: bigint
): Promise<void> {
  const allowance = (await contracts.publicClient.readContract({
    address: contracts.collateralToken,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: 'allowance',
    args: [contracts.deployer, contracts.routerAddress],
  })) as bigint;

  if (allowance >= amount) {
    return;
  }

  const approveHash = await writePredictionContract(contracts, {
    address: contracts.collateralToken,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: 'approve',
    args: [contracts.routerAddress, maxUint256],
  });

  await contracts.publicClient.waitForTransactionReceipt({
    hash: approveHash,
    confirmations: getTransactionReceiptConfirmations(CHAIN.id),
  });
}

async function resolveInitialLiquidityRaw(
  contracts: OnchainPredictionContracts
): Promise<bigint> {
  const decimals = (await contracts.publicClient.readContract({
    address: contracts.collateralToken,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: 'decimals',
  })) as number;

  return parseUnits(getPredictionInitialLiquidity(), decimals);
}

/**
 * Create a Babylon prediction PM-AMM market keyed by the Babylon market id.
 *
 * Returns the deterministic `marketKey` stored in the database as `onChainMarketId`.
 */
export async function createMarketOnChain(
  marketId: string,
  question: string,
  endDate: Date
): Promise<`0x${string}` | null> {
  const contracts = requirePredictionContracts();
  if (!contracts) {
    return null;
  }

  const resolveAt = BigInt(Math.floor(endDate.getTime() / 1000));
  const marketKey = getPredictionMarketKey(marketId);
  const { isDynamic, resolutionSource } = getPredictionTradingShape();
  const initialLiquidity = await resolveInitialLiquidityRaw(contracts);

  await ensureRouterAllowance(contracts, initialLiquidity);

  logger.info(
    'Creating prediction PM-AMM market on-chain',
    {
      marketId,
      marketKey,
      resolveAt: resolveAt.toString(),
      initialLiquidity: initialLiquidity.toString(),
      isDynamic,
    },
    'OnChainMarketService'
  );

  const txHash = await writePredictionContract(contracts, {
    address: contracts.routerAddress,
    abi: BABYLON_PREDICTION_AMM_ROUTER_ABI,
    functionName: 'createMarket',
    args: [
      marketId,
      question,
      resolutionSource,
      resolveAt,
      isDynamic,
      initialLiquidity,
    ],
  });

  const receipt = await contracts.publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: getTransactionReceiptConfirmations(CHAIN.id),
  });

  if (receipt.status !== 'success') {
    logger.error(
      'Prediction PM-AMM market creation transaction failed',
      { txHash, marketId },
      'OnChainMarketService'
    );
    return null;
  }

  const createdLog = receipt.logs.find((log) => {
    if (log.address.toLowerCase() !== contracts.routerAddress.toLowerCase()) {
      return false;
    }
    try {
      const decoded = decodeEventLog({
        abi: BABYLON_PREDICTION_AMM_ROUTER_ABI,
        data: log.data,
        topics: log.topics,
      });
      return decoded.eventName === 'PredictionMarketCreated';
    } catch {
      return false;
    }
  });

  if (createdLog) {
    const decoded = decodeEventLog({
      abi: BABYLON_PREDICTION_AMM_ROUTER_ABI,
      data: createdLog.data,
      topics: createdLog.topics,
    });
    const emittedMarketKey = decoded.args.marketKey as `0x${string}`;
    logger.info(
      'Prediction PM-AMM market created on-chain',
      {
        marketId,
        marketKey: emittedMarketKey,
        txHash,
      },
      'OnChainMarketService'
    );
    return emittedMarketKey;
  }

  logger.warn(
    'Prediction PM-AMM creation receipt missing event, using deterministic market key',
    { marketId, marketKey, txHash },
    'OnChainMarketService'
  );
  return marketKey;
}

export async function linkPredictionMarketToSession(
  onChainMarketId: string,
  sessionId: string
): Promise<`0x${string}` | null> {
  const contracts = requirePredictionContracts();
  if (!contracts) {
    return null;
  }

  const txHash = await writePredictionContract(contracts, {
    address: contracts.routerAddress,
    abi: BABYLON_PREDICTION_AMM_ROUTER_ABI,
    functionName: 'linkMarketToSession',
    args: [onChainMarketId as `0x${string}`, sessionId as `0x${string}`],
  });

  await contracts.publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: getTransactionReceiptConfirmations(CHAIN.id),
  });

  logger.info(
    'Linked prediction PM-AMM market to Babylon oracle session',
    { onChainMarketId, sessionId, txHash },
    'OnChainMarketService'
  );

  return txHash;
}

export async function settlePredictionMarketOnChain(
  onChainMarketId: string
): Promise<`0x${string}` | null> {
  const contracts = requirePredictionContracts();
  if (!contracts) {
    return null;
  }

  const txHash = await writePredictionContract(contracts, {
    address: contracts.routerAddress,
    abi: BABYLON_PREDICTION_AMM_ROUTER_ABI,
    functionName: 'settleFromOracle',
    args: [onChainMarketId as `0x${string}`],
  });

  await contracts.publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: getTransactionReceiptConfirmations(CHAIN.id),
  });

  logger.info(
    'Settled prediction PM-AMM market from Babylon oracle',
    { onChainMarketId, txHash },
    'OnChainMarketService'
  );

  return txHash;
}

export async function ensurePredictionMarketLinked(
  marketId: string
): Promise<boolean> {
  const [market, question] = await Promise.all([
    db.select().from(markets).where(eq(markets.id, marketId)).limit(1),
    db.select().from(questions).where(eq(questions.id, marketId)).limit(1),
  ]);

  const marketRecord = market[0];
  const questionRecord = question[0];
  if (!marketRecord?.onChainMarketId || !questionRecord?.oracleSessionId) {
    return false;
  }

  await linkPredictionMarketToSession(
    marketRecord.onChainMarketId,
    questionRecord.oracleSessionId
  );

  return true;
}

/**
 * Ensure a prediction market exists on-chain and store its deterministic market key.
 * If the question already has an oracle session, the market is linked immediately.
 */
export async function ensureMarketOnChain(marketId: string): Promise<boolean> {
  const [marketResult, questionResult] = await Promise.all([
    db.select().from(markets).where(eq(markets.id, marketId)).limit(1),
    db.select().from(questions).where(eq(questions.id, marketId)).limit(1),
  ]);

  const market = marketResult[0];
  const question = questionResult[0];

  if (!market) {
    logger.warn('Market not found', { marketId }, 'OnChainMarketService');
    return false;
  }

  if (market.onChainMarketId) {
    logger.debug(
      'Prediction market already has onChainMarketId',
      { marketId, onChainMarketId: market.onChainMarketId },
      'OnChainMarketService'
    );

    if (question?.oracleSessionId) {
      await linkPredictionMarketToSession(
        market.onChainMarketId,
        question.oracleSessionId
      );
    }

    return true;
  }

  const onChainMarketId = await createMarketOnChain(
    market.id,
    market.question,
    market.endDate
  );

  if (!onChainMarketId) {
    logger.warn(
      'Failed to create prediction PM-AMM market on-chain',
      { marketId },
      'OnChainMarketService'
    );
    return false;
  }

  await db
    .update(markets)
    .set({
      onChainMarketId,
      updatedAt: new Date(),
    })
    .where(eq(markets.id, marketId));

  if (question?.oracleSessionId) {
    await linkPredictionMarketToSession(
      onChainMarketId,
      question.oracleSessionId
    );
  }

  logger.info(
    'Prediction market linked to on-chain PM-AMM market',
    { marketId, onChainMarketId },
    'OnChainMarketService'
  );
  return true;
}

export { getPredictionMarketKey };
