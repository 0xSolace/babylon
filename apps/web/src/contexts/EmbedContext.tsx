'use client';

/**
 * Embed Context — postMessage auth handshake for Milady iframe integration.
 *
 * Flow:
 * 1. Babylon (iframe) sends BABYLON_READY to parent
 * 2. Milady (parent) responds with BABYLON_AUTH { agentId, agentSecret }
 * 3. Babylon exchanges credentials for a session token via POST /api/agents/auth
 * 4. Token is stored on window.__babylonEmbedToken for apiFetch to use
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

interface EmbedState {
  /** Whether we're running inside a Milady iframe */
  isEmbedded: boolean;
  /** Whether embed auth has completed successfully */
  isAuthenticated: boolean;
  /** The authenticated agent ID, if any */
  agentId: string | null;
  /** Error from auth attempt */
  error: string | null;
}

const EmbedContext = createContext<EmbedState>({
  isEmbedded: false,
  isAuthenticated: false,
  agentId: null,
  error: null,
});

export function useEmbed(): EmbedState {
  return useContext(EmbedContext);
}

async function authenticateWithCredentials(
  agentId: string,
  agentSecret: string
): Promise<string> {
  const res = await fetch('/api/agents/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, agentSecret }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Babylon auth failed (${res.status}): ${text || res.statusText}`
    );
  }

  const data = await res.json();
  const token = data.sessionToken ?? data.token;
  if (!token) {
    throw new Error('Auth response did not include a session token');
  }
  return token;
}

export function EmbedProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EmbedState>({
    isEmbedded: false,
    isAuthenticated: false,
    agentId: null,
    error: null,
  });
  const handledRef = useRef(false);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    if (handledRef.current) return;

    const data = event.data;
    if (!data || typeof data !== 'object' || data.type !== 'BABYLON_AUTH') {
      return;
    }

    const { agentId, agentSecret } = data;
    if (
      typeof agentId !== 'string' ||
      typeof agentSecret !== 'string' ||
      !agentId ||
      !agentSecret
    ) {
      console.warn('[EmbedContext] Received BABYLON_AUTH with invalid payload');
      return;
    }

    handledRef.current = true;

    try {
      const token = await authenticateWithCredentials(agentId, agentSecret);

      // Store token globally for apiFetch to pick up
      (
        window as Window & { __babylonEmbedToken?: string }
      ).__babylonEmbedToken = token;

      setState({
        isEmbedded: true,
        isAuthenticated: true,
        agentId,
        error: null,
      });

      // Acknowledge to parent
      window.parent.postMessage({ type: 'BABYLON_AUTH_OK', agentId }, '*');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[EmbedContext] Auth failed:', message);
      setState({
        isEmbedded: true,
        isAuthenticated: false,
        agentId: null,
        error: message,
      });
      window.parent.postMessage(
        { type: 'BABYLON_AUTH_ERROR', error: message },
        '*'
      );
      handledRef.current = false; // Allow retry
    }
  }, []);

  useEffect(() => {
    // Only activate in iframe context
    if (typeof window === 'undefined' || window === window.parent) {
      return;
    }

    setState((s) => ({ ...s, isEmbedded: true }));

    window.addEventListener('message', handleMessage);

    // Signal readiness to Milady parent
    window.parent.postMessage({ type: 'BABYLON_READY' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  return (
    <EmbedContext.Provider value={state}>{children}</EmbedContext.Provider>
  );
}
