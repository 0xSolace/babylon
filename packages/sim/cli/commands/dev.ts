/**
 * `babylon dev` — Start the runtime in development mode with hot-reload.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { watch } from 'chokidar';
import { defineCommand } from 'citty';
import consola from 'consola';
import { loadBabylonConfig } from '../../core/config';
import { buildEngine, parseInterval } from '../shared';

export default defineCommand({
  meta: {
    name: 'dev',
    description:
      'Start Babylon Runtime in development mode with watch & hot-reload',
  },
  args: {
    rootDir: {
      type: 'string',
      description: 'Project root directory',
      default: '.',
    },
    interval: {
      type: 'string',
      description: 'Tick interval in seconds (0 = single tick)',
      default: '60',
    },
    legacy: {
      type: 'boolean',
      description: 'Include legacy game-tick bridge system',
      default: false,
    },
  },
  async run({ args }) {
    const rootDir = resolve(args.rootDir);
    consola.box('Babylon Runtime — dev mode');

    const { config, configFile } = await loadBabylonConfig(rootDir);
    consola.info(`Config: ${configFile ?? 'defaults'}`);

    let engine = await buildEngine(config, rootDir, args.legacy);
    const intervalSec = parseInterval(args.interval, 'interval');

    // Watch systems directory for changes (if it exists)
    const systemsDir = resolve(rootDir, config.systemsDir ?? './systems');
    const hasSystemsDir = existsSync(systemsDir);
    const watcher = hasSystemsDir
      ? watch(systemsDir, {
          ignoreInitial: true,
          awaitWriteFinish: { stabilityThreshold: 200 },
        })
      : null;

    if (watcher) {
      let reloading = false;
      watcher.on('all', async (event, path) => {
        if (reloading) return;
        reloading = true;
        consola.info(`System ${event}: ${path}`);
        consola.start('Reloading engine...');

        try {
          await engine.shutdown();
          engine = await buildEngine(config, rootDir, args.legacy);
          consola.success('Engine reloaded');
        } catch (err) {
          consola.error('Reload failed:', err);
        } finally {
          reloading = false;
        }
      });

      consola.success(`Watching ${systemsDir} for changes`);
    } else {
      consola.info('No systems directory — skipping file watcher');
    }

    // Tick loop
    let running = true;
    let tickCount = 0;

    const cleanup = async () => {
      if (!running) return;
      running = false;
      consola.info('Shutting down...');
      await watcher?.close();
      await engine.shutdown();
      consola.success(`Stopped after ${tickCount} ticks`);
      process.exit(0);
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);

    if (intervalSec <= 0) {
      // Single tick mode
      tickCount++;
      try {
        const metrics = await engine.tick();
        consola.success('Tick completed', metrics);
      } catch (err) {
        consola.error('Tick failed:', err);
      }
      await watcher?.close();
      await engine.shutdown();
      return;
    }

    while (running) {
      tickCount++;
      consola.start(`Tick #${tickCount}`);
      const start = Date.now();
      try {
        await engine.tick();
        const ms = Date.now() - start;
        consola.success(`Tick #${tickCount} completed in ${ms}ms`);
      } catch (err) {
        consola.error(`Tick #${tickCount} failed:`, err);
      }

      if (running) {
        consola.info(`Next tick in ${intervalSec}s...`);
        await new Promise((r) => setTimeout(r, intervalSec * 1000));
      }
    }
  },
});
