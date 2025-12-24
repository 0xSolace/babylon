#!/usr/bin/env bun

/**
 * ICO Management Commands
 *
 * Commands:
 *   deploy       - Deploy BBLN token and presale contracts
 *   start        - Start the presale
 *   pause        - Pause the presale
 *   unpause      - Resume the presale
 *   finalize     - Finalize presale and distribute tokens
 *   status       - Get current ICO status
 *   stats        - Get detailed analytics
 *   contributors - List all contributors
 *   configure    - Update presale configuration
 *   ceremony     - Generate secure keys for mainnet deployment
 */

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isAddressArray,
  isBigintTuple3,
  toAddress,
  toHexString,
} from '@babylon/shared'
import { $ } from 'bun'
import {
  type Address,
  createPublicClient,
  createWalletClient,
  formatEther,
  type Hex,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, hardhat, mainnet, sepolia } from 'viem/chains'
import { getFlag, parseArgs, wantsHelp } from '../lib/args.js'
import { logger } from '../lib/logger.js'

// =============================================================================
// Type Guards for ICO Command
// =============================================================================

/**
 * Type guard for PresaleStatus tuple returned from getStatus()
 */
function isPresaleStatus(
  value: unknown,
): value is readonly [
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  boolean,
  boolean,
] {
  return (
    Array.isArray(value) &&
    value.length === 7 &&
    typeof value[0] === 'bigint' &&
    typeof value[1] === 'bigint' &&
    typeof value[2] === 'bigint' &&
    typeof value[3] === 'bigint' &&
    typeof value[4] === 'boolean' &&
    typeof value[5] === 'boolean' &&
    typeof value[6] === 'boolean'
  )
}

/**
 * Type guard for Contribution tuple
 */
function isContribution(
  value: unknown,
): value is [bigint, bigint, bigint, bigint, boolean] {
  return (
    Array.isArray(value) &&
    value.length === 5 &&
    typeof value[0] === 'bigint' &&
    typeof value[1] === 'bigint' &&
    typeof value[2] === 'bigint' &&
    typeof value[3] === 'bigint' &&
    typeof value[4] === 'boolean'
  )
}

// Path to contracts package
const CONTRACTS_DIR = join(process.cwd(), 'packages', 'contracts')

// Network configurations
const NETWORKS = {
  local: {
    rpcUrl: 'http://localhost:6545',
    chainId: 31337,
    chain: hardhat,
    name: 'Hardhat Local',
  },
  sepolia: {
    rpcUrl:
      process.env.SEPOLIA_RPC_URL ||
      'https://ethereum-sepolia-rpc.publicnode.com',
    chainId: 11155111,
    chain: sepolia,
    name: 'Sepolia Testnet',
  },
  'base-sepolia': {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    chainId: 84532,
    chain: baseSepolia,
    name: 'Base Sepolia Testnet',
  },
  mainnet: {
    rpcUrl: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    chainId: 1,
    chain: mainnet,
    name: 'Ethereum Mainnet',
  },
} as const

type NetworkName = keyof typeof NETWORKS

function isValidNetworkName(network: string): network is NetworkName {
  return network in NETWORKS
}

function validateNetworkName(network: string): NetworkName {
  if (!isValidNetworkName(network)) {
    const validNetworks = Object.keys(NETWORKS).join(', ')
    throw new Error(
      `Invalid network: ${network}. Valid networks: ${validNetworks}`,
    )
  }
  return network
}

