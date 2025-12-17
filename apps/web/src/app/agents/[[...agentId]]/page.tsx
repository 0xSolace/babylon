import AgentDetailClient from './AgentDetailClient';

export function generateStaticParams(): Array<{ agentId?: string[] }> {
  return [{ agentId: [] }];
}

export default function AgentDetailPage() {
  return <AgentDetailClient />;
}
