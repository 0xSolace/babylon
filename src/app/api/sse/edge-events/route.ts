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

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { SSEChannelsQuerySchema } from '@/lib/validation/schemas';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const encoder = new TextEncoder();
const DEFAULT_CHANNEL: 'feed' = 'feed';

// JWKS loader is cached across invocations in the same edge worker
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function verifyToken(token: string): Promise<{ userId: string }> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    throw new Error('Missing NEXT_PUBLIC_PRIVY_APP_ID');
  }

  if (!jwks) {
    const jwksUrl = new URL(`/api/v1/apps/${appId}/jwks`, 'https://auth.privy.io');
    jwks = createRemoteJWKSet(jwksUrl);
  }

  const { payload } = await jwtVerify(token, jwks);
  const userId = (payload as { userId?: string; sub?: string }).userId ?? payload.sub;
  if (!userId) {
    throw new Error('Invalid token payload');
  }

  return { userId };
}

type Channel = 'feed' | 'markets' | 'breaking-news' | 'upcoming-events' | string;

async function edgePoll(channel: string, count: number = 10): Promise<string[]> {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!restUrl || !restToken) {
    return [];
  }

  try {
    const response = await fetch(restUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${restToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['LPOP', `sse:${channel}`, count]),
    });

    if (!response.ok) {
      logger.warn('Edge SSE poll failed', { status: response.status }, 'edge-sse');
      return [];
    }

    const json = (await response.json()) as { result: string | string[] | null };
    if (!json.result) return [];
    return Array.isArray(json.result) ? json.result : [json.result];
  } catch (error) {
    logger.warn('Edge SSE poll error', { error }, 'edge-sse');
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
            const messages = await edgePoll(channel, 10);
            for (const raw of messages) {
              try {
                const message = JSON.parse(raw) as {
                  channel: Channel;
                  type: string;
                  data: Record<string, unknown>;
                  timestamp: number;
                };
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
