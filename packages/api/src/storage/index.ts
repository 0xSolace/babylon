/**
 * Storage Module Exports
 *
 * Decentralized storage using Jeju Storage (IPFS/Arweave).
 * NO FALLBACKS - Decentralized storage is required.
 */

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
} from './storage';

// Legacy aliases for backwards compatibility (deprecated - use storage directly)
// UnifiedStorage aliases removed - use StorageClient, getStorage, etc. directly

// Legacy exports (retained for compatibility)
export * from './jeju-storage';
export * from './s3-client';
export * from './sqlite-encrypted-store';
