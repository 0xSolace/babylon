import type { GameMasterWorldSnapshot } from '../types';
import type {
  GameMasterPluginId,
  ResolvedGameMasterPluginContext,
} from './types';

export interface GameMasterRuntimeResolverRegistration {
  resolveContext: (
    snapshot: GameMasterWorldSnapshot
  ) => Promise<ResolvedGameMasterPluginContext | null>;
  getMountedPluginIds?: () => GameMasterPluginId[];
}

type RuntimeResolverEntry = {
  id: string;
  registration: GameMasterRuntimeResolverRegistration;
};

const runtimeResolvers = new Map<string, RuntimeResolverEntry>();

export function registerGameMasterRuntimeResolver(
  id: string,
  registration: GameMasterRuntimeResolverRegistration
): () => void {
  runtimeResolvers.set(id, { id, registration });
  return () => {
    const current = runtimeResolvers.get(id);
    if (current?.registration === registration) {
      runtimeResolvers.delete(id);
    }
  };
}

export async function resolveRuntimeGameMasterPluginContext(
  snapshot: GameMasterWorldSnapshot
): Promise<ResolvedGameMasterPluginContext | null> {
  const entries = [...runtimeResolvers.values()].reverse();
  for (const entry of entries) {
    const resolved = await entry.registration.resolveContext(snapshot);
    if (resolved) return resolved;
  }

  return null;
}

export function listMountedGameMasterPluginIds(): GameMasterPluginId[] {
  const mounted = new Set<GameMasterPluginId>();
  for (const entry of runtimeResolvers.values()) {
    for (const pluginId of entry.registration.getMountedPluginIds?.() ?? []) {
      mounted.add(pluginId);
    }
  }

  return [...mounted];
}
