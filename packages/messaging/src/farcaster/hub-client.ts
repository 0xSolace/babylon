/**
 * Farcaster Hub Client for syncing public social data
 *
 * Connects to Farcaster Hub (Hubble) to fetch:
 * - User profiles (FID, username, bio, etc.)
 * - Casts (public posts)
 * - Reactions (likes, recasts)
 * - Links (follows)
 * - Verified addresses
 */

import {
  getSSLHubRpcClient,
  type HubRpcClient,
  type UserDataType,
} from '@farcaster/hub-nodejs';
import type { Address } from 'viem';
import type { FarcasterCast, FarcasterProfile } from '../types';

const USER_DATA_TYPES = {
  PFP: 1,
  DISPLAY: 2,
  BIO: 3,
  URL: 5,
  USERNAME: 6,
} as const;

/**
 * Farcaster Hub client for Babylon
 *
 * Features:
 * - Profile fetching by FID or address
 * - Cast fetching and streaming
 * - Verified address resolution
 * - Following/follower queries
 */
export class FarcasterHubClient {
  private client: HubRpcClient;

  constructor(hubUrl: string) {
    this.client = getSSLHubRpcClient(hubUrl);
  }

  /**
   * Get user profile by FID
   */
  async getProfileByFid(fid: number): Promise<FarcasterProfile | null> {
    const userData: Partial<Record<number, string>> = {};

    // Fetch all user data types
    for (const [_key, type] of Object.entries(USER_DATA_TYPES)) {
      const result = await this.client.getUserData({
        fid,
        userDataType: type as UserDataType,
      });

      if (result.isOk()) {
        const value = result.value.data?.userDataBody?.value;
        if (value) {
          userData[type] = value;
        }
      }
    }

    // Get verified addresses
    const verifications = await this.client.getVerificationsByFid({ fid });
    const verifiedAddresses: Address[] = [];

    if (verifications.isOk()) {
      for (const msg of verifications.value.messages) {
        const address = msg.data?.verificationAddAddressBody?.address;
        if (address) {
          verifiedAddresses.push(
            ('0x' + Buffer.from(address).toString('hex')) as Address
          );
        }
      }
    }

    // Get follower/following counts
    const [followersResult, followingResult] = await Promise.all([
      this.client.getLinksByTarget({ targetFid: fid }),
      this.client.getLinksByFid({ fid }),
    ]);

    return {
      fid,
      username: userData[USER_DATA_TYPES.USERNAME] ?? '',
      displayName: userData[USER_DATA_TYPES.DISPLAY] ?? '',
      bio: userData[USER_DATA_TYPES.BIO] ?? '',
      pfpUrl: userData[USER_DATA_TYPES.PFP] ?? '',
      followerCount: followersResult.isOk()
        ? followersResult.value.messages.length
        : 0,
      followingCount: followingResult.isOk()
        ? followingResult.value.messages.length
        : 0,
      verifiedAddresses,
    };
  }

  /**
   * Get FID by verified Ethereum address
   */
  async getFidByAddress(address: Address): Promise<number | null> {
    // Need to search through verifications - this is expensive
    // In production, use an indexer like Neynar

    const addressBytes = Buffer.from(address.slice(2), 'hex');

    // This is a simplified approach - in production use an indexer
    const result = await this.client.getIdRegistryOnChainEventByAddress({
      address: addressBytes,
    });

    if (result.isOk() && result.value.fid) {
      return result.value.fid;
    }

    return null;
  }

