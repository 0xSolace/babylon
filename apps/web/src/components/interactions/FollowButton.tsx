'use client';

import { cn, logger } from '@babylon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/shared/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useSocialTracking } from '@/hooks/usePostHog';

/**
 * Follow status API response.
 */
interface FollowStatusResponse {
  isFollowing: boolean;
}

/**
 * Follow button component for following/unfollowing users.
 *
 * Displays a follow/unfollow button with loading states and automatic
 * status checking. Hides for own profile. Tracks follow actions with
 * PostHog analytics. Supports both button and icon-only variants.
 *
 * @param props - FollowButton component props
 * @returns Follow button element or null if own profile
 *
 * @example
 * ```tsx
 * <FollowButton
 *   userId="user-123"
 *   initialFollowing={false}
 *   onFollowChange={(isFollowing) => console.log(isFollowing)}
 * />
 * ```
 */
interface FollowButtonProps {
  userId: string;
  initialFollowing?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'icon';
  className?: string;
  onFollowChange?: (isFollowing: boolean) => void;
  onFollowerCountChange?: (delta: number) => void; // +1 for follow, -1 for unfollow
}

export function FollowButton({
  userId,
  initialFollowing = false,
  size = 'md',
  variant = 'button',
  className,
  onFollowChange,
  onFollowerCountChange,
}: FollowButtonProps) {
  const { authenticated, user } = useAuth();
  const { trackFollow } = useSocialTracking();
  const queryClient = useQueryClient();

  // Check if viewing own profile (userId could be username or user ID)
  const isOwnProfile =
    user &&
    (user.id === userId ||
      user.username === userId ||
      (user.username &&
        user.username.startsWith('@') &&
        user.username.slice(1) === userId));

  // Fetch follow status
  const { data: followStatus, isLoading: isChecking } = useQuery({
    queryKey: ['followStatus', userId],
    queryFn: async (): Promise<FollowStatusResponse> => {
      const token =
        typeof window !== 'undefined' ? window.__oauth3AccessToken : null;
      if (!token) {
        return { isFollowing: false };
      }

      const encodedIdentifier = encodeURIComponent(userId);
      const response = await fetch(`/api/users/${encodedIdentifier}/follow`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return response.json() as Promise<FollowStatusResponse>;
      }
      return { isFollowing: false };
    },
    enabled: authenticated && !!user && !isOwnProfile && !!userId,
    initialData: { isFollowing: initialFollowing },
  });

  const isFollowing = followStatus?.isFollowing ?? initialFollowing;

  // Follow/unfollow mutation
  const followMutation = useMutation({
    mutationFn: async (shouldFollow: boolean): Promise<void> => {
      const token =
        typeof window !== 'undefined' ? window.__oauth3AccessToken : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const encodedIdentifier = encodeURIComponent(userId);
      const method = shouldFollow ? 'POST' : 'DELETE';
      const response = await fetch(`/api/users/${encodedIdentifier}/follow`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData: { error?: string | { message?: string } } =
          await response.json();
        if (response.status === 404) {
          throw new Error('Unable to follow this profile');
        }
        const errorMessage =
          typeof errorData?.error === 'string'
            ? errorData.error
            : (errorData?.error as { message?: string })?.message ||
              'Failed to update follow status';
        throw new Error(errorMessage);
      }
    },
    onMutate: async (shouldFollow) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['followStatus', userId] });

      // Snapshot the previous value
      const previousStatus = queryClient.getQueryData<FollowStatusResponse>([
        'followStatus',
        userId,
      ]);

      // Optimistically update
      queryClient.setQueryData<FollowStatusResponse>(['followStatus', userId], {
        isFollowing: shouldFollow,
      });

      const delta = shouldFollow ? 1 : -1;
      onFollowChange?.(shouldFollow);
      onFollowerCountChange?.(delta);

      return { previousStatus, delta };
    },
    onSuccess: (_, shouldFollow) => {
      trackFollow(userId, shouldFollow);
    },
    onError: (error: Error, _, context) => {
      // Revert optimistic update
      if (context?.previousStatus) {
        queryClient.setQueryData<FollowStatusResponse>(
          ['followStatus', userId],
          context.previousStatus
        );
        onFollowChange?.(context.previousStatus.isFollowing);
        onFollowerCountChange?.(-context.delta);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['followStatus', userId] });
    },
  });

  const handleFollow = () => {
    if (!authenticated || !user) {
      toast.error('Please sign in to follow users');
      return;
    }

    if (isOwnProfile) {
      return;
    }

    if (!userId) {
      logger.error(
        'No userId/username provided to FollowButton',
        {},
        'FollowButton'
      );
      return;
    }

    followMutation.mutate(!isFollowing);
  };

  const isLoading = followMutation.isPending;

  // Don't show button if checking or if user is viewing their own profile
  const isOwnProfile =
    user &&
    (user.id === userId ||
      user.username === userId ||
      (user.username &&
        user.username.startsWith('@') &&
        user.username.slice(1) === userId));

  if (isChecking || isOwnProfile) {
    return null;
  }

  if (!authenticated) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const skeletonSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleFollow}
        disabled={isLoading}
        className={cn(
          'rounded p-2 transition-colors',
          isFollowing
            ? 'text-muted-foreground hover:text-foreground'
            : 'text-primary hover:text-primary/80',
          isLoading && 'cursor-not-allowed opacity-50',
          className
        )}
        aria-label={isFollowing ? 'Unfollow' : 'Follow'}
      >
        {isLoading ? (
          <Skeleton className={cn(skeletonSizes[size], 'rounded')} />
        ) : isFollowing ? (
          <UserMinus className={iconSizes[size]} />
        ) : (
          <UserPlus className={iconSizes[size]} />
        )}
      </button>
    );
  }

  // Old-school style button
  return (
    <button
      onClick={handleFollow}
      disabled={isLoading}
      className={cn(
        'group relative flex items-center justify-center gap-1.5 rounded-full font-bold transition-all duration-200',
        'border',
        isFollowing
          ? 'border-border bg-background text-foreground hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500'
          : 'border-[#0066FF] bg-[#0066FF] text-primary-foreground hover:bg-[#0052CC]',
        sizeClasses[size],
        isLoading && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {isLoading ? (
        <>
          <span>...</span>
        </>
      ) : isFollowing ? (
        <>
          <span className="group-hover:hidden">Following</span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </>
      ) : (
        <span>Follow</span>
      )}
    </button>
  );
}
