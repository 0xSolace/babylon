import ProfileDetailClient from './ProfileDetailClient';

export function generateStaticParams(): Array<{ id?: string[] }> {
  return [{ id: [] }];
}

export default function ProfileDetailPage() {
  return <ProfileDetailClient />;
}
