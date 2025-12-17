/**
 * Decentralized Identity (DID) Module
 *
 * Manages user identities using the did:jeju method.
 * DIDs are created via MPC key generation and stored on-chain.
 */

export { DIDManager } from './manager';
export { DIDResolver } from './resolver';
export {
  createDID,
  didEquals,
  generateRandomDID,
  getNetwork,
  isLocalnet,
  isMainnet,
  isTestnet,
  parseDID,
  validateDID,
} from './utils';