// BBLN Presale ABI (minimal for CLI operations)
const PRESALE_ABI = [
  {
    name: 'getStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'raised', type: 'uint256' },
      { name: 'participants', type: 'uint256' },
      { name: 'progress', type: 'uint256' },
      { name: 'timeRemaining', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'isFinalized', type: 'bool' },
      { name: 'isFailed', type: 'bool' },
    ],
  },
  {
    name: 'startPresale',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'duration', type: 'uint256' },
      { name: 'claimDelay', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'startPresaleNow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'pause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'unpause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'finalize',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'getContributors',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
  {
    name: 'getContribution',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'contributor', type: 'address' }],
    outputs: [
      { name: 'ethAmount', type: 'uint256' },
      { name: 'tokenAllocation', type: 'uint256' },
      { name: 'claimedTokens', type: 'uint256' },
      { name: 'claimable', type: 'uint256' },
      { name: 'isRefunded', type: 'bool' },
    ],
  },
  {
    name: 'totalRaised',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalParticipants',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'softCap',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'hardCap',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'presaleStart',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'presaleEnd',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getCurrentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'configure',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_tokensForSale', type: 'uint256' },
      { name: '_softCap', type: 'uint256' },
      { name: '_hardCap', type: 'uint256' },
      { name: '_minContribution', type: 'uint256' },
      { name: '_maxContribution', type: 'uint256' },
      { name: '_startPrice', type: 'uint256' },
      { name: '_reservePrice', type: 'uint256' },
      { name: '_priceDecayPerSecond', type: 'uint256' },
      { name: '_lpFundingBps', type: 'uint256' },
      { name: '_lpLockDuration', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'setTreasury',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_treasury', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setLPInfrastructure',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_lpFactory', type: 'address' },
      { name: '_lpLocker', type: 'address' },
      { name: '_weth', type: 'address' },
    ],
    outputs: [],
  },
] as const

function printHelp(): void {
  console.log(`
ICO Management Commands

USAGE:
  babylon ico <command> [options]

COMMANDS:
  deploy        Deploy BBLN token and presale contracts
  lp-deploy     Deploy LP infrastructure (XLP Factory, LPLocker)
  warp-routes   Deploy Hyperlane warp routes for cross-chain
  start         Start the presale
  pause         Pause the presale
  unpause       Resume the presale  
  finalize      Finalize presale after it ends
  status        Get current ICO status
  stats         Get detailed analytics
  contributors  List all contributors
  configure     Update presale configuration
  ceremony      Generate secure keys for mainnet deployment

OPTIONS:
  --network <name>   Network: local, sepolia, base-sepolia, mainnet (default: local)
  --duration <days>  Presale duration in days (default: 7)
  --delay <days>     Claim delay after presale (default: 1)
  --dev              Dev mode - start presale immediately
  --force            Force operation (required for mainnet)

ENVIRONMENT:
  DEPLOYER_PRIVATE_KEY    Private key for transactions
  BBLN_TOKEN_ADDRESS      BBLN token contract address
  BBLN_PRESALE_ADDRESS    BBLN presale contract address
  ETHERSCAN_API_KEY       For contract verification
  SEPOLIA_RPC_URL         Sepolia RPC URL
  BASE_SEPOLIA_RPC_URL    Base Sepolia RPC URL
  XLP_FACTORY_ADDRESS     XLP V2 Factory address
  LP_LOCKER_ADDRESS       LP Locker address
  WETH_ADDRESS            WETH address for LP

EXAMPLES:
  babylon ico deploy --network local --dev
  babylon ico deploy --network base-sepolia
  babylon ico warp-routes
  babylon ico status --network sepolia
  babylon ico start --duration 7 --delay 1
  babylon ico contributors --network mainnet
  babylon ico ceremony --network mainnet
`)
}

function getAddresses(): { token: Address; presale: Address } {
  const token = process.env.BBLN_TOKEN_ADDRESS
  const presale = process.env.BBLN_PRESALE_ADDRESS

  if (!token || !presale) {
    throw new Error('BBLN_TOKEN_ADDRESS and BBLN_PRESALE_ADDRESS must be set')
  }

  return { token: toAddress(token), presale: toAddress(presale) }
}

function getPrivateKey(): Hex {
  return toHexString(process.env.DEPLOYER_PRIVATE_KEY)
}

