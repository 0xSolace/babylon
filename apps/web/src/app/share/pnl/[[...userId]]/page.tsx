import SharePnLClient from './SharePnLClient';

export function generateStaticParams(): Array<{ userId?: string[] }> {
  return [{ userId: [] }];
}

export default function SharePnLPage() {
  return <SharePnLClient />;
}
