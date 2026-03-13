import {
  errorResponse,
  logAdminAction,
  requirePermission,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { gameMasterService } from '@babylon/engine';
import type { NextRequest } from 'next/server';

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ actionId: string }> }
  ) => {
    const admin = await requirePermission(request, 'manage_game_master');
    const { actionId } = await params;

    if (!actionId) {
      return errorResponse('Missing actionId', 'VALIDATION_ERROR', 400);
    }

    await gameMasterService.retryAction(actionId);
    await logAdminAction('GAME_MASTER_RETRY', {
      adminId: admin.userId,
      userAgent: request.headers.get('user-agent') ?? undefined,
      resourceType: 'game_master_action',
      resourceId: actionId,
    });
    return successResponse({ success: true });
  }
);
