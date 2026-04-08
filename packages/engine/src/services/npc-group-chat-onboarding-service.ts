/**
 * NPC Group Chat Onboarding Service
 *
 * Ensures new / empty users are placed into at least one NPC group chat so the
 * private chat system can be demonstrated end-to-end in local development.
 *
 * This intentionally creates **membership** (GroupMember + ChatParticipant),
 * not a pending invite, because pending invites do not appear in the Messages UI.
 */

import {
  npcGroupChatOnboardingRead,
  npcGroupChatOnboardingWrite,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import { pickRandom, type RngFunction } from '../utils/randomization';

function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.BUN_ENV === 'test' ||
    (typeof process !== 'undefined' &&
      Array.isArray(process.argv) &&
      process.argv.join(' ').includes('test'))
  );
}

export interface AutoJoinEmptyUsersToNpcGroupChatsOptions {
  enabled: boolean;
  /** Max number of users to process per tick/run */
  batchSize: number;
  /** Fallback max members when Group.maxMembers is null */
  defaultMaxMembers: number;
  /** Optional: restrict onboarding to these specific user IDs (useful for tests) */
  userIdAllowlist?: string[];
  /** Optional: restrict destination chats to these specific chat IDs (useful for tests) */
  chatIdAllowlist?: string[];
  /** Optional random number generator (defaults to Math.random) */
  rng?: RngFunction;
}

export async function autoJoinEmptyUsersToNpcGroupChats(
  options: AutoJoinEmptyUsersToNpcGroupChatsOptions
): Promise<number> {
  if (!options.enabled) {
    return 0;
  }

  const userAllowlist =
    options.userIdAllowlist && options.userIdAllowlist.length > 0
      ? options.userIdAllowlist
      : null;

  const chatAllowlist =
    options.chatIdAllowlist && options.chatIdAllowlist.length > 0
      ? options.chatIdAllowlist
      : null;

  const read = await npcGroupChatOnboardingRead({
    batchSize: options.batchSize,
    userIdAllowlist: userAllowlist,
    chatIdAllowlist: chatAllowlist,
    restrictToTestUsers: isTestEnvironment(),
  });

  if (read.kind === 'no_users') {
    return 0;
  }

  if (read.kind === 'no_chats') {
    logger.warn(
      'Auto-join skipped: no NPC group chats available',
      { userCount: read.userCount },
      'NPCGroupChatOnboarding'
    );
    return 0;
  }

  const { userIds, preferredChats, participantCountMap } = read;

  type ChatSlot = {
    chatId: string;
    groupId: string;
    ownerId: string;
    slots: number;
  };

  const chatSlots: ChatSlot[] = [];
  for (const chat of preferredChats) {
    const currentCount = participantCountMap.get(chat.chatId) ?? 0;
    const maxMembers =
      typeof chat.groupMaxMembers === 'number' && chat.groupMaxMembers > 0
        ? chat.groupMaxMembers
        : options.defaultMaxMembers;
    const slots = Math.max(0, maxMembers - currentCount);
    if (slots > 0) {
      chatSlots.push({
        chatId: chat.chatId,
        groupId: chat.groupId,
        ownerId: chat.groupOwnerId,
        slots,
      });
    }
  }

  if (chatSlots.length === 0) {
    logger.warn(
      'Auto-join skipped: all NPC group chats are full',
      { userCount: userIds.length },
      'NPCGroupChatOnboarding'
    );
    return 0;
  }

  type JoinAssignment = {
    userId: string;
    chatId: string;
    groupId: string;
    invitedBy: string;
  };

  const rng = options.rng ?? Math.random;
  const assignments: JoinAssignment[] = [];
  for (const userId of userIds) {
    const available = chatSlots.filter((c) => c.slots > 0);
    if (available.length === 0) break;

    const selected = pickRandom(available, rng);
    if (!selected) break;

    assignments.push({
      userId,
      chatId: selected.chatId,
      groupId: selected.groupId,
      invitedBy: selected.ownerId,
    });
    selected.slots -= 1;
  }

  if (assignments.length === 0) {
    return 0;
  }

  const now = new Date();
  await npcGroupChatOnboardingWrite(assignments, now);

  logger.info(
    'Auto-joined users into NPC group chats (dev demo)',
    {
      usersJoined: assignments.length,
      batchSize: options.batchSize,
    },
    'NPCGroupChatOnboarding'
  );

  return assignments.length;
}
