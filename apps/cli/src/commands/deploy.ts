#!/usr/bin/env bun

/**
 * Deploy Commands
 *
 * Commands:
 *   local     - Deploy contracts to local Anvil
 *   testnet   - Deploy contracts to Base Sepolia testnet
 *   mainnet   - Deploy contracts to Base mainnet
 *   setup     - Post-deployment testnet setup
 */

import { PerpDbAdapter } from '@babylon/core/markets/perps';
import {
  denormalizeCollateralToRaw,
  OnchainPerpService,
  sendOnchainPerpCalls,
  toPriceUnits,
} from '@babylon/engine';
import { ERC20_MINIMAL_ABI, PERP_COLLATERAL_ABI } from '@babylon/shared';
import { $ } from 'bun';
import { ethers } from 'ethers';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  type Address,
  encodeFunctionData,
  type Hex,
  maxUint256,
  parseAbi,
} from 'viem';
import { getFlag, getOption, parseArgs, wantsHelp } from '../lib/args.js';
import { logger } from '../lib/logger.js';

// Path to deployments directory
const DEPLOYMENTS_DIR = join(
  process.cwd(),
  'packages',
  'contracts',
  'deployments'
);

// Path to contracts package (foundry.toml location)
const CONTRACTS_DIR = join(process.cwd(), 'packages', 'contracts');
const LOCAL_RPC_URL =
  process.env.LOCAL_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  'http://localhost:8545';
const LOCAL_RPC_PORT = new URL(LOCAL_RPC_URL).port || '8545';
const DEFAULT_INITIAL_VAULT_LIQUIDITY_USD = 250_000;
const ERC20_INTERFACE = parseAbi([...ERC20_MINIMAL_ABI]);
const PERP_COLLATERAL_INTERFACE = parseAbi([...PERP_COLLATERAL_ABI]);

// Network configurations
const NETWORKS = {
  local: {
    rpcUrl: LOCAL_RPC_URL,
    chainId: 31337,
    privateKey:
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    name: 'Anvil Local',
  },
  testnet: {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    chainId: 84532,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY || '',
    name: 'Base Sepolia',
  },
  mainnet: {
    rpcUrl: process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org',
    chainId: 8453,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY || '',
    name: 'Base Mainnet',
  },
} as const;

type NetworkName = keyof typeof NETWORKS;
type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type BootstrapMarketDefinition = {
  symbol: string;
  indexPrice: number;
  maxOpenInterestUsd: number;
  maxSkewBase: number;
  skewScaleBase: number;
  minTradeSizeBase: number;
  initialMarginBps: number;
  maintenanceMarginBps: number;
  liquidationFeeBps: number;
  openFeeBps: number;
  closeFeeBps: number;
  maxFundingVelocityBps: number;
  maxPriceImpactBps: number;
  minLiquidityBps: number;
  initialVaultLiquidityUsd: number;
};

function printHelp(): void {
  console.log(`
Deploy Commands

USAGE:
  babylon deploy <command> [options]

COMMANDS:
  local       Deploy to local Anvil node
  testnet     Deploy to Base Sepolia testnet
  mainnet     Deploy to Base mainnet
  setup       Post-deployment testnet setup

OPTIONS:
  --skip-verify    Skip contract verification on block explorer
  --force          Force deployment even if contracts exist
  --network        Network for setup command (local, testnet, mainnet)

ENVIRONMENT:
  DEPLOYER_PRIVATE_KEY    Private key for deployment (testnet/mainnet)
  BASE_SEPOLIA_RPC_URL    RPC URL for testnet
  BASE_MAINNET_RPC_URL    RPC URL for mainnet
  BASESCAN_API_KEY        API key for Base contract verification
  BABYLON_PERP_MARKETS_JSON  Optional JSON market definitions for deploy setup

EXAMPLES:
  babylon deploy local              Deploy to local Anvil
  babylon deploy testnet            Deploy to Base Sepolia
  babylon deploy mainnet --force    Force mainnet deployment
  babylon deploy setup --network testnet   Bootstrap perp markets after deploy
`);
}

