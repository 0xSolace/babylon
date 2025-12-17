import TrendingTagClient from '../[[...tag]]/TrendingTagClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [{ tag: '_' }];
}

export default function TrendingTagPage() {
  return <TrendingTagClient />;
}
