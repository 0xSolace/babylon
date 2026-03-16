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
  const isMountedRef = useRef(true);
  const hasFetched = useRef(false);
  const sseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);
  // Tracks whether a server loadMore is already in-flight (avoids duplicate
  // requests that race when the sentinel fires multiple times quickly).
  const loadingMoreRef = useRef(false);

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
        setStories(items);
        storiesRef.current = items;
        setHasMore(data.hasMore ?? false);
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
    [fetchPage]
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
    if (loadingMoreRef.current || !hasMore) return;
    loadMoreAbortRef.current?.abort();
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;
    const offset = storiesRef.current.length;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    void fetchPage(offset, controller.signal)
      .then((data) => {
        if (!data || controller.signal.aborted) return;
        const next = data.stories ?? [];
        setStories((prev) => {
          const merged = [...prev, ...next];
          storiesRef.current = merged;
          return merged;
        });
        setHasMore(data.hasMore ?? false);
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
  }, [fetchPage, hasMore]);

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
