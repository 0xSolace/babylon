import {
  authenticateUser,
  getAgentSolanaRegistrationStatus,
  registerAgentOnSolanaForOwner,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const user = await authenticateUser(req);
  const { agentId } = await params;

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
  const user = await authenticateUser(req);
  const { agentId } = await params;

  const result = await registerAgentOnSolanaForOwner({
    ownerUserId: user.id,
    agentUserId: agentId,
  });

  return successResponse(result);
});
