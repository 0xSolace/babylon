#!/usr/bin/env bun

/**
 * Game Management Commands
 *
 * Commands:
 *   start     - Start the continuous game
 *   pause     - Pause the continuous game
 *   status    - Show game runtime status
 *   tick      - Execute a single game tick
 *   run       - Run game ticks in a loop
 *   cron      - Local cron simulator (calls server endpoints)
 *   generate  - Generate a new game with scenarios and questions
 *   validate  - Validate actor data integrity
 */

import type { Game, GameConfig, JsonValue, Post } from '@babylon/db'
import {
  and,
  closeDatabase,
  db,
  desc,
  eq,
  gameConfigs,
  games,
  isNull,
  posts,
} from '@babylon/db'
import type { GameHistory, GroupMessage } from '@babylon/engine'
import { generateSnowflakeId as dbGenerateSnowflakeId } from '@babylon/shared'

/**
 * Convert GameHistory to JsonValue for database storage.
 * GameHistory is structurally compatible with JsonValue (plain JSON object),
 * but TypeScript's structural typing doesn't recognize this.
 */
function toJsonValue(history: GameHistory): JsonValue {
  // JSON round-trip ensures the value is a pure JSON structure
  // JSON.parse of a stringified object always produces a valid JsonValue
  const parsed: unknown = JSON.parse(JSON.stringify(history))
  return parsed as JsonValue
}

import {
  executeGameTick,
  GameGenerator,
  GroupInviteOrchestrator,
  getGroupChatConfigSummary,
  loadActorsData,
  validateGroupChatConfig,
} from '@babylon/engine'
import { v4 as uuidv4 } from 'uuid'
import { getFlag, getOption, parseArgs, wantsHelp } from '../lib/args.js'
import { logger } from '../lib/logger.js'

function printHelp(): void {
  console.log(`
Game Commands

USAGE:
  babylon game <command> [options]

COMMANDS:
  start       Start the continuous game
  pause       Pause the continuous game
  status      Show game runtime status
  tick        Execute a single game tick directly
  run         Run game ticks in a loop continuously
  cron        Local cron simulator (calls server endpoints)
  generate    Generate a new game with scenarios and questions
  simulate    Run game simulation
  validate    Validate actor data integrity

OPTIONS (tick/run):
  --interval=N      Seconds between ticks (default: 60, only with run)

OPTIONS (cron):
  --port=N          Server port to call (default: 5007)
  --interval=N      Seconds between ticks (default: 60)

OPTIONS (generate):
  -v, --verbose    Enable detailed logging

OPTIONS (simulate):
  --ticks=N         Number of invite processing ticks (default: 10)
  --config          Show current group chat configuration

EXAMPLES:
  babylon game start                    Start the game
  babylon game pause                    Pause the game
  babylon game status                   Check if game is running
  babylon game tick                     Execute single game tick
  babylon game run --interval=30        Run ticks every 30 seconds
  babylon game cron --port=5007         Start local cron simulator
  babylon game generate                 Generate new game content
  babylon game simulate --ticks=100     Run 100 invite processing ticks
  babylon game simulate --config        Show current configuration
  babylon game validate                 Validate actor affiliations
`)
}

/**
 * Generates a unique snowflake ID for game entities.
 *
 * @returns A unique ID string
 * @internal
 */
async function generateSnowflakeId(): Promise<string> {
  return uuidv4()
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
  logger.header(action === 'start' ? 'Starting Game' : 'Pausing Game')

  const result = (await db
    .select()
    .from(games)
    .where(eq(games.isContinuous, true))
    .limit(1)) as unknown as Game[]

  let game = result[0]

  if (!game) {
    const gameId = await dbGenerateSnowflakeId()
    const created = (await db
      .insert(games)
      .values({
        id: gameId,
        isContinuous: true,
        isRunning: action === 'start',
        currentDay: 1,
        startedAt: action === 'start' ? new Date() : null,
        updatedAt: new Date(),
      })
      .returning()) as unknown as Game[]
    game = created[0]
    if (!game) {
      throw new Error('Failed to create game')
    }
    logger.success(
      `Game created and ${action === 'start' ? 'started' : 'paused'}`,
    )
    console.log(`  Game ID: ${game.id}`)
  } else {
    const isRunning = action === 'start'
    const updateData: Record<string, Date | boolean | null> = {
      isRunning,
      updatedAt: new Date(),
    }

    if (action === 'start') {
      updateData.startedAt = new Date()
      updateData.pausedAt = null
    } else {
      updateData.pausedAt = new Date()
    }

    await db.update(games).set(updateData).where(eq(games.id, game.id))

    logger.success(`Game ${action === 'start' ? 'started' : 'paused'}`)
    console.log(`  Game ID: ${game.id}`)
    console.log(`  Current Day: ${game.currentDay}`)
  }
}

