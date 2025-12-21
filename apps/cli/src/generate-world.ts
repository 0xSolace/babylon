#!/usr/bin/env bun

/**
 * @fileoverview Game World Narrative Generator CLI
 *
 * Generates complete game narratives with all NPC actions, events, conversations,
 * and social media posts. Creates a detailed timeline of events leading to a
 * predetermined outcome (SUCCESS or FAILURE).
 *
 * **Core Features:**
 * - Full narrative generation with NPC behaviors
 * - Day-by-day timeline simulation (default: 30 days)
 * - Configurable outcome (YES/NO for prediction market)
 * - Event-driven architecture with detailed logging
 * - JSON export for integration with other systems
 * - Verbose mode for detailed event tracking
 *
 * @module cli/generate-world
 * @category CLI - Game Generation
 *
 * @example
 * ```bash
 * # Generate with default settings (SUCCESS outcome)
 * bun run src/cli/generate-world.ts
 *
 * # Generate with specific outcome
 * bun run src/cli/generate-world.ts --outcome=FAILURE
 *
 * # Generate with verbose logging
 * bun run src/cli/generate-world.ts --verbose
 *
 * # Save to file
 * bun run src/cli/generate-world.ts --save=world.json
 *
 * # Get JSON output only (for piping)
 * bun run src/cli/generate-world.ts --json
 * ```
 *
 * @see {@link GameWorld} for world generation implementation
 * @since v0.1.0
 */

import { GameWorld } from '@babylon/engine';
import { writeFile } from 'fs/promises';
import { logger } from './lib/logger.js';

interface CLIOptions {
  outcome?: 'SUCCESS' | 'FAILURE';
  save?: string;
  verbose?: boolean;
  json?: boolean;
}

/**
 * Parses command-line arguments into typed options
 */
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  args.forEach((arg) => {
    if (arg.startsWith('--outcome=')) {
      options.outcome = arg.split('=')[1] as 'SUCCESS' | 'FAILURE';
    } else if (arg.startsWith('--save=')) {
      options.save = arg.split('=')[1];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--json') {
      options.json = true;
    }
  });

  return options;
}

/**
 * Main execution function for world generation CLI
 */
async function main() {
  const options = parseArgs();

  const outcomeValue = options.outcome === 'FAILURE' ? false : true;

  const world = new GameWorld({
    outcome: outcomeValue,
    numNPCs: 8,
    duration: 30,
    verbosity: options.verbose ? 'detailed' : 'normal',
  });

  if (options.verbose && !options.json) {
    logger.info('GENERATING BABYLON GAME WORLD');
    logger.info('=================================');

    world.on('world:started', (event) => {
      logger.info(`Question: ${event.data.question}`);
      logger.info(`True Outcome: ${outcomeValue ? 'SUCCESS' : 'FAILURE'}`);
      logger.info(`NPCs in world: ${event.data.npcs}`);
      logger.info('--- TIMELINE ---');
    });

    world.on('day:begins', (event) => {
      logger.info(`DAY ${event.data.day}`);
      logger.info('─'.repeat(50));
    });

    world.on('npc:action', (event) => {
      logger.info(`${event.npc}: ${event.description}`);
    });

    world.on('npc:conversation', (event) => {
      logger.info(event.description);
    });

    world.on('news:published', (event) => {
      logger.info(`${event.npc}: ${event.description}`);
    });

    world.on('rumor:spread', (event) => {
      logger.info(`Rumor: ${event.description}`);
    });

    world.on('clue:revealed', (event) => {
      logger.info(`${event.npc}: ${event.description}`);
    });

    world.on('development:occurred', (event) => {
      logger.info(`DEVELOPMENT: ${event.description}`);
    });

    world.on('feed:post', (post) => {
      const emoji =
        post.type === 'news'
          ? '📰'
          : post.type === 'reaction'
            ? '💬'
            : post.type === 'thread'
              ? '🧵'
              : '📢';

      const prefix = post.replyTo ? '    ↳' : '  ';
      logger.info(`${prefix}${emoji} ${post.author}: ${post.content}`);

      if (post.clueStrength > 0.5) {
        logger.debug(
          `${prefix}   [Strong clue: ${post.clueStrength.toFixed(1)}]`
        );
      }
    });

    world.on('outcome:revealed', (event) => {
      logger.info('='.repeat(50));
      logger.info(
        `FINAL OUTCOME: ${event.data.outcome ? 'SUCCESS' : 'FAILURE'}`
      );
      logger.info('='.repeat(50));
    });
  }

  const finalWorld = await world.generate();

  if (options.save) {
    const json = JSON.stringify(finalWorld, null, 2);
    await writeFile(options.save, json);

    if (!options.json) {
      logger.info(`World saved to: ${options.save}`);
    }
  }

  if (!options.json) {
    logger.info('World generation complete', {
      totalEvents: finalWorld.events.length,
      npcs: finalWorld.npcs.length,
      daysSimulated: finalWorld.timeline.length,
      finalOutcome: finalWorld.outcome ? 'SUCCESS' : 'FAILURE',
    });
  } else {
    logger.info(JSON.stringify(finalWorld, null, 2));
  }

  process.exit(0);
}

if (import.meta.main) {
  main().catch((error) => {
    logger.error('Error:', error);
    process.exit(1);
  });
}

export { main };
