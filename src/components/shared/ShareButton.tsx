/**
 * Share button component with tracking and points rewards.
 *
 * Provides sharing functionality to Twitter/X, Farcaster (with Mini App SDK
 * support), native share, and copy link. Tracks shares for authenticated users
 * and awards points. Shows verification modal after sharing to verify the
 * share was posted. Supports Farcaster Mini App context for native sharing.
 *
 * @example
 * ```tsx
 * <ShareButton
 *   contentType="post"
 *   contentId="123"
 *   text="Check out this post!"
 * />
 * ```
 */

import { useFarcasterMiniApp } from '@/components/providers/FarcasterMiniAppProvider';
import { trackExternalShare } from '@/lib/share/trackExternalShare';
import { useAuth } from '@/hooks/useAuth';
import { Check, Link as LinkIcon, Share2, Twitter } from 'lucide-react';
import { useState } from 'react';
import { ShareVerificationModal } from './ShareVerificationModal';

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

/**
 * Props for ShareButton component.
 */
type ShareButtonProps = {
  contentType: 'post' | 'profile' | 'market' | 'referral' | 'leaderboard';
  contentId?: string;
  url?: string;
  text?: string;
  className?: string;
};

/**
 * Share button component.
 *
 * @param props - ShareButton component props
 * @returns Share button element with dropdown menu
 */
export function ShareButton({
  contentType,
  contentId,
  url,
  text,
  className = '',
}: ShareButtonProps) {
  const { authenticated, user } = useAuth();
  const { isMiniApp, share: miniAppShare } = useFarcasterMiniApp();
  const [showMenu, setShowMenu] = useState(false);
  const [shared, setShared] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<{
    shareId: string;
    platform: 'twitter' | 'farcaster';
  } | null>(null);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = text || 'Check this out!';

  const handleShareToTwitter = async () => {
    // Check if shareText already contains the URL to avoid duplication
    const textContainsUrl = shareText.includes(shareUrl);
    const twitterUrl = textContainsUrl
      ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
      : `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');

    const result =
      authenticated && user
        ? await trackExternalShare({
            platform: 'twitter',
            contentType,
            contentId,
            url: shareUrl,
            userId: user.id,
          })
        : { shareActionId: null, pointsAwarded: 0, alreadyAwarded: false };
    if (result.pointsAwarded > 0) {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
    const shareId = result.shareActionId;
    setShowMenu(false);

    // Show verification modal after a short delay (gives user time to post)
    if (shareId && user) {
      setTimeout(() => {
        setPendingVerification({ shareId, platform: 'twitter' });
        setShowVerification(true);
      }, 3000); // 3 second delay
    }
  };

  const handleShareToFarcaster = async () => {
    // Use Mini App SDK share if in mini app context
    if (isMiniApp) {
      try {
        await miniAppShare({
          text: shareText,
          url: shareUrl,
        });

        // Track the share
        if (authenticated && user) {
          void trackExternalShare({
            platform: 'farcaster',
            contentType,
            contentId,
            url: shareUrl,
            userId: user.id,
          });
        }
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        setShowMenu(false);
        return;
      } catch (error) {
        console.error('Mini App share failed:', error);
        // Fall through to regular Warpcast compose
      }
    }

    // Warpcast compose URL format
    const castText = `${shareText}\n\n${shareUrl}`;
    const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`;
    window.open(warpcastUrl, '_blank', 'width=550,height=600');

    const result =
      authenticated && user
        ? await trackExternalShare({
            platform: 'farcaster',
            contentType,
            contentId,
            url: shareUrl,
            userId: user.id,
          })
        : { shareActionId: null, pointsAwarded: 0, alreadyAwarded: false };
    if (result.pointsAwarded > 0) {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
    const shareId = result.shareActionId;
    setShowMenu(false);

    // Show verification modal after a short delay (gives user time to post)
    if (shareId && user) {
      setTimeout(() => {
        setPendingVerification({ shareId, platform: 'farcaster' });
        setShowVerification(true);
      }, 3000); // 3 second delay
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    if (authenticated && user) {
      void trackExternalShare({
        platform: 'link',
        contentType,
        contentId,
        url: shareUrl,
        userId: user.id,
      });
    }
    setShared(true);
    setTimeout(() => setShared(false), 2000);
    setShowMenu(false);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: shareText,
        url: shareUrl,
      });
      if (authenticated && user) {
        void trackExternalShare({
          platform: 'native',
          contentType,
          contentId,
          url: shareUrl,
          userId: user.id,
        });
      }
      setShowMenu(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className={`flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-primary-foreground ${className}`}
        aria-label="Share"
      >
        {shared ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="font-medium text-green-500 text-sm">Shared!</span>
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" />
            <span className="font-medium text-sm">Share</span>
          </>
        )}
      </button>

      {/* Share Menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close share menu"
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
            <button
              type="button"
              onClick={handleShareToTwitter}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-700"
            >
              <Twitter className="h-4 w-4 text-blue-400" />
              <span className="text-gray-200 text-sm">Share to X</span>
            </button>

            <button
              type="button"
              onClick={handleShareToFarcaster}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-700"
            >
              <FarcasterIcon className="h-4 w-4 text-purple-400" />
              <span className="text-gray-200 text-sm">Share to Farcaster</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-700"
            >
              <LinkIcon className="h-4 w-4 text-gray-400" />
              <span className="text-gray-200 text-sm">Copy Link</span>
            </button>

            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-700"
              >
                <Share2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-200 text-sm">Share...</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Verification Modal */}
      {showVerification && pendingVerification && user && (
        <ShareVerificationModal
          isOpen={showVerification}
          onClose={() => {
            setShowVerification(false);
            setPendingVerification(null);
          }}
          shareId={pendingVerification.shareId}
          platform={pendingVerification.platform}
          userId={user.id}
        />
      )}
    </div>
  );
}