/**
 * Displays the current game status including running state, day, and metadata.
 *
 * @internal
 */
async function showGameStatus(): Promise<void> {
  logger.header('Game Status')

  const result = (await db
    .select()
    .from(games)
    .where(eq(games.isContinuous, true))
    .limit(1)) as unknown as Game[]

  const game = result[0]

  if (!game) {
    console.log('No continuous game found.')
    console.log('\nCreate one with: babylon game start')
    return
  }

  console.log(`Game ID:        ${game.id}`)
  console.log(`Status:         ${game.isRunning ? '✅ RUNNING' : '⏸️  PAUSED'}`)
  console.log(`Current Day:    ${game.currentDay}`)
  console.log(`Current Date:   ${game.currentDate.toLocaleString()}`)
  console.log(`Speed:          ${game.speed}ms between ticks`)
  console.log(`Active Qs:      ${game.activeQuestions || 0}`)

  if (game.startedAt) {
    console.log(`Started At:     ${game.startedAt.toLocaleString()}`)
  }
  if (game.pausedAt) {
    console.log(`Paused At:      ${game.pausedAt.toLocaleString()}`)
  }
  if (game.lastTickAt) {
    console.log(`Last Tick:      ${game.lastTickAt.toLocaleString()}`)
  }

  if (!game.isRunning) {
    console.log('\n💡 To start the game: babylon game start')
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
function isGameHistory(value: unknown): value is GameHistory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  // After object check, use 'in' operator for property access
  return (
    'gameNumber' in value &&
    typeof value.gameNumber === 'number' &&
    'completedAt' in value &&
    typeof value.completedAt === 'string' &&
    'summary' in value &&
    typeof value.summary === 'string' &&
    'keyOutcomes' in value &&
    Array.isArray(value.keyOutcomes) &&
    'highlights' in value &&
    Array.isArray(value.highlights) &&
    'topMoments' in value &&
    Array.isArray(value.topMoments)
  )
}

function validateGameHistory(value: JsonValue): GameHistory {
  if (!isGameHistory(value)) {
    throw new Error('Invalid game history format')
  }
  return value
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
  gameNumber: number,
): Promise<GameHistory> {
  const postsData = (await db
    .select()
    .from(posts)
    .where(and(eq(posts.gameId, gameId), isNull(posts.deletedAt)))
    .orderBy(desc(posts.timestamp))
    .limit(100)) as unknown as Post[]

  const topPosts = postsData.slice(0, 10)
  const summary = `Game ${gameNumber} featured ${postsData.length} posts over 30 days.`

  const highlights: string[] = topPosts.map((p) =>
    p.content.length > 100 ? `${p.content.substring(0, 100)}...` : p.content,
  )

  return {
    gameNumber,
    completedAt: new Date().toISOString(),
    summary,
    keyOutcomes: [],
    highlights,
    topMoments: highlights.slice(0, 5),
  }
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
  const actorsData = loadActorsData()
  const actors = actorsData.actors
  const organizations = actorsData.organizations

  const validOrgIds = new Set(organizations.map((org) => org.id))
  const errors: string[] = []

  for (const actor of actors) {
    if (!actor.affiliations || actor.affiliations.length === 0) continue

    for (const affiliation of actor.affiliations) {
      if (!validOrgIds.has(affiliation)) {
        errors.push(
          `${actor.name} (${actor.id}) has invalid affiliation: "${affiliation}"`,
        )
      }
    }
  }

  if (errors.length > 0) {
    logger.fail('Actor validation failed')
    for (const error of errors) {
      console.log(`  - ${error}`)
    }
    process.exit(1)
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
  const verbose = getFlag(args, 'verbose', 'v')

  logger.header('Babylon Game Generator')

  // Validate actors
  logger.step('Validating actors...')
  await validateActorsData()
  logger.success('Actors validated')

  // Check API keys
  const groqKey = process.env.GROQ_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!groqKey && !openaiKey) {
    logger.fail('No API key found!')
    console.log('\nSet one of the following:')
    console.log('  export GROQ_API_KEY=your_key_here')
    console.log('  export OPENAI_API_KEY=your_key_here')
    process.exit(1)
  }

  console.log(`Using: ${groqKey ? 'Groq' : 'OpenAI'}`)

  const startTime = Date.now()

  // Check for existing games
  const existingGames = (await db
    .select()
    .from(games)
    .orderBy(desc(games.currentDate))) as unknown as Game[]

  if (existingGames.length === 0) {
    logger.step('No genesis game found, generating...')
    const generator = new GameGenerator()
    const genesis = await generator.generateGenesis()

    await db.insert(games).values({
      id: await generateSnowflakeId(),
      isContinuous: false,
      isRunning: false,
      currentDate: new Date(),
      speed: 60000,
      updatedAt: new Date(),
    })

    logger.success('Genesis game created')
    console.log(
      `  Events: ${genesis.timeline.reduce((sum, day) => sum + day.events.length, 0)}`,
    )
    console.log(
      `  Posts: ${genesis.timeline.reduce((sum, day) => sum + day.feedPosts.length, 0)}`,
    )
  } else {
    console.log(`Found ${existingGames.length} existing game(s)`)
  }

  // Load history
  const history: GameHistory[] = []
  let nextStartDate: string
  let gameNumber = 1

  if (existingGames.length > 0) {
    for (
      let i = Math.max(0, existingGames.length - 2);
      i < existingGames.length;
      i++
    ) {
      const gameData = existingGames[i]
      if (!gameData) continue

      const historyConfigResult = (await db
        .select()
        .from(gameConfigs)
        .where(eq(gameConfigs.key, `game-history-${gameData.id}`))
        .limit(1)) as unknown as GameConfig[]
      const historyConfig = historyConfigResult[0]

      if (historyConfig?.value) {
        history.push(validateGameHistory(historyConfig.value))
      } else {
        history.push(
          await generateMinimalGameHistory(String(gameData.id), i + 1),
        )
      }
    }

    const lastGame = existingGames[0]
    if (!lastGame) {
      throw new Error('No existing games found')
    }
    const nextDate = new Date(lastGame.currentDate)
    nextDate.setDate(nextDate.getDate() + 30)
    const dateStr = nextDate.toISOString().split('T')[0]
    nextStartDate = dateStr ?? ''
    gameNumber = existingGames.length + 1
  } else {
    const now = new Date()
    nextStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }

  logger.step(`Generating Game #${gameNumber} (starting ${nextStartDate})...`)

  const generator = new GameGenerator(
    undefined,
    history.length > 0 ? history : undefined,
  )
  const game = await generator.generateCompleteGame(nextStartDate)
  const duration = Date.now() - startTime

  logger.success('Generation complete')
  console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`)
  console.log(
    `  Events: ${game.timeline.reduce((sum, day) => sum + day.events.length, 0)}`,
  )
  console.log(
    `  Posts: ${game.timeline.reduce((sum, day) => sum + day.feedPosts.length, 0)}`,
  )
  console.log(
    `  Group messages: ${
      Object.values(
        game.timeline.reduce<Record<string, GroupMessage[]>>((acc, day) => {
          Object.entries(day.groupChats).forEach(([groupId, messages]) => {
            if (!acc[groupId]) acc[groupId] = []
            acc[groupId].push(...messages)
          })
          return acc
        }, {}),
      ).flat().length
    }`,
  )

  // Show scenarios
  console.log('\nScenarios:')
  game.setup.scenarios.forEach((scenario) => {
    console.log(`  ${scenario.id}. ${scenario.title} (${scenario.theme})`)
    if (verbose) {
      console.log(`     ${scenario.description}`)
    }
  })

  // Save to database
  logger.step('Saving to database...')

  const gameHistory = generator.createGameHistory(game)

  const savedGameResult = (await db
    .insert(games)
    .values({
      id: await generateSnowflakeId(),
      isContinuous: false,
      isRunning: false,
      currentDate: new Date(nextStartDate),
      speed: 60000,
      updatedAt: new Date(),
    })
    .returning()) as unknown as Game[]
  const savedGame = savedGameResult[0]
  if (!savedGame) {
    throw new Error('Failed to save game')
  }

  // Upsert gameConfig: check if exists, update or create
  const existingConfig = (await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.key, `game-history-${savedGame.id}`))
    .limit(1)) as unknown as GameConfig[]

  if (existingConfig[0]) {
    await db
      .update(gameConfigs)
      .set({ value: toJsonValue(gameHistory), updatedAt: new Date() })
      .where(eq(gameConfigs.key, `game-history-${savedGame.id}`))
  } else {
    await db.insert(gameConfigs).values({
      id: await generateSnowflakeId(),
      key: `game-history-${savedGame.id}`,
      value: toJsonValue(gameHistory),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  logger.success(`Game saved (ID: ${savedGame.id})`)
}

async function runSimulation(
  args: ReturnType<typeof parseArgs>,
): Promise<void> {
  logger.header('Group Dynamics Simulation')

  const ticksOption = args.options.ticks
  const ticks = ticksOption ? Number.parseInt(ticksOption, 10) : 10
  const showConfig = getFlag(args, 'config')

  // Show current configuration
  if (showConfig) {
    console.log('\nCurrent Configuration:')
    const config = getGroupChatConfigSummary()
    for (const [key, value] of Object.entries(config)) {
      console.log(`  ${key}: ${value}`)
    }

    const validation = validateGroupChatConfig()
    if (!validation.valid) {
      console.log('\nConfiguration Warnings:')
      for (const warning of validation.warnings) {
        console.log(`  ⚠️  ${warning}`)
      }
    }
    console.log('')
  }

  // Get initial stats
  const initialStats = await GroupInviteOrchestrator.getInviteStats()
  console.log('\nInitial State:')
  console.log(`  Pending candidates: ${initialStats.pendingCandidates}`)
  console.log(`  Pending invites: ${initialStats.pendingInvites}`)
  console.log(`  Invites (24h): ${initialStats.invitesLast24h}`)
  console.log(`  Accepts (24h): ${initialStats.acceptsLast24h}`)

  // Run simulation ticks
  console.log(`\nRunning ${ticks} invite processing ticks...`)

  let totalInvitesSent = 0
  let totalProcessed = 0
  let totalExpired = 0
  let totalSkipped = 0

  for (let i = 1; i <= ticks; i++) {
    const result = await GroupInviteOrchestrator.processQueuedInvites()
    totalInvitesSent += result.invitesSent
    totalProcessed += result.candidatesProcessed
    totalExpired += result.expired
    totalSkipped += result.skipped

    if (result.invitesSent > 0) {
      console.log(`  Tick ${i}: ${result.invitesSent} invite(s) sent`)
    }
  }

  // Get final stats
  const finalStats = await GroupInviteOrchestrator.getInviteStats()

  console.log('\nSimulation Results:')
  console.log(`  Ticks run: ${ticks}`)
  console.log(`  Candidates processed: ${totalProcessed}`)
  console.log(`  Invites sent: ${totalInvitesSent}`)
  console.log(`  Expired: ${totalExpired}`)
  console.log(`  Skipped: ${totalSkipped}`)

  console.log('\nFinal State:')
  console.log(`  Pending candidates: ${finalStats.pendingCandidates}`)
  console.log(`  Pending invites: ${finalStats.pendingInvites}`)
  console.log(`  Invites (24h): ${finalStats.invitesLast24h}`)
  console.log(`  Accepts (24h): ${finalStats.acceptsLast24h}`)

  if (finalStats.invitesLast24h > 0) {
    const acceptRate = (
      (finalStats.acceptsLast24h / finalStats.invitesLast24h) *
      100
    ).toFixed(1)
    console.log(`  Accept rate: ${acceptRate}%`)
  }

  logger.success('Simulation complete')
}

/**
 * Executes a single game tick directly without needing the web server.
 *
 * @internal
 */
async function runSingleTick(): Promise<void> {
  logger.header('Executing Game Tick')

  const startTime = Date.now()
  const result = await executeGameTick()
  const duration = Date.now() - startTime

  logger.success('Tick completed')
  console.log(`  Duration: ${duration}ms`)
  console.log(`  Posts created: ${result.postsCreated}`)
  console.log(`  Events created: ${result.eventsCreated}`)
  console.log(`  Articles created: ${result.articlesCreated}`)
  console.log(`  Markets updated: ${result.marketsUpdated}`)
  console.log(`  Questions resolved: ${result.questionsResolved}`)
  console.log(`  Questions created: ${result.questionsCreated}`)
}

/**
 * Runs game ticks continuously in a loop.
 *
 * @param intervalSeconds - Seconds between ticks
 * @internal
 */
async function runTickLoop(intervalSeconds: number): Promise<void> {
  logger.header('Game Tick Runner (Loop Mode)')
  console.log(`Interval: ${intervalSeconds} seconds`)
  console.log('Press Ctrl+C to stop\n')

  let running = true
  let tickCount = 0

  const cleanup = () => {
    running = false
    console.log(`\nStopping after ${tickCount} ticks...`)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  while (running) {
    tickCount++
    console.log(`\n🎮 Tick #${tickCount}`)
    await runSingleTick()

    if (running) {
      console.log(`\nWaiting ${intervalSeconds}s until next tick...`)
      await new Promise((resolve) =>
        setTimeout(resolve, intervalSeconds * 1000),
      )
    }
  }
}

