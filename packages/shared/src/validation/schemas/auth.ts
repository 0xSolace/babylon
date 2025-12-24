/**
 * OAuth and authentication callback validation schemas
 */

import { z } from 'zod'
import { URLSchema } from './common'

/**
 * Discord OAuth callback query parameters
 * Used by: /api/auth/discord/callback
 */
export const DiscordCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
})

export type DiscordCallbackQuery = z.infer<typeof DiscordCallbackQuerySchema>

/**
 * Twitter OAuth callback query parameters
 * Used by: /api/auth/twitter/callback
 */
export const TwitterCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
})

export type TwitterCallbackQuery = z.infer<typeof TwitterCallbackQuerySchema>

/**
 * Twitter onboarding OAuth callback query parameters
 * Used by: /api/auth/onboarding/twitter/callback
 * Same structure as regular Twitter callback
 */
export const TwitterOnboardingCallbackQuerySchema = TwitterCallbackQuerySchema

export type TwitterOnboardingCallbackQuery = z.infer<
  typeof TwitterOnboardingCallbackQuerySchema
>

/**
 * Farcaster callback body schema
 * Used by: /api/auth/farcaster/callback
 */
export const FarcasterCallbackBodySchema = z.object({
  message: z.string(),
  signature: z.string(),
  fid: z.number(),
  username: z.string(),
  displayName: z.string().optional(),
  pfpUrl: URLSchema.optional(),
  state: z.string(),
})

export type FarcasterCallbackBody = z.infer<typeof FarcasterCallbackBodySchema>

/**
 * Farcaster onboarding callback body schema
 * Used by: /api/auth/onboarding/farcaster/callback
 * Extends the base Farcaster callback with bio field
 */
export const FarcasterOnboardingCallbackBodySchema = z.object({
  message: z.string(),
  signature: z.string(),
  fid: z.number(),
  username: z.string(),
  displayName: z.string().optional(),
  pfpUrl: URLSchema.optional(),
  bio: z.string().optional(),
  state: z.string(),
})

export type FarcasterOnboardingCallbackBody = z.infer<
  typeof FarcasterOnboardingCallbackBodySchema
>

/**
 * OAuth state format: "userId|timestamp|random" or "onboarding:userId:timestamp:random"
 * State verification helpers
 */
export const OAuthStateSchema = z.string().refine(
  (val) => {
    // Pipe-separated format: userId|timestamp|random
    const pipeParts = val.split('|')
    if (pipeParts.length >= 2) {
      const [userId, timestampStr] = pipeParts
      if (!userId || !timestampStr) return false
      const timestamp = Number.parseInt(timestampStr, 10)
      return !Number.isNaN(timestamp)
    }

    // Colon-separated format: onboarding:userId:timestamp:random
    const colonParts = val.split(':')
    if (colonParts.length >= 3) {
      const [prefix, userId, timestampStr] = colonParts
      if (!prefix || !userId || !timestampStr) return false
      const timestamp = Number.parseInt(timestampStr, 10)
      return !Number.isNaN(timestamp)
    }

    return false
  },
  {
    message:
      'Invalid OAuth state format. Expected "userId|timestamp|random" or "prefix:userId:timestamp:random"',
  },
)

export type OAuthState = z.infer<typeof OAuthStateSchema>

/**
 * State expiration constant (10 minutes in milliseconds)
 */
export const OAUTH_STATE_EXPIRATION_MS = 10 * 60 * 1000
