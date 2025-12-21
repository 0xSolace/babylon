'use client';

/**
 * Group invites panel component for displaying all pending group invitations.
 *
 * Fetches and displays all pending group invitations for the current user.
 * Shows invitation count and renders individual invite notifications.
 * Automatically reloads after invite responses.
 *
 * Features:
 * - Pending invitations list
 * - Invitation count display
 * - Auto-reload after response
 * - Loading states
 * - Empty state handling
 *
 * @returns Group invites panel element or null if no invites
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GroupInviteNotification } from './GroupInviteNotification';

/**
 * Group invite structure for group invites panel.
 */
interface GroupInvite {
  id: string;
  groupId: string;
  invitedAt: string;
  group: {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
  } | null;
  inviter: {
    id: string;
    name: string;
    username: string | null;
    profileImageUrl: string | null;
  } | null;
}

interface GroupInvitesResponse {
  data: {
    invites: GroupInvite[];
  };
}

export function GroupInvitesPanel() {
  const queryClient = useQueryClient();

  const { data: invites, isLoading } = useQuery({
    queryKey: ['group-invites'],
    queryFn: async (): Promise<GroupInvite[]> => {
      const response = await fetch('/api/user-groups/invites');
      const data: GroupInvitesResponse = await response.json();

      if (!response.ok) {
        throw new Error('Failed to load invites');
      }

      return data.data.invites;
    },
  });

  const handleInviteResponse = () => {
    queryClient.invalidateQueries({ queryKey: ['group-invites'] });
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="text-center text-muted-foreground">
          Loading invites...
        </div>
      </div>
    );
  }

  if (!invites || invites.length === 0) {
    return null; // Don't show anything if no invites
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="border-border border-b p-6">
        <h3 className="font-bold text-lg">
          Pending Invitations ({invites.length})
        </h3>
      </div>
      <div className="space-y-3 p-6">
        {invites.map((invite) => (
          <GroupInviteNotification
            key={invite.id}
            inviteId={invite.id}
            groupName={invite.group?.name || 'Unknown Group'}
            groupDescription={invite.group?.description}
            inviterName={invite.inviter?.name || 'Unknown User'}
            inviterImage={invite.inviter?.profileImageUrl}
            memberCount={invite.group?.memberCount}
            onAccept={handleInviteResponse}
            onDecline={handleInviteResponse}
          />
        ))}
      </div>
    </div>
  );
}
