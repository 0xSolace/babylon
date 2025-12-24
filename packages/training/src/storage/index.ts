/**
 * Training Storage Module
 *
 * Encrypted trajectory storage for training.
 */

export {
  type AuthSignature,
  type EncryptedTrajectory,
  EncryptedTrajectoryStorage,
  getEncryptedTrajectoryStorage,
  resetEncryptedTrajectoryStorage,
  type StorageConfig,
  type TrajectoryBatch,
} from './EncryptedTrajectoryStorage'
export {
  getStorage,
  getStorageProvider,
  type IPFSUploadResult,
  type ModelMetadata,
  type StorageOptions,
  StorageUtil,
  shouldUseStorage,
} from './storage-util'
