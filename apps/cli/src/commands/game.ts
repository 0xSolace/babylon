#!/usr/bin/env bun

/**
 * Game Management Commands
 *
 * Commands:
 *   start     - Start the continuous game
 *   pause     - Pause the continuous game
 *   status    - Show game runtime status
 *   generate  - Generate a new game with scenarios and questions
 *   validate  - Validate actor data integrity
 */

import type { JsonValue } from '@babylon/db';
import {
  and,
  closeDatabase,
  db,
  generateSnowflakeId as dbGenerateSnowflakeId,
  desc,
  eq,
  gameConfigs,
  games,
  isNull,
  posts,
} from '@babylon/db';
import type { GameHistory, GroupMessage } from '@babylon/engine';
import { GameGenerator, loadActorsData } from '@babylon/engine';
import { v4 as uuidv4 } from 'uuid';
import { getFlag, parseArgs, wantsHelp } from '../lib/args.js';
import { logger } from '../lib/logger.js';

function printHelp(): void {
  console.log(`
Game Commands

USAGE:
  babylon game <command> [options]

COMMANDS:
  start       Start the continuous game
  pause       Pause the continuous game
  status      Show game runtime status
  generate    Generate a new game with scenarios and questions
  simulate    Run game simulation
  validate    Validate actor data integrity

OPTIONS (generate):
  -v, --verbose    Enable detailed logging

OPTIONS (simulate):
  --ticks=N         Number of invite processing ticks (default: 10)
  --config          Show current group chat configuration

EXAMPLES:
  babylon game start                    Start the game
  babylon game pause                    Pause the game
  babylon game status                   Check if game is running
  babylon game generate                 Generate new game content
  babylon game simulate --ticks=100     Run 100 invite processing ticks
  babylon game simulate --config        Show current configuration
  babylon game validate                 Validate actor affiliations
`);
}

/**
 * Generates a unique snowflake ID for game entities.
 *
 * @returns A unique ID string
 * @internal
 */
async function generateSnowflakeId(): Promise<string> {
  return uuidv4();
}

/**
 * Controls game state by starting or pausing the continuous game.
 *
 * Creates a new continuous game if none exists, or updates the existing game state.
 *
 * @param action - Either 'start' to start the game or 'pause' to pause it
 * @internal
 */
async function controlGame(action: 'start' | 'pause'): Promise<void> {
  logger.header(action === 'start' ? 'Starting Game' : 'Pausing Game');

  const result = await db
    .select()
    .from(games)
    .where(eq(games.isContinuous, true))
    .limit(1);

  let game = result[0];

  if (!game) {
    const gameId = await dbGenerateSnowflakeId();
    const created = await db
      .insert(games)
      .values({
        id: gameId,
        isContinuous: true,
        isRunning: action === 'start',
        currentDay: 1,
        startedAt: action === 'start' ? new Date() : null,
        updatedAt: new Date(),
      })
      .returning();
    game = created[0]!;
    logger.success(
      `Game created and ${action === 'start' ? 'started' : 'paused'}`
    );
    console.log(`  Game ID: ${game.id}`);
  } else {
    const isRunning = action === 'start';
    const updateData: Record<string, Date | boolean | null> = {
      isRunning,
      updatedAt: new Date(),
    };

    if (action === 'start') {
      updateData.startedAt = new Date();
      updateData.pausedAt = null;
    } else {
      updateData.pausedAt = new Date();
    }

    await db.update(games).set(updateData).where(eq(games.id, game.id));

    logger.success(`Game ${action === 'start' ? 'started' : 'paused'}`);
    console.log(`  Game ID: ${game.id}`);
    console.log(`  Current Day: ${game.currentDay}`);
  }
}

/**
 * Displays the current game status including running state, day, and metadata.
 *
 * @internal
 */
async function showGameStatus(): Promise<void> {
  logger.header('Game Status');

  const result = await db
    .select()
    .from(games)
    .where(eq(games.isContinuous, true))
    .limit(1);

  const game = result[0];

  if (!game) {
    console.log('No continuous game found.');
    console.log('\nCreate one with: babylon game start');
    return;
  }

  console.log(`Game ID:        ${game.id}`);
  console.log(`Status:         ${game.isRunning ? '✅ RUNNING' : '⏸️  PAUSED'}`);
  console.log(`Current Day:    ${game.currentDay}`);
  console.log(`Current Date:   ${game.currentDate?.toLocaleString() || 'N/A'}`);
  console.log(`Speed:          ${game.speed}ms between ticks`);
  console.log(`Active Qs:      ${game.activeQuestions || 0}`);

  if (game.startedAt) {
    console.log(`Started At:     ${game.startedAt.toLocaleString()}`);
  }
  if (game.pausedAt) {
    console.log(`Paused At:      ${game.pausedAt.toLocaleString()}`);
  }
  if (game.lastTickAt) {
    console.log(`Last Tick:      ${game.lastTickAt.toLocaleString()}`);
  }

  if (!game.isRunning) {
    console.log('\n💡 To start the game: babylon game start');
  }
}

