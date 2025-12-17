import ArticleDetailClient from '../[[...id]]/ArticleDetailClient';

// Static export config - generate placeholder path for build, actual routing is client-side
export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  // Return a placeholder - actual article IDs are resolved client-side
  return [{ id: '_' }];
}

export default function ArticleDetailPage() {
  return <ArticleDetailClient />;
}
