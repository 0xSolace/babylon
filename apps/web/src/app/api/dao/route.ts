export const dynamic = 'force-dynamic';

/**
 * DAO Overview API
 *
 * GET /api/dao
 * Returns complete DAO overview including AI CEO status, treasury, and revenue stats.
 */

import { DAOService } from '@babylon/api';
import { logger } from '@babylon/shared';
import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  const overview = await DAOService.getOverview();
  const formatted = DAOService.formatStats(overview);

  logger.info('DAO overview fetched', formatted, 'GET /api/dao');

  return NextResponse.json({
    success: true,
    overview: formatted,
    raw: {
      treasury: {
        ethBalance: overview.treasury.ethBalance.toString(),
        bblnBalance: overview.treasury.bblnBalance.toString(),
        totalETHDistributed: overview.treasury.totalETHDistributed.toString(),
        totalBBLNDistributed: overview.treasury.totalBBLNDistributed.toString(),
      },
      revenue: {
        accumulatedFees: overview.revenue.accumulatedFees.toString(),
        buybackThreshold: overview.revenue.buybackThreshold.toString(),
        totalFeesReceived: overview.revenue.totalFeesReceived.toString(),
        totalBBLNBought: overview.revenue.totalBBLNBought.toString(),
        totalELIZABought: overview.revenue.totalELIZABought.toString(),
        totalTreasuryETH: overview.revenue.totalTreasuryETH.toString(),
        totalBuybacks: overview.revenue.totalBuybacks,
        canExecuteBuyback: overview.revenue.canExecuteBuyback,
        isPaused: overview.revenue.isPaused,
      },
      aiCEO: overview.aiCEO,
      proposals: overview.proposals,
    },
  });
}
