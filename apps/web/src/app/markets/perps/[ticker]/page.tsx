import PerpsDetailClient from '../[[...ticker]]/PerpsDetailClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [{ ticker: '_' }];
}

export default function PerpsDetailPage() {
  return <PerpsDetailClient />;
}