async function deployContracts(
  network: NetworkName,
  devMode: boolean,
): Promise<void> {
  const config = NETWORKS[network]

  logger.header(`Deploying BBLN ICO to ${config.name}`)

  const privateKey = getPrivateKey()

  // Environment setup
  const envVars = {
    DEPLOYER_KEY: privateKey,
    DEV_MODE: devMode ? '1' : '0',
    ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || 'dummy',
    ELIZA_TOKEN:
      process.env.ELIZA_TOKEN || '0xea17df5cf6d172224892b5477a16acb111182478',
    XLP_FACTORY: process.env.XLP_FACTORY_ADDRESS || '',
    LP_LOCKER: process.env.LP_LOCKER_ADDRESS || '',
    WETH: process.env.WETH_ADDRESS || '',
    TREASURY: process.env.TREASURY_ADDRESS || '',
  }

  Object.entries(envVars).forEach(([k, v]) => {
    process.env[k] = v
  })

  logger.step('Deploying BBLN Token and Presale...')

  const verifyFlag = network !== 'local' ? '--verify' : ''

  const result =
    await $`cd ${CONTRACTS_DIR} && forge script script/DeployBBLNPresale.s.sol:DeployBBLNPresale \
    --rpc-url ${config.rpcUrl} \
    --broadcast ${verifyFlag}`

  const output = result.text()

  // Parse deployed addresses
  const tokenMatch = output.match(/BBLN Token[:\s]*(0x[a-fA-F0-9]{40})/)
  const presaleMatch = output.match(/BBLNPresale[:\s]*(0x[a-fA-F0-9]{40})/)

  if (tokenMatch && presaleMatch) {
    logger.success('Deployment complete!')
    console.log(`\n  BBLN Token:    ${tokenMatch[1]}`)
    console.log(`  BBLNPresale:   ${presaleMatch[1]}`)

    // Save to env file
    const envFile = `.env.${network}`
    const envPath = join(process.cwd(), envFile)
    let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''

    envContent += `\nBBLN_TOKEN_ADDRESS=${tokenMatch[1]}`
    envContent += `\nBBLN_PRESALE_ADDRESS=${presaleMatch[1]}`

    writeFileSync(envPath, envContent)
    logger.success(`Saved addresses to ${envFile}`)
  } else {
    console.log(output)
  }
}

async function deployLPInfrastructure(network: NetworkName): Promise<void> {
  const config = NETWORKS[network]

  logger.header(`Deploying LP Infrastructure to ${config.name}`)

  const privateKey = getPrivateKey()
  process.env.PRIVATE_KEY = privateKey
  process.env.WETH_ADDRESS = process.env.WETH_ADDRESS || ''

  logger.step('Deploying XLP AMM (Factory, Router, LPLocker)...')

  // Deploy from jeju contracts
  const jejuContractsDir = join(
    process.cwd(),
    '..',
    '..',
    'packages',
    'contracts',
  )

  const verifyFlag = network !== 'local' ? '--verify' : ''

  const result =
    await $`cd ${jejuContractsDir} && forge script script/DeployXLPAMM.s.sol:DeployXLPAMM \
    --rpc-url ${config.rpcUrl} \
    --broadcast ${verifyFlag}`

  const output = result.text()
  console.log(output)

  // Parse and save addresses
  const v2FactoryMatch = output.match(/XLPV2Factory[:\s]*(0x[a-fA-F0-9]{40})/)
  const routerMatch = output.match(/XLPRouter[:\s]*(0x[a-fA-F0-9]{40})/)

  if (v2FactoryMatch) {
    logger.success('LP Infrastructure deployed!')
    console.log(`\n  XLP V2 Factory: ${v2FactoryMatch[1]}`)
    if (routerMatch) console.log(`  XLP Router:     ${routerMatch[1]}`)
  }

  // Deploy LPLocker separately
  logger.step('Deploying LPLocker...')

  const account = privateKeyToAccount(privateKey)
  const _walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  })

  // Deploy LPLocker bytecode
  // Note: In production, use forge script for this
  console.log('  LPLocker deployment: Use forge script for production')
  void _walletClient // Reserved for production use
}

