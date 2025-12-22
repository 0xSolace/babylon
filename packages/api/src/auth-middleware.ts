/**
 * API Authentication Middleware
 *
 * ALL authentication routes through OAuth3 (Jeju's decentralized auth).
 * NO FALLBACKS - OAuth3 is required.
 *
 * Supports:
 * - OAuth3 user authentication (via tokens/cookies)
 * - Agent session tokens
 * - Wallet-based authentication
 */

import { getOAuth3Client, type OAuth3Client } from '@babylon/auth';
import { db } from '@babylon/db';
import type { AuthenticatedUser } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyAgentSession } from './agent-auth';
import { AuthenticationError, isAuthenticationError } from './errors';

// Re-export types from shared for backwards compatibility
export type { AuthenticatedUser } from '@babylon/shared';
export { extractErrorMessage } from '@babylon/shared';

// Re-export from errors for backwards compatibility
export { AuthenticationError, isAuthenticationError };

// Lazy initialization of OAuth3 client
let oauth3Client: OAuth3Client | null = null;

export function getAuthClient(): OAuth3Client {
  if (!oauth3Client) {
    oauth3Client = getOAuth3Client();
  }
  return oauth3Client;
}

/**
 * Authenticate request and return user info
 *
 * Authentication is performed via OAuth3 (decentralized auth).
 * Tokens can be provided via:
 * 1. oauth3-token cookie (preferred - auto-refreshed)
 * 2. Authorization Bearer header (for agents/external clients)
 */
export async function authenticate(
  request: NextRequest
): Promise<AuthenticatedUser> {
  const authHeader = request.headers.get('authorization');
  let token: string | undefined;

  // Check for OAuth3 token in cookie first
  const oauth3Token = request.cookies.get('oauth3-token')?.value;

  if (oauth3Token) {
    token = oauth3Token;
  } else if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    throw new AuthenticationError(
      'Missing or invalid authorization header or cookie',
      'NO_TOKEN'
    );
  }

  // Try agent session authentication first (faster)
  const agentSession = await verifyAgentSession(token);
  if (agentSession) {
    return {
      userId: agentSession.agentId,
      oauth3Id: agentSession.agentId,
      isAgent: true,
    };
  }

  // Try OAuth3 authentication
  const auth = getAuthClient();

  let session;
  try {
    session = await auth.validateSession(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('expired')) {
      throw new AuthenticationError(
        'Authentication token has expired. Please refresh your session.',
        'EXPIRED_TOKEN'
      );
    }
    if (message.includes('invalid')) {
      throw new AuthenticationError(message, 'INVALID_TOKEN');
    }
    throw new AuthenticationError(message, 'INVALID_CREDENTIALS');
  }

  if (!session) {
    throw new AuthenticationError('Invalid session token', 'INVALID_TOKEN');
  }

  // Get user from database using OAuth3 identity
  const identityId = session.identityId;

  let dbUser = await db.user.findFirst({
    where: { oauth3Id: identityId },
  });

  // If not found by oauth3Id, try by wallet address from session
  if (!dbUser && session.smartAccount) {
    dbUser = await db.user.findFirst({
      where: { walletAddress: session.smartAccount },
    });

    // Link OAuth3 identity to existing user
    if (dbUser) {
      await db.user.update({
        where: { id: String(dbUser.id) },
        data: { oauth3Id: identityId },
      });
    }
  }

  return {
    userId: dbUser ? String(dbUser.id) : identityId,
    dbUserId: dbUser ? String(dbUser.id) : undefined,
    oauth3Id: identityId,
    walletAddress: dbUser?.walletAddress
      ? String(dbUser.walletAddress)
      : (session.smartAccount ?? undefined),
    email: undefined,
    isAgent: false,
  };
}

/**
 * Authenticate and require that the user has a database record
 */
export async function authenticateWithDbUser(
  request: NextRequest
): Promise<AuthenticatedUser & { dbUserId: string }> {
  const authUser = await authenticate(request);

  if (!authUser.dbUserId) {
    throw new AuthenticationError(
      'User profile not found. Please complete onboarding first.',
      'INVALID_CREDENTIALS'
    );
  }

  return authUser as AuthenticatedUser & { dbUserId: string };
}

/**
 * Optional authentication - returns user if authenticated, null otherwise
 */
export async function optionalAuth(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get('authorization');
  let token: string | undefined;

  const oauth3Token = request.cookies.get('oauth3-token')?.value;

  if (oauth3Token) {
    token = oauth3Token;
  } else if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    return null;
  }

  try {
    const agentSession = await verifyAgentSession(token);
    if (agentSession) {
      return {
        userId: agentSession.agentId,
        oauth3Id: agentSession.agentId,
        isAgent: true,
      };
    }

    const auth = getAuthClient();
    const session = await auth.validateSession(token);

    if (!session) return null;

    const dbUser = await db.user.findFirst({
      where: { oauth3Id: session.identityId },
    });

    return {
      userId: dbUser ? String(dbUser.id) : session.identityId,
      dbUserId: dbUser ? String(dbUser.id) : undefined,
      oauth3Id: session.identityId,
      walletAddress: dbUser?.walletAddress
        ? String(dbUser.walletAddress)
        : (session.smartAccount ?? undefined),
      email: undefined,
      isAgent: false,
    };
  } catch {
    return null;
  }
}

/**
 * Optional authentication from headers - for use when NextRequest is not available
 */
export async function optionalAuthFromHeaders(
  headers: Headers
): Promise<AuthenticatedUser | null> {
  const authHeader = headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const agentSession = await verifyAgentSession(token);
    if (agentSession) {
      return {
        userId: agentSession.agentId,
        oauth3Id: agentSession.agentId,
        isAgent: true,
      };
    }

    const auth = getAuthClient();
    const session = await auth.validateSession(token);

    if (!session) return null;

    return {
      userId: session.identityId,
      oauth3Id: session.identityId,
      walletAddress: session.smartAccount ?? undefined,
      email: undefined,
      isAgent: false,
    };
  } catch {
    return null;
  }
}

/**
 * Standard auth error response helper
 */
export function authErrorResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Authenticate user from request (convenience wrapper)
 */
export async function authenticateUser(req: NextRequest) {
  const authUser = await authenticate(req);
  return {
    id: authUser.userId,
    ...authUser,
  };
}
