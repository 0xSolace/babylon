import PredictionDetailClient from './PredictionDetailClient';

export function generateStaticParams(): Array<{ id?: string[] }> {
  return [{ id: [] }];
}

export default function PredictionDetailPage() {
  return <PredictionDetailClient />;
}
