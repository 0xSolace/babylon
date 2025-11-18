'use client';

import { Avatar } from '@/components/shared/Avatar';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { memo } from 'react';
import { z } from 'zod';

const _ArticleCardPostSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  content: z.string(),
  fullContent: z.string().nullable().optional(),
  articleTitle: z.string().nullable().optional(),
  byline: z.string().nullable().optional(),
  biasScore: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  authorId: z.string(),
  authorName: z.string(),
  authorUsername: z.string().nullable().optional(),
  authorProfileImageUrl: z.string().nullable().optional(),
  timestamp: z.string(),
});

export type ArticleCardProps = {
  post: z.infer<typeof _ArticleCardPostSchema>;
  className?: string;
  onClick?: () => void;
};

export const ArticleCard = memo(function ArticleCard({
  post,
  className,
  onClick,
}: ArticleCardProps) {
  const publishedDate = new Date(post.timestamp);
  const now = new Date();
  const diffMs = now.getTime() - publishedDate.getTime();
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
    // Show date for articles older than 24 hours
    timeAgo = publishedDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: publishedDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      className={cn(
        'px-4 py-3',
        'cursor-pointer transition-all duration-200 hover:bg-muted/30',
        'w-full overflow-hidden',
        'border-border/5 border-b',
        className
      )}
      type="button"
      onClick={handleClick}
    >
      {/* Header: Avatar + Author + Timestamp */}
      <div className="mb-3 flex w-full items-start gap-3">
        {/* Avatar */}
        <Link
          href={`/profile/${post.authorId}`}
          className="shrink-0 transition-opacity hover:opacity-80"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar
            id={post.authorId}
            name={post.authorName}
            type="business"
            size="md"
            src={post.authorProfileImageUrl || undefined}
          />
        </Link>

        {/* Author name and timestamp */}
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/profile/${post.authorId}`}
              className="truncate font-semibold text-foreground text-lg hover:underline sm:text-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {post.authorName}
            </Link>
          </div>
          <time
            className="ml-2 shrink-0 text-base text-muted-foreground"
            title={publishedDate.toLocaleString()}
          >
            {timeAgo}
          </time>
        </div>
      </div>

      {/* Article Title with Read More Button */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <h2 className="flex-1 font-bold text-foreground text-lg leading-tight sm:text-xl">
          {post.articleTitle || 'Untitled Article'}
        </h2>
        <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#0066FF] px-3 py-2 font-semibold text-primary-foreground text-sm transition-colors hover:bg-[#2952d9]">
          Read Full Article →
        </span>
      </div>

      {/* Article Metadata */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
        {post.byline && <span>{post.byline}</span>}
        {post.biasScore !== null &&
          post.biasScore !== undefined &&
          Math.abs(post.biasScore) >= 0.3 && (
            <>
              <span>·</span>
              <span
                className={cn(
                  'font-semibold text-xs',
                  post.biasScore > 0 ? 'text-green-500' : 'text-red-500'
                )}
              >
                {post.biasScore > 0 ? '↗ Favorable' : '↘ Critical'}
              </span>
            </>
          )}
      </div>

      {/* Article Summary */}
      <div className="mb-3 whitespace-pre-wrap break-words text-foreground leading-relaxed">
        {post.content}
      </div>
    </button>
  );
});
