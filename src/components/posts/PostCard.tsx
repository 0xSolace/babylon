'use client';

import { InteractionBar } from '@/components/interactions';
import { ModerationMenu } from '@/components/moderation/ModerationMenu';
import { Avatar } from '@/components/shared/Avatar';
import { TaggedText } from '@/components/shared/TaggedText';
import { VerifiedBadge, isNpcIdentifier } from '@/components/shared/VerifiedBadge';
import { getProfileUrl } from '@/lib/profile-utils';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useFontSize } from '@/contexts/FontSizeContext';
import type { PostInteraction } from '@/types/interactions';
import { Repeat2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, type MouseEvent, memo, useEffect, useMemo, useState } from 'react';

/**
 * Post card component for displaying feed posts.
 *
 * Displays a post with author info, content, timestamp, and interaction bar.
 * Supports reposts, quote posts, articles, and regular posts. Handles
 * client-side repost parsing if API doesn't provide metadata. Includes
 * moderation menu and responsive behavior.
 *
 * Features:
 * - Author avatar and verified badge
 * - Tagged text parsing (@mentions, #hashtags, $cashtags)
 * - Repost/quote post display
 * - Article type support
 * - Interaction bar (like, comment, share)
 * - Moderation menu
 * - Responsive layout
 *
 * @param props - PostCard component props
 * @returns Post card element
 *
 * @example
 * ```tsx
 * <PostCard
 *   post={postData}
 *   showInteractions={true}
 *   onCommentClick={() => openComments()}
 * />
 * ```
 */
export type PostCardProps = {
  post: {
    id: string;
    type?: string; // "post" | "article"
    content: string;
    articleTitle?: string | null;
    byline?: string | null;
    biasScore?: number | null;
    sentiment?: string | null;
    category?: string | null;
    authorId: string;
    authorName: string;
    authorUsername?: string | null;
    authorProfileImageUrl?: string | null;
    timestamp: string;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    isLiked?: boolean;
    isShared?: boolean;
    deletedAt?: string | null; // Soft delete timestamp
    // Repost metadata
    isRepost?: boolean;
    originalPostId?: string | null;
    originalAuthorId?: string | null;
    originalAuthorName?: string | null;
    originalAuthorUsername?: string | null;
    originalAuthorProfileImageUrl?: string | null;
    originalContent?: string | null;
    quoteComment?: string | null;
  };
  className?: string;
  onClick?: () => void;
  onCommentClick?: () => void;
  showInteractions?: boolean;
  isDetail?: boolean;
};

