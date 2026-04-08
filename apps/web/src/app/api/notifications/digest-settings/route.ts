import { authenticate, successResponse, withErrorHandling } from '@babylon/api';
import * as BabylonDb from '@babylon/db';
import * as engineStorage from '@babylon/db/engine-storage';
import {
  DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
  logger,
  type NotificationDigestSettings,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMissingNotificationSchemaErrorCode } from '../schema-compat';

const DigestSettingsSchema = z.object({
  digestEnabled: z.boolean(),
  frequency: z.enum(['hourly', 'daily', 'weekly']),
  deliveryChannel: z.enum(['in-app', 'email', 'both']),
});

function toSettings(row: {
  notificationDigestEnabled: boolean;
  notificationDigestFrequency: string;
  notificationDigestDeliveryChannel: string;
}): NotificationDigestSettings {
  return {
    digestEnabled: row.notificationDigestEnabled,
    frequency:
      row.notificationDigestFrequency as NotificationDigestSettings['frequency'],
    deliveryChannel:
      row.notificationDigestDeliveryChannel as NotificationDigestSettings['deliveryChannel'],
  };
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);

  try {
    const user = await engineStorage.asUser(authUser, async (db) =>
      BabylonDb.selectUserNotificationDigestSettingsByUserId(
        db,
        authUser.userId
      )
    );

    return successResponse({
      success: true,
      settings: user ? toSettings(user) : DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
    });
  } catch (error) {
    const missingSchemaCode = getMissingNotificationSchemaErrorCode(error);
    if (!missingSchemaCode) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      'Notification digest settings unavailable because the database schema is pending',
      { userId: authUser.userId, code: missingSchemaCode, errorMessage },
      'GET /api/notifications/digest-settings'
    );

    return successResponse({
      success: true,
      settings: DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
    });
  }
});

export const PUT = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  const payload = DigestSettingsSchema.parse(await request.json());

  const updated = await engineStorage.asUser(authUser, async (db) =>
    BabylonDb.updateUserNotificationDigestSettingsByUserId(
      db,
      authUser.userId,
      {
        digestEnabled: payload.digestEnabled,
        frequency: payload.frequency,
        deliveryChannel: payload.deliveryChannel,
      },
      new Date()
    )
  );

  return successResponse({
    success: true,
    settings: updated ? toSettings(updated) : payload,
  });
});
