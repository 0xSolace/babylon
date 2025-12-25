/**
 * Storage Module Exports
 *
 * Decentralized storage using Jeju Storage (IPFS/Arweave).
 */

// Jeju storage integration
export * from './jeju-storage'
export * from './s3-client'
// Storage (primary storage layer)
export {
  downloadFile,
  downloadJson,
  type FileMetadata,
  getStorage,
  initializeStorage,
  resetStorage,
  StorageClient,
  type StorageConfig,
  type StorageStats,
  type UploadResult,
  uploadFile,
  uploadJson,
} from './storage'
