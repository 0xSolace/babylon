import {
  recordCronExecution,
  relayCronToStaging,
  verifyCronAuth,
  withErrorHandling,
} from '@babylon/api';
import { gameMasterService } from '@babylon/engine';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ensureEngineServices } from '@/lib/engine/ensure-engine-services';

export const maxDuration = 240;
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: NextRequest) =>
  POST(request)
);

export const POST = withErrorHandling(async (request: NextRequest) => {
  ensureEngineServices();

  if (!verifyCronAuth(request, { jobName: 'GameMasterTick' })) {
    return NextResponse.json(
      { error: 'Unauthorized cron request' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  const relayResult = await relayCronToStaging(request, 'game-master-tick');
  if (relayResult.forwarded) {
    logger.info(
      'Cron execution relayed to staging (fan-out: continuing local execution)',
      { status: relayResult.status, error: relayResult.error },
      'GameMasterTick'
    );
  }

  const result = await gameMasterService.runScheduledPass();
  recordCronExecution('game-master-tick', new Date(startTime), {
    success: result.skipped ? false : true,
    skipped: Boolean(result.skipped),
    reason: result.skipped ?? undefined,
    processed: result.runId ? 1 : 0,
    runType: result.runType,
  });

  return NextResponse.json({
    success: !result.skipped,
    duration: Date.now() - startTime,
    ...result,
  });
});
