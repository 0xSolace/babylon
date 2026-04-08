import {
  addPublicReadHeaders,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import type { NextRequest } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';
import { getPublicResolutionAudit } from '../../_resolution-audit';

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const { error, rateLimitInfo, user } = await publicRateLimit(request);
    if (error) return error;

    const { id: marketId } = await context.params;

    return runWithOptionalUserRls(user, async (db) => {
      const audit = await getPublicResolutionAudit(marketId, db);

      if (!audit) {
        return successResponse({ error: 'Market not found' }, 404);
      }

      const response = successResponse({
        success: true,
        marketId,
        resolutionAudit: audit,
      });

      if (rateLimitInfo) addPublicReadHeaders(response, rateLimitInfo);
      return response;
    });
  }
);
