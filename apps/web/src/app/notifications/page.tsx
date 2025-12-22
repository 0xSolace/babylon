'use client';

import { cn } from '@babylon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { GroupInviteCard } from '@/components/groups/GroupInviteCard';
import { Avatar } from '@/components/shared/Avatar';
import { PageContainer } from '@/components/shared/PageContainer';
import { PullToRefreshIndicator } from '@/components/shared/PullToRefreshIndicator';
import { useAuth } from '@/hooks/useAuth';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface Notification {
  id: string;
  type: string;
  actorId: string | null;
  actor: {
    id: string;
    displayName: string;
    username: string | null;
    profileImageUrl: string | null;
  } | null;
  postId: string | null;
  commentId: string | null;
  chatId: string | null;
  groupId: string | null;
  inviteId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

interface GroupInvite {
  inviteId: string;
  groupId: string;
  groupName: string;
  groupDescription: string | null;
  memberCount: number;
  invitedAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

interface GroupInvitesResponse {
  invites: GroupInvite[];
}

export default function NotificationsPage() {
  const { authenticated, user, getAccessToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: async (): Promise<NotificationsResponse> => {
      const token = await getAccessToken();

      if (!token) {
        return { notifications: [], unreadCount: 0 };
      }

      const response = await fetch('/api/notifications?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      return (await response.json()) as NotificationsResponse;
    },
    enabled: authenticated && !!user,
    refetchInterval: 60000, // Poll every 1 minute
    refetchIntervalInBackground: false, // Only poll when visible
  });

  const { data: invitesData, isLoading: invitesLoading } = useQuery({
    queryKey: ['group-invites'],
    queryFn: async (): Promise<GroupInvite[]> => {
      const token = await getAccessToken();

      if (!token) {
        return [];
      }

      const response = await fetch('/api/groups/invites', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch group invites');
      }

      const data = (await response.json()) as GroupInvitesResponse;
      return data.invites || [];
    },
    enabled: authenticated && !!user,
  });

  const notifications = notificationsData
    ? notificationsData.notifications
    : [];
  const groupInvites = invitesData || [];
  const loading = notificationsLoading || invitesLoading;
  const unreadCount = notificationsData ? notificationsData.unreadCount : 0;

  // Mutation for marking notifications as read with optimistic updates
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('No auth token');

      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationIds: [notificationId],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      return notificationId;
    },
    onMutate: async (notificationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<NotificationsResponse>([
        'notifications',
      ]);

      // Optimistically update the cache
      queryClient.setQueryData<NotificationsResponse>(
        ['notifications'],
        (old) => {
          if (!old) return old;
          return {
            notifications: old.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, old.unreadCount - 1),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _notificationId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
    },
  });

  const markAsRead = useCallback(
    (notificationId: string, isAlreadyRead: boolean) => {
      if (isAlreadyRead) return;
      markAsReadMutation.mutate(notificationId);
    },
    [markAsReadMutation]
  );

  const handleRefresh = useCallback(async () => {
    await refetchNotifications();
    await queryClient.invalidateQueries({ queryKey: ['group-invites'] });
    toast.success('Notifications refreshed');
  }, [refetchNotifications, queryClient]);

  // Pull-to-refresh hook
  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const fetchNotifications = useCallback(async () => {
    await refetchNotifications();
    await queryClient.invalidateQueries({ queryKey: ['group-invites'] });
  }, [refetchNotifications, queryClient]);

  // Intersection Observer - marks notifications as read after viewing for 3 seconds
  useEffect(() => {
    if (!authenticated || notifications.length === 0) return;

    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const notificationId = entry.target.getAttribute(
            'data-notification-id'
          );
          if (!notificationId) return;

          const notification = notifications.find(
            (n) => n.id === notificationId
          );
          if (!notification || notification.read) return;

          if (entry.isIntersecting) {
            // Clear any existing timer first (in case notification re-enters viewport)
            const existingTimer = timers.get(notificationId);
            if (existingTimer) {
              clearTimeout(existingTimer);
            }

            // Start a timer when notification becomes visible
            const timer = setTimeout(() => {
              markAsRead(notificationId, false);
            }, 3000); // 3 seconds delay

            timers.set(notificationId, timer);
          } else {
            // Cancel timer if notification leaves viewport before 3 seconds
            const timer = timers.get(notificationId);
            if (timer) {
              clearTimeout(timer);
              timers.delete(notificationId);
            }
          }
        });
      },
      {
        threshold: 0.5, // At least 50% of notification must be visible
        rootMargin: '-50px', // Adds margin to trigger when fully in view
      }
    );

    // Observe all notification elements
    const notificationElements = document.querySelectorAll(
      '[data-notification-id]'
    );
    notificationElements.forEach((el) => observer.observe(el));

    // Cleanup
    return () => {
      observer.disconnect();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [notifications, authenticated, markAsRead]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return '💬';
      case 'reaction':
        return '❤️';
      case 'follow':
        return '👤';
      case 'mention':
        return '📢';
      case 'reply':
        return '↩️';
      case 'share':
        return '🔁';
      case 'system':
        return '✨';
      default:
        return '🔔';
    }
  };

  const getNotificationLink = (notification: Notification) => {
    // DM or group chat message - go to the specific chat if chatId is available
    if (notification.chatId) {
      return `/chats?chat=${notification.chatId}`;
    }

    // Group chat invite - go to chat
    if (
      notification.type === 'system' &&
      notification.message.includes('invited you to')
    ) {
      // Extract chat ID from the message or notification data
      // For now, go to chats page where they can see their invitations
      return '/chats';
    }

    // DM or group chat message without chatId (legacy notifications) - go to chats page
    if (
      notification.type === 'system' &&
      (notification.message.includes('Message') ||
        notification.message.includes('message'))
    ) {
      return '/chats';
    }

    // Profile completion - go to settings
    if (
      notification.type === 'system' &&
      notification.message.includes('profile')
    ) {
      return '/settings';
    }

    // Follow notification - go to the follower's profile
    if (notification.type === 'follow' && notification.actorId) {
      return `/profile/${notification.actorId}`;
    }

    // Comment or reaction on post - go to the post detail page
    if (
      (notification.type === 'comment' ||
        notification.type === 'reaction' ||
        notification.type === 'reply') &&
      notification.postId
    ) {
      return `/post/${notification.postId}`;
    }

    // Share notification - go to the post
    if (notification.type === 'share' && notification.postId) {
      return `/post/${notification.postId}`;
    }

    // Mention - go to the post if available
    if (notification.type === 'mention' && notification.postId) {
      return `/post/${notification.postId}`;
    }

    // Default: go to feed
    return '/feed';
  };

  if (!authenticated) {
    return (
      <PageContainer
        noPadding
        className="!overflow-visible flex w-full flex-col"
      >
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-[rgba(120,120,120,0.5)] lg:border-r lg:border-l">
          <div className="sticky top-0 z-10 border-border border-b bg-background">
            <div className="px-4 py-3 lg:px-6">
              <h1 className="font-bold text-xl">Notifications</h1>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground">
              Please sign in to view notifications
            </p>
            <Link
              href="/feed"
              className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90"
            >
              Go to Feed
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer noPadding className="flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 border-border border-b bg-background/95 backdrop-blur-sm">
        <div className="px-4 py-3">
          <h1 className="font-bold text-xl">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-muted-foreground text-sm">
              {unreadCount} unread
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={containerRef} className="relative flex-1 overflow-y-auto">
        {/* Pull to refresh indicator */}
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
        />
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground">
              Loading notifications...
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Bell className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
            <h2 className="mb-2 font-semibold text-xl">No notifications yet</h2>
            <p className="px-4 text-center text-muted-foreground">
              When you get comments, reactions, follows, or mentions,
              they&apos;ll show up here.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-feed space-y-4">
            {/* Group Invites Section */}
            {groupInvites.length > 0 && (
              <div className="space-y-3 px-4">
                <h3 className="font-semibold text-muted-foreground text-sm">
                  Pending Group Invites
                </h3>
                {groupInvites.map((invite) => (
                  <GroupInviteCard
                    key={invite.inviteId}
                    inviteId={invite.inviteId}
                    groupId={invite.groupId}
                    groupName={invite.groupName}
                    groupDescription={invite.groupDescription}
                    memberCount={invite.memberCount}
                    invitedAt={invite.invitedAt}
                    onAccepted={(_groupId, chatId) => {
                      // Refresh invites list
                      void fetchNotifications();
                      toast.success('Joined group!');
                      // Navigate to chat if available
                      if (chatId) {
                        router.push(`/chats?chat=${chatId}`);
                      }
                    }}
                    onDeclined={() => {
                      // Refresh invites list
                      void fetchNotifications();
                      toast.success('Invite declined');
                    }}
                  />
                ))}
              </div>
            )}

            {/* Regular Notifications */}
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={getNotificationLink(notification)}
                onClick={() => markAsRead(notification.id, notification.read)}
                data-notification-id={notification.id}
                className={cn(
                  'block border-border border-b px-4 py-4 lg:px-6',
                  'transition-colors hover:bg-muted/30',
                  !notification.read && 'bg-primary/5'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Unread Indicator - moved to left */}
                  {!notification.read && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}

                  {/* Actor Avatar */}
                  {notification.actor ? (
                    <Avatar
                      id={notification.actor.id}
                      name={notification.actor.displayName}
                      size="md"
                      className="shrink-0"
                    />
                  ) : (
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                        notification.type === 'system'
                          ? 'bg-primary/10'
                          : 'bg-muted'
                      )}
                    >
                      {notification.type === 'system' ? (
                        <span className="text-xl">
                          {getNotificationIcon(notification.type)}
                        </span>
                      ) : (
                        <Bell className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        {notification.type === 'system' ? (
                          <p className="text-foreground leading-relaxed">
                            {notification.message}
                          </p>
                        ) : (
                          <p className="text-foreground leading-relaxed">
                            <span className="font-semibold">
                              {notification.actor
                                ? notification.actor.displayName
                                : 'Someone'}
                            </span>{' '}
                            <span className="text-muted-foreground">
                              {getNotificationIcon(notification.type)}{' '}
                              {notification.message
                                .replace(
                                  notification.actor
                                    ? notification.actor.displayName
                                    : '',
                                  ''
                                )
                                .replace(/^:\s*/, '')}
                            </span>
                          </p>
                        )}
                        <time className="mt-1 block text-muted-foreground text-sm">
                          {formatTimeAgo(notification.createdAt)}
                        </time>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
