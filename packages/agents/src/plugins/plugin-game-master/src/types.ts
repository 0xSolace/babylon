import type {
  GameMasterPluginContext,
  GameMasterWorldSnapshot,
} from '@babylon/engine';

export interface GameMasterPluginState {
  worldSnapshot?: GameMasterWorldSnapshot;
  context?: GameMasterPluginContext;
}
