/**
 * Edge SSE endpoint backed by Redis fan-out.
 *
 * This route is intended for Vercel (staging/prod) where long-lived Node
 * lambdas are unreliable. It
 * - verifies the Privy JWT using the public JWKS,
 * - polls Redis for the requested channels,
 * - streams events to the client with keepalive pings,
 * - avoids any Node-only APIs so it runs in the Edge runtime.
 *
 * The write side remains unchanged (broadcastToChannel publishes to Redis in
 * serverless mode). Clients can opt into this route by setting
 * NEXT_PUBLIC_SSE_PATH=/api/sse/edge-events.
 */

import type { NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { SSEChannelsQuerySchema } from '@/lib/validation/schemas';
import { PrivyClient } from '@privy-io/server-auth';
import { Redis } from '@upstash/redis';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const encoder = new TextEncoder();
const DEFAULT_CHANNEL: 'feed' = 'feed';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

let privyClient: PrivyClient | null = null;

async function verifyToken(token: string): Promise<{ userId: string }> {
  if (!privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error('Missing Privy configuration');
    }
    privyClient = new PrivyClient(appId, appSecret);
  }
  const claims = await privyClient.verifyAuthToken(token);
  const userId = claims.userId ?? (claims as { sub?: string }).sub;
  if (!userId) {
    throw new Error('Invalid token payload');
  }
  return { userId };
}

type Channel = 'feed' | 'markets' | 'breaking-news' | 'upcoming-events' | string;

async function edgePoll(
  channel: string,
  count: number = 20
): Promise<string[]> {
  if (!redis) {
    logger.warn('Edge SSE poll: Redis not configured', { channel }, 'edge-sse');
    return [];
  }

  try {
    // Pull the latest messages from the tail; dedupe client-side to avoid missing/duplicating
    const messages = await redis.lrange(`sse:${channel}`, -count, -1);
    if (!messages || messages.length === 0) {
      return [];
    }
    logger.debug('Edge SSE poll: messages fetched', { channel, count: messages.length }, 'edge-sse');
    return messages.map((msg) => (typeof msg === 'string' ? msg : JSON.stringify(msg)));
  } catch (error) {
    logger.warn('Edge SSE poll error', { error, channel }, 'edge-sse');
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryParams = {
    token: searchParams.get('token'),
    channels: searchParams.get('channels'),
  };

  const validatedQuery = SSEChannelsQuerySchema.safeParse(queryParams);
  if (!validatedQuery.success) {
    return new Response('Invalid query params', { status: 400 });
  }

  const token = validatedQuery.data.token!;
  let userId: string;
  try {
    const verified = await verifyToken(token);
    userId = verified.userId;
  } catch (error) {
    logger.warn('Edge SSE auth failed', { error }, 'edge-sse');
    return new Response('Unauthorized', { status: 401 });
  }

  const channelsParam = validatedQuery.data.channels;
  const channels = channelsParam
    ? (channelsParam.split(',').filter(Boolean) as Channel[])
    : [DEFAULT_CHANNEL];

  logger.info(
    'Edge SSE connection request',
    { userId, channels },
    'edge-sse'
  );

  const clientId = crypto.randomUUID();
  let closed = false;
  let pollInFlight = false;
  const pingInterval = 15_000;
  const pollIntervalMs = 200;

  let pingHandle: ReturnType<typeof setInterval> | null = null;
  let pollHandle: ReturnType<typeof setInterval> | null = null;
  const seenIds = new Set<string>(); // per-connection dedupe

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(payload));
      };

      // Connected event
      send(
        `event: connected\ndata: ${JSON.stringify({
          clientId,
          channels,
          timestamp: Date.now(),
        })}\n\n`
      );

      pingHandle = setInterval(() => {
        send(`:ping ${Date.now()}\n\n`);
      }, pingInterval);

      const pollLoop = async () => {
        if (closed || pollInFlight) return;
        pollInFlight = true;
        try {
          for (const channel of channels) {
            const messages = await edgePoll(channel, 50);
            if (messages.length === 0) continue;
            for (const raw of messages) {
              try {
                const message = JSON.parse(raw) as {
                  channel: Channel;
                  type: string;
                  data: Record<string, unknown>;
                  timestamp: number;
                };
                const dedupeId = `${message.channel}:${message.timestamp || ''}:${(message.data as { marketId?: string }).marketId ?? ''}:${message.type}`;
                if (seenIds.has(dedupeId)) {
                  continue;
                }
                // Keep bounded dedupe set
                if (seenIds.size > 500) {
                  seenIds.clear();
                }
                seenIds.add(dedupeId);
                send(
                  `event: message\ndata: ${JSON.stringify(message)}\n\n`
                );
              } catch (err) {
                logger.warn(
                  'Edge SSE failed to parse message',
                  { err, raw },
                  'edge-sse'
                );
              }
            }
          }
        } finally {
          pollInFlight = false;
        }
      };

      pollHandle = setInterval(() => {
        void pollLoop();
      }, pollIntervalMs);

      // React to client abort
      request.signal.addEventListener('abort', () => {
        closed = true;
        if (pingHandle) clearInterval(pingHandle);
        if (pollHandle) clearInterval(pollHandle);
        controller.close();
        logger.debug(
          'Edge SSE client aborted',
          { clientId, userId },
          'edge-sse'
        );
      });
    },
    cancel() {
      closed = true;
      if (pingHandle) clearInterval(pingHandle);
      if (pollHandle) clearInterval(pollHandle);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
