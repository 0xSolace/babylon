import AgentDetailClient from '../[[...agentId]]/AgentDetailClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [{ agentId: '_' }];
}

export default function AgentDetailPage() {
  return <AgentDetailClient />;
}
