import type { NarrativeStory } from '@babylon/shared';
import { logger } from '@babylon/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSSEChannel } from '@/hooks/useSSE';

interface UseForYouFeedOptions {
  enabled?: boolean;
}

export interface UseForYouFeedResult {
  stories: NarrativeStory[];
  ready: boolean;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => void;
}

const PAGE_SIZE = 20;
const ENDPOINT = '/api/feed/for-you';
const SSE_DEBOUNCE_MS = 2_000;
const LOG_CTX = 'useForYouFeed';

interface FeedPageResponse {
  success?: boolean;
  stories?: NarrativeStory[];
  hasMore?: boolean;
  total?: number;
  generatedAt?: string;
}

export function useForYouFeed(
  options: UseForYouFeedOptions = {}
): UseForYouFeedResult {
  const { enabled = true } = options;
  const { authenticated, getAccessToken } = useAuth();

  const [stories, setStories] = useState<NarrativeStory[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storiesRef = useRef<NarrativeStory[]>([]);
  // Initialise false — set true inside the mount effect to correctly handle
  // React 18 strict-mode double-invoke (mount → unmount → remount).
  const isMountedRef = useRef(false);
  const hasFetched = useRef(false);
  const sseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);
  // Tracks in-flight loadMore independently of React state to prevent duplicate
  // requests when the sentinel IntersectionObserver fires rapidly.
  const loadingMoreRef = useRef(false);
  // Mirror of `hasMore` state in a ref so `loadMore` can guard against stale
  // closure values without taking `hasMore` as a dependency (which recreates
  // the function after every page, potentially triggering an extra observer
  // reconnect before the child re-renders).
  const hasMoreRef = useRef(false);

  const syncHasMore = useCallback((value: boolean) => {
    hasMoreRef.current = value;
    setHasMore(value);
  }, []);

  const buildHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!authenticated) return {};
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [authenticated, getAccessToken]);

  const fetchPage = useCallback(
    async (
      offset: number,
      signal: AbortSignal
    ): Promise<FeedPageResponse | null> => {
      const headers = await buildHeaders();
      const url = `${ENDPOINT}?offset=${offset}&limit=${PAGE_SIZE}`;
      const response = await fetch(url, { signal, headers });
      if (signal.aborted) return null;
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json() as Promise<FeedPageResponse>;
    },
    [buildHeaders]
  );

  const loadInitial = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      try {
        const data = await fetchPage(0, signal);
        if (!data || signal.aborted) return;
        const items = data.stories ?? [];
        storiesRef.current = items;
        setStories(items);
        syncHasMore(data.hasMore ?? false);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const msg = 'Failed to load For You feed';
        logger.error(msg, { error: err }, LOG_CTX);
        if (storiesRef.current.length === 0) setError(msg);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setReady(true);
        }
      }
    },
    [fetchPage, syncHasMore]
  );

  const refresh = useCallback(async () => {
    abortControllerRef.current?.abort();
    loadMoreAbortRef.current?.abort();
    loadingMoreRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    await loadInitial(controller.signal);
  }, [loadInitial]);

  const loadMore = useCallback(() => {
    // Use ref-based guards to avoid stale closure values from React state.
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadMoreAbortRef.current?.abort();
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;
    // Read offset from ref (not state) so the value is always current even
    // when `loadMore` is called before the previous setState has committed.
    const offset = storiesRef.current.length;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    void fetchPage(offset, controller.signal)
      .then((data) => {
        if (!data || controller.signal.aborted) return;
        const next = data.stories ?? [];
        // Update ref before setState so subsequent offset reads are correct
        // even if React batches the state update with an in-flight sentinel.
        const merged = [...storiesRef.current, ...next];
        storiesRef.current = merged;
        setStories(merged);
        syncHasMore(data.hasMore ?? false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error(
          'Failed to load more For You stories',
          { error: err },
          LOG_CTX
        );
      })
      .finally(() => {
        loadingMoreRef.current = false;
        if (!controller.signal.aborted && isMountedRef.current) {
          setLoadingMore(false);
        }
      });
  }, [fetchPage, syncHasMore]);

  useSSEChannel(
    enabled ? 'feed' : null,
    useCallback(() => {
      if (!isMountedRef.current) return;
      if (sseDebounceRef.current) clearTimeout(sseDebounceRef.current);
      sseDebounceRef.current = setTimeout(() => {
        if (isMountedRef.current) void refresh();
      }, SSE_DEBOUNCE_MS);
    }, [refresh])
  );

  // Initial fetch and cleanup
  useEffect(() => {
    if (!enabled) {
      hasFetched.current = false;
      setReady(false);
      setLoading(false);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      loadMoreAbortRef.current?.abort();
      loadMoreAbortRef.current = null;
      loadingMoreRef.current = false;
      if (sseDebounceRef.current) {
        clearTimeout(sseDebounceRef.current);
        sseDebounceRef.current = null;
      }
      return;
    }

    isMountedRef.current = true;
    if (hasFetched.current) return;
    hasFetched.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    void loadInitial(controller.signal);

    return () => {
      hasFetched.current = false;
      isMountedRef.current = false;
      controller.abort();
      loadMoreAbortRef.current?.abort();
      if (sseDebounceRef.current) {
        clearTimeout(sseDebounceRef.current);
        sseDebounceRef.current = null;
      }
    };
  }, [enabled, loadInitial]);

  return {
    stories,
    ready,
    loading,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
  };
}
