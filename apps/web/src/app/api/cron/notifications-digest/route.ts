import {
  recordCronExecution,
  relayCronToStaging,
  successResponse,
  verifyCronAuth,
  withErrorHandling,
} from '@babylon/api';
import { logger, type NotificationDigestSettings } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import {
  deliverDigestForUser,
  isDigestDue,
  listDigestCandidates,
} from '@/lib/services/notification-digest-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const cronHandler = async (request: NextRequest) => {
  const startTime = new Date();

  if (!verifyCronAuth(request, { jobName: 'NotificationsDigest' })) {
    return successResponse({ error: 'Unauthorized' }, 401);
  }

  const relay = await relayCronToStaging(request, 'notifications-digest');
  if (relay.forwarded) {
    // Note: Intentionally executing locally after relay for fan-out architecture.
    // Staging processes its own user subset; production processes its own.
    // No duplicate notifications occur because each environment has distinct users.
    logger.info(
      'Notifications digest cron relayed to staging (fan-out: also executing locally)',
      { status: relay.status, error: relay.error },
      'NotificationsDigestCron'
    );
  }

  const now = new Date();
  const candidates = await listDigestCandidates();
  let processed = 0;
  let delivered = 0;
  let withContent = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const settings: NotificationDigestSettings = {
      digestEnabled: candidate.digestEnabled,
      frequency: candidate.digestFrequency,
      deliveryChannel: candidate.deliveryChannel,
    };

    if (
      !settings.digestEnabled ||
      !isDigestDue({
        now,
        frequency: settings.frequency,
        lastSentAt: candidate.lastSentAt,
      })
    ) {
      continue;
    }

    processed += 1;

    try {
      const result = await deliverDigestForUser({
        candidate,
        settings,
        now,
      });

      if (result.hadContent) {
        withContent += 1;
      }
      if (result.delivered) {
        delivered += 1;
      }
    } catch (error) {
      failed += 1;
      logger.error(
        'Digest delivery failed for candidate (continuing batch)',
        {
          userId: candidate.id,
          frequency: settings.frequency,
          deliveryChannel: settings.deliveryChannel,
          error: error instanceof Error ? error.message : String(error),
        },
        'NotificationsDigestCron'
      );
    }
  }

  const payload = {
    success: true,
    processed,
    delivered,
    withContent,
    failed,
  };

  recordCronExecution('notifications-digest', startTime, payload);
  return successResponse(payload);
};

export const POST = withErrorHandling(cronHandler);
export const GET = withErrorHandling(cronHandler);
