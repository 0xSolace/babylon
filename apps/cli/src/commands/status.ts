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

import { getAgentLLMStatus } from '@babylon/agents/llm';
import {
  actorState,
  checkDatabaseHealth,
  closeDatabase,
  db,
  count as drizzleCount,
  eq,
  gameConfigs,
  games,
  gte,
  isNotNull,
  organizationState,
  posts,
  questions,
  worldEvents,
} from '@babylon/db';
import { StaticDataRegistry } from '@babylon/engine';
import { formatEther, formatUnits } from '@babylon/shared';
import { execSync } from 'child_process';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { parseArgs, wantsHelp } from '../lib/args.js';
import { logger } from '../lib/logger.js';

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
`);
}

async function checkGameStatus(): Promise<void> {
  logger.header('🎮 Game Status');

  const isHealthy = await checkDatabaseHealth();
  if (isHealthy) {
    logger.success('Database connected');
  } else {
    logger.fail('Database connection failed');
    process.exit(1);
  }

  // Get actor count from static registry + actorState
  const staticActorCount = StaticDataRegistry.getAllActors().length;
  const actorStateCount = await db
    .select({ count: drizzleCount() })
    .from(actorState);
  const stateCount = Number(actorStateCount[0]!.count);
  console.log(`Actors: ${staticActorCount} static, ${stateCount} with state`);

  if (staticActorCount === 0) {
    logger.warn('No actors defined! Check packages/engine/src/data/actors/');
  }

  const questionCountResult = await db
    .select({ count: drizzleCount() })
    .from(questions);
  const questionCount = Number(questionCountResult[0]!.count);

  const activeQuestionsResult = await db
    .select({ count: drizzleCount() })
    .from(questions)
    .where(eq(questions.status, 'active'));
  const activeQuestions = Number(activeQuestionsResult[0]!.count);
  console.log(`Questions: ${questionCount} total, ${activeQuestions} active`);

  const postCountResult = await db
    .select({ count: drizzleCount() })
    .from(posts);
  const postCount = Number(postCountResult[0]!.count);

  const recentPostsResult = await db
    .select({ count: drizzleCount() })
    .from(posts)
    .where(gte(posts.createdAt, new Date(Date.now() - 5 * 60 * 1000)));
  const recentPosts = Number(recentPostsResult[0]!.count);
  console.log(`Posts: ${postCount} total, ${recentPosts} in last 5 minutes`);

  if (recentPosts === 0 && postCount > 0) {
    logger.warn('No recent posts - game tick might not be running');
  } else if (recentPosts > 0) {
    logger.success('Content is being generated');
  }

  const gameResult = await db
    .select()
    .from(games)
    .where(eq(games.isContinuous, true))
    .limit(1);
  const game = gameResult[0] || null;
  if (game) {
    console.log('\nGame State:');
    console.log(`  Status: ${game.isRunning ? '✅ RUNNING' : '⏸️  PAUSED'}`);
    console.log(`  Current Day: ${game.currentDay}`);
    console.log(`  Current Date: ${game.currentDate.toLocaleString()}`);
    console.log(`  Active Questions: ${game.activeQuestions}`);
    console.log(`  Speed: ${game.speed}ms between ticks`);
    console.log(
      `  Last Tick: ${game.lastTickAt ? game.lastTickAt.toLocaleString() : 'Never'}`
    );

    if (!game.isRunning) {
      console.log('\n💡 To start: bun run game:start');
    }
  } else {
    logger.warn('No game state found');
  }

  const eventCountResult = await db
    .select({ count: drizzleCount() })
    .from(worldEvents);
  const eventCount = Number(eventCountResult[0]!.count);

  const recentEventsResult = await db
    .select({ count: drizzleCount() })
    .from(worldEvents)
    .where(gte(worldEvents.createdAt, new Date(Date.now() - 5 * 60 * 1000)));
  const recentEvents = Number(recentEventsResult[0]!.count);
  console.log(
    `\nEvents: ${eventCount} total, ${recentEvents} in last 5 minutes`
  );

  // Get organization count from static registry + organizationState
  const staticOrgCount = StaticDataRegistry.getAllOrganizations().length;
  const companyCount =
    StaticDataRegistry.getOrganizationsByType('company').length;

  const orgsWithPricesResult = await db
    .select({ count: drizzleCount() })
    .from(organizationState)
    .where(isNotNull(organizationState.currentPrice));
  const orgsWithPrices = Number(orgsWithPricesResult[0]!.count);
  console.log(
    `Organizations: ${staticOrgCount} total, ${companyCount} companies, ${orgsWithPrices} with prices`
  );
}

async function checkWalletStatus(): Promise<void> {
  logger.header('💳 Wallet Status');

  const gamePrivateKey =
    process.env.BABYLON_GAME_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  const gameWalletAddress = process.env.BABYLON_GAME_WALLET_ADDRESS;

  if (!gamePrivateKey || !gameWalletAddress) {
    logger.fail(
      'Missing BABYLON_GAME_PRIVATE_KEY or BABYLON_GAME_WALLET_ADDRESS'
    );
    return;
  }

  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    'https://ethereum-sepolia-rpc.publicnode.com';

  const account = privateKeyToAccount(gamePrivateKey as `0x${string}`);
  const client = createPublicClient({ transport: http(rpcUrl) });

  console.log(`Wallet: ${account.address}`);
  console.log(`Expected: ${gameWalletAddress}`);

  const balance = await client.getBalance({ address: account.address });
  console.log(`\n💰 Balance: ${formatEther(balance)} ETH`);

  const nonce = await client.getTransactionCount({
    address: account.address,
    blockTag: 'latest',
  });
  const pendingNonce = await client.getTransactionCount({
    address: account.address,
    blockTag: 'pending',
  });

  console.log(`📊 Nonce (confirmed): ${nonce}`);
  console.log(`📊 Nonce (pending): ${pendingNonce}`);

  if (pendingNonce > nonce) {
    logger.warn(`${pendingNonce - nonce} pending transaction(s) detected`);
  } else {
    logger.success('No pending transactions');
  }

  const feeData = await client.estimateFeesPerGas();
  console.log('\n⛽ Current Gas Price:');
  console.log(
    `   Max Fee: ${feeData.maxFeePerGas ? formatUnits(feeData.maxFeePerGas, 9) : 'N/A'} gwei`
  );
  console.log(
    `   Max Priority Fee: ${feeData.maxPriorityFeePerGas ? formatUnits(feeData.maxPriorityFeePerGas, 9) : 'N/A'} gwei`
  );

  const blockNumber = await client.getBlockNumber();
  const block = await client.getBlock({ blockNumber });
  console.log('\n🌐 Network Status:');
  console.log(`   Latest Block: ${blockNumber}`);
  console.log(
    `   Block Time: ${new Date(Number(block.timestamp) * 1000).toISOString()}`
  );
  console.log(
    `   Base Fee: ${block.baseFeePerGas ? formatUnits(block.baseFeePerGas, 9) : 'N/A'} gwei`
  );
}

async function checkLLMStatus(): Promise<void> {
  logger.header('🧠 Agent LLM Status');

  const status = await getAgentLLMStatus();

  console.log(`Provider: ${status.provider}`);
  console.log(`Configured: ${status.configured ? '✅ Yes' : '❌ No'}`);
  console.log(`Available: ${status.available ? '✅ Yes' : '❌ No'}`);

  if (status.error) {
    logger.warn(`Error: ${status.error}`);
  }

  console.log('\nDetails:');
  for (const [key, value] of Object.entries(status.details)) {
    console.log(`  ${key}: ${value}`);
  }

  console.log('\nEnvironment:');
  console.log(
    `  JEJU_NETWORK: ${process.env.JEJU_NETWORK || process.env.NEXT_PUBLIC_JEJU_NETWORK || 'not set'}`
  );

  if (status.available) {
    logger.success('Jeju Compute is ready');
  } else {
    logger.fail('Jeju Compute is not available - set JEJU_NETWORK');
  }
}

async function checkAgent0Status(): Promise<void> {
  logger.header('🤖 Agent0 Status');

  console.log('Environment Variables:');
  console.log(`  AGENT0_ENABLED: ${process.env.AGENT0_ENABLED || 'not set'}`);
  console.log(`  AGENT0_NETWORK: ${process.env.AGENT0_NETWORK || 'not set'}`);
  console.log(
    `  BABYLON_REGISTRY_REGISTERED: ${process.env.BABYLON_REGISTRY_REGISTERED || 'not set'}`
  );
  console.log(
    `  BABYLON_GAME_WALLET_ADDRESS: ${process.env.BABYLON_GAME_WALLET_ADDRESS || 'not set'}`
  );
  console.log(
    `  PINATA_JWT: ${process.env.PINATA_JWT ? '✅ Set' : '❌ Not set'}`
  );

  try {
    const configResult = await db
      .select()
      .from(gameConfigs)
      .where(eq(gameConfigs.key, 'agent0_registration'))
      .limit(1);
    const config = configResult[0] || null;

    if (
      config?.value &&
      typeof config.value === 'object' &&
      'tokenId' in config.value
    ) {
      const regValue = config.value as {
        tokenId: unknown;
        metadataCID?: unknown;
        registeredAt?: unknown;
      };

      console.log('\n✅ Database Registration Found:');
      console.log(`   Token ID: ${regValue.tokenId}`);
      console.log(`   Metadata CID: ${regValue.metadataCID}`);
      console.log(`   Registered At: ${regValue.registeredAt}`);

      const tokenId = Number(regValue.tokenId);
      const registryAddress = '0x8004a6090Cd10A7288092483047B097295Fb8847';
      const rpcUrl =
        process.env.NEXT_PUBLIC_RPC_URL ||
        process.env.SEPOLIA_RPC_URL ||
        'https://ethereum-sepolia-rpc.publicnode.com';

      console.log('\n🔗 Checking On-Chain Registration:');
      console.log(`   Registry: ${registryAddress}`);
      console.log(`   Token ID: ${tokenId}`);

      try {
        const owner = execSync(
          `cast call ${registryAddress} "ownerOf(uint256)(address)" ${tokenId} --rpc-url ${rpcUrl}`,
          { encoding: 'utf-8' }
        ).trim();

        logger.success('On-chain registration confirmed');
        console.log(`   Owner: ${owner}`);

        if (
          owner.toLowerCase() ===
          process.env.BABYLON_GAME_WALLET_ADDRESS?.toLowerCase()
        ) {
          logger.success('Owner matches BABYLON_GAME_WALLET_ADDRESS');
        } else {
          logger.warn('Owner does NOT match BABYLON_GAME_WALLET_ADDRESS');
        }

        const tokenURI = execSync(
          `cast call ${registryAddress} "tokenURI(uint256)(string)" ${tokenId} --rpc-url ${rpcUrl}`,
          { encoding: 'utf-8' }
        )
          .trim()
          .replace(/"/g, '');

        console.log('\n📄 Token URI:');
        console.log(`   ${tokenURI}`);

        const cid = tokenURI.replace('ipfs://', '');
        console.log('\n🌐 View metadata:');
        console.log(`   https://ipfs.io/ipfs/${cid}`);
      } catch {
        logger.warn('Could not verify on-chain registration');
      }
    } else {
      logger.warn('No registration found in database');
      console.log('   Run: bun run agent0:setup');
    }
  } catch {
    logger.warn('Database not available');
  }
}

async function showAllStatus(): Promise<void> {
  await checkGameStatus();
  await checkWalletStatus();
  await checkAgent0Status();
  await checkLLMStatus();

  logger.header('✅ Status Check Complete');
}

/**
 * Main entry point for status domain commands.
 *
 * @param args - Raw command-line arguments for the status domain
 */
export async function runStatusCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (wantsHelp(parsed)) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (parsed.command || 'all') {
      case 'game':
        await checkGameStatus();
        break;

      case 'wallet':
        await checkWalletStatus();
        break;

      case 'agent0':
        await checkAgent0Status();
        break;

      case 'llm':
        await checkLLMStatus();
        break;

      case 'all':
        await showAllStatus();
        break;

      default:
        logger.fail(`Unknown target: ${parsed.command}`);
        printHelp();
        process.exit(1);
    }
  } finally {
    await closeDatabase();
  }
}
