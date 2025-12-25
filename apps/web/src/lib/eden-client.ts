/**
 * API Client for Babylon
 *
 * Typed API client using fetch with proper error handling.
 * This provides a clean interface without complex Eden type constraints.
 */

import { hasStringProperty } from '@babylon/shared'
import { getApiBaseUrl } from '@/config'

interface ApiResponse<T> {
  data: T | null
  error: { message: string } | null
}

/** Check if a parsed JSON response is an error object */
function isErrorResponse(data: unknown): data is { error: string } {
  return hasStringProperty(data, 'error')
}

/**
 * Extract data from API response, throwing on error
 */
export function extractData<T>(response: ApiResponse<T>): T {
  if (response.error) {
    throw new Error(response.error.message)
  }
  if (response.data === null) {
    throw new Error('No data returned from server')
  }
  return response.data
}

/**
 * Extract data or return null on error
 */
export function extractDataOrNull<T>(response: ApiResponse<T>): T | null {
  if (response.error || response.data === null) {
    return null
  }
  return response.data
}

/**
 * Build query string from params object
 */
function buildQueryString(params?: Record<string, string | undefined>): string {
  if (!params) return ''
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.append(key, value)
    }
  }
  const str = searchParams.toString()
  return str ? `?${str}` : ''
}

/**
 * Make a typed API request
 */
async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    query?: Record<string, string | undefined>
    body?: Record<string, unknown>
    headers?: Record<string, string>
  } = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', query, body, headers: additionalHeaders } = options
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}${path}${buildQueryString(query)}`

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    },
    credentials: 'include',
  }

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body)
  }

  const response = await fetch(url, fetchOptions)
  const json: unknown = await response.json()

  if (!response.ok) {
    const errorMessage = isErrorResponse(json)
      ? json.error
      : `Request failed: ${response.status}`
    return { data: null, error: { message: errorMessage } }
  }

  // At this point, the response is successful and the caller expects T
  return { data: json as T, error: null }
}

/**
 * Make a typed API request with authorization header
 */
async function apiRequestWithAuth<T>(
  path: string,
  token: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    query?: Record<string, string | undefined>
    body?: Record<string, unknown>
  } = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', query, body } = options
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}${path}${buildQueryString(query)}`

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
  }

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body)
  }

  const response = await fetch(url, fetchOptions)
  const json: unknown = await response.json()

  if (!response.ok) {
    const errorMessage = isErrorResponse(json)
      ? json.error
      : `Request failed: ${response.status}`
    return { data: null, error: { message: errorMessage } }
  }

  // At this point, the response is successful and the caller expects T
  return { data: json as T, error: null }
}

// ============================================================================
// Feed Widget Types
// ============================================================================

export interface TrendingItem {
  id: string
  tags: string[]
  tagSlugs: string[]
  tagIds: string[]
  category: string | null
  summary: string | null
  totalPostCount: number
  rank: number
}

export interface TrendingPost {
  id: string
  content: string
  authorId: string
  authorName: string
  authorUsername: string | null
  timestamp: string
  likeCount: number
  commentCount: number
  shareCount: number
  trendingScore: number
}

export interface WidgetMarket {
  id: string
  question: string
  yesPrice: number
  noPrice: number
  volume: number
  endDate: string
  priceChange24h: number | null
  changePercent24h: number | null
}

// ============================================================================
// User Types
// ============================================================================

export interface UserProfileStats {
  followers: number
  following: number
  posts: number
  comments: number
  reactions: number
  positions: number
}

// ============================================================================
// Notification Types
// ============================================================================

export interface NotificationActor {
  id: string
  displayName: string
  username: string | null
  profileImageUrl: string | null
}

export interface Notification {
  id: string
  type: string
  actorId: string | null
  actor: NotificationActor | null
  postId: string | null
  commentId: string | null
  chatId: string | null
  groupId: string | null
  inviteId: string | null
  message: string
  read: boolean
  createdAt: string
}

export interface GroupInvite {
  inviteId: string
  groupId: string
  groupName: string
  groupDescription: string | null
  memberCount: number
  invitedAt: string
}