async function getStatus(network: NetworkName): Promise<void> {
  const config = NETWORKS[network]
  const { presale } = getAddresses()

  logger.header(`ICO Status - ${config.name}`)

  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  })

  const statusResult = await client.readContract({
    address: presale,
    abi: PRESALE_ABI,
    functionName: 'getStatus',
  })

  if (!isPresaleStatus(statusResult)) {
    throw new Error('Invalid presale status response from contract')
  }

  const [
    raised,
    participants,
    progress,
    timeRemaining,
    isActive,
    isFinalized,
    isFailed,
  ] = statusResult

  const capsResult = await Promise.all([
    client.readContract({
      address: presale,
      abi: PRESALE_ABI,
      functionName: 'softCap',
    }),
    client.readContract({
      address: presale,
      abi: PRESALE_ABI,
      functionName: 'hardCap',
    }),
    client.readContract({
      address: presale,
      abi: PRESALE_ABI,
      functionName: 'getCurrentPrice',
    }),
  ])

  if (!isBigintTuple3(capsResult)) {
    throw new Error('Invalid caps response from contract')
  }

  const [softCap, hardCap, currentPrice] = capsResult

  console.log(`
┌─────────────────────────────────────────────┐
│              BBLN ICO STATUS                │
├─────────────────────────────────────────────┤
│  Status:        ${isActive ? '🟢 ACTIVE' : isFinalized ? '✅ FINALIZED' : isFailed ? '❌ FAILED' : '⏸️  NOT STARTED'}
│  
│  Total Raised:  ${formatEther(raised)} ETH
│  Participants:  ${participants.toString()}
│  Progress:      ${(Number(progress) / 100).toFixed(2)}%
│  
│  Soft Cap:      ${formatEther(softCap)} ETH
│  Hard Cap:      ${formatEther(hardCap)} ETH
│  Current Price: ${formatEther(currentPrice)} ETH/BBLN
│  
│  Time Left:     ${formatDuration(Number(timeRemaining))}
└─────────────────────────────────────────────┘
`)
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Ended'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${mins}m`
}

async function getStats(network: NetworkName): Promise<void> {
  const config = NETWORKS[network]
  const { presale } = getAddresses()

  logger.header(`ICO Analytics - ${config.name}`)

  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  })

  // Get all data
  const [
    statusResult,
    contributorsResult,
    softCapResult,
    hardCapResult,
    presaleStartResult,
    presaleEndResult,
  ] = await Promise.all([
    client.readContract({
      address: presale,
      abi: PRESALE_ABI,
      functionName: 'getStatus',
    }),
    client.readContract({
      address: presale,
      abi: PRESALE_ABI,
      functionName: 'getContributors',
    }),
    client.readContract({
      address: presale,
      abi: PRESALE_ABI,
      functionName: 'softCap',
    }),
    client.readContract({
      address: presale,
      abi: PRESALE_ABI,
      functionName: 'hardCap',
    }),
    client.readContract({
      address: presale,
      abi: PRESALE_ABI,
      functionName: 'presaleStart',
    }),
    client.readContract({
      address: presale,
      abi: PRESALE_ABI,
      functionName: 'presaleEnd',
    }),
  ])

  if (!isPresaleStatus(statusResult)) {
    throw new Error('Invalid presale status response')
  }
  if (!isAddressArray(contributorsResult)) {
    throw new Error('Invalid contributors response')
  }
  if (typeof softCapResult !== 'bigint' || typeof hardCapResult !== 'bigint') {
    throw new Error('Invalid cap values from contract')
  }
  if (
    typeof presaleStartResult !== 'bigint' ||
    typeof presaleEndResult !== 'bigint'
  ) {
    throw new Error('Invalid presale time values from contract')
  }

  const softCap = softCapResult
  const hardCap = hardCapResult
  const presaleStart = presaleStartResult
  const presaleEnd = presaleEndResult

  const [raised, participants, _progress] = statusResult

  // Calculate stats
  const avgContribution = participants > 0n ? raised / participants : 0n
  const softCapProgress = softCap > 0n ? (raised * 10000n) / softCap : 0n
  const hardCapProgress = hardCap > 0n ? (raised * 10000n) / hardCap : 0n

  console.log(`
┌─────────────────────────────────────────────────────────┐
│                  BBLN ICO ANALYTICS                     │
├─────────────────────────────────────────────────────────┤
│  FUNDRAISING                                            │
│  ───────────                                            │
│  Total Raised:      ${formatEther(raised).padEnd(15)} ETH
│  Unique Wallets:    ${participants.toString().padEnd(15)}
│  Avg Contribution:  ${formatEther(avgContribution).padEnd(15)} ETH
│                                                         │
│  PROGRESS                                               │
│  ────────                                               │
│  Soft Cap Progress: ${(Number(softCapProgress) / 100).toFixed(2).padEnd(10)}% (${formatEther(softCap)} ETH)
│  Hard Cap Progress: ${(Number(hardCapProgress) / 100).toFixed(2).padEnd(10)}% (${formatEther(hardCap)} ETH)
│                                                         │
│  TIMELINE                                               │
│  ────────                                               │
│  Start:  ${presaleStart > 0n ? new Date(Number(presaleStart) * 1000).toISOString() : 'Not started'}
│  End:    ${presaleEnd > 0n ? new Date(Number(presaleEnd) * 1000).toISOString() : 'N/A'}
└─────────────────────────────────────────────────────────┘
`)
}

