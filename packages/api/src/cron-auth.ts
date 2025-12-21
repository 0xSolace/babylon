/**
 * Cron Job Authentication Utility
 *
 * Authentication for cron/compute triggers.
 * Primary: Jeju compute proofs (decentralized)
 * Fallback: CRON_SECRET (for local dev only)
 *
 * Security Model:
 * - Production: Requires valid Jeju compute proof
 * - Development: Accepts compute proof, dev credentials, or no auth
 *
 * @example
 * ```typescript
 * import { verifyCronAuth } from '@babylon/api';
 *
 * export async function POST(request: NextRequest) {
 *   if (!await verifyCronAuth(request)) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // ... handler logic
 * }
 * ```
 */

import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { type Address, verifyMessage } from 'viem';
import { isValidCronSecret } from './dev-credentials';
import { AuthorizationError } from './errors';

const isDevelopment = process.env.NODE_ENV !== 'production';

export interface CronAuthOptions {
  /** Name of the cron job for logging */
  jobName?: string;
  /** Allow unauthenticated requests in development */
  allowDevUnauthenticated?: boolean;
}

interface ComputeProof {
  /** Compute node address */
  nodeAddress: Address;
  /** Signed message proving computation rights */
  signature: `0x${string}`;
  /** Timestamp of the proof */
  timestamp: number;
  /** Job identifier */
  jobId: string;
}

/**
 * Verify Jeju compute proof
 *
 * Compute nodes sign a message proving they are authorized to execute a job.
 * The message format is: "jeju:compute:{jobId}:{timestamp}"
 */
async function verifyComputeProof(proof: ComputeProof): Promise<boolean> {
  const message = `jeju:compute:${proof.jobId}:${proof.timestamp}`;

  // Check timestamp freshness (within 5 minutes)
  const now = Date.now();
  const proofAge = now - proof.timestamp;
  if (proofAge < 0 || proofAge > 5 * 60 * 1000) {
    logger.warn(
      'Compute proof timestamp out of range',
      { timestamp: proof.timestamp, age: proofAge },
      'ComputeAuth'
    );
    return false;
  }

  // Verify signature
  const valid = await verifyMessage({
    address: proof.nodeAddress,
    message,
    signature: proof.signature,
  });

  if (!valid) {
    logger.warn(
      'Invalid compute proof signature',
      { nodeAddress: proof.nodeAddress },
      'ComputeAuth'
    );
    return false;
  }

  // In production, verify node is registered in compute marketplace
  if (!isDevelopment) {
    const isRegistered = await verifyComputeNodeRegistration(proof.nodeAddress);
    if (!isRegistered) {
      logger.warn(
        'Compute node not registered',
        { nodeAddress: proof.nodeAddress },
        'ComputeAuth'
      );
      return false;
    }
  }

  return true;
}

/**
 * Verify compute node is registered in the Jeju marketplace
 */
