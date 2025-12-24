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
 * // With standard Request
 * if (!await verifyCronAuth(request)) {
 *   return Response.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 *
 * // With Elysia context
 * if (!await verifyCronAuthFromContext(ctx)) {
 *   ctx.set.status = 401;
 *   return { error: 'Unauthorized' };
 * }
 * ```
 */

import { AuthorizationError, logger } from '@babylon/shared'
import { type Address, verifyMessage } from 'viem'
import type { ElysiaContext, RequestHeaders } from './auth-middleware'
import { isValidCronSecret } from './dev-credentials'
import { type ComputeProofData, parseComputeProof } from './utils/type-guards'

const isDevelopment = process.env.NODE_ENV !== 'production'

export interface CronAuthOptions {
  /** Name of the cron job for logging */
  jobName?: string
  /** Allow unauthenticated requests in development */
  allowDevUnauthenticated?: boolean
}

/**
 * @deprecated Use ComputeProofData from utils/type-guards
 */
type ComputeProof = ComputeProofData

/**
 * Verify Jeju compute proof
 *
 * Compute nodes sign a message proving they are authorized to execute a job.
 * The message format is: "jeju:compute:{jobId}:{timestamp}"
 */
async function verifyComputeProof(proof: ComputeProof): Promise<boolean> {
  const message = `jeju:compute:${proof.jobId}:${proof.timestamp}`

  // Check timestamp freshness (within 5 minutes)
  const now = Date.now()
  const proofAge = now - proof.timestamp
  if (proofAge < 0 || proofAge > 5 * 60 * 1000) {
    logger.warn(
      'Compute proof timestamp out of range',
      { timestamp: proof.timestamp, age: proofAge },
      'ComputeAuth',
    )
    return false
  }

  // Verify signature
  const valid = await verifyMessage({
    address: proof.nodeAddress,
    message,
    signature: proof.signature,
  })

  if (!valid) {
    logger.warn(
      'Invalid compute proof signature',
      { nodeAddress: proof.nodeAddress },
      'ComputeAuth',
    )
    return false
  }

  // In production, verify node is registered in compute marketplace
  if (!isDevelopment) {
    const isRegistered = await verifyComputeNodeRegistration(proof.nodeAddress)
    if (!isRegistered) {
      logger.warn(
        'Compute node not registered',
        { nodeAddress: proof.nodeAddress },
        'ComputeAuth',
      )
      return false
    }
  }

  return true
}

/**
 * Verify compute node is registered in the Jeju marketplace
 */
async function verifyComputeNodeRegistration(
  nodeAddress: Address,
): Promise<boolean> {
  const registryUrl =
    process.env.JEJU_COMPUTE_REGISTRY_URL ?? 'http://localhost:4030'

  const response = await fetch(`${registryUrl}/v1/nodes/${nodeAddress}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  }).catch(() => null)

  if (!response?.ok) return false

  const data = (await response.json().catch(() => ({}))) as {
    registered?: boolean
    active?: boolean
  }
  return data.registered === true && data.active !== false
}

/**
 * Extract compute proof from request headers (framework-agnostic)
 */
function extractComputeProofFromHeaders(
  headers: RequestHeaders,
): ComputeProof | null {
  return parseComputeProof(
    headers.get('x-jeju-node-address'),
    headers.get('x-jeju-compute-signature'),
    headers.get('x-jeju-compute-timestamp'),
    headers.get('x-jeju-job-id'),
  )
}

/**
 * Extract compute proof from Elysia context
 */
function extractComputeProofFromContext(
  ctx: ElysiaContext,
): ComputeProof | null {
  return parseComputeProof(
    ctx.headers['x-jeju-node-address'],
    ctx.headers['x-jeju-compute-signature'],
    ctx.headers['x-jeju-compute-timestamp'],
    ctx.headers['x-jeju-job-id'],
  )
}

/**
 * Core cron auth verification logic
 */
