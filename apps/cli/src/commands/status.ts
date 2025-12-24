#!/usr/bin/env bun

/**
 * Status Commands
 *
 * Commands:
 *   game    - Game status (running/paused, tick info)
 *   wallet  - Wallet status (balance, nonce, pending txs)
 *   agent0  - Agent0 registration and configuration
 *   all     - Show all status (default)
 */

import { execSync } from 'node:child_process'
import { getAgentLLMStatus } from '@babylon/agents/llm'
import {
  checkDatabaseHealth,
  closeDatabase,
  db,
  type Game,
  type GameConfig,
} from '@babylon/db'
import { StaticDataRegistry } from '@babylon/engine'
import {
  CHAIN_ID,
  formatEther,
  formatUnits,
  getERC8004ContractAddresses,
} from '@babylon/shared'
import { createPublicClient, http, isHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { parseArgs, wantsHelp } from '../lib/args.js'
import { logger } from '../lib/logger.js'

function printHelp(): void {
  console.log(`
System Status

USAGE:
  babylon status [target]

TARGETS:
  game      Game status (running/paused, tick info)
  wallet    Wallet status (balance, nonce, pending txs)
  agent0    Agent0 registration and configuration
  llm       Agent LLM provider status
  all       Show all status (default)

EXAMPLES:
  babylon status           Show all status
  babylon status game      Game status only
  babylon status llm       LLM provider status
`)
}

interface CountResult {
  count: string
}

async function checkGameStatus(): Promise<void> {
  logger.header('🎮 Game Status')

  const isHealthy = await checkDatabaseHealth()
  if (isHealthy) {
    logger.success('Database connected')
  } else {
    logger.fail('Database connection failed')
    process.exit(1)
  }

  // Get actor count from static registry + actorState
  const staticActorCount = StaticDataRegistry.getAllActors().length
  const actorStateCountResult = await db.query<CountResult>(
    'SELECT COUNT(*)::text as count FROM "ActorState"',
  )
  if (!actorStateCountResult[0]) {
    throw new Error('Failed to query actor state count')
  }
  const stateCount = Number(actorStateCountResult[0].count)
  console.log(`Actors: ${staticActorCount} static, ${stateCount} with state`)

  if (staticActorCount === 0) {
    logger.warn('No actors defined! Check packages/engine/src/data/actors/')
  }

  const questionCountResult = await db.query<CountResult>(
    'SELECT COUNT(*)::text as count FROM "Question"',
  )
  if (!questionCountResult[0]) {
    throw new Error('Failed to query question count')
  }
  const questionCount = Number(questionCountResult[0].count)

  const activeQuestionsResult = await db.query<CountResult>(
    `SELECT COUNT(*)::text as count FROM "Question" WHERE status = 'active'`,
  )
  if (!activeQuestionsResult[0]) {
    throw new Error('Failed to query active questions count')
  }
  const activeQuestions = Number(activeQuestionsResult[0].count)
  console.log(`Questions: ${questionCount} total, ${activeQuestions} active`)

  const postCountResult = await db.query<CountResult>(
    'SELECT COUNT(*)::text as count FROM "Post"',
  )
  if (!postCountResult[0]) {
    throw new Error('Failed to query post count')
  }
  const postCount = Number(postCountResult[0].count)

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const recentPostsResult = await db.query<CountResult>(
    `SELECT COUNT(*)::text as count FROM "Post" WHERE "createdAt" >= $1`,
    [fiveMinutesAgo],
  )
  if (!recentPostsResult[0]) {
    throw new Error('Failed to query recent posts count')
  }
  const recentPosts = Number(recentPostsResult[0].count)
  console.log(`Posts: ${postCount} total, ${recentPosts} in last 5 minutes`)

  if (recentPosts === 0 && postCount > 0) {
    logger.warn('No recent posts - game tick might not be running')
  } else if (recentPosts > 0) {
    logger.success('Content is being generated')
  }

  const gameResult = await db.query<Game>(
    `SELECT * FROM "Game" WHERE "isContinuous" = true LIMIT 1`,
  )
  const game = gameResult[0] ?? null
  if (game) {
    console.log('\nGame State:')
    console.log(`  Status: ${game.isRunning ? '✅ RUNNING' : '⏸️  PAUSED'}`)
    console.log(`  Current Day: ${game.currentDay}`)
    console.log(
      `  Current Date: ${game.currentDate ? new Date(game.currentDate).toLocaleString() : 'N/A'}`,
    )
    console.log(`  Active Questions: ${game.activeQuestions}`)
    console.log(`  Speed: ${game.speed}ms between ticks`)
    console.log(
      `  Last Tick: ${game.lastTickAt ? new Date(game.lastTickAt).toLocaleString() : 'Never'}`,
    )

    if (!game.isRunning) {
      console.log('\n💡 To start: bun run game:start')
    }
  } else {
    logger.warn('No game state found')
  }

  const eventCountResult = await db.query<CountResult>(
    'SELECT COUNT(*)::text as count FROM "WorldEvent"',
  )
  if (!eventCountResult[0]) {
    throw new Error('Failed to query event count')
  }
  const eventCount = Number(eventCountResult[0].count)

  const recentEventsResult = await db.query<CountResult>(
    `SELECT COUNT(*)::text as count FROM "WorldEvent" WHERE "createdAt" >= $1`,
    [fiveMinutesAgo],
  )
  if (!recentEventsResult[0]) {
    throw new Error('Failed to query recent events count')
  }
  const recentEvents = Number(recentEventsResult[0].count)
  console.log(
    `\nEvents: ${eventCount} total, ${recentEvents} in last 5 minutes`,
  )

  // Get organization count from static registry + organizationState
  const staticOrgCount = StaticDataRegistry.getAllOrganizations().length
  const companyCount =
    StaticDataRegistry.getOrganizationsByType('company').length

  const orgsWithPricesResult = await db.query<CountResult>(
    `SELECT COUNT(*)::text as count FROM "OrganizationState" WHERE "currentPrice" IS NOT NULL`,
  )
  if (!orgsWithPricesResult[0]) {
    throw new Error('Failed to query organizations with prices count')
  }
  const orgsWithPrices = Number(orgsWithPricesResult[0].count)
  console.log(
    `Organizations: ${staticOrgCount} total, ${companyCount} companies, ${orgsWithPrices} with prices`,
  )
}

async function checkWalletStatus(): Promise<void> {
  logger.header('💳 Wallet Status')

  const gamePrivateKey =
    process.env.BABYLON_GAME_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
  const gameWalletAddress = process.env.BABYLON_GAME_WALLET_ADDRESS

  if (!gamePrivateKey || !gameWalletAddress) {
    logger.fail(
      'Missing BABYLON_GAME_PRIVATE_KEY or BABYLON_GAME_WALLET_ADDRESS',
    )
    return
  }

  const rpcUrl =
    process.env.PUBLIC_RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    'https://ethereum-sepolia-rpc.publicnode.com'

  if (!isHex(gamePrivateKey)) {
    logger.fail('BABYLON_GAME_PRIVATE_KEY must be a valid hex string')
    return
  }

  const account = privateKeyToAccount(gamePrivateKey)
  const client = createPublicClient({ transport: http(rpcUrl) })

  console.log(`Wallet: ${account.address}`)
  console.log(`Expected: ${gameWalletAddress}`)

  const balance = await client.getBalance({ address: account.address })
  console.log(`\n💰 Balance: ${formatEther(balance)} ETH`)

  const nonce = await client.getTransactionCount({
    address: account.address,
    blockTag: 'latest',
  })
  const pendingNonce = await client.getTransactionCount({
    address: account.address,
    blockTag: 'pending',
  })

  console.log(`📊 Nonce (confirmed): ${nonce}`)
  console.log(`📊 Nonce (pending): ${pendingNonce}`)

  if (pendingNonce > nonce) {
    logger.warn(`${pendingNonce - nonce} pending transaction(s) detected`)
  } else {
    logger.success('No pending transactions')
  }

  const feeData = await client.estimateFeesPerGas()
  console.log('\n⛽ Current Gas Price:')
  console.log(
    `   Max Fee: ${feeData.maxFeePerGas ? formatUnits(feeData.maxFeePerGas, 9) : 'N/A'} gwei`,
  )
  console.log(
    `   Max Priority Fee: ${feeData.maxPriorityFeePerGas ? formatUnits(feeData.maxPriorityFeePerGas, 9) : 'N/A'} gwei`,
  )

  const blockNumber = await client.getBlockNumber()
  const block = await client.getBlock({ blockNumber })
  console.log('\n🌐 Network Status:')
  console.log(`   Latest Block: ${blockNumber}`)
  console.log(
    `   Block Time: ${new Date(Number(block.timestamp) * 1000).toISOString()}`,
  )
  console.log(
    `   Base Fee: ${block.baseFeePerGas ? formatUnits(block.baseFeePerGas, 9) : 'N/A'} gwei`,
  )
}

async function checkLLMStatus(): Promise<void> {
  logger.header('🧠 Agent LLM Status')

  const status = await getAgentLLMStatus()

  console.log(`Provider: ${status.provider}`)
  console.log(`Configured: ${status.configured ? '✅ Yes' : '❌ No'}`)
  console.log(`Available: ${status.available ? '✅ Yes' : '❌ No'}`)

  if (status.error) {
    logger.warn(`Error: ${status.error}`)
  }

  console.log('\nDetails:')
  for (const [key, value] of Object.entries(status.details)) {
    console.log(`  ${key}: ${value}`)
  }

  console.log('\nEnvironment:')
  console.log(
    `  JEJU_NETWORK: ${process.env.JEJU_NETWORK || process.env.PUBLIC_JEJU_NETWORK || 'not set'}`,
  )

  if (status.available) {
    logger.success('Jeju Compute is ready')
  } else {
    logger.fail('Jeju Compute is not available - set JEJU_NETWORK')
  }
}

interface Agent0RegistrationValue {
  tokenId: number | string
  metadataCID?: string
  registeredAt?: string
}

function isAgent0RegistrationValue(
  value: unknown,
): value is Agent0RegistrationValue {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    'tokenId' in obj &&
    (typeof obj.tokenId === 'number' || typeof obj.tokenId === 'string') &&
    (!('metadataCID' in obj) ||
      typeof obj.metadataCID === 'string' ||
      obj.metadataCID === undefined) &&
    (!('registeredAt' in obj) ||
      typeof obj.registeredAt === 'string' ||
      obj.registeredAt === undefined)
  )
}

