import PostDetailClient from '../[[...id]]/PostDetailClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function PostDetailPage() {
  return <PostDetailClient />;
}
