export const dynamic = 'force-dynamic';

/**
 * External Agent Registration Endpoint
 *
 * POST /api/agents/external/register
 *
 * Allows external agents (ElizaOS, MCP, Agent0, custom) to register
 * with the Babylon game. Generates API keys and stores connection params.
 *
 * @see src/lib/services/agent-registry.service.ts
 */

import type { ExternalAgentConnectionParams } from '@babylon/agents';
import { agentRegistry } from '@babylon/agents';
import { authenticate, generateApiKey, hashApiKey } from '@babylon/api';
import { ExternalAgentSchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Authenticate the request (requires valid OAuth3 session)
  const authUser = await authenticate(req);

  // Parse and validate request body
  const body = await req.json();
  const validated = ExternalAgentSchema.parse(body);

  // Generate API key for this external agent
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  // Prepare connection params with API key authentication
  const connectionParams: ExternalAgentConnectionParams = {
    externalId: validated.externalId,
    name: validated.name,
    description: validated.description,
    endpoint: validated.endpoint,
    protocol: validated.protocol,
    capabilities: validated.capabilities,
    authentication: {
      type: 'apiKey',
      credentials: JSON.stringify({
        apiKeyHash,
        ...validated.authentication?.credentials,
      }),
    },
    agentCard: validated.agentCard,
  };

  // Register the external agent
  const registration =
    await agentRegistry.registerExternalAgent(connectionParams);

  // Return registration details with API key (only shown once!)
  return NextResponse.json(
    {
      success: true,
      registration: {
        agentId: registration.agentId,
        name: registration.name,
        status: registration.status,
        trustLevel: registration.trustLevel,
        capabilities: registration.capabilities,
      },
      apiKey, // Only returned on registration, never again!
      message:
        'External agent registered successfully. Save your API key - it will not be shown again.',
      registeredBy: authUser.userId,
    },
    { status: 201 }
  );
}
