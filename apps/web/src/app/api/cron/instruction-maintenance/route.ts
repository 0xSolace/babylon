/**
 * Instruction Maintenance Cron Job API
 *
 * @route GET /api/cron/instruction-maintenance - Expire stale agent instructions
 * @access Cron (CRON_SECRET required)
 *
 * @description
 * Runs hourly to expire agent instructions that have passed their validUntil date.
 * This ensures that time-bound instructions are properly cleaned up.
 * Max execution time: 60s.
 *
 * @openapi
 * /api/cron/instruction-maintenance:
 *   get:
 *     tags:
 *       - Cron
 *     summary: Expire stale agent instructions
 *     description: Marks expired instructions as 'expired' based on validUntil timestamp
 *     security:
 *       - CronSecret: []
 *     responses:
 *       200:
 *         description: Maintenance completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 expiredCount:
 *                   type: number
 *                 duration:
 *                   type: number
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Invalid or missing CRON_SECRET
 *       500:
 *         description: Maintenance failed
 */

import { instructionService } from '@babylon/agents';
import { verifyCronAuth } from '@babylon/api';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Vercel function configuration
export const maxDuration = 60; // 1 minute max
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron authorization using centralized auth
  if (!verifyCronAuth(request, { jobName: 'InstructionMaintenance' })) {
    logger.warn(
      'Unauthorized instruction maintenance attempt',
      undefined,
      'InstructionMaintenance'
    );
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Expire stale instructions
  const expiredCount = await instructionService.expireStaleInstructions();

  const duration = Date.now() - startTime;

  logger.info(
    'Instruction maintenance completed',
    {
      expiredCount,
      duration,
      timestamp: new Date().toISOString(),
    },
    'InstructionMaintenance'
  );

  return NextResponse.json({
    success: true,
    expiredCount,
    duration,
    timestamp: new Date().toISOString(),
  });
}
