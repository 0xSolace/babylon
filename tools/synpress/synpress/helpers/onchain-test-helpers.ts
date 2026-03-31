import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  http,
  parseAbi,
  parseEther,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DEFAULT_ANVIL_WALLET } from './privy-auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const RPC_URL =
  process.env.LOCAL_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  'http://localhost:8545';
const CHAIN = {
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;
const DEPLOYER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ORACLE_PRIVATE_KEY =
  '0x1111111111111111111111111111111111111111111111111111111111111111';
const TARGET_ETH_BALANCE = parseEther('10');
const TARGET_USDC_BALANCE = 100_000n * 1_000_000n;

const PERP_VIEW_ABI = parseAbi([
  'function getPerpEngineConfig() view returns (address collateralToken, uint8 collateralDecimals, address oracleUpdater, address feeRecipient, uint16 protocolFeeShareBps, uint32 maxOracleDelay, uint256 nextOrderNonce)',
  'function getPerpOracleVersion(bytes32 marketId, uint64 versionId) view returns (uint64 timestamp, uint256 price, int256 cumulativeFunding)',
  'function getPerpMarket(bytes32 marketId) view returns (string symbol, uint256 maxOpenInterest, uint256 maxSkew, uint256 skewScale, uint256 minTradeSize, uint16 initialMarginBps, uint16 maintenanceMarginBps, uint16 liquidationFeeBps, uint16 openFeeBps, uint16 closeFeeBps, uint16 maxFundingVelocityBps, uint16 maxPriceImpactBps, uint16 minLiquidityBps, bool active, uint256 totalLongSize, uint256 totalShortSize, uint256 vaultBalance, uint64 latestVersion)',
  'function getPerpPosition(address account, bytes32 marketId) view returns (uint8 side, uint256 size, uint256 collateral, uint256 entryPrice, int256 entryFunding)',
]);
const PERP_SETTLEMENT_ABI = parseAbi([
  'function publishPerpOracleVersions(bytes32[] marketIds, uint256[] prices, uint64 timestamp)',
  'function executePerpOrder(bytes32 orderId)',
]);
const PREDICTION_ROUTER_ABI = parseAbi([
  'function getMarketAddress(bytes32 marketKey) view returns (address)',
]);
const LVR_MARKET_ABI = parseAbi([
  'function getToken(bool tokenYes) view returns (address)',
  'function getMarketDetails() view returns (uint8 currentState,uint256 marketDeadline,uint256 marketOutcome,uint256 marketLiquidity,uint256 reserveYes,uint256 reserveNo,uint256 priceYes,uint256 priceNo)',
]);
const ERC20_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function mint(address to,uint256 amount)',
]);

type LocalDeployment = {
  contracts: {
    diamond: Address;
    mockUsdc: Address;
    predictionAmmRouter: Address;
  };
};

type PerpApiMarket = {
  ticker: string;
  organizationId: Hex;
};

type PredictionApiMarket = {
  id: string;
  question: string;
  status: string;
  onChainMarketId?: Hex | null;
};

type PerpPositionSnapshot = {
  side: number;
  size: bigint;
  collateral: bigint;
  entryPrice: bigint;
  entryFunding: bigint;
};

const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});
const deployerAccount = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as Hex);
const oracleAccount = privateKeyToAccount(ORACLE_PRIVATE_KEY as Hex);
const deployerWallet = createWalletClient({
  account: deployerAccount,
  chain: CHAIN,
  transport: http(RPC_URL),
});
const oracleWallet = createWalletClient({
  account: oracleAccount,
  chain: CHAIN,
  transport: http(RPC_URL),
});

let cachedDeployment: LocalDeployment | null = null;

function getDeployment(): LocalDeployment {
  if (cachedDeployment) {
    return cachedDeployment;
  }

  const deploymentPath = path.resolve(
    REPO_ROOT,
    'packages/contracts/deployments/local/index.json'
  );
  cachedDeployment = JSON.parse(
    readFileSync(deploymentPath, 'utf8')
  ) as LocalDeployment;
  return cachedDeployment;
}

async function fetchJson<T>(pathname: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(
      `Expected ${pathname} to succeed, received ${response.status}: ${await response.text()}`
    );
  }
  return (await response.json()) as T;
}