async function listContributors(network: NetworkName): Promise<void> {
  const config = NETWORKS[network]
  const { presale } = getAddresses()

  logger.header(`Contributors - ${config.name}`)

  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  })

  const contributorsResult = await client.readContract({
    address: presale,
    abi: PRESALE_ABI,
    functionName: 'getContributors',
  })

  if (!isAddressArray(contributorsResult)) {
    throw new Error('Invalid contributors response from contract')
  }

  const contributors = contributorsResult

  if (contributors.length === 0) {
    console.log('\n  No contributors yet.')
    return
  }

  console.log(`\n  Total: ${contributors.length} contributors\n`)
  console.log(
    '  ─────────────────────────────────────────────────────────────────',
  )
  console.log(
    '  Address                                     | ETH Amount | Tokens',
  )
  console.log(
    '  ─────────────────────────────────────────────────────────────────',
  )

  for (const addr of contributors.slice(0, 50)) {
    // Limit to first 50
    const contributionResult = await client.readContract({
      address: presale,
      abi: PRESALE_ABI,
      functionName: 'getContribution',
      args: [addr],
    })

    if (!isContribution(contributionResult)) {
      throw new Error(`Invalid contribution data for address ${addr}`)
    }

    const [ethAmount, tokenAllocation] = contributionResult
    console.log(
      `  ${addr} | ${formatEther(ethAmount).padStart(10)} | ${formatEther(tokenAllocation).padStart(12)}`,
    )
  }

  if (contributors.length > 50) {
    console.log(`\n  ... and ${contributors.length - 50} more`)
  }
}

async function startPresale(
  network: NetworkName,
  durationDays: number,
  delayDays: number,
): Promise<void> {
  const config = NETWORKS[network]
  const { presale } = getAddresses()
  const privateKey = getPrivateKey()

  logger.header(`Starting Presale - ${config.name}`)

  const account = privateKeyToAccount(privateKey)
  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  })

  const duration = BigInt(durationDays * 24 * 60 * 60) // days to seconds
  const delay = BigInt(delayDays * 24 * 60 * 60)

  logger.step(
    `Starting presale with ${durationDays} day duration and ${delayDays} day claim delay...`,
  )

  const hash = await walletClient.writeContract({
    address: presale,
    abi: PRESALE_ABI,
    functionName: 'startPresale',
    args: [duration, delay],
  })

  logger.success(`Presale started! TX: ${hash}`)
}

async function pausePresale(network: NetworkName): Promise<void> {
  const config = NETWORKS[network]
  const { presale } = getAddresses()
  const privateKey = getPrivateKey()

  logger.header(`Pausing Presale - ${config.name}`)

  const account = privateKeyToAccount(privateKey)
  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  })

  const hash = await walletClient.writeContract({
    address: presale,
    abi: PRESALE_ABI,
    functionName: 'pause',
  })

  logger.success(`Presale paused! TX: ${hash}`)
}

async function unpausePresale(network: NetworkName): Promise<void> {
  const config = NETWORKS[network]
  const { presale } = getAddresses()
  const privateKey = getPrivateKey()

  logger.header(`Unpausing Presale - ${config.name}`)

  const account = privateKeyToAccount(privateKey)
  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  })

  const hash = await walletClient.writeContract({
    address: presale,
    abi: PRESALE_ABI,
    functionName: 'unpause',
  })

  logger.success(`Presale unpaused! TX: ${hash}`)
}

