/**
 * Admin NFT Collection Group API
 *
 * @route POST /api/admin/groups/nft-collection - Create NFT-gated group
 * @route GET /api/admin/groups/nft-collection - List NFT-gated groups
 * @access Admin
 *
 * @description
 * Admin-only endpoints for creating and managing NFT-gated group chats.
 * These are groups where access is restricted to holders of specific NFT collections.
 * Users automatically lose access if they transfer or sell their NFT.
 */

import {
  getClientIp,
  logAdminView,
  requireAdmin,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  fetchAdminNftGatedChatsWithMemberCounts,
  runAdminCreateNftCollectionGroup,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { generateSnowflakeId, logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const CreateNftCollectionGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  contractAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address format')
    .transform((addr) => addr.toLowerCase()),
  chainId: z.number().int().positive(),
  tokenId: z.number().int().min(0).nullable().optional(),
});

/**
 * GET /api/admin/groups/nft-collection
 * List all NFT-gated group chats
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const admin = await requireAdmin(request);

  logAdminView({
    adminId: admin.userId,
    ipAddress: getClientIp(request.headers) ?? undefined,
    resourceType: 'nft-groups',
    metadata: { action: 'list_nft_gated_groups' },
  });

  const { chatsList, memberCountByChatId } = await asSystem(
    (tx) => fetchAdminNftGatedChatsWithMemberCounts(tx),
    'admin-nft-collection-list'
  );

  const nftGatedChats = chatsList.map((chat) => ({
    ...chat,
    memberCount: memberCountByChatId[chat.id] ?? 0,
  }));

  return successResponse({
    groups: nftGatedChats,
    total: nftGatedChats.length,
  });
});

/**
 * POST /api/admin/groups/nft-collection
 * Create a new NFT-gated group chat for an NFT collection
 * Only admins can create these collection-based groups
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  const body = await request.json();
  const data = CreateNftCollectionGroupSchema.parse(body);

  logAdminView({
    adminId: admin.userId,
    ipAddress: getClientIp(request.headers) ?? undefined,
    resourceType: 'nft-groups',
    metadata: {
      action: 'create_nft_gated_group',
      contractAddress: data.contractAddress,
      chainId: data.chainId,
    },
  });

  // Generate all IDs upfront before transaction
  const [groupId, chatId, memberId, participantId] = await Promise.all([
    generateSnowflakeId(),
    generateSnowflakeId(),
    generateSnowflakeId(),
    generateSnowflakeId(),
  ]);
  const now = new Date();

  const result = await asSystem(
    (tx) =>
      runAdminCreateNftCollectionGroup(tx, {
        groupId,
        chatId,
        memberId,
        participantId,
        adminUserId: admin.userId,
        name: data.name,
        description: data.description ?? null,
        contractAddress: data.contractAddress,
        chainId: data.chainId,
        tokenId: data.tokenId ?? null,
        now,
      }),
    'admin-nft-collection-create'
  );

  logger.info(
    'NFT-gated group created by admin',
    {
      adminId: admin.userId,
      groupId: result.groupId,
      chatId: result.chatId,
      contractAddress: data.contractAddress,
      chainId: data.chainId,
    },
    'POST /api/admin/groups/nft-collection'
  );

  return successResponse(
    {
      group: {
        id: result.groupId,
        name: data.name,
        chatId: result.chatId,
        nftGated: true,
        contractAddress: data.contractAddress,
        tokenId: data.tokenId ?? null,
        chainId: data.chainId,
      },
    },
    201
  );
});
