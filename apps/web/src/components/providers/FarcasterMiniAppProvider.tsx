import { logger } from '@babylon/shared'
import { sdk } from '@farcaster/miniapp-sdk'
import { useJejuAuth } from '@jejunetwork/auth/react'
import { createContext, useContext, useEffect, useRef, useState } from 'react'

/**
 * Farcaster Mini App Provider.
 *
 * Handles:
 * 1. Mini App detection
 * 2. SDK initialization (calling ready())
 * 3. Auto-authentication with Jeju/OAuth3
 * 4. Share functionality
 *
 * Works seamlessly in both Mini App and standalone modes.
 */

/**
 * Mini App context structure from Farcaster SDK.
 */
interface MiniAppContext {
  user?: {
    fid: number
    username: string
  }
}

/**
 * Farcaster Mini App context type for provider.
 */
interface FarcasterMiniAppContextType {
  isMiniApp: boolean
  isLoading: boolean
  error?: string
  fid?: number
  username?: string
  context: MiniAppContext | null
  share: (options: {
    text?: string
    url?: string
    embeds?: string[]
  }) => Promise<void>
}

const FarcasterMiniAppContext =
  createContext<FarcasterMiniAppContextType | null>(null)

/**
 * Hook to access Farcaster Mini App context.
 *
 * Must be used within FarcasterMiniAppProvider. Returns Mini App
 * state including detection, user info, and share functionality.
 *
 * @returns Farcaster Mini App context
 * @throws Error if used outside FarcasterMiniAppProvider
 */
export function _useFarcasterMiniApp() {
  const context = useContext(FarcasterMiniAppContext)
  if (!context) {
    throw new Error(
      'useFarcasterMiniApp must be used within FarcasterMiniAppProvider',
    )
  }
  return context
}

/**
 * Farcaster Mini App provider component for Mini App integration.
 *
 * Detects Farcaster Mini App context, initializes SDK, handles auto-authentication
 * with Jeju OAuth3, and provides share functionality. Works in both
 * Mini App and standalone browser modes.
 *
 * Features:
 * - Mini App detection
 * - SDK initialization (ready())
 * - Auto-authentication via SIWF
 * - Share functionality
 * - Context provider
 *
 * @param props - FarcasterMiniAppProvider component props
 * @returns Farcaster Mini App provider element
 */
export function FarcasterMiniAppProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMiniApp, setIsMiniApp] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [fid, setFid] = useState<number>()
  const [username, setUsername] = useState<string>()
  const [miniAppContext, setMiniAppContext] = useState<MiniAppContext | null>(
    null,
  )
  const hasCalledReady = useRef(false)
  const hasAttemptedLogin = useRef(false)

  const { ready, authenticated, loginWithFarcaster } = useJejuAuth()

  // Detect Mini App context and call sdk.actions.ready()
  useEffect(() => {
    if (typeof window === 'undefined') return

    const initializeMiniApp = async () => {
      const context = await sdk.context

      if (context) {
        setIsMiniApp(true)
        setMiniAppContext(context as MiniAppContext)

        if (context.user) {
          setFid(context.user.fid)
          setUsername(context.user.username)
        }

        logger.info(
          'Detected Farcaster Mini App context',
          {
            fid: context.user ? context.user.fid : undefined,
            username: context.user ? context.user.username : undefined,
          },
          'FarcasterMiniApp',
        )

        // Call ready() to hide splash screen and show content
        // Only call once
        if (!hasCalledReady.current) {
          hasCalledReady.current = true

          // Small delay to ensure DOM is ready
          setTimeout(async () => {
            await sdk.actions.ready()
            logger.info(
              'Farcaster Mini App ready() called successfully',
              {},
              'FarcasterMiniApp',
            )
          }, 100)
        }
      } else {
        logger.debug(
          'Not in Farcaster Mini App context',
          {},
          'FarcasterMiniApp',
        )
      }
      setIsLoading(false)
    }

    initializeMiniApp()
  }, [])

  // Auto-login with Farcaster Mini App when detected
  useEffect(() => {
    if (!ready || !isMiniApp || authenticated || isLoading) {
      return
    }

    // Prevent multiple login attempts - only attempt once
    if (hasAttemptedLogin.current) {
      return
    }
    hasAttemptedLogin.current = true

    const attemptMiniAppLogin = async () => {
      logger.info(
        'Attempting Farcaster Mini App auto-login via SIWF',
        { fid, username },
        'FarcasterMiniApp',
      )

      // Use Jeju's loginWithFarcaster which handles SIWF
      await loginWithFarcaster()

      logger.info(
        'Farcaster Mini App auto-login successful',
        {
          fid,
          username,
        },
        'FarcasterMiniApp',
      )
    }

    attemptMiniAppLogin().catch((loginError: Error) => {
      // Allow retry on error
      hasAttemptedLogin.current = false
      logger.error(
        'Farcaster Mini App auto-login failed',
        {
          error: loginError.message,
          fid,
          username,
        },
        'FarcasterMiniApp',
      )
      setError(loginError.message)
    })
  }, [
    ready,
    authenticated,
    isMiniApp,
    isLoading,
    fid,
    username,
    loginWithFarcaster,
  ])

  // Share functionality using Mini App SDK
  const share = async (options: {
    text?: string
    url?: string
    embeds?: string[]
  }) => {
    if (!isMiniApp) {
      logger.warn(
        'Attempted to use Mini App share outside of Mini App context',
        {},
        'FarcasterMiniApp',
      )
      return
    }

    // Farcaster compose URL - uses official protocol endpoint (farcaster.xyz)
    await sdk.actions.openUrl(
      `https://farcaster.xyz/~/compose?text=${encodeURIComponent(options.text || '')}${
        options.url ? `&embeds[]=${encodeURIComponent(options.url)}` : ''
      }`,
    )
    logger.info('Mini App share opened', options, 'FarcasterMiniApp')
  }

  const value: FarcasterMiniAppContextType = {
    isMiniApp,
    isLoading,
    error,
    fid,
    username,
    context: miniAppContext,
    share,
  }

  return (
    <FarcasterMiniAppContext.Provider value={value}>
      {children}
    </FarcasterMiniAppContext.Provider>
  )
}
