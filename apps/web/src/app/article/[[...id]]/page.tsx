import ArticleDetailClient from './ArticleDetailClient';

// For optional catch-all routes, return array with empty array to generate index
export function generateStaticParams(): Array<{ id?: string[] }> {
  return [{ id: [] }];
}

export default function ArticleDetailPage() {
  return <ArticleDetailClient />;
}
