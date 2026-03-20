'use client';

import { useSearchParams } from 'next/navigation';

interface PlayLandingButtonProps {
  className?: string;
  children?: React.ReactNode;
}

function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  if (typeof window === 'undefined') return 'https://play.babylon.market';

  const hostname = window.location.hostname.toLowerCase();
  if (hostname.endsWith('staging.babylon.market')) {
    return 'https://play.staging.babylon.market';
  }
  if (hostname.endsWith('babylon.market')) {
    return 'https://play.babylon.market';
  }

  return window.location.origin;
}

function getReferralQueryString(referralCode: string | null): string {
  if (!referralCode) return '';
  return `?ref=${encodeURIComponent(referralCode)}`;
}

export function PlayLandingButton({
  className,
  children,
}: PlayLandingButtonProps) {
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref');

  const handleClick = () => {
    window.location.assign(
      `${getAppBaseUrl()}${getReferralQueryString(referralCode)}`
    );
  };

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
