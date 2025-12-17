import TrendingTagClient from './TrendingTagClient';

export function generateStaticParams(): Array<{ tag?: string[] }> {
  return [{ tag: [] }];
}

export default function TrendingTagPage() {
  return <TrendingTagClient />;
}
