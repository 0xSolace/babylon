import {
  errorResponse,
  logAdminAction,
  requirePermission,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import type { JsonValue } from '@babylon/db';
import { gameMasterService } from '@babylon/engine';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const ControlSchema = z.object({
  action: z.enum([
    'run_daily',
    'run_pulse',
    'pause_auto_run',
    'resume_auto_run',
  ]),
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requirePermission(request, 'view_game_master');
  const dashboard = await gameMasterService.getDashboard();
  return successResponse(dashboard);
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  const admin = await requirePermission(request, 'manage_game_master');
  const body = await request.json().catch(() => null);
  const parsed = ControlSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse('Invalid control payload', 'VALIDATION_ERROR', 400, {
      details: parsed.error.flatten(),
    });
  }

  const { action } = parsed.data;
  let result: Record<string, unknown>;

  if (action === 'pause_auto_run') {
    await gameMasterService.setAutoRunPaused(true);
    result = { paused: true };
  } else if (action === 'resume_auto_run') {
    await gameMasterService.setAutoRunPaused(false);
    result = { paused: false };
  } else {
    result = await gameMasterService.runScheduledPass({
      forcedRunType: action === 'run_daily' ? 'daily' : 'pulse',
      triggerType: 'admin_manual',
      triggerData: { initiatedBy: admin.userId },
    });
  }

  await logAdminAction('GAME_MASTER_CONTROL', {
    adminId: admin.userId,
    userAgent: request.headers.get('user-agent') ?? undefined,
    resourceType: 'game_master_run',
    metadata: { action, result } as JsonValue,
  });

  return successResponse(result);
});
