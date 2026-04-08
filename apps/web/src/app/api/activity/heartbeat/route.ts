/**
 * POST /api/activity/heartbeat - Session heartbeat endpoint
 *
 * Records client session activity for engagement metrics.
 * Called every 5 minutes by the client-side heartbeat hook.
 *
 * Creates a new session if:
 * - No session exists for this sessionId
 * - Last activity was more than 30 minutes ago
 *
 * Updates existing session's lastActiveAt and counters.
 *
 * @module /api/activity/heartbeat
 */

import { checkProgress, optionalAuth, withErrorHandling } from '@babylon/api';
import {
  bumpUserSessionHeartbeatCounters,
  closeStaleOpenUserSessionsBefore,
  generateSnowflakeId,
  insertUserActivityLogOnConflictDoNothing,
  insertUserSessionRow,
  selectOpenUserSessionForBrowserSession,
  updateUserSessionEndedAtById,
} from '@babylon/db';
import { asSystem, asUser } from '@babylon/db/engine-storage';
import { logger, PATH_TO_ACTIVITY_TYPE } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Rate limit: maximum 1 heartbeat per minute per session
const HEARTBEAT_RATE_LIMIT_MS = 60 * 1000;

// Maximum allowed page views per heartbeat (prevents abuse)
const MAX_PAGE_VIEWS_PER_HEARTBEAT = 100;

// In-memory rate limit cache (per-session)
// NOTE: This works for single-server deployments. For horizontal scaling with
// multiple server instances, consider using Redis-based rate limiting to ensure
// rate limits are enforced consistently across all instances.
const heartbeatCache = new Map<string, number>();

/**
 * Clean up stale entries from the rate limit cache.
 * Called on each request to avoid module-scope setInterval (serverless-unfriendly).
 */
function cleanupRateLimitCache(): void {
  const cutoff = Date.now() - HEARTBEAT_RATE_LIMIT_MS * 2;
  for (const [key, timestamp] of heartbeatCache.entries()) {
    if (timestamp < cutoff) {
      heartbeatCache.delete(key);
    }
  }
}

interface HeartbeatRequest {
  sessionId: string;
  pageViews?: number;
  lastPath?: string;
}

function parseDeviceType(userAgent: string | null): string {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
    if (/ipad|tablet/.test(ua)) return 'tablet';
    return 'mobile';
  }
  return 'desktop';
}