// ============================================================================
// Onboarding Types
// ============================================================================

export interface GeneratedProfile {
  name: string
  username: string
  bio: string
}

export interface RandomAssets {
  profilePictureIndex: number
  bannerIndex: number
}

export interface UsernameCheckResult {
  available: boolean
  suggestion?: string
}

// ============================================================================
// Leaderboard Types
// ============================================================================

export interface LeaderboardEntry {
  id: string
  rank: number
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  reputationPoints: number
  lifetimePnL: number
  virtualBalance: number
}

// ============================================================================
// Actor Types
// ============================================================================

export interface Actor {
  id: string
  name: string
  description: string | null
  profileDescription: string | null
  tier: string | null
  domain: string | null
  personality: string | null
  affiliations: string[] | null
  role: string | null
  username?: string
}

export interface Organization {
  id: string
  name: string
  description: string | null
  profileDescription: string | null
}

export interface ActorStats {
  followers: number
  following: number
  posts: number
}

// ============================================================================
// API Client - Typed endpoints matching server routes
// ============================================================================

export const api = {
  // ============================================================================
  // Feed Widgets
  // ============================================================================
  feed: {
    widgets: {
      trending: {
        get: () =>
          apiRequest<{
            success: boolean
            trending: TrendingItem[]
          }>('/api/feed/widgets/trending'),
      },
      markets: {
        get: () =>
          apiRequest<{
            success: boolean
            markets: WidgetMarket[]
          }>('/api/feed/widgets/markets'),
      },
      trendingPosts: {
        get: () =>
          apiRequest<{
            success: boolean
            posts: TrendingPost[]
          }>('/api/feed/widgets/trending-posts'),
      },
    },
  },

  // ============================================================================
  // Users
  // ============================================================================
  users: {
    me: {
      get: (query?: { ref?: string }) =>
        apiRequest<{
          authenticated: boolean
          needsOnboarding: boolean
          needsOnchain: boolean
          user: {
            id: string
            privyId: string | null
            oauth3Id: string | null
            username: string | null
            displayName: string | null
            bio: string | null
            profileImageUrl: string | null
            coverImageUrl: string | null
            walletAddress: string | null
            profileComplete: boolean
            hasUsername: boolean
            hasBio: boolean
            hasProfileImage: boolean
            onChainRegistered: boolean
            nftTokenId: string | null
            referralCode: string | null
            referredBy: string | null
            reputationPoints: number
            pointsAwardedForProfile: boolean
            pointsAwardedForFarcasterFollow: boolean
            pointsAwardedForTwitterFollow: boolean
            pointsAwardedForDiscordJoin: boolean
            hasFarcaster: boolean
            hasTwitter: boolean
            hasDiscord: boolean
            farcasterUsername: string | null
            twitterUsername: string | null
            discordUsername: string | null
            showTwitterPublic: boolean
            showFarcasterPublic: boolean
            showWalletPublic: boolean
            isAdmin: boolean
            isActor: boolean
            createdAt: string
            updatedAt: string
            stats?: UserProfileStats
          }
        }>('/api/users/me', { query }),
    },
    byId: (userId: string) => ({
      get: () =>
        apiRequest<{
          success: boolean
          user: {
            id: string
            username: string | null
            displayName: string | null
            bio: string | null
            profileImageUrl: string | null
            coverImageUrl: string | null
            isActor: boolean
            isAdmin: boolean
            twitterUsername: string | null
            farcasterUsername: string | null
            walletAddress: string | null
            createdAt: string
            stats?: UserProfileStats
          }
        }>(`/api/users/${userId}`),
      follow: {
        post: () =>
          apiRequest<{ success: boolean; message?: string }>(
            `/api/users/${userId}/follow`,
            { method: 'POST' },
          ),
        delete: () =>
          apiRequest<{ success: boolean }>(`/api/users/${userId}/follow`, {
            method: 'DELETE',
          }),
      },
      balance: {
        get: () =>
          apiRequest<{
            balance: number
            totalDeposited: number
            totalWithdrawn: number
            lifetimePnL: number
          }>(`/api/users/${encodeURIComponent(userId)}/balance`),
      },
      profile: {
        get: (headers?: Record<string, string>) =>
          apiRequest<{
            needsOnboarding?: boolean
            user?: {
              id: string
              username: string | null
              displayName: string | null
              bio: string | null
              profileImageUrl: string | null
              coverImageUrl: string | null
              isActor: boolean
              isAdmin: boolean
              virtualBalance: number
              reputationPoints: number
              lifetimePnL: number
              twitterUsername: string | null
              farcasterUsername: string | null
              walletAddress: string | null
              onChainRegistered: boolean
              nftTokenId: string | null
              createdAt: string
              stats?: {
                followers: number
                following: number
                posts: number
                comments: number
                reactions: number
                positions: number
              }
            }
          }>(`/api/users/${encodeURIComponent(userId)}/profile`, { headers }),
      },
    }),
    byUsername: (username: string) => ({
      get: () =>
        apiRequest<{
          success: boolean
          user: {
            id: string
            username: string | null
            displayName: string | null
            bio: string | null
            profileImageUrl: string | null
            coverImageUrl: string | null
            isActor: boolean
            isAdmin: boolean
            twitterUsername: string | null
            farcasterUsername: string | null
            walletAddress: string | null
            createdAt: string
            stats?: UserProfileStats
          }
        }>(`/api/users/by-username/${username}`),
    }),
  },

  // ============================================================================
  // Posts
  // ============================================================================
  posts: {
    get: (query?: {
      cursor?: string
      limit?: string
      filter?: string
      userId?: string
      type?: string
      actorId?: string
    }) =>
      apiRequest<{
        success: boolean
        posts: Array<{
          id: string
          content: string
          authorId: string
          type: string
          timestamp: string
          imageUrl: string | null
          articleTitle: string | null
          byline: string | null
          biasScore: number | null
          slant: string | null
          sentiment: string | null
          category: string | null
          commentOnPostId: string | null
          originalPostId: string | null
          likeCount: number
          commentCount: number
          shareCount: number
          isLiked: boolean
          isShared: boolean
          isRepost: boolean
          isQuote: boolean
          quoteComment: string | null
          authorName?: string
          authorUsername?: string | null
          authorProfileImageUrl?: string | null
          originalPost?: {
            id: string
            content: string
            authorId: string
            authorName: string
            authorUsername: string | null
            authorProfileImageUrl: string | null
            timestamp: string
          } | null
        }>
        nextCursor: string | null
        hasMore: boolean
      }>('/api/posts', { query }),

    post: (body: {
      content: string
      mediaUrls?: string[]
      replyTo?: string
      quotedPostId?: string
    }) =>
      apiRequest<{
        success: boolean
        post: {
          id: string
          content: string
          authorId: string
          type: string
          timestamp: string
          imageUrl: string | null
          articleTitle: string | null
          commentOnPostId: string | null
          originalPostId: string | null
        }
      }>('/api/posts', { method: 'POST', body }),

    byId: (id: string) => ({
      get: () =>
        apiRequest<{
          success: boolean
          post: {
            id: string
            content: string
            authorId: string
            type: string
            timestamp: string
            imageUrl: string | null
            articleTitle: string | null
            commentOnPostId: string | null
            originalPostId: string | null
            likeCount: number
            isLiked: boolean
            comments: Array<{
              id: string
              content: string
              postId: string
              authorId: string
              parentCommentId: string | null
              createdAt: string
              updatedAt: string
              deletedAt: string | null
            }>
          }
        }>(`/api/posts/${id}`),

      delete: () =>
        apiRequest<{ success: boolean }>(`/api/posts/${id}`, {
          method: 'DELETE',
        }),

      like: {
        post: () =>
          apiRequest<{ success: boolean; message?: string }>(
            `/api/posts/${id}/like`,
            { method: 'POST' },
          ),
        delete: () =>
          apiRequest<{ success: boolean }>(`/api/posts/${id}/like`, {
            method: 'DELETE',
          }),
      },

      repost: {
        post: () =>
          apiRequest<{ success: boolean; message?: string }>(
            `/api/posts/${id}/repost`,
            { method: 'POST' },
          ),
      },

      comment: {
        post: (body: { content: string; parentCommentId?: string }) =>
          apiRequest<{
            success: boolean
            comment: {
              id: string
              content: string
              postId: string
              authorId: string
              parentCommentId: string | null
              createdAt: string
              updatedAt: string
            }
          }>(`/api/posts/${id}/comment`, { method: 'POST', body }),
      },
    }),
  },

  // ============================================================================
  // Markets
  // ============================================================================
  markets: {
    positions: {
      byUserId: (userId: string) => ({
        get: (query?: { status?: string }, headers?: Record<string, string>) =>
          apiRequest<{
            perpetuals: {
              positions: Array<{
                id: string
                ticker: string
                side: 'LONG' | 'SHORT'
                entryPrice: number
                currentPrice: number
                size: number
                leverage: number
                unrealizedPnL: number
                unrealizedPnLPercent: number
                liquidationPrice: number
                fundingPaid: number
                openedAt: string
              }>
              stats: {
                totalPositions: number
                totalPnL: number
                totalFunding: number
              }
            }
            predictions: {
              positions: Array<{
                id: string
                marketId: string
                side: 'YES' | 'NO'
                shares: number
                avgPrice: number
                currentPrice: number
                costBasis: number
                currentValue: number
                unrealizedPnL: number
                resolved: boolean
                question: string
                Market: {
                  id: string
                  question: string
                  yesShares: number
                  noShares: number
                  resolved: boolean
                  resolution: boolean | null
                }
              }>
              stats: {
                totalPositions: number
              }
            }
          }>(`/api/markets/positions/${encodeURIComponent(userId)}`, {
            query,
            headers,
          }),
      }),
    },
  },

  // ============================================================================
  // Notifications
  // ============================================================================
  notifications: {
    get: (query?: { limit?: string }, token?: string) =>
      token
        ? apiRequestWithAuth<{
            notifications: Notification[]
            unreadCount: number
          }>('/api/notifications', token, { query })
        : apiRequest<{
            notifications: Notification[]
            unreadCount: number
          }>('/api/notifications', { query }),
    markRead: {
      patch: (body: { notificationIds: string[] }, token: string) =>
        apiRequestWithAuth<{ success: boolean }>('/api/notifications', token, {
          method: 'PATCH',
          body,
        }),
    },
  },

  // ============================================================================
  // Group Invites
  // ============================================================================
  groups: {
    invites: {
      get: (token: string) =>
        apiRequestWithAuth<{
          invites: GroupInvite[]
        }>('/api/groups/invites', token),
    },
  },

  // ============================================================================
  // Leaderboard
  // ============================================================================
  leaderboard: {
    get: (
      query?: { page?: string; pageSize?: string },
      headers?: Record<string, string>,
    ) =>
      apiRequest<{
        leaderboard: LeaderboardEntry[]
        pagination: {
          totalCount: number
          pageCount: number
          currentPage: number
          pageSize: number
        }
      }>('/api/leaderboard', { query, headers }),
  },

  // ============================================================================
  // Actors
  // ============================================================================
  actors: {
    get: () =>
      apiRequest<{
        actors: Actor[]
        organizations: Organization[]
      }>('/api/actors'),
    byId: (actorId: string) => ({
      stats: {
        get: () =>
          apiRequest<{
            stats: ActorStats
          }>(`/api/actors/${encodeURIComponent(actorId)}/stats`),
      },
    }),
  },

  // ============================================================================
  // Onboarding
  // ============================================================================
  onboarding: {
    generateProfile: {
      get: () =>
        apiRequest<GeneratedProfile>('/api/onboarding/generate-profile'),
    },
    randomAssets: {
      get: () => apiRequest<RandomAssets>('/api/onboarding/random-assets'),
    },
    checkUsername: (query: { username: string }) =>
      apiRequest<UsernameCheckResult>('/api/onboarding/check-username', {
        query,
      }),
  },
}

/**
 * Get the API client instance (for compatibility with existing code)
 */
export function _getApiClient() {
  return api
}
