/**
 * Training Data Archiver
 *
 * Archives training data (exported trajectories, RULER scores) using
 * Jeju's decentralized storage (IPFS/Arweave).
 *
 * Training data is stored permanently on Arweave for reproducibility and auditability.
 */

import fs from 'node:fs/promises'
import {
  type StorageClient as BaseStorageClient,
  type FileMetadata,
  getStorage as getStorageFromApi,
  initializeStorage,
} from '@babylon/api'
import { logger } from '@babylon/shared'
import type { JsonValue } from '@jejunetwork/shared'

// Extended storage interface for training data archiver
// The base StorageClient doesn't support prefix-based listing, so we add helpers
type StorageClient = BaseStorageClient

// Helper to convert Uint8Array to string
function uint8ArrayToString(data: Uint8Array): string {
  return new TextDecoder().decode(data)
}

export interface ArchivedWindow {
  windowId: string
  trajectoryCount: number
  urls: {
    trajectories: string
    groups?: string
    rulerScores?: string
    metadata: string
  }
  cids: {
    trajectories: string
    groups?: string
    rulerScores?: string
    metadata: string
  }
  archivedAt: Date
  size: number
  permanent: boolean
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
// Training Data Archiver
// ============================================================================

export class TrainingDataArchiver {
  private readonly prefix = 'training-data/'

  /**
   * Archive training data for a window
   */
  async archiveWindow(options: {
    windowId: string
    trajectoriesPath: string
    groupsPath?: string
    rulerScoresPath?: string
    metadata?: Record<string, unknown>
    permanent?: boolean
  }): Promise<ArchivedWindow> {
    const storage = await getStorage()
    const folder = `${this.prefix}${options.windowId}`
    const permanent = options.permanent ?? true

    logger.info('Archiving training data to Jeju Storage', {
      windowId: options.windowId,
      permanent,
    })

    const urls: ArchivedWindow['urls'] = { trajectories: '', metadata: '' }
    const cids: ArchivedWindow['cids'] = { trajectories: '', metadata: '' }
    let totalSize = 0

    // Upload trajectories
    const trajData = await fs.readFile(options.trajectoriesPath)
    const trajResult = await storage.upload(trajData, {
      name: `${folder}/trajectories.jsonl`,
      mimeType: 'application/jsonl',
      metadata: { type: 'trajectories', windowId: options.windowId },
    })
    urls.trajectories = trajResult.url
    cids.trajectories = trajResult.cid
    totalSize += trajData.length

    // Upload groups if provided
    if (options.groupsPath) {
      const groupsData = await fs.readFile(options.groupsPath)
      const groupsResult = await storage.upload(groupsData, {
        name: `${folder}/groups.jsonl`,
        mimeType: 'application/jsonl',
        metadata: { type: 'groups', windowId: options.windowId },
      })
      urls.groups = groupsResult.url
      cids.groups = groupsResult.cid
      totalSize += groupsData.length
    }

    // Upload RULER scores if provided
    if (options.rulerScoresPath) {
      const scoresData = await fs.readFile(options.rulerScoresPath)
      const scoresResult = await storage.upload(scoresData, {
        name: `${folder}/ruler_scores.json`,
        mimeType: 'application/json',
        metadata: { type: 'ruler_scores', windowId: options.windowId },
      })
      urls.rulerScores = scoresResult.url
      cids.rulerScores = scoresResult.cid
      totalSize += scoresData.length
    }

    // Upload metadata
    const metadataResult = await storage.uploadJson(
      {
        ...options.metadata,
        archivedAt: new Date().toISOString(),
        permanent,
      },
      `${folder}/metadata.json`,
    )
    urls.metadata = metadataResult.url
    cids.metadata = metadataResult.cid
    totalSize += metadataResult.size

    logger.info('Training data archived to Jeju Storage', {
      windowId: options.windowId,
      size: totalSize,
      permanent,
      cids,
    })

    return {
      windowId: options.windowId,
      trajectoryCount: (options.metadata?.trajectoryCount as number) ?? 0,
      urls,
      cids,
      archivedAt: new Date(),
      size: totalSize,
      permanent,
    }
  }

  /**
   * Retrieve archived training data
   */
  async getWindowData(windowId: string): Promise<{
    trajectories: string
    groups?: string
    rulerScores?: Record<string, JsonValue>
    metadata: Record<string, JsonValue>
  } | null> {
    const storage = await getStorage()
    const folder = `${this.prefix}${windowId}`

    // List all files and filter by prefix (storage API doesn't support prefix filtering)
    const allFiles = await storage.list()
    const files = allFiles.filter((f: FileMetadata) =>
      f.name.startsWith(folder),
    )
    if (files.length === 0) {
      return null
    }

    interface WindowData {
      trajectories?: string
      groups?: string
      rulerScores?: Record<string, JsonValue>
      metadata?: Record<string, JsonValue>
    }
    const result: WindowData = {}

    for (const file of files) {
      const filename = file.name.split('/').pop()
      if (filename === 'trajectories.jsonl') {
        const data = await storage.download(file.cid)
        result.trajectories = uint8ArrayToString(data)
      } else if (filename === 'groups.jsonl') {
        const data = await storage.download(file.cid)
        result.groups = uint8ArrayToString(data)
      } else if (filename === 'ruler_scores.json') {
        result.rulerScores = await storage.downloadJson<
          Record<string, JsonValue>
        >(file.cid)
      } else if (filename === 'metadata.json') {
        result.metadata = await storage.downloadJson<Record<string, JsonValue>>(
          file.cid,
        )
      }
    }

    if (!result.trajectories || !result.metadata) {
      return null
    }

    return {
      trajectories: result.trajectories,
      groups: result.groups,
      rulerScores: result.rulerScores,
      metadata: result.metadata,
    }
  }

  /**
   * List all archived windows
   */
  async listWindows(): Promise<string[]> {
    const storage = await getStorage()
    const allFiles = await storage.list()
    const files = allFiles.filter((f: FileMetadata) =>
      f.name.startsWith(this.prefix),
    )

    const windows = new Set<string>()
    for (const file of files) {
      const match = file.name.match(/training-data\/([^/]+)/)
      if (match?.[1]) {
        windows.add(match[1])
      }
    }

    return Array.from(windows).sort().reverse()
  }

  /**
   * Delete archived window
   * Note: Arweave content is permanent and cannot be deleted (only IPFS can be unpinned)
   */
  async deleteWindow(windowId: string): Promise<void> {
    const storage = await getStorage()
    const folder = `${this.prefix}${windowId}`

    const allFiles = await storage.list()
    const files = allFiles.filter((f: FileMetadata) =>
      f.name.startsWith(folder),
    )
    for (const file of files) {
      // Delete/unpin (permanent files can't be deleted from Arweave)
      await storage.delete(file.cid)
    }

    logger.info('Training data archived window deleted/unpinned', { windowId })
  }
}

// Singleton
export const trainingDataArchiver = new TrainingDataArchiver()
