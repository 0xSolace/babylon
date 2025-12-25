// @ts-nocheck - Elysia body type inference issues, needs refactoring
import { db, eq, userMessagingKeys, users } from '@babylon/db'
import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

// Relay node URL from environment
const RELAY_URL = process.env.MESSAGING_RELAY_URL ?? 'http://localhost:3200'

interface RelayMessage {
  id: string
  from: string
  to: string
  encryptedContent: string
  timestamp: number
  cid: string
  receivedAt: number
}

interface InboxResponse {
  address: string
  messages: RelayMessage[]
  count: number
}

interface SendResponse {
  id: string
  cid: string
}

/**
 * Parse inbox response from relay
 */
function parseInboxResponse(data: unknown): InboxResponse {
  const obj = data as Record<string, unknown>
  return {
    address: String(obj.address ?? ''),
    messages: Array.isArray(obj.messages) ? obj.messages : [],
    count: typeof obj.count === 'number' ? obj.count : 0,
  }
}

/**
 * Parse send response from relay
 */
function parseSendResponse(data: unknown): SendResponse {
  const obj = data as Record<string, unknown>
  return {
    id: String(obj.id ?? ''),
    cid: String(obj.cid ?? ''),
  }
}

/**
 * Messaging routes
 * Migrated from: apps/web/app/api/messaging/*
 */
