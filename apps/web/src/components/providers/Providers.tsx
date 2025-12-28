import { CHAIN, getJejuNetwork, isRunningInJeju } from '@babylon/shared'
import { JejuAuthProvider } from '@jejunetwork/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, useEffect, useState } from 'react'
import { PostHogErrorBoundary } from '@/components/analytics/PostHogErrorBoundary'
import { PostHogIdentifier } from '@/components/analytics/PostHogIdentifier'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import {
  getEnvironment,
  getMpcEndpoints,
  getRedirectUri,
  getRpcUrl,
  OAUTH_CONFIG,
} from '@/config'
import { FontSizeProvider } from '@/contexts/FontSizeContext'
import { WidgetRefreshProvider } from '@/contexts/WidgetRefreshContext'
import { ApiFetchProvider } from './ApiFetchProvider'
import { FarcasterMiniAppProvider } from './FarcasterMiniAppProvider'
import { GamePlaybackManager } from './GamePlaybackManager'
import { OnboardingProvider } from './OnboardingProvider'
import { PostHogProvider } from './PostHogProvider'
import { ReferralCaptureProvider } from './ReferralCaptureProvider'

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
  const [mounted, setMounted] = useState(false)

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  // OAuth3 configuration for Jeju decentralized auth
  const oauth3Network = getJejuNetwork() ?? getEnvironment()
  const rpcUrl = isRunningInJeju()
    ? getRpcUrl()
    : getRpcUrl() || CHAIN.rpcUrls.default.http[0]

  // Development mode detection via NODE_ENV (set by bundler):
  // - bun run dev → NODE_ENV='development' → decentralized: false (fast HMR)
  // - bun run build → NODE_ENV='production' → decentralized: true (full JNS)
  const isDevMode = process.env.NODE_ENV === 'development'

  return (
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
                      appId: 'babylon.apps.jeju',
                      network: oauth3Network,
                      mpcEndpoints: getMpcEndpoints(),
                      redirectUri: getRedirectUri(),
                      rpcUrl,
                      chainId: CHAIN.id,
                      // Development mode: skip JNS for fast HMR
                      // Production mode: use full decentralized JNS discovery
                      decentralized: !isDevMode,
                      // For dev mode, provide direct TEE agent URL (if MPC endpoints exist)
                      teeAgentUrl: isDevMode ? getMpcEndpoints()[0] : undefined,
                      // OAuth providers - optional, wallet auth works without these
                      oauth: {
                        twitter: OAUTH_CONFIG.twitterClientId,
                        discord: OAUTH_CONFIG.discordClientId,
                      },
                      farcaster: {
                        neynarApiKey: OAUTH_CONFIG.neynarApiKey,
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
                            children
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
  )
}