/**
 * Local cron simulator - calls server endpoints for game and agent ticks.
 *
 * @param port - Server port to call
 * @param intervalSeconds - Seconds between ticks
 * @internal
 */
async function runLocalCron(
  port: number,
  intervalSeconds: number,
): Promise<void> {
  logger.header('Local Cron Simulator')
  console.log(`Server: http://localhost:${port}`)
  console.log(`Interval: ${intervalSeconds} seconds`)
  console.log('Press Ctrl+C to stop\n')

  const cronSecret = process.env.CRON_SECRET || 'development'
  const gameTickUrl = `http://localhost:${port}/api/cron/game-tick`
  const agentTickUrl = `http://localhost:${port}/api/cron/agent-tick`

  // Wait for server to be ready
  logger.step('Waiting for server to be ready...')
  let serverReady = false
  for (let attempt = 1; attempt <= 60; attempt++) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000),
      })
      if (response.ok) {
        logger.success(`Server ready after ${attempt} attempt(s)`)
        serverReady = true
        break
      }
    } catch {
      if (attempt < 60) {
        console.log(`  Attempt ${attempt}/60: Server not ready, waiting 3s...`)
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }
  }

  if (!serverReady) {
    logger.fail('Server did not become ready')
    console.log('\nStart the server first: bun run dev')
    process.exit(1)
  }

  let running = true
  let tickCount = 0

  const cleanup = () => {
    running = false
    console.log(`\nStopping cron simulator after ${tickCount} ticks...`)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  const executeCronTick = async () => {
    tickCount++

    // Game tick
    console.log(`\n🎮 Triggering game tick #${tickCount}...`)
    try {
      const gameResponse = await fetch(gameTickUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      })

      if (gameResponse.ok) {
        const data = await gameResponse.json()
        if (data.skipped) {
          console.log(`  ⏭️  Skipped: ${data.reason}`)
        } else {
          console.log(`  ✅ Game tick completed (${data.duration})`)
        }
      } else {
        console.log(`  ❌ Failed (HTTP ${gameResponse.status})`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`  ❌ Error: ${message}`)
      if (message.includes('ECONNREFUSED')) {
        logger.fail('Server not running!')
        process.exit(1)
      }
    }

    // Agent tick
    console.log(`🤖 Triggering agent tick #${tickCount}...`)
    try {
      const agentResponse = await fetch(agentTickUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      })

      if (agentResponse.ok) {
        const contentType = agentResponse.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const data = await agentResponse.json()
          console.log(
            `  ✅ Agent tick completed (${data.processed || 0} agents, ${data.totalActions || 0} actions)`,
          )
        } else {
          console.log('  ✅ Agent tick completed')
        }
      } else {
        console.log(`  ❌ Failed (HTTP ${agentResponse.status})`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`  ❌ Error: ${message}`)
    }
  }

  // Execute first tick immediately
  await executeCronTick()

  // Then execute at interval
  while (running) {
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000))
    if (running) {
      await executeCronTick()
    }
  }
}

