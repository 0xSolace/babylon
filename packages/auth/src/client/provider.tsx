/**
 * JejuAuthProvider
 *
 * React context provider for decentralized authentication.
 */

'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Address, Hex } from 'viem';
import { DIDManager } from '../did/manager';
import { ThresholdSigner } from '../mpc/threshold-signer';
import { DiscordOAuth } from '../oauth/discord';
import { FarcasterAuth } from '../oauth/farcaster';
import { generatePKCE } from '../oauth/pkce';
import { SIWE } from '../oauth/siwe';
import { TwitterOAuth } from '../oauth/twitter';
import { KeyBackupManager } from '../recovery/backup';
import { SessionDataSchema } from '../schemas/index';
import {
  createSessionMessage,
  SessionManager,
} from '../server/session-manager';
import type {
  AuthMethod,
  DID,
  KeyBackup,
  LinkedAccount,
  SessionToken,
} from '../types/index';
import type {
  JejuAuthConfig,
  JejuAuthContextValue,
  SessionData,
} from './types';

// Create singleton managers - no secrets needed
const backupManager = new KeyBackupManager();
const sessionManager = new SessionManager({ expiresIn: 86400 }); // 24 hours

const SESSION_KEY = 'jeju_auth_session';
const PENDING_EMAIL_KEY = 'jeju_pending_email';

interface AuthProviderState {
  ready: boolean;
  authenticated: boolean;
  userId: DID | null;
  walletAddress: Address | null;
  linkedAccounts: LinkedAccount[];
  loading: boolean;
  error: string | null;
}

const initialState: AuthProviderState = {
  ready: false,
  authenticated: false,
  userId: null,
  walletAddress: null,
  linkedAccounts: [],
  loading: true,
  error: null,
};

const JejuAuthContext = createContext<JejuAuthContextValue | null>(null);

export function useJejuAuthContext(): JejuAuthContextValue {
  const context = useContext(JejuAuthContext);
  if (!context) {
    throw new Error('useJejuAuthContext must be used within JejuAuthProvider');
  }
  return context;
}

interface JejuAuthProviderProps {
  children: ReactNode;
  config: JejuAuthConfig;
}