export function parseDeploymentOutput(output: string): Record<string, string> {
  const addresses: Record<string, string> = {};

  // Parse Diamond address - matches both "Diamond: 0x..." and "Diamond (Proxy): 0x..."
  const diamondMatch = output.match(
    /Diamond(?: \(Proxy\))?:\s*(0x[a-fA-F0-9]{40})/
  );
  if (diamondMatch) addresses.diamond = diamondMatch[1]!;

  // Parse other addresses - all use "Name: 0x..." format from forge script
  const patterns = [
    ['diamondCutFacet', /DiamondCutFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['diamondLoupeFacet', /DiamondLoupeFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['predictionMarketFacet', /PredictionMarketFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['oracleFacet', /OracleFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['gameOracleFacet', /GameOracleFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['liquidityPoolFacet', /LiquidityPoolFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['perpetualMarketFacet', /PerpetualMarketFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['referralSystemFacet', /ReferralSystemFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['priceStorageFacet', /PriceStorageFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['perpAdminFacet', /PerpAdminFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['perpCollateralFacet', /PerpCollateralFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['perpOrderFacet', /PerpOrderFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['perpSettlementFacet', /PerpSettlementFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['perpViewFacet', /PerpViewFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['identityRegistry', /IdentityRegistry:\s*(0x[a-fA-F0-9]{40})/],
    ['reputationSystem', /ReputationSystem:\s*(0x[a-fA-F0-9]{40})/],
    ['babylonOracle', /BabylonGameOracle:\s*(0x[a-fA-F0-9]{40})/],
    ['banManager', /BanManager:\s*(0x[a-fA-F0-9]{40})/],
    [
      'chainlinkOracle',
      /ChainlinkOracle(?:\s*\(Mock\))?:\s*(0x[a-fA-F0-9]{40})/,
    ],
    ['mockOracle', /MockOracle:\s*(0x[a-fA-F0-9]{40})/],
    ['mockUsdc', /MockUSDC:\s*(0x[a-fA-F0-9]{40})/],
    ['testToken', /TestToken:\s*(0x[a-fA-F0-9]{40})/],
  ] as const;

  for (const [name, pattern] of patterns) {
    const match = output.match(pattern);
    if (match) addresses[name] = match[1]!;
  }

  return addresses;
}

const REMOVED_FACET_ENV_KEYS = [
  'NEXT_PUBLIC_LIQUIDITY_POOL_FACET',
  'NEXT_PUBLIC_PERPETUAL_MARKET_FACET',
  'NEXT_PUBLIC_PRICE_STORAGE_FACET',
] as const;

export function buildDeploymentEnvUpdates(
  addresses: Record<string, string>,
  chainId: number
): Record<string, string> {
  const diamondAddress = addresses.diamond;
  if (!diamondAddress) {
    throw new Error(
      'Deployment output did not include the Babylon diamond address'
    );
  }

  const updates: Record<string, string> = {
    BABYLON_DIAMOND_ADDRESS: diamondAddress,
    NEXT_PUBLIC_DIAMOND_ADDRESS: diamondAddress,
    BABYLON_CHAIN_ID: String(chainId),
  };

  const mapping: Array<[string, string | undefined]> = [
    ['NEXT_PUBLIC_IDENTITY_REGISTRY', addresses.identityRegistry],
    ['NEXT_PUBLIC_REPUTATION_SYSTEM', addresses.reputationSystem],
    ['NEXT_PUBLIC_PREDICTION_MARKET_FACET', addresses.predictionMarketFacet],
    ['NEXT_PUBLIC_ORACLE_FACET', addresses.oracleFacet],
    ['NEXT_PUBLIC_GAME_ORACLE_FACET', addresses.gameOracleFacet],
    ['NEXT_PUBLIC_REFERRAL_SYSTEM_FACET', addresses.referralSystemFacet],
    ['NEXT_PUBLIC_PERP_ADMIN_FACET', addresses.perpAdminFacet],
    ['NEXT_PUBLIC_PERP_COLLATERAL_FACET', addresses.perpCollateralFacet],
    ['NEXT_PUBLIC_PERP_ORDER_FACET', addresses.perpOrderFacet],
    ['NEXT_PUBLIC_PERP_SETTLEMENT_FACET', addresses.perpSettlementFacet],
    ['NEXT_PUBLIC_PERP_VIEW_FACET', addresses.perpViewFacet],
    ['NEXT_PUBLIC_BABYLON_ORACLE', addresses.babylonOracle],
    ['NEXT_PUBLIC_BAN_MANAGER', addresses.banManager],
    ['NEXT_PUBLIC_CHAINLINK_ORACLE', addresses.chainlinkOracle],
    ['NEXT_PUBLIC_MOCK_ORACLE', addresses.mockOracle],
    ['NEXT_PUBLIC_MOCK_USDC', addresses.mockUsdc],
    ['NEXT_PUBLIC_TEST_TOKEN', addresses.testToken],
  ];

  for (const [key, value] of mapping) {
    if (value) {
      updates[key] = value;
    }
  }

  return updates;
}

function applyEnvAssignments(
  envContent: string,
  updates: Record<string, string>
): string {
  let nextContent = envContent;

  for (const key of REMOVED_FACET_ENV_KEYS) {
    nextContent = nextContent.replace(new RegExp(`^${key}=.*\\n?`, 'gm'), '');
  }

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(nextContent)) {
      nextContent = nextContent.replace(regex, `${key}=${value}`);
      continue;
    }

    nextContent += `\n${key}=${value}`;
  }

  return nextContent;
}

async function runCommand(
  argv: string[],
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }
): Promise<CommandResult> {
  const child = Bun.spawn(argv, {
    cwd: options?.cwd ?? process.cwd(),
    env: options?.env ?? process.env,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    child.stdout ? new Response(child.stdout).text() : Promise.resolve(''),
    child.stderr ? new Response(child.stderr).text() : Promise.resolve(''),
    child.exited,
  ]);

  return { exitCode, stdout, stderr };
}

function resolveBootstrapPrice(input: {
  indexPrice?: number | null;
  markPrice?: number | null;
  currentPrice?: number | null;
}): number {
  const candidates = [input.indexPrice, input.markPrice, input.currentPrice];

  for (const candidate of candidates) {
    if (
      typeof candidate === 'number' &&
      Number.isFinite(candidate) &&
      candidate > 0
    ) {
      return candidate;
    }
  }

  throw new Error('Perp market bootstrap requires a strictly positive price');
}

function buildBootstrapMarketDefinition(input: {
  ticker: string;
  openInterest: number;
  minOrderSize?: number | null;
  indexPrice?: number | null;
  markPrice?: number | null;
  currentPrice?: number | null;
}): BootstrapMarketDefinition {
  const indexPrice = resolveBootstrapPrice(input);
  const minOrderUsd = Math.max(input.minOrderSize ?? 10, 10);
  const maxOpenInterestUsd = Math.max(
    input.openInterest * 25,
    DEFAULT_INITIAL_VAULT_LIQUIDITY_USD * 10,
    5_000_000
  );
  const skewScaleBase = Math.max(maxOpenInterestUsd / indexPrice, 2_500);
  const maxSkewBase = Math.max(skewScaleBase / 4, minOrderUsd / indexPrice);
  const minTradeSizeBase = Math.max(minOrderUsd / indexPrice, 0.01);

  return {
    symbol: input.ticker.trim().toUpperCase(),
    indexPrice,
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
    initialVaultLiquidityUsd: DEFAULT_INITIAL_VAULT_LIQUIDITY_USD,
  };
}

function parseBootstrapMarketDefinitions(
  json: string
): BootstrapMarketDefinition[] {
  const parsed = JSON.parse(json) as unknown;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('BABYLON_PERP_MARKETS_JSON must be a non-empty array');
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(
        `Perp market definition at index ${index} is not an object`
      );
    }

    const record = entry as Record<string, unknown>;
    const symbol =
      typeof record.symbol === 'string'
        ? record.symbol.trim().toUpperCase()
        : '';
    const indexPrice =
      typeof record.indexPrice === 'number'
        ? record.indexPrice
        : Number(record.indexPrice);
    const maxOpenInterestUsd =
      typeof record.maxOpenInterestUsd === 'number'
        ? record.maxOpenInterestUsd
        : Number(record.maxOpenInterestUsd);
    const maxSkewBase =
      typeof record.maxSkewBase === 'number'
        ? record.maxSkewBase
        : Number(record.maxSkewBase);
    const skewScaleBase =
      typeof record.skewScaleBase === 'number'
        ? record.skewScaleBase
        : Number(record.skewScaleBase);
    const minTradeSizeBase =
      typeof record.minTradeSizeBase === 'number'
        ? record.minTradeSizeBase
        : Number(record.minTradeSizeBase);
    const initialVaultLiquidityUsd =
      typeof record.initialVaultLiquidityUsd === 'number'
        ? record.initialVaultLiquidityUsd
        : Number(
            record.initialVaultLiquidityUsd ??
              DEFAULT_INITIAL_VAULT_LIQUIDITY_USD
          );

    if (!symbol) {
      throw new Error(
        `Perp market definition at index ${index} is missing symbol`
      );
    }

    const numericFields = [
      ['indexPrice', indexPrice],
      ['maxOpenInterestUsd', maxOpenInterestUsd],
      ['maxSkewBase', maxSkewBase],
      ['skewScaleBase', skewScaleBase],
      ['minTradeSizeBase', minTradeSizeBase],
      ['initialVaultLiquidityUsd', initialVaultLiquidityUsd],
    ] as const;

    for (const [field, value] of numericFields) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(
          `Perp market ${symbol} has invalid ${field}: ${String(value)}`
        );
      }
    }

    return {
      symbol,
      indexPrice,
      maxOpenInterestUsd,
      maxSkewBase,
      skewScaleBase,
      minTradeSizeBase,
      initialMarginBps: Number(record.initialMarginBps ?? 1_000),
      maintenanceMarginBps: Number(record.maintenanceMarginBps ?? 500),
      liquidationFeeBps: Number(record.liquidationFeeBps ?? 100),
      openFeeBps: Number(record.openFeeBps ?? 10),
      closeFeeBps: Number(record.closeFeeBps ?? 10),
      maxFundingVelocityBps: Number(record.maxFundingVelocityBps ?? 300),
      maxPriceImpactBps: Number(record.maxPriceImpactBps ?? 2_000),
      minLiquidityBps: Number(record.minLiquidityBps ?? 1_000),
      initialVaultLiquidityUsd,
    };
  });
}

async function loadBootstrapMarketDefinitions(): Promise<
  BootstrapMarketDefinition[]
> {
  const explicitDefinitions = process.env.BABYLON_PERP_MARKETS_JSON?.trim();
  if (explicitDefinitions) {
    return parseBootstrapMarketDefinitions(explicitDefinitions);
  }

  const seededMarkets = await new PerpDbAdapter().listMarkets();
  if (seededMarkets.length === 0) {
    throw new Error(
      'No seeded perp market snapshots found. Seed the database first or set BABYLON_PERP_MARKETS_JSON.'
    );
  }

  return seededMarkets.map((market) =>
    buildBootstrapMarketDefinition({
      ticker: market.ticker,
      openInterest: market.openInterest,
      minOrderSize: market.minOrderSize,
      indexPrice: market.indexPrice,
      markPrice: market.markPrice,
      currentPrice: market.currentPrice,
    })
  );
}

function getDeploymentPathForNetwork(network: NetworkName): string {
  const networkDir =
    network === 'local'
      ? 'local'
      : network === 'testnet'
        ? 'base-sepolia'
        : 'base';
  return join(DEPLOYMENTS_DIR, networkDir, 'index.json');
}

function readDeploymentAddress(network: NetworkName): string | null {
  const deploymentPath = getDeploymentPathForNetwork(network);
  if (!existsSync(deploymentPath)) {
    return null;
  }

  const deployment = JSON.parse(readFileSync(deploymentPath, 'utf-8')) as {
    contracts?: Record<string, string>;
  };

  const diamondAddress = deployment.contracts?.diamond;
  return typeof diamondAddress === 'string' && diamondAddress.length > 0
    ? diamondAddress
    : null;
}

function getSetupNetwork(
  requested: string | undefined
): Exclude<NetworkName, never> {
  if (requested === undefined || requested === '') {
    return 'testnet';
  }

  if (
    requested === 'local' ||
    requested === 'testnet' ||
    requested === 'mainnet'
  ) {
    return requested;
  }

  throw new Error(`Unsupported setup network: ${requested}`);
}

/**
 * Save deployment addresses to the deployments JSON file.
 * This ensures the @babylon/contracts package loads fresh addresses.
 */
function saveDeploymentJson(
  network: string,
  chainId: number,
  addresses: Record<string, string>,
  deployer: string,
  blockNumber: number
): void {
  const networkDir =
    network === 'local'
      ? 'local'
      : network === 'testnet'
        ? 'base-sepolia'
        : 'base';
  const deploymentDir = join(DEPLOYMENTS_DIR, networkDir);

  // Ensure directory exists
  if (!existsSync(deploymentDir)) {
    mkdirSync(deploymentDir, { recursive: true });
  }

  const deployment = {
    network: networkDir === 'local' ? 'localnet' : networkDir,
    chainId,
    contracts: addresses,
    deployer,
    timestamp: new Date().toISOString(),
    blockNumber,
  };

  // Save JSON file
  const jsonPath = join(deploymentDir, 'index.json');
  writeFileSync(jsonPath, JSON.stringify(deployment, null, 2) + '\n');

  // Also update/create the TypeScript export if it doesn't exist
  const tsPath = join(deploymentDir, 'index.ts');
  if (!existsSync(tsPath)) {
    const tsContent = `import deployment from './index.json';\nexport default deployment;\n`;
    writeFileSync(tsPath, tsContent);
  }

  logger.success(`Saved deployment to ${jsonPath}`);
}

async function checkForge(): Promise<boolean> {
  const result = await runCommand(['forge', '--version']);
  return result.exitCode === 0;
}

async function deployToNetwork(
  network: NetworkName,
  skipVerify: boolean,
  _force: boolean
): Promise<void> {
  const config = NETWORKS[network];

  logger.header(`Deploying to ${config.name}`);

  // Check forge is installed
  if (!(await checkForge())) {
    logger.fail('Foundry (forge) not installed');
    console.log(
      '\nInstall with: curl -L https://foundry.paradigm.xyz | bash && foundryup'
    );
    process.exit(1);
  }

  // Check private key for non-local
  if (network !== 'local' && !config.privateKey) {
    logger.fail('DEPLOYER_PRIVATE_KEY not set');
    console.log('\nSet it in your environment:');
    console.log('  export DEPLOYER_PRIVATE_KEY=0x...');
    process.exit(1);
  }

  if (!skipVerify && network !== 'local' && !process.env.BASESCAN_API_KEY) {
    logger.fail('BASESCAN_API_KEY not set');
    console.log('\nSet it in your environment:');
    console.log('  export BASESCAN_API_KEY=...');
    process.exit(1);
  }

  // For local, check Anvil is running
  if (network === 'local') {
    const blockCheck = await runCommand([
      'cast',
      'block-number',
      '--rpc-url',
      config.rpcUrl,
    ]);
    if (blockCheck.exitCode !== 0) {
      logger.fail('Local Anvil node is not running');
      console.log(
        `\nStart it with: anvil --host 0.0.0.0 --port ${LOCAL_RPC_PORT}`
      );
      console.log('Or run: bun run dev (which starts Anvil automatically)');
      process.exit(1);
    }
    logger.success('Local Anvil node is running');
  }

  // Compile contracts (run from contracts directory where foundry.toml is)
  logger.step('Compiling contracts...');
  const compileResult = await runCommand(['forge', 'build'], {
    cwd: CONTRACTS_DIR,
  });
  if (compileResult.exitCode !== 0) {
    logger.fail('Contract compilation failed');
    console.log('\nCompilation output:');
    console.log(compileResult.stderr || compileResult.stdout);
    process.exit(1);
  }
  logger.success('Contracts compiled');

  // Clean previous artifacts for local
  if (network === 'local') {
    logger.step('Cleaning previous artifacts...');
    await $`rm -rf ${CONTRACTS_DIR}/broadcast ${CONTRACTS_DIR}/cache`.quiet();

    // Keep local mining immediate so deployment/bootstrap transactions settle synchronously.
    const automineResult = await runCommand(
      ['cast', 'rpc', 'evm_setAutomine', 'true', '--rpc-url', config.rpcUrl],
      { cwd: CONTRACTS_DIR }
    );
    if (automineResult.exitCode !== 0) {
      logger.fail('Failed to configure local Anvil automine');
      console.log('\nRPC output:');
      console.log(automineResult.stderr || automineResult.stdout);
      process.exit(1);
    }
  }

  // Deploy (run from contracts directory where foundry.toml is)
  logger.step('Deploying contracts...');

  const scriptPath = 'script/DeployBabylon.s.sol:DeployBabylon';
  process.env.DEPLOYER_PRIVATE_KEY = config.privateKey;

  const verifyFlag = !skipVerify && network !== 'local' ? '--verify' : '';

  const result = await runCommand(
    [
      'forge',
      'script',
      scriptPath,
      '--rpc-url',
      config.rpcUrl,
      '--private-key',
      config.privateKey,
      '--broadcast',
      ...(network === 'local' ? ['--slow'] : []),
      ...(verifyFlag ? [verifyFlag] : []),
    ],
    {
      cwd: CONTRACTS_DIR,
      env: process.env,
    }
  );
  const output = `${result.stdout}\n${result.stderr}`;

  if (result.exitCode !== 0) {
    logger.fail('Contract deployment failed');
    console.log('\nDeployment output:');
    console.log(output.trim());
    process.exit(1);
  }

  const addresses = parseDeploymentOutput(output);

  if (!addresses.diamond) {
    throw new Error('Failed to parse deployment addresses');
  }

  logger.success('Deployment complete!');
  console.log('\nContract addresses:');
  console.log(`  Diamond: ${addresses.diamond}`);

  // Derive deployer address from private key
  const wallet = new ethers.Wallet(config.privateKey);
  const deployerAddress = wallet.address;
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const blockNumber = await provider.getBlockNumber();

  // Save to deployments JSON file (this is what @babylon/contracts loads)
  saveDeploymentJson(
    network,
    config.chainId,
    addresses,
    deployerAddress,
    blockNumber
  );

  // Save to env file
  const envFile = network === 'local' ? '.env.local' : `.env.${network}`;
  const envPath = join(process.cwd(), envFile);

  const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  const nextEnvContent = applyEnvAssignments(
    envContent,
    buildDeploymentEnvUpdates(addresses, config.chainId)
  );

  writeFileSync(envPath, nextEnvContent);
  logger.success(`Updated ${envFile}`);
}

async function runPerpSetup(network: NetworkName): Promise<void> {
  const config = NETWORKS[network];
  process.env.NEXT_PUBLIC_ENABLE_ONCHAIN_PERPS = 'true';
  process.env.NEXT_PUBLIC_PERP_SETTLEMENT_MODE = 'onchain';
  process.env.PERP_SETTLEMENT_MODE = 'onchain';
  process.env.NEXT_PUBLIC_CHAIN_ID = String(config.chainId);
  process.env.CHAIN_ID = String(config.chainId);
  process.env.NEXT_PUBLIC_RPC_URL = config.rpcUrl;
  process.env.RPC_URL = config.rpcUrl;

  const diamondAddress =
    process.env.BABYLON_DIAMOND_ADDRESS ||
    process.env.NEXT_PUBLIC_DIAMOND_ADDRESS ||
    readDeploymentAddress(network);
  if (!diamondAddress) {
    logger.fail('Babylon diamond address not found');
    console.log(`\nDeploy first: babylon deploy ${network}`);
    process.exit(1);
  }

  const privateKey = config.privateKey || process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    logger.fail('DEPLOYER_PRIVATE_KEY not set');
    process.exit(1);
  }

  logger.header(`${config.name} Perp Setup`);

  const service = new OnchainPerpService({
    diamondAddress: diamondAddress as Address,
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
  });
  const engineConfig = await service.getEngineConfig();
  const marketDefinitions = await loadBootstrapMarketDefinitions();
  const existingMarkets = await service.getMarkets();
  const existingBySymbol = new Map(
    existingMarkets.map((market) => [market.symbol.toUpperCase(), market])
  );

  const createCalls = [];
  for (const definition of marketDefinitions) {
    if (existingBySymbol.has(definition.symbol)) {
      continue;
    }

    createCalls.push(
      await service.buildCreateMarketCall({
        symbol: definition.symbol,
        maxOpenInterestUsd: definition.maxOpenInterestUsd,
        maxSkewBase: definition.maxSkewBase,
        skewScaleBase: definition.skewScaleBase,
        minTradeSizeBase: definition.minTradeSizeBase,
        initialMarginBps: definition.initialMarginBps,
        maintenanceMarginBps: definition.maintenanceMarginBps,
        liquidationFeeBps: definition.liquidationFeeBps,
        openFeeBps: definition.openFeeBps,
        closeFeeBps: definition.closeFeeBps,
        maxFundingVelocityBps: definition.maxFundingVelocityBps,
        maxPriceImpactBps: definition.maxPriceImpactBps,
        minLiquidityBps: definition.minLiquidityBps,
      })
    );
  }

  if (createCalls.length > 0) {
    logger.step(`Creating ${createCalls.length} perp market(s)...`);
    await sendOnchainPerpCalls({
      calls: createCalls,
      rpcUrl: config.rpcUrl,
      privateKey: privateKey as Hex,
      chainId: config.chainId,
    });
  }

  const refreshedMarkets = await service.getMarkets();
  const refreshedBySymbol = new Map(
    refreshedMarkets.map((market) => [market.symbol.toUpperCase(), market])
  );
  const marketIds: Hex[] = [];
  const prices: bigint[] = [];
  let latestOracleTimestamp = 0;

  for (const definition of marketDefinitions) {
    const market = refreshedBySymbol.get(definition.symbol);
    if (!market) {
      throw new Error(
        `Created market ${definition.symbol} is missing on-chain`
      );
    }

    marketIds.push(market.id);
    prices.push(toPriceUnits(definition.indexPrice));

    if (market.latestVersion > 0n) {
      const latestVersion = await service.getLatestOracleVersion(
        market.id,
        market.latestVersion
      );
      latestOracleTimestamp = Math.max(
        latestOracleTimestamp,
        latestVersion.timestamp
      );
    }
  }

  if (marketIds.length === 0) {
    throw new Error('No perp markets were available for bootstrap');
  }

  const latestBlock = await service.publicClient.getBlock({
    blockTag: 'latest',
  });
  const publishTimestamp = Math.max(
    Number(latestBlock.timestamp),
    latestOracleTimestamp + 1
  );
  logger.step('Publishing initial oracle versions...');
  const publishCall = await service.publishOraclePrices({
    marketIds,
    prices,
    timestamp: publishTimestamp,
  });
  await sendOnchainPerpCalls({
    calls: [publishCall],
    rpcUrl: config.rpcUrl,
    privateKey: privateKey as Hex,
    chainId: config.chainId,
  });

  const deployerAccount = new ethers.Wallet(privateKey).address as Address;
  const allowance = (await service.publicClient.readContract({
    address: engineConfig.collateralToken,
    abi: ERC20_INTERFACE,
    functionName: 'allowance',
    args: [deployerAccount, service.diamondAddress],
  })) as bigint;
  const freeCollateral = await service.getFreeCollateral(deployerAccount);
  const additionalLiquidityByMarket = new Map<Hex, bigint>();

  for (const definition of marketDefinitions) {
    const market = refreshedBySymbol.get(definition.symbol);
    if (!market) {
      continue;
    }

    const targetVaultBalance = ethers.parseUnits(
      String(definition.initialVaultLiquidityUsd),
      18
    );
    if (market.vaultBalance >= targetVaultBalance) {
      continue;
    }

    additionalLiquidityByMarket.set(
      market.id,
      targetVaultBalance - market.vaultBalance
    );
  }

  const totalNormalizedLiquidity = [
    ...additionalLiquidityByMarket.values(),
  ].reduce((sum, value) => sum + value, 0n);
  const depositNeededNormalized =
    totalNormalizedLiquidity > freeCollateral
      ? totalNormalizedLiquidity - freeCollateral
      : 0n;
  const depositNeededRaw = denormalizeCollateralToRaw(
    depositNeededNormalized,
    engineConfig.collateralDecimals
  );
  const liquidityCalls = [];

  if (depositNeededRaw > 0n && allowance < depositNeededRaw) {
    liquidityCalls.push({
      to: engineConfig.collateralToken,
      data: encodeFunctionData({
        abi: ERC20_INTERFACE,
        functionName: 'approve',
        args: [service.diamondAddress, maxUint256],
      }),
      description: 'approve-perp-collateral-for-liquidity',
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
      description: 'deposit-perp-collateral-for-liquidity',
    });
  }

  for (const [marketId, normalizedLiquidity] of additionalLiquidityByMarket) {
    const rawLiquidity = denormalizeCollateralToRaw(
      normalizedLiquidity,
      engineConfig.collateralDecimals
    );
    if (rawLiquidity === 0n) {
      continue;
    }

    liquidityCalls.push({
      to: service.diamondAddress,
      data: encodeFunctionData({
        abi: PERP_COLLATERAL_INTERFACE,
        functionName: 'addPerpLiquidity',
        args: [marketId, rawLiquidity],
      }),
      description: `add-initial-liquidity-${marketId}`,
    });
  }

  if (liquidityCalls.length > 0) {
    logger.step('Seeding initial LP liquidity...');
    await sendOnchainPerpCalls({
      calls: liquidityCalls,
      rpcUrl: config.rpcUrl,
      privateKey: privateKey as Hex,
      chainId: config.chainId,
    });
  }

  logger.success(`${config.name} on-chain perp markets are ready`);
  console.log(`\nDiamond: ${diamondAddress}`);
  console.log(`Collateral token: ${engineConfig.collateralToken}`);
  console.log(
    `Markets: ${marketDefinitions.map((market) => market.symbol).join(', ')}`
  );
}

/**
 * Main entry point for deploy domain commands.
 *
 * @param args - Raw command-line arguments for the deploy domain
 */
export async function runDeployCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (wantsHelp(parsed)) {
    printHelp();
    process.exit(0);
  }

  const skipVerify = getFlag(parsed, 'skip-verify');
  const force = getFlag(parsed, 'force');
  const setupNetwork = getOption(parsed, 'network', 'n');

  switch (parsed.command) {
    case 'local':
      await deployToNetwork('local', true, force);
      break;

    case 'testnet':
      await deployToNetwork('testnet', skipVerify, force);
      break;

    case 'mainnet':
      if (!force) {
        logger.fail('Mainnet deployment requires --force flag');
        console.log(
          '\nThis is a safety check. Use: babylon deploy mainnet --force'
        );
        process.exit(1);
      }
      await deployToNetwork('mainnet', skipVerify, force);
      break;

    case 'setup':
      await runPerpSetup(getSetupNetwork(setupNetwork));
      break;

    default:
      if (parsed.command) {
        logger.fail(`Unknown command: ${parsed.command}`);
      }
      printHelp();
      process.exit(parsed.command ? 1 : 0);
  }
}
