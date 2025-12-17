import SharePnLClient from '../[[...userId]]/SharePnLClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [{ userId: '_' }];
}

export default function SharePnLPage() {
  return <SharePnLClient />;
}
