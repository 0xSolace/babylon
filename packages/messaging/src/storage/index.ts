/**
 * Decentralized Storage
 *
 * CovenantSQL-based storage for encrypted messages
 */

export {
  type ConsistencyLevel,
  type CQLConfig,
  createStorage,
  getStorage,
  MessageStorage,
  resetStorage,
  type StoredConversation,
  type StoredKeyBundle,
  type StoredMessage,
} from './message-storage'
