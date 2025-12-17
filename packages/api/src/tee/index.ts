/**
 * TEE (Trusted Execution Environment) Module
 *
 * Provides unruggable game infrastructure for Babylon.
 */

// Enclave
export {
  type AttestationQuote,
  BabylonEnclave,
  type BabylonEnclaveConfig,
  type EnclaveStatus,
  getBabylonEnclave,
  type SealedState,
  shutdownBabylonEnclave,
} from './babylon-enclave';

// DStack Integration (Phala TEE)
export {
  type DStackAttestation,
  type DStackConfig,
  DStackIntegration,
  type DStackKMS,
  type DStackStatus,
  type DStackWallet,
  getDStack,
  initializeDStack,
  isDStackAvailable,
} from './dstack-integration';

// Orchestrator
export {
  createUnruggableOrchestrator,
  type GameState,
  getUnruggableOrchestrator,
  type OrchestratorPhase,
  type OrchestratorStatus,
  startUnruggableOrchestrator,
  UnruggableOrchestrator,
  type UnruggableOrchestratorConfig,
} from './unruggable-orchestrator';
