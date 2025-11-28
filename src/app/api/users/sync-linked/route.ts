import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { db, users, eq, and, ne } from '@/db'
import { getPrivyClient } from '@/lib/api/auth-middleware'
import { ConflictError, AuthorizationError, NotFoundError } from '@/lib/errors'
import { withErrorHandling } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger'
import { PointsService } from '@/lib/services/points-service'

type SyncResult = {
  farcaster?: {
    updated: boolean
    pointsAwarded: number
  }
  twitter?: {
    updated: boolean
    pointsAwarded: number
  }
  wallet?: {
    updated: boolean
    pointsAwarded: number
  }
}

function getHeaderOrCookie(request: NextRequest, headerName: string, cookieName: string) {
  return request.headers.get(headerName) ?? request.cookies.get(cookieName)?.value ?? null
}

function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  const payloadSegment = parts[1]
  if (!payloadSegment) return null
  try {
    const payload = Buffer.from(payloadSegment, 'base64').toString('utf-8')
    return JSON.parse(payload) as T
  } catch (error) {
    logger.warn('Failed to decode JWT payload', { error }, 'sync-linked')
    return null
  }
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  const privy = getPrivyClient()

  const authHeader = request.headers.get('authorization')
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : getHeaderOrCookie(request, 'privy-token', 'privy-token')

  if (!accessToken) {
    throw new AuthorizationError('Missing Privy access token', 'privy-token', 'sync')
  }

  const identityToken = getHeaderOrCookie(request, 'privy-id-token', 'privy-id-token')
  if (!identityToken) {
    throw new AuthorizationError('Missing Privy identity token', 'privy-id-token', 'sync')
  }

  // Verify access token
  const accessClaims = await privy.verifyAuthToken(accessToken)

  // Verify identity token and fetch user data
  const privyUser = await privy.getUser({ idToken: identityToken })

  if (!privyUser?.id || privyUser.id !== accessClaims.userId) {
    throw new AuthorizationError('Access token and identity token do not match the same user', 'privy-token', 'sync')
  }

  // Optional session consistency check (sid claim on identity token)
  const identityPayload = decodeJwtPayload<{ sid?: string }>(identityToken)
  if (identityPayload?.sid && accessClaims.sessionId && identityPayload.sid !== accessClaims.sessionId) {
    throw new AuthorizationError('Session mismatch between access and identity tokens', 'privy-token', 'sync')
  }

  // Resolve DB user
  const dbUserResult = await db.select({
    id: users.id,
    pointsAwardedForFarcaster: users.pointsAwardedForFarcaster,
    pointsAwardedForTwitter: users.pointsAwardedForTwitter,
    pointsAwardedForWallet: users.pointsAwardedForWallet,
  })
    .from(users)
    .where(eq(users.privyId, accessClaims.userId))
    .limit(1)

  const dbUser = dbUserResult[0]
  if (!dbUser) {
    throw new NotFoundError('User', accessClaims.userId)
  }

  const syncResult: SyncResult = {}

  const updateData: Partial<typeof users.$inferInsert> = {}

  // Farcaster sync
  if (privyUser.farcaster) {
    const { fid, username, displayName, pfp } = privyUser.farcaster

    if (fid) {
      const [existing] = await db.select({ id: users.id })
        .from(users)
        .where(and(eq(users.farcasterFid, String(fid)), ne(users.id, dbUser.id)))
        .limit(1)

      if (existing) {
        throw new ConflictError('Farcaster account already linked to another user', 'User.farcasterFid')
      }
    }

    updateData.hasFarcaster = true
    if (fid) updateData.farcasterFid = String(fid)
    if (username) updateData.farcasterUsername = username
    if (displayName) updateData.farcasterDisplayName = displayName
    if (pfp) updateData.farcasterPfpUrl = pfp

    // Award points only if not already awarded
    if (!dbUser.pointsAwardedForFarcaster) {
      const result = await PointsService.awardFarcasterLink(dbUser.id, username ?? undefined)
      syncResult.farcaster = {
        updated: true,
        pointsAwarded: result.pointsAwarded,
      }
    } else {
      syncResult.farcaster = { updated: true, pointsAwarded: 0 }
    }
  }

  // Twitter sync
  if (privyUser.twitter) {
    const { subject, username, name, profilePictureUrl } = privyUser.twitter

    if (subject) {
      const [existing] = await db.select({ id: users.id })
        .from(users)
        .where(and(eq(users.twitterId, subject), ne(users.id, dbUser.id)))
        .limit(1)

      if (existing) {
        throw new ConflictError('Twitter account already linked to another user', 'User.twitterId')
      }
    }

    updateData.hasTwitter = true
    if (subject) updateData.twitterId = subject
    if (username) updateData.twitterUsername = username
    if (name) updateData.displayName = updateData.displayName ?? name
    if (profilePictureUrl) updateData.profileImageUrl = updateData.profileImageUrl ?? profilePictureUrl

    if (!dbUser.pointsAwardedForTwitter) {
      const result = await PointsService.awardTwitterLink(dbUser.id, username ?? undefined)
      syncResult.twitter = {
        updated: true,
        pointsAwarded: result.pointsAwarded,
      }
    } else {
      syncResult.twitter = { updated: true, pointsAwarded: 0 }
    }
  }

  // Wallet sync (first verified wallet from Privy user)
  if (privyUser.wallet?.address) {
    const walletAddress = privyUser.wallet.address.toLowerCase()

    const [existing] = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.walletAddress, walletAddress), ne(users.id, dbUser.id)))
      .limit(1)

    if (existing) {
      throw new ConflictError('Wallet address already linked to another user', 'User.walletAddress')
    }

    updateData.walletAddress = walletAddress
    updateData.showWalletPublic = updateData.showWalletPublic ?? true

    if (!dbUser.pointsAwardedForWallet) {
      const result = await PointsService.awardWalletConnect(dbUser.id, walletAddress)
      syncResult.wallet = {
        updated: true,
        pointsAwarded: result.pointsAwarded,
      }
    } else {
      syncResult.wallet = { updated: true, pointsAwarded: 0 }
    }
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(users)
      .set(updateData)
      .where(eq(users.id, dbUser.id))
  }

  const awardedSomething = Object.values(syncResult).some((entry) => entry && entry.pointsAwarded > 0)
  if (awardedSomething) {
    await PointsService.checkAndQualifyReferral(dbUser.id).catch((error) => {
      logger.warn('Failed to check referral qualification after sync', { error, userId: dbUser.id }, 'sync-linked')
    })
  }

  logger.info('Synced social accounts from Privy', {
    userId: dbUser.id,
    platforms: Object.keys(syncResult),
  }, 'sync-linked')

  return NextResponse.json({
    success: true,
    synced: syncResult,
  })
})
