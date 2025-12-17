import ShareReferralClient from '../[[...userId]]/ShareReferralClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [{ userId: '_' }];
}

export default function ShareReferralPage() {
  return <ShareReferralClient />;
}
