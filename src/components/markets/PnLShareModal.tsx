'use client';

import { CategoryPnLShareCard } from '@/components/markets/CategoryPnLShareCard';
import { PortfolioPnLShareCard } from '@/components/markets/PortfolioPnLShareCard';
import { trackExternalShare } from '@/lib/share/trackExternalShare';
import type { PortfolioPnLSnapshot } from '@/hooks/usePortfolioPnL';
import { useTwitterAuth } from '@/hooks/useTwitterAuth';
import type { User } from '@/stores/authStore';
import { Download, LogOut, Twitter, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type MarketCategory = 'perps' | 'predictions';

type CategoryPnLData = {
  unrealizedPnL: number;
  positionCount: number;
  totalValue?: number;
  categorySpecific?: {
    openInterest?: number;
    totalShares?: number;
    totalInvested?: number;
  };
};

type PnLShareModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: 'portfolio' | 'category';
  portfolioData?: PortfolioPnLSnapshot | null;
  categoryData?: CategoryPnLData | null;
  category?: MarketCategory;
  user: User | null;
};

function FarcasterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1000 1000" fill="currentColor" aria-hidden="true">
      <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" />
      <path d="M128.889 253.333L157.778 351.111H182.222V844.444H128.889V253.333Z" />
      <path d="M871.111 253.333L842.222 351.111H817.778V844.444H871.111V253.333Z" />
    </svg>
  );
}

const categoryLabels: Record<MarketCategory, string> = {
  perps: 'Perpetual Futures',
  predictions: 'Prediction Markets',
};

