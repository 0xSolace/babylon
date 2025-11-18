/**
 * Share and earn modal component for sharing content with points rewards.
 *
 * Provides a modal interface for sharing to Twitter/X and Farcaster with
 * points tracking. Shows share status, earned points, and handles share
 * verification. Checks platform configuration and existing shares on mount.
 *
 * @example
 * ```tsx
 * <ShareEarnModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   contentType="profile"
 *   contentId="123"
 * />
 * ```
 */

import { logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { Check, Lock, Twitter, X as XIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Farcaster icon component
function FarcasterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1000 1000" fill="currentColor">
      <title>Farcaster icon</title>
      <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" />
      <path d="M128.889 253.333L157.778 351.111H182.222V844.444H128.889V253.333Z" />
      <path d="M871.111 253.333L842.222 351.111H817.778V844.444H871.111V253.333Z" />
    </svg>
  );
}

type ShareEarnModalProps = {
  isOpen: boolean;
  onClose: () => void;
  contentType: 'post' | 'profile' | 'market' | 'referral' | 'leaderboard';
  contentId?: string;
  url?: string;
  text?: string;
};

/**
 * Share status tracking for each platform.
 */
type ShareStatus = {
  twitter: { shared: boolean; earned: boolean; loading: boolean };
  farcaster: { shared: boolean; earned: boolean; loading: boolean };
};

/**
 * Share and earn modal component.
 *
 * @param props - ShareEarnModal component props
 * @returns Share and earn modal element or null if not open
 */
