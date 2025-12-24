/**
 * Decentralized Storage Layer
 *
 * ALL file storage routes through Jeju Storage (IPFS/Arweave).
 * NO FALLBACKS - Decentralized storage is required.
 *
 * This replaces Vercel Blob, MinIO, and S3 as the storage layer.
 */

import { logger } from '@babylon/shared'

// ============================================================================
// Types
// ============================================================================

export interface StorageConfig {
  serviceUrl: string
  namespace: string
  maxRetries: number
  retryDelayMs: number
}

export interface UploadResult {
  cid: string
  url: string
  size: number
  mimeType: string
}

export interface FileMetadata {
  cid: string
  name: string
  size: number
  mimeType: string
  createdAt: number
  expiresAt: number | null
  owner: string | null
}

export interface StorageStats {
  totalFiles: number
  totalSizeBytes: number
  pinnedFiles: number
}

// ============================================================================
// Decentralized Storage Client
// ============================================================================

class StorageClient {
  private config: StorageConfig
  private initialized = false

  constructor() {
    const serviceUrl = process.env.JEJU_STORAGE_SERVICE_URL
    if (!serviceUrl) {
      throw new Error(
        '[Storage] JEJU_STORAGE_SERVICE_URL is required. ' +
          'Decentralized storage is mandatory - no S3/MinIO/Blob fallback.',
      )
    }

    this.config = {
      serviceUrl,
      namespace: process.env.STORAGE_NAMESPACE ?? 'babylon',
      maxRetries: parseInt(process.env.STORAGE_MAX_RETRIES ?? '3', 10),
      retryDelayMs: parseInt(process.env.STORAGE_RETRY_DELAY_MS ?? '500', 10),
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    const healthy = await this.healthCheck()
    if (!healthy) {
      throw new Error(
        `[Storage] Storage service at ${this.config.serviceUrl} is not healthy. ` +
          'Start Jeju services: cd /path/to/jeju && bun run dev',
      )
    }

    logger.info(
      '[Storage] Connected to Jeju Storage',
      { url: this.config.serviceUrl },
      'Storage',
    )
    this.initialized = true
  }

  private requireInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        '[Storage] Storage not initialized. Call initialize() first.',
      )
    }
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    operation: string,
    attempt = 1,
  ): Promise<T> {
    try {
      return await fn()
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelayMs * 2 ** (attempt - 1)
        logger.warn(
          `[Storage] Retrying ${operation} (${attempt}/${this.config.maxRetries})`,
          { delay, error: errorMessage },
          'Storage',
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.withRetry(fn, operation, attempt + 1)
      }
      throw error
    }
  }

  // ============================================================================
  // Core Operations
  // ============================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serviceUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  async upload(
    file: Blob | Uint8Array,
    options: {
      name?: string
      mimeType?: string
      metadata?: Record<string, string>
    } = {},
  ): Promise<UploadResult> {
    this.requireInitialized()

    return this.withRetry(
      async () => {
        const formData = new FormData()

        if (file instanceof Blob) {
          formData.append('file', file, options.name)
        } else {
          const blob = new Blob([file as BlobPart], {
            type: options.mimeType ?? 'application/octet-stream',
          })
          formData.append('file', blob, options.name ?? 'file')
        }

        if (options.metadata) {
          formData.append('metadata', JSON.stringify(options.metadata))
        }
        formData.append('namespace', this.config.namespace)

        const response = await fetch(`${this.config.serviceUrl}/upload`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(60000),
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(`Upload failed (${response.status}): ${text}`)
        }

        const result = (await response.json()) as {
          cid: string
          url: string
          size: number
          mimeType: string
        }

        logger.info(
          `[Storage] Uploaded ${options.name ?? 'file'}: ${result.cid}`,
          undefined,
          'Storage',
        )
        return result
      },
      `upload ${options.name ?? 'file'}`,
    )
  }

  async uploadJson(data: unknown, name?: string): Promise<UploadResult> {
    const json = JSON.stringify(data)
    const blob = new Blob([json], { type: 'application/json' })
    return this.upload(blob, {
      name: name ?? 'data.json',
      mimeType: 'application/json',
    })
  }

  async download(cid: string): Promise<Uint8Array> {
    this.requireInitialized()

    return this.withRetry(async () => {
      const response = await fetch(`${this.config.serviceUrl}/ipfs/${cid}`, {
        signal: AbortSignal.timeout(60000),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Download failed (${response.status}): ${text}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      return new Uint8Array(arrayBuffer)
    }, `download ${cid}`)
  }

  async downloadJson<T>(cid: string): Promise<T> {
    const data = await this.download(cid)
    const text = new TextDecoder().decode(data)
    return JSON.parse(text) as T
  }

  async downloadText(cid: string): Promise<string> {
    const data = await this.download(cid)
    return new TextDecoder().decode(data)
  }

  async pin(cid: string, name?: string): Promise<void> {
    this.requireInitialized()

    await this.withRetry(async () => {
      const response = await fetch(`${this.config.serviceUrl}/pins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid, name, namespace: this.config.namespace }),
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Pin failed (${response.status}): ${text}`)
      }
    }, `pin ${cid}`)
  }

  async unpin(cid: string): Promise<void> {
    this.requireInitialized()

    await this.withRetry(async () => {
      const response = await fetch(`${this.config.serviceUrl}/pins/${cid}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok && response.status !== 404) {
        const text = await response.text()
        throw new Error(`Unpin failed (${response.status}): ${text}`)
      }
    }, `unpin ${cid}`)
  }

  async getMetadata(cid: string): Promise<FileMetadata | null> {
    this.requireInitialized()

    return this.withRetry(async () => {
      const response = await fetch(`${this.config.serviceUrl}/pins/${cid}`, {
        signal: AbortSignal.timeout(5000),
      })

      if (response.status === 404) return null
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Get metadata failed (${response.status}): ${text}`)
      }

      return response.json() as Promise<FileMetadata>
    }, `getMetadata ${cid}`)
  }

  async exists(cid: string): Promise<boolean> {
    const metadata = await this.getMetadata(cid)
    return metadata !== null
  }

  async delete(cid: string): Promise<void> {
    this.requireInitialized()

    await this.withRetry(async () => {
      const response = await fetch(
        `${this.config.serviceUrl}/pins/${cid}?namespace=${encodeURIComponent(this.config.namespace)}`,
        {
          method: 'DELETE',
          signal: AbortSignal.timeout(10000),
        },
      )

      if (!response.ok && response.status !== 404) {
        const text = await response.text()
        throw new Error(`Delete failed (${response.status}): ${text}`)
      }
    }, `delete ${cid}`)
  }

  async list(
    options: { limit?: number; offset?: number; status?: string } = {},
  ): Promise<FileMetadata[]> {
    this.requireInitialized()
    const { limit = 100, offset = 0, status } = options

    return this.withRetry(async () => {
      const params = new URLSearchParams({
        namespace: this.config.namespace,
        limit: String(limit),
        offset: String(offset),
      })
      if (status) params.set('status', status)

      const response = await fetch(`${this.config.serviceUrl}/pins?${params}`, {
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`List failed (${response.status}): ${text}`)
      }

      const data = (await response.json()) as { pins: FileMetadata[] }
      return data.pins
    }, 'list')
  }

  async getStats(): Promise<StorageStats> {
    this.requireInitialized()

    return this.withRetry(async () => {
      const response = await fetch(
        `${this.config.serviceUrl}/stats?namespace=${encodeURIComponent(this.config.namespace)}`,
        {
          signal: AbortSignal.timeout(5000),
        },
      )

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Stats failed (${response.status}): ${text}`)
      }

      return response.json() as Promise<StorageStats>
    }, 'getStats')
  }

  // ============================================================================
  // URL Helpers
  // ============================================================================

  getGatewayUrl(cid: string): string {
    return `${this.config.serviceUrl}/ipfs/${cid}`
  }

  getIpfsUrl(cid: string): string {
    return `ipfs://${cid}`
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let storageInstance: StorageClient | null = null

export function getStorage(): StorageClient {
  if (!storageInstance) {
    storageInstance = new StorageClient()
  }
  return storageInstance
}

export async function initializeStorage(): Promise<StorageClient> {
  const storage = getStorage()
  await storage.initialize()
  return storage
}

export function resetStorage(): void {
  storageInstance = null
}

// ============================================================================
// Convenience Functions (drop-in replacements)
// ============================================================================

export async function uploadFile(
  file: Blob | Buffer | Uint8Array,
  options?: { name?: string; mimeType?: string },
): Promise<UploadResult> {
  const storage = getStorage()
  if (!storage.isInitialized()) await storage.initialize()
  return storage.upload(file, options)
}

export async function uploadJson(
  data: unknown,
  name?: string,
): Promise<UploadResult> {
  const storage = getStorage()
  if (!storage.isInitialized()) await storage.initialize()
  return storage.uploadJson(data, name)
}

export async function downloadFile(cid: string): Promise<Uint8Array> {
  const storage = getStorage()
  if (!storage.isInitialized()) await storage.initialize()
  return storage.download(cid)
}

export async function downloadJson<T>(cid: string): Promise<T> {
  const storage = getStorage()
  if (!storage.isInitialized()) await storage.initialize()
  return storage.downloadJson<T>(cid)
}

export { StorageClient }