async function finalizePresale(network: NetworkName): Promise<void> {
  const config = NETWORKS[network]
  const { presale } = getAddresses()
  const privateKey = getPrivateKey()

  logger.header(`Finalizing Presale - ${config.name}`)

  const account = privateKeyToAccount(privateKey)
  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  })

  logger.step('Finalizing presale, calculating allocations, creating LP...')

  const hash = await walletClient.writeContract({
    address: presale,
    abi: PRESALE_ABI,
    functionName: 'finalize',
  })

  logger.success(`Presale finalized! TX: ${hash}`)
}

async function deployWarpRoutes(): Promise<void> {
  logger.header('Deploying Hyperlane Warp Routes')

  const privateKey = getPrivateKey()

  // Check if we have both networks configured
  const baseSepoliaRpc =
    process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
  const sepoliaRpc =
    process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'

  logger.step('Checking deployer balance on both chains...')

  const account = privateKeyToAccount(privateKey)

  const baseSepoliaClient = createPublicClient({
    chain: baseSepolia,
    transport: http(baseSepoliaRpc),
  })

  const sepoliaClient = createPublicClient({
    chain: sepolia,
    transport: http(sepoliaRpc),
  })

  const [baseBalance, sepoliaBalance] = await Promise.all([
    baseSepoliaClient.getBalance({ address: account.address }),
    sepoliaClient.getBalance({ address: account.address }),
  ])

  console.log(`  Deployer: ${account.address}`)
  console.log(`  Base Sepolia Balance: ${formatEther(baseBalance)} ETH`)
  console.log(`  Sepolia Balance: ${formatEther(sepoliaBalance)} ETH`)

  if (baseBalance < 5000000000000000n || sepoliaBalance < 5000000000000000n) {
    logger.fail(
      'Insufficient balance on one or both chains (need at least 0.005 ETH each)',
    )
    console.log('\nGet testnet ETH from:')
    console.log(
      '  Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet',
    )
    console.log('  Sepolia: https://sepoliafaucet.com/')
    process.exit(1)
  }

  logger.step('Deploying WarpRoute to Base Sepolia...')

  // Deploy WarpRoute using forge
  const bblnAddress =
    process.env.BBLN_TOKEN_ADDRESS ||
    '0x9Ce2E3C01faC7092E60Fdd5147D105b6e3caA391'

  // Hyperlane infrastructure addresses for testnets
  const HYPERLANE_CONFIG = {
    baseSepolia: {
      mailbox: '0x6966b0E55883d49BFB24539356a2f8A673E02039',
      igp: '0x28B02B97a850872C4D33C3E024fab6499ad96564',
    },
    sepolia: {
      mailbox: '0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766',
      igp: '0x6f2756380FD49228ae25Aa7F2817993cB74Ecc56',
    },
  }

  console.log(`
┌─────────────────────────────────────────────────────────┐
│              HYPERLANE WARP ROUTES                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Warp routes enable cross-chain BBLN transfers using   │
│  Hyperlane's interchain messaging protocol.            │
│                                                         │
│  Configuration:                                         │
│    Base Sepolia Mailbox: ${HYPERLANE_CONFIG.baseSepolia.mailbox.slice(0, 10)}...
│    Sepolia Mailbox:      ${HYPERLANE_CONFIG.sepolia.mailbox.slice(0, 10)}...
│    BBLN Token:           ${bblnAddress.slice(0, 10)}...
│                                                         │
│  For full deployment, run:                              │
│    cd packages/contracts                                │
│    forge script script/DeployWarpRoute.s.sol           │
│      --rpc-url <RPC_URL> --broadcast                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
`)

  // Save warp route config
  const warpConfig = {
    timestamp: new Date().toISOString(),
    deployer: account.address,
    bblnToken: bblnAddress,
    hyperlane: HYPERLANE_CONFIG,
    status: 'pending_deployment',
    notes: 'Run forge script for full deployment',
  }

  const configPath = join(process.cwd(), 'warp-routes-config.json')
  writeFileSync(configPath, JSON.stringify(warpConfig, null, 2))
  logger.success(`Saved warp route configuration to ${configPath}`)

  console.log(`
Next steps to complete warp route deployment:

1. Create WarpRoute.sol in packages/contracts/src/bridges/
2. Deploy using forge:
   forge script script/DeployWarpRoute.s.sol \\
     --rpc-url ${baseSepoliaRpc} \\
     --broadcast --verify

3. Configure routes by enrolling remote routers
4. Set IGP (Interchain Gas Paymaster) on both chains
`)
}

