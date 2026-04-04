'use client';

export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

/**
 * Legacy rewards page — handles OAuth callbacks for social linking,
 * then redirects to /leaderboard (rewards are now in the leaderboard sidebar)
 * or /achievements for the achievements tab.
 */
export default function RewardsPage() {
  const router = useRouter();
  const { ready, authenticated, login, refresh } = useAuth();
  const searchParams = useSearchParams();

  // Auth required — redirect to feed and show login
  useEffect(() => {
    if (!ready || authenticated) return;
    router.push('/feed');
    const timer = setTimeout(() => login(), 500);
    return () => clearTimeout(timer);
  }, [ready, authenticated, router, login]);

  // Handle OAuth callback from Twitter/Discord linking
  useEffect(() => {
    const success = searchParams.get('success');
    const points = searchParams.get('points');
    const errorParam = searchParams.get('error');

    if (success === 'twitter_linked' && points) {
      toast.success(`X account linked! +${points} points awarded`);
      window.dispatchEvent(new CustomEvent('rewards-updated'));
      refresh();
    } else if (success === 'discord_linked' && points) {
      toast.success(`Discord account linked! +${points} points awarded`);
      window.dispatchEvent(new CustomEvent('rewards-updated'));
      refresh();
    } else if (errorParam) {
      const errorMessages: Record<string, string> = {
        twitter_already_linked:
          'This X account is already linked to another user',
        discord_already_linked:
          'This Discord account is already linked to another user',
        token_exchange_failed: 'Failed to authenticate. Please try again.',
        invalid_state: 'Session expired. Please try again.',
        state_expired: 'Session expired. Please try again.',
      };
      toast.error(
        errorMessages[errorParam] || 'An error occurred. Please try again.'
      );
    }

    // Redirect based on tab param
    const tab = searchParams.get('tab');
    if (tab === 'achievements') {
      router.replace('/achievements');
    } else {
      router.replace('/leaderboard');
    }
  }, [searchParams, refresh, router]);

  return null;
}
