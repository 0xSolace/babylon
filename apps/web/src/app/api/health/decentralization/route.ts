export const dynamic = 'force-dynamic';

import {
  checkDecentralizationHealth,
  type DecentralizationHealthStatus,
} from '@babylon/api';
import { NextResponse } from 'next/server';

/**
 * Decentralization Health Check API
 *
 * Probes health of decentralized infrastructure:
 * - TEE enclave (simulated vs real hardware)
 * - IPFS/Arweave storage connectivity
 * - KMS availability
 *
 * @openapi
 * /api/health/decentralization:
 *   get:
 *     tags:
 *       - System
 *     summary: Decentralization health check
 *     description: Returns health status for decentralized infrastructure components
 *     responses:
 *       200:
 *         description: Health status (may include warnings)
 *       503:
 *         description: Critical components unavailable
 */
export async function GET(): Promise<
  NextResponse<DecentralizationHealthStatus>
> {
  const status = await checkDecentralizationHealth();

  return NextResponse.json(status, {
    status: status.healthy ? 200 : 503,
  });
}