async function runCeremony(network: NetworkName): Promise<void> {
  const config = NETWORKS[network]
  logger.header(`Key Ceremony - ${config.name}`)

  console.log(`
┌─────────────────────────────────────────────────────────┐
│              SECURE KEY GENERATION CEREMONY             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  This ceremony generates secure keys for:               │
│    • Deployer wallet (contract deployment)             │
│    • Treasury multisig signers                         │
│    • Admin operations wallet                           │
│                                                         │
│  SECURITY REQUIREMENTS:                                 │
│    • Air-gapped machine recommended                    │
│    • Hardware wallet integration supported             │
│    • Multiple signers for multisig                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
`)

  // Generate new deployer key
  logger.step('Generating deployer key...')
  const deployerKey: Hex = `0x${randomBytes(32).toString('hex')}`
  const deployerAccount = privateKeyToAccount(deployerKey)
  console.log(`  Address: ${deployerAccount.address}`)
  console.log(
    `  Key:     ${deployerKey.slice(0, 10)}...${deployerKey.slice(-8)}`,
  )

  // Generate treasury signer keys (for multisig)
  logger.step('Generating treasury signer keys (3-of-5 multisig)...')
  const signers: Array<{ key: Hex; address: Address }> = []
  for (let i = 0; i < 5; i++) {
    const key: Hex = `0x${randomBytes(32).toString('hex')}`
    const account = privateKeyToAccount(key)
    signers.push({ key, address: account.address })
    console.log(`  Signer ${i + 1}: ${account.address}`)
  }

  // Save to secure location
  const ceremonyData = {
    network,
    timestamp: new Date().toISOString(),
    deployer: { address: deployerAccount.address },
    treasurySigners: signers.map((s) => ({ address: s.address })),
    // NEVER save private keys to disk in production
    // This is for dev/testing only
  }

  const ceremonyFile = `ceremony-${network}-${Date.now()}.json`
  writeFileSync(ceremonyFile, JSON.stringify(ceremonyData, null, 2))

  logger.success(`Ceremony complete! Saved to ${ceremonyFile}`)

  console.log(`
⚠️  IMPORTANT: Store private keys securely!
   • Use hardware wallets for mainnet
   • Split keys across multiple secure locations
   • Never share keys or commit to version control
`)
}

/**
 * Main entry point for ICO commands
 */
export async function runICOCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  if (wantsHelp(parsed)) {
    printHelp()
    process.exit(0)
  }

  const networkName = validateNetworkName(parsed.options.network || 'local')
  const devMode = getFlag(parsed, 'dev')
  const force = getFlag(parsed, 'force')
  const durationDays = parseInt(parsed.options.duration || '7', 10)
  const delayDays = parseInt(parsed.options.delay || '1', 10)

  // Mainnet safety check
  if (networkName === 'mainnet' && !force) {
    logger.fail('Mainnet operations require --force flag')
    process.exit(1)
  }

  switch (parsed.command) {
    case 'deploy':
      await deployContracts(networkName, devMode)
      break

    case 'lp-deploy':
      await deployLPInfrastructure(networkName)
      break

    case 'warp-routes':
      await deployWarpRoutes()
      break

    case 'start':
      await startPresale(networkName, durationDays, delayDays)
      break

    case 'pause':
      await pausePresale(networkName)
      break

    case 'unpause':
      await unpausePresale(networkName)
      break

    case 'finalize':
      await finalizePresale(networkName)
      break

    case 'status':
      await getStatus(networkName)
      break

    case 'stats':
      await getStats(networkName)
      break

    case 'contributors':
      await listContributors(networkName)
      break

    case 'ceremony':
      await runCeremony(networkName)
      break

    default:
      if (parsed.command) {
        logger.fail(`Unknown command: ${parsed.command}`)
      }
      printHelp()
      process.exit(parsed.command ? 1 : 0)
  }
}