const createMessagingRoutes = () =>
  new Elysia({ prefix: '/api/messaging' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // Get inbox messages
    // Migrated from: apps/web/app/api/messaging/inbox/route.ts
    .get(
      '/inbox',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Get user's wallet address
        const [userData] = await db
          .select({ walletAddress: users.walletAddress })
          .from(users)
          .where(eq(users.id, user.userId))
          .limit(1)

        if (!userData?.walletAddress) {
          set.status = 400
          return { error: 'Wallet address not found' }
        }

        // Fetch from relay node
        const relayResponse = await fetch(
          `${RELAY_URL}/messages/${userData.walletAddress}`,
        ).catch(() => null)

        if (!relayResponse?.ok) {
          logger.error(
            'Failed to fetch from relay',
            { status: relayResponse?.status },
            'GET /api/messaging/inbox',
          )
          set.status = 502
          return { error: 'Failed to fetch messages from relay' }
        }

        const result = parseInboxResponse(await relayResponse.json())

        // Enrich messages with sender info
        const enrichedMessages = await Promise.all(
          result.messages.map(async (msg) => {
            const [sender] = await db
              .select({
                id: users.id,
                displayName: users.displayName,
                username: users.username,
                profileImageUrl: users.profileImageUrl,
              })
              .from(users)
              .where(eq(users.walletAddress, msg.from))
              .limit(1)

            return {
              ...msg,
              sender: sender ?? {
                id: msg.from,
                displayName: `${msg.from.slice(0, 8)}...`,
                username: null,
                profileImageUrl: null,
              },
            }
          }),
        )

        logger.debug(
          'Fetched inbox messages',
          { userId: user.userId, count: result.count },
          'GET /api/messaging/inbox',
        )

        return {
          success: true,
          messages: enrichedMessages,
          count: result.count,
        }
      },
      {
        detail: {
          tags: ['Messaging'],
          summary: 'Get inbox messages',
          description: 'Fetches pending encrypted messages from relay network',
        },
      },
    )

    // Send message
    // Migrated from: apps/web/app/api/messaging/send/route.ts
    .post(
      '/send',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { to, encryptedContent, signature } = body

        // Get sender's wallet address
        const [userData] = await db
          .select({ walletAddress: users.walletAddress })
          .from(users)
          .where(eq(users.id, user.userId))
          .limit(1)

        if (!userData?.walletAddress) {
          set.status = 400
          return { error: 'Wallet address not found' }
        }

        // Send to relay node
        const relayResponse = await fetch(`${RELAY_URL}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: userData.walletAddress,
            to,
            encryptedContent,
            signature,
          }),
        }).catch(() => null)

        if (!relayResponse?.ok) {
          logger.error(
            'Failed to send to relay',
            { status: relayResponse?.status },
            'POST /api/messaging/send',
          )
          set.status = 502
          return { error: 'Failed to send message to relay' }
        }

        const result = parseSendResponse(await relayResponse.json())

        logger.info(
          'Message sent',
          { userId: user.userId, to, messageId: result.id },
          'POST /api/messaging/send',
        )

        return {
          success: true,
          messageId: result.id,
          cid: result.cid,
        }
      },
      {
        body: t.Object({
          to: t.String(),
          encryptedContent: t.String(),
          signature: t.String(),
        }),
        detail: {
          tags: ['Messaging'],
          summary: 'Send message',
          description: 'Sends an encrypted message via relay network',
        },
      },
    )

    // Get encryption keys
    // Migrated from: apps/web/app/api/messaging/keys/route.ts
    .get(
      '/keys',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Get user's wallet address
        const [userData] = await db
          .select({ walletAddress: users.walletAddress })
          .from(users)
          .where(eq(users.id, user.userId))
          .limit(1)

        // Get user's messaging key
        const [keyData] = await db
          .select({ publicKey: userMessagingKeys.publicKey })
          .from(userMessagingKeys)
          .where(eq(userMessagingKeys.userId, user.userId))
          .limit(1)

        return {
          success: true,
          publicKey: keyData?.publicKey ?? null,
          walletAddress: userData?.walletAddress ?? null,
          hasKey: !!keyData?.publicKey,
        }
      },
      {
        detail: {
          tags: ['Messaging'],
          summary: 'Get encryption keys',
          description: 'Returns user encryption public key',
        },
      },
    )

    // Register encryption key
    // Migrated from: apps/web/app/api/messaging/keys/route.ts (POST)
    .post(
      '/keys',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { publicKey, signedPreKey } = body

        // Check if key already exists
        const [existingKey] = await db
          .select({ id: userMessagingKeys.id })
          .from(userMessagingKeys)
          .where(eq(userMessagingKeys.userId, user.userId))
          .limit(1)

        if (existingKey) {
          // Update existing key
          await db
            .update(userMessagingKeys)
            .set({
              publicKey,
              signedPreKey: signedPreKey ?? publicKey, // Use same key if not provided
              updatedAt: new Date(),
            })
            .where(eq(userMessagingKeys.userId, user.userId))
        } else {
          // Create new key
          const keyId = await generateSnowflakeId()
          await db.insert(userMessagingKeys).values({
            id: keyId,
            userId: user.userId,
            publicKey,
            signedPreKey: signedPreKey ?? publicKey,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }

        logger.info(
          'Encryption key registered',
          { userId: user.userId },
          'POST /api/messaging/keys',
        )

        return {
          success: true,
          message: 'Public key registered successfully',
        }
      },
      {
        body: t.Object({
          publicKey: t.String(),
          signedPreKey: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Messaging'],
          summary: 'Register encryption key',
          description: 'Registers a public key for encrypted messaging',
        },
      },
    )

    // Get user's public key by address
    // Migrated from: apps/web/app/api/messaging/keys/[address]/route.ts
    .get(
      '/keys/:address',
      async ({ params }) => {
        const { address } = params

        // Get user by wallet address
        const [userData] = await db
          .select({
            id: users.id,
            displayName: users.displayName,
            username: users.username,
          })
          .from(users)
          .where(eq(users.walletAddress, address))
          .limit(1)

        if (!userData) {
          return {
            success: true,
            found: false,
            publicKey: null,
          }
        }

        // Get messaging key for user
        const [keyData] = await db
          .select({ publicKey: userMessagingKeys.publicKey })
          .from(userMessagingKeys)
          .where(eq(userMessagingKeys.userId, userData.id))
          .limit(1)

        return {
          success: true,
          found: true,
          publicKey: keyData?.publicKey ?? null,
          user: {
            id: userData.id,
            displayName: userData.displayName,
            username: userData.username,
          },
        }
      },
      {
        params: t.Object({
          address: t.String(),
        }),
        detail: {
          tags: ['Messaging'],
          summary: 'Get user public key',
          description: 'Returns public key for a wallet address',
        },
      },
    )

export const messagingRoutes = createMessagingRoutes()
