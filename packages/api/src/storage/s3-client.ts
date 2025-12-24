/**
 * Decentralized Storage Client
 *
 * Uses Jeju's IPFS/Arweave storage exclusively.
 * NO FALLBACKS - Decentralized storage is required.
 *
 * Features:
 * - Content-addressed storage (IPFS)
 * - Permanent storage (Arweave)
 * - Multi-node replication
 * - Gateway URL generation
 */

import { logger } from '@babylon/shared'
import {
  getJejuStorageClient,
  initializeJejuStorage,
  type JejuStorageClient,
} from './jeju-storage'

interface UploadOptions {
  file: Buffer
  filename: string
  contentType: string
  folder?:
    | 'profiles'
    | 'covers'
    | 'posts'
    | 'user-profiles'
    | 'user-banners'
    | 'actors'
    | 'actor-banners'
    | 'organizations'
    | 'org-banners'
    | 'logos'
    | 'icons'
    | 'static'
  /** Store permanently on Arweave */
  permanent?: boolean
}

interface UploadResult {
  url: string
  key: string
  size: number
  cid: string
  provider: 'ipfs' | 'arweave'
}

class StorageClient {
  private client: JejuStorageClient | null = null
  private initialized = false

  private async getClient(): Promise<JejuStorageClient> {
    if (!this.initialized) {
      await initializeJejuStorage()
      this.client = getJejuStorageClient()
      this.initialized = true
    }

    if (!this.client) {
      throw new Error(
        '[Storage] Jeju storage client not available. Set JEJU_STORAGE_ENDPOINT or JEJU_NETWORK environment variable.',
      )
    }

    return this.client
  }

  async uploadImage(options: UploadOptions): Promise<UploadResult> {
    const client = await this.getClient()

    const result = await client.uploadImage({
      file: options.file,
      filename: options.filename,
      contentType: options.contentType,
      folder: options.folder,
      permanent: options.permanent,
    })

    logger.info('[Storage] Image uploaded', {
      cid: result.cid,
      provider: result.provider,
      size: result.size,
      folder: options.folder,
    })

    return {
      url: result.url,
      key: result.cid,
      size: result.size,
      cid: result.cid,
      provider: result.provider,
    }
  }

  async uploadJSON(
    data: Record<string, unknown>,
    filename: string,
    options?: { folder?: string; permanent?: boolean },
  ): Promise<UploadResult> {
    const client = await this.getClient()
    const result = await client.uploadJSON(data, filename, options)
    return this.toUploadResult(result)
  }

  async uploadText(
    content: string,
    filename: string,
    options?: { folder?: string; permanent?: boolean },
  ): Promise<UploadResult> {
    const client = await this.getClient()
    const result = await client.uploadText(content, filename, options)
    return this.toUploadResult(result)
  }

  private toUploadResult(result: {
    url: string
    cid: string
    size: number
    provider: 'ipfs' | 'arweave'
  }): UploadResult {
    return {
      url: result.url,
      key: result.cid,
      size: result.size,
      cid: result.cid,
      provider: result.provider,
    }
  }

  async deleteImage(cid: string): Promise<void> {
    const client = await this.getClient()
    await client.deleteImage(cid)
    logger.info('[Storage] Image deleted', { cid })
  }

  async download(cid: string): Promise<Buffer> {
    const client = await this.getClient()
    return client.download(cid)
  }

  async downloadJSON<T = Record<string, unknown>>(cid: string): Promise<T> {
    const client = await this.getClient()
    return client.downloadJSON<T>(cid)
  }

  async downloadText(cid: string): Promise<string> {
    const client = await this.getClient()
    return client.downloadText(cid)
  }

  async exists(cid: string): Promise<boolean> {
    const client = await this.getClient()
    return client.exists(cid)
  }

  async pin(cid: string): Promise<void> {
    const client = await this.getClient()
    await client.pin(cid)
  }

  async unpin(cid: string): Promise<void> {
    const client = await this.getClient()
    await client.unpin(cid)
  }

  async listFiles(folder: string) {
    const client = await this.getClient()
    return client.listFiles(folder)
  }

  async listPins(): Promise<string[]> {
    const client = await this.getClient()
    return client.listPins()
  }

  getUrl(cid: string): string {
    if (!this.client) {
      throw new Error('[Storage] Client not initialized')
    }
    return this.client.getUrl(cid)
  }

  async healthCheck(): Promise<boolean> {
    const client = await this.getClient()
    return client.healthCheck()
  }

  async initializeBucket(): Promise<void> {
    const client = await this.getClient()
    await client.initializeBucket()
  }
}

// Singleton instance
let storageInstance: StorageClient | null = null

export function getStorageClient(): StorageClient {
  if (!storageInstance) {
    storageInstance = new StorageClient()
  }
  return storageInstance
}

export function resetStorageClient(): void {
  storageInstance = null
}

export type { UploadOptions, UploadResult }

// Legacy exports for backward compatibility
export const S3StorageClient = StorageClient
export { StorageClient }
