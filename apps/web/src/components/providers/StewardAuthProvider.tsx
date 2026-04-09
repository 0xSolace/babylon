'use client';

import type { StewardSession } from '@stwd/sdk';
import { StewardAuth } from '@stwd/sdk';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// ── Singleton StewardAuth instance ───────────────────────────────────────────

let _stewardAuthInstance: StewardAuth | null = null;

function getOrCreateStewardAuth(): StewardAuth {
  if (_stewardAuthInstance) return _stewardAuthInstance;
  const baseUrl =
    process.env.NEXT_PUBLIC_STEWARD_API_URL ??
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? 'https://auth.elizacloud.ai'
      : 'http://localhost:3200');
  _stewardAuthInstance = new StewardAuth({
    baseUrl,
    // Persist session across page reloads
    storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
    onSessionChange: (session) => {
      // Keep the window-level access token in sync for apiFetch
      if (typeof window !== 'undefined') {
        (
          window as Window & { __privyAccessToken?: string | null }
        ).__privyAccessToken = session?.token ?? null;
      }
    },
  });
  return _stewardAuthInstance;
}

// ── Context ───────────────────────────────────────────────────────────────────

interface StewardAuthContextValue {
  stewardAuth: StewardAuth;
  session: StewardSession | null;
  isLoading: boolean;
  /** Call after a successful login to sync the httpOnly cookie and fetch the user profile. */
  onLoginSuccess: (token: string, refreshToken?: string) => Promise<void>;
}

const StewardAuthContext = createContext<StewardAuthContextValue | null>(null);

export function useStewardAuthContext(): StewardAuthContextValue {
  const ctx = useContext(StewardAuthContext);
  if (!ctx) {
    throw new Error(
      'useStewardAuthContext must be used inside StewardAuthProvider'
    );
  }
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function StewardAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const stewardAuth = useRef(getOrCreateStewardAuth()).current;
  const [session, setSession] = useState<StewardSession | null>(() =>
    stewardAuth.getSession()
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Subscribe to session changes from the SDK
    const unsubscribe = stewardAuth.onSessionChange((s) => {
      setSession(s);
    });
    return unsubscribe;
  }, [stewardAuth]);

  const onLoginSuccess = useCallback(
    async (token: string, refreshToken?: string) => {
      setIsLoading(true);
      try {
        // Sync the token to the server via httpOnly cookie
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token, refreshToken }),
        });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return (
    <StewardAuthContext.Provider
      value={{ stewardAuth, session, isLoading, onLoginSuccess }}
    >
      {children}
    </StewardAuthContext.Provider>
  );
}