export function PnLShareModal({
  isOpen,
  onClose,
  type,
  portfolioData,
  categoryData,
  category = 'perps',
  user,
}: PnLShareModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [sharing, setSharing] = useState<'twitter' | 'farcaster' | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isPostingToTwitter, setIsPostingToTwitter] = useState(false);
  const [showTwitterConfirm, setShowTwitterConfirm] = useState(false);
  const [tweetText, setTweetText] = useState('');
  const offscreenCardRef = useRef<HTMLDivElement>(null);

  // Twitter auth hook
  const {
    authStatus,
    loading: twitterAuthLoading,
    connectTwitter,
    disconnectTwitter,
  } = useTwitterAuth();

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/markets` : 'https://babylon.market';

  const canShare = Boolean(user && (type === 'portfolio' ? portfolioData : categoryData));

  const data = type === 'portfolio' ? portfolioData : categoryData;
  const categoryLabel = type === 'category' && category ? categoryLabels[category] : '';
  const contentId = type === 'portfolio' ? 'portfolio-pnl' : `${category}-pnl`;

  // Generate shareable link with OG embed
  const shareableLink = useMemo(() => {
    if (!user?.id) return null;
    const appUrl =
      typeof window !== 'undefined' ? window.location.origin : 'https://babylon.market';
    return `${appUrl}/share/pnl/${user.id}`;
  }, [user?.id]);

  const shareText = useMemo(() => {
    const link = shareableLink || shareUrl;
    if (type === 'portfolio' && portfolioData) {
      return `My Babylon P&L is ${portfolioData.totalPnL >= 0 ? '+' : ''}$${Math.abs(portfolioData.totalPnL).toFixed(2)}. Trading narratives, sharing the upside.\n\n${link}`;
    }
    if (type === 'category' && categoryData) {
      return `My ${categoryLabel} P&L on Babylon is ${categoryData.unrealizedPnL >= 0 ? '+' : ''}$${Math.abs(categoryData.unrealizedPnL).toFixed(2)}. Trading narratives, sharing the upside.\n\n${link}`;
    }
    return type === 'portfolio'
      ? `Check out the markets on Babylon.\n\n${link}`
      : `Check out ${categoryLabel} on Babylon.\n\n${link}`;
  }, [type, portfolioData, categoryData, categoryLabel, shareUrl, shareableLink]);

  // Set initial tweet text
  useEffect(() => {
    if (shareText && !tweetText) {
      setTweetText(shareText);
    }
  }, [shareText, tweetText]);

  // Generate preview image when modal opens or data changes
  useEffect(() => {
    if (!isOpen || !canShare || !offscreenCardRef.current) {
      setPreviewImageUrl(null);
      return;
    }

    const generatePreview = async () => {
      const card = offscreenCardRef.current;
      if (!card) return;

      setIsGeneratingImage(true);
      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toPng(card, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#050816',
      });
      setPreviewImageUrl(dataUrl);
      setIsGeneratingImage(false);
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(generatePreview, 100);
    return () => clearTimeout(timeoutId);
  }, [isOpen, canShare]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!previewImageUrl) return;

    setIsDownloading(true);

    const link = document.createElement('a');
    link.href = previewImageUrl;
    link.download = `babylon-${type === 'portfolio' ? 'pnl' : `${category}-pnl`}-${Date.now()}.png`;
    link.click();

    void trackExternalShare({
      platform: 'download',
      contentType: 'market',
      contentId,
      url: shareUrl,
      userId: user?.id,
    });

    toast.success('P&L card downloaded');
    setIsDownloading(false);
  };

  const handleShare = async (platform: 'twitter' | 'farcaster') => {
    if (!canShare || !user || !data) return;

    setSharing(platform);

    if (platform === 'twitter') {
      if (!authStatus?.connected) {
        toast.info('Please connect your X account to share');
        connectTwitter(window.location.pathname);
        setSharing(null);
        return;
      }

      setShowTwitterConfirm(true);
      setSharing(null);
    } else {
      const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(shareableLink || shareUrl)}`;
      window.open(warpcastUrl, '_blank', 'width=550,height=600');

      await trackExternalShare({
        platform,
        contentType: 'market',
        contentId,
        url: shareableLink || shareUrl,
        userId: user?.id,
      });

      setSharing(null);
    }
  };

  const handleTwitterPost = async () => {
    if (!user || !authStatus?.connected || !shareableLink) return;

    setIsPostingToTwitter(true);

    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null;
    if (!token) {
      setIsPostingToTwitter(false);
      return;
    }

    toast.info('Posting to X...');

    const tweetResponse = await fetch('/api/twitter/tweet', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: tweetText,
        contentType: 'market',
        contentId,
      }),
    });

    if (!tweetResponse.ok) {
      const error = await tweetResponse.json();
      toast.error(error.error || 'Failed to post tweet');
      setIsPostingToTwitter(false);
      return;
    }

    const tweetData = (await tweetResponse.json()) as { tweetUrl: string };

    toast.success('Successfully shared to X!');

    await trackExternalShare({
      platform: 'twitter',
      contentType: 'market',
      contentId,
      url: shareableLink,
      userId: user.id,
    });

    if (tweetData.tweetUrl) {
      window.open(tweetData.tweetUrl, '_blank');
    }

    setShowTwitterConfirm(false);
    onClose();
    setIsPostingToTwitter(false);
  };

  const handleDisconnectTwitter = async () => {
    await disconnectTwitter();
    toast.success('X account disconnected');
  };

  const modalTitle = type === 'portfolio' ? 'Share Your P&L' : `Share Your ${categoryLabel} P&L`;

  const modalSubtitle =
    type === 'portfolio'
      ? 'Show off your Babylon performance card'
      : `Show off your Babylon ${category} performance`;

  return (
    <>
      {/* Off-screen card for rendering to image */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={offscreenCardRef}>
          {canShare && user && type === 'portfolio' && portfolioData && (
            <PortfolioPnLShareCard data={portfolioData} user={user} />
          )}
          {canShare && user && type === 'category' && categoryData && (
            <CategoryPnLShareCard category={category} data={categoryData} user={user} />
          )}
        </div>
      </div>

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#050816] shadow-2xl">
          <div className="flex items-center justify-between border-white/10 border-b px-6 py-4">
            <div>
              <h2 className="font-semibold text-primary-foreground text-xl">{modalTitle}</h2>
              <p className="text-primary-foreground/60 text-xs">{modalSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-primary-foreground/70 transition hover:bg-white/10 hover:text-primary-foreground"
              aria-label="Close share modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col gap-4 px-6 py-6">
            {/* Preview Section */}
            <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-xl border border-white/10 bg-black/50">
              {canShare ? (
                isGeneratingImage ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      <p className="text-primary-foreground/60 text-sm">Generating preview...</p>
                    </div>
                  </div>
                ) : previewImageUrl ? (
                  <Image
                    src={previewImageUrl}
                    alt="P&L Card Preview"
                    className="h-full w-full object-contain"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary-foreground/60 text-sm">
                    Preparing preview...
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center text-primary-foreground/70 text-sm">
                  Sign in to generate your personalized P&amp;L card.
                </div>
              )}
            </div>

            {/* Twitter Connection Status */}
            {authStatus?.connected && (
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                <div className="flex items-center gap-2">
                  <Twitter className="h-4 w-4 text-sky-400" />
                  <span className="text-foreground text-sm">
                    Connected as <span className="font-semibold">@{authStatus.screenName}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectTwitter}
                  className="inline-flex items-center gap-1 text-foreground/60 text-xs transition hover:text-foreground"
                >
                  <LogOut className="h-3 w-3" />
                  Disconnect
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!canShare || isDownloading || !previewImageUrl}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-[#050816] text-sm transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </button>

              <button
                type="button"
                onClick={() => handleShare('twitter')}
                disabled={!canShare || sharing === 'twitter' || twitterAuthLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 font-semibold text-primary-foreground text-sm transition hover:border-white/30 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Twitter className="h-4 w-4 text-sky-400" />
                <span className="hidden sm:inline">Share to X</span>
              </button>

              <button
                type="button"
                onClick={() => handleShare('farcaster')}
                disabled={!canShare || sharing === 'farcaster'}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 font-semibold text-primary-foreground text-sm transition hover:border-white/30 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FarcasterIcon className="h-4 w-4 text-purple-400" />
                <span className="hidden sm:inline">Share to Farcaster</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Twitter Confirmation Modal */}
      {showTwitterConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onClick={(event) => {
            if (event.target === event.currentTarget && !isPostingToTwitter) {
              setShowTwitterConfirm(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !isPostingToTwitter) {
              event.preventDefault();
              setShowTwitterConfirm(false);
            }
          }}
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#050816] shadow-2xl">
            <div className="flex items-center justify-between border-white/10 border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <Twitter className="h-5 w-5 text-sky-400" />
                <h2 className="font-semibold text-foreground text-xl">Share to X</h2>
              </div>
              <button
                type="button"
                onClick={() => !isPostingToTwitter && setShowTwitterConfirm(false)}
                disabled={isPostingToTwitter}
                className="rounded-lg p-2 text-foreground/70 transition hover:bg-white/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-6 py-6">
              {/* Preview */}
              <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-xl border border-white/10 bg-black/50">
                {previewImageUrl ? (
                  <Image
                    src={previewImageUrl}
                    alt="Tweet Preview"
                    className="h-full w-full object-contain"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-foreground/60 text-sm">
                    No preview available
                  </div>
                )}
              </div>

              {/* Tweet Text Editor */}
              <div>
                <label
                  htmlFor="tweet-text"
                  className="mb-2 block font-medium text-foreground/80 text-sm"
                >
                  Tweet Text
                </label>
                <textarea
                  id="tweet-text"
                  value={tweetText}
                  onChange={(e) => setTweetText(e.target.value)}
                  maxLength={280}
                  rows={4}
                  disabled={isPostingToTwitter}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-foreground placeholder-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="What's on your mind?"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-foreground/60 text-xs">
                    {tweetText.length} / 280 characters
                  </span>
                  {tweetText.length > 280 && (
                    <span className="text-red-400 text-xs">Text is too long</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowTwitterConfirm(false)}
                  disabled={isPostingToTwitter}
                  className="rounded-lg border border-white/10 px-6 py-2.5 text-foreground transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTwitterPost}
                  disabled={isPostingToTwitter || !tweetText.trim() || tweetText.length > 280}
                  className="flex items-center gap-2 rounded-lg bg-sky-500 px-6 py-2.5 font-medium text-foreground transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPostingToTwitter ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Twitter className="h-4 w-4" />
                      Post
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