/**
 * Validates and converts a JsonValue to a GameHistory object.
 *
 * Ensures the value matches the expected GameHistory structure with required fields:
 * gameNumber, completedAt, summary, keyOutcomes, highlights, and topMoments.
 *
 * @param value - JSON value from database to validate
 * @returns Validated GameHistory object
 * @throws {Error} If the value doesn't match the expected GameHistory structure
 * @internal
 */
function validateGameHistory(value: JsonValue): GameHistory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid game history format');
  }

  const obj = value as Record<string, JsonValue>;

  if (
    typeof obj.gameNumber !== 'number' ||
    typeof obj.completedAt !== 'string' ||
    typeof obj.summary !== 'string' ||
    !Array.isArray(obj.keyOutcomes) ||
    !Array.isArray(obj.highlights) ||
    !Array.isArray(obj.topMoments)
  ) {
    throw new Error('Invalid game history format');
  }

  return {
    gameNumber: obj.gameNumber as number,
    completedAt: obj.completedAt as string,
    summary: obj.summary as string,
    keyOutcomes: obj.keyOutcomes as GameHistory['keyOutcomes'],
    highlights: obj.highlights as string[],
    topMoments: obj.topMoments as string[],
  };
}

/**
 * Generates a minimal game history from database records when full history isn't available.
 *
 * Creates a simplified GameHistory from posts and questions for use as context
 * in subsequent game generation. Extracts top posts and creates highlights.
 *
 * @param gameId - ID of the game to generate history for
 * @param gameNumber - Sequential game number for this game
 * @returns Minimal GameHistory object with summary and highlights from posts
 * @internal
 */
async function generateMinimalGameHistory(
  gameId: string,
  gameNumber: number
): Promise<GameHistory> {
  const postsData = await db
    .select()
    .from(posts)
    .where(and(eq(posts.gameId, gameId), isNull(posts.deletedAt)))
    .orderBy(desc(posts.timestamp))
    .limit(100);

  const topPosts = postsData.slice(0, 10);
  const summary = `Game ${gameNumber} featured ${postsData.length} posts over 30 days.`;

  const highlights = topPosts.map((p) =>
    p.content.length > 100 ? p.content.substring(0, 100) + '...' : p.content
  );

  return {
    gameNumber,
    completedAt: new Date().toISOString(),
    summary,
    keyOutcomes: [],
    highlights,
    topMoments: highlights.slice(0, 5),
  };
}

/**
 * Validates actor data integrity by checking all affiliations reference valid organizations.
 *
 * Ensures no orphaned affiliation references exist that could cause errors during
 * game generation. Validates that every actor affiliation matches an existing organization ID.
 *
 * @throws {Error} Exits process with code 1 if any invalid affiliations are found
 * @internal
 */
async function validateActorsData(): Promise<void> {
  const actorsData = loadActorsData();
  const actors = actorsData.actors;
  const organizations = actorsData.organizations;

  const validOrgIds = new Set(organizations.map((org) => org.id));
  const errors: string[] = [];

  for (const actor of actors) {
    if (!actor.affiliations || actor.affiliations.length === 0) continue;

    for (const affiliation of actor.affiliations) {
      if (!validOrgIds.has(affiliation)) {
        errors.push(
          `${actor.name} (${actor.id}) has invalid affiliation: "${affiliation}"`
        );
      }
    }
  }

  if (errors.length > 0) {
    logger.fail('Actor validation failed');
    for (const error of errors) {
      console.log(`  - ${error}`);
    }
    process.exit(1);
  }
}

/**
 * Generates a complete game with scenarios, questions, and timeline.
 *
 * Validates actors, checks for API keys, loads previous game history for context,
 * generates new game content using GameGenerator, and saves to database.
 * Creates genesis game if no games exist.
 *
 * @param args - Parsed command-line arguments
 * @throws {Error} Exits process with code 1 if API keys missing or generation fails
 * @internal
 */
