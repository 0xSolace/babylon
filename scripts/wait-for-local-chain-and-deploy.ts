#!/usr/bin/env bun

/**
 * Wait for local Anvil and bootstrap the Babylon dev chain.
 *
 * This script:
 * 1. Waits for the configured local JSON-RPC node
 * 2. Deploys contracts when the saved deployment is stale or absent
 * 3. Deploys and seeds the local NFT contract
 * 4. Creates on-chain perp markets from the seeded offchain market snapshots
 * 5. Publishes initial oracle prices, adds LP liquidity, and funds known wallets
 * 6. Stays alive so `concurrently` keeps the bootstrapping lane attached
 *
 * Set `BABYLON_LOCAL_BOOTSTRAP_ONCE=1` to exit after bootstrap. This is used by
 * test helpers and CI to prepare a local chain without leaving a long-running
 * monitor process behind.
 */

import { loadDeploymentFromDisk } from '@babylon/contracts/deployment/validation-node';
import { PerpDbAdapter } from '@babylon/core/markets/perps';
import {
  closeDatabase,
  db,
  oracleCommitments,
  oracleTransactions,
  users,
} from '@babylon/db';
import {
  denormalizeCollateralToRaw,
  OnchainPerpService,
  sendOnchainPerpCalls,
  toPriceUnits,
  toUsdUnits,
} from '@babylon/engine';
import { ERC20_MINIMAL_ABI, PERP_COLLATERAL_ABI } from '@babylon/shared';
import { $ } from 'bun';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  type Address,
  encodeFunctionData,
  type Hex,
  parseAbi,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { runNftCollectionSeed } from './seed-nft-collection';
import { runLocalNftSnapshotSeed } from './seed-nft-snapshot-local';

const LOCAL_RPC_URL =
  process.env.LOCAL_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  'http://localhost:8545';
const LOCAL_CHAIN_ID = '31337';
const LOCAL_ACCOUNT_0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const LOCAL_ACCOUNT_0_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const LOCAL_ORACLE_PRIVATE_KEY =
  '0x1111111111111111111111111111111111111111111111111111111111111111';
const LOCAL_ORACLE_ADDRESS = privateKeyToAccount(
  LOCAL_ORACLE_PRIVATE_KEY as Hex
).address;
const LOCAL_ORACLE_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TARGET_MARKET_LIQUIDITY_USD = 250_000;
const TARGET_WALLET_ETH = parseEther('5');
const TARGET_WALLET_USDC_RAW = 50_000n * 1_000_000n;
const LOCAL_ENV_FILES = ['.env.local', '.env'].map((fileName) =>
  join(process.cwd(), fileName)
);

const ERC20_INTERFACE = parseAbi([...ERC20_MINIMAL_ABI]);
const PERP_COLLATERAL_INTERFACE = parseAbi([...PERP_COLLATERAL_ABI]);
type BootstrapMarket = Awaited<
  ReturnType<PerpDbAdapter['listMarkets']>
>[number];

function shouldExitAfterBootstrap(): boolean {
  return (
    process.argv.includes('--once') ||
    process.env.BABYLON_LOCAL_BOOTSTRAP_ONCE === '1' ||
    process.env.BABYLON_LOCAL_BOOTSTRAP_ONCE === 'true'
  );
}

function isValidOracleEncryptionKey(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return (
    /^[a-fA-F0-9]{64}$/.test(value) || Buffer.from(value, 'utf8').length === 32
  );
}

