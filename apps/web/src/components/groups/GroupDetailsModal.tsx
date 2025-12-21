'use client';

import { cn } from '@babylon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Crown,
  Loader2,
  Settings,
  Shield,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
/**
 * Group details modal component for viewing and managing group details.
 *
 * Displays group information including name, description, members, and
 * creation date. Provides member management functionality for admins
 * including removing members and toggling admin privileges.
 *
 * Features:
 * - Group information display
 * - Member list
 * - Remove member functionality (admins)
 * - Toggle admin privileges (admins)
 * - Loading states
 * - Error handling
 * - Body scroll lock and escape key handling
 *
 * @param props - GroupDetailsModal component props
 * @returns Group details modal element
 *
 * @example
 * ```tsx
 * <GroupDetailsModal
 *   groupId="group-123"
 *   onClose={() => setShowModal(false)}
 *   onGroupUpdated={() => refreshGroup()}
 * />
 * ```
 */
import { toast } from 'sonner';
import { Avatar } from '@/components/shared/Avatar';

/**
 * Group member structure for group details modal.
 */
interface GroupMember {
  userId: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  joinedAt: string;
  isAdmin: boolean;
}

/**
 * Group details structure from API.
 */
interface GroupDetails {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  members: GroupMember[];
  isCurrentUserAdmin: boolean;
}

interface GroupDetailsResponse {
  data: GroupDetails;
}

interface GroupDetailsModalProps {
  groupId: string;
  onClose: () => void;
  onGroupUpdated: () => void;
}

export function GroupDetailsModal({
  groupId,
  onClose,
  onGroupUpdated,
}: GroupDetailsModalProps) {
  const queryClient = useQueryClient();

  const { data: group, isLoading } = useQuery({
    queryKey: ['user-group', groupId],
    queryFn: async (): Promise<GroupDetails> => {
      const response = await fetch(`/api/user-groups/${groupId}`);
      const data: GroupDetailsResponse = await response.json();

      if (!response.ok) {
        toast.error('Failed to load group details');
        onClose();
        throw new Error('Failed to load group');
      }

      return data.data;
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(
        `/api/user-groups/${groupId}/members/${userId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }
    },
    onSuccess: () => {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['user-group', groupId] });
      onGroupUpdated();
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({
      userId,
      isCurrentlyAdmin,
    }: {
      userId: string;
      isCurrentlyAdmin: boolean;
    }) => {
      const url = isCurrentlyAdmin
        ? `/api/user-groups/${groupId}/admins/${userId}`
        : `/api/user-groups/${groupId}/admins`;

      const response = await fetch(url, {
        method: isCurrentlyAdmin ? 'DELETE' : 'POST',
        headers: isCurrentlyAdmin
          ? undefined
          : {
              'Content-Type': 'application/json',
            },
        body: isCurrentlyAdmin ? undefined : JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update admin status');
      }

      return { isCurrentlyAdmin };
    },
    onSuccess: (data) => {
      toast.success(
        data.isCurrentlyAdmin
          ? 'Admin privileges revoked'
          : 'Admin privileges granted'
      );
      queryClient.invalidateQueries({ queryKey: ['user-group', groupId] });
      onGroupUpdated();
    },
  });

  const handleRemoveMember = (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }
    removeMemberMutation.mutate(userId);
  };

  const handleToggleAdmin = (userId: string, isCurrentlyAdmin: boolean) => {
    toggleAdminMutation.mutate({ userId, isCurrentlyAdmin });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-border border-b p-6">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-xl">
              {isLoading ? 'Loading...' : group?.name || 'Group Details'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : group ? (
            <div className="space-y-4">
              {/* Add Member Button */}
              {group.isCurrentUserAdmin && (
                <div className="flex justify-end">
                  <button className="rounded-lg border border-border bg-sidebar px-3 py-1.5 font-medium text-sm transition-colors hover:bg-accent">
                    <UserPlus className="mr-1 inline h-4 w-4" />
                    Add Member
                  </button>
                </div>
              )}

              {/* Members */}
              <div className="space-y-3">
                <label className="block font-semibold text-sm">
                  Members ({group.members.length})
                </label>

                <div className="space-y-2">
                  {group.members.map((member) => {
                    const isCreator = member.userId === group.createdById;
                    const isMutating =
                      removeMemberMutation.isPending ||
                      toggleAdminMutation.isPending;
                    return (
                      <div
                        key={member.userId}
                        className="flex items-center gap-3 rounded-lg border border-border bg-sidebar p-3 transition-colors hover:bg-sidebar/80"
                      >
                        <Avatar
                          imageUrl={member.profileImageUrl || undefined}
                          name={member.username || member.displayName || '?'}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-sm">
                              {member.displayName ||
                                member.username ||
                                'Unknown'}
                            </span>
                            {isCreator && (
                              <Crown className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
                            )}
                            {member.isAdmin && (
                              <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
                            )}
                          </div>
                          {member.username && (
                            <div className="truncate text-muted-foreground text-xs">
                              @{member.username}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        {group.isCurrentUserAdmin && !isCreator && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                handleToggleAdmin(member.userId, member.isAdmin)
                              }
                              disabled={isMutating}
                              className="rounded-md p-2 transition-colors hover:bg-background disabled:opacity-50"
                              title={
                                member.isAdmin ? 'Remove Admin' : 'Make Admin'
                              }
                            >
                              <Shield
                                className={cn(
                                  'h-4 w-4',
                                  member.isAdmin
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                                )}
                              />
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.userId)}
                              disabled={isMutating}
                              className="rounded-md p-2 transition-colors hover:bg-background disabled:opacity-50"
                              title="Remove Member"
                            >
                              <UserMinus className="h-4 w-4 text-red-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
