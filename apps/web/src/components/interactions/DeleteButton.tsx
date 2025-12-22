'use client';

import { cn } from '@babylon/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

/**
 * Delete button component props.
 */
interface DeleteButtonProps {
  /** ID of the post to delete */
  postId: string;
  /** Author ID of the post (for permission check) */
  postAuthorId: string;
  /** Button size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 px-2 text-xs gap-1',
  md: 'h-10 px-3 text-sm gap-1.5',
  lg: 'h-12 px-4 text-base gap-2',
};

const iconSizes = {
  sm: 18,
  md: 20,
  lg: 22,
};

/**
 * Delete button component for posts.
 *
 * Only visible to the post author. Shows a confirmation dialog
 * before deleting. Handles optimistic updates and error states.
 *
 * Features:
 * - Permission check (only author can delete)
 * - Confirmation dialog
 * - Optimistic UI updates
 * - Toast notifications
 *
 * @param props - DeleteButton component props
 * @returns Delete button element or null if user is not the author
 *
 * @example
 * ```tsx
 * <DeleteButton
 *   postId="post-123"
 *   postAuthorId="user-456"
 *   size="sm"
 * />
 * ```
 */
export function DeleteButton({
  postId,
  postAuthorId,
  size = 'md',
  className,
}: DeleteButtonProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  // Only show delete button to post author
  if (!user || user.id !== postAuthorId) {
    return null;
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data: { error?: string } = await response.json();
        throw new Error(data.error ?? 'Failed to delete post');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Post deleted');
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = () => {
    setShowConfirm(false);
    deleteMutation.mutate();
  };

  const sizeKey: 'sm' | 'md' | 'lg' = size;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={deleteMutation.isPending}
        className={cn(
          'flex items-center transition-all duration-200',
          'bg-transparent text-muted-foreground hover:text-red-500 hover:opacity-70',
          sizeClasses[sizeKey],
          deleteMutation.isPending && 'cursor-wait opacity-50',
          className
        )}
        title="Delete post"
      >
        <Trash2 size={iconSizes[sizeKey]} />
      </button>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />

          {/* Dialog */}
          <div className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-lg border border-border bg-popover p-4 shadow-lg">
              <h3 className="mb-2 font-semibold text-foreground">
                Delete Post?
              </h3>
              <p className="mb-4 text-muted-foreground text-sm">
                This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded bg-muted px-3 py-2 text-foreground text-sm hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="flex-1 rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
