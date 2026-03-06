/**
 * Shared utilities for CLI commands.
 */

import consola from 'consola';
import type { BabylonRuntimeConfig } from '../core/config';
import { BabylonEngine } from '../core/engine';
import { scanSystems } from '../core/scanner';
import { TickPhase } from '../core/types';

export const phaseNames: Record<number, string> = {
  [TickPhase.Bootstrap]: 'Bootstrap',
  [TickPhase.Questions]: 'Questions',
  [TickPhase.Events]: 'Events',
  [TickPhase.Markets]: 'Markets',
  [TickPhase.Rebalancing]: 'Rebalancing',
  [TickPhase.ContentMaintenance]: 'Content Maintenance',
  [TickPhase.Social]: 'Social',
  [TickPhase.Finalize]: 'Finalize',
};

export function phaseName(phase: number): string {
  return phaseNames[phase] ?? `Phase(${phase})`;
}

export async function buildEngine(
  config: BabylonRuntimeConfig,
  rootDir: string,
  includeLegacy: boolean
): Promise<BabylonEngine> {
  const {
    systemsDir: _systemsDir,
    disabledSystems: _disabledSystems,
    systemPhases: _systemPhases,
    dev: _dev,
    ...customKeys
  } = config;
  const engine = new BabylonEngine({
    config: { budgetMs: config.budgetMs ?? 60_000, ...customKeys },
  });

  if (includeLegacy) {
    const { createLegacyGameTickSystem } = await import(
      '../core/bridge/legacy-game-tick'
    );
    engine.use(createLegacyGameTickSystem());
  }

  const { systems } = await scanSystems(
    config.systemsDir ?? './systems',
    rootDir
  );

  let scanned = 0;
  for (const sys of systems) {
    if (config.disabledSystems?.includes(sys.id)) {
      consola.warn(`System "${sys.id}" disabled by config`);
      continue;
    }
    engine.use(sys);
    scanned++;
  }

  consola.info(
    includeLegacy
      ? `Registered ${scanned} scanned system(s) + legacy bridge`
      : `Registered ${scanned} system(s)`
  );
  await engine.boot();
  return engine;
}

export function parseInterval(value: string, label: string): number {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    consola.warn(`Invalid ${label}: "${value}", defaulting to 60`);
    return 60;
  }
  return parsed;
}

export function escapeMarkdown(text: string): string {
  return text.replace(/([[\]|])/g, '\\$1');
}
