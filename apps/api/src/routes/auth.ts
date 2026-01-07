import { db, eq, users } from '@babylon/db'
import { logger } from '@babylon/shared'
import {
  AuthProvider,
  type DID,
  DiscordProvider,
  type OAuthState,
  TwitterProvider,
} from '@jejunetwork/auth'
import { type CacheClient, getCacheClient } from '@jejunetwork/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  authRateLimiter,
  getAuthContext,
  jwtMiddleware,
} from '../middleware'

const DEFAULT_APP_ID: `0x${string}` = '0x0'
const STATE_TTL_SECONDS = 10 * 60 // 10 minutes

interface OAuthStoredState {
  codeVerifier: string
  redirectUrl: string
  provider: string
  userId?: string // For onboarding flow
  createdAt: number
  expiresAt: number
}

// Distributed cache for OAuth state (enables multi-instance deployments)
let oauthStateCache: CacheClient | null = null

function getOAuthStateCache(): CacheClient {
  if (!oauthStateCache) {
    oauthStateCache = getCacheClient('babylon-oauth-state')
  }
  return oauthStateCache
}

function getBaseUrl(headers: Record<string, string | undefined>): string {
  const host = headers.host ?? 'localhost:5008'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}

function createDID(provider: string, userId: string): DID {
  return `did:jeju:mainnet:${provider}:${userId}` as DID
}

function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function storeOAuthState(
  redirectUrl: string,
  provider: string,
  userId?: string,
): Promise<{ state: string; codeVerifier: string }> {
  const state = crypto.randomUUID()
  const codeVerifier = generateCodeVerifier()
  const now = Date.now()
  const cache = getOAuthStateCache()

  const storedState: OAuthStoredState = {
    codeVerifier,
    redirectUrl,
    provider,
    userId,
    createdAt: now,
    expiresAt: now + STATE_TTL_SECONDS * 1000,
  }

  await cache.set(
    `oauth:${state}`,
    JSON.stringify(storedState),
    STATE_TTL_SECONDS,
  )
  return { state, codeVerifier }
}

async function getOAuthState(state: string): Promise<OAuthStoredState | null> {
  const cache = getOAuthStateCache()
  const cached = await cache.get(`oauth:${state}`)
  if (!cached) return null
  return JSON.parse(cached) as OAuthStoredState
}

async function deleteOAuthState(state: string): Promise<void> {
  const cache = getOAuthStateCache()
  await cache.delete(`oauth:${state}`)
}

async function updateOAuthState(
  state: string,
  updates: Partial<OAuthStoredState>,
): Promise<void> {
  const stored = await getOAuthState(state)
  if (!stored) return
  const cache = getOAuthStateCache()
  const updated = { ...stored, ...updates }
  // Calculate remaining TTL
  const remainingTtl = Math.max(
    1,
    Math.floor((updated.expiresAt - Date.now()) / 1000),
  )
  await cache.set(`oauth:${state}`, JSON.stringify(updated), remainingTtl)
}

function getTwitterCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.TWITTER_CLIENT_ID
  const clientSecret = process.env.TWITTER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Twitter OAuth credentials not configured')
  }
  return { clientId, clientSecret }
}

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
        const { code } = body as { code: string; state?: string }
        if (!code) {
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
      async ({ query, headers, set }) => {
        let creds: { clientId: string; clientSecret: string }
        try {
          creds = getTwitterCredentials()
        } catch (e) {
          set.status = 500
          return { error: (e as Error).message }
        }

        const baseUrl = getBaseUrl(headers)
        const callbackUrl = `${baseUrl}/api/auth/twitter/callback`
        const finalRedirectUrl = query.redirectUrl ?? `${baseUrl}/auth/callback`

        const { state, codeVerifier } = await storeOAuthState(
          finalRedirectUrl,
          'twitter',
        )

        const twitter = new TwitterProvider({
          ...creds,
          redirectUri: callbackUrl,
          scopes: ['users.read', 'tweet.read'],
        })

        const oauthState: OAuthState = {
          state,
          nonce: crypto.randomUUID(),
          provider: AuthProvider.TWITTER,
          appId: DEFAULT_APP_ID,
          createdAt: Date.now(),
          codeVerifier,
        }

        const authUrl = await twitter.getAuthorizationUrl(oauthState)

        // Update stored code verifier if modified
        if (
          oauthState.codeVerifier &&
          oauthState.codeVerifier !== codeVerifier
        ) {
          await updateOAuthState(state, {
            codeVerifier: oauthState.codeVerifier,
          })
        }

        logger.info('Twitter OAuth initiated', { state }, 'Auth')
        return { authUrl, state }
      },
      {
        query: t.Object({ redirectUrl: t.Optional(t.String()) }),
        detail: { tags: ['Auth'], summary: 'Initiate Twitter OAuth' },
      },
    )

    // Twitter OAuth callback
    .get(
      '/twitter/callback',
      async ({ query, headers, set, redirect }) => {
        const baseUrl = getBaseUrl(headers)
        const errorRedirect = (msg: string) =>
          redirect(`${baseUrl}/auth/callback?error=${encodeURIComponent(msg)}`)

        if (query.error) {
          logger.warn('Twitter OAuth error', { error: query.error }, 'Auth')
          return errorRedirect(`OAuth error: ${query.error}`)
        }

        if (!query.code || !query.state) {
          return errorRedirect('Missing authorization code or state')
        }

        const stored = await getOAuthState(query.state)
        await deleteOAuthState(query.state)

        if (!stored) return errorRedirect('Invalid or expired OAuth state')
        if (stored.expiresAt < Date.now())
          return errorRedirect('OAuth state expired')

        let creds: { clientId: string; clientSecret: string }
        try {
          creds = getTwitterCredentials()
        } catch (e) {
          set.status = 500
          return { error: (e as Error).message }
        }

        const twitter = new TwitterProvider({
          ...creds,
          redirectUri: `${baseUrl}/api/auth/twitter/callback`,
          scopes: ['users.read', 'tweet.read'],
        })

        const oauthState: OAuthState = {
          state: query.state,
          nonce: '',
          provider: AuthProvider.TWITTER,
          appId: DEFAULT_APP_ID,
          createdAt: stored.createdAt,
          codeVerifier: stored.codeVerifier,
        }

        const tokens = await twitter.exchangeCode(query.code, oauthState)
        const profile = await twitter.getProfile(tokens)
        const did = createDID('twitter', profile.id)

        logger.info(
          'Twitter OAuth success',
          { did, username: profile.handle },
          'Auth',
        )

        const finalUrl = new URL(stored.redirectUrl)
        finalUrl.searchParams.set('success', 'true')
        finalUrl.searchParams.set('provider', 'twitter')
        finalUrl.searchParams.set('userId', did)
        if (profile.handle)
          finalUrl.searchParams.set('username', profile.handle)

        return redirect(finalUrl.toString())
      },
      {
        query: t.Object({
          code: t.Optional(t.String()),
          state: t.Optional(t.String()),
          error: t.Optional(t.String()),
        }),
        detail: { tags: ['Auth'], summary: 'Twitter OAuth callback' },
      },
    )

    // Onboarding Twitter initiation - Links Twitter to existing user
    .get(
      '/onboarding/twitter/initiate',
      async ({ query, headers, set }) => {
        const userId = query.userId
        if (!userId) {
          set.status = 400
          return { error: 'userId is required for onboarding Twitter link' }
        }

        let creds: { clientId: string; clientSecret: string }
        try {
          creds = getTwitterCredentials()
        } catch (e) {
          set.status = 500
          return { error: (e as Error).message }
        }

        const baseUrl = getBaseUrl(headers)
        const callbackUrl = `${baseUrl}/api/auth/onboarding/twitter/callback`
        const finalRedirectUrl = `${baseUrl}/onboarding?step=social`

        // Store state WITH userId for onboarding flow
        const { state, codeVerifier } = await storeOAuthState(
          finalRedirectUrl,
          'twitter',
          userId,
        )

        const twitter = new TwitterProvider({
          ...creds,
          redirectUri: callbackUrl,
          scopes: ['users.read', 'tweet.read'],
        })

        const oauthState: OAuthState = {
          state,
          nonce: crypto.randomUUID(),
          provider: AuthProvider.TWITTER,
          appId: DEFAULT_APP_ID,
          createdAt: Date.now(),
          codeVerifier,
        }

        const authUrl = await twitter.getAuthorizationUrl(oauthState)

        // Update stored code verifier if modified
        if (
          oauthState.codeVerifier &&
          oauthState.codeVerifier !== codeVerifier
        ) {
          await updateOAuthState(state, {
            codeVerifier: oauthState.codeVerifier,
          })
        }

        logger.info(
          'Onboarding Twitter OAuth initiated',
          { state, userId },
          'Auth',
        )
        return { authUrl, state }
      },
      {
        query: t.Object({ userId: t.Optional(t.String()) }),
        detail: {
          tags: ['Auth'],
          summary: 'Initiate onboarding Twitter OAuth',
        },
      },
    )

    // Onboarding Twitter callback - Links Twitter to existing user
    .get(
      '/onboarding/twitter/callback',
      async ({ query, headers, set, redirect }) => {
        const baseUrl = getBaseUrl(headers)
        const errorRedirect = (msg: string) =>
          redirect(`${baseUrl}/onboarding?error=${encodeURIComponent(msg)}`)

        if (query.error) {
          logger.warn(
            'Onboarding Twitter OAuth error',
            { error: query.error },
            'Auth',
          )
          return errorRedirect(`OAuth error: ${query.error}`)
        }

        if (!query.code || !query.state) {
          return errorRedirect('Missing authorization code or state')
        }

        const stored = await getOAuthState(query.state)
        await deleteOAuthState(query.state)

        if (!stored || !stored.userId)
          return errorRedirect('Invalid or expired OAuth state')
        if (stored.expiresAt < Date.now())
          return errorRedirect('OAuth state expired')

        let creds: { clientId: string; clientSecret: string }
        try {
          creds = getTwitterCredentials()
        } catch (e) {
          set.status = 500
          return { error: (e as Error).message }
        }

        const twitter = new TwitterProvider({
          ...creds,
          redirectUri: `${baseUrl}/api/auth/onboarding/twitter/callback`,
          scopes: ['users.read', 'tweet.read'],
        })

        const oauthState: OAuthState = {
          state: query.state,
          nonce: '',
          provider: AuthProvider.TWITTER,
          appId: DEFAULT_APP_ID,
          createdAt: stored.createdAt,
          codeVerifier: stored.codeVerifier,
        }

        const tokens = await twitter.exchangeCode(query.code, oauthState)
        const profile = await twitter.getProfile(tokens)

        await db
          .update(users)
          .set({
            twitterId: profile.id,
            twitterUsername: profile.handle?.replace('@', '') ?? null,
            hasTwitter: true,
            twitterVerifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, stored.userId))

        logger.info(
          'Twitter linked during onboarding',
          { userId: stored.userId, twitterId: profile.id },
          'Auth',
        )
        return redirect(`${baseUrl}/onboarding?step=social&twitter=linked`)
      },
      {
        query: t.Object({
          code: t.Optional(t.String()),
          state: t.Optional(t.String()),
          error: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Auth'],
          summary: 'Onboarding Twitter OAuth callback',
        },
      },
    )

    // Twitter auth status - Check if current user has Twitter linked
    .use(authMiddleware)
    .get(
      '/twitter/auth-status',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx

        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Get user's Twitter status from database
        const [userData] = await db
          .select({
            twitterId: users.twitterId,
            twitterUsername: users.twitterUsername,
            hasTwitter: users.hasTwitter,
            twitterVerifiedAt: users.twitterVerifiedAt,
          })
          .from(users)
          .where(eq(users.id, user.userId))
          .limit(1)

        if (!userData) {
          set.status = 404
          return { error: 'User not found' }
        }

        return {
          isLinked: userData.hasTwitter ?? false,
          twitterId: userData.twitterId,
          twitterUsername: userData.twitterUsername,
          linkedAt: userData.twitterVerifiedAt?.toISOString() ?? null,
        }
      },
      {
        detail: {
          tags: ['Auth'],
          summary: 'Check Twitter auth status',
          description: 'Returns whether the current user has Twitter linked',
        },
      },
    )

export const authRoutes = createAuthRoutes()
