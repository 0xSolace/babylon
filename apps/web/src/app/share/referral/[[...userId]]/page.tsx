import ShareReferralClient from './ShareReferralClient';

export function generateStaticParams(): Array<{ userId?: string[] }> {
  return [{ userId: [] }];
}

export default function ShareReferralPage() {
  return <ShareReferralClient />;
}
