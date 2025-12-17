'use client';

import { useJejuAuth } from '@babylon/auth/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

/**
 * OAuth Callback Page Content
 *
 * Handles OAuth redirects from providers (Twitter, Discord, Farcaster).
 * Exchanges authorization codes for sessions and redirects to the app.
 */
function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, ready } = useJejuAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>(
    'processing'
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If already authenticated, redirect to home
    if (ready && authenticated) {
      router.replace('/');
      return;
    }

    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle OAuth error from provider
      if (errorParam) {
        setStatus('error');
        setError(errorDescription ?? errorParam);
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        return;
      }

      // Exchange code for session via API route
      const response = await fetch('/api/auth/jeju/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      });

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }));
        setStatus('error');
        setError((data as { error?: string }).error ?? 'Authentication failed');
        return;
      }

      // Success - redirect to home
      setStatus('success');
      router.replace('/');
    };

    if (ready && !authenticated) {
      void handleCallback();
    }
  }, [ready, authenticated, searchParams, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 p-8">
        {status === 'processing' && (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Completing sign in...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-foreground">Signed in successfully!</p>
            <p className="text-muted-foreground text-sm">Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-foreground">Sign in failed</p>
            <p className="text-destructive text-sm">{error}</p>
            <button
              type="button"
              onClick={() => router.replace('/')}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              Return to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * OAuth Callback Page
 */
export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
