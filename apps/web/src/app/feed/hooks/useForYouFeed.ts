import { useFeed } from './useFeed';

interface UseForYouFeedOptions {
  enabled?: boolean;
}

const FOR_YOU_CONFIG = {
  endpoint: '/api/feed/for-you',
  requiresAuth: true,
  logContext: 'useForYouFeed',
  feedName: 'For You',
} as const;

export function useForYouFeed(options: UseForYouFeedOptions = {}) {
  return useFeed(FOR_YOU_CONFIG, options);
}
