export const dynamic = 'force-dynamic';

/**
 * NPC Risk Status API Endpoint
 *
 * Returns risk assessment for all NPCs or a specific NPC.
 * Shows stop-loss status, portfolio metrics, and alerts.
 *
 * GET /api/npcs/risk
 * GET /api/npcs/risk?actorId=<id>
 */

import { authenticate } from '@babylon/api';
import { getNPCRiskManagementService } from '@babylon/engine';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface RiskStatusResponse {
  success: boolean;
  npcs?: Array<{
    actorId: string;
    tier: string;
    currentBalance: number;
    dailyPnLPercent: number;
    drawdownPercent: number;
    riskScore: number;
    isAtRisk: boolean;
    shouldStopTrading: boolean;
    alertCount: number;
  }>;
  npc?: {
    actorId: string;
    tier: string;
    currentBalance: number;
    startingBalance: number;
    dailyPnL: number;
    dailyPnLPercent: number;
    peakBalance: number;
    drawdown: number;
    drawdownPercent: number;
    positionCount: number;
    riskScore: number;
    isAtRisk: boolean;
    shouldStopTrading: boolean;
    alerts: Array<{
      type: string;
      severity: string;
      message: string;
      value: number;
      threshold: number;
    }>;
  };
  summary?: {
    totalNpcs: number;
    atRiskCount: number;
    criticalCount: number;
    averageRiskScore: number;
  };
  message?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await authenticate(request);
  } catch {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const actorId = searchParams.get('actorId');

  const riskService = getNPCRiskManagementService();

  if (actorId) {
    // Get specific NPC risk status
    const status = await riskService.checkNPCRisk(actorId);

    return NextResponse.json({
      success: true,
      npc: {
        actorId: status.actorId,
        tier: status.tier,
        currentBalance: status.currentBalance,
        startingBalance: status.startingBalance,
        dailyPnL: status.dailyPnL,
        dailyPnLPercent: status.dailyPnLPercent,
        peakBalance: status.peakBalance,
        drawdown: status.drawdown,
        drawdownPercent: status.drawdownPercent,
        positionCount: status.positionCount,
        riskScore: status.riskScore,
        isAtRisk: status.isAtRisk,
        shouldStopTrading: status.shouldStopTrading,
        alerts: status.alerts.map((a) => ({
          type: a.type,
          severity: a.severity,
          message: a.message,
          value: a.value,
          threshold: a.threshold,
        })),
      },
    } satisfies RiskStatusResponse);
  }

  // Get all NPCs risk status
  const statuses = await riskService.getAllNPCRiskStatus();

  const atRiskCount = statuses.filter((s) => s.isAtRisk).length;
  const criticalCount = statuses.filter((s) => s.shouldStopTrading).length;
  const averageRiskScore =
    statuses.length > 0
      ? statuses.reduce((sum, s) => sum + s.riskScore, 0) / statuses.length
      : 0;

  return NextResponse.json({
    success: true,
    npcs: statuses.map((s) => ({
      actorId: s.actorId,
      tier: s.tier,
      currentBalance: s.currentBalance,
      dailyPnLPercent: s.dailyPnLPercent,
      drawdownPercent: s.drawdownPercent,
      riskScore: s.riskScore,
      isAtRisk: s.isAtRisk,
      shouldStopTrading: s.shouldStopTrading,
      alertCount: s.alerts.length,
    })),
    summary: {
      totalNpcs: statuses.length,
      atRiskCount,
      criticalCount,
      averageRiskScore: Math.round(averageRiskScore * 100) / 100,
    },
  } satisfies RiskStatusResponse);
}
