'use client';

/**
 * Group Invites Panel
 *
 * Shows all pending group invitations
 */

import { useCallback, useEffect, useState } from 'react';
import { GroupInviteNotification } from './GroupInviteNotification';

// import { toast } from 'sonner';

type GroupInvite = {
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
};

export function GroupInvitesPanel() {
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInvites = useCallback(async () => {
    const response = await fetch('/api/user-groups/invites');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load invites');
    }

    setInvites(data.data.invites);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleInviteResponse = () => {
    loadInvites(); // Reload invites after response
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="text-center text-muted-foreground">Loading invites...</div>
      </div>
    );
  }

  if (invites.length === 0) {
    return null; // Don't show anything if no invites
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="border-border border-b p-6">
        <h3 className="font-bold text-lg">Pending Invitations ({invites.length})</h3>
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
