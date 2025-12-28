/**
 * Model Storage Service
 *
 * Handles model versioning and storage using Jeju's decentralized storage.
 *
 * Stores trained models with metadata for easy deployment.
 * Uses permanent (Arweave) storage for production models.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  getStorage as getStorageFromApi,
  initializeStorage,
  type StorageClient as JejuStorageClient,
} from '@babylon/api'
import { db } from '@babylon/db'
import { logger } from '@babylon/shared'
import type { JsonValue } from '@jejunetwork/shared'

// ============================================================================
// Types
// ============================================================================

type StorageClient = JejuStorageClient

export interface ModelMetadata {
  trainingBatch?: string
  accuracy?: number | null
  avgReward?: number | null
  baseModel?: string
}

export interface ModelVersion {
  version: string
  baseModel: string
  blobUrl: string
  cid: string
  arweaveUrl?: string
  size: number
  uploadedAt: Date
  metadata: ModelMetadata & Record<string, JsonValue | undefined>
  provider: 'jeju'
}

// ============================================================================
// Storage Access
// ============================================================================

let storageClient: StorageClient | null = null

async function getStorage(): Promise<StorageClient> {
  if (storageClient?.isInitialized()) return storageClient

  const storage = getStorageFromApi()
  if (!storage.isInitialized()) {
    await initializeStorage()
  }
  storageClient = storage
  return storageClient
}

// ============================================================================
// Model Storage Service
// ============================================================================

export class ModelStorageService {
  private readonly prefix = 'models/'

  /**
   * Upload trained model to decentralized storage
   */
  async uploadModel(options: {
    version: string
    modelPath: string
    metadata?: ModelVersion['metadata']
    permanent?: boolean
  }): Promise<ModelVersion> {
    const storage = await getStorage()

    // Read model file
    const modelData = await fs.readFile(options.modelPath)
    const fileName = path.basename(options.modelPath)

    logger.info('Uploading model to Jeju Storage', {
      version: options.version,
      fileName,
      permanent: options.permanent ?? true,
    })

    // Upload model file
    const modelResult = await storage.upload(modelData, {
      name: `${this.prefix}${options.version}/${fileName}`,
      mimeType: 'application/octet-stream',
      metadata: {
        'App-Name': 'babylon-ai',
        'Content-Type': 'model',
        Version: options.version,
      },
    })

    // Upload metadata
    await storage.uploadJson(
      options.metadata ?? {},
      `${this.prefix}${options.version}/metadata.json`,
    )

    logger.info('Model uploaded to Jeju Storage', {
      version: options.version,
      cid: modelResult.cid,
      size: modelData.length,
    })

    // Save to database
    await db.trainedModel.create({
      data: {
        id: `model-${Date.now()}`,
        modelId: `babylon-agent-${options.version}`,
        name: `Babylon Agent Model v${options.version}`,
        version: options.version,
        baseModel: options.metadata?.baseModel ?? 'unsloth/Qwen3-4B-128K',
        trainingBatchId: options.metadata?.trainingBatch ?? null,
        storagePath: modelResult.url,
        accuracy: options.metadata?.accuracy ?? null,
        avgReward: options.metadata?.avgReward ?? null,
        status: 'ready',
        updatedAt: new Date(),
      },
    })

    return {
      version: options.version,
      baseModel: options.metadata?.baseModel ?? 'unsloth/Qwen3-4B-128K',
      blobUrl: modelResult.url,
      cid: modelResult.cid,
      size: modelData.length,
      uploadedAt: new Date(),
      metadata: options.metadata ?? {},
      provider: 'jeju',
    }
  }

  /**
   * Download model from storage
   */
  async downloadModel(version: string): Promise<{
    modelData: Buffer
    metadata: ModelVersion['metadata']
  }> {
    const model = await db.trainedModel.findFirst({
      where: { version },
    })

    if (!model) {
      throw new Error(`Model version ${version} not found`)
    }

    if (!model.storagePath) {
      throw new Error(`Model version ${version} has no storage path`)
    }

    // Download model file
    const modelResponse = await fetch(model.storagePath, {
      signal: AbortSignal.timeout(120000),
    })

    if (!modelResponse.ok) {
      throw new Error(`Failed to download model: ${modelResponse.status}`)
    }

    const modelData = Buffer.from(await modelResponse.arrayBuffer())

    // Download metadata
    const pathParts = model.storagePath.split('/')
    pathParts.pop()
    const metadataUrl = `${pathParts.join('/')}/metadata.json`

    // Metadata is optional - fetch with timeout, default to empty on failure
    const metadataResponse = await fetch(metadataUrl, {
      signal: AbortSignal.timeout(10000),
    }).catch(() => null)

    let metadata: ModelVersion['metadata'] = {}
    if (metadataResponse?.ok) {
      metadata = (await metadataResponse.json()) as ModelVersion['metadata']
    } else if (metadataResponse === null) {
      logger.warn('Could not fetch model metadata', { version, metadataUrl })
    }

    return { modelData, metadata }
  }

  /**
   * List all model versions
   */
  async listModels(): Promise<ModelVersion[]> {
    const dbModels = await db.trainedModel.findMany({
      where: { status: 'ready' },
      orderBy: { updatedAt: 'desc' },
    })

    const models: ModelVersion[] = []

    for (const model of dbModels) {
      if (!model.storagePath) continue

      const metadata: ModelVersion['metadata'] = {
        accuracy: model.accuracy,
        avgReward: model.avgReward,
        baseModel: model.baseModel,
      }

      // Extract CID
      const cidMatch = model.storagePath.match(
        /\/ipfs\/([^/]+)|arweave\.net\/([^/]+)/,
      )
      const cid = cidMatch?.[1] || cidMatch?.[2] || ''

      models.push({
        version: model.version,
        baseModel: model.baseModel,
        blobUrl: model.storagePath,
        cid,
        arweaveUrl: model.storagePath.includes('arweave.net')
          ? model.storagePath
          : undefined,
        size: 0,
        uploadedAt: new Date(model.updatedAt),
        metadata,
        provider: 'jeju',
      })
    }

    return models.sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime(),
    )
  }

  /**
   * Delete model version
   * Note: IPFS content can be unpinned, Arweave content is permanent
   */
  async deleteModel(version: string): Promise<void> {
    const storage = await getStorage()

    const model = await db.trainedModel.findFirst({
      where: { version },
    })

    if (model?.storagePath) {
      // Arweave content is permanent
      if (model.storagePath.includes('arweave.net')) {
        logger.info('Model on Arweave is permanent - archiving in DB only', {
          version,
        })
      } else {
        // IPFS content can be unpinned
        try {
          const cidMatch = model.storagePath.match(/\/ipfs\/([^/]+)/)
          if (cidMatch?.[1]) {
            await storage.delete(cidMatch[1])
            logger.info('Model unpinned from IPFS', {
              version,
              cid: cidMatch[1],
            })
          }
        } catch (error) {
          logger.warn('Could not unpin model from IPFS', { version, error })
        }
      }
    }

    // Archive in database
    await db.trainedModel.updateMany({
      where: { version },
      data: {
        status: 'archived',
        archivedAt: new Date(),
        updatedAt: new Date(),
      },
    })

    logger.info('Model archived', { version })
  }

  /**
   * Get latest model version
   */
  async getLatestVersion(): Promise<ModelVersion | null> {
    const models = await this.listModels()
    return models[0] ?? null
  }

  /**
   * Get storage provider (always 'jeju')
   */
  getStorageProvider(): 'jeju' {
    return 'jeju'
  }
}

// Singleton
export const modelStorage = new ModelStorageService()
