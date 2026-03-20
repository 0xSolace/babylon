'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface PnlPoint {
  time: number;
  value: number;
}

interface PnlHistoryState {
  points: PnlPoint[];
  loading: boolean;
  error: Error | null;
}

export function usePnlHistory(
  userId: string | undefined | null,
  timeframe: string
) {
  const [state, setState] = useState<PnlHistoryState>({
    points: [],
    loading: false,
    error: null,
  });
  const controllerRef = useRef<AbortController | null>(null);

  const fetch_ = useCallback(async () => {
    if (!userId) {
      setState({ points: [], loading: false, error: null });
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(
        `/api/users/${encodeURIComponent(userId)}/pnl-history?range=${encodeURIComponent(timeframe)}`,
        { signal: controller.signal }
      );

      if (controller.signal.aborted) return;

      if (!response.ok) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: new Error('Failed to fetch P&L history'),
        }));
        return;
      }

      const data = await response.json();
      if (controller.signal.aborted) return;

      setState({
        points: data.data?.points ?? data.points ?? [],
        loading: false,
        error: null,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          err instanceof Error ? err : new Error('Failed to fetch P&L history'),
      }));
    }
  }, [userId, timeframe]);

  useEffect(() => {
    void fetch_();
    return () => {
      controllerRef.current?.abort();
    };
  }, [fetch_]);

  return state;
}
