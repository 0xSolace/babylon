import { authenticate, successResponse, withErrorHandling } from '@babylon/api';
import { db, eq, users } from '@babylon/db';
import {
  DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
  type NotificationDigestSettings,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

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

  const [user] = await db
    .select({
      notificationDigestEnabled: users.notificationDigestEnabled,
      notificationDigestFrequency: users.notificationDigestFrequency,
      notificationDigestDeliveryChannel:
        users.notificationDigestDeliveryChannel,
    })
    .from(users)
    .where(eq(users.id, authUser.userId))
    .limit(1);

  return successResponse({
    success: true,
    settings: user ? toSettings(user) : DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
  });
});

export const PUT = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  const payload = DigestSettingsSchema.parse(await request.json());

  const [updated] = await db
    .update(users)
    .set({
      notificationDigestEnabled: payload.digestEnabled,
      notificationDigestFrequency: payload.frequency,
      notificationDigestDeliveryChannel: payload.deliveryChannel,
      notificationDigestLastSentAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, authUser.userId))
    .returning({
      notificationDigestEnabled: users.notificationDigestEnabled,
      notificationDigestFrequency: users.notificationDigestFrequency,
      notificationDigestDeliveryChannel:
        users.notificationDigestDeliveryChannel,
    });

  return successResponse({
    success: true,
    settings: updated ? toSettings(updated) : payload,
  });
});
