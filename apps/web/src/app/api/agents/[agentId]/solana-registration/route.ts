import { authenticateUser } from '@babylon/api/auth-middleware';
import { successResponse, withErrorHandling } from '@babylon/api/error-handler';
import {
  applyRateLimit,
  RATE_LIMIT_CONFIGS,
  rateLimitError,
} from '@babylon/api/rate-limiting';
import {
  getAgentSolanaRegistrationStatus,
  registerAgentOnSolanaForOwner,
} from '@babylon/api/services/agent-solana-registration-service';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const [user, { agentId }] = await Promise.all([
    authenticateUser(req),
    params,
  ]);

  const status = await getAgentSolanaRegistrationStatus({
    ownerUserId: user.id,
    agentUserId: agentId,
  });

  return successResponse(status);
});

export const POST = withErrorHandling(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const [user, { agentId }] = await Promise.all([
    authenticateUser(req),
    params,
  ]);
  const rl = applyRateLimit(user.id, RATE_LIMIT_CONFIGS.ONCHAIN_REGISTRATION);
  if (!rl.allowed) return rateLimitError(rl.retryAfter);

  const result = await registerAgentOnSolanaForOwner({
    ownerUserId: user.id,
    agentUserId: agentId,
  });

  return successResponse(result);
});
