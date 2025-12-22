export const dynamic = 'force-dynamic';

/**
 * DAO Buybacks API
 *
 * GET /api/dao/buybacks
 * Returns buyback execution history.
 */

import { DAOService } from '@babylon/api';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);

  const buybacks = await DAOService.getBuybackHistory(limit);

  return NextResponse.json({
    success: true,
    buybacks,
    total: buybacks.length,
  });
}
