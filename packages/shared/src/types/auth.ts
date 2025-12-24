/**
 * Authentication Types
 *
 * Shared types for OAuth3 authentication and user management
 */

/**
 * Authenticated user information
 *
 * @description Contains information about an authenticated user, including
 * user IDs, wallet address, and whether the user is an agent.
 */
export interface AuthenticatedUser {
  /** Canonical user ID (database ID if available, otherwise oauth3Id) */
  userId: string
  /** Database user ID if the user has a profile */
  dbUserId?: string
  /** OAuth3 identity ID (decentralized identity) */
  oauth3Id?: string
  /** User's wallet address */
  walletAddress?: string | null
  /** User's email if available */
  email?: string | null
  /** Whether this is an agent session */
  isAgent?: boolean
  /** Farcaster username if linked */
  farcasterUsername?: string | null
  /** Farcaster FID if linked */
  farcasterFid?: number | null
  /** Twitter username if linked */
  twitterUsername?: string | null
  /** Twitter ID if linked */
  twitterId?: string | null
  /** Discord username if linked */
  discordUsername?: string | null
}
