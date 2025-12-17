/**
 * Agent Authentication Utilities
 *
 * @description Provides session management and verification for Babylon agents.
 * Uses Jeju's decentralized cache for session storage.
 * Sessions expire after 24 hours and are automatically cleaned up.
 */

import { logger } from '../shared/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Agent session information
 */
export interface AgentSession {
  sessionToken: string;
  agentId: string;
  expiresAt: number;
}

// Session duration: 24 hours
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const SESSION_DURATION_SECONDS = 24 * 60 * 60;
const SESSION_PREFIX = 'agent:session:';
const DEFAULT_TEST_AGENT_ID = 'babylon-agent-alice';
const isProduction = process.env.NODE_ENV === 'production';

// In-memory fallback for local development without cache
const localSessions = new Map<string, AgentSession>();

// ============================================================================
// Cache Access
// ============================================================================

interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  isInitialized(): boolean;
}

let cacheClient: CacheClient | null = null;

async function getCache(): Promise<CacheClient | null> {
  if (cacheClient) return cacheClient;

  try {
    const { getCache: getCacheFromApi, initializeCache } = await import(
      '@babylon/api'
    );
    const cache = getCacheFromApi();
    if (!cache.isInitialized()) {
      await initializeCache();
    }
    cacheClient = cache;
    return cache;
  } catch {
    // Cache not available - use local storage
    return null;
  }
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Clean up expired sessions
 * Note: Decentralized cache handles TTL expiration automatically
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  const tokensToDelete: string[] = [];

  localSessions.forEach((session, token) => {
    if (now > session.expiresAt) {
      tokensToDelete.push(token);
    }
  });

  tokensToDelete.forEach((token) => localSessions.delete(token));
}

/**
 * Verify agent credentials against environment configuration
 */
export function verifyAgentCredentials(
  agentId: string,
  agentSecret: string
): boolean {
  const configuredAgentId =
    process.env.BABYLON_AGENT_ID ??
    (!isProduction ? DEFAULT_TEST_AGENT_ID : undefined);
  const configuredAgentSecret = process.env.CRON_SECRET;

  if (!configuredAgentSecret) {
    logger.error(
      'CRON_SECRET not configured in environment',
      undefined,
      'AgentAuth'
    );
    return false;
  }

  if (!configuredAgentId) {
    logger.error(
      'BABYLON_AGENT_ID must be configured in production environments',
      undefined,
      'AgentAuth'
    );
    return false;
  }

  return agentId === configuredAgentId && agentSecret === configuredAgentSecret;
}

/**
 * Create a new agent session
 */
export async function createAgentSession(
  agentId: string,
  sessionToken: string
): Promise<AgentSession> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const session: AgentSession = {
    sessionToken,
    agentId,
    expiresAt,
  };

  const cache = await getCache();
  if (cache) {
    const key = `${SESSION_PREFIX}${sessionToken}`;
    await cache.set(key, session, SESSION_DURATION_SECONDS);
  } else {
    localSessions.set(sessionToken, session);
  }

  return session;
}

/**
 * Verify agent session token
 */
export async function verifyAgentSession(
  sessionToken: string
): Promise<{ agentId: string } | null> {
  const cache = await getCache();

  if (cache) {
    const key = `${SESSION_PREFIX}${sessionToken}`;
    const session = await cache.get<AgentSession>(key);

    if (session && Date.now() <= session.expiresAt) {
      return { agentId: session.agentId };
    }
    if (session) {
      await cache.delete(key);
    }
    return null;
  }

  // Fallback to local storage
  const session = localSessions.get(sessionToken);

  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    localSessions.delete(sessionToken);
    return null;
  }

  return { agentId: session.agentId };
}

/**
 * Get session duration in milliseconds
 */
export function getSessionDuration(): number {
  return SESSION_DURATION_MS;
}
