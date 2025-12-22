'use client';

import { JejuAuthProvider } from '@babylon/auth/client';
import { CHAIN, getJejuNetwork, isRunningInJeju } from '@babylon/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Fragment, Suspense, useEffect, useState } from 'react';
import { PostHogErrorBoundary } from '@/components/analytics/PostHogErrorBoundary';
import { PostHogIdentifier } from '@/components/analytics/PostHogIdentifier';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { FontSizeProvider } from '@/contexts/FontSizeContext';
import { WidgetRefreshProvider } from '@/contexts/WidgetRefreshContext';
import { ApiFetchProvider } from './ApiFetchProvider';
import { FarcasterMiniAppProvider } from './FarcasterMiniAppProvider';
import { GamePlaybackManager } from './GamePlaybackManager';
import { OnboardingProvider } from './OnboardingProvider';
import { PostHogProvider } from './PostHogProvider';
import { ReferralCaptureProvider } from './ReferralCaptureProvider';

/**
 * Get the OAuth3 network configuration
 */
function getOAuth3Network(): 'mainnet' | 'testnet' | 'localnet' {
  const jejuNetwork = getJejuNetwork();
  if (jejuNetwork) return jejuNetwork;

  // Infer from chain ID
  if (CHAIN.id === 1337 || CHAIN.id === 31337) return 'localnet';
  if (CHAIN.testnet) return 'testnet';
  return 'mainnet';
}

/**
 * Get the redirect URI for OAuth callbacks
 */
function getRedirectUri(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.BABYLON_OAUTH3_REDIRECT_URI ??
      'http://localhost:5007/auth/callback'
    );
  }
  return `${window.location.origin}/auth/callback`;
}

/**
 * Root providers component wrapping the application with all necessary providers.
 *
 * Provides all application-level context providers including:
 * - Jeju OAuth3 authentication
 * - React Query
 * - Theme
 * - Font size
 * - Widget refresh
 * - Farcaster Mini App
 * - Onboarding
 * - PostHog analytics
 * - Referral capture
 *
 * Handles client-side mounting and provider initialization.
 *
 * @param props - Providers component props
 * @returns Providers wrapper element
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // OAuth3 configuration for Jeju decentralized auth
  const oauth3Network = getOAuth3Network();
  const rpcUrl = isRunningInJeju()
    ? (process.env.NEXT_PUBLIC_JEJU_RPC_URL ?? 'http://localhost:9545')
    : (process.env.NEXT_PUBLIC_RPC_URL ?? CHAIN.rpcUrls.default.http[0]);

  return (
    <div suppressHydrationWarning>
      <ApiFetchProvider>
        <PostHogErrorBoundary>
          <Suspense fallback={null}>
            <PostHogProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange={false}
              >
                <FontSizeProvider>
                  <QueryClientProvider client={queryClient}>
                    <GamePlaybackManager />
                    <JejuAuthProvider
                      config={{
                        network: oauth3Network,
                        mpcEndpoints: process.env.NEXT_PUBLIC_MPC_ENDPOINTS
                          ? process.env.NEXT_PUBLIC_MPC_ENDPOINTS.split(',')
                          : ['http://localhost:4010'],
                        redirectUri: getRedirectUri(),
                        rpcUrl,
                        chainId: CHAIN.id,
                        // OAuth providers - optional, wallet auth works without these
                        oauth: {
                          twitter: process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID,
                          discord: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID,
                        },
                        farcaster: {
                          neynarApiKey: process.env.NEXT_PUBLIC_NEYNAR_API_KEY,
                        },
                      }}
                    >
                      <FarcasterMiniAppProvider>
                        {/* PostHog user identification */}
                        <PostHogIdentifier />
                        {/* Capture referral code from URL if present */}
                        <Suspense fallback={null}>
                          <ReferralCaptureProvider />
                        </Suspense>
                        {/* Onboarding provider for username setup */}
                        <OnboardingProvider>
                          <WidgetRefreshProvider>
                            {mounted ? (
                              <Fragment>{children}</Fragment>
                            ) : (
                              <div className="min-h-screen bg-sidebar" />
                            )}
                          </WidgetRefreshProvider>
                        </OnboardingProvider>
                      </FarcasterMiniAppProvider>
                    </JejuAuthProvider>
                  </QueryClientProvider>
                </FontSizeProvider>
              </ThemeProvider>
            </PostHogProvider>
          </Suspense>
        </PostHogErrorBoundary>
      </ApiFetchProvider>
    </div>
  );
}
