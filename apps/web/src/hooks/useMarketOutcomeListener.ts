'use client';

import { logger } from '@babylon/shared';
import { useCallback } from 'react';
import { useOutcomeNotification } from '@/components/providers/OutcomeNotificationProvider';
import { useAuth } from '@/hooks/useAuth';
import type { Channel } from '@/hooks/useSSE';
import { useSSEChannel } from '@/hooks/useSSE';

interface MarketResolvedData {
  type: string;
  marketId: string;
  marketName: string;
  outcome: 'win' | 'loss';
  points: number;
  agentName?: string;
  deepLink: string;
}

function isMarketResolvedData(data: unknown): data is MarketResolvedData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.marketId === 'string' &&
    typeof d.marketName === 'string' &&
    (d.outcome === 'win' || d.outcome === 'loss') &&
    typeof d.points === 'number' &&
    typeof d.deepLink === 'string'
  );
}

/**
 * Subscribes to the `notifications:{userId}` SSE channel and forwards
 * `market_resolved` events to the outcome notification provider.
 *
 * Mount this inside OutcomeNotificationProvider so `useOutcomeNotification`
 * is in scope. The channel is null (no-op) when the user is unauthenticated.
 */
export function useMarketOutcomeListener(): void {
  const { user } = useAuth();
  const { showOutcome } = useOutcomeNotification();

  const channel: Channel | null = user?.id
    ? (`notifications:${user.id}` as Channel)
    : null;

  const handleMessage = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type !== 'market_resolved') return;

      if (!isMarketResolvedData(data)) {
        logger.warn(
          'Malformed market_resolved SSE event — skipping',
          { data },
          'useMarketOutcomeListener'
        );
        return;
      }

      showOutcome({
        marketId: data.marketId,
        marketName: data.marketName,
        outcome: data.outcome,
        points: data.points,
        agentName:
          typeof data.agentName === 'string' ? data.agentName : undefined,
        deepLink: data.deepLink,
      });
    },
    [showOutcome]
  );

  useSSEChannel(channel, handleMessage);
}