export const PostCard = memo(function PostCard({
  post,
  className,
  onClick,
  onCommentClick,
  showInteractions = true,
  isDetail = false,
}: PostCardProps) {
  const router = useRouter();
  const { fontSize } = useFontSize();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setIsMobile(window.innerWidth < 640);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const postDate = new Date(post.timestamp);
  const now = new Date();
  const diffMs = now.getTime() - postDate.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  let timeAgo: string;
  if (diffMinutes < 1) {
    timeAgo = 'Just now';
  } else if (diffMinutes < 60) {
    timeAgo = `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    timeAgo = `${diffHours}h ago`;
  } else {
    // Show date for posts older than 24 hours
    timeAgo = postDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: postDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }

  const initialInteractions: PostInteraction = {
    postId: post.id,
    likeCount: post.likeCount ?? 0,
    commentCount: post.commentCount ?? 0,
    shareCount: post.shareCount ?? 0,
    isLiked: post.isLiked ?? false,
    isShared: post.isShared ?? false,
  };

  // Client-side fallback: Parse repost content if API didn't populate metadata
  const clientSideRepostData = useMemo(() => {
    // If already has repost metadata, use it
    if (post.isRepost && post.originalAuthorId) {
      return null;
    }

    // Guard against undefined/null content
    if (!post.content || typeof post.content !== 'string') {
      return null;
    }

    // Otherwise, try to parse from content
    const separatorPattern = /\n\n--- Reposted from @(.+?) ---\n/;
    const match = post.content.match(separatorPattern);

    if (!match) return null;

    const parts = post.content.split(separatorPattern);
    const quoteComment = parts[0]?.trim() || null;
    const originalContent = parts[2]?.trim() || '';
    const originalAuthorUsername = match[1] || '';

    return {
      isRepost: true,
      quoteComment,
      originalContent,
      originalAuthorUsername,
      originalAuthorId: originalAuthorUsername,
      originalAuthorName: originalAuthorUsername,
    };
  }, [post.content, post.isRepost, post.originalAuthorId]);

  // Use client-side parsed data if API data is missing
  const effectivePost = useMemo(() => {
    if (clientSideRepostData) {
      return {
        ...post,
        isRepost: true,
        quoteComment: clientSideRepostData.quoteComment,
        originalContent: clientSideRepostData.originalContent,
        originalAuthorId: clientSideRepostData.originalAuthorId,
        originalAuthorName: clientSideRepostData.originalAuthorName,
        originalAuthorUsername: clientSideRepostData.originalAuthorUsername,
        originalPostId: null,
        originalAuthorProfileImageUrl: null,
      };
    }
    return post;
  }, [post, clientSideRepostData]);

  // For QUOTE posts (isRepost with quoteComment), show the REPOSTER's info in the header
  // For simple reposts (isRepost without quoteComment), show the ORIGINAL author's info
  const isSimpleRepost = effectivePost.isRepost && !effectivePost.quoteComment;

  const displayAuthorId =
    isSimpleRepost && effectivePost.originalAuthorId
      ? effectivePost.originalAuthorId
      : effectivePost.authorId;
  const displayAuthorName =
    isSimpleRepost && effectivePost.originalAuthorName
      ? effectivePost.originalAuthorName
      : effectivePost.authorName;
  const displayAuthorUsername =
    isSimpleRepost && effectivePost.originalAuthorUsername
      ? effectivePost.originalAuthorUsername
      : effectivePost.authorUsername;
  const displayAuthorProfileImageUrl =
    isSimpleRepost && effectivePost.originalAuthorProfileImageUrl
      ? effectivePost.originalAuthorProfileImageUrl
      : effectivePost.authorProfileImageUrl;

  const authorIsNPC = isNpcIdentifier(displayAuthorId);
  const showVerifiedBadge = authorIsNPC;

  const quotedPostId = effectivePost.originalPostId ?? post.originalPostId ?? null;
  const isQuotedClickable = Boolean(quotedPostId);

  const handleQuotedPostClick = (event: MouseEvent<HTMLElement>) => {
    // Always stop propagation to prevent parent card click
    event.preventDefault();
    event.stopPropagation();

    // Only navigate if we have a valid post ID
    if (quotedPostId) {
      router.push(`/post/${quotedPostId}`);
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const interactiveElementSelector =
    'a, button, input, textarea, select, [role="button"], [role="link"], summary';

  const shouldIgnoreCardInteraction = (target: Element | null) => {
    if (!target) return false;
    return Boolean(target.closest(interactiveElementSelector));
  };

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || shouldIgnoreCardInteraction(event.target as Element | null)) {
      return;
    }
    handleClick();
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if (shouldIgnoreCardInteraction(event.target as Element | null)) {
      return;
    }
    event.preventDefault();
    handleClick();
  };

  // If post is deleted, show a minimal placeholder
  if (post.deletedAt) {
    return (
      <article
        className={cn('px-4 py-3', 'w-full overflow-hidden', 'border-border/5 border-b', className)}
      >
        <div className="flex items-center justify-center py-8 text-muted-foreground italic">
          (no post)
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        'px-4 py-3',
        !isDetail && 'cursor-pointer transition-all duration-200 hover:bg-muted/30',
        'w-full overflow-hidden',
        'border-border/5 border-b',
        className
      )}
      style={{
        fontSize: `${fontSize}rem`,
      }}
      onClick={!isDetail ? handleCardClick : undefined}
      onKeyDown={!isDetail ? handleCardKeyDown : undefined}
      role={!isDetail ? 'button' : undefined}
      tabIndex={!isDetail ? 0 : undefined}
    >
      {/* Repost Indicator - Only show for simple reposts (not quote posts) */}
      {isSimpleRepost && (
        <div className="mb-3 flex items-center gap-3 text-muted-foreground text-sm">
          <Repeat2 size={14} className="text-green-600" />
          <span>
            Reposted by{' '}
            <Link
              href={getProfileUrl(effectivePost.authorId, effectivePost.authorUsername)}
              className="font-semibold text-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {effectivePost.authorName}
            </Link>
          </span>
        </div>
      )}

      {/* Row 1: Avatar + Name/Handle/Timestamp Header */}
      <div className="mb-3 flex w-full items-start gap-3">
        {/* Avatar - Clickable, Round - Shows original author for simple reposts, reposter for quote posts */}
        <Link
          href={getProfileUrl(displayAuthorId, displayAuthorUsername)}
          className="shrink-0 transition-opacity hover:opacity-80"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar
            id={displayAuthorId}
            name={displayAuthorName}
            type={post.type === 'article' ? 'business' : 'actor'}
            size="md"
            src={displayAuthorProfileImageUrl || undefined}
            scaleFactor={isDetail ? fontSize : fontSize * (isDesktop ? 1.4 : isMobile ? 0.8 : 1)}
          />
        </Link>

        {/* Header: Name/Handle block on left, Timestamp and Menu on right */}
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          {/* Name and Handle stacked vertically - Shows original author for simple reposts, reposter for quote posts */}
          <div className="flex min-w-0 flex-col">
            {/* Name row with verified badge */}
            <div className="flex min-w-0 items-center gap-1.5">
              <Link
                href={getProfileUrl(displayAuthorId, displayAuthorUsername)}
                className="truncate font-semibold text-foreground text-lg hover:underline sm:text-xl"
                onClick={(e) => e.stopPropagation()}
              >
                {displayAuthorName}
              </Link>
              {showVerifiedBadge && <VerifiedBadge size="md" className="sm:h-6 sm:w-6" />}
            </div>
            {/* Handle row */}
            <Link
              href={getProfileUrl(displayAuthorId, displayAuthorUsername)}
              className="truncate text-base text-muted-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              @{displayAuthorUsername || displayAuthorId}
            </Link>
          </div>
          {/* Timestamp and Moderation Menu - Right aligned */}
          <div className="flex shrink-0 items-center gap-2">
            <time className="text-base text-muted-foreground" title={postDate.toLocaleString()}>
              {timeAgo}
            </time>
            {/* Show moderation menu only if not your own post */}
            {user && user.id !== displayAuthorId && (
              <ModerationMenu
                targetUserId={displayAuthorId}
                targetUsername={displayAuthorUsername || undefined}
                targetDisplayName={displayAuthorName}
                targetProfileImageUrl={displayAuthorProfileImageUrl || undefined}
                postId={post.id}
                isNPC={authorIsNPC}
              />
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Post Content - Full width */}
      {post.type === 'article' ? (
        // Article card - Show title, summary, and "Read more" button
        <div className="mb-3 w-full">
          {/* Article title with Read More Button */}
          <div className="mb-3 flex items-start justify-between gap-4">
            <h2 className="flex-1 font-bold text-foreground text-lg leading-tight sm:text-xl">
              {post.articleTitle || 'Untitled Article'}
            </h2>
            {!isDetail && (
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#0066FF] px-3 py-2 font-semibold text-primary-foreground text-sm transition-colors hover:bg-[#2952d9]"
                onClick={handleClick}
              >
                Read Full Article →
              </button>
            )}
          </div>

          {/* Article metadata */}
          <div className="mb-4 flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
            {post.byline && <span>{post.byline}</span>}
          </div>

          {/* Article summary */}
          <div className="mb-3 whitespace-pre-wrap break-words text-foreground leading-relaxed">
            {post.content}
          </div>
        </div>
      ) : effectivePost.isRepost && effectivePost.originalAuthorId ? (
        // Repost (with or without quote comment) - show embedded card if we have original author info
        <div className="mb-4 w-full">
          {/* Quote comment (if present) */}
          {effectivePost.quoteComment && (
            <div className="post-content mb-4 whitespace-pre-wrap break-words text-foreground leading-relaxed">
              <TaggedText
                text={effectivePost.quoteComment}
                onTagClick={(tag) => {
                  router.push(`/feed?search=${encodeURIComponent(tag)}`);
                }}
              />
            </div>
          )}

          {/* Embedded original post */}
          <button
            type="button"
            className={cn(
              'w-full rounded-xl border border-white/10 p-4 text-left',
              'bg-white/5',
              'overflow-hidden transition-colors',
              isQuotedClickable ? 'cursor-pointer hover:bg-white/[0.07]' : 'cursor-default'
            )}
            onClick={isQuotedClickable ? handleQuotedPostClick : undefined}
            aria-label={isQuotedClickable ? 'View quoted post' : undefined}
            disabled={!isQuotedClickable}
          >
            {/* Original post author */}
            <div className="mb-3 flex items-start gap-3">
              <Link
                href={getProfileUrl(
                  effectivePost.originalAuthorId || '',
                  effectivePost.originalAuthorUsername
                )}
                className="shrink-0 transition-opacity hover:opacity-80"
                onClick={(e) => e.stopPropagation()}
              >
                <Avatar
                  id={effectivePost.originalAuthorId || ''}
                  name={effectivePost.originalAuthorName || ''}
                  type="actor"
                  size="sm"
                  src={effectivePost.originalAuthorProfileImageUrl || undefined}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={getProfileUrl(
                      effectivePost.originalAuthorId || '',
                      effectivePost.originalAuthorUsername
                    )}
                    className="truncate font-semibold text-foreground hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {effectivePost.originalAuthorName}
                  </Link>
                  {effectivePost.originalAuthorId &&
                    isNpcIdentifier(effectivePost.originalAuthorId) && <VerifiedBadge size="sm" />}
                </div>
                <Link
                  href={getProfileUrl(
                    effectivePost.originalAuthorId || '',
                    effectivePost.originalAuthorUsername
                  )}
                  className="text-foreground/50 text-sm hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  @{effectivePost.originalAuthorUsername || effectivePost.originalAuthorId}
                </Link>
              </div>
            </div>

            {/* Original post content - Use originalContent if available, otherwise parse */}
            <div className="whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">
              <TaggedText
                text={effectivePost.originalContent || ''}
                onTagClick={(tag) => {
                  router.push(`/feed?search=${encodeURIComponent(tag)}`);
                }}
              />
            </div>
          </button>
        </div>
      ) : (
        // Regular post - Show content as normal
        <div className="post-content mb-4 w-full whitespace-pre-wrap break-words text-foreground leading-relaxed">
          <TaggedText
            text={post.content || ''}
            onTagClick={(tag) => {
              router.push(`/feed?search=${encodeURIComponent(tag)}`);
            }}
          />
        </div>
      )}

      {/* Row 3: Interaction Bar - Full width */}
      {showInteractions && (
        <div className="w-full">
          <InteractionBar
            postId={post.id}
            initialInteractions={initialInteractions}
            onCommentClick={onCommentClick}
            postData={post}
          />
        </div>
      )}
    </article>
  );
});
