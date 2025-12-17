/**
 * Decentralized Storage
 *
 * CovenantSQL-based storage for encrypted messages
 */

export {
  type ConsistencyLevel,
  type CQLConfig,
  createDecentralizedStorage,
  DecentralizedMessageStorage,
  getDecentralizedStorage,
  resetDecentralizedStorage,
  type StoredConversation,
  type StoredKeyBundle,
  type StoredMessage,
} from './decentralized-storage';
