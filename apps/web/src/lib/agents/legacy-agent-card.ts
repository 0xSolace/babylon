import type { AgentCard } from '@babylon/agents';
import { agentRegistry } from '@babylon/agents';
import { logger } from '@babylon/shared';
import { NextResponse } from 'next/server';

export async function getLegacyAgentCardResponse(agentId: string) {
  const agent = await agentRegistry.getAgentById(agentId);

  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found', agentId },
      { status: 404 }
    );
  }

  if (agent.discoveryMetadata) {
    return NextResponse.json(agent.discoveryMetadata, { status: 200 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const agentCard: AgentCard = {
    version: '1.0',
    agentId: agent.agentId,
    name: agent.name,
    description: agent.systemPrompt,
    endpoints: {
      a2a:
        agent.capabilities.a2aEndpoint ||
        `${baseUrl}/api/agents/${agentId}/a2a`,
      mcp:
        agent.capabilities.mcpEndpoint ||
        `${baseUrl}/api/agents/${agentId}/mcp`,
      rpc: `${baseUrl}/api/agents/${agentId}/card`,
    },
    capabilities: agent.capabilities,
    authentication: {
      required: false,
      methods: [],
    },
    limits: {
      rateLimit: 0,
      costPerAction: 0,
    },
  };

  logger.info(
    `Agent card retrieved for ${agentId}`,
    {
      agentType: agent.type,
      skillsCount: agent.capabilities.skills?.length || 0,
      domainsCount: agent.capabilities.domains?.length || 0,
    },
    'AgentCard'
  );

  return NextResponse.json(agentCard, { status: 200 });
}
