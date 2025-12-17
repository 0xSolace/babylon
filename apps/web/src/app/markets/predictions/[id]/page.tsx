import PredictionDetailClient from '../[[...id]]/PredictionDetailClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function PredictionDetailPage() {
  return <PredictionDetailClient />;
}
