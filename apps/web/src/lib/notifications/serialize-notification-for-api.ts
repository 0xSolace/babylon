import { toISO } from '@babylon/shared';

/**
 * Shape returned to clients for notification list endpoints (GET /api/notifications).
 */
export function serializeNotificationForApi(
  n: Record<string, unknown> & {
    actor?: Record<string, unknown> | null;
  }
) {
  const toSafeString = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'object' && 'toString' in value) {
      return (value as { toString: () => string }).toString();
    }
    return String(value);
  };

  let createdAtISO: string;
  if (n.createdAt instanceof Date) {
    createdAtISO = toISO(n.createdAt);
  } else if (typeof n.createdAt === 'string') {
    createdAtISO = n.createdAt;
  } else {
    const dateValue = n.createdAt as string | number | Date;
    createdAtISO = new Date(dateValue).toISOString();
  }

  return {
    id: toSafeString(n.id),
    type: toSafeString(n.type),
    title: toSafeString(n.title),
    actorId: toSafeString(n.actorId),
    actor: n.actor
      ? {
          id: toSafeString(n.actor.id),
          displayName: toSafeString(n.actor.displayName),
          username: toSafeString(n.actor.username),
          profileImageUrl: toSafeString(n.actor.profileImageUrl),
        }
      : null,
    postId: n.postId ? toSafeString(n.postId) : null,
    commentId: n.commentId ? toSafeString(n.commentId) : null,
    chatId: n.chatId ? toSafeString(n.chatId) : null,
    groupId: n.groupId ? toSafeString(n.groupId) : null,
    inviteId: n.inviteId ? toSafeString(n.inviteId) : null,
    message: toSafeString(n.message),
    data:
      n.data && typeof n.data === 'object'
        ? (n.data as Record<string, unknown>)
        : null,
    read: Boolean(n.read),
    createdAt: createdAtISO,
  };
}
