/**
 * Training Data Archiver
 *
 * Archives training data (exported trajectories, RULER scores) using
 * Jeju's decentralized storage (IPFS/Arweave).
 * NO FALLBACKS - Jeju Storage is required.
 *
 * Training data is stored permanently on Arweave for reproducibility and auditability.
 */

import type { JsonValue } from '@babylon/shared';
import fs from 'fs/promises';
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
  ) => Promise<{ url: string; cid: string; size: number }>;
  download: (cid: string) => Promise<Buffer>;
  downloadJson: <T>(cid: string) => Promise<T>;
  delete: (key: string) => Promise<void>;
  list: (prefix?: string) => Promise<
    Array<{
      key: string;
      cid: string;
      size: number;
      permanent?: boolean;
    }>
  >;
  isInitialized: () => boolean;
}

export interface ArchivedWindow {
  windowId: string;
  trajectoryCount: number;
  urls: {
    trajectories: string;
    groups?: string;
    rulerScores?: string;
    metadata: string;
  };
  cids: {
    trajectories: string;
    groups?: string;
    rulerScores?: string;
    metadata: string;
  };
  archivedAt: Date;
  size: number;
  permanent: boolean;
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
// Training Data Archiver
// ============================================================================

export class TrainingDataArchiver {
  private readonly prefix = 'training-data/';

  /**
   * Archive training data for a window
   */
  async archiveWindow(options: {
    windowId: string;
    trajectoriesPath: string;
    groupsPath?: string;
    rulerScoresPath?: string;
    metadata?: Record<string, unknown>;
    permanent?: boolean;
  }): Promise<ArchivedWindow> {
    const storage = await getStorage();
    const folder = `${this.prefix}${options.windowId}`;
    const permanent = options.permanent ?? true;

    logger.info('Archiving training data to Jeju Storage', {
      windowId: options.windowId,
      permanent,
    });

    const urls: ArchivedWindow['urls'] = { trajectories: '', metadata: '' };
    const cids: ArchivedWindow['cids'] = { trajectories: '', metadata: '' };
    let totalSize = 0;

    // Upload trajectories
    const trajData = await fs.readFile(options.trajectoriesPath);
    const trajResult = await storage.upload(
      `${folder}/trajectories.jsonl`,
      trajData.toString('utf-8'),
      {
        contentType: 'application/jsonl',
        permanent,
        metadata: { type: 'trajectories', windowId: options.windowId },
      }
    );
    urls.trajectories = trajResult.url;
    cids.trajectories = trajResult.cid;
    totalSize += trajData.length;

    // Upload groups if provided
    if (options.groupsPath) {
      const groupsData = await fs.readFile(options.groupsPath);
      const groupsResult = await storage.upload(
        `${folder}/groups.jsonl`,
        groupsData.toString('utf-8'),
        {
          contentType: 'application/jsonl',
          permanent,
          metadata: { type: 'groups', windowId: options.windowId },
        }
      );
      urls.groups = groupsResult.url;
      cids.groups = groupsResult.cid;
      totalSize += groupsData.length;
    }

    // Upload RULER scores if provided
    if (options.rulerScoresPath) {
      const scoresData = await fs.readFile(options.rulerScoresPath);
      const scoresResult = await storage.upload(
        `${folder}/ruler_scores.json`,
        scoresData.toString('utf-8'),
        {
          contentType: 'application/json',
          permanent,
          metadata: { type: 'ruler_scores', windowId: options.windowId },
        }
      );
      urls.rulerScores = scoresResult.url;
      cids.rulerScores = scoresResult.cid;
      totalSize += scoresData.length;
    }

    // Upload metadata
    const metadataResult = await storage.uploadJson(
      `${folder}/metadata.json`,
      {
        ...options.metadata,
        archivedAt: new Date().toISOString(),
        permanent,
      },
      { permanent }
    );
    urls.metadata = metadataResult.url;
    cids.metadata = metadataResult.cid;
    totalSize += metadataResult.size;

    logger.info('Training data archived to Jeju Storage', {
      windowId: options.windowId,
      size: totalSize,
      permanent,
      cids,
    });

    return {
      windowId: options.windowId,
      trajectoryCount: (options.metadata?.trajectoryCount as number) ?? 0,
      urls,
      cids,
      archivedAt: new Date(),
      size: totalSize,
      permanent,
    };
  }

  /**
   * Retrieve archived training data
   */
  async getWindowData(windowId: string): Promise<{
    trajectories: string;
    groups?: string;
    rulerScores?: Record<string, JsonValue>;
    metadata: Record<string, JsonValue>;
  } | null> {
    const storage = await getStorage();
    const folder = `${this.prefix}${windowId}`;

    const files = await storage.list(folder);
    if (files.length === 0) {
      return null;
    }

    interface WindowData {
      trajectories?: string;
      groups?: string;
      rulerScores?: Record<string, JsonValue>;
      metadata?: Record<string, JsonValue>;
    }
    const result: WindowData = {};

    for (const file of files) {
      const filename = file.key.split('/').pop();
      if (filename === 'trajectories.jsonl') {
        const data = await storage.download(file.cid);
        result.trajectories = data.toString('utf-8');
      } else if (filename === 'groups.jsonl') {
        const data = await storage.download(file.cid);
        result.groups = data.toString('utf-8');
      } else if (filename === 'ruler_scores.json') {
        result.rulerScores = await storage.downloadJson(file.cid);
      } else if (filename === 'metadata.json') {
        result.metadata = await storage.downloadJson(file.cid);
      }
    }

    if (!result.trajectories || !result.metadata) {
      return null;
    }

    return {
      trajectories: result.trajectories,
      groups: result.groups,
      rulerScores: result.rulerScores,
      metadata: result.metadata,
    };
  }

  /**
   * List all archived windows
   */
  async listWindows(): Promise<string[]> {
    const storage = await getStorage();
    const files = await storage.list(this.prefix);

    const windows = new Set<string>();
    for (const file of files) {
      const match = file.key.match(/training-data\/([^/]+)/);
      if (match?.[1]) {
        windows.add(match[1]);
      }
    }

    return Array.from(windows).sort().reverse();
  }

  /**
   * Delete archived window
   * Note: Arweave content is permanent and cannot be deleted (only IPFS can be unpinned)
   */
  async deleteWindow(windowId: string): Promise<void> {
    const storage = await getStorage();
    const folder = `${this.prefix}${windowId}`;

    const files = await storage.list(folder);
    for (const file of files) {
      if (!file.permanent) {
        await storage.delete(file.cid);
      }
    }

    logger.info('Training data archived window deleted/unpinned', { windowId });
  }
}

// Singleton
export const trainingDataArchiver = new TrainingDataArchiver();
