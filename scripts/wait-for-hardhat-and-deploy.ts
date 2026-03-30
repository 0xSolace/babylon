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

import { loadDeployment } from '@babylon/contracts';
import { PerpDbAdapter } from '@babylon/core/markets/perps';
import { closeDatabase, db, users } from '@babylon/db';
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
  createWalletClient,
  encodeFunctionData,
  type Hex,
  http,
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
const TARGET_MARKET_LIQUIDITY_USD = 250_000;
const TARGET_WALLET_ETH = parseEther('5');
const TARGET_WALLET_USDC_RAW = 50_000n * 1_000_000n;

const ERC20_INTERFACE = parseAbi([...ERC20_MINIMAL_ABI]);
const PERP_COLLATERAL_INTERFACE = parseAbi([...PERP_COLLATERAL_ABI]);
type BootstrapMarket = Awaited<
  ReturnType<PerpDbAdapter['listMarkets']>
>[number];

function shouldExitAfterBootstrap(): boolean {
  return (
    process.env.BABYLON_LOCAL_BOOTSTRAP_ONCE === '1' ||
    process.env.BABYLON_LOCAL_BOOTSTRAP_ONCE === 'true'
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
  env.DEPLOYER_PRIVATE_KEY ??= LOCAL_ACCOUNT_0_PRIVATE_KEY;
}

async function isContractDeployed(address: string): Promise<boolean> {
  const response = await fetch(LOCAL_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getCode',
      params: [address, 'latest'],
      id: 1,
    }),
  }).catch(() => null);

  if (!response) {
    return false;
  }

  const payload = (await response.json().catch(() => null)) as {
    result?: string;
  } | null;
  const code = payload?.result ?? '0x';
  return code !== '0x' && code !== '0x0' && code.length > 2;
}

async function waitForLocalChain(): Promise<boolean> {
  console.info('Waiting for local Anvil RPC...', undefined, 'Script');

  for (let attempts = 0; attempts < 30; attempts++) {
    const response = await fetch(LOCAL_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    }).catch(() => null);

    if (response?.ok) {
      console.info('✅ Local Anvil RPC is ready', undefined, 'Script');
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
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

function readEnvValue(envPath: string, key: string): string | null {
  if (!existsSync(envPath)) {
    return null;
  }

  const envContent = readFileSync(envPath, 'utf-8');
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match?.[1]?.trim() ?? null;
}

function applyDiamondEnv(diamondAddress: string): void {
  process.env.NEXT_PUBLIC_DIAMOND_ADDRESS = diamondAddress;
  process.env.BABYLON_DIAMOND_ADDRESS = diamondAddress;
  updateEnvFile(join(process.cwd(), '.env.local'), {
    NEXT_PUBLIC_DIAMOND_ADDRESS: diamondAddress,
    BABYLON_DIAMOND_ADDRESS: diamondAddress,
  });
  updateEnvFile(join(process.cwd(), '.env'), {
    NEXT_PUBLIC_DIAMOND_ADDRESS: diamondAddress,
    BABYLON_DIAMOND_ADDRESS: diamondAddress,
  });
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

  const service = new OnchainPerpService({ rpcUrl: LOCAL_RPC_URL });
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
    const publishCall = await service.publishOraclePrices({
      marketIds: publishMarketIds,
      prices: publishPrices,
      timestamp: Math.floor(Date.now() / 1000),
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

  const service = new OnchainPerpService({ rpcUrl: LOCAL_RPC_URL });
  const engineConfig = await service.getEngineConfig();
  const rows = await db
    .select({ walletAddress: users.walletAddress })
    .from(users);
  const walletAddresses = [...new Set(rows.map((row) => row.walletAddress))]
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

  const account = privateKeyToAccount(LOCAL_ACCOUNT_0_PRIVATE_KEY as Hex);
  const walletClient = createWalletClient({
    account,
    chain: service.publicClient.chain,
    transport: http(LOCAL_RPC_URL),
  });
  const mintCalls = [];

  for (const walletAddress of walletAddresses) {
    const ethBalance = await service.publicClient.getBalance({
      address: walletAddress,
    });
    if (ethBalance < TARGET_WALLET_ETH) {
      const hash = await walletClient.sendTransaction({
        account,
        chain: service.publicClient.chain,
        to: walletAddress,
        value: TARGET_WALLET_ETH - ethBalance,
      });
      await service.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 0,
      });
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
  const envPath = join(process.cwd(), '.env');
  const envLocalPath = join(process.cwd(), '.env.local');
  const contractsDir = join(process.cwd(), 'packages', 'contracts');
  const candidateAddresses = [
    process.env.NFT_CONTRACT_ADDRESS,
    readEnvValue(envLocalPath, 'NFT_CONTRACT_ADDRESS'),
    readEnvValue(envPath, 'NFT_CONTRACT_ADDRESS'),
  ].filter(
    (value): value is string =>
      typeof value === 'string' &&
      value !== '0x0000000000000000000000000000000000000000'
  );

  for (const existingAddress of candidateAddresses) {
    const deployed = await isContractDeployed(existingAddress);
    if (deployed) {
      process.env.NFT_CONTRACT_ADDRESS = existingAddress;
      updateEnvFile(envPath, {
        NFT_CONTRACT_ADDRESS: existingAddress,
      });
      updateEnvFile(envLocalPath, {
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

  updateEnvFile(envPath, {
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
  updateEnvFile(envLocalPath, {
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

  process.env.NFT_CONTRACT_ADDRESS = nftContractAddress;
  process.env.NFT_CHAIN_ID = LOCAL_CHAIN_ID;
  process.env.NEXT_PUBLIC_CHAIN_ID = LOCAL_CHAIN_ID;
  process.env.NEXT_PUBLIC_ENABLE_ONCHAIN_PERPS = 'true';
  process.env.NEXT_PUBLIC_PERP_SETTLEMENT_MODE = 'onchain';
  process.env.PERP_SETTLEMENT_MODE = 'onchain';
  process.env.NFT_SIGNER_PRIVATE_KEY = LOCAL_ACCOUNT_0_PRIVATE_KEY;
  process.env.NFT_SIGNER_ADDRESS = LOCAL_ACCOUNT_0;
  process.env.NFT_BASE_URI = 'http://localhost:3000/api/nft/metadata/';

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

  const deployment = await loadDeployment('localnet');
  let needsDeploy = true;

  if (deployment?.contracts.diamond) {
    applyDiamondEnv(deployment.contracts.diamond);
    const deployed = await isContractDeployed(deployment.contracts.diamond);
    if (deployed) {
      console.info(
        '✅ Contracts already deployed at saved local addresses',
        undefined,
        'Script'
      );
      needsDeploy = false;
    }
  }

  if (needsDeploy) {
    console.info(
      'Deploying Babylon contracts to local Anvil...',
      undefined,
      'Script'
    );
    await $`bun run deploy:local`;
    console.info('✅ Babylon contracts deployed locally', undefined, 'Script');

    const refreshedDeployment = await loadDeployment('localnet');
    if (refreshedDeployment?.contracts.diamond) {
      applyDiamondEnv(refreshedDeployment.contracts.diamond);
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