async function verifyCronAuthCore(
  getHeader: (name: string) => string | null | undefined,
  extractProof: () => ComputeProof | null,
  options: CronAuthOptions = {},
): Promise<boolean> {
  const { jobName = 'Cron', allowDevUnauthenticated = true } = options

  // Check for Jeju compute proof first (preferred - decentralized)
  const computeProof = extractProof()
  if (computeProof) {
    const valid = await verifyComputeProof(computeProof)
    if (valid) {
      logger.info(
        'Cron authorized via Jeju compute proof',
        { nodeAddress: computeProof.nodeAddress, jobId: computeProof.jobId },
        jobName,
      )
      return true
    }
    // Invalid compute proof - deny even in dev
    return false
  }

  // Check for trigger source header (from compute trigger service)
  const triggerSource = getHeader('x-trigger-source')
  if (triggerSource === 'compute-marketplace') {
    // Internal trigger from compute service
    logger.info(
      'Cron authorized via internal compute trigger',
      undefined,
      jobName,
    )
    return true
  }

  // Development mode fallbacks
  if (isDevelopment) {
    const authHeader = getHeader('authorization')

    // No auth at all - allow in dev for convenience
    if (!authHeader && allowDevUnauthenticated) {
      logger.info(
        'Development mode - allowing cron without auth',
        undefined,
        jobName,
      )
      return true
    }

    // Accept 'Bearer development' keyword in dev
    if (authHeader === 'Bearer development') {
      logger.info('Cron authorized via development keyword', undefined, jobName)
      return true
    }

    // Check dev credentials
    if (authHeader) {
      const bearerToken = authHeader.replace('Bearer ', '')
      if (bearerToken && isValidCronSecret(bearerToken)) {
        logger.info('Cron authorized via dev credentials', undefined, jobName)
        return true
      }
    }

    // Invalid auth provided in dev - deny
    if (authHeader) {
      logger.warn(
        'Cron auth failed - invalid credentials',
        { hasAuthHeader: true },
        jobName,
      )
      return false
    }
  }

  // PRODUCTION: Require compute proof
  logger.error(
    'Cron auth failed - no valid compute proof',
    { environment: process.env.NODE_ENV },
    jobName,
  )
  return false
}

/**
 * Verify cron request authorization
 *
 * @security In production, requires valid Jeju compute proof.
 * In development, accepts compute proof, dev credentials, or allows unauthenticated.
 *
 * @param request - Standard Request object
 * @param options - Optional configuration
 * @returns true if authorized, false otherwise
 */
export async function verifyCronAuth(
  request: Request,
  options: CronAuthOptions = {},
): Promise<boolean> {
  return verifyCronAuthCore(
    (name) => request.headers.get(name),
    () => extractComputeProofFromHeaders(request.headers),
    options,
  )
}

/**
 * Verify cron request authorization from Elysia context
 */
export async function verifyCronAuthFromContext(
  ctx: ElysiaContext,
  options: CronAuthOptions = {},
): Promise<boolean> {
  return verifyCronAuthCore(
    (name) => ctx.headers[name],
    () => extractComputeProofFromContext(ctx),
    options,
  )
}

/**
 * Require cron authorization (throws on failure)
 *
 * @throws AuthorizationError if not authorized
 */
export async function requireCronAuth(
  request: Request,
  options: CronAuthOptions = {},
): Promise<void> {
  if (!(await verifyCronAuth(request, options))) {
    throw new AuthorizationError(
      'Invalid cron authorization - Jeju compute proof required',
      'cron',
      options.jobName || 'execute',
    )
  }
}

/**
 * Require cron authorization from Elysia context (throws on failure)
 */
export async function requireCronAuthFromContext(
  ctx: ElysiaContext,
  options: CronAuthOptions = {},
): Promise<void> {
  if (!(await verifyCronAuthFromContext(ctx, options))) {
    throw new AuthorizationError(
      'Invalid cron authorization - Jeju compute proof required',
      'cron',
      options.jobName || 'execute',
    )
  }
}

/**
 * Create unauthorized cron response
 */
export function cronUnauthorizedResponse(): Response {
  return Response.json(
    {
      error: 'Unauthorized cron request',
      message: 'Valid Jeju compute proof required',
    },
    { status: 401 },
  )
}

/**
 * Sync wrapper for backwards compatibility (dev only)
 */
export function verifyCronAuthSync(
  request: Request,
  options: CronAuthOptions = {},
): boolean {
  // Only check sync methods in dev mode for backwards compatibility
  if (!isDevelopment) {
    return false
  }

  const authHeader = request.headers.get('authorization')

  if (!authHeader && options.allowDevUnauthenticated !== false) {
    return true
  }

  if (authHeader === 'Bearer development') {
    return true
  }

  if (authHeader) {
    const bearerToken = authHeader.replace('Bearer ', '')
    if (bearerToken && isValidCronSecret(bearerToken)) {
      return true
    }
  }

  return false
}