async function generateGame(args: ReturnType<typeof parseArgs>): Promise<void> {
  const verbose = getFlag(args, 'verbose', 'v');

  logger.header('Babylon Game Generator');

  // Validate actors
  logger.step('Validating actors...');
  await validateActorsData();
  logger.success('Actors validated');

  // Check API keys
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!groqKey && !openaiKey) {
    logger.fail('No API key found!');
    console.log('\nSet one of the following:');
    console.log('  export GROQ_API_KEY=your_key_here');
    console.log('  export OPENAI_API_KEY=your_key_here');
    process.exit(1);
  }

  console.log(`Using: ${groqKey ? 'Groq' : 'OpenAI'}`);

  const startTime = Date.now();

  // Check for existing games
  const existingGames = await db
    .select()
    .from(games)
    .orderBy(desc(games.currentDate));

  if (existingGames.length === 0) {
    logger.step('No genesis game found, generating...');
    const generator = new GameGenerator();
    const genesis = await generator.generateGenesis();

    await db.insert(games).values({
      id: await generateSnowflakeId(),
      isContinuous: false,
      isRunning: false,
      currentDate: new Date(),
      speed: 60000,
      updatedAt: new Date(),
    });

    logger.success('Genesis game created');
    console.log(
      `  Events: ${genesis.timeline.reduce((sum, day) => sum + day.events.length, 0)}`
    );
    console.log(
      `  Posts: ${genesis.timeline.reduce((sum, day) => sum + day.feedPosts.length, 0)}`
    );
  } else {
    console.log(`Found ${existingGames.length} existing game(s)`);
  }

  // Load history
  const history: GameHistory[] = [];
  let nextStartDate: string;
  let gameNumber = 1;

  if (existingGames.length > 0) {
    for (
      let i = Math.max(0, existingGames.length - 2);
      i < existingGames.length;
      i++
    ) {
      const gameData = existingGames[i];
      if (!gameData) continue;

      const historyConfigResult = await db
        .select()
        .from(gameConfigs)
        .where(eq(gameConfigs.key, `game-history-${gameData.id}`))
        .limit(1);
      const historyConfig = historyConfigResult[0] || null;

      if (historyConfig?.value) {
        history.push(validateGameHistory(historyConfig.value));
      } else {
        history.push(await generateMinimalGameHistory(gameData.id, i + 1));
      }
    }

    const lastGame = existingGames[0]!;
    const nextDate = new Date(lastGame.currentDate);
    nextDate.setDate(nextDate.getDate() + 30);
    nextStartDate = nextDate.toISOString().split('T')[0]!;
    gameNumber = existingGames.length + 1;
  } else {
    const now = new Date();
    nextStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  logger.step(`Generating Game #${gameNumber} (starting ${nextStartDate})...`);

  const generator = new GameGenerator(
    undefined,
    history.length > 0 ? history : undefined
  );
  const game = await generator.generateCompleteGame(nextStartDate);
  const duration = Date.now() - startTime;

  logger.success('Generation complete');
  console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
  console.log(
    `  Events: ${game.timeline.reduce((sum, day) => sum + day.events.length, 0)}`
  );
  console.log(
    `  Posts: ${game.timeline.reduce((sum, day) => sum + day.feedPosts.length, 0)}`
  );
  console.log(
    `  Group messages: ${
      Object.values(
        game.timeline.reduce(
          (acc, day) => {
            Object.entries(day.groupChats).forEach(([groupId, messages]) => {
              if (!acc[groupId]) acc[groupId] = [];
              acc[groupId]!.push(...messages);
            });
            return acc;
          },
          {} as Record<string, GroupMessage[]>
        )
      ).flat().length
    }`
  );

  // Show scenarios
  console.log('\nScenarios:');
  game.setup.scenarios.forEach((scenario) => {
    console.log(`  ${scenario.id}. ${scenario.title} (${scenario.theme})`);
    if (verbose) {
      console.log(`     ${scenario.description}`);
    }
  });

  // Save to database
  logger.step('Saving to database...');

  const gameHistory = generator.createGameHistory(game);

  const savedGameResult = await db
    .insert(games)
    .values({
      id: await generateSnowflakeId(),
      isContinuous: false,
      isRunning: false,
      currentDate: new Date(nextStartDate),
      speed: 60000,
      updatedAt: new Date(),
    })
    .returning();
  const savedGame = savedGameResult[0]!;

  // Upsert gameConfig: check if exists, update or create
  const existingConfig = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.key, `game-history-${savedGame.id}`))
    .limit(1);

  if (existingConfig[0]) {
    await db
      .update(gameConfigs)
      .set({ value: gameHistory as never, updatedAt: new Date() })
      .where(eq(gameConfigs.key, `game-history-${savedGame.id}`));
  } else {
    await db.insert(gameConfigs).values({
      id: await generateSnowflakeId(),
      key: `game-history-${savedGame.id}`,
      value: gameHistory as never,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  logger.success(`Game saved (ID: ${savedGame.id})`);
}

async function runSimulation(
  args: ReturnType<typeof parseArgs>
): Promise<void> {
  const {
    getGroupChatConfigSummary,
    GroupInviteOrchestrator,
    validateGroupChatConfig,
  } = await import('@babylon/engine');

  logger.header('Group Dynamics Simulation');

  const ticksOption = args.options['ticks'];
  const ticks = ticksOption ? Number.parseInt(ticksOption, 10) : 10;
  const showConfig = getFlag(args, 'config');

  // Show current configuration
  if (showConfig) {
    console.log('\nCurrent Configuration:');
    const config = getGroupChatConfigSummary();
    for (const [key, value] of Object.entries(config)) {
      console.log(`  ${key}: ${value}`);
    }

    const validation = validateGroupChatConfig();
    if (!validation.valid) {
      console.log('\nConfiguration Warnings:');
      for (const warning of validation.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }
    }
    console.log('');
  }

  // Get initial stats
  const initialStats = await GroupInviteOrchestrator.getInviteStats();
  console.log('\nInitial State:');
  console.log(`  Pending candidates: ${initialStats.pendingCandidates}`);
  console.log(`  Pending invites: ${initialStats.pendingInvites}`);
  console.log(`  Invites (24h): ${initialStats.invitesLast24h}`);
  console.log(`  Accepts (24h): ${initialStats.acceptsLast24h}`);

  // Run simulation ticks
  console.log(`\nRunning ${ticks} invite processing ticks...`);

  let totalInvitesSent = 0;
  let totalProcessed = 0;
  let totalExpired = 0;
  let totalSkipped = 0;

  for (let i = 1; i <= ticks; i++) {
    const result = await GroupInviteOrchestrator.processQueuedInvites();
    totalInvitesSent += result.invitesSent;
    totalProcessed += result.candidatesProcessed;
    totalExpired += result.expired;
    totalSkipped += result.skipped;

    if (result.invitesSent > 0) {
      console.log(`  Tick ${i}: ${result.invitesSent} invite(s) sent`);
    }
  }

  // Get final stats
  const finalStats = await GroupInviteOrchestrator.getInviteStats();

  console.log('\nSimulation Results:');
  console.log(`  Ticks run: ${ticks}`);
  console.log(`  Candidates processed: ${totalProcessed}`);
  console.log(`  Invites sent: ${totalInvitesSent}`);
  console.log(`  Expired: ${totalExpired}`);
  console.log(`  Skipped: ${totalSkipped}`);

  console.log('\nFinal State:');
  console.log(`  Pending candidates: ${finalStats.pendingCandidates}`);
  console.log(`  Pending invites: ${finalStats.pendingInvites}`);
  console.log(`  Invites (24h): ${finalStats.invitesLast24h}`);
  console.log(`  Accepts (24h): ${finalStats.acceptsLast24h}`);

  if (finalStats.invitesLast24h > 0) {
    const acceptRate = (
      (finalStats.acceptsLast24h / finalStats.invitesLast24h) *
      100
    ).toFixed(1);
    console.log(`  Accept rate: ${acceptRate}%`);
  }

  logger.success('Simulation complete');
}

/**
 * Main entry point for game domain commands.
 *
 * @param args - Raw command-line arguments for the game domain
 */
export async function runGameCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (wantsHelp(parsed)) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (parsed.command) {
      case 'start':
        await controlGame('start');
        break;

      case 'pause':
        await controlGame('pause');
        break;

      case 'status':
        await showGameStatus();
        break;

      case 'generate':
        await generateGame(parsed);
        break;

      case 'simulate':
        await runSimulation(parsed);
        break;

      case 'validate':
        await validateActorsData();
        logger.success('All actor affiliations are valid!');
        break;

      default:
        if (parsed.command) {
          logger.fail(`Unknown command: ${parsed.command}`);
        }
        printHelp();
        process.exit(parsed.command ? 1 : 0);
    }
  } finally {
    await closeDatabase();
  }
}