async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + (process.env.IP_HASH_SALT || 'babylon'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Verify auth via Privy JWT — returns null for unauthenticated/invalid tokens
  const authUser = await optionalAuth(request);

  if (!authUser?.dbUserId) {
    // Silently accept unauthenticated requests to avoid console errors
    // for logged-out users who still have the heartbeat running
    return NextResponse.json({ success: true, reason: 'unauthenticated' });
  }

  const validUserId: string = authUser.dbUserId;

  // Parse request body
  const body = (await request.json()) as HeartbeatRequest;
  const { sessionId } = body;

  // Validate and normalize pageViews (prevent abuse with large/negative values)
  const rawPageViews = body.pageViews ?? 0;
  const pageViews = Math.min(
    Math.max(0, Math.floor(Number(rawPageViews) || 0)),
    MAX_PAGE_VIEWS_PER_HEARTBEAT
  );

  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 100) {
    return NextResponse.json(
      { success: false, error: 'Invalid sessionId' },
      { status: 400 }
    );
  }

  // Clean up stale rate limit cache entries (replaces module-scope setInterval)
  cleanupRateLimitCache();

  // Rate limit check
  const cacheKey = `${validUserId}:${sessionId}`;
  const lastHeartbeat = heartbeatCache.get(cacheKey);
  const now = Date.now();

  if (lastHeartbeat && now - lastHeartbeat < HEARTBEAT_RATE_LIMIT_MS) {
    return NextResponse.json({ success: true, reason: 'rate_limited' });
  }

  heartbeatCache.set(cacheKey, now);

  // Get device info
  const userAgentHeader = request.headers.get('user-agent');
  const deviceType = parseDeviceType(userAgentHeader);
  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp = forwardedFor?.split(',')[0]?.trim() ?? null;
  const ipHash = await hashIp(clientIp);

  const nowDate = new Date();
  const sessionTimeoutThreshold = new Date(
    nowDate.getTime() - SESSION_TIMEOUT_MS
  );

  // DB work (best-effort): if the session tables are missing/mis-migrated in a
  // given environment, we don't want to hard-fail the user flow.
  try {
    await asUser(authUser, async (db) => {
      async function createSession(): Promise<void> {
        const id = await generateSnowflakeId();
        await insertUserSessionRow(db, {
          id,
          userId: validUserId,
          sessionId,
          startedAt: nowDate,
          lastActiveAt: nowDate,
          deviceType: deviceType || undefined,
          userAgent: userAgentHeader
            ? userAgentHeader.substring(0, 500)
            : undefined,
          ipHash: ipHash || undefined,
          pageCount: pageViews,
          heartbeatCount: 1,
        });
        logger.debug(
          'Created session',
          { userId: validUserId, id },
          'POST /api/activity/heartbeat'
        );
      }

      const existingSession = await selectOpenUserSessionForBrowserSession(
        db,
        validUserId,
        sessionId
      );

      if (existingSession) {
        const isTimedOut =
          existingSession.lastActiveAt < sessionTimeoutThreshold;
        if (isTimedOut) {
          await updateUserSessionEndedAtById(
            db,
            existingSession.id,
            existingSession.lastActiveAt
          );
          await createSession();
        } else {
          await bumpUserSessionHeartbeatCounters(
            db,
            existingSession.id,
            nowDate,
            pageViews
          );
        }
      } else {
        await createSession();
      }

      const activityDate = new Date(
        nowDate.getFullYear(),
        nowDate.getMonth(),
        nowDate.getDate()
      );

      const activityLogId = await generateSnowflakeId();
      await insertUserActivityLogOnConflictDoNothing(db, {
        id: activityLogId,
        userId: validUserId,
        activityType: 'session',
        activityDate,
      });

      const lastPath = body.lastPath;
      if (lastPath) {
        const basePath = `/${lastPath.split('/').filter(Boolean)[0] ?? ''}`;
        const isMarketDetail =
          lastPath.startsWith('/markets/predictions/') ||
          lastPath.startsWith('/markets/perps/');
        const pageActivityType =
          PATH_TO_ACTIVITY_TYPE[lastPath] ??
          (isMarketDetail ? ('open_market_detail' as const) : undefined) ??
          PATH_TO_ACTIVITY_TYPE[basePath] ??
          undefined;
        if (pageActivityType) {
          const pageLogId = await generateSnowflakeId();
          await insertUserActivityLogOnConflictDoNothing(db, {
            id: pageLogId,
            userId: validUserId,
            activityType: pageActivityType,
            activityDate,
          });

          void checkProgress(validUserId, {
            type: 'page_visited',
            activityType: pageActivityType,
          });
        }
      }
    });
  } catch (error) {
    const causeCode = (error as { cause?: { code?: string } } | null)?.cause
      ?.code;
    const code = causeCode ?? (error as { code?: string } | null)?.code;

    // 42P01 = undefined_table, 42703 = undefined_column
    if (code === '42P01' || code === '42703') {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn(
        'Heartbeat DB unavailable (degraded)',
        { code, errorMessage },
        'POST /api/activity/heartbeat'
      );
      return NextResponse.json({ success: true, reason: 'db_unavailable' });
    }

    throw error;
  }

  if (Math.random() < 0.25) {
    closeStaleSessionsInternal().catch((error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn(
        'Opportunistic stale-session cleanup failed',
        { errorMessage },
        'POST /api/activity/heartbeat'
      );
    });
  }

  return NextResponse.json({
    success: true,
    sessionId,
  });
});

async function closeStaleSessionsInternal(): Promise<{ id: string }[]> {
  return asSystem(async (db) => {
    const threshold = new Date(Date.now() - SESSION_TIMEOUT_MS);
    return closeStaleOpenUserSessionsBefore(db, threshold);
  }, 'heartbeat-close-stale-sessions');
}