  /**
   * Get user's casts
   */
  async getCastsByFid(
    fid: number,
    options: { limit?: number; cursor?: Uint8Array } = {}
  ): Promise<{ casts: FarcasterCast[]; nextCursor?: Uint8Array }> {
    const result = await this.client.getCastsByFid({
      fid,
      pageSize: options.limit ?? 25,
      pageToken: options.cursor,
    });

    if (result.isErr()) {
      return { casts: [] };
    }

    const casts: FarcasterCast[] = [];

    for (const msg of result.value.messages) {
      const castData = msg.data?.castAddBody;
      if (!castData) continue;

      // Get reactions count
      const hashBytes = msg.hash;
      const [likesResult, recastsResult] = await Promise.all([
        this.client.getReactionsByTarget({
          targetCastId: { fid, hash: hashBytes },
          reactionType: 1, // Like
        }),
        this.client.getReactionsByTarget({
          targetCastId: { fid, hash: hashBytes },
          reactionType: 2, // Recast
        }),
      ]);

      casts.push({
        hash: Buffer.from(msg.hash).toString('hex'),
        fid,
        text: castData.text,
        timestamp: new Date((msg.data?.timestamp ?? 0) * 1000),
        embeds:
          castData.embeds?.map((e: { url?: string }) => e.url ?? '') ?? [],
        mentions: [...(castData.mentions ?? [])],
        parentCastHash: castData.parentCastId?.hash
          ? Buffer.from(castData.parentCastId.hash).toString('hex')
          : undefined,
        parentUrl: castData.parentUrl ?? undefined,
        reactions: {
          likes: likesResult.isOk() ? likesResult.value.messages.length : 0,
          recasts: recastsResult.isOk()
            ? recastsResult.value.messages.length
            : 0,
        },
      });
    }

    return {
      casts,
      nextCursor: result.value.nextPageToken ?? undefined,
    };
  }

  /**
   * Get a specific cast by hash
   */
  async getCast(fid: number, hash: string): Promise<FarcasterCast | null> {
    const hashBytes = Buffer.from(hash, 'hex');

    const result = await this.client.getCast({
      fid,
      hash: hashBytes,
    });

    if (result.isErr() || !result.value.data?.castAddBody) {
      return null;
    }

    const msg = result.value;
    const castData = msg.data!.castAddBody!;

    return {
      hash,
      fid,
      text: castData.text,
      timestamp: new Date((msg.data?.timestamp ?? 0) * 1000),
      embeds: castData.embeds?.map((e: { url?: string }) => e.url ?? '') ?? [],
      mentions: [...(castData.mentions ?? [])],
      parentCastHash: castData.parentCastId?.hash
        ? Buffer.from(castData.parentCastId.hash).toString('hex')
        : undefined,
      parentUrl: castData.parentUrl ?? undefined,
      reactions: { likes: 0, recasts: 0 }, // Would need additional queries
    };
  }

  /**
   * Get users that a FID follows
   */
  async getFollowing(fid: number): Promise<number[]> {
    const result = await this.client.getLinksByFid({
      fid,
      linkType: 'follow',
    });

    if (result.isErr()) {
      return [];
    }

    return result.value.messages
      .map(
        (m: { data?: { linkBody?: { targetFid?: number } } }) =>
          m.data?.linkBody?.targetFid
      )
      .filter((fid): fid is number => fid !== undefined);
  }

  /**
   * Get users that follow a FID
   */
  async getFollowers(fid: number): Promise<number[]> {
    const result = await this.client.getLinksByTarget({
      targetFid: fid,
      linkType: 'follow',
    });

    if (result.isErr()) {
      return [];
    }

    return result.value.messages
      .map((m: { data?: { fid?: number } }) => m.data?.fid)
      .filter((fid): fid is number => fid !== undefined);
  }

  /**
   * Check if user A follows user B
   */
  async isFollowing(followerFid: number, targetFid: number): Promise<boolean> {
    const result = await this.client.getLink({
      fid: followerFid,
      targetFid,
      linkType: 'follow',
    });

    return result.isOk();
  }

  /**
   * Subscribe to new casts from a user
   */
  async subscribeToCasts(
    fid: number,
    callback: (cast: FarcasterCast) => void
  ): Promise<() => void> {
    // Note: Hub doesn't have native subscriptions
    // This is a polling-based implementation
    // In production, use Neynar webhooks or similar

    let lastHash: string | undefined;
    let running = true;

    const poll = async () => {
      while (running) {
        const { casts } = await this.getCastsByFid(fid, { limit: 10 });

        for (const cast of casts) {
          if (lastHash && cast.hash === lastHash) break;
          callback(cast);
        }

        const firstCast = casts[0];
        if (firstCast) {
          lastHash = firstCast.hash;
        }

        // Poll every 30 seconds
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    };

    poll();

    return () => {
      running = false;
    };
  }

  /**
   * Close the client connection
   */
  close(): void {
    this.client.close();
  }
}

/**
 * Factory function to create Farcaster Hub client
 */
export function createFarcasterHubClient(hubUrl: string): FarcasterHubClient {
  return new FarcasterHubClient(hubUrl);
}
