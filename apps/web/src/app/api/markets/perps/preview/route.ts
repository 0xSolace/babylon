import {
  addPublicReadHeaders,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createPerpMarketService } from '../_adapters';

const PreviewBodySchema = z.object({
  ticker: z.string().trim().min(1),
  side: z.enum(['long', 'short']),
  size: z.number().finite().positive(),
  leverage: z.number().int().min(1).max(100),
});

/**
 * POST /api/markets/perps/preview
 * Returns the canonical open-order execution preview for a perp order.
 *
 * This route intentionally reuses the same execution engine as the actual
 * order placement flow. The preview is stateful to the current market snapshot:
 * if the market changes before submit, the preview can become stale even though
 * the pricing logic remains identical.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { error, rateLimitInfo } = await publicRateLimit(request);
  if (error) return error;

  const body = await request.json();
  const parsed = PreviewBodySchema.safeParse(body);

  if (!parsed.success) {
    const res = successResponse(
      {
        error: 'Invalid preview payload',
        details: parsed.error.flatten(),
      },
      400
    );
    if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
    return res;
  }

  const service = createPerpMarketService();
  const preview = await service.previewOpenPosition(parsed.data);

  const res = successResponse({ preview });
  if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
  return res;
});
