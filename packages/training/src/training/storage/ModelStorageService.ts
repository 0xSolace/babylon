/**
 * Model Storage Service
 *
 * Handles model versioning and storage using Jeju's decentralized storage.
 * NO FALLBACKS - Jeju Storage is required.
 *
 * Stores trained models with metadata for easy deployment.
 * Uses permanent (Arweave) storage for production models.
 */

import { db, eq, trainedModels } from '@babylon/db';
import type { JsonValue } from '@babylon/shared';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface StorageClient {
  upload: (
    key: string,
    data: Buffer | string,
    options?: {
      contentType?: string;
      metadata?: Record<string, string>;
      permanent?: boolean;
    }
  ) => Promise<{ url: string; cid: string; size: number }>;
  uploadJson: <T>(
    key: string,
    data: T,
    options?: { permanent?: boolean }
  ) => Promise<{ url: string; cid: string }>;
  download: (key: string) => Promise<Buffer>;
  downloadJson: <T>(cid: string) => Promise<T>;
  delete: (key: string) => Promise<void>;
  list: (prefix?: string) => Promise<
    Array<{
      key: string;
      cid: string;
      size: number;
    }>
  >;
  isInitialized: () => boolean;
}

export interface ModelMetadata {
  trainingBatch?: string;
  accuracy?: number;
  avgReward?: number;
  baseModel?: string;
}

export interface ModelVersion {
  version: string;
  baseModel: string;
  blobUrl: string;
  cid: string;
  arweaveUrl?: string;
  size: number;
  uploadedAt: Date;
  metadata: ModelMetadata & Record<string, JsonValue | undefined>;
  provider: 'jeju';
}

// ============================================================================
// Storage Access
// ============================================================================

let storageClient: StorageClient | null = null;

async function getStorage(): Promise<StorageClient> {
  if (storageClient?.isInitialized()) return storageClient;

  const { getStorage: getStorageFromApi, initializeStorage } = await import(
    '@babylon/api'
  );
  const storage = getStorageFromApi();
  if (!storage.isInitialized()) {
    await initializeStorage();
  }
  // Cast through unknown since API client has compatible methods
  storageClient = storage as unknown as StorageClient;
  return storageClient;
}

// ============================================================================
// Model Storage Service
// ============================================================================

export class ModelStorageService {
  private readonly prefix = 'models/';

  /**
   * Upload trained model to decentralized storage
   */
  async uploadModel(options: {
    version: string;
    modelPath: string;
    metadata?: ModelVersion['metadata'];
    permanent?: boolean;
  }): Promise<ModelVersion> {
    const storage = await getStorage();

    // Read model file
    const modelData = await fs.readFile(options.modelPath);
    const fileName = path.basename(options.modelPath);

    logger.info('Uploading model to Jeju Storage', {
      version: options.version,
      fileName,
      permanent: options.permanent ?? true,
    });

    // Upload model file
    const modelResult = await storage.upload(
      `${this.prefix}${options.version}/${fileName}`,
      modelData,
      {
        contentType: 'application/octet-stream',
        permanent: options.permanent ?? true,
        metadata: {
          'App-Name': 'babylon-ai',
          'Content-Type': 'model',
          Version: options.version,
        },
      }
    );

    // Upload metadata
    await storage.uploadJson(
      `${this.prefix}${options.version}/metadata.json`,
      options.metadata ?? {},
      { permanent: options.permanent ?? true }
    );

    logger.info('Model uploaded to Jeju Storage', {
      version: options.version,
      cid: modelResult.cid,
      size: modelData.length,
    });

    // Save to database
    await db.insert(trainedModels).values({
      id: `model-${Date.now()}`,
      modelId: `babylon-agent-${options.version}`,
      version: options.version,
      baseModel:
        (options.metadata?.baseModel as string) || 'unsloth/Qwen3-4B-128K',
      storagePath: modelResult.url,
      accuracy: (options.metadata?.accuracy as number) || null,
      avgReward: (options.metadata?.avgReward as number) || null,
      status: 'ready',
      agentsUsing: 0,
      updatedAt: new Date(),
    });

    return {
      version: options.version,
      baseModel:
        (options.metadata?.baseModel as string) || 'unsloth/Qwen3-4B-128K',
      blobUrl: modelResult.url,
      cid: modelResult.cid,
      size: modelData.length,
      uploadedAt: new Date(),
      metadata: options.metadata ?? {},
      provider: 'jeju',
    };
  }

