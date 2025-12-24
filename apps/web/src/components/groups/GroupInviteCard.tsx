import { useJejuAuth } from '@babylon/auth'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Users, X } from 'lucide-react'
import { useState } from 'react'

/**
 * Group invite card component for displaying and responding to group invitations.
 *
 * Displays a card for a group invitation with group details and accept/decline
 * actions. Shows success/declined states after response. Handles API calls
 * for accepting or declining invitations.
 *
 * Features:
 * - Group information display
 * - Accept functionality
 * - Decline functionality
 * - Status indicators
 * - Loading states
 * - Error handling
 *
 * @param props - GroupInviteCard component props
 * @returns Group invite card element
 *
 * @example
 * ```tsx
 * <GroupInviteCard
 *   inviteId="invite-123"
 *   groupId="group-456"
 *   groupName="Trading Group"
 *   memberCount={5}
 *   onAccepted={(groupId) => router.push(`/groups/${groupId}`)}
 * />
 * ```
 */
interface GroupInviteCardProps {
  inviteId: string
  groupId: string
  groupName: string
  groupDescription?: string | null
  memberCount: number
  invitedAt: Date | string
  onAccepted?: (groupId: string, chatId?: string) => void
  onDeclined?: () => void
}

interface AcceptInviteResponse {
  chatId?: string
}

export function GroupInviteCard({
  inviteId,
  groupId,
  groupName,
  groupDescription,
  memberCount,
  invitedAt,
  onAccepted,
  onDeclined,
}: GroupInviteCardProps) {
  const { getAccessToken } = useJejuAuth()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined'>(
    'pending',
  )

  const acceptMutation = useMutation({
    mutationFn: async (): Promise<AcceptInviteResponse> => {
      const token = await getAccessToken()
      const response = await fetch(`/api/groups/invites/${inviteId}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to accept invite')
      }

      return response.json()
    },
    onSuccess: (data) => {
      setStatus('accepted')
      queryClient.invalidateQueries({ queryKey: ['group-invites'] })
      queryClient.invalidateQueries({ queryKey: ['user-groups'] })
      onAccepted?.(groupId, data.chatId)
    },
  })

  const declineMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken()
      const response = await fetch(`/api/groups/invites/${inviteId}/decline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to decline invite')
      }
    },
    onSuccess: () => {
      setStatus('declined')
      queryClient.invalidateQueries({ queryKey: ['group-invites'] })
      onDeclined?.()
    },
  })

  const isLoading = acceptMutation.isPending || declineMutation.isPending

  if (status === 'accepted') {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
            <Check className="h-5 w-5 text-green-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Invitation Accepted</p>
            <p className="text-muted-foreground text-xs">
              You are now a member of {groupName}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'declined') {
    return (
      <div className="rounded-lg border border-muted bg-muted/50 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Invitation Declined</p>
            <p className="text-muted-foreground text-xs">
              You declined the invitation to {groupName}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-sidebar p-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 font-semibold text-sm">{groupName}</h3>
            {groupDescription && (
              <p className="mb-2 line-clamp-2 text-muted-foreground text-xs">
                {groupDescription}
              </p>
            )}
            <div className="flex items-center gap-3 text-muted-foreground text-xs">
              <span>{memberCount} members</span>
              <span>·</span>
              <span>
                {new Date(invitedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {(acceptMutation.isError || declineMutation.isError) && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2">
            <p className="text-red-500 text-xs">
              {acceptMutation.error?.message ||
                declineMutation.error?.message ||
                'An error occurred'}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => acceptMutation.mutate()}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {acceptMutation.isPending ? (
              <Loader2 className="inline h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="mr-1 inline h-4 w-4" />
                Accept
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => declineMutation.mutate()}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-border bg-sidebar px-4 py-2.5 font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            {declineMutation.isPending ? (
              <Loader2 className="inline h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="mr-1 inline h-4 w-4" />
                Decline
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