export function ShareEarnModal({
  isOpen,
  onClose,
  contentType,
  contentId,
  url,
  text,
}: ShareEarnModalProps) {
  const { authenticated, user } = useAuth();
  const [shareStatus, setShareStatus] = useState<ShareStatus>({
    twitter: { shared: false, earned: false, loading: false },
    farcaster: { shared: false, earned: false, loading: false },
  });
  const [isTwitterConfigured, setIsTwitterConfigured] = useState(true); // Default to true, check on mount

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = text || 'Check this out!';

  const checkConfiguration = useCallback(async () => {
    const response = await fetch('/api/auth/credentials/status');
    if (response.ok) {
      const data = (await response.json()) as {
        twitter?: boolean;
        farcaster?: boolean;
      };
      setIsTwitterConfigured(data.twitter || false);
    } else {
      logger.warn(
        'Failed to check credentials status',
        { status: response.status },
        'ShareEarnModal'
      );
      // Default to true to not block users if check fails
      setIsTwitterConfigured(true);
    }
  }, []);

  const checkExistingShares = useCallback(async () => {
    if (!user) return;

    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null;
    if (!token) return;

    // Check for existing share actions
    // This would require a new API endpoint or passing this data in
    // For now, we'll check locally based on the response when sharing
  }, [user]);

  // Check configuration and existing shares on mount
  useEffect(() => {
    if (isOpen) {
      checkConfiguration();
      if (authenticated && user) {
        checkExistingShares();
      }
    }
  }, [isOpen, authenticated, user, checkConfiguration, checkExistingShares]);

  const trackShare = async (platform: 'twitter' | 'farcaster'): Promise<boolean> => {
    if (!authenticated || !user) {
      logger.warn('User not authenticated, cannot track share', undefined, 'ShareEarnModal');
      return false;
    }

    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null;
    if (!token) {
      logger.warn('No access token available', undefined, 'ShareEarnModal');
      return false;
    }

    const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/share`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform,
        contentType,
        contentId,
        url: shareUrl,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const pointsAwarded = data.points?.awarded > 0;
      const alreadyAwarded = data.points?.alreadyAwarded;

      if (pointsAwarded) {
        logger.info(
          `Earned ${data.points.awarded} points for sharing to ${platform}`,
          { platform, points: data.points.awarded },
          'ShareEarnModal'
        );
      }

      return pointsAwarded || alreadyAwarded;
    }

    return false;
  };

  const handleShareToTwitter = async () => {
    if (shareStatus.twitter.shared || shareStatus.twitter.loading) return;

    setShareStatus((prev) => ({
      ...prev,
      twitter: { ...prev.twitter, loading: true },
    }));

    // Check if shareText already contains the URL to avoid duplication
    const textContainsUrl = shareText.includes(shareUrl);
    const twitterUrl = textContainsUrl
      ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
      : `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');

    const earned = await trackShare('twitter');

    setShareStatus((prev) => ({
      ...prev,
      twitter: { shared: true, earned, loading: false },
    }));
  };

  const handleShareToFarcaster = async () => {
    if (shareStatus.farcaster.shared || shareStatus.farcaster.loading) return;

    setShareStatus((prev) => ({
      ...prev,
      farcaster: { ...prev.farcaster, loading: true },
    }));

    const castText = `${shareText}\n\n${shareUrl}`;
    const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`;
    window.open(warpcastUrl, '_blank', 'width=550,height=600');

    const earned = await trackShare('farcaster');

    setShareStatus((prev) => ({
      ...prev,
      farcaster: { shared: true, earned, loading: false },
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close share modal"
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-gray-700 border-b p-6">
            <h2 className="font-bold text-primary-foreground text-xl">Share & Earn</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-gray-800"
            >
              <XIcon className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4 p-6">
            <p className="mb-4 text-gray-400 text-sm">Share to earn +1000 points per platform</p>

            {/* Twitter Share */}
            <button
              type="button"
              onClick={handleShareToTwitter}
              disabled={
                !isTwitterConfigured || shareStatus.twitter.shared || shareStatus.twitter.loading
              }
              className={`flex w-full items-center gap-4 rounded-lg border p-4 transition-all ${
                !isTwitterConfigured
                  ? 'cursor-not-allowed border-gray-700/50 bg-gray-800/50 opacity-60'
                  : shareStatus.twitter.shared
                    ? 'cursor-not-allowed border-green-500/30 bg-green-500/10'
                    : shareStatus.twitter.loading
                      ? 'cursor-wait border-gray-700 bg-gray-800'
                      : 'cursor-pointer border-gray-700 bg-gray-800 hover:bg-gray-750'
              }`}
            >
              <Twitter
                className={`h-6 w-6 ${
                  !isTwitterConfigured
                    ? 'text-gray-600'
                    : shareStatus.twitter.shared
                      ? 'text-blue-400'
                      : 'text-gray-400'
                }`}
              />
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <h3
                    className={`font-semibold text-sm ${!isTwitterConfigured ? 'text-gray-500' : 'text-foreground'}`}
                  >
                    Share to X
                  </h3>
                  {!isTwitterConfigured && (
                    <span className="rounded bg-gray-700/50 px-2 py-0.5 text-gray-400 text-xs">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-xs">
                  {!isTwitterConfigured
                    ? 'Twitter integration coming soon'
                    : shareStatus.twitter.loading
                      ? 'Processing...'
                      : shareStatus.twitter.shared
                        ? shareStatus.twitter.earned
                          ? 'Already earned points'
                          : 'Shared'
                        : 'Share your profile'}
                </p>
              </div>
              {!isTwitterConfigured ? (
                <Lock className="h-5 w-5 text-gray-600" />
              ) : shareStatus.twitter.shared ? (
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  {shareStatus.twitter.earned && (
                    <span className="font-semibold text-green-500 text-xs">+1000</span>
                  )}
                </div>
              ) : null}
            </button>

            {/* Farcaster Share */}
            <button
              type="button"
              onClick={handleShareToFarcaster}
              disabled={shareStatus.farcaster.shared || shareStatus.farcaster.loading}
              className={`flex w-full items-center gap-4 rounded-lg border p-4 transition-all ${
                shareStatus.farcaster.shared
                  ? 'cursor-not-allowed border-green-500/30 bg-green-500/10'
                  : shareStatus.farcaster.loading
                    ? 'cursor-wait border-gray-700 bg-gray-800'
                    : 'cursor-pointer border-gray-700 bg-gray-800 hover:bg-gray-750'
              }`}
            >
              <FarcasterIcon
                className={`h-6 w-6 ${shareStatus.farcaster.shared ? 'text-purple-400' : 'text-gray-400'}`}
              />
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-primary-foreground text-sm">
                  Share to Farcaster
                </h3>
                <p className="text-gray-400 text-xs">
                  {shareStatus.farcaster.loading
                    ? 'Processing...'
                    : shareStatus.farcaster.shared
                      ? shareStatus.farcaster.earned
                        ? 'Already earned points'
                        : 'Shared'
                      : 'Share your profile'}
                </p>
              </div>
              {shareStatus.farcaster.shared && (
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  {shareStatus.farcaster.earned && (
                    <span className="font-semibold text-green-500 text-xs">+1000</span>
                  )}
                </div>
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="border-gray-700 border-t p-6">
            <p className="text-center text-gray-500 text-xs">
              Points are awarded once per platform
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