async function sendSignedContractTransaction(params: {
  walletClient: typeof deployerWallet;
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}): Promise<Hex> {
  const account = params.walletClient.account;
  if (!account) {
    throw new Error('Wallet client account is missing');
  }

  const feeEstimate = await publicClient.estimateFeesPerGas();
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: 'pending',
  });
  const data = encodeFunctionData({
    abi: params.abi,
    functionName: params.functionName as never,
    args: (params.args ?? []) as never,
  });
  const gas = await publicClient.estimateGas({
    account: account.address,
    to: params.address,
    data,
  });
  const serializedTransaction = await params.walletClient.signTransaction({
    account,
    chain: CHAIN,
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

  return await publicClient.sendRawTransaction({
    serializedTransaction,
  });
}

async function setWalletEthBalance(address: Address, value: bigint): Promise<void> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'anvil_setBalance',
      params: [address, `0x${value.toString(16)}`],
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set ETH balance for ${address}`);
  }

  const payload = (await response.json()) as {
    error?: { message?: string };
  };
  if (payload.error) {
    throw new Error(payload.error.message || 'anvil_setBalance failed');
  }
}

export async function ensureWalletFunded(address: Address): Promise<void> {
  const { contracts } = getDeployment();
  const ethBalance = await publicClient.getBalance({ address });
  if (ethBalance < TARGET_ETH_BALANCE) {
    await setWalletEthBalance(address, TARGET_ETH_BALANCE);
  }

  const usdcBalance = (await publicClient.readContract({
    address: contracts.mockUsdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  })) as bigint;

  if (usdcBalance < TARGET_USDC_BALANCE) {
    const mintHash = await sendSignedContractTransaction({
      walletClient: deployerWallet,
      address: contracts.mockUsdc,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [address, TARGET_USDC_BALANCE - usdcBalance],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
  }
}

export async function ensureDefaultE2EWalletFunding(): Promise<void> {
  await ensureWalletFunded(DEFAULT_ANVIL_WALLET.address as Address);
}

export async function getPerpMarkets(): Promise<PerpApiMarket[]> {
  const payload = await fetchJson<{
    markets: PerpApiMarket[];
  }>('/api/markets/perps');
  return payload.markets;
}

export async function getPredictionMarkets(): Promise<PredictionApiMarket[]> {
  const payload = await fetchJson<{
    questions: PredictionApiMarket[];
  }>('/api/markets/predictions');
  return payload.questions;
}

export async function getPerpPosition(
  walletAddress: Address,
  marketId: Hex
): Promise<PerpPositionSnapshot | null> {
  const { contracts } = getDeployment();
  const [side, size, collateral, entryPrice, entryFunding] =
    (await publicClient.readContract({
      address: contracts.diamond,
      abi: PERP_VIEW_ABI,
      functionName: 'getPerpPosition',
      args: [walletAddress, marketId],
    })) as readonly [number, bigint, bigint, bigint, bigint];

  if (size === 0n) {
    return null;
  }

  return {
    side,
    size,
    collateral,
    entryPrice,
    entryFunding,
  };
}

export async function getPerpFreeCollateral(
  walletAddress: Address
): Promise<bigint> {
  const { contracts } = getDeployment();
  return (await publicClient.readContract({
    address: contracts.diamond,
    abi: parseAbi([
      'function getPerpAccount(address account) view returns (uint256 freeCollateral)',
    ]),
    functionName: 'getPerpAccount',
    args: [walletAddress],
  })) as bigint;
}

export async function findCleanPerpMarket(
  walletAddress: Address
): Promise<PerpApiMarket> {
  const markets = await getPerpMarkets();
  for (const market of markets) {
    const position = await getPerpPosition(walletAddress, market.organizationId);
    if (!position) {
      return market;
    }
  }
  throw new Error('No clean perpetual market was available for E2E trading');
}

export async function getPredictionPositionBalances(params: {
  walletAddress: Address;
  marketKey: Hex;
}): Promise<{
  marketAddress: Address;
  yesBalance: bigint;
  noBalance: bigint;
  state: number;
  outcome: number;
}> {
  const { contracts } = getDeployment();
  const marketAddress = (await publicClient.readContract({
    address: contracts.predictionAmmRouter,
    abi: PREDICTION_ROUTER_ABI,
    functionName: 'getMarketAddress',
    args: [params.marketKey],
  })) as Address;

  const [yesToken, noToken, marketDetails] = await Promise.all([
    publicClient.readContract({
      address: marketAddress,
      abi: LVR_MARKET_ABI,
      functionName: 'getToken',
      args: [true],
    }) as Promise<Address>,
    publicClient.readContract({
      address: marketAddress,
      abi: LVR_MARKET_ABI,
      functionName: 'getToken',
      args: [false],
    }) as Promise<Address>,
    publicClient.readContract({
      address: marketAddress,
      abi: LVR_MARKET_ABI,
      functionName: 'getMarketDetails',
    }) as Promise<
      readonly [number, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
    >,
  ]);

  const [yesBalance, noBalance] = await Promise.all([
    publicClient.readContract({
      address: yesToken,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [params.walletAddress],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: noToken,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [params.walletAddress],
    }) as Promise<bigint>,
  ]);

  return {
    marketAddress,
    yesBalance,
    noBalance,
    state: Number(marketDetails[0]),
    outcome: Number(marketDetails[2]),
  };
}

export async function findCleanPredictionMarket(
  walletAddress: Address
): Promise<{
  id: string;
  question: string;
  onChainMarketId: Hex;
}> {
  const markets = await getPredictionMarkets();
  for (const market of markets) {
    if (!market.onChainMarketId || market.status !== 'active') {
      continue;
    }

    const position = await getPredictionPositionBalances({
      walletAddress,
      marketKey: market.onChainMarketId,
    });
    if (position.yesBalance === 0n && position.noBalance === 0n) {
      return {
        id: market.id,
        question: market.question,
        onChainMarketId: market.onChainMarketId,
      };
    }
  }
  throw new Error('No clean on-chain prediction market was available for E2E trading');
}

export async function settlePerpOrder(params: {
  marketId: Hex;
  orderId: Hex;
  priceBumpBps?: bigint;
}): Promise<void> {
  const { contracts } = getDeployment();
  const [engineConfig, market] = await Promise.all([
    publicClient.readContract({
      address: contracts.diamond,
      abi: PERP_VIEW_ABI,
      functionName: 'getPerpEngineConfig',
    }) as Promise<
      readonly [Address, number, Address, Address, number, number, bigint]
    >,
    publicClient.readContract({
      address: contracts.diamond,
      abi: PERP_VIEW_ABI,
      functionName: 'getPerpMarket',
      args: [params.marketId],
    }) as Promise<
      readonly [
        string,
        bigint,
        bigint,
        bigint,
        bigint,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        boolean,
        bigint,
        bigint,
        bigint,
        bigint,
      ]
    >,
  ]);

  const latestVersion = (await publicClient.readContract({
    address: contracts.diamond,
    abi: PERP_VIEW_ABI,
    functionName: 'getPerpOracleVersion',
    args: [params.marketId, market[17]],
  })) as readonly [bigint, bigint, bigint];

  const oracleUpdater = engineConfig[2].toLowerCase();
  const settlementWallet =
    oracleUpdater === oracleAccount.address.toLowerCase()
      ? oracleWallet
      : oracleUpdater === deployerAccount.address.toLowerCase()
        ? deployerWallet
        : null;

  if (!settlementWallet) {
    throw new Error(`Unsupported oracle updater ${engineConfig[2]}`);
  }

  const basePrice = latestVersion[1];
  const adjustedPrice =
    params.priceBumpBps && params.priceBumpBps !== 0n
      ? (basePrice * (10_000n + params.priceBumpBps)) / 10_000n
      : basePrice;
  const nextTimestamp = Number(latestVersion[0]) + 1;

  const publishHash = await sendSignedContractTransaction({
    walletClient: settlementWallet,
    address: contracts.diamond,
    abi: PERP_SETTLEMENT_ABI,
    functionName: 'publishPerpOracleVersions',
    args: [[params.marketId], [adjustedPrice], BigInt(nextTimestamp)],
  });
  await publicClient.waitForTransactionReceipt({ hash: publishHash });

  const executeHash = await sendSignedContractTransaction({
    walletClient: deployerWallet,
    address: contracts.diamond,
    abi: PERP_SETTLEMENT_ABI,
    functionName: 'executePerpOrder',
    args: [params.orderId],
  });
  await publicClient.waitForTransactionReceipt({ hash: executeHash });
}

export async function waitForToastText(
  page: Page,
  text: string | RegExp
): Promise<void> {
  const pattern = typeof text === 'string' ? new RegExp(text, 'i') : text;
  await expect
    .poll(
      async () => {
        const nodes = await page
          .locator('[data-sonner-toast], [role="status"]')
          .allTextContents()
          .catch(() => []);
        return nodes.join(' ');
      },
      { timeout: 30_000 }
    )
    .toMatch(pattern);
}

export function formatUsdc(value: bigint): number {
  return Number(formatUnits(value, 6));
}
