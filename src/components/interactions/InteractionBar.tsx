'use client';

import { FeedCommentSection } from '@/components/feed/FeedCommentSection';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLoginModal } from '@/hooks/useLoginModal';
import { useInteractionStore } from '@/stores/interactionStore';
import type { InteractionBarProps } from '@/types/interactions';
import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DeleteButton } from './DeleteButton';
import { LikeButton } from './LikeButton';
import { RepostButton } from './RepostButton';

/**
 * Interaction bar component for post interactions.
 *
 * Displays like, comment, and share buttons with counts. Manages
 * interaction state via Zustand store with polling for real-time
 * updates. Opens comment section or login modal based on auth state.
 *
 * Features:
 * - Like button with reaction picker
 * - Comment button with count
 * - Share/repost button
 * - Delete button (for post author)
 * - Real-time count updates via polling
 *
 * @param props - InteractionBar component props
 * @returns Interaction bar element
 *
 * @example
 * ```tsx
 * <InteractionBar
 *   postId="post-123"
 *   initialInteractions={{
 *     likeCount: 10,
 *     commentCount: 5,
 *     shareCount: 2
 *   }}
 * />
 * ```
 */
export function InteractionBar({
  postId,
  initialInteractions,
  onCommentClick,
  className,
  postData,
}: InteractionBarProps) {
  const [showComments, setShowComments] = useState(false);
  const { postInteractions } = useInteractionStore();
  const { authenticated } = useAuth();
  const { showLoginModal } = useLoginModal();

  // Get interaction data from store (synced via polling) or fall back to initial values
  const storeData = postInteractions.get(postId);
  const likeCount = storeData?.likeCount ?? initialInteractions?.likeCount ?? 0;
  const commentCount = storeData?.commentCount ?? initialInteractions?.commentCount ?? 0;
  const shareCount = storeData?.shareCount ?? initialInteractions?.shareCount ?? 0;
  const isLiked = storeData?.isLiked ?? initialInteractions?.isLiked ?? false;
  const isShared = storeData?.isShared ?? initialInteractions?.isShared ?? false;

  // Register this post in the store so polling picks it up
  useEffect(() => {
    if (!storeData) {
      // Initialize in store with provided initial values
      const store = useInteractionStore.getState();
      const updatedInteractions = new Map(store.postInteractions);
      updatedInteractions.set(postId, {
        postId,
        likeCount: initialInteractions?.likeCount ?? 0,
        commentCount: initialInteractions?.commentCount ?? 0,
        shareCount: initialInteractions?.shareCount ?? 0,
        isLiked: initialInteractions?.isLiked ?? false,
        isShared: initialInteractions?.isShared ?? false,
      });
      useInteractionStore.setState({ postInteractions: updatedInteractions });
    }
  }, [postId, storeData, initialInteractions]);

  const handleCommentClick = () => {
    if (!authenticated) {
      showLoginModal({
        title: 'Login to Comment',
        message: 'Log in to reply to posts and engage with NPCs.',
      });
      return;
    }
    // If custom onCommentClick is provided, use that instead of opening our own modal
    if (onCommentClick) {
      onCommentClick();
    } else {
      setShowComments(true);
    }
  };

  return (
    <>
      <div
        className={cn(
          className,
          'mt-3 flex w-full items-center justify-between gap-6 text-muted-foreground'
        )}
      >
        {/* Comment button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering post onClick
            handleCommentClick();
          }}
          className={cn(
            'flex h-8 items-center gap-1 px-2',
            'bg-transparent transition-all duration-200 hover:opacity-70',
            'cursor-pointer text-muted-foreground text-xs'
          )}
        >
          <MessageCircle size={18} />
          {commentCount > 0 && <span className="font-medium tabular-nums">{commentCount}</span>}
        </button>

        {/* Share button */}
        <RepostButton
          postId={postData?.originalPostId || postId}
          shareCount={shareCount}
          initialShared={isShared}
          size="sm"
          showCount
          postData={
            postData
              ? {
                  id: postData.id,
                  content: postData.content,
                  authorId: postData.authorId,
                  authorName: postData.authorName,
                  authorUsername: postData.authorUsername,
                  authorProfileImageUrl: postData.authorProfileImageUrl,
                  timestamp: postData.timestamp,
                }
              : undefined
          }
        />

        {/* Like button with reaction picker */}
        <LikeButton
          targetId={postId}
          targetType="post"
          initialLiked={isLiked}
          initialCount={likeCount}
          size="sm"
          showCount
        />

        {/* Delete button (only visible to post author) */}
        <DeleteButton postId={postId} postAuthorId={postData?.authorId || ''} size="sm" />
      </div>

      {/* Comment modal - only if custom onCommentClick is not provided */}
      {!onCommentClick && showComments && postData && (
        <FeedCommentSection
          postId={postId}
          postData={{
            id: postData.id,
            content: postData.content,
            authorId: postData.authorId,
            authorName: postData.authorName,
            authorUsername: postData.authorUsername ?? null,
            authorProfileImageUrl: postData.authorProfileImageUrl ?? null,
            timestamp: postData.timestamp,
            likeCount: postData.likeCount ?? 0,
            commentCount: postData.commentCount ?? 0,
            shareCount: postData.shareCount ?? 0,
            isLiked: postData.isLiked ?? false,
            isShared: postData.isShared ?? false,
          }}
          onClose={() => setShowComments(false)}
        />
      )}
    </>
  );
}
