/**
 * Admin Moderation Escrow List API
 *
 * @route GET /api/admin/moderation-escrow/list - List escrow payments
 * @access Admin
 *
 * @description
 * Returns list of moderation escrow payments with filtering by recipient,
 * admin, or status. Supports pagination.
 *
 * @openapi
 * /api/admin/moderation-escrow/list:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List moderation escrow payments
 *     description: Returns escrow payments with filtering and pagination (admin only)
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: query
 *         name: recipientId
 *         schema:
 *           type: string
 *         description: Filter by recipient ID
 *       - in: query
 *         name: adminId
 *         schema:
 *           type: string
 *         description: Filter by admin ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, paid, refunded, expired]
 *         description: Filter by payment status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payments:
 *                   type: array
 *                 total:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *
 * @example
 * ```typescript
 * const { payments } = await fetch('/api/admin/moderation-escrow/list?status=pending', {
 *   headers: { 'Authorization': `Bearer ${adminToken}` }
 * }).then(r => r.json());
 * ```
 */

import { requireAdmin, withErrorHandling } from '@babylon/api';
import {
  expireStalePendingModerationEscrows,
  listModerationEscrowsAdminPage,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { toISO, toISOOrNull } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ListEscrowQuerySchema = z.object({
  recipientId: z.string().optional(),
  adminId: z.string().optional(),
  status: z.enum(['pending', 'paid', 'refunded', 'expired']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const validation = ListEscrowQuerySchema.safeParse({
    recipientId: searchParams.get('recipientId'),
    adminId: searchParams.get('adminId'),
    status: searchParams.get('status'),
    limit: searchParams.get('limit'),
    offset: searchParams.get('offset'),
  });

  if (!validation.success) {
    return NextResponse.json(
      {
        error:
          validation.error.issues[0]?.message || 'Invalid query parameters',
      },
      { status: 400 }
    );
  }

  const { recipientId, adminId, status, limit, offset } = validation.data;

  return await asSystem(async (tx) => {
    await expireStalePendingModerationEscrows(tx, new Date());

    const { rows, total } = await listModerationEscrowsAdminPage(tx, {
      recipientId,
      adminId,
      status,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      escrows: rows.map((escrow) => ({
        id: escrow.id,
        recipientId: escrow.recipientId,
        recipient: {
          id: escrow.recipientId,
          username: escrow.recipient?.username ?? null,
          displayName: escrow.recipient?.displayName ?? null,
          profileImageUrl: escrow.recipient?.profileImageUrl ?? null,
        },
        adminId: escrow.adminId,
        admin: {
          id: escrow.adminId,
          username: escrow.admin?.username ?? null,
          displayName: escrow.admin?.displayName ?? null,
        },
        amountUSD: escrow.amountUSD,
        amountWei: escrow.amountWei,
        status: escrow.status,
        reason: escrow.reason,
        paymentRequestId: escrow.paymentRequestId,
        paymentTxHash: escrow.paymentTxHash,
        refundTxHash: escrow.refundTxHash,
        refundedBy: escrow.refundedBy,
        refundedByUser: escrow.refundedBy
          ? {
              id: escrow.refundedBy,
              username: escrow.refundedByUser?.username ?? null,
              displayName: escrow.refundedByUser?.displayName ?? null,
            }
          : null,
        refundedAt: toISOOrNull(escrow.refundedAt),
        createdAt: toISO(escrow.createdAt),
        expiresAt: toISO(escrow.expiresAt),
      })),
      pagination: {
        total,
        limit,
        offset,
      },
    });
  }, 'admin-moderation-escrow-list');
});
