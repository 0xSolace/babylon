'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AchievementsTab } from '@/components/rewards/rewards/achievements-tab';
import { ChallengesTab } from '@/components/rewards/rewards/challenges-tab';
import { OverviewTab } from '@/components/rewards/rewards/overview-tab';
import { TabNavigation } from '@/components/rewards/rewards/tab-navigation';
import { PageContainer } from '@/components/shared/PageContainer';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'overview' | 'achievements' | 'challenges';

export default function RewardsPage() {
  const router = useRouter();
  const { ready, authenticated, getAccessToken, login, refresh } = useAuth();

  // Auth required — redirect to feed and show login
  useEffect(() => {
    if (!ready || authenticated) return;
    router.push('/feed');
    const timer = setTimeout(() => login(), 500);
    return () => clearTimeout(timer);
  }, [ready, authenticated, router, login]);

  const searchParams = useSearchParams();

  // Handle OAuth callback from Twitter/Discord linking
  useEffect(() => {
    const success = searchParams.get('success');
    const points = searchParams.get('points');
    const errorParam = searchParams.get('error');

    if (success === 'twitter_linked' && points) {
      toast.success(`X account linked! +${points} points awarded`);
      window.dispatchEvent(new CustomEvent('rewards-updated'));
      refresh();
      window.history.replaceState({}, '', '/rewards');
    } else if (success === 'discord_linked' && points) {
      toast.success(`Discord account linked! +${points} points awarded`);
      window.dispatchEvent(new CustomEvent('rewards-updated'));
      refresh();
      window.history.replaceState({}, '', '/rewards');
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
      window.history.replaceState({}, '', '/rewards');
    }
  }, [searchParams, refresh]);

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const handleClaim = async (): Promise<boolean> => {
    if (!authenticated) return false;
    const token = await getAccessToken();
    if (!token) return false;
    const res = await fetch('/api/users/daily-login', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const result = await res.json();
      toast.success(
        `+${result.totalAwarded} points! Streak: ${result.streak} days`
      );
      window.dispatchEvent(new CustomEvent('rewards-updated'));
      refresh();
      return true;
    }
    const errData = await res.json().catch(() => null);
    toast.error(errData?.error ?? 'Failed to claim daily reward');
    return false;
  };

  const handleViewAchievements = () => {
    setActiveTab('achievements');
  };

  return (
    <PageContainer noPadding className="flex flex-col">
      <div className="w-full">
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="p-4">
          {activeTab === 'overview' && <OverviewTab onClaim={handleClaim} />}
          {activeTab === 'achievements' && <AchievementsTab />}
          {activeTab === 'challenges' && (
            <ChallengesTab onViewAchievements={handleViewAchievements} />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
