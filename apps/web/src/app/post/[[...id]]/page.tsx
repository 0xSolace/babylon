import PostDetailClient from './PostDetailClient';

export function generateStaticParams(): Array<{ id?: string[] }> {
  return [{ id: [] }];
}

export default function PostDetailPage() {
  return <PostDetailClient />;
}
