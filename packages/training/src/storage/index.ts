/**
 * Training Storage Module
 *
 * Encrypted trajectory storage for decentralized training.
 */

export {
  type AuthSignature,
  type EncryptedPayload,
  type EncryptedTrajectory,
  EncryptedTrajectoryStorage,
  getEncryptedTrajectoryStorage,
  resetEncryptedTrajectoryStorage,
  type StorageConfig,
  type TrajectoryBatch,
} from './EncryptedTrajectoryStorage';