function applyLocalChainEnv(): void {
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV ??= 'development';
  env.DEPLOYMENT_ENV = 'localnet';
  env.NEXT_PUBLIC_CHAIN_ID = LOCAL_CHAIN_ID;
  env.NEXT_PUBLIC_RPC_URL = LOCAL_RPC_URL;
  env.NEXT_PUBLIC_ENABLE_ONCHAIN_PERPS = 'true';
  env.NEXT_PUBLIC_PERP_SETTLEMENT_MODE = 'onchain';
  env.PERP_SETTLEMENT_MODE = 'onchain';
  env.BABYLON_DISABLE_REDIS = '1';
  env.DEPLOYER_PRIVATE_KEY = LOCAL_ACCOUNT_0_PRIVATE_KEY;
  env.ORACLE_PRIVATE_KEY = LOCAL_ORACLE_PRIVATE_KEY;
  env.ORACLE_SIGNER = LOCAL_ORACLE_ADDRESS;
  if (!isValidOracleEncryptionKey(env.ORACLE_ENCRYPTION_KEY)) {
    env.ORACLE_ENCRYPTION_KEY = LOCAL_ORACLE_ENCRYPTION_KEY;
  }
}

async function sendLocalRpcRequest(
  method: string,
  params: unknown[] = []
): Promise<Response | null> {
  return await fetch(LOCAL_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    }),
  }).catch(() => null);
}

async function readLocalRpcResult(
  method: string,
  params: unknown[] = []
): Promise<string | null> {
  const response = await sendLocalRpcRequest(method, params);
  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as {
    result?: string;
  } | null;
  return typeof payload?.result === 'string' ? payload.result : null;
}

async function requireLocalRpcSuccess(
  method: string,
  params: unknown[] = []
): Promise<void> {
  const response = await sendLocalRpcRequest(method, params);
  if (!response?.ok) {
    throw new Error(`Local RPC request failed for ${method}`);
  }

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  if (payload?.error) {
    throw new Error(payload.error.message || `${method} returned an RPC error`);
  }
}

async function isContractDeployed(address: string): Promise<boolean> {
  const code =
    (await readLocalRpcResult('eth_getCode', [address, 'latest'])) ?? '0x';
  return code !== '0x' && code !== '0x0' && code.length > 2;
}

async function isOnchainPerpDiamondReady(
  diamondAddress: string
): Promise<boolean> {
  if (!(await isContractDeployed(diamondAddress))) {
    return false;
  }

  try {
    const service = new OnchainPerpService({
      diamondAddress: diamondAddress as Address,
      rpcUrl: LOCAL_RPC_URL,
    });
    await service.getMarketIds();
    return true;
  } catch {
    return false;
  }
}

type LocalDeploymentContracts = {
  diamond?: string;
  babylonOracle?: string;
  predictionAmmRouter?: string;
  predictionOracleAdapter?: string;
  mockUsdc?: string;
};

async function arePredictionContractsReady(
  contracts: LocalDeploymentContracts
): Promise<boolean> {
  if (
    !contracts.babylonOracle ||
    !contracts.predictionAmmRouter ||
    !contracts.predictionOracleAdapter
  ) {
    return false;
  }

  const [oracleReady, routerReady, adapterReady] = await Promise.all([
    isContractDeployed(contracts.babylonOracle),
    isContractDeployed(contracts.predictionAmmRouter),
    isContractDeployed(contracts.predictionOracleAdapter),
  ]);

  return oracleReady && routerReady && adapterReady;
}