async function checkAgent0Status(): Promise<void> {
  logger.header('🤖 Agent0 Status')

  console.log('Environment Variables:')
  console.log(`  AGENT0_ENABLED: ${process.env.AGENT0_ENABLED || 'not set'}`)
  console.log(`  AGENT0_NETWORK: ${process.env.AGENT0_NETWORK || 'not set'}`)
  console.log(
    `  BABYLON_REGISTRY_REGISTERED: ${process.env.BABYLON_REGISTRY_REGISTERED || 'not set'}`,
  )
  console.log(
    `  BABYLON_GAME_WALLET_ADDRESS: ${process.env.BABYLON_GAME_WALLET_ADDRESS || 'not set'}`,
  )
  console.log(
    `  PINATA_JWT: ${process.env.PINATA_JWT ? '✅ Set' : '❌ Not set'}`,
  )

  const configResult = await db.query<GameConfig>(
    `SELECT * FROM "GameConfig" WHERE key = 'agent0_registration' LIMIT 1`,
  )
  const config = configResult[0]

  if (config?.value && isAgent0RegistrationValue(config.value)) {
    const regValue = config.value

    console.log('\n✅ Database Registration Found:')
    console.log(`   Token ID: ${regValue.tokenId}`)
    console.log(`   Metadata CID: ${regValue.metadataCID}`)
    console.log(`   Registered At: ${regValue.registeredAt}`)

    const tokenId = Number(regValue.tokenId)
    const { identityRegistry: registryAddress } =
      getERC8004ContractAddresses(CHAIN_ID)
    const rpcUrl =
      process.env.PUBLIC_RPC_URL ||
      process.env.SEPOLIA_RPC_URL ||
      'https://ethereum-sepolia-rpc.publicnode.com'

    console.log('\n🔗 Checking On-Chain Registration:')
    console.log(`   Registry: ${registryAddress}`)
    console.log(`   Token ID: ${tokenId}`)

    const owner = execSync(
      `cast call ${registryAddress} "ownerOf(uint256)(address)" ${tokenId} --rpc-url ${rpcUrl}`,
      { encoding: 'utf-8' },
    ).trim()

    logger.success('On-chain registration confirmed')
    console.log(`   Owner: ${owner}`)

    const gameWalletAddress = process.env.BABYLON_GAME_WALLET_ADDRESS
    if (!gameWalletAddress) {
      throw new Error(
        'BABYLON_GAME_WALLET_ADDRESS environment variable is not set',
      )
    }
    if (owner.toLowerCase() === gameWalletAddress.toLowerCase()) {
      logger.success('Owner matches BABYLON_GAME_WALLET_ADDRESS')
    } else {
      logger.warn('Owner does NOT match BABYLON_GAME_WALLET_ADDRESS')
    }

    const tokenURI = execSync(
      `cast call ${registryAddress} "tokenURI(uint256)(string)" ${tokenId} --rpc-url ${rpcUrl}`,
      { encoding: 'utf-8' },
    )
      .trim()
      .replace(/"/g, '')

    console.log('\n📄 Token URI:')
    console.log(`   ${tokenURI}`)

    const cid = tokenURI.replace('ipfs://', '')
    console.log('\n🌐 View metadata:')
    console.log(`   https://ipfs.io/ipfs/${cid}`)
  } else {
    logger.warn('No registration found in database')
    console.log('   Run: bun run agent0:setup')
  }
}

async function showAllStatus(): Promise<void> {
  await checkGameStatus()
  await checkWalletStatus()
  await checkAgent0Status()
  await checkLLMStatus()

  logger.header('✅ Status Check Complete')
}

/**
 * Main entry point for status domain commands.
 *
 * @param args - Raw command-line arguments for the status domain
 */
export async function runStatusCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  if (wantsHelp(parsed)) {
    printHelp()
    process.exit(0)
  }

  switch (parsed.command || 'all') {
    case 'game':
      await checkGameStatus()
      break

    case 'wallet':
      await checkWalletStatus()
      break

    case 'agent0':
      await checkAgent0Status()
      break

    case 'llm':
      await checkLLMStatus()
      break

    case 'all':
      await showAllStatus()
      break

    default:
      logger.fail(`Unknown target: ${parsed.command}`)
      printHelp()
      process.exit(1)
  }

  await closeDatabase()
}
