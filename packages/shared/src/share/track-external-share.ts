/**
 * External Share Tracking
 *
 * @description Client-side utility for tracking external shares (Twitter, Farcaster, etc.)
 * and awarding points to users. Makes API calls to record share actions.
 */

import { toNull } from '@jejunetwork/shared'
import { logger } from '../utils/logger'

export type SharePlatform =
  | 'twitter'
  | 'farcaster'
  | 'link'
  | 'native'
  | 'download'
  | 'other'

export type ShareContentType =
  | 'post'
  | 'profile'
  | 'market'
  | 'referral'
  | 'leaderboard'

export interface TrackExternalShareOptions {
  platform: SharePlatform
  contentType: ShareContentType
  contentId?: string
  url: string
  userId?: string | null
}

export interface TrackExternalShareResult {
  shareActionId: string | null
  pointsAwarded: number
  alreadyAwarded: boolean
}

const DEFAULT_RESULT: TrackExternalShareResult = {
  shareActionId: null,
  pointsAwarded: 0,
  alreadyAwarded: false,
}

/**
 * Track an external share and award points if applicable
 *
 * @description Makes an API call to record a share action and award points.
 * Returns information about points awarded and whether the share was already tracked.
 *
 * @param {TrackExternalShareOptions} options - Share tracking options
 * @returns {Promise<TrackExternalShareResult>} Result with points awarded info
 *
 * @example
 * ```typescript
 * const result = await trackExternalShare({
 *   platform: 'twitter',
 *   contentType: 'post',
 *   contentId: '123',
 *   url: 'https://babylon.market/post/123',
 *   userId: 'user-123'
 * });
 * ```
 */
export async function trackExternalShare(
  options: TrackExternalShareOptions,
): Promise<TrackExternalShareResult> {
  const { platform, contentType, contentId, url, userId } = options

  if (!userId) {
    logger.warn(
      'Unable to track external share without authenticated user',
      { platform, contentType },
      'trackExternalShare',
    )
    return DEFAULT_RESULT
  }

  // Access OAuth3 access token from window global (set by auth layer)
  let token: string | null = null
  if (typeof window !== 'undefined') {
    const win = window as Window & { __oauth3AccessToken?: string }
    token = win.__oauth3AccessToken ?? null
  }
  if (!token) {
    logger.warn(
      'No access token available when attempting to track external share',
      { platform },
      'trackExternalShare',
    )
    return DEFAULT_RESULT
  }

  const response = await fetch(
    `/api/users/${encodeURIComponent(userId)}/share`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform,
        contentType,
        contentId,
        url,
      }),
    },
  )

  if (!response.ok) {
    // Parse error response - may fail if response is not JSON
    let errorMessage: string | undefined
    try {
      const errorPayload: { error?: string } = await response.json()
      errorMessage = errorPayload?.error
    } catch {
      // Response is not JSON, ignore
    }
    logger.warn(
      'Failed to track external share',
      { platform, status: response.status, error: errorMessage },
      'trackExternalShare',
    )
    return DEFAULT_RESULT
  }

  // Parse success response
  interface ShareResponse {
    points?: { awarded?: number; alreadyAwarded?: boolean }
    shareAction?: { id?: string }
  }
  const data: ShareResponse = await response.json()
  const pointsAwarded = Number(data?.points?.awarded ?? 0)
  const alreadyAwarded = Boolean(data?.points?.alreadyAwarded)
  const shareActionId = toNull(data?.shareAction?.id)

  if (pointsAwarded > 0) {
    logger.info(
      `Awarded ${pointsAwarded} points for ${platform} share`,
      { platform, pointsAwarded },
      'trackExternalShare',
    )
  }

  return {
    shareActionId,
    pointsAwarded,
    alreadyAwarded,
  }
}