  /**
   * Download model from storage
   */
  async downloadModel(version: string): Promise<{
    modelData: Buffer;
    metadata: ModelVersion['metadata'];
  }> {
    const modelResult = await db
      .select({ storagePath: trainedModels.storagePath })
      .from(trainedModels)
      .where(eq(trainedModels.version, version))
      .limit(1);

    const model = modelResult[0];

    if (!model) {
      throw new Error(`Model version ${version} not found`);
    }

    // Download model file
    const modelResponse = await fetch(model.storagePath, {
      signal: AbortSignal.timeout(120000),
    });

    if (!modelResponse.ok) {
      throw new Error(`Failed to download model: ${modelResponse.status}`);
    }

    const modelData = Buffer.from(await modelResponse.arrayBuffer());

    // Download metadata
    const pathParts = model.storagePath.split('/');
    pathParts.pop();
    const metadataUrl = `${pathParts.join('/')}/metadata.json`;

    let metadata: ModelVersion['metadata'] = {};
    try {
      const metadataResponse = await fetch(metadataUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (metadataResponse.ok) {
        metadata = (await metadataResponse.json()) as ModelVersion['metadata'];
      }
    } catch {
      logger.warn('Could not fetch model metadata', { version, metadataUrl });
    }

    return { modelData, metadata };
  }

  /**
   * List all model versions
   */
  async listModels(): Promise<ModelVersion[]> {
    const dbModels = await db
      .select()
      .from(trainedModels)
      .where(eq(trainedModels.status, 'ready'))
      .orderBy(trainedModels.updatedAt);

    const models: ModelVersion[] = [];

    for (const model of dbModels) {
      const metadata: ModelVersion['metadata'] = {
        accuracy: model.accuracy ?? undefined,
        avgReward: model.avgReward ?? undefined,
        baseModel: model.baseModel,
      };

      // Extract CID
      const cidMatch = model.storagePath.match(
        /\/ipfs\/([^/]+)|arweave\.net\/([^/]+)/
      );
      const cid = cidMatch?.[1] || cidMatch?.[2] || '';

      models.push({
        version: model.version,
        baseModel: model.baseModel,
        blobUrl: model.storagePath,
        cid,
        arweaveUrl: model.storagePath.includes('arweave.net')
          ? model.storagePath
          : undefined,
        size: 0,
        uploadedAt: model.updatedAt,
        metadata,
        provider: 'jeju',
      });
    }

    return models.sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
  }

  /**
   * Delete model version
   * Note: IPFS content can be unpinned, Arweave content is permanent
   */
  async deleteModel(version: string): Promise<void> {
    const storage = await getStorage();

    const modelResult = await db
      .select({ storagePath: trainedModels.storagePath })
      .from(trainedModels)
      .where(eq(trainedModels.version, version))
      .limit(1);

    const model = modelResult[0];

    if (model) {
      // Arweave content is permanent
      if (model.storagePath.includes('arweave.net')) {
        logger.info('Model on Arweave is permanent - archiving in DB only', {
          version,
        });
      } else {
        // IPFS content can be unpinned
        try {
          const cidMatch = model.storagePath.match(/\/ipfs\/([^/]+)/);
          if (cidMatch?.[1]) {
            await storage.delete(cidMatch[1]);
            logger.info('Model unpinned from IPFS', {
              version,
              cid: cidMatch[1],
            });
          }
        } catch (error) {
          logger.warn('Could not unpin model from IPFS', { version, error });
        }
      }
    }

    // Archive in database
    await db
      .update(trainedModels)
      .set({
        status: 'archived',
        archivedAt: new Date(),
      })
      .where(eq(trainedModels.version, version));

    logger.info('Model archived', { version });
  }

  /**
   * Get latest model version
   */
  async getLatestVersion(): Promise<ModelVersion | null> {
    const models = await this.listModels();
    return models[0] ?? null;
  }

  /**
   * Get storage provider (always 'jeju')
   */
  getStorageProvider(): 'jeju' {
    return 'jeju';
  }
}

// Singleton
export const modelStorage = new ModelStorageService();
