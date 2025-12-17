import PerpsDetailClient from './PerpsDetailClient';

export function generateStaticParams(): Array<{ ticker?: string[] }> {
  return [{ ticker: [] }];
}

export default function PerpsDetailPage() {
  return <PerpsDetailClient />;
}