export function JejuAuthProvider({ children, config }: JejuAuthProviderProps) {
  const [state, setState] = useState<AuthProviderState>(initialState);
  const [signer, setSigner] = useState<ThresholdSigner | null>(null);

  // Initialize services
  const didManager = useMemo(
    () => new DIDManager({ network: config.network }),
    [config.network]
  );

  // OAuth providers
  const twitterOAuth = useMemo(
    () =>
      config.oauth?.twitter
        ? new TwitterOAuth({ clientId: config.oauth.twitter })
        : null,
    [config.oauth?.twitter]
  );
  const discordOAuth = useMemo(
    () =>
      config.oauth?.discord
        ? new DiscordOAuth({ clientId: config.oauth.discord })
        : null,
    [config.oauth?.discord]
  );
  // Farcaster auth is only used when needed
  const getFarcasterAuth = useCallback(
    () => new FarcasterAuth({ neynarApiKey: config.farcaster?.neynarApiKey }),
    [config.farcaster?.neynarApiKey]
  );

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (!stored) {
        setState((s: AuthProviderState) => ({
          ...s,
          ready: true,
          loading: false,
        }));
        return;
      }

      const session = SessionDataSchema.parse(JSON.parse(stored));

      // Check if expired
      if (Date.now() > session.expiresAt) {
        sessionStorage.removeItem(SESSION_KEY);
        setState((s: AuthProviderState) => ({
          ...s,
          ready: true,
          loading: false,
        }));
        return;
      }

      // Initialize signer
      const newSigner = new ThresholdSigner(session.userId, {
        endpoints: config.mpcEndpoints ?? ['http://localhost:4010'],
        networkId: `jeju-${config.network}`,
        threshold: config.network === 'localnet' ? 1 : 2,
        timeout: 30_000,
        devMode: config.network === 'localnet',
      });
      await newSigner.initialize();
      setSigner(newSigner);

      setState({
        ready: true,
        authenticated: true,
        userId: session.userId,
        walletAddress: session.walletAddress,
        linkedAccounts: session.linkedAccounts,
        loading: false,
        error: null,
      });
    };

    loadSession().catch((err) => {
      console.error('Failed to load session:', err);
      setState((s: AuthProviderState) => ({
        ...s,
        ready: true,
        loading: false,
      }));
    });
  }, [config.mpcEndpoints, config.network]);

  // Login handlers
  const loginWithEmail = useCallback(async (email: string) => {
    setState((s: AuthProviderState) => ({ ...s, loading: true, error: null }));

    // Store email for verification step
    sessionStorage.setItem(PENDING_EMAIL_KEY, email);

    // In production, would send verification email via MPC network
    // For dev, just proceed to verification
    setState((s: AuthProviderState) => ({ ...s, loading: false }));
  }, []);

  const verifyEmailCode = useCallback(
    async (code: string) => {
      setState((s: AuthProviderState) => ({
        ...s,
        loading: true,
        error: null,
      }));

      const email = sessionStorage.getItem(PENDING_EMAIL_KEY);
      if (!email) {
        setState((s: AuthProviderState) => ({
          ...s,
          loading: false,
          error: 'No pending email verification',
        }));
        return;
      }

      const codeHash = `0x${code}` as Hex; // Simplified

      const authMethod: AuthMethod = {
        type: 'email',
        email,
        codeHash,
      };

      const result = await didManager.createIdentity(authMethod);

      // Create signer
      const newSigner = new ThresholdSigner(result.did, {
        endpoints: config.mpcEndpoints ?? ['http://localhost:4010'],
        networkId: `jeju-${config.network}`,
        threshold: config.network === 'localnet' ? 1 : 2,
        timeout: 30_000,
        devMode: config.network === 'localnet',
      });
      await newSigner.initialize();
      setSigner(newSigner);

      // Create permissionless session token (wallet-signed)
      const { message, claims } = createSessionMessage(
        result.did,
        result.walletAddress
      );
      const signResult = await newSigner.signMessage(message);
      const token = sessionManager.createToken(claims, signResult.signature);

      // Store session
      const session: SessionData = {
        userId: result.did,
        token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        walletAddress: result.walletAddress,
        linkedAccounts: result.document.linkedAccounts,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      sessionStorage.removeItem(PENDING_EMAIL_KEY);

      setState({
        ready: true,
        authenticated: true,
        userId: result.did,
        walletAddress: result.walletAddress,
        linkedAccounts: result.document.linkedAccounts,
        loading: false,
        error: null,
      });
    },
    [config.mpcEndpoints, config.network, didManager]
  );

  const loginWithWallet = useCallback(async () => {
    setState((s: AuthProviderState) => ({ ...s, loading: true, error: null }));

    // Request wallet connection
    const ethereum = getEthereumProvider();
    if (!ethereum) {
      setState((s: AuthProviderState) => ({
        ...s,
        loading: false,
        error: 'No wallet detected',
      }));
      return;
    }

    const accounts = (await ethereum.request({
      method: 'eth_requestAccounts',
    })) as string[];
    const address = accounts[0] as Address;

    // Get domain for SIWE message
    const domain =
      typeof window !== 'undefined' ? window.location.host : 'babylon.game';

    // Create EIP-4361 SIWE message
    const siwe = new SIWE({
      domain,
      statement: 'Sign in to Babylon with your wallet.',
      chainId: config.chainId,
      expiresIn: 300, // 5 minutes
    });
    const siweMessage = siwe.createMessage(address);
    const message = siweMessage.message;

    // Request signature
    const signature = (await ethereum.request({
      method: 'personal_sign',
      params: [message, address],
    })) as Hex;

    const authMethod: AuthMethod = {
      type: 'wallet',
      address,
      signature,
      message,
      timestamp: Date.now(),
    };

    const result = await didManager.createIdentity(authMethod);

    // Create signer
    const newSigner = new ThresholdSigner(result.did, {
      endpoints: config.mpcEndpoints ?? ['http://localhost:4010'],
      networkId: `jeju-${config.network}`,
      threshold: config.network === 'localnet' ? 1 : 2,
      timeout: 30_000,
      devMode: config.network === 'localnet',
    });
    await newSigner.initialize();
    setSigner(newSigner);

    // Create permissionless session token (wallet-signed)
    const { message: sessionMessage, claims } = createSessionMessage(
      result.did,
      result.walletAddress
    );
    const signResult = await newSigner.signMessage(sessionMessage);
    const token = sessionManager.createToken(claims, signResult.signature);

    // Store session
    const session: SessionData = {
      userId: result.did,
      token,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      walletAddress: result.walletAddress,
      linkedAccounts: result.document.linkedAccounts,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    setState({
      ready: true,
      authenticated: true,
      userId: result.did,
      walletAddress: result.walletAddress,
      linkedAccounts: result.document.linkedAccounts,
      loading: false,
      error: null,
    });
  }, [config.mpcEndpoints, config.network, didManager, config.chainId]);

  const loginWithTwitter = useCallback(async () => {
    if (!twitterOAuth || !config.redirectUri) {
      setState((s: AuthProviderState) => ({
        ...s,
        error: 'Twitter OAuth not configured',
      }));
      return;
    }

    const pkce = await generatePKCE();
    const url = await twitterOAuth.getAuthorizationUrl(
      config.redirectUri,
      pkce.state
    );
    window.location.href = url;
  }, [twitterOAuth, config.redirectUri]);

  const loginWithDiscord = useCallback(async () => {
    if (!discordOAuth || !config.redirectUri) {
      setState((s: AuthProviderState) => ({
        ...s,
        error: 'Discord OAuth not configured',
      }));
      return;
    }

    const pkce = await generatePKCE();
    const url = await discordOAuth.getAuthorizationUrl(
      config.redirectUri,
      pkce.state
    );
    window.location.href = url;
  }, [discordOAuth, config.redirectUri]);

  const loginWithFarcaster = useCallback(async () => {
    setState((s: AuthProviderState) => ({ ...s, loading: true, error: null }));

    const farcasterAuth = getFarcasterAuth();

    // Generate sign-in request
    const domain =
      typeof window !== 'undefined' ? window.location.host : 'babylon.game';
    const signInRequest = farcasterAuth.generateSignInRequest(domain);

    // For now, store the request and prompt user to sign with Warpcast
    // In a full implementation, this would open Warpcast deeplink or show QR
    sessionStorage.setItem(
      'jeju_farcaster_request',
      JSON.stringify(signInRequest)
    );

    // The sign-in flow requires the user to sign externally and call verifyFarcasterSignIn
    setState((s: AuthProviderState) => ({
      ...s,
      loading: false,
      error:
        'Please sign the message in Warpcast and call verifyFarcasterSignIn',
    }));
  }, [getFarcasterAuth]);

  const logout = useCallback(async () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSigner(null);
    setState({
      ready: true,
      authenticated: false,
      userId: null,
      walletAddress: null,
      linkedAccounts: [],
      loading: false,
      error: null,
    });
  }, []);

  const login = useCallback(
    async (method: AuthMethod): Promise<SessionToken> => {
      // Route to appropriate login handler
      switch (method.type) {
        case 'email':
          await loginWithEmail(method.email);
          // Email requires verification step, return pending
          return {
            token: '',
            expiresAt: 0,
            userId: 'did:jeju:pending:0x' as DID,
          };
        case 'wallet':
          await loginWithWallet();
          break;
        case 'twitter':
          await loginWithTwitter();
          // OAuth redirect, won't return
          return {
            token: '',
            expiresAt: 0,
            userId: 'did:jeju:pending:0x' as DID,
          };
        case 'discord':
          await loginWithDiscord();
          // OAuth redirect, won't return
          return {
            token: '',
            expiresAt: 0,
            userId: 'did:jeju:pending:0x' as DID,
          };
        case 'farcaster':
          await loginWithFarcaster();
          break;
      }

      // For wallet/farcaster, get the actual session from storage
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const session = SessionDataSchema.parse(JSON.parse(stored));
        return {
          token: session.token,
          expiresAt: session.expiresAt,
          userId: session.userId,
        };
      }

      // Fallback if session not yet available
      return {
        token: '',
        expiresAt: 0,
        userId: 'did:jeju:pending:0x' as DID,
      };
    },
    [
      loginWithEmail,
      loginWithWallet,
      loginWithTwitter,
      loginWithDiscord,
      loginWithFarcaster,
    ]
  );

  const linkAccount = useCallback(
    async (method: AuthMethod) => {
      if (!state.userId || !signer) {
        throw new Error('Not authenticated');
      }

      const signature = await signer.signMessage('link-account');
      await didManager.linkAccount(state.userId, method, signature.signature);

      // Refresh linked accounts
      const doc = await didManager.resolve(state.userId);
      if (doc) {
        setState((s) => ({ ...s, linkedAccounts: doc.linkedAccounts }));
      }
    },
    [state.userId, signer, didManager]
  );

  const unlinkAccount = useCallback(
    async (type: LinkedAccount['type'], identifier: string) => {
      if (!state.userId || !signer) {
        throw new Error('Not authenticated');
      }

      const signature = await signer.signMessage('unlink-account');
      await didManager.unlinkAccount(
        state.userId,
        type,
        identifier,
        signature.signature
      );

      // Refresh linked accounts
      setState((s: AuthProviderState) => ({
        ...s,
        linkedAccounts: s.linkedAccounts.filter(
          (a: LinkedAccount) =>
            !(a.type === type && a.identifier === identifier)
        ),
      }));
    },
    [state.userId, signer, didManager]
  );

  const refreshToken = useCallback(async (): Promise<SessionToken> => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored || !signer) {
      throw new Error('No session to refresh');
    }

    const session = SessionDataSchema.parse(JSON.parse(stored));

    // Create new permissionless session token
    const { message, claims } = createSessionMessage(
      session.userId,
      session.walletAddress
    );
    const signResult = await signer.signMessage(message);
    const newToken = sessionManager.createToken(claims, signResult.signature);
    const newExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

    session.token = newToken;
    session.expiresAt = newExpiresAt;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    return {
      token: newToken,
      expiresAt: newExpiresAt,
      userId: session.userId,
    };
  }, [signer]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) {
      return null;
    }

    const parseResult = SessionDataSchema.safeParse(JSON.parse(stored));
    if (!parseResult.success) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    const session = parseResult.data;
    if (Date.now() > session.expiresAt) {
      return null;
    }

    return session.token;
  }, []);

  const signMessage = useCallback(
    async (message: string): Promise<Hex> => {
      if (!signer) {
        throw new Error('Not authenticated');
      }
      const result = await signer.signMessage(message);
      return result.signature;
    },
    [signer]
  );

  const signTypedData = useCallback(
    async (typedData: unknown): Promise<Hex> => {
      if (!signer) {
        throw new Error('Not authenticated');
      }
      // Would parse and sign typed data
      const result = await signer.signMessage(JSON.stringify(typedData));
      return result.signature;
    },
    [signer]
  );

  const exportBackup = useCallback(
    async (password: string): Promise<KeyBackup> => {
      if (!state.userId) {
        throw new Error('Not authenticated');
      }

      // Create encrypted backup using KeyBackupManager
      const backup = await backupManager.createBackup(state.userId, password);
      return backup;
    },
    [state.userId]
  );

  const recoverWithBackup = useCallback(
    async (backup: KeyBackup, password: string) => {
      // Verify the backup can be decrypted
      const isValid = await backupManager.verifyBackup(backup, password);
      if (!isValid) {
        throw new Error('Invalid backup or password');
      }

      // Initialize signer for the recovered user
      const newSigner = new ThresholdSigner(backup.userId, {
        endpoints: config.mpcEndpoints ?? ['http://localhost:4010'],
        networkId: `jeju-${config.network}`,
        threshold: config.network === 'localnet' ? 1 : 2,
        timeout: 30_000,
        devMode: config.network === 'localnet',
      });
      const walletAddress = await newSigner.initialize();
      setSigner(newSigner);

      // Create permissionless session token (wallet-signed)
      const { message, claims } = createSessionMessage(
        backup.userId,
        walletAddress
      );
      const signResult = await newSigner.signMessage(message);
      const token = sessionManager.createToken(claims, signResult.signature);

      // Store session
      const session: SessionData = {
        userId: backup.userId,
        token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        walletAddress,
        linkedAccounts: [],
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

      setState({
        ready: true,
        authenticated: true,
        userId: backup.userId,
        walletAddress,
        linkedAccounts: [],
        loading: false,
        error: null,
      });
    },
    [config.mpcEndpoints, config.network]
  );

  const getSession = useCallback((): SessionData | null => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const parseResult = SessionDataSchema.safeParse(JSON.parse(stored));
    if (!parseResult.success) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parseResult.data;
  }, []);

  const hasGas = useCallback(async (): Promise<boolean> => {
    if (!state.walletAddress || !config.rpcUrl) return false;

    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [state.walletAddress, 'latest'],
        id: 1,
      }),
    });

    const data = (await response.json()) as { result: string };
    return BigInt(data.result) > 0n;
  }, [state.walletAddress, config.rpcUrl]);

  const requestGas = useCallback(async (): Promise<boolean> => {
    if (!state.walletAddress || !config.paymasterConfig) {
      return false;
    }

    // Import paymaster dynamically to avoid circular deps
    const { TreasuryPaymaster } = await import(
      '../paymaster/treasury-paymaster.js'
    );

    // Transform config to match paymaster's expected type
    const paymasterConfig = {
      treasuryAddress: config.paymasterConfig.treasuryAddress,
      operatorPrivateKey: config.paymasterConfig.operatorPrivateKey,
      rpcUrl: config.paymasterConfig.rpcUrl,
      chainId: config.paymasterConfig.chainId,
      policy: config.paymasterConfig.policy ?? {},
    };

    const paymaster = new TreasuryPaymaster(paymasterConfig);

    // Request gas funding from treasury
    const txHash = await paymaster.fundUser(
      state.walletAddress,
      BigInt(config.paymasterConfig.defaultGasAmount ?? '1000000000000000') // 0.001 ETH default
    );

    return !!txHash;
  }, [state.walletAddress, config.paymasterConfig]);

  const contextValue: JejuAuthContextValue = useMemo(
    () => ({
      ...state,
      config,
      login,
      logout,
      linkAccount,
      unlinkAccount,
      refreshToken,
      getAccessToken,
      signMessage,
      signTypedData,
      exportBackup,
      recoverWithBackup,
      loginWithEmail,
      loginWithWallet,
      loginWithFarcaster,
      loginWithTwitter,
      loginWithDiscord,
      verifyEmailCode,
      getSession,
      hasGas,
      requestGas,
    }),
    [
      state,
      config,
      login,
      logout,
      linkAccount,
      unlinkAccount,
      refreshToken,
      getAccessToken,
      signMessage,
      signTypedData,
      exportBackup,
      recoverWithBackup,
      loginWithEmail,
      loginWithWallet,
      loginWithFarcaster,
      loginWithTwitter,
      loginWithDiscord,
      verifyEmailCode,
      getSession,
      hasGas,
      requestGas,
    ]
  );

  return (
    <JejuAuthContext.Provider value={contextValue}>
      {children}
    </JejuAuthContext.Provider>
  );
}

// Helper to get ethereum provider from window
function getEthereumProvider():
  | {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
    }
  | undefined {
  if (typeof window === 'undefined') return undefined;
  // biome-ignore lint/suspicious/noExplicitAny: Required for compatibility with wallet providers
  return (window as any).ethereum;
}

// Extend window for ethereum - use any for compatibility with other wallet libraries
declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: Required for compatibility with wallet providers
    ethereum?: any;
  }
}
