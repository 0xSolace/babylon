"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface EmbedContextValue {
  /** True when the app is loaded inside an iframe with ?embedded=true. */
  isEmbedded: boolean;
  /** The parent origin that sent auth credentials, if any. */
  parentOrigin: string | null;
  /** Agent session token received via postMessage from the embedding host. */
  agentSessionToken: string | null;
  /** Agent ID received via postMessage. */
  agentId: string | null;
}

const EmbedContext = createContext<EmbedContextValue>({
  isEmbedded: false,
  parentOrigin: null,
  agentSessionToken: null,
  agentId: null,
});

export function useEmbedMode(): EmbedContextValue {
  return useContext(EmbedContext);
}

/**
 * Detects embed mode from URL params and listens for BABYLON_AUTH
 * postMessage from the embedding host (Milady desktop/web).
 *
 * Flow:
 * 1. Detect ?embedded=true in URL → set isEmbedded
 * 2. Send { type: "BABYLON_READY" } to parent window
 * 3. Listen for { type: "BABYLON_AUTH", authToken, agentId } response
 * 4. Store credentials in context for use by API layer
 */
export function EmbedModeProvider({ children }: { children: ReactNode }) {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [parentOrigin, setParentOrigin] = useState<string | null>(null);
  const [agentSessionToken, setAgentSessionToken] = useState<string | null>(
    null,
  );
  const [agentId, setAgentId] = useState<string | null>(null);

  // Detect embed mode from URL params
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const embedded =
      params.get("embedded") === "true" || window.self !== window.top;

    if (!embedded) return;

    setIsEmbedded(true);

    // Notify parent that we're ready for auth
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "BABYLON_READY" }, "*");
      } catch {
        // Cross-origin restriction — parent will still post to us
      }
    }
  }, []);

  // Listen for BABYLON_AUTH from parent
  useEffect(() => {
    if (!isEmbedded) return;

    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "BABYLON_AUTH") return;

      const token =
        typeof data.authToken === "string" ? data.authToken.trim() : null;
      const id =
        typeof data.agentId === "string" ? data.agentId.trim() : null;

      if (token) {
        setAgentSessionToken(token);
        // Make token available globally for API calls
        (window as unknown as Record<string, unknown>).__babylonEmbedToken =
          token;
      }
      if (id) {
        setAgentId(id);
        (window as unknown as Record<string, unknown>).__babylonEmbedAgentId =
          id;
      }
      setParentOrigin(event.origin);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isEmbedded]);

  return (
    <EmbedContext.Provider
      value={{ isEmbedded, parentOrigin, agentSessionToken, agentId }}
    >
      {children}
    </EmbedContext.Provider>
  );
}
