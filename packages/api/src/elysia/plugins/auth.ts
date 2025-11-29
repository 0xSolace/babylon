/**
 * Elysia Authentication Plugin
 *
 * Provides authentication utilities and guards for API routes
 */

import { Elysia } from 'elysia';
import { PrivyClient } from '@privy-io/server-auth';
import { db, eq, users } from '@babylon/db';
import { verifyAgentSession } from '../../agent-auth';
import { logger } from '@babylon/shared';
import type { AuthenticatedUser } from '@babylon/shared';

// Lazy initialization of Privy client
let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const privyAppSecret = process.env.PRIVY_APP_SECRET;

    if (!privyAppId || !privyAppSecret) {
      throw new Error('Privy credentials not configured');
    }

    privyClient = new PrivyClient(privyAppId, privyAppSecret);
  }
  return privyClient;
}

/**
 * Extract authentication token from request
 */
function extractToken(request: Request, cookie: Record<string, { value: string } | undefined>): string | undefined {
  // Prefer cookie token (auto-refreshed by Privy)
  const cookieToken = cookie['privy-token']?.value;
  if (cookieToken) {
    return cookieToken;
  }

  // Fall back to Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return undefined;
}

/**
 * Authenticate a token and return user info
 */
async function authenticateToken(token: string): Promise<AuthenticatedUser> {
  // Try agent session authentication first (faster)
  const agentSession = await verifyAgentSession(token);
  if (agentSession) {
    return {
      userId: agentSession.agentId,
      privyId: agentSession.agentId,
      isAgent: true,
    };
  }

  // Try Privy authentication
  const privy = getPrivyClient();
  const claims = await privy.verifyAuthToken(token);

  // Look up user in database
  const result = await db
    .select({
      id: users.id,
      walletAddress: users.walletAddress,
    })
    .from(users)
    .where(eq(users.privyId, claims.userId))
    .limit(1);

  const dbUser = result[0];

  return {
    userId: dbUser?.id ?? claims.userId,
    dbUserId: dbUser?.id,
    privyId: claims.userId,
    walletAddress: dbUser?.walletAddress ?? undefined,
    isAgent: false,
  };
}

/**
 * Base authentication plugin that provides auth utilities
 *
 * Adds `authToken`, `authenticate()`, and `optionalAuth()` to context
 */
export const authPlugin = new Elysia({ name: 'auth' }).derive(
  { as: 'global' },
  ({ request, cookie }) => {
    const authToken = extractToken(request, cookie as Record<string, { value: string } | undefined>);

    return {
      authToken,

      /**
       * Authenticate the request and return user info
       * @throws Error if authentication fails
       */
      async authenticate(): Promise<AuthenticatedUser> {
        if (!authToken) {
          throw new Error('Missing authentication token');
        }

        try {
          return await authenticateToken(authToken);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          if (message.includes('expired') || message.includes('exp')) {
            throw new Error('Authentication token has expired. Please refresh your session.');
          }

          logger.warn('Authentication failed', { error: message }, 'auth-plugin');
          throw new Error('Invalid or expired authentication token');
        }
      },

      /**
       * Optionally authenticate the request
       * @returns User info if authenticated, null otherwise
       */
      async optionalAuth(): Promise<AuthenticatedUser | null> {
        if (!authToken) {
          return null;
        }

        try {
          return await authenticateToken(authToken);
        } catch {
          // Return null for optional auth failures
          return null;
        }
      },
    };
  }
);

/**
 * Authentication guard that requires a valid user
 *
 * Adds `user: AuthenticatedUser` to context
 */
export const requireAuth = new Elysia({ name: 'require-auth' })
  .use(authPlugin)
  .derive({ as: 'scoped' }, async ({ authenticate }) => {
    const user = await authenticate();
    return { user };
  });

/**
 * Optional authentication plugin
 *
 * Adds `user: AuthenticatedUser | null` to context
 */
export const optionalAuthPlugin = new Elysia({ name: 'optional-auth' })
  .use(authPlugin)
  .derive({ as: 'scoped' }, async ({ optionalAuth }) => {
    const user = await optionalAuth();
    return { user };
  });

/**
 * Admin guard that requires admin privileges
 */
export const requireAdmin = new Elysia({ name: 'require-admin' })
  .use(requireAuth)
  .derive({ as: 'scoped' }, async (ctx) => {
    // user is guaranteed to be present from requireAuth
    const user = ctx.user;
    if (!user) {
      throw new Error('Authentication required');
    }

    // Look up user to check admin status
    const [dbUser] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    if (!dbUser?.isAdmin) {
      throw new Error('Admin access required');
    }

    return { isAdmin: true };
  });

/**
 * Cron secret guard for scheduled jobs
 */
export const requireCronSecret = new Elysia({ name: 'require-cron-secret' }).derive(
  { as: 'scoped' },
  ({ request }) => {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      throw new Error('CRON_SECRET not configured');
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      throw new Error('Invalid cron secret');
    }

    return { isCron: true };
  }
);

