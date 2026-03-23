'use client';

import { logger } from '@babylon/shared';
import { useLoginWithTelegram, usePrivy } from '@privy-io/react-auth';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

/**
 * Consolidated Telegram Mini App Provider.
 *
 * Handles:
 * 1. Mini App detection (isTMA)
 * 2. SDK initialization (init, miniApp.mount, viewport.expand)
 * 3. Auto-authentication with Privy
 * 4. Back button management
 * 5. Theme syncing
 * 6. Share / close functionality
 *
 * Works seamlessly in both Telegram Mini App and standalone modes.
 * The SDK is loaded dynamically to avoid import-time side-effects on
 * non-Telegram environments.
 */

interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

interface TelegramMiniAppContextType {
  isMiniApp: boolean;
  isLoading: boolean;
  error?: string;
  user: TelegramUser | null;
  /** Share a URL via Telegram's native share sheet. */
  share: (url: string, text?: string) => void;
  /** Close the Telegram Mini App. */
  close: () => void;
  /**
   * Link the current user's Privy account to their Telegram identity.
   * Uses the captured initData from the MiniApp environment for seamless
   * linking (no modal). Only available when running inside Telegram.
   * Returns false if linking is not possible (not in MiniApp, no initData,
   * or Telegram already linked).
   */
  linkAccount: () => boolean;
}

const TelegramMiniAppContext = createContext<TelegramMiniAppContextType | null>(
  null
);

/**
 * Hook to access Telegram Mini App context.
 *
 * Must be used within TelegramMiniAppProvider. Returns Mini App
 * state including detection, user info, and platform actions.
 *
 * @returns Telegram Mini App context
 * @throws Error if used outside TelegramMiniAppProvider
 */
export function useTelegramMiniApp() {
  const context = useContext(TelegramMiniAppContext);
  if (!context)
    throw new Error(
      'useTelegramMiniApp must be used within TelegramMiniAppProvider'
    );
  return context;
}

/**
 * Telegram Mini App provider component.
 *
 * Detects Telegram Mini App environment, initializes SDK, expands the viewport,
 * handles back-button behaviour, syncs theme, and triggers Privy authentication.
 * Works transparently as a pass-through when running outside Telegram.
 */
