/**
 * Cross-Chain Messaging Bridge
 *
 * Enables messaging across Jeju, Base, and Optimism
 */

export {
  BaseBridgeClient,
  type BaseBridgeConfig,
  type CrossChainKeyRegistration,
  type CrossChainMessage,
  createBaseBridgeClient,
  getBaseBridgeClient,
  MessagingChain,
  resetBaseBridgeClient,
} from './base-bridge';
