import ProfileDetailClient from '../[[...id]]/ProfileDetailClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function ProfileDetailPage() {
  return <ProfileDetailClient />;
}
