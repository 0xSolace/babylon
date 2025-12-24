/**
 * Farcaster Sign-In utilities for onboarding
 * Handles Farcaster protocol authentication flow and profile data fetching
 * Uses the proper Sign In with Farcaster (SIWF) protocol via relay.farcaster.xyz
 */

import { logger } from '../utils/logger'
import { toNull } from '../utils/nullable'
import { signInWithFarcaster } from './farcaster-auth-client'

export interface FarcasterOnboardingProfile {
  fid: number
  username: string
  displayName?: string
  pfpUrl?: string
  bio?: string
}

/**
 * Open Farcaster Sign-In popup and handle authentication
 * Uses the proper SIWF protocol via relay.farcaster.xyz
 */
export async function openFarcasterOnboardingPopup(
  userId: string,
): Promise<FarcasterOnboardingProfile> {
  const result = await signInWithFarcaster({
    userId,
    onStatusUpdate: (state) => {
      logger.debug(
        'Farcaster auth status update',
        { state },
        'FarcasterOnboarding',
      )
    },
  })

  // Call the backend to verify and store the authentication
  const response = await fetch('/api/auth/onboarding/farcaster/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: result.message,
      signature: result.signature,
      fid: result.fid,
      username: result.username,
      displayName: result.displayName,
      pfpUrl: result.pfpUrl,
      bio: result.bio,
      state: result.state,
    }),
  })

  if (!response.ok) {
    // Parse error response - may fail if response is not JSON
    let errorMessage = 'Failed to verify Farcaster authentication'
    try {
      const errorData: { error?: string } = await response.json()
      if (errorData.error) {
        errorMessage = errorData.error
      }
    } catch {
      // Response is not JSON, use default message
    }
    throw new Error(errorMessage)
  }

  return {
    fid: result.fid,
    username: result.username,
    displayName: result.displayName,
    pfpUrl: result.pfpUrl,
    bio: result.bio,
  }
}

/**
 * Alternative: Use Neynar's Farcaster auth widget (simpler integration)
 * Note: This now uses the same proper SIWF flow
 */
export async function openNeynarFarcasterAuth(
  userId: string,
): Promise<FarcasterOnboardingProfile> {
  return openFarcasterOnboardingPopup(userId)
}

/**
 * Fetch additional Farcaster profile data from Neynar API
 */
export async function fetchFarcasterProfile(
  fid: number,
): Promise<FarcasterOnboardingProfile | null> {
  const response = await fetch(`/api/farcaster/profile/${fid}`)

  if (!response.ok) {
    return null
  }

  interface ProfileResponse {
    profile?: FarcasterOnboardingProfile
  }
  const data: ProfileResponse = await response.json()
  return toNull(data.profile)
}
