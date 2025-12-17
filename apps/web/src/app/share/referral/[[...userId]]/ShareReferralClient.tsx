/**
 * Client-side shareable referral page
 * Fetches referral code and redirects to home with ref param
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';

export default function ShareReferralClient() {
  const params = useParams();
  const router = useRouter();
  // Catch-all route: params.userId is string[] or undefined
  const userIdParam = params.userId;
  const rawUserId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
  const userId = rawUserId ? decodeURIComponent(rawUserId) : '';

  useEffect(() => {
    if (!userId) {
      router.replace('/');
      return;
    }
    const fetchAndRedirect = async () => {
      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        (typeof window !== 'undefined'
          ? `${window.location.origin}/api`
          : '/api');

      const response = await fetch(
        `${apiBaseUrl}/users/${encodeURIComponent(userId)}/referral-code`
      ).catch(() => null);

      if (response?.ok) {
        const data = await response.json();
        if (data.referralCode) {
          router.replace(`/?ref=${data.referralCode}`);
          return;
        }
      }

      router.replace('/');
    };

    fetchAndRedirect();
  }, [userId, router]);

  return (
    <PageContainer>
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-center">
          <Skeleton className="mx-auto mb-4 h-16 w-16 rounded-full" />
          <h1 className="mb-2 font-bold text-xl">Redirecting...</h1>
          <p className="text-muted-foreground">
            Taking you to your referral link
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
