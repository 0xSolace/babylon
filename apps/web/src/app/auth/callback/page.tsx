'use client';

import { useJejuAuth } from '@babylon/auth/client';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

interface AuthCallbackPayload {
  code: string;
  state: string | null;
}

interface AuthCallbackError {
  error: string;
}

async function exchangeCodeForSession(
  payload: AuthCallbackPayload
): Promise<void> {
  const response = await fetch('/api/auth/jeju/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data: AuthCallbackError = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new Error(data.error || 'Authentication failed');
  }
}

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

  // Track OAuth errors from URL params (not mutation errors)
  const [oauthError, setOauthError] = useState<string | null>(null);

  const exchangeMutation = useMutation({
    mutationFn: exchangeCodeForSession,
    onSuccess: () => {
      router.replace('/');
    },
  });

  useEffect(() => {
    // If already authenticated, redirect to home
    if (ready && authenticated) {
      router.replace('/');
      return;
    }

    if (
      ready &&
      !authenticated &&
      !exchangeMutation.isPending &&
      !exchangeMutation.isSuccess &&
      !exchangeMutation.isError &&
      !oauthError
    ) {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle OAuth error from provider
      if (errorParam) {
        setOauthError(errorDescription ?? errorParam);
        return;
      }

      if (!code) {
        setOauthError('No authorization code received');
        return;
      }

      // Exchange code for session via mutation
      exchangeMutation.mutate({ code, state });
    }
  }, [
    ready,
    authenticated,
    searchParams,
    router,
    exchangeMutation,
    oauthError,
  ]);

  // Derive status from mutation state and oauth errors
  const hasError = oauthError || exchangeMutation.isError;
  const errorMessage =
    oauthError ??
    (exchangeMutation.error instanceof Error
      ? exchangeMutation.error.message
      : 'Authentication failed');
  const isSuccess = exchangeMutation.isSuccess;
  const isProcessing = !hasError && !isSuccess;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 p-8">
        {isProcessing && (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Completing sign in...</p>
          </>
        )}

        {isSuccess && (
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

        {hasError && (
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
            <p className="text-destructive text-sm">{errorMessage}</p>
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
