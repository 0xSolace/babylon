import { logger, type FeedEventPayload } from '@babylon/shared';
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

const FLUSH_DELAY_MS = 750;
const MAX_BATCH_SIZE = 20;
const MAX_RETRY_ATTEMPTS = 3;

interface QueuedFeedEvent {
  payload: FeedEventPayload;
  attempts: number;
}

export function useFeedEventTracker() {
  const { authenticated, getAccessToken } = useAuth();
  const queueRef = useRef<QueuedFeedEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = useRef(false);

  const requeueBatch = useCallback(
    (batch: QueuedFeedEvent[], reason: string) => {
      const retryable = batch
        .map((item) => ({
          ...item,
          attempts: item.attempts + 1,
        }))
        .filter((item) => item.attempts <= MAX_RETRY_ATTEMPTS);

      const droppedCount = batch.length - retryable.length;
      if (droppedCount > 0) {
        logger.warn(
          'Dropped feed events after exceeding retry limit',
          { droppedCount, reason, maxAttempts: MAX_RETRY_ATTEMPTS },
          'useFeedEventTracker'
        );
      }

      if (retryable.length > 0) {
        queueRef.current.unshift(...retryable);
      }
    },
    []
  );

  const flush = useCallback(async () => {
    if (!authenticated || isFlushingRef.current || queueRef.current.length === 0) {
      return;
    }

    isFlushingRef.current = true;
    const batch = queueRef.current.splice(0, MAX_BATCH_SIZE);

    try {
      const token = await getAccessToken();
      if (!token) {
        requeueBatch(batch, 'missing_token');
        return;
      }

      const response = await fetch('/api/feed/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ events: batch.map((item) => item.payload) }),
        keepalive: true,
      });

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          requeueBatch(batch, `http_${response.status}`);
        } else {
          logger.warn(
            'Dropped non-retryable feed events batch',
            { status: response.status, batchSize: batch.length },
            'useFeedEventTracker'
          );
        }
      }
    } catch (error) {
      requeueBatch(batch, 'network_error');
      logger.warn(
        'Failed to flush feed events',
        { error, batchSize: batch.length },
        'useFeedEventTracker'
      );
    } finally {
      isFlushingRef.current = false;
      if (queueRef.current.length > 0) {
        flushTimerRef.current = setTimeout(() => {
          void flush();
        }, FLUSH_DELAY_MS);
      } else {
        flushTimerRef.current = null;
      }
    }
  }, [authenticated, getAccessToken, requeueBatch]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      void flush();
    }, FLUSH_DELAY_MS);
  }, [flush]);

  const trackEvent = useCallback(
    (event: FeedEventPayload) => {
      if (!authenticated) return;
      queueRef.current.push({ payload: event, attempts: 0 });
      if (queueRef.current.length >= MAX_BATCH_SIZE) {
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        void flush();
        return;
      }
      scheduleFlush();
    },
    [authenticated, flush, scheduleFlush]
  );

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (queueRef.current.length > 0) {
        void flush();
      }
    };
  }, [flush]);

  return { trackEvent, flush };
}