/**
 * Main entry point for game domain commands.
 *
 * @param args - Raw command-line arguments for the game domain
 */
export async function runGameCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  if (wantsHelp(parsed)) {
    printHelp()
    process.exit(0)
  }

  try {
    switch (parsed.command) {
      case 'start':
        await controlGame('start')
        break

      case 'pause':
        await controlGame('pause')
        break

      case 'status':
        await showGameStatus()
        break

      case 'tick':
        await runSingleTick()
        break

      case 'run': {
        const runInterval = parseInt(getOption(parsed, 'interval') || '60', 10)
        await runTickLoop(runInterval)
        break
      }

      case 'cron': {
        const cronPort = parseInt(getOption(parsed, 'port') || '5007', 10)
        const cronInterval = parseInt(getOption(parsed, 'interval') || '60', 10)
        await runLocalCron(cronPort, cronInterval)
        break
      }

      case 'generate':
        await generateGame(parsed)
        break

      case 'simulate':
        await runSimulation(parsed)
        break

      case 'validate':
        await validateActorsData()
        logger.success('All actor affiliations are valid!')
        break

      default:
        if (parsed.command) {
          logger.fail(`Unknown command: ${parsed.command}`)
        }
        printHelp()
        process.exit(parsed.command ? 1 : 0)
    }
  } finally {
    await closeDatabase()
  }
}