async function verifyComputeNodeRegistration(
  nodeAddress: Address
): Promise<boolean> {
  const registryUrl =
    process.env.JEJU_COMPUTE_REGISTRY_URL ?? 'http://localhost:4300';

  const response = await fetch(`${registryUrl}/v1/nodes/${nodeAddress}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!response?.ok) return false;

  const data = (await response.json().catch(() => ({}))) as {
    registered?: boolean;
    active?: boolean;
  };
  return data.registered === true && data.active !== false;
}

/**
 * Extract compute proof from request headers
 */
function extractComputeProof(request: NextRequest): ComputeProof | null {
  const nodeAddress = request.headers.get('x-jeju-node-address');
  const signature = request.headers.get('x-jeju-compute-signature');
  const timestamp = request.headers.get('x-jeju-compute-timestamp');
  const jobId = request.headers.get('x-jeju-job-id');

  if (!nodeAddress || !signature || !timestamp || !jobId) {
    return null;
  }

  return {
    nodeAddress: nodeAddress as Address,
    signature: signature as `0x${string}`,
    timestamp: parseInt(timestamp, 10),
    jobId,
  };
}

/**
 * Verify cron request authorization
 *
 * @security In production, requires valid Jeju compute proof.
 * In development, accepts compute proof, dev credentials, or allows unauthenticated.
 *
 * @param request - Next.js request object
 * @param options - Optional configuration
 * @returns true if authorized, false otherwise
 */
export async function verifyCronAuth(
  request: NextRequest,
  options: CronAuthOptions = {}
): Promise<boolean> {
  const { jobName = 'Cron', allowDevUnauthenticated = true } = options;

  // Check for Jeju compute proof first (preferred - decentralized)
  const computeProof = extractComputeProof(request);
  if (computeProof) {
    const valid = await verifyComputeProof(computeProof);
    if (valid) {
      logger.info(
        'Cron authorized via Jeju compute proof',
        { nodeAddress: computeProof.nodeAddress, jobId: computeProof.jobId },
        jobName
      );
      return true;
    }
    // Invalid compute proof - deny even in dev
    return false;
  }

  // Check for trigger source header (from compute trigger service)
  const triggerSource = request.headers.get('x-trigger-source');
  if (triggerSource === 'compute-marketplace') {
    // Internal trigger from compute service
    logger.info(
      'Cron authorized via internal compute trigger',
      undefined,
      jobName
    );
    return true;
  }

  // Development mode fallbacks
  if (isDevelopment) {
    const authHeader = request.headers.get('authorization');

    // No auth at all - allow in dev for convenience
    if (!authHeader && allowDevUnauthenticated) {
      logger.info(
        'Development mode - allowing cron without auth',
        undefined,
        jobName
      );
      return true;
    }

    // Accept 'Bearer development' keyword in dev
    if (authHeader === 'Bearer development') {
      logger.info(
        'Cron authorized via development keyword',
        undefined,
        jobName
      );
      return true;
    }

    // Check dev credentials
    if (authHeader) {
      const bearerToken = authHeader.replace('Bearer ', '');
      if (bearerToken && isValidCronSecret(bearerToken)) {
        logger.info('Cron authorized via dev credentials', undefined, jobName);
        return true;
      }
    }

    // Invalid auth provided in dev - deny
    if (authHeader) {
      logger.warn(
        'Cron auth failed - invalid credentials',
        { hasAuthHeader: true },
        jobName
      );
      return false;
    }
  }

  // PRODUCTION: Require compute proof
  logger.error(
    'Cron auth failed - no valid compute proof',
    { environment: process.env.NODE_ENV },
    jobName
  );
  return false;
}

/**
 * Require cron authorization (throws on failure)
 *
 * @throws AuthorizationError if not authorized
 */
export async function requireCronAuth(
  request: NextRequest,
  options: CronAuthOptions = {}
): Promise<void> {
  if (!(await verifyCronAuth(request, options))) {
    throw new AuthorizationError(
      'Invalid cron authorization - Jeju compute proof required',
      'cron',
      options.jobName || 'execute'
    );
  }
}

/**
 * Create unauthorized cron response
 */
export function cronUnauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Unauthorized cron request',
      message: 'Valid Jeju compute proof required',
    }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * @deprecated Use verifyCronAuth instead - this is a sync wrapper for backwards compatibility
 */
export function verifyCronAuthSync(
  request: NextRequest,
  options: CronAuthOptions = {}
): boolean {
  // Only check sync methods in dev mode for backwards compatibility
  if (!isDevelopment) {
    return false;
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader && options.allowDevUnauthenticated !== false) {
    return true;
  }

  if (authHeader === 'Bearer development') {
    return true;
  }

  if (authHeader) {
    const bearerToken = authHeader.replace('Bearer ', '');
    if (bearerToken && isValidCronSecret(bearerToken)) {
      return true;
    }
  }

  return false;
}