export function TelegramMiniAppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);

  const hasInitialized = useRef(false);
  const hasAttemptedLogin = useRef(false);

  // Keep a ref to the dynamically loaded SDK module so actions can use it.
  const sdkRef = useRef<typeof import('@telegram-apps/sdk-react') | null>(null);
  // Store raw initData for seamless Telegram account linking via Privy's
  // linkTelegram. Privy treats initData as expired after 5 minutes, so we
  // capture it during initialization and use it promptly.
  const initDataRawRef = useRef<string | null>(null);

  const {
    ready,
    authenticated,
    user: privyAuthUser,
    linkTelegram,
  } = usePrivy();

  const { login: loginWithTelegram } = useLoginWithTelegram({
    onComplete: ({ user, isNewUser }) => {
      logger.info(
        'Telegram seamless auth completed',
        { userId: user.id, isNewUser },
        'TelegramMiniApp'
      );
    },
    onError: (error) => {
      logger.error(
        'Telegram seamless auth failed',
        { error: String(error) },
        'TelegramMiniApp'
      );
      setError('Telegram authentication failed. Please refresh to try again.');
    },
  });

  // ── Detect & Initialize ──────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initialize = async () => {
      try {
        // Dynamic import — only load the SDK when we actually need it.
        const sdk = await import('@telegram-apps/sdk-react');
        sdkRef.current = sdk;

        // Use isTMA('complete') for reliable environment detection (recommended
        // by docs). The 'complete' mode calls a Telegram-specific method and
        // waits for confirmation, which is more reliable than the sync check.
        const isTelegramEnv = await sdk.isTMA('complete');

        if (!isTelegramEnv) {
          logger.debug(
            'Not in Telegram Mini App context',
            {},
            'TelegramMiniApp'
          );
          setIsLoading(false);
          return;
        }

        // We're inside Telegram — initialise the SDK.
        sdk.init();

        // Use mountSync() for MiniApp and ThemeParams per v3 migration guide.
        // v3 made mounting asynchronous; mountSync() safely handles concurrent
        // mounting and avoids race conditions between components.
        if (sdk.miniApp.mountSync.isAvailable()) sdk.miniApp.mountSync();
        if (sdk.miniApp.isMounted()) {
          if (sdk.miniApp.bindCssVars.isAvailable()) sdk.miniApp.bindCssVars();
        }

        // Mount & expand the viewport.
        if (sdk.viewport.mount.isAvailable()) {
          // viewport.mount remains async in v3.
          await sdk.viewport.mount();
        }
        if (sdk.viewport.expand.isAvailable()) sdk.viewport.expand();

        // Mount theme params synchronously and bind CSS vars.
        if (sdk.themeParams.mountSync.isAvailable())
          sdk.themeParams.mountSync();
        if (sdk.themeParams.bindCssVars.isAvailable())
          sdk.themeParams.bindCssVars();

        // Extract and validate user from launch data.
        //
        // The raw initData string is sent to our server for HMAC-SHA-256
        // validation against the bot token. This prevents spoofing attacks
        // where a malicious client forges initData with arbitrary user IDs.
        //
        // If validation is not configured (no TELEGRAM_BOT_TOKEN on server),
        // we fall back to trusting the client-side data — this allows
        // development and environments where the bot token isn't available.
        let extractedUsername: string | undefined;

        const lp = sdk.retrieveLaunchParams();

        // The raw initData query string is available as tgWebAppData in
        // serialised form, or we can reconstruct it from the launch params.
        // SDK v3 exposes `initDataRaw` on the launch params for this purpose.
        const rawInitData = (lp as Record<string, unknown>).tgWebAppDataRaw as
          | string
          | undefined;

        // Capture raw initData for Privy's linkTelegram (seamless account linking).
        initDataRawRef.current = rawInitData ?? null;

        let userValidated = false;

        if (rawInitData) {
          // Validate initData server-side via HMAC-SHA-256
          const validateRes = await fetch('/api/auth/telegram/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: rawInitData }),
          });

          if (validateRes.ok) {
            const validated = (await validateRes.json()) as {
              valid: boolean;
              user: {
                id: number;
                first_name: string;
                last_name?: string;
                username?: string;
                photo_url?: string;
              };
            };

            if (validated.valid && validated.user) {
              extractedUsername = validated.user.username;
              setTelegramUser({
                id: validated.user.id,
                firstName: validated.user.first_name,
                lastName: validated.user.last_name,
                username: validated.user.username,
                photoUrl: validated.user.photo_url,
              });
              userValidated = true;
            }
          } else if (validateRes.status === 501) {
            // Server returned 501 — TELEGRAM_BOT_TOKEN not configured.
            // Fall through to client-side extraction below.
            logger.warn(
              'Telegram initData validation not configured on server, using unverified client data',
              {},
              'TelegramMiniApp'
            );
          } else {
            // Validation explicitly failed (403 or other) — the initData
            // is tampered with or expired. Do not trust user data.
            logger.error(
              'Telegram initData validation failed — user data not trusted',
              { status: validateRes.status },
              'TelegramMiniApp'
            );
          }
        }

        // Fallback: extract user from client-side launch data if server
        // validation was not available (no bot token configured).
        if (!userValidated) {
          const initData = (lp as Record<string, unknown>)?.tgWebAppData as
            | { user?: Record<string, unknown> }
            | undefined;
          if (initData?.user) {
            const u = initData.user;
            extractedUsername =
              u.username != null ? String(u.username) : undefined;
            setTelegramUser({
              id: Number(u.id),
              firstName: String(u.firstName ?? u.first_name ?? ''),
              lastName:
                u.lastName != null || u.last_name != null
                  ? String(u.lastName ?? u.last_name)
                  : undefined,
              username: extractedUsername,
              photoUrl:
                u.photoUrl != null || u.photo_url != null
                  ? String(u.photoUrl ?? u.photo_url)
                  : undefined,
            });
          }
        }

        setIsMiniApp(true);

        logger.info(
          'Telegram Mini App initialized',
          { user: extractedUsername, validated: userValidated },
          'TelegramMiniApp'
        );

        // Signal to Telegram that the app is ready to be shown.
        if (sdk.miniApp.ready.isAvailable()) sdk.miniApp.ready();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
          'Telegram Mini App initialization failed',
          { error: message },
          'TelegramMiniApp'
        );
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Seamless auto-login via Privy ──────────────────────────────────────────

  useEffect(() => {
    if (!isMiniApp || !ready || authenticated || isLoading) return;
    if (hasAttemptedLogin.current) return;
    hasAttemptedLogin.current = true;

    logger.info(
      'Attempting Telegram Mini App seamless auth via Privy',
      { telegramUserId: telegramUser?.id },
      'TelegramMiniApp'
    );

    // Use Privy's headless Telegram login — authenticates using the Telegram
    // initData already present in the WebView environment. No modal is shown.
    //
    // NOTE: We intentionally do NOT reset hasAttemptedLogin on failure.
    // A failed attempt is still an attempt — resetting would cause an infinite
    // retry loop on subsequent re-renders if login consistently fails (e.g.
    // network error, Privy misconfiguration). Users can manually retry by
    // refreshing the Mini App.
    //
    // Error handling: onError (hook config) sets the user-facing error state.
    // This .catch() only prevents unhandled promise rejections.
    loginWithTelegram().catch(() => {
      // Handled by onError callback above.
    });
  }, [
    isMiniApp,
    ready,
    authenticated,
    isLoading,
    loginWithTelegram,
    telegramUser?.id,
  ]);

  // ── Back button ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isMiniApp || !sdkRef.current) return;
    const sdk = sdkRef.current;

    // Mount the back button component if available.
    if (sdk.backButton.mount.isAvailable()) sdk.backButton.mount();

    // Listen for back button clicks and trigger browser back navigation.
    const handler = () => {
      if (typeof window !== 'undefined') window.history.back();
    };

    if (sdk.backButton.onClick.isAvailable()) sdk.backButton.onClick(handler);

    // Show the back button when navigating away from the root.
    const updateVisibility = () => {
      if (typeof window === 'undefined') return;
      const isRoot =
        window.location.pathname === '/' || window.location.pathname === '';
      if (isRoot) {
        if (sdk.backButton.hide.isAvailable()) sdk.backButton.hide();
      } else {
        if (sdk.backButton.show.isAvailable()) sdk.backButton.show();
      }
    };

    updateVisibility();
    window.addEventListener('popstate', updateVisibility);

    return () => {
      window.removeEventListener('popstate', updateVisibility);
      if (sdk.backButton.offClick.isAvailable())
        sdk.backButton.offClick(handler);
      if (sdk.backButton.hide.isAvailable()) sdk.backButton.hide();
    };
  }, [isMiniApp]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const share = (url: string, text?: string) => {
    if (!isMiniApp || !sdkRef.current) return;
    const sdk = sdkRef.current;

    // Use Telegram's share URL scheme.
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
    if (sdk.openTelegramLink.isAvailable()) {
      sdk.openTelegramLink(shareUrl);
    } else if (typeof window !== 'undefined') {
      window.open(shareUrl, '_blank');
    }

    logger.info(
      'Telegram Mini App share opened',
      { url, text },
      'TelegramMiniApp'
    );
  };

  const close = () => {
    if (!isMiniApp || !sdkRef.current) return;
    const sdk = sdkRef.current;
    if (sdk.miniApp.close.isAvailable()) sdk.miniApp.close();
  };

  const linkAccount = (): boolean => {
    if (!isMiniApp || !initDataRawRef.current) return false;
    if (privyAuthUser?.telegram) return false;

    logger.info(
      'User-initiated Telegram account linking',
      { telegramUserId: telegramUser?.id },
      'TelegramMiniApp'
    );

    linkTelegram({ launchParams: { initDataRaw: initDataRawRef.current } });
    return true;
  };

  // ── Context ──────────────────────────────────────────────────────────────

  const value: TelegramMiniAppContextType = {
    isMiniApp,
    isLoading,
    error,
    user: telegramUser,
    share,
    close,
    linkAccount,
  };

  return (
    <TelegramMiniAppContext.Provider value={value}>
      {children}
    </TelegramMiniAppContext.Provider>
  );
}
