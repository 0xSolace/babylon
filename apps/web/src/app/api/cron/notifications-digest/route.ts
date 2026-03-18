import {
  recordCronExecution,
  relayCronToStaging,
  successResponse,
  verifyCronAuth,
  withErrorHandling,
} from '@babylon/api';
import type { NotificationDigestSettings } from '@babylon/shared';
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
  if (relay) {
    return relay;
  }

  const now = new Date();
  const candidates = await listDigestCandidates();
  let processed = 0;
  let delivered = 0;
  let withContent = 0;

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
  }

  const payload = {
    success: true,
    processed,
    delivered,
    withContent,
  };

  recordCronExecution('notifications-digest', startTime, payload);
  return successResponse(payload);
};

export const POST = withErrorHandling(cronHandler);
export const GET = withErrorHandling(cronHandler);
