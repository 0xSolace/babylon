/**
 * Farcaster Sync Service for Babylon
 *
 * Syncs Farcaster social graph data to Babylon's database,
 * enabling decentralized social features while maintaining
 * fast local queries.
 */

import type { FarcasterCast, FarcasterProfile } from '../types';
import { FarcasterHubClient } from './hub-client';

interface SyncOptions {
  /** Farcaster Hub URL */
  hubUrl: string;
  /** Interval between sync runs (ms) */
  syncInterval?: number;
  /** Maximum casts to fetch per user */
  maxCastsPerUser?: number;
}

interface SyncResult {
  profilesSynced: number;
  castsSynced: number;
  errors: string[];
  duration: number;
}

type ProfileUpdateCallback = (profile: FarcasterProfile) => Promise<void>;
type CastUpdateCallback = (cast: FarcasterCast, fid: number) => Promise<void>;

/**
 * Service for syncing Farcaster data to Babylon
 *
 * Features:
 * - Profile sync for registered users
 * - Cast sync for followed users
 * - Incremental updates
 * - Background polling
 */
export class FarcasterSyncService {
  private hubClient: FarcasterHubClient;
  private options: Required<SyncOptions>;
  private syncTimer?: ReturnType<typeof setInterval>;
  private isRunning = false;

  // Callbacks for database updates
  private onProfileUpdate?: ProfileUpdateCallback;
  private onCastUpdate?: CastUpdateCallback;

  constructor(options: SyncOptions) {
    this.options = {
      syncInterval: 60000, // 1 minute
      maxCastsPerUser: 50,
      ...options,
    };
    this.hubClient = new FarcasterHubClient(options.hubUrl);
  }

  /**
   * Set callback for profile updates
   */
  setProfileUpdateCallback(callback: ProfileUpdateCallback): void {
    this.onProfileUpdate = callback;
  }

  /**
   * Set callback for cast updates
   */
  setCastUpdateCallback(callback: CastUpdateCallback): void {
    this.onCastUpdate = callback;
  }

  /**
   * Sync a single user's profile by FID
   */
  async syncProfile(fid: number): Promise<FarcasterProfile | null> {
    const profile = await this.hubClient.getProfileByFid(fid);

    if (profile && this.onProfileUpdate) {
      await this.onProfileUpdate(profile);
    }

    return profile;
  }

  /**
   * Sync casts for a user
   */
  async syncCasts(fid: number): Promise<FarcasterCast[]> {
    const { casts } = await this.hubClient.getCastsByFid(fid, {
      limit: this.options.maxCastsPerUser,
    });

    if (this.onCastUpdate) {
      for (const cast of casts) {
        await this.onCastUpdate(cast, fid);
      }
    }

    return casts;
  }

  /**
   * Sync profiles and casts for multiple FIDs
   */
  async syncBatch(fids: number[]): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let profilesSynced = 0;
    let castsSynced = 0;

    for (const fid of fids) {
      // Sync profile
      const profile = await this.syncProfile(fid);
      if (profile) {
        profilesSynced++;
      } else {
        errors.push(`Failed to sync profile for FID ${fid}`);
      }

      // Sync casts
      const casts = await this.syncCasts(fid);
      castsSynced += casts.length;

      // Rate limiting - avoid hammering the hub
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      profilesSynced,
      castsSynced,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Start background sync
   */
  start(fidsToSync: () => Promise<number[]>): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const runSync = async () => {
      const fids = await fidsToSync();
      if (fids.length > 0) {
        await this.syncBatch(fids);
      }
    };

    // Run immediately
    runSync();

    // Then run on interval
    this.syncTimer = setInterval(runSync, this.options.syncInterval);
  }

  /**
   * Stop background sync
   */
  stop(): void {
    this.isRunning = false;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Get hub client for direct queries
   */
  getHubClient(): FarcasterHubClient {
    return this.hubClient;
  }

  /**
   * Clean up resources
   */
  close(): void {
    this.stop();
    this.hubClient.close();
  }
}

/**
 * Factory function to create sync service
 */
export function createFarcasterSyncService(
  options: SyncOptions
): FarcasterSyncService {
  return new FarcasterSyncService(options);
}
