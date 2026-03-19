import { headers } from 'next/headers';
import { ComingSoon } from '@/components/shared/ComingSoon';
import { isWaitlistHostname } from '@/lib/host-routing';
import { HomePageClient } from './HomePageClient';

export default async function HomePage() {
  const hostHeader = (await headers()).get('host') ?? '';
  const hostname = hostHeader.split(':')[0]?.toLowerCase() ?? '';
  const isWaitlistHost = isWaitlistHostname(hostname);

  if (isWaitlistHost) {
    return <ComingSoon />;
  }

  return <HomePageClient />;
}
