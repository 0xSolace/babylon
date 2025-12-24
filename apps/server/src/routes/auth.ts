import {
  AuthProvider,
  type DID,
  DiscordProvider,
  TwitterProvider,
} from '@babylon/auth'
import { Elysia, t } from 'elysia'
import { authRateLimiter, jwtMiddleware } from '../middleware'

/**
 * Get base URL from request headers
 */
function getBaseUrl(headers: Record<string, string | undefined>): string {
  const host = headers.host ?? 'localhost:5008'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}

/**
 * Create a DID from provider and user ID
 */
function createDID(provider: string, userId: string): DID {
  return `did:jeju:mainnet:${provider}:${userId}` as DID
}

/**
 * Default app ID for OAuth state
 */
const DEFAULT_APP_ID: `0x${string}` = '0x0'

/**
 * Auth routes
 * Migrated from: apps/web/app/api/auth/*
 *
 * Routes migrated:
 * - /api/auth/jeju/callback - OAuth callback for Twitter/Discord
 * - /api/auth/twitter/initiate - Twitter OAuth initiation
 * - /api/auth/twitter/callback - Twitter OAuth callback
 */
const createAuthRoutes = () =>
  new Elysia({ prefix: '/api/auth' })
    .use(jwtMiddleware)
    .use(authRateLimiter)

    // Jeju OAuth callback (GET)
    // Migrated from: apps/web/app/api/auth/jeju/callback/route.ts
    .get(
      '/jeju/callback',
      async ({ query, headers, set, redirect }) => {
        const {
          code,
          state,
          error,
          provider = 'twitter',
          code_verifier,
        } = query
        const baseUrl = getBaseUrl(headers)

        // Handle OAuth errors
        if (error) {
          return redirect(
            `${baseUrl}/auth/callback?error=${encodeURIComponent(`OAuth error: ${error}`)}`,
          )
        }

        if (!code) {
          return redirect(
            `${baseUrl}/auth/callback?error=${encodeURIComponent('Missing authorization code')}`,
          )
        }

        const redirectUri = `${baseUrl}/api/auth/jeju/callback?provider=${provider}`
        let userInfo: { id: string; username?: string; email?: string }

        if (provider === 'twitter') {
          const twitterClientId = process.env.TWITTER_CLIENT_ID
          const twitterClientSecret = process.env.TWITTER_CLIENT_SECRET
          if (!twitterClientId || !twitterClientSecret) {
            set.status = 500
            return { error: 'Twitter OAuth credentials not configured' }
          }

          // Twitter requires PKCE code_verifier
          if (!code_verifier) {
            return redirect(
              `${baseUrl}/auth/callback?error=${encodeURIComponent('Missing PKCE code verifier')}`,
            )
          }

          const twitter = new TwitterProvider({
            clientId: twitterClientId,
            clientSecret: twitterClientSecret,
            redirectUri,
            scopes: ['users.read', 'tweet.read'],
          })

          // Create OAuth state with the PKCE code verifier
          const oauthState = {
            state: state ?? '',
            nonce: '',
            provider: AuthProvider.TWITTER,
            appId: DEFAULT_APP_ID,
            createdAt: Date.now(),
            codeVerifier: code_verifier,
          }

          const tokens = await twitter.exchangeCode(code, oauthState)
          const profile = await twitter.getProfile(tokens)
          userInfo = { id: profile.id, username: profile.handle }
        } else if (provider === 'discord') {
          const discordClientId = process.env.DISCORD_CLIENT_ID
          const discordClientSecret = process.env.DISCORD_CLIENT_SECRET
          if (!discordClientId || !discordClientSecret) {
            set.status = 500
            return { error: 'Discord OAuth credentials not configured' }
          }

          const discord = new DiscordProvider({
            clientId: discordClientId,
            clientSecret: discordClientSecret,
            redirectUri,
            scopes: ['identify', 'email'],
          })

          const tokens = await discord.exchangeCode(code)
          const profile = await discord.getProfile(tokens)
          userInfo = {
            id: profile.id,
            username: profile.handle,
            email: profile.email,
          }
        } else {
          return redirect(
            `${baseUrl}/auth/callback?error=${encodeURIComponent('Unknown provider')}`,
          )
        }

        // Create DID from provider ID
        const did = createDID(provider, userInfo.id)

        // Redirect to the auth callback page with OAuth success info
        const callbackUrl = new URL('/auth/callback', baseUrl)
        callbackUrl.searchParams.set('success', 'true')
        callbackUrl.searchParams.set('provider', provider)
        callbackUrl.searchParams.set('userId', did)
        if (userInfo.username) {
          callbackUrl.searchParams.set('username', userInfo.username)
        }

        return redirect(callbackUrl.toString())
      },
      {
        query: t.Object({
          code: t.Optional(t.String()),
          state: t.Optional(t.String()),
          error: t.Optional(t.String()),
          provider: t.Optional(t.String()),
          code_verifier: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Auth'],
          summary: 'Jeju OAuth callback',
          description: 'Handles OAuth callbacks from Twitter, Discord, etc.',
        },
      },
    )

    // Jeju OAuth callback (POST) - client-initiated code exchange
    .post(
      '/jeju/callback',
      async ({ body, set }) => {
        if (!body.code) {
          set.status = 400
          return { error: 'Missing authorization code' }
        }

        // For client-initiated OAuth exchange, return success
        // The actual token/session management happens client-side with wallet signatures
        return {
          success: true,
          message: 'Authorization code received',
        }
      },
      {
        body: t.Object({
          code: t.String(),
          state: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Auth'],
          summary: 'Jeju OAuth code exchange',
          description: 'Handle OAuth code exchange from the client side',
        },
      },
    )

    // Twitter OAuth initiation
    .get(
      '/twitter/initiate',
      async ({ query: _query }) => {
        // TODO: Migrate from apps/web/app/api/auth/twitter/initiate/route.ts
        return {
          todo: 'Migrate Twitter OAuth initiation',
          source: 'apps/web/app/api/auth/twitter/initiate/route.ts',
        }
      },
      {
        query: t.Object({
          redirectUrl: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Auth'],
          summary: 'Initiate Twitter OAuth',
        },
      },
    )

    // Twitter OAuth callback
    .get(
      '/twitter/callback',
      async ({ query: _query }) => {
        // TODO: Migrate from apps/web/app/api/auth/twitter/callback/route.ts
        return {
          todo: 'Migrate Twitter OAuth callback',
          source: 'apps/web/app/api/auth/twitter/callback/route.ts',
        }
      },
      {
        query: t.Object({
          code: t.Optional(t.String()),
          state: t.Optional(t.String()),
          error: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Auth'],
          summary: 'Twitter OAuth callback',
        },
      },
    )

    // Onboarding Twitter initiation
    .get(
      '/onboarding/twitter/initiate',
      async ({ query: _query }) => {
        // TODO: Migrate from apps/web/app/api/auth/onboarding/twitter/initiate/route.ts
        return {
          todo: 'Migrate onboarding Twitter initiation',
          source: 'apps/web/app/api/auth/onboarding/twitter/initiate/route.ts',
        }
      },
      {
        query: t.Object({
          userId: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Auth'],
          summary: 'Initiate onboarding Twitter OAuth',
        },
      },
    )

    // Onboarding Twitter callback
    .get(
      '/onboarding/twitter/callback',
      async ({ query: _query }) => {
        // TODO: Migrate from apps/web/app/api/auth/onboarding/twitter/callback/route.ts
        return {
          todo: 'Migrate onboarding Twitter callback',
          source: 'apps/web/app/api/auth/onboarding/twitter/callback/route.ts',
        }
      },
      {
        query: t.Object({
          code: t.Optional(t.String()),
          state: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Auth'],
          summary: 'Onboarding Twitter OAuth callback',
        },
      },
    )

    // Twitter auth status
    .get(
      '/twitter/auth-status',
      async ({ headers: _headers }) => {
        // TODO: Migrate from apps/web/app/api/twitter/auth-status/route.ts
        return {
          todo: 'Migrate Twitter auth status check',
          source: 'apps/web/app/api/twitter/auth-status/route.ts',
        }
      },
      {
        detail: {
          tags: ['Auth'],
          summary: 'Check Twitter auth status',
        },
      },
    )

export const authRoutes = createAuthRoutes()
