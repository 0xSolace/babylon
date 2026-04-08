/**
 * User Notification Email Preferences API
 *
 * @route GET /api/users/[userId]/notification-email-preferences
 * @route POST /api/users/[userId]/notification-email-preferences
 * @access Authenticated (own profile only)
 */

import {
  AuthorizationError,
  authenticate,
  BadRequestError,
  getPrivyClient,
  requireUserByIdentifier,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  selectUserEmailAndVerifiedByUserId,
  selectUserNotificationEmailPreferencesByUserId,
  type UserNotificationEmailPreferencePatch,
  updateUserNotificationEmailPreferencesByIdReturning,
  updateUserVerifiedEmailByIdReturningEmailSlice,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import {
  getAllVerifiedEmails,
  logger,
  type PrivyUserWithEmails,
  UserIdParamSchema,
} from '@babylon/shared';
import type { User as PrivyUser } from '@privy-io/server-auth';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const UpdateNotificationEmailPreferencesSchema = z
  .object({
    enabled: z.boolean().optional(),
    realtime: z.boolean().optional(),
    dailySummary: z.boolean().optional(),
    weeklySummary: z.boolean().optional(),
    monthlySummary: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.enabled !== undefined ||
      data.realtime !== undefined ||
      data.dailySummary !== undefined ||
      data.weeklySummary !== undefined ||
      data.monthlySummary !== undefined,
    {
      message: 'At least one preference must be provided',
    }
  );

type PrivyUserWithOptionalEmail = PrivyUser & PrivyUserWithEmails;

async function getVerifiedEmailFromPrivy(
  privyId: string
): Promise<string | null> {
  const privyClient = getPrivyClient();
  const privyUser = (await privyClient.getUser(
    privyId
  )) as PrivyUserWithOptionalEmail;
  return getAllVerifiedEmails(privyUser)[0] ?? null;
}

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    const authUser = await authenticate(request);
    const params = await context.params;
    const { userId } = UserIdParamSchema.parse(params);
    const targetUser = await requireUserByIdentifier(userId, { id: true });
    const canonicalUserId = targetUser.id;

    if (authUser.userId !== canonicalUserId) {
      throw new AuthorizationError(
        'You can only access your own notification email preferences',
        'notification-email-preferences',
        'read'
      );
    }

    const userRecord = await asUser(authUser, async (db) =>
      selectUserNotificationEmailPreferencesByUserId(db, canonicalUserId)
    );

    return successResponse({
      success: true,
      preferences: {
        enabled: userRecord?.enabled ?? false,
        realtime: userRecord?.realtime ?? true,
        dailySummary: userRecord?.dailySummary ?? true,
        weeklySummary: userRecord?.weeklySummary ?? true,
        monthlySummary: userRecord?.monthlySummary ?? true,
      },
      email: userRecord?.email ?? null,
      emailVerified: userRecord?.emailVerified ?? false,
    });
  }
);

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    const authUser = await authenticate(request);
    const params = await context.params;
    const { userId } = UserIdParamSchema.parse(params);
    const targetUser = await requireUserByIdentifier(userId, { id: true });
    const canonicalUserId = targetUser.id;

    if (authUser.userId !== canonicalUserId) {
      throw new AuthorizationError(
        'You can only update your own notification email preferences',
        'notification-email-preferences',
        'update'
      );
    }

    const body = await request.json();
    const payload = UpdateNotificationEmailPreferencesSchema.parse(body);

    const existingUser = await asUser(authUser, async (db) =>
      selectUserEmailAndVerifiedByUserId(db, canonicalUserId)
    );

    if (!existingUser) {
      throw new BadRequestError('User not found');
    }

    const isEnablingEmailNotifications =
      payload.enabled === true ||
      payload.realtime === true ||
      payload.dailySummary === true ||
      payload.weeklySummary === true ||
      payload.monthlySummary === true;

    let effectiveEmail = existingUser.email;
    let effectiveEmailVerified = existingUser.emailVerified;

    if (
      isEnablingEmailNotifications &&
      (!effectiveEmail || !effectiveEmailVerified)
    ) {
      const privyId = authUser.privyId ?? authUser.userId;
      const verifiedEmail = await getVerifiedEmailFromPrivy(privyId);

      if (!verifiedEmail) {
        throw new BadRequestError(
          'No verified email was found on your account. Please link and verify an email in Privy first.'
        );
      }

      const updatedEmailUser = await asUser(authUser, async (db) =>
        updateUserVerifiedEmailByIdReturningEmailSlice(
          db,
          canonicalUserId,
          verifiedEmail,
          new Date()
        )
      );

      effectiveEmail = updatedEmailUser?.email ?? verifiedEmail;
      effectiveEmailVerified = updatedEmailUser?.emailVerified ?? true;
    }

    const updateData: UserNotificationEmailPreferencePatch = {
      updatedAt: new Date(),
    };

    if (payload.enabled !== undefined) {
      updateData.emailNotificationsEnabled = payload.enabled;
      updateData.emailNotificationsUnsubscribedAt = payload.enabled
        ? null
        : new Date();

      if (!payload.enabled) {
        updateData.emailNotificationsRealtime = false;
        updateData.emailNotificationsDailySummary = false;
        updateData.emailNotificationsWeeklySummary = false;
        updateData.emailNotificationsMonthlySummary = false;
      }
    }

    if (payload.realtime !== undefined) {
      updateData.emailNotificationsRealtime = payload.realtime;
    }
    if (payload.dailySummary !== undefined) {
      updateData.emailNotificationsDailySummary = payload.dailySummary;
    }
    if (payload.weeklySummary !== undefined) {
      updateData.emailNotificationsWeeklySummary = payload.weeklySummary;
    }
    if (payload.monthlySummary !== undefined) {
      updateData.emailNotificationsMonthlySummary = payload.monthlySummary;
    }

    if (
      payload.realtime === true ||
      payload.dailySummary === true ||
      payload.weeklySummary === true ||
      payload.monthlySummary === true
    ) {
      updateData.emailNotificationsEnabled = true;
      updateData.emailNotificationsUnsubscribedAt = null;
    }

    const updatedUser = await asUser(authUser, async (db) =>
      updateUserNotificationEmailPreferencesByIdReturning(
        db,
        canonicalUserId,
        updateData
      )
    );

    logger.info(
      'Updated notification email preferences',
      {
        userId: canonicalUserId,
        enabled: updatedUser?.enabled,
        realtime: updatedUser?.realtime,
        dailySummary: updatedUser?.dailySummary,
        weeklySummary: updatedUser?.weeklySummary,
        monthlySummary: updatedUser?.monthlySummary,
      },
      'POST /api/users/[userId]/notification-email-preferences'
    );

    return successResponse({
      success: true,
      preferences: {
        enabled: updatedUser?.enabled ?? false,
        realtime: updatedUser?.realtime ?? false,
        dailySummary: updatedUser?.dailySummary ?? false,
        weeklySummary: updatedUser?.weeklySummary ?? false,
        monthlySummary: updatedUser?.monthlySummary ?? false,
      },
      email: updatedUser?.email ?? effectiveEmail ?? null,
      emailVerified: updatedUser?.emailVerified ?? effectiveEmailVerified,
    });
  }
);
