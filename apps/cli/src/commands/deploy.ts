#!/usr/bin/env bun

/**
 * Deploy Commands
 *
 * Contract Commands:
 *   local     - Deploy contracts to local Hardhat
 *   testnet   - Deploy contracts to Jeju testnet
 *   mainnet   - Deploy contracts to Jeju mainnet
 *   setup     - Post-deployment testnet setup
 *
 * Frontend Commands:
 *   build     - Build static frontend for deployment
 *   frontend  - Deploy frontend to AWS S3 + CloudFront + IPFS + JNS
 *   ipfs      - Deploy static assets to IPFS only
 *
 * Decentralized Deployment:
 *   dws       - Deploy backend to Jeju DWS (decentralized)
 *   full      - Full decentralized deployment (frontend to IPFS/JNS, backend to DWS)
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  extractIpfsCid,
  type IpfsAddResponse,
  isIpfsAddResponse,
  isValidHex,
  toAddressOrDefault,
  toHexString,
} from '@babylon/shared'
import { $ } from 'bun'
import {
  type Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  type Hex,
  http,
  keccak256,
  toBytes,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import { getFlag, getOption, parseArgs, wantsHelp } from '../lib/args.js'
import { logger } from '../lib/logger.js'

/**
 * Type guard for deployment environment
 */
function isEnvironment(value: string): value is Environment {
  return value === 'local' || value === 'testnet' || value === 'mainnet'
}

/**
 * Type guard for non-local environment
 */
function isNonLocalEnvironment(
  value: string,
): value is Exclude<Environment, 'local'> {
  return value === 'testnet' || value === 'mainnet'
}

// Path to contracts package (foundry.toml location)
const CONTRACTS_DIR = join(process.cwd(), 'packages', 'contracts')

// Network configurations (Jeju only – no centralized/base fallbacks)
const NETWORKS = {
  local: {
    rpcUrl: 'http://localhost:6545',
    chainId: 31337,
    privateKey:
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    name: 'Hardhat Local (for unit/local only)',
  },
  testnet: {
    rpcUrl: process.env.JEJU_TESTNET_RPC_URL || process.env.JEJU_RPC_URL || '',
    chainId: 420690,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY || '',
    name: 'Jeju Testnet',
  },
  mainnet: {
    rpcUrl: process.env.JEJU_MAINNET_RPC_URL || '',
    chainId: 420691,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY || '',
    name: 'Jeju Mainnet',
  },
} as const

type NetworkName = keyof typeof NETWORKS

// Frontend deployment configurations
type Environment = 'local' | 'testnet' | 'mainnet'

interface BuildConfig {
  env: Environment
  apiBaseUrl: string
  domain: string
  ipfsGateway: string
}

interface FrontendDeployConfig {
  environment: Environment
  domain: string
  s3Bucket: string
  cloudfrontDistributionId: string
  ipfsApiUrl: string
  rpcUrl: string
  jnsRegistryAddress: Address
  jnsResolverAddress: Address
}

// Port configuration from centralized env vars
const IPFS_PORT = process.env.IPFS_API_PORT ?? '5001'
const API_PORT = process.env.API_PORT ?? '5007'
const DEFAULT_IPFS_URL = `http://localhost:${IPFS_PORT}`
const STORAGE_URL =
  process.env.JEJU_STORAGE_SERVICE_URL || 'http://localhost:5004'

const BUILD_CONFIGS: Record<Environment, BuildConfig> = {
  local: {
    env: 'local',
    apiBaseUrl: `http://localhost:${API_PORT}`,
    domain: `localhost:${API_PORT}`,
    ipfsGateway: `http://localhost:${IPFS_PORT}`,
  },
  testnet: {
    env: 'testnet',
    apiBaseUrl: 'https://api.testnet.babylon.market',
    domain: 'testnet.babylon.market',
    ipfsGateway: 'https://ipfs.testnet.babylon.market',
  },
  mainnet: {
    env: 'mainnet',
    apiBaseUrl: 'https://api.babylon.market',
    domain: 'babylon.market',
    ipfsGateway: 'https://ipfs.babylon.market',
  },
}

const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000'

function getAddressEnv(
  key: string,
  defaultValue: Address = ZERO_ADDRESS,
): Address {
  return toAddressOrDefault(process.env[key], defaultValue)
}

const FRONTEND_DEPLOY_CONFIGS: Record<
  Exclude<Environment, 'local'>,
  FrontendDeployConfig
> = {
  testnet: {
    environment: 'testnet',
    domain: 'testnet.babylon.market',
    s3Bucket: 'babylon-testnet-frontend',
    cloudfrontDistributionId: process.env.CF_DISTRIBUTION_ID_TESTNET ?? '',
    ipfsApiUrl: process.env.IPFS_API_URL ?? DEFAULT_IPFS_URL,
    rpcUrl: process.env.RPC_URL ?? 'https://sepolia.base.org',
    jnsRegistryAddress: getAddressEnv('JNS_REGISTRY_ADDRESS'),
    jnsResolverAddress: getAddressEnv('JNS_RESOLVER_ADDRESS'),
  },
  mainnet: {
    environment: 'mainnet',
    domain: 'babylon.market',
    s3Bucket: 'babylon-mainnet-frontend',
    cloudfrontDistributionId: process.env.CF_DISTRIBUTION_ID_MAINNET ?? '',
    ipfsApiUrl: process.env.IPFS_API_URL ?? DEFAULT_IPFS_URL,
    rpcUrl: process.env.RPC_URL ?? 'https://mainnet.base.org',
    jnsRegistryAddress: getAddressEnv('JNS_REGISTRY_ADDRESS'),
    jnsResolverAddress: getAddressEnv('JNS_RESOLVER_ADDRESS'),
  },
}

