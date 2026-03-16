import {
  errorResponse,
  logAdminAction,
  requirePermission,
  successResponse,
  ValidationError,
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

    try {
      await gameMasterService.retryAction(actionId);
    } catch (error) {
      if (
        error instanceof ValidationError ||
        (error instanceof Error && error.name === 'ValidationError')
      ) {
        return errorResponse(error.message, 'VALIDATION_ERROR', 422);
      }
      throw error;
    }
    await logAdminAction('GAME_MASTER_RETRY', {
      adminId: admin.userId,
      userAgent: request.headers.get('user-agent') ?? undefined,
      resourceType: 'game_master_action',
      resourceId: actionId,
    });
    return successResponse({ success: true });
  }
);
