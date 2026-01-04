/**
 * Farcaster Service
 *
 * Integrates real Farcaster Hub for decentralized social feed.
 * - Reads casts from Farcaster Hubs
 * - Posts casts via FarcasterPoster
 * - Syncs Farcaster profiles with local users
 */

import { db, eq, posts, users } from '@babylon/db'
import { logger } from '@babylon/shared'
import {
  type FarcasterCast,
  FarcasterClient,
  FarcasterPoster,
  type FarcasterProfile,
  type HubConfig,
} from '@jejunetwork/messaging'
import { generateSnowflakeId } from '@jejunetwork/shared'
import type { Address, Hex } from 'viem'

// Hub configuration from environment
const FARCASTER_HUB_URL =
  process.env.FARCASTER_HUB_URL ?? 'https://nemes.farcaster.xyz:2281'

// Service instance
let farcasterClient: FarcasterClient | null = null

// Store signer keys in memory (in production, use KMS)
const signerKeyCache = new Map<string, Uint8Array>()

// Store FID to poster mapping
const posterCache = new Map<number, FarcasterPoster>()

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: Hex): Uint8Array {
  const hexStr = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(hexStr.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Initialize Farcaster client
 */
export function getFarcasterClient(): FarcasterClient {
  if (!farcasterClient) {
    const config: Partial<HubConfig> = {
      hubUrl: FARCASTER_HUB_URL,
      timeoutMs: 15000,
    }
    farcasterClient = new FarcasterClient(config)
    logger.info(
      'Farcaster client initialized',
      { hubUrl: FARCASTER_HUB_URL },
      'FarcasterService',
    )
  }
  return farcasterClient
}

/**
 * Store signer key for a user (in production, use KMS)
 */
export function storeSignerKey(userId: string, signerKey: Hex): void {
  signerKeyCache.set(userId, hexToBytes(signerKey))
}

/**
 * Get signer key for a user
 */
export function getSignerKey(userId: string): Uint8Array | undefined {
  return signerKeyCache.get(userId)
}

/**
 * Fetch Farcaster profile by FID
 * THROWS on network/hub errors
 */
export async function getFarcasterProfile(
  fid: number,
): Promise<FarcasterProfile> {
  const client = getFarcasterClient()
  return client.getProfile(fid)
}

/**
 * Fetch Farcaster profile by username
 * THROWS on network errors, returns null if not found
 */
export async function getFarcasterProfileByUsername(
  username: string,
): Promise<FarcasterProfile | null> {
  const client = getFarcasterClient()
  return client.getProfileByUsername(username)
}

/**
 * Fetch Farcaster profile by verified wallet address
 * THROWS on network errors, returns null if not found
 */
export async function getFarcasterProfileByAddress(
  address: Address,
): Promise<FarcasterProfile | null> {
  const client = getFarcasterClient()
  return client.getProfileByVerifiedAddress(address)
}

/**
 * Fetch casts from Farcaster for feed
 * Returns casts from followed users or from a specific channel
 * THROWS if no fid or channel provided, or on network errors
 */
export async function fetchFarcasterFeed(options: {
  fid?: number
  channelUrl?: string
  pageSize?: number
  pageToken?: string
}): Promise<{
  casts: FarcasterCast[]
  nextPageToken?: string
}> {
  const client = getFarcasterClient()

  if (options.channelUrl) {
    // Fetch casts from channel
    const result = await client.getCastsByChannel(options.channelUrl, {
      pageSize: options.pageSize ?? 20,
      pageToken: options.pageToken,
    })
    return {
      casts: result.messages,
      nextPageToken: result.nextPageToken,
    }
  }

  if (options.fid) {
    // Fetch casts by FID
    const result = await client.getCastsByFid(options.fid, {
      pageSize: options.pageSize ?? 20,
      pageToken: options.pageToken,
      reverse: true, // Most recent first
    })
    return {
      casts: result.messages,
      nextPageToken: result.nextPageToken,
    }
  }

  // No fid or channel - cannot fetch
  throw new Error('Must provide either fid or channelUrl to fetch feed')
}

/**
 * Get or create a poster for a user's FID
 */
function getOrCreatePoster(
  fid: number,
  signerPrivateKey: Uint8Array,
): FarcasterPoster {
  const existing = posterCache.get(fid)
  if (existing) {
    return existing
  }

  const poster = new FarcasterPoster({
    fid,
    signerPrivateKey,
    hubUrl: FARCASTER_HUB_URL,
  })

  posterCache.set(fid, poster)
  return poster
}

/**
 * Post a cast to Farcaster
 * THROWS on failure
 */
export async function postToFarcaster(
  userId: string,
  content: string,
  options?: {
    replyToHash?: Hex
    replyToFid?: number
    embeds?: string[]
    channelUrl?: string
  },
): Promise<{ hash: Hex }> {
  // Get user's Farcaster FID
  const [userData] = await db
    .select({
      farcasterFid: users.farcasterFid,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userData?.farcasterFid) {
    throw new Error('User has no Farcaster account linked')
  }

  // Get signer key from cache (in production, use KMS)
  const signerKey = getSignerKey(userId)
  if (!signerKey) {
    throw new Error('User has no Farcaster signer key registered')
  }

  const fid = Number(userData.farcasterFid)

  // Create poster for this user
  const poster = getOrCreatePoster(fid, signerKey)

  // Build cast options
  const castOptions = options?.embeds?.length
    ? { embeds: options.embeds }
    : undefined

  let result: { hash: Hex }

  if (options?.replyToHash && options.replyToFid) {
    // Post as reply
    result = await poster.reply(
      content,
      { fid: options.replyToFid, hash: options.replyToHash },
      castOptions,
    )
  } else if (options?.channelUrl) {
    // Post to channel
    result = await poster.castToChannel(
      content,
      options.channelUrl,
      castOptions,
    )
  } else {
    // Regular cast
    result = await poster.cast(content, castOptions)
  }

  logger.info(
    'Posted to Farcaster',
    { userId, fid, hash: result.hash },
    'FarcasterService',
  )

  return { hash: result.hash }
}

/**
 * Convert Farcaster cast to feed post format
 * Note: likeCount and recastCount require additional API calls per cast
 * and are intentionally omitted to avoid N+1 query issues
 */
export interface FarcasterFeedPost {
  id: string
  content: string
  authorId: string
  authorName: string
  authorUsername: string
  authorProfileImageUrl: string
  timestamp: string
  farcasterHash: Hex
  farcasterFid: number
  isFromFarcaster: true
}

/**
 * Fetch Farcaster casts and convert to feed format
 * THROWS on network errors
 */
export async function fetchFarcasterFeedPosts(options: {
  fids?: number[]
  channelUrl?: string
  pageSize?: number
  pageToken?: string
}): Promise<{
  posts: FarcasterFeedPost[]
  nextPageToken?: string
}> {
  const client = getFarcasterClient()
  const feedPosts: FarcasterFeedPost[] = []

  let casts: FarcasterCast[] = []
  let nextPageToken: string | undefined

  if (options.channelUrl) {
    const result = await client.getCastsByChannel(options.channelUrl, {
      pageSize: options.pageSize ?? 20,
      pageToken: options.pageToken,
    })
    casts = result.messages
    nextPageToken = result.nextPageToken
  } else if (options.fids && options.fids.length > 0) {
    // Fetch from multiple FIDs
    for (const fid of options.fids.slice(0, 10)) {
      // Limit to 10 FIDs
      const result = await client.getCastsByFid(fid, {
        pageSize: Math.floor((options.pageSize ?? 20) / options.fids.length),
        reverse: true,
      })
      casts.push(...result.messages)
    }
    // Sort by timestamp
    casts.sort((a, b) => b.timestamp - a.timestamp)
  } else {
    throw new Error(
      'Must provide either fids or channelUrl to fetch feed posts',
    )
  }

  // Convert to feed format with author profiles
  const profileCache = new Map<number, FarcasterProfile>()

  for (const cast of casts) {
    // Get author profile (with caching)
    let profile = profileCache.get(cast.fid)
    if (!profile) {
      const fetched = await client.getProfile(cast.fid)
      profile = fetched
      profileCache.set(cast.fid, profile)
    }

    feedPosts.push({
      id: `fc-${cast.hash}`,
      content: cast.text,
      authorId: `fc-${cast.fid}`,
      authorName: profile.displayName || `fid:${cast.fid}`,
      authorUsername: profile.username,
      authorProfileImageUrl: profile.pfpUrl,
      timestamp: new Date(cast.timestamp * 1000).toISOString(),
      farcasterHash: cast.hash,
      farcasterFid: cast.fid,
      isFromFarcaster: true,
    })
  }

  return { posts: feedPosts, nextPageToken }
}

/**
 * Sync Farcaster casts to local database
 * Runs in background to keep feed in sync
 */
export async function syncFarcasterCasts(options: {
  fids?: number[]
  channelUrl?: string
  sinceTimestamp?: number
}): Promise<{ synced: number; total: number }> {
  const client = getFarcasterClient()
  let synced = 0

  // Fetch casts to sync
  let castsToSync: FarcasterCast[] = []
  if (options.channelUrl) {
    const result = await client.getCastsByChannel(options.channelUrl, {
      pageSize: 100,
    })
    castsToSync = result.messages
  } else if (options.fids?.length) {
    for (const fid of options.fids) {
      const result = await client.getCastsByFid(fid, { pageSize: 50 })
      castsToSync.push(...result.messages)
    }
  } else {
    throw new Error('Must provide either fids or channelUrl to sync')
  }

  // Filter by timestamp
  if (options.sinceTimestamp) {
    const sinceTs = options.sinceTimestamp
    castsToSync = castsToSync.filter((c) => c.timestamp > sinceTs)
  }

  // Sync each cast
  for (const cast of castsToSync) {
    const [localUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.farcasterFid, String(cast.fid)))
      .limit(1)

    if (!localUser?.id) continue

    // Check if already synced
    const existing = await db
      .select({ metadata: posts.metadata })
      .from(posts)
      .where(eq(posts.authorId, localUser.id))
      .limit(1000)

    const exists = existing.some((p) => {
      const meta = p.metadata as { farcasterHash?: string } | null
      return meta?.farcasterHash === cast.hash
    })

    if (exists) continue

    const postId = await generateSnowflakeId()
    const timestamp = new Date(cast.timestamp * 1000)

    await db.insert(posts).values({
      id: postId,
      content: cast.text,
      authorId: localUser.id,
      type: cast.parentHash ? 'reply' : 'post',
      timestamp,
      createdAt: timestamp,
      metadata: {
        farcasterHash: cast.hash,
        farcasterFid: cast.fid,
        source: 'farcaster',
      },
    })

    synced++
  }

  logger.info(
    'Farcaster sync completed',
    { synced, total: castsToSync.length },
    'FarcasterService',
  )
  return { synced, total: castsToSync.length }
}

/**
 * Link a Farcaster account to a local user
 */
export async function linkFarcasterAccount(
  userId: string,
  fid: number,
  signerPrivateKeyHex?: Hex,
): Promise<void> {
  const client = getFarcasterClient()
  const profile = await client.getProfile(fid)

  // Update user with Farcaster data
  await db
    .update(users)
    .set({
      farcasterFid: String(fid),
      farcasterUsername: profile.username,
      farcasterDisplayName: profile.displayName,
      farcasterPfpUrl: profile.pfpUrl,
      hasFarcaster: true,
      farcasterVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))

  // Store signer key if provided
  if (signerPrivateKeyHex) {
    storeSignerKey(userId, signerPrivateKeyHex)
  }

  logger.info(
    'Linked Farcaster account',
    { userId, fid, username: profile.username },
    'FarcasterService',
  )
}

/**
 * Get FIDs of users the given user follows on Farcaster
 * THROWS on network errors
 */
export async function getFollowingFids(fid: number): Promise<number[]> {
  const client = getFarcasterClient()
  const result = await client.getLinksByFid(fid)
  return result.messages.map((link) => link.targetFid)
}

/**
 * Check Hub health
 */
export async function checkHubHealth(): Promise<{
  healthy: boolean
  hubUrl: string
  isSyncing: boolean
  version: string
}> {
  const client = getFarcasterClient()
  const info = await client.getHubInfo()

  return {
    healthy: true,
    hubUrl: FARCASTER_HUB_URL,
    isSyncing: info.isSyncing,
    version: info.version,
  }
}