const JNS_RESOLVER_ABI = [
  {
    name: 'setContenthash',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'hash', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

function printHelp(): void {
  console.log(`
Deploy Commands

USAGE:
  babylon deploy <command> [options]

CONTRACT COMMANDS:
  local       Deploy contracts to local Hardhat node
  testnet     Deploy contracts to Jeju testnet
  mainnet     Deploy contracts to Jeju mainnet
  setup       Post-deployment testnet setup

TOKEN COMMANDS:
  token       Deploy full BBLN token ecosystem (token, DAO, liquidity, NPC funding)

DAO COMMANDS:
  dao         Deploy Babylon DAO via Jeju CLI (uses jeju-manifest.json)

FRONTEND COMMANDS:
  build       Build static frontend for deployment
  frontend    Deploy frontend to AWS S3 + CloudFront + IPFS + JNS
  ipfs        Deploy static assets to IPFS only

DECENTRALIZED COMMANDS:
  dws         Deploy backend to Jeju DWS (fully decentralized)
  full        Full decentralized deployment (frontend + backend)

OPTIONS (contracts):
  --skip-verify    Skip contract verification on block explorer
  --force          Force deployment even if contracts exist

OPTIONS (token):
  --env=ENV           Target environment: localnet, testnet, mainnet (default: localnet)
  --skip-liquidity    Skip XLP liquidity pool creation
  --skip-npc-funding  Skip NPC BBLN funding
  --dry-run           Preview deployment without executing
  --force             Force redeploy even if already initialized

OPTIONS (build):
  --env=ENV        Target environment: local, testnet, mainnet (default: mainnet)

OPTIONS (frontend):
  --env=ENV        Target environment: testnet, mainnet (default: mainnet)
  --skip-aws       Skip AWS S3/CloudFront deployment
  --skip-ipfs      Skip IPFS deployment
  --skip-jns       Skip JNS update
  --dry-run        Validate only, don't deploy

OPTIONS (ipfs):
  --no-pin         Don't pin content to IPFS

OPTIONS (dws):
  --env=ENV        Target environment: testnet, mainnet (default: testnet)
  --dry-run        Validate only, don't deploy

CONFIGURATION:
  All deployed addresses are stored in: packages/shared/src/config/deployment-config.json
  This file is checked into git and provides idempotent deployment tracking.
  DO NOT use environment variables for contract addresses.

ENVIRONMENT:
  DEPLOYER_PRIVATE_KEY          Private key for deployment
  JEJU_TESTNET_RPC_URL          RPC URL for Jeju testnet
  JEJU_MAINNET_RPC_URL          RPC URL for Jeju mainnet
  CF_DISTRIBUTION_ID_TESTNET    CloudFront distribution ID (testnet)
  CF_DISTRIBUTION_ID_MAINNET    CloudFront distribution ID (mainnet)
  IPFS_API_URL                  IPFS API endpoint
  JNS_REGISTRY_ADDRESS          JNS registry contract address
  JNS_RESOLVER_ADDRESS          JNS resolver contract address

EXAMPLES:
  babylon deploy local                      Deploy contracts to local Hardhat
  babylon deploy token --env=localnet       Deploy full token ecosystem locally
  babylon deploy token --env=testnet        Deploy token ecosystem to testnet
  babylon deploy testnet                    Deploy game contracts to Jeju testnet
  babylon deploy mainnet --force            Force mainnet contract deployment
  babylon deploy build --env=testnet        Build frontend for testnet
  babylon deploy frontend --env=testnet     Deploy frontend to testnet
  babylon deploy ipfs                       Deploy to IPFS only
  babylon deploy dws --env=testnet          Deploy backend to DWS (testnet)
  babylon deploy full --env=mainnet         Full decentralized deployment
`)
}

function parseDeploymentOutput(output: string): Record<string, string> {
  const addresses: Record<string, string> = {}

  // Parse Diamond address - matches both "Diamond: 0x..." and "Diamond (Proxy): 0x..."
  const diamondMatch = output.match(
    /Diamond(?: \(Proxy\))?:\s*(0x[a-fA-F0-9]{40})/,
  )
  if (diamondMatch?.[1]) addresses.diamond = diamondMatch[1]

  // Parse other addresses - all use "Name: 0x..." format from forge script
  const patterns = [
    ['diamondCutFacet', /DiamondCutFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['diamondLoupeFacet', /DiamondLoupeFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['predictionMarketFacet', /PredictionMarketFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['oracleFacet', /OracleFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['liquidityPoolFacet', /LiquidityPoolFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['perpetualMarketFacet', /PerpetualMarketFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['referralSystemFacet', /ReferralSystemFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['priceStorageFacet', /PriceStorageFacet:\s*(0x[a-fA-F0-9]{40})/],
    ['identityRegistry', /IdentityRegistry:\s*(0x[a-fA-F0-9]{40})/],
    ['reputationSystem', /ReputationSystem:\s*(0x[a-fA-F0-9]{40})/],
    ['gameOracle', /GameOracle:\s*(0x[a-fA-F0-9]{40})/],
    ['banManager', /BanManager:\s*(0x[a-fA-F0-9]{40})/],
    ['testToken', /TestToken:\s*(0x[a-fA-F0-9]{40})/],
  ] as const

  for (const [name, pattern] of patterns) {
    const match = output.match(pattern)
    if (match?.[1]) addresses[name] = match[1]
  }

  return addresses
}

async function checkForge(): Promise<boolean> {
  const result = await $`forge --version`.quiet().nothrow()
  return result.exitCode === 0
}

async function deployToNetwork(
  network: NetworkName,
  skipVerify: boolean,
  _force: boolean,
): Promise<void> {
  const config = NETWORKS[network]

  logger.header(`Deploying to ${config.name}`)

  // Check forge is installed
  if (!(await checkForge())) {
    logger.fail('Foundry (forge) not installed')
    console.log(
      '\nInstall with: curl -L https://foundry.paradigm.xyz | bash && foundryup',
    )
    process.exit(1)
  }

  // Check private key for non-local
  if (network !== 'local' && !config.privateKey) {
    logger.fail('DEPLOYER_PRIVATE_KEY not set')
    console.log('\nSet it in your environment:')
    console.log('  export DEPLOYER_PRIVATE_KEY=0x...')
    process.exit(1)
  }

  // For local, check Hardhat is running
  if (network === 'local') {
    const blockCheck = await $`cast block-number --rpc-url ${config.rpcUrl}`
      .quiet()
      .nothrow()
    if (blockCheck.exitCode !== 0) {
      logger.fail('Hardhat node is not running')
      console.log('\nStart it with: bunx hardhat node')
      console.log('Or run: bun run dev (which starts Hardhat automatically)')
      process.exit(1)
    }
    logger.success('Hardhat node is running')
  }

  // Compile contracts (run from contracts directory where foundry.toml is)
  logger.step('Compiling contracts...')
  const compileResult = await $`cd ${CONTRACTS_DIR} && bunx hardhat compile`
    .quiet()
    .nothrow()
  if (compileResult.exitCode !== 0) {
    logger.fail('Contract compilation failed')
    console.log('\nCompilation output:')
    console.log(
      compileResult.stderr.toString() || compileResult.stdout.toString(),
    )
    process.exit(1)
  }
  logger.success('Contracts compiled')

  // Clean previous artifacts for local
  if (network === 'local') {
    logger.step('Cleaning previous artifacts...')
    await $`rm -rf ${CONTRACTS_DIR}/broadcast ${CONTRACTS_DIR}/cache`.quiet()

    // Configure mining
    await $`cast rpc evm_setAutomine false --rpc-url ${config.rpcUrl}`.quiet()
    await $`cast rpc evm_setIntervalMining 1000 --rpc-url ${config.rpcUrl}`.quiet()
  }

  // Deploy (run from contracts directory where foundry.toml is)
  logger.step('Deploying contracts...')

  const scriptPath = 'script/DeployBabylon.s.sol:DeployBabylon'
  process.env.DEPLOYER_PRIVATE_KEY = config.privateKey

  const verifyFlag = !skipVerify && network !== 'local' ? '--verify' : ''

  const result = await $`cd ${CONTRACTS_DIR} && forge script ${scriptPath} \
    --rpc-url ${config.rpcUrl} \
    --private-key ${config.privateKey} \
    --broadcast ${verifyFlag}`

  const output = result.text()
  const addresses = parseDeploymentOutput(output)

  if (!addresses.diamond) {
    throw new Error('Failed to parse deployment addresses')
  }

  logger.success('Deployment complete!')
  console.log('\nContract addresses:')
  console.log(`  Diamond: ${addresses.diamond}`)

  // Save to env file
  const envFile = network === 'local' ? '.env.local' : `.env.${network}`
  const envPath = join(process.cwd(), envFile)

  let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''

  const updates = [
    ['BABYLON_DIAMOND_ADDRESS', addresses.diamond],
    ['BABYLON_CHAIN_ID', String(config.chainId)],
  ]

  for (const [key, value] of updates) {
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`)
    } else {
      envContent += `\n${key}=${value}`
    }
  }

  writeFileSync(envPath, envContent)
  logger.success(`Updated ${envFile}`)
}

// ============================================================================
// Frontend Build & Deploy Functions
// ============================================================================

async function buildStaticFrontend(targetEnv: Environment): Promise<void> {
  const config = BUILD_CONFIGS[targetEnv]

  logger.header('Babylon Static Build')
  console.log(`Environment:  ${config.env}`)
  console.log(`API URL:      ${config.apiBaseUrl}`)
  console.log(`Domain:       ${config.domain}`)
  console.log(`IPFS Gateway: ${config.ipfsGateway}\n`)

  const webDir = join(process.cwd(), 'apps/web')
  const distDir = join(webDir, 'dist')

  // Clean previous build
  logger.step('Cleaning previous build...')
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true })
  }

  // Write environment file
  const envPath = join(webDir, '.env.static')
  writeFileSync(
    envPath,
    `# Generated for ${config.env} deployment
VITE_STATIC_BUILD=true
VITE_API_BASE_URL=${config.apiBaseUrl}
VITE_DOMAIN=${config.domain}
VITE_IPFS_GATEWAY=${config.ipfsGateway}`,
  )
  logger.success(`Generated ${envPath}`)

  // Build with Bun
  logger.step('Building with Bun...')
  const proc = Bun.spawn(['bun', 'run', 'build'], {
    cwd: webDir,
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      VITE_STATIC_BUILD: 'true',
      VITE_API_BASE_URL: config.apiBaseUrl,
      VITE_DOMAIN: config.domain,
      VITE_IPFS_GATEWAY: config.ipfsGateway,
    },
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error('Build failed')
  }

  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true })
  }

  // Create SPA routing files
  const indexPath = join(distDir, 'index.html')
  if (existsSync(indexPath)) {
    cpSync(indexPath, join(distDir, '404.html'))
    logger.success('Created 404.html')
  }

  writeFileSync(join(distDir, '_redirects'), '/*    /index.html   200\n')
  writeFileSync(join(distDir, '.nojekyll'), '')
  writeFileSync(
    join(distDir, 'build-info.json'),
    JSON.stringify(
      {
        environment: config.env,
        apiBaseUrl: config.apiBaseUrl,
        domain: config.domain,
        ipfsGateway: config.ipfsGateway,
        buildTime: new Date().toISOString(),
        commit: process.env.GITHUB_SHA ?? 'local',
      },
      null,
      2,
    ),
  )

  logger.success('Static build complete')
  console.log(`\nOutput: apps/web/dist/`)
  console.log(`Deploy: babylon deploy frontend --env=${config.env}`)
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const statResult = statSync(fullPath)
    if (statResult.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir))
    } else {
      files.push(relative(baseDir, fullPath))
    }
  }
  return files
}

async function deployToAws(
  buildDir: string,
  config: FrontendDeployConfig,
): Promise<{ uploaded: boolean; invalidated: boolean }> {
  logger.step('Deploying to AWS S3...')

  // Sync to S3
  const syncProc = Bun.spawn(
    ['aws', 's3', 'sync', buildDir, `s3://${config.s3Bucket}`, '--delete'],
    {
      stdout: 'inherit',
      stderr: 'inherit',
    },
  )

  const syncExit = await syncProc.exited
  if (syncExit !== 0) {
    logger.fail('S3 sync failed')
    return { uploaded: false, invalidated: false }
  }

  logger.success('S3 upload complete')

  // Set cache headers
  logger.step('Setting cache headers...')

  await Bun.spawn(
    [
      'aws',
      's3',
      'cp',
      `s3://${config.s3Bucket}/assets/`,
      `s3://${config.s3Bucket}/assets/`,
      '--recursive',
      '--metadata-directive',
      'REPLACE',
      '--cache-control',
      'public, max-age=31536000, immutable',
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  ).exited

  await Bun.spawn(
    [
      'aws',
      's3',
      'cp',
      `s3://${config.s3Bucket}/index.html`,
      `s3://${config.s3Bucket}/index.html`,
      '--metadata-directive',
      'REPLACE',
      '--cache-control',
      'public, max-age=0, must-revalidate',
      '--content-type',
      'text/html',
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  ).exited

  // Invalidate CloudFront cache
  if (config.cloudfrontDistributionId) {
    logger.step('Invalidating CloudFront cache...')

    const invalidateProc = Bun.spawn(
      [
        'aws',
        'cloudfront',
        'create-invalidation',
        '--distribution-id',
        config.cloudfrontDistributionId,
        '--paths',
        '/*',
      ],
      {
        stdout: 'inherit',
        stderr: 'inherit',
      },
    )

    const invalidateExit = await invalidateProc.exited
    if (invalidateExit !== 0) {
      logger.warn('CloudFront invalidation failed')
      return { uploaded: true, invalidated: false }
    }

    logger.success('CloudFront cache invalidated')
    return { uploaded: true, invalidated: true }
  }

  return { uploaded: true, invalidated: false }
}

async function deployToIpfs(
  buildDir: string,
  config: FrontendDeployConfig,
): Promise<string> {
  logger.step('Uploading to IPFS...')

  const files = getAllFiles(buildDir)
  if (files.length === 0) {
    throw new Error('No files found in build directory')
  }
  console.log(`   Found ${files.length} files`)

  const formData = new FormData()
  for (const filePath of files) {
    const fullPath = join(buildDir, filePath)
    const file = Bun.file(fullPath)
    const blob = await file.arrayBuffer()
    formData.append('file', new Blob([blob]), filePath)
  }

  const response = await fetch(
    `${config.ipfsApiUrl}/api/v0/add?wrap-with-directory=true&pin=true`,
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.status}`)
  }

  const text = await response.text()
  const lines = text.trim().split('\n')
  if (lines.length === 0) {
    throw new Error('IPFS returned empty response')
  }

  const lastLineStr = lines[lines.length - 1]
  if (!lastLineStr) {
    throw new Error('IPFS returned empty response')
  }
  const parsed: unknown = JSON.parse(lastLineStr)
  if (!isIpfsAddResponse(parsed)) {
    throw new Error('Invalid IPFS response format')
  }
  const cid = extractIpfsCid(parsed)

  logger.success(`Uploaded to IPFS: ${cid}`)
  return cid
}

const ZERO_BYTES32: Hex =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

function namehash(name: string): Hex {
  let node: Hex = ZERO_BYTES32
  if (!name) return node

  const labels = name.split('.')
  for (let i = labels.length - 1; i >= 0; i--) {
    const label = labels[i]
    if (!label) continue
    const labelHash = keccak256(toBytes(label))
    // keccak256 returns Hex, so this concatenation produces a valid hex string
    const combined = `${node}${labelHash.slice(2)}`
    node = keccak256(toBytes(combined))
  }

  return node
}

function encodeIpfsCid(cid: string): Hex {
  const cidBytes = Buffer.from(cid)
  const prefix = Buffer.from([0xe3, 0x01, 0x01, 0x70, 0x12, 0x20])
  const hexStr = `0x${Buffer.concat([prefix, cidBytes]).toString('hex')}`
  return toHexString(hexStr)
}

async function updateJns(
  cid: string,
  config: FrontendDeployConfig,
  privateKey: Hex,
): Promise<void> {
  logger.step('Updating JNS contenthash...')

  const chain = config.environment === 'mainnet' ? base : baseSepolia
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  })

  const node = namehash(config.domain)
  const contenthash = encodeIpfsCid(cid)

  console.log(`   Domain: ${config.domain}`)
  console.log(`   Node: ${node.slice(0, 18)}...`)
  console.log(`   CID: ${cid}`)

  const data = encodeFunctionData({
    abi: JNS_RESOLVER_ABI,
    functionName: 'setContenthash',
    args: [node, contenthash],
  })

  const hash = await walletClient.sendTransaction({
    account,
    chain,
    to: config.jnsResolverAddress,
    data,
  })

  console.log(`   Transaction: ${hash}`)
  await publicClient.waitForTransactionReceipt({ hash })

  logger.success('JNS updated')
}

interface FrontendDeployOptions {
  skipAws: boolean
  skipIpfs: boolean
  skipJns: boolean
  dryRun: boolean
}

async function deployFrontend(
  targetEnv: Exclude<Environment, 'local'>,
  options: FrontendDeployOptions,
): Promise<void> {
  const config = FRONTEND_DEPLOY_CONFIGS[targetEnv]

  logger.header('Babylon Frontend Deployment')
  console.log(`Environment:  ${config.environment}`)
  console.log(`Domain:       ${config.domain}`)
  console.log(`S3 Bucket:    ${config.s3Bucket}`)
  console.log(`Mode:         ${options.dryRun ? 'DRY RUN' : 'DEPLOY'}\n`)

  const buildDir = join(process.cwd(), 'apps/web/dist')

  // Check build exists
  if (!existsSync(buildDir)) {
    logger.fail('Static build not found at apps/web/dist')
    console.log(`\nRun: babylon deploy build --env=${targetEnv}`)
    process.exit(1)
  }

  // Validation
  logger.step('Validating prerequisites...')

  if (!options.skipAws) {
    const awsCheck = Bun.spawn(['aws', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const awsExit = await awsCheck.exited
    if (awsExit !== 0) {
      throw new Error('AWS CLI not installed or not in PATH')
    }
  }

  if (!options.skipIpfs) {
    const ipfsCheck = await fetch(`${config.ipfsApiUrl}/api/v0/id`, {
      method: 'POST',
    }).catch(() => null)
    if (!ipfsCheck || !ipfsCheck.ok) {
      throw new Error(`IPFS node not responding at ${config.ipfsApiUrl}`)
    }
  }

  logger.success('Prerequisites validated')

  if (options.dryRun) {
    logger.success('Dry run complete - all prerequisites satisfied')
    console.log('\nRun without --dry-run to deploy')
    return
  }

  let s3Uploaded = false
  let cloudfrontInvalidated = false
  let ipfsCid: string | null = null
  let jnsUpdated = false

  // Deploy to AWS
  if (!options.skipAws) {
    const awsResult = await deployToAws(buildDir, config)
    s3Uploaded = awsResult.uploaded
    cloudfrontInvalidated = awsResult.invalidated
    if (!awsResult.uploaded) {
      throw new Error('AWS S3 upload failed')
    }
  } else {
    logger.info('Skipping AWS deployment')
  }

  // Deploy to IPFS
  if (!options.skipIpfs) {
    ipfsCid = await deployToIpfs(buildDir, config)
  } else {
    logger.info('Skipping IPFS deployment')
  }

  // Update JNS
  const privateKeyEnv = process.env.DEPLOYER_PRIVATE_KEY
  const privateKey: Hex | undefined =
    privateKeyEnv && isValidHex(privateKeyEnv) ? privateKeyEnv : undefined
  if (
    !options.skipJns &&
    ipfsCid &&
    privateKey &&
    config.jnsResolverAddress !== ZERO_ADDRESS
  ) {
    await updateJns(ipfsCid, config, privateKey)
    jnsUpdated = true
  } else if (!options.skipJns && !ipfsCid) {
    logger.info('Skipping JNS update (no IPFS CID)')
  } else if (!options.skipJns && !privateKey) {
    logger.info('Skipping JNS update (no deployer key)')
  }

  // Save deployment info
  const deployInfo = {
    timestamp: new Date().toISOString(),
    environment: config.environment,
    domain: config.domain,
    s3Uploaded,
    cloudfrontInvalidated,
    ipfsCid,
    jnsUpdated,
  }
  writeFileSync(
    join(process.cwd(), 'deployment-result.json'),
    JSON.stringify(deployInfo, null, 2),
  )

  console.log('\n═══════════════════════════════════════')
  console.log('  Deployment Complete')
  console.log('═══════════════════════════════════════\n')
  console.log(`  AWS S3:       ${s3Uploaded ? '✅ Uploaded' : '⏭️  Skipped'}`)
  console.log(
    `  CloudFront:   ${cloudfrontInvalidated ? '✅ Invalidated' : '⏭️  Skipped'}`,
  )
  console.log(`  IPFS CID:     ${ipfsCid ?? '⏭️  Skipped'}`)
  console.log(`  JNS:          ${jnsUpdated ? '✅ Updated' : '⏭️  Skipped'}`)
  console.log(`\n  URL: https://${config.domain}`)
  if (ipfsCid) {
    console.log(`  IPFS: https://ipfs.${config.domain}/ipfs/${ipfsCid}`)
  }
}

async function deployToIpfsOnly(shouldPin: boolean): Promise<void> {
  logger.header('Deploy Static Assets to IPFS')

  // Check storage is available
  console.log(`Storage: ${STORAGE_URL}`)

  const healthCheck = await fetch(`${STORAGE_URL}/api/v0/id`, {
    method: 'POST',
    signal: AbortSignal.timeout(5000),
  }).catch(() => null)

  if (!healthCheck || !healthCheck.ok) {
    logger.fail('IPFS storage not available')
    console.log('\nStart Jeju: cd /path/to/jeju && bun run dev')
    process.exit(1)
  }

  logger.success('Storage connected')

  // Check for build output
  const staticDir = join(process.cwd(), 'apps', 'web', 'dist')
  const publicDir = join(process.cwd(), 'apps', 'web', 'public')

  const staticExists = await stat(staticDir).catch(() => null)
  if (!staticExists) {
    logger.fail("No build output found. Run 'babylon deploy build' first.")
    process.exit(1)
  }

  // Helper to get directory stats
  async function getDirectoryStats(
    dirPath: string,
  ): Promise<{ files: number; size: number }> {
    let files = 0
    let size = 0

    async function walk(currentPath: string): Promise<void> {
      const entries = await readdir(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else {
          files++
          const stats = await stat(fullPath)
          size += stats.size
        }
      }
    }

    await walk(dirPath)
    return { files, size }
  }

  // Helper to format size
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Upload static directory
  logger.step('Uploading dist/...')
  const staticStats = await getDirectoryStats(staticDir)
  console.log(`  ${staticStats.files} files, ${formatSize(staticStats.size)}`)

  const formData = new FormData()

  async function addFiles(dirPath: string, baseDir: string): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      const relativePath = relative(baseDir, fullPath)
      if (entry.isDirectory()) {
        await addFiles(fullPath, baseDir)
      } else {
        const file = Bun.file(fullPath)
        const content = await file.arrayBuffer()
        formData.append('file', new Blob([content]), relativePath)
      }
    }
  }

  await addFiles(staticDir, staticDir)

  const response = await fetch(
    `${STORAGE_URL}/api/v0/add?wrap-with-directory=true&pin=${shouldPin}`,
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!response.ok) {
    throw new Error(`Directory upload failed: ${response.status}`)
  }

  const text = await response.text()
  const lines = text.trim().split('\n')
  const parsedLine: unknown = JSON.parse(lines[lines.length - 1] || '{}')
  const staticResponse: IpfsAddResponse = isIpfsAddResponse(parsedLine)
    ? parsedLine
    : {}
  const staticCid = staticResponse.Hash ?? staticResponse.cid ?? ''

  logger.success(`Static assets: ipfs://${staticCid}`)

  // Upload public directory if it exists
  const publicExists = await stat(publicDir).catch(() => null)
  let publicCid: string | null = null

  if (publicExists) {
    logger.step('Uploading public/...')
    const publicStats = await getDirectoryStats(publicDir)
    console.log(`  ${publicStats.files} files, ${formatSize(publicStats.size)}`)

    const publicFormData = new FormData()
    await addFiles(publicDir, publicDir)

    const publicResponse = await fetch(
      `${STORAGE_URL}/api/v0/add?wrap-with-directory=true&pin=${shouldPin}`,
      {
        method: 'POST',
        body: publicFormData,
      },
    )

    if (publicResponse.ok) {
      const publicText = await publicResponse.text()
      const publicLines = publicText.trim().split('\n')
      const parsedPublic: unknown = JSON.parse(
        publicLines[publicLines.length - 1] || '{}',
      )
      const publicLastLine: IpfsAddResponse = isIpfsAddResponse(parsedPublic)
        ? parsedPublic
        : {}
      publicCid = publicLastLine.Hash ?? publicLastLine.cid ?? null
      if (publicCid) {
        logger.success(`Public assets: ipfs://${publicCid}`)
      }
    }
  }

  console.log('\n═══════════════════════════════════════')
  console.log('  IPFS Deployment Complete')
  console.log('═══════════════════════════════════════\n')
  console.log('CIDs:')
  console.log(`  Static:  ${staticCid}`)
  if (publicCid) {
    console.log(`  Public:  ${publicCid}`)
  }
  console.log('\nGateway URLs:')
  console.log(`  Static:  ${STORAGE_URL}/ipfs/${staticCid}`)
  if (publicCid) {
    console.log(`  Public:  ${STORAGE_URL}/ipfs/${publicCid}`)
  }

  // Save deployment info
  const deploymentInfo = {
    timestamp: new Date().toISOString(),
    static: {
      cid: staticCid,
      files: staticStats.files,
      size: staticStats.size,
    },
    public: publicCid
      ? {
          cid: publicCid,
        }
      : null,
    gatewayUrl: STORAGE_URL,
    pinned: shouldPin,
  }

  const infoPath = join(
    process.cwd(),
    'apps',
    'web',
    'dist',
    'ipfs-deployment.json',
  )
  await Bun.write(infoPath, JSON.stringify(deploymentInfo, null, 2))
  console.log(`\nSaved deployment info to ${infoPath}`)
}

// ============================================================================
// Contract Deployment Functions
// ============================================================================

// ============================================================================
// DWS Decentralized Deployment Functions
// ============================================================================

interface DWSDeployOptions {
  env: Exclude<Environment, 'local'>
  dryRun: boolean
}

/**
 * Deploy Babylon backend to Jeju DWS (Decentralized Web Services)
 *
 * This deploys the backend as a worker on the decentralized network:
 * 1. Build the worker bundle
 * 2. Upload to IPFS
 * 3. Register worker on-chain
 * 4. DWS nodes pull and execute
 */
async function deployToDWS(options: DWSDeployOptions): Promise<void> {
  const { env, dryRun } = options

  logger.header('Babylon DWS Deployment')
  console.log(`Environment:  ${env}`)
  console.log(`Mode:         ${dryRun ? 'DRY RUN' : 'DEPLOY'}\n`)

  // Build the worker bundle
  logger.step('Building DWS worker bundle...')

  const workerEntryPoint = join(process.cwd(), 'apps/api/dws-worker.ts')
  const distDir = join(process.cwd(), 'dist/dws')

  if (!existsSync(workerEntryPoint)) {
    logger.fail('DWS worker entry point not found: apps/api/dws-worker.ts')
    process.exit(1)
  }

  // Build with Bun
  mkdirSync(distDir, { recursive: true })

  const buildResult =
    await $`bun build ${workerEntryPoint} --outdir ${distDir} --target bun --minify`.nothrow()
  if (buildResult.exitCode !== 0) {
    logger.fail('Worker build failed')
    console.log(buildResult.stderr.toString())
    process.exit(1)
  }

  logger.success('Worker bundle built')

  // Get bundle info
  const bundlePath = join(distDir, 'dws-worker.js')
  if (!existsSync(bundlePath)) {
    logger.fail('Bundle not found after build')
    process.exit(1)
  }

  const bundleFile = Bun.file(bundlePath)
  const bundleSize = bundleFile.size
  console.log(`  Bundle size: ${(bundleSize / 1024).toFixed(1)} KB`)

  if (dryRun) {
    logger.success('Dry run complete - worker bundle ready')
    console.log(`\nBundle: ${bundlePath}`)
    console.log('\nRun without --dry-run to deploy to DWS')
    return
  }

  // Upload to IPFS via jeju CLI
  logger.step('Uploading to IPFS...')

  const uploadResult = await $`jeju storage upload ${bundlePath}`.text()
  const cidMatch = uploadResult.match(/CID:\s*(\w+)/)
  if (!cidMatch) {
    logger.fail('Failed to parse CID from upload')
    console.log(uploadResult)
    process.exit(1)
  }

  const codeCid = cidMatch[1]
  logger.success(`Uploaded: ${codeCid}`)

  // Deploy worker via jeju CLI
  logger.step('Registering worker on DWS...')

  const deployResult =
    await $`jeju deploy app babylon --target dws --env ${env} --code-cid ${codeCid}`.nothrow()
  if (deployResult.exitCode !== 0) {
    logger.fail('Worker registration failed')
    console.log(deployResult.stderr.toString())
    process.exit(1)
  }

  logger.success('Worker deployed to DWS')

  console.log('\n═══════════════════════════════════════')
  console.log('  DWS Deployment Complete')
  console.log('═══════════════════════════════════════\n')
  console.log(`  Code CID:     ${codeCid}`)
  console.log(`  Environment:  ${env}`)
  console.log(`  JNS:          api.babylon.jeju`)
  console.log(`\n  Endpoint: https://api.babylon.game`)
}

/**
 * Full decentralized deployment:
 * - Frontend to IPFS + JNS
 * - Backend to DWS
 */
async function deployFullDecentralized(
  options: DWSDeployOptions,
): Promise<void> {
  const { env, dryRun } = options

  logger.header('Babylon Full Decentralized Deployment')
  console.log(`Environment:  ${env}`)
  console.log(`Mode:         ${dryRun ? 'DRY RUN' : 'DEPLOY'}\n`)

  // Step 1: Build frontend
  logger.step('Building frontend...')
  await buildStaticFrontend(env)

  // Step 2: Deploy frontend to IPFS
  logger.step('Deploying frontend to IPFS...')
  await deployToIpfsOnly(true)

  // Step 3: Update JNS for frontend
  const frontendConfig = FRONTEND_DEPLOY_CONFIGS[env]
  const privateKeyEnv = process.env.DEPLOYER_PRIVATE_KEY
  const privateKey: Hex | undefined =
    privateKeyEnv && isValidHex(privateKeyEnv) ? privateKeyEnv : undefined

  if (privateKey && frontendConfig.jnsResolverAddress !== ZERO_ADDRESS) {
    // Get the latest CID from the deployment
    const deployInfoPath = join(
      process.cwd(),
      'apps/web/dist/ipfs-deployment.json',
    )
    if (existsSync(deployInfoPath)) {
      const deployInfo = JSON.parse(readFileSync(deployInfoPath, 'utf-8')) as {
        static: { cid: string }
      }
      if (deployInfo.static?.cid) {
        await updateJns(deployInfo.static.cid, frontendConfig, privateKey)
      }
    }
  }

  // Step 4: Deploy backend to DWS
  await deployToDWS({ env, dryRun })

  console.log('\n═══════════════════════════════════════')
  console.log('  Full Decentralized Deployment Complete')
  console.log('═══════════════════════════════════════\n')
  console.log('  Frontend:')
  console.log('    - Stored on IPFS')
  console.log('    - Routed via JNS: babylon.jeju')
  console.log('  Backend:')
  console.log('    - Running on DWS nodes')
  console.log('    - Routed via JNS: api.babylon.jeju')
  console.log(`\n  App URL: https://babylon.game`)
}

// ============================================================================
// Contract Deployment Functions
// ============================================================================

async function runTestnetSetup(): Promise<void> {
  logger.header('Testnet Post-Deployment Setup')

  // Check environment
  const diamondAddress = process.env.BABYLON_DIAMOND_ADDRESS
  if (!diamondAddress) {
    logger.fail('BABYLON_DIAMOND_ADDRESS not set')
    console.log('\nDeploy first: babylon deploy testnet')
    process.exit(1)
  }

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY
  if (!privateKey) {
    logger.fail('DEPLOYER_PRIVATE_KEY not set')
    process.exit(1)
  }

  const rpcUrl =
    process.env.JEJU_TESTNET_RPC_URL ||
    process.env.JEJU_RPC_URL ||
    'http://localhost:6546'

  logger.step('Initializing game state...')

  // Call initialization functions on the contract
  // Initialize game
  await $`cast send ${diamondAddress} "initializeGame()" \
    --rpc-url ${rpcUrl} \
    --private-key ${privateKey}`.quiet()

  logger.success('Game initialized')

  // Create initial market
  await $`cast send ${diamondAddress} "createMarket(string,uint256)" \
    "Will the test event occur?" \
    ${Math.floor(Date.now() / 1000) + 86400 * 7} \
    --rpc-url ${rpcUrl} \
    --private-key ${privateKey}`.quiet()

  logger.success('Initial market created')

  console.log('\n✅ Testnet setup complete!')
  console.log(`\nDiamond: ${diamondAddress}`)
  console.log('\nNext: Start the app with bun run dev')
}

/**
 * Main entry point for deploy domain commands.
 *
 * @param args - Raw command-line arguments for the deploy domain
 */
export async function runDeployCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  if (wantsHelp(parsed)) {
    printHelp()
    process.exit(0)
  }

  const skipVerify = getFlag(parsed, 'skip-verify')
  const force = getFlag(parsed, 'force')

  switch (parsed.command) {
    // Contract deployment commands
    case 'local':
      await deployToNetwork('local', true, force)
      break

    case 'testnet':
      await deployToNetwork('testnet', skipVerify, force)
      break

    case 'mainnet':
      if (!force) {
        logger.fail('Mainnet deployment requires --force flag')
        console.log(
          '\nThis is a safety check. Use: babylon deploy mainnet --force',
        )
        process.exit(1)
      }
      await deployToNetwork('mainnet', skipVerify, force)
      break

    case 'setup':
      await runTestnetSetup()
      break

    // Frontend deployment commands
    case 'build': {
      const envArg = getOption(parsed, 'env') || 'mainnet'
      if (!isEnvironment(envArg)) {
        logger.fail(`Invalid environment: ${envArg}`)
        console.log('Valid environments: local, testnet, mainnet')
        process.exit(1)
      }
      await buildStaticFrontend(envArg)
      break
    }

    case 'frontend': {
      const frontendEnvArg = getOption(parsed, 'env') || 'mainnet'
      if (frontendEnvArg === 'local') {
        logger.fail('Cannot deploy frontend to local environment')
        console.log('Use testnet or mainnet')
        process.exit(1)
      }
      if (!isNonLocalEnvironment(frontendEnvArg)) {
        logger.fail(`Invalid environment: ${frontendEnvArg}`)
        console.log('Valid environments: testnet, mainnet')
        process.exit(1)
      }
      await deployFrontend(frontendEnvArg, {
        skipAws: getFlag(parsed, 'skip-aws'),
        skipIpfs: getFlag(parsed, 'skip-ipfs'),
        skipJns: getFlag(parsed, 'skip-jns'),
        dryRun: getFlag(parsed, 'dry-run'),
      })
      break
    }

    case 'ipfs': {
      const shouldPin = !getFlag(parsed, 'no-pin')
      await deployToIpfsOnly(shouldPin)
      break
    }

    // DAO deployment via Jeju CLI
    case 'dao': {
      const daoEnvArg = getOption(parsed, 'env') || 'localnet'
      const seed = getFlag(parsed, 'seed')
      const dryRun = getFlag(parsed, 'dry-run')

      // Map local/testnet/mainnet to localnet/testnet/mainnet
      const network = daoEnvArg === 'local' ? 'localnet' : daoEnvArg

      // Find the Babylon DAO manifest
      const manifestPath = join(
        process.cwd(),
        '..',
        '..',
        'dao',
        'jeju-manifest.json',
      )

      // Build jeju command
      const args = ['deploy', 'dao', 'babylon']
      args.push('--network', network)
      args.push('--manifest', manifestPath)
      if (seed) args.push('--seed')
      if (dryRun) args.push('--dry-run')

      logger.step(`Deploying Babylon DAO via Jeju CLI...`)
      const result = await $`jeju ${args}`.nothrow()
      process.exit(result.exitCode)
      break
    }

    // Decentralized deployment commands
    case 'dws': {
      const dwsEnvArg = getOption(parsed, 'env') || 'testnet'
      if (dwsEnvArg === 'local') {
        logger.fail('Cannot deploy to DWS in local environment')
        console.log('Use testnet or mainnet for DWS deployment')
        process.exit(1)
      }
      if (!isNonLocalEnvironment(dwsEnvArg)) {
        logger.fail(`Invalid environment: ${dwsEnvArg}`)
        console.log('Valid environments: testnet, mainnet')
        process.exit(1)
      }
      await deployToDWS({
        env: dwsEnvArg,
        dryRun: getFlag(parsed, 'dry-run'),
      })
      break
    }

    case 'full': {
      const fullEnvArg = getOption(parsed, 'env') || 'testnet'
      if (fullEnvArg === 'local') {
        logger.fail(
          'Cannot do full decentralized deployment in local environment',
        )
        console.log('Use testnet or mainnet')
        process.exit(1)
      }
      if (!isNonLocalEnvironment(fullEnvArg)) {
        logger.fail(`Invalid environment: ${fullEnvArg}`)
        console.log('Valid environments: testnet, mainnet')
        process.exit(1)
      }
      await deployFullDecentralized({
        env: fullEnvArg,
        dryRun: getFlag(parsed, 'dry-run'),
      })
      break
    }

    // Token ecosystem deployment
    case 'token': {
      const tokenEnvArg = getOption(parsed, 'env') || 'localnet'
      const dryRun = getFlag(parsed, 'dry-run')
      const skipLiquidity = getFlag(parsed, 'skip-liquidity')
      const skipNpcFunding = getFlag(parsed, 'skip-npc-funding')

      logger.header('Deploying BBLN Token Ecosystem')
      console.log(`Environment:  ${tokenEnvArg}`)
      console.log(`Mode:         ${dryRun ? 'DRY RUN' : 'DEPLOY'}\n`)

      try {
        const { bootstrapTokenEcosystem, isTokenEcosystemReady } = await import(
          '@babylon/api'
        )

        const networkMap: Record<string, 'localnet' | 'testnet' | 'mainnet'> = {
          local: 'localnet',
          localnet: 'localnet',
          testnet: 'testnet',
          mainnet: 'mainnet',
        }

        const _network = networkMap[tokenEnvArg] ?? 'localnet'

        if (isTokenEcosystemReady() && !force) {
          logger.success('Token ecosystem already deployed')
          console.log('\nUse --force to redeploy')
          break
        }

        const result = await bootstrapTokenEcosystem({
          force,
          skipLiquidity,
          skipNpcFunding,
          dryRun,
        })

        console.log('\n═══════════════════════════════════════')
        console.log('  Token Ecosystem Deployment Complete')
        console.log('═══════════════════════════════════════\n')
        console.log(
          `  BBLN Token:     ${result.tokenAddress ?? '❌ Not deployed'}`,
        )
        if (result.daoAddresses) {
          console.log(
            `  DAO Governor:   ${result.daoAddresses.governor ?? '❌ Not deployed'}`,
          )
          console.log(
            `  DAO Treasury:   ${result.daoAddresses.treasury ?? '❌ Not deployed'}`,
          )
        }
        console.log(
          `  ETH/BBLN Pool:  ${result.liquidityPairs.ethBbln ?? '❌ Not created'}`,
        )
        console.log(
          `  JEJU/BBLN Pool: ${result.liquidityPairs.jejuBbln ?? '❌ Not created'}`,
        )
        console.log(`  NPCs Funded:    ${result.npcsCount}`)

        if (result.errors.length > 0) {
          console.log('\n⚠️  Errors:')
          for (const err of result.errors) {
            console.log(`    - ${err}`)
          }
        }

        console.log(
          '\nAddresses saved to: packages/shared/src/config/deployment-config.json',
        )
      } catch (error) {
        logger.fail('Token ecosystem deployment failed')
        console.log(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        )
        process.exit(1)
      }
      break
    }

    default:
      if (parsed.command) {
        logger.fail(`Unknown command: ${parsed.command}`)
      }
      printHelp()
      process.exit(parsed.command ? 1 : 0)
  }
}
