/**
 * Feed store for optimistic post updates
 *
 * This store manages optimistic UI updates for the feed, allowing new posts
 * to appear immediately before server confirmation. Uses a callback pattern
 * so the feed component can respond to new optimistic posts.
 *
 * @example
 * ```tsx
 * // In feed component
 * const { registerOptimisticPostCallback, unregisterOptimisticPostCallback } = useFeedStore();
 *
 * useEffect(() => {
 *   registerOptimisticPostCallback((post) => {
 *     // Add post to feed immediately
 *     setPosts(prev => [post, ...prev]);
 *   });
 *   return () => unregisterOptimisticPostCallback();
 * }, []);
 *
 * // When creating a post
 * const { addOptimisticPost } = useFeedStore();
 * addOptimisticPost(newPost);
 * ```
 */

import type { FeedPost } from '@babylon/shared';
import { create } from 'zustand';

type OptimisticPostCallback = (post: FeedPost) => void;

interface FeedStore {
  /** Currently registered callback for optimistic post updates */
  optimisticPostCallback: OptimisticPostCallback | null;
  /** Set of optimistic post IDs (for deduplication when server responds) */
  optimisticPostIds: Set<string>;

  /** Register a callback to be called when an optimistic post is added */
  registerOptimisticPostCallback: (callback: OptimisticPostCallback) => void;
  /** Unregister the optimistic post callback */
  unregisterOptimisticPostCallback: () => void;
  /** Add an optimistic post - triggers the callback if registered */
  addOptimisticPost: (post: FeedPost) => void;
  /** Check if a post ID is optimistic (not yet confirmed by server) */
  isOptimisticPost: (postId: string) => boolean;
  /** Remove an optimistic post ID (when server confirms) */
  confirmPost: (postId: string) => void;
  /** Clear all optimistic post tracking */
  clearOptimisticPosts: () => void;
}

export const useFeedStore = create<FeedStore>((set, get) => ({
  optimisticPostCallback: null,
  optimisticPostIds: new Set(),

  registerOptimisticPostCallback: (callback: OptimisticPostCallback) => {
    set({ optimisticPostCallback: callback });
  },

  unregisterOptimisticPostCallback: () => {
    set({ optimisticPostCallback: null });
  },

  addOptimisticPost: (post: FeedPost) => {
    const { optimisticPostCallback, optimisticPostIds } = get();

    // Track this as an optimistic post
    const newIds = new Set(optimisticPostIds);
    newIds.add(post.id);
    set({ optimisticPostIds: newIds });

    // Trigger the callback if registered
    if (optimisticPostCallback) {
      optimisticPostCallback(post);
    }
  },

  isOptimisticPost: (postId: string) => {
    return get().optimisticPostIds.has(postId);
  },

  confirmPost: (postId: string) => {
    const { optimisticPostIds } = get();
    const newIds = new Set(optimisticPostIds);
    newIds.delete(postId);
    set({ optimisticPostIds: newIds });
  },

  clearOptimisticPosts: () => {
    set({ optimisticPostIds: new Set() });
  },
}));
