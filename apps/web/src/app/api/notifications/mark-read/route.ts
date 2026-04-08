/**
 * Mark Notifications as Read API
 *
 * @route POST /api/notifications/mark-read - Mark notifications as read
 * @access Authenticated
 *
 * @description
 * Marks one or more notifications as read/acknowledged. Supports marking
 * specific notifications, all notifications of a type, or all notifications.
 *
 * @openapi
 * /api/notifications/mark-read:
 *   post:
 *     tags:
 *       - Notifications
 *     summary: Mark notifications as read
 *     description: Marks notifications as read (authenticated user only)
 *     security:
 *       - PrivyAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specific notification IDs to mark
 *               type:
 *                 type: string
 *                 description: Mark all notifications of this type
 *               markAll:
 *                 type: boolean
 *                 description: Mark all notifications as read
 *     responses:
 *       200:
 *         description: Notifications marked as read successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *
 * @example
 * ```typescript
 * await fetch('/api/notifications/mark-read', {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({ markAll: true })
 * });
 * ```
 */

import { authenticate, successResponse, withErrorHandling } from '@babylon/api';
import {
  markAllUnreadNotificationsReadForUser,
  markNotificationsReadByIdsForUser,
  markUnreadNotificationsReadByTypeForUser,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';

import type { NextRequest } from 'next/server';
import { z } from 'zod';

const markReadSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  type: z.string().optional(), // Mark all notifications of a specific type as read
  markAll: z.boolean().optional(), // Mark all notifications as read
});

/**
 * POST /api/notifications/mark-read
 * Mark notifications as read
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);
  const body = await request.json();
  const { notificationIds, type, markAll } = markReadSchema.parse(body);

  if (markAll) {
    // Mark all notifications as read
    await asUser(user, async (db) =>
      markAllUnreadNotificationsReadForUser(db, user.userId)
    );

    return successResponse({
      data: {
        message: 'All notifications marked as read',
      },
    });
  }

  if (type) {
    // Mark all notifications of a specific type as read
    await asUser(user, async (db) =>
      markUnreadNotificationsReadByTypeForUser(db, user.userId, type)
    );

    return successResponse({
      data: {
        message: `All ${type} notifications marked as read`,
      },
    });
  }

  if (notificationIds && notificationIds.length > 0) {
    // Mark specific notifications as read
    await asUser(user, async (db) =>
      markNotificationsReadByIdsForUser(db, user.userId, notificationIds)
    );

    return successResponse({
      data: {
        message: `${notificationIds.length} notification(s) marked as read`,
      },
    });
  }

  return successResponse({
    data: {
      message: 'No notifications to mark',
    },
  });
});