async function waitForLocalChain(): Promise<boolean> {
  console.info('Waiting for local Anvil RPC...', undefined, 'Script');

  for (let attempts = 0; attempts < 30; attempts++) {
    if ((await readLocalRpcResult('eth_blockNumber')) !== null) {
      console.info('✅ Local Anvil RPC is ready', undefined, 'Script');
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

async function resetLocalChainState(): Promise<void> {
  const response = await sendLocalRpcRequest('anvil_reset');
  if (!response?.ok) {
    throw new Error('Failed to reset local Anvil state before redeploy');
  }

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  if (payload?.error) {
    if (payload.error.message?.includes('Not implemented')) {
      console.info(
        '⚠️  Local RPC does not support anvil_reset; continuing with in-place redeploy',
        undefined,
        'Script'
      );
      return;
    }

    throw new Error(
      payload.error.message || 'Local Anvil reset returned an RPC error'
    );
  }

  console.info(
    '♻️  Reset local Anvil state before redeploy',
    undefined,
    'Script'
  );
}

async function resetLocalOracleState(): Promise<void> {
  await db.delete(oracleTransactions);
  await db.delete(oracleCommitments);
}

function updateEnvFile(envPath: string, updates: Record<string, string>): void {
  let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  writeFileSync(envPath, envContent);
}

function applyPersistentEnvUpdates(updates: Record<string, string>): void {
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value;
  }

  for (const envPath of LOCAL_ENV_FILES) {
    updateEnvFile(envPath, updates);
  }
}

function readEnvValue(envPath: string, key: string): string | null {
  if (!existsSync(envPath)) {
    return null;
  }

  const envContent = readFileSync(envPath, 'utf-8');
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match?.[1]?.trim() ?? null;
}

function applyDiamondEnv(diamondAddress: string): void {
  applyPersistentEnvUpdates({
    NEXT_PUBLIC_DIAMOND_ADDRESS: diamondAddress,
    BABYLON_DIAMOND_ADDRESS: diamondAddress,
  });
}

function applyPredictionMarketEnv(contracts: LocalDeploymentContracts): void {
  const updates: Record<string, string> = {};

  if (contracts.babylonOracle) {
    updates.NEXT_PUBLIC_BABYLON_ORACLE = contracts.babylonOracle;
    updates.BABYLON_ORACLE = contracts.babylonOracle;
  }
  if (contracts.predictionAmmRouter) {
    updates.NEXT_PUBLIC_PREDICTION_AMM_ROUTER = contracts.predictionAmmRouter;
    updates.BABYLON_PREDICTION_AMM_ROUTER = contracts.predictionAmmRouter;
  }
  if (contracts.predictionOracleAdapter) {
    updates.NEXT_PUBLIC_PREDICTION_ORACLE_ADAPTER =
      contracts.predictionOracleAdapter;
    updates.BABYLON_PREDICTION_ORACLE_ADAPTER =
      contracts.predictionOracleAdapter;
  }
  if (contracts.mockUsdc) {
    updates.NEXT_PUBLIC_MOCK_USDC = contracts.mockUsdc;
    updates.PREDICTION_COLLATERAL_TOKEN = contracts.mockUsdc;
  }

  if (Object.keys(updates).length > 0) {
    applyPersistentEnvUpdates(updates);
  }
}

async function requireLocalDiamondAddress(): Promise<Address> {
  const configuredDiamond =
    (process.env.BABYLON_DIAMOND_ADDRESS as Address | undefined) ??
    (process.env.NEXT_PUBLIC_DIAMOND_ADDRESS as Address | undefined);

  if (configuredDiamond) {
    return configuredDiamond;
  }

  const deployment = await loadDeploymentFromDisk('localnet');
  const diamondAddress = deployment?.contracts.diamond as Address | undefined;

  if (!diamondAddress) {
    throw new Error('Local diamond deployment is missing');
  }

  applyDiamondEnv(diamondAddress);
  return diamondAddress;
}

function buildLocalMarketConfig(market: BootstrapMarket) {
  const price = resolveBootstrapPrice(market);
  const minOrderUsd = Math.max(market.minOrderSize ?? 10, 10);
  const maxOpenInterestUsd = Math.max(
    market.openInterest * 25,
    TARGET_MARKET_LIQUIDITY_USD * 10,
    5_000_000
  );
  const skewScaleBase = Math.max(maxOpenInterestUsd / price, 2_500);
  const maxSkewBase = Math.max(skewScaleBase / 4, minOrderUsd / price);
  const minTradeSizeBase = Math.max(minOrderUsd / price, 0.01);

  return {
    symbol: market.ticker.toUpperCase(),
    maxOpenInterestUsd,
    maxSkewBase,
    skewScaleBase,
    minTradeSizeBase,
    initialMarginBps: 1_000,
    maintenanceMarginBps: 500,
    liquidationFeeBps: 100,
    openFeeBps: 10,
    closeFeeBps: 10,
    maxFundingVelocityBps: 300,
    maxPriceImpactBps: 2_000,
    minLiquidityBps: 1_000,
  };
}

function resolveBootstrapPrice(market: BootstrapMarket): number {
  const candidates = [
    market.indexPrice,
    market.markPrice,
    market.currentPrice,
    100,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      continue;
    }

    if (candidate > 0) {
      return candidate;
    }
  }

  return 100;
}

async function bootstrapOnchainPerpMarkets(): Promise<void> {
  applyLocalChainEnv();

  const diamondAddress = await requireLocalDiamondAddress();
  const service = new OnchainPerpService({
    diamondAddress,
    rpcUrl: LOCAL_RPC_URL,
  });
  const seededMarkets = await new PerpDbAdapter().listMarkets();
  if (seededMarkets.length === 0) {
    console.warn(
      '⚠️  No seeded perp market snapshots found; skipping on-chain bootstrap',
      undefined,
      'Script'
    );
    return;
  }

  const existingMarkets = await service.getMarkets();
  const existingSymbols = new Set(
    existingMarkets.map((market) => market.symbol.toUpperCase())
  );
  const createCalls = [];

  for (const market of seededMarkets) {
    if (existingSymbols.has(market.ticker.toUpperCase())) {
      continue;
    }

    createCalls.push(
      await service.buildCreateMarketCall(buildLocalMarketConfig(market))
    );
  }

  if (createCalls.length > 0) {
    console.info(
      `Creating ${createCalls.length} on-chain perp market(s)...`,
      undefined,
      'Script'
    );
    await sendOnchainPerpCalls({
      calls: createCalls,
      rpcUrl: LOCAL_RPC_URL,
      privateKey: LOCAL_ACCOUNT_0_PRIVATE_KEY as Hex,
    });
  }

  const refreshedMarkets = await service.getMarkets();
  const marketBySymbol = new Map(
    refreshedMarkets.map((market) => [market.symbol.toUpperCase(), market])
  );
  const publishMarketIds: Hex[] = [];
  const publishPrices: bigint[] = [];

  for (const market of seededMarkets) {
    const onchainMarket = marketBySymbol.get(market.ticker.toUpperCase());
    if (!onchainMarket) {
      continue;
    }

    publishMarketIds.push(onchainMarket.id);
    publishPrices.push(toPriceUnits(resolveBootstrapPrice(market)));
  }

  if (publishMarketIds.length > 0) {
    const latestBlock = await service.publicClient.getBlock({
      blockTag: 'latest',
    });
    const publishTimestamp = Number(latestBlock.timestamp) + 1;
    await (
      service.publicClient as {
        request: (request: {
          method: string;
          params?: unknown[];
        }) => Promise<unknown>;
      }
    ).request({
      method: 'evm_setNextBlockTimestamp',
      params: [publishTimestamp],
    });
    const publishCall = await service.publishOraclePrices({
      marketIds: publishMarketIds,
      prices: publishPrices,
      timestamp: publishTimestamp,
    });
    await sendOnchainPerpCalls({
      calls: [publishCall],
      rpcUrl: LOCAL_RPC_URL,
      privateKey: LOCAL_ACCOUNT_0_PRIVATE_KEY as Hex,
    });
  }

  await ensureLocalLiquidity(service, refreshedMarkets);
}

async function ensureLocalLiquidity(
  service: OnchainPerpService,
  markets: Awaited<ReturnType<OnchainPerpService['getMarkets']>>
): Promise<void> {
  if (markets.length === 0) {
    return;
  }

  const engineConfig = await service.getEngineConfig();
  const additionalLiquidityByMarket = new Map<string, bigint>();

  for (const market of markets) {
    const targetVault = toUsdUnits(TARGET_MARKET_LIQUIDITY_USD);
    if (market.vaultBalance >= targetVault) {
      continue;
    }

    additionalLiquidityByMarket.set(
      market.id,
      targetVault - market.vaultBalance
    );
  }

  if (additionalLiquidityByMarket.size === 0) {
    return;
  }

  const totalAdditionalNormalized = [
    ...additionalLiquidityByMarket.values(),
  ].reduce((sum, value) => sum + value, 0n);
  const freeCollateral = await service.getFreeCollateral(
    LOCAL_ACCOUNT_0 as Address
  );
  const depositNeededNormalized =
    totalAdditionalNormalized > freeCollateral
      ? totalAdditionalNormalized - freeCollateral
      : 0n;
  const depositNeededRaw = denormalizeCollateralToRaw(
    depositNeededNormalized,
    engineConfig.collateralDecimals
  );
  const allowance = (await service.publicClient.readContract({
    address: engineConfig.collateralToken,
    abi: ERC20_INTERFACE,
    functionName: 'allowance',
    args: [LOCAL_ACCOUNT_0 as Address, service.diamondAddress],
  })) as bigint;
  const liquidityCalls = [];

  if (depositNeededRaw > 0n && allowance < depositNeededRaw) {
    liquidityCalls.push({
      to: engineConfig.collateralToken,
      data: encodeFunctionData({
        abi: ERC20_INTERFACE,
        functionName: 'approve',
        args: [service.diamondAddress, 2n ** 256n - 1n],
      }),
      description: 'approve-local-liquidity-collateral',
    });
  }

  if (depositNeededRaw > 0n) {
    liquidityCalls.push({
      to: service.diamondAddress,
      data: encodeFunctionData({
        abi: PERP_COLLATERAL_INTERFACE,
        functionName: 'depositPerpCollateral',
        args: [depositNeededRaw],
      }),
      description: 'deposit-local-liquidity-collateral',
    });
  }

  for (const [
    marketId,
    normalizedAmount,
  ] of additionalLiquidityByMarket.entries()) {
    const rawAmount = denormalizeCollateralToRaw(
      normalizedAmount,
      engineConfig.collateralDecimals
    );
    if (rawAmount === 0n) {
      continue;
    }

    liquidityCalls.push({
      to: service.diamondAddress,
      data: encodeFunctionData({
        abi: PERP_COLLATERAL_INTERFACE,
        functionName: 'addPerpLiquidity',
        args: [marketId as Hex, rawAmount],
      }),
      description: `add-liquidity-${marketId}`,
    });
  }

  if (liquidityCalls.length > 0) {
    await sendOnchainPerpCalls({
      calls: liquidityCalls,
      rpcUrl: LOCAL_RPC_URL,
      privateKey: LOCAL_ACCOUNT_0_PRIVATE_KEY as Hex,
    });
  }
}

async function fundKnownWallets(): Promise<void> {
  applyLocalChainEnv();

  const diamondAddress = await requireLocalDiamondAddress();
  const service = new OnchainPerpService({
    diamondAddress,
    rpcUrl: LOCAL_RPC_URL,
  });
  const engineConfig = await service.getEngineConfig();
  const rows = await db
    .select({ walletAddress: users.walletAddress })
    .from(users);
  const walletAddresses = [
    ...new Set([
      ...rows.map((row) => row.walletAddress),
      process.env.ORACLE_SIGNER ?? LOCAL_ORACLE_ADDRESS,
    ]),
  ]
    .filter(
      (walletAddress): walletAddress is string =>
        typeof walletAddress === 'string' &&
        /^0x[a-fA-F0-9]{40}$/.test(walletAddress)
    )
    .map((walletAddress) => walletAddress.toLowerCase() as Address)
    .filter((walletAddress) => walletAddress !== LOCAL_ACCOUNT_0.toLowerCase());

  if (walletAddresses.length === 0) {
    return;
  }

  const mintCalls = [];

  for (const walletAddress of walletAddresses) {
    const ethBalance = await service.publicClient.getBalance({
      address: walletAddress,
    });
    if (ethBalance < TARGET_WALLET_ETH) {
      await requireLocalRpcSuccess('anvil_setBalance', [
        walletAddress,
        `0x${TARGET_WALLET_ETH.toString(16)}`,
      ]);
    }

    const usdcBalance = (await service.publicClient.readContract({
      address: engineConfig.collateralToken,
      abi: ERC20_INTERFACE,
      functionName: 'balanceOf',
      args: [walletAddress],
    })) as bigint;
    if (usdcBalance < TARGET_WALLET_USDC_RAW) {
      mintCalls.push({
        to: engineConfig.collateralToken,
        data: encodeFunctionData({
          abi: ERC20_INTERFACE,
          functionName: 'mint',
          args: [walletAddress, TARGET_WALLET_USDC_RAW - usdcBalance],
        }),
        description: `mint-usdc-${walletAddress}`,
      });
    }
  }

  if (mintCalls.length > 0) {
    await sendOnchainPerpCalls({
      calls: mintCalls,
      rpcUrl: LOCAL_RPC_URL,
      privateKey: LOCAL_ACCOUNT_0_PRIVATE_KEY as Hex,
    });
  }
}

async function deployNftContract(): Promise<void> {
  const contractsDir = join(process.cwd(), 'packages', 'contracts');
  const candidateAddresses = [
    process.env.NFT_CONTRACT_ADDRESS,
    ...LOCAL_ENV_FILES.map((envPath) =>
      readEnvValue(envPath, 'NFT_CONTRACT_ADDRESS')
    ),
  ].filter(
    (value): value is string =>
      typeof value === 'string' &&
      value !== '0x0000000000000000000000000000000000000000'
  );

  for (const existingAddress of candidateAddresses) {
    const deployed = await isContractDeployed(existingAddress);
    if (deployed) {
      applyPersistentEnvUpdates({
        NFT_CONTRACT_ADDRESS: existingAddress,
      });
      console.info(
        `✅ NFT contract already deployed at ${existingAddress}`,
        undefined,
        'Script'
      );
      return;
    }
  }

  console.info('Deploying ProtoMonkeysNFT contract...', undefined, 'Script');

  const result =
    await $`forge script script/DeployProtoMonkeysNFT.s.sol:DeployProtoMonkeysNFTLocal --rpc-url ${LOCAL_RPC_URL} --private-key ${LOCAL_ACCOUNT_0_PRIVATE_KEY} --broadcast`
      .cwd(contractsDir)
      .env({
        ...process.env,
        NFT_SIGNER_ADDRESS: LOCAL_ACCOUNT_0,
        NFT_BASE_URI: 'http://localhost:3000/api/nft/metadata/',
      })
      .quiet();

  const output = result.text();
  const addressMatch = output.match(
    /ProtoMonkeysNFT deployed to:\s*(0x[a-fA-F0-9]{40})/
  );
  if (!addressMatch) {
    console.warn(
      '⚠️  Could not parse NFT contract address from output',
      undefined,
      'Script'
    );
    return;
  }

  const nftContractAddress = addressMatch[1] as string;
  console.info(
    `✅ ProtoMonkeysNFT deployed to: ${nftContractAddress}`,
    undefined,
    'Script'
  );

  applyPersistentEnvUpdates({
    NFT_CONTRACT_ADDRESS: nftContractAddress,
    NFT_CHAIN_ID: LOCAL_CHAIN_ID,
    NEXT_PUBLIC_CHAIN_ID: LOCAL_CHAIN_ID,
    NEXT_PUBLIC_ENABLE_ONCHAIN_PERPS: 'true',
    NEXT_PUBLIC_PERP_SETTLEMENT_MODE: 'onchain',
    PERP_SETTLEMENT_MODE: 'onchain',
    NFT_SIGNER_PRIVATE_KEY: LOCAL_ACCOUNT_0_PRIVATE_KEY,
    NFT_SIGNER_ADDRESS: LOCAL_ACCOUNT_0,
    NFT_BASE_URI: 'http://localhost:3000/api/nft/metadata/',
  });

  await seedNftData(nftContractAddress);
}

async function seedNftData(contractAddress: string): Promise<void> {
  console.info('Seeding NFT collection...', undefined, 'Script');

  const env = {
    ...process.env,
    NFT_CONTRACT_ADDRESS: contractAddress,
    NFT_CHAIN_ID: LOCAL_CHAIN_ID,
    NEXT_PUBLIC_CHAIN_ID: LOCAL_CHAIN_ID,
    NEXT_PUBLIC_ENABLE_ONCHAIN_PERPS: 'true',
    NEXT_PUBLIC_PERP_SETTLEMENT_MODE: 'onchain',
    PERP_SETTLEMENT_MODE: 'onchain',
  };

  Object.assign(process.env, env);

  await runNftCollectionSeed({ closeAfter: false });
  await runLocalNftSnapshotSeed({ closeAfter: false });
}

async function main() {
  applyLocalChainEnv();

  const chainReady = await waitForLocalChain();
  if (!chainReady) {
    console.error(
      '❌ Local Anvil node failed to start within 30 seconds',
      undefined,
      'Script'
    );
    process.exit(1);
  }

  const deployment = await loadDeploymentFromDisk('localnet');
  const forceRedeploy =
    process.env.BABYLON_FORCE_LOCAL_REDEPLOY === '1' ||
    process.env.BABYLON_FORCE_LOCAL_REDEPLOY === 'true';
  let needsDeploy = forceRedeploy;

  if (forceRedeploy) {
    console.info('♻️  Forced local redeploy requested', undefined, 'Script');
  }

  if (!forceRedeploy && deployment?.contracts.diamond) {
    applyDiamondEnv(deployment.contracts.diamond);
    applyPredictionMarketEnv(deployment.contracts);
    const [diamondReady, predictionContractsReady] = await Promise.all([
      isOnchainPerpDiamondReady(deployment.contracts.diamond),
      arePredictionContractsReady(deployment.contracts),
    ]);
    if (diamondReady && predictionContractsReady) {
      console.info(
        '✅ Contracts already deployed at saved local addresses',
        undefined,
        'Script'
      );
      needsDeploy = false;
    } else {
      console.info(
        '♻️  Saved local deployment is stale or missing on-chain perp/prediction contracts; redeploying',
        undefined,
        'Script'
      );
    }
  }

  if (needsDeploy) {
    await resetLocalChainState();
    await resetLocalOracleState();
    console.info(
      'Deploying Babylon contracts to local Anvil...',
      undefined,
      'Script'
    );
    await $`bun run deploy:local`;
    console.info('✅ Babylon contracts deployed locally', undefined, 'Script');

    const refreshedDeployment = await loadDeploymentFromDisk('localnet');
    if (refreshedDeployment?.contracts.diamond) {
      applyDiamondEnv(refreshedDeployment.contracts.diamond);
    }
    if (refreshedDeployment?.contracts) {
      applyPredictionMarketEnv(refreshedDeployment.contracts);
    }
  }

  await deployNftContract();
  await bootstrapOnchainPerpMarkets();
  await fundKnownWallets();

  console.info(
    `✅ Local chain ready with deployer ${LOCAL_ACCOUNT_0}`,
    undefined,
    'Script'
  );

  if (shouldExitAfterBootstrap()) {
    await closeDatabase();
    process.exit(0);
    return;
  }

  await new Promise(() => {});
}

main().catch((error) => {
  console.error('Failed to bootstrap local chain', error, 'Script');
  process.exit(1);
});
