'use client';

import nextDynamic from 'next/dynamic';

const BettingPageClient = nextDynamic(() => import('./BettingPageClient'), {
  ssr: false,
});

export default function BettingPage() {
  return <BettingPageClient />;
}
