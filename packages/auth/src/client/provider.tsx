/**
 * JejuAuthProvider
 *
 * React context provider for decentralized authentication.
 */

import type { JsonValue } from '@babylon/shared'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Address, Hex } from 'viem'
import { createDID } from '../did/index'
import { generatePKCE } from '../oauth/pkce'
import { SIWE } from '../oauth/siwe'
import { TreasuryPaymaster } from '../paymaster/treasury-paymaster'
import { KeyBackupManager } from '../recovery/backup'
import { SessionDataSchema } from '../schemas/index'
import {
  bufferToHex,
  EMPTY_ADDRESS,
  EMPTY_HEX,
  PENDING_DID,
} from '../types/guards'
import type {
  AuthMethod,
  DID,
  KeyBackup,
  LinkedAccount,
  SessionToken,
} from '../types/index'
// Browser-safe stubs for server-side Jeju packages
// These avoid importing @jejunetwork/oauth3 and @jejunetwork/kms which
// include TEE code that uses Node.js APIs (node:fs)
import {
  DiscordProvider,
  getMPCCoordinator,
  TwitterProvider,
} from './browser-stubs'
import { createSessionMessage, SessionManager } from './session'
import type { JejuAuthConfig, JejuAuthContextValue, SessionData } from './types'

// Create singleton managers
const backupManager = new KeyBackupManager()
const sessionManager = new SessionManager()

const SESSION_KEY = 'jeju_auth_session'
const PENDING_EMAIL_KEY = 'jeju_pending_email'

interface AuthProviderState {
  ready: boolean
  authenticated: boolean
  userId: DID | null
  walletAddress: Address | null
  linkedAccounts: LinkedAccount[]
  loading: boolean
  error: string | null
}

const initialState: AuthProviderState = {
  ready: false,
  authenticated: false,
  userId: null,
  walletAddress: null,
  linkedAccounts: [],
  loading: true,
  error: null,
}

const JejuAuthContext = createContext<JejuAuthContextValue | null>(null)

export function useJejuAuthContext(): JejuAuthContextValue {
  const context = useContext(JejuAuthContext)
  if (!context) {
    throw new Error('useJejuAuthContext must be used within JejuAuthProvider')
  }
  return context
}

interface JejuAuthProviderProps {
  children: ReactNode
  config: JejuAuthConfig
}

// Helper type for MPC signing result
interface SignResult {
  signature: Hex
  signerAddress: Address
  recoveryId: number
}

/** JSON-RPC response type for Ethereum RPC calls */
interface JsonRpcResponse<T = string> {
  jsonrpc: '2.0'
  id: number
  result: T
  error?: { code: number; message: string }
}

export function JejuAuthProvider({ children, config }: JejuAuthProviderProps) {
  const [state, setState] = useState<AuthProviderState>(initialState)
  const [mpcKeyId, setMpcKeyId] = useState<string | null>(null)

  // Initialize MPC coordinator
  const mpcCoordinator = useMemo(
    () =>
      getMPCCoordinator({
        network: config.network,
      }),
    [config.network],
  )

  // OAuth providers - use Jeju's providers
  const twitterProvider = useMemo(
    () =>
      config.oauth?.twitter
        ? new TwitterProvider({
            clientId: config.oauth.twitter,
            clientSecret: '',
            redirectUri: config.redirectUri ?? '',
            scopes: ['tweet.read', 'users.read'],
          })
        : null,
    [config.oauth?.twitter, config.redirectUri],
  )

  const discordProvider = useMemo(
    () =>
      config.oauth?.discord
        ? new DiscordProvider({
            clientId: config.oauth.discord,
            clientSecret: '',
            redirectUri: config.redirectUri ?? '',
            scopes: ['identify', 'email'],
          })
        : null,
    [config.oauth?.discord, config.redirectUri],
  )

  // Helper to sign with MPC
  const signWithMPC = useCallback(
    async (message: string): Promise<SignResult> => {
      if (!mpcKeyId) {
        throw new Error('No MPC key available')
      }

      const key = mpcCoordinator.getKey(mpcKeyId)
      if (!key) {
        throw new Error('Key not found in MPC coordinator')
      }

      // Request signature from MPC coordinator
      const messageHex = bufferToHex(new TextEncoder().encode(message))
      const session = await mpcCoordinator.requestSignature({
        keyId: mpcKeyId,
        message: messageHex,
        messageHash: messageHex,
        requester: key.address,
      })

      // In production, would collect partial signatures from parties
      // For now, simulate with a single-party sign
      if (session.participants.length === 0) {
        throw new Error('No participants in MPC session')
      }
      // biome-ignore lint/style/noNonNullAssertion: length check above guarantees element exists
      const participant = session.participants[0]!
      const result = await mpcCoordinator.submitPartialSignature(
        session.sessionId,
        participant,
        {
          partyId: participant,
          partialR: EMPTY_HEX,
          partialS: EMPTY_HEX,
          commitment: EMPTY_HEX,
        },
      )

      if (!result.signature) {
        throw new Error('Failed to get signature from MPC')
      }

      return {
        signature: result.signature.signature,
        signerAddress: key.address,
        recoveryId: result.signature.v,
      }
    },
    [mpcCoordinator, mpcKeyId],
  )

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (!stored) {
        setState((s: AuthProviderState) => ({
          ...s,
          ready: true,
          loading: false,
        }))
        return
      }

      const session = SessionDataSchema.parse(JSON.parse(stored))

      if (Date.now() > session.expiresAt) {
        sessionStorage.removeItem(SESSION_KEY)
        setState((s: AuthProviderState) => ({
          ...s,
          ready: true,
          loading: false,
        }))
        return
      }

      // Set MPC key ID from session
      setMpcKeyId(session.userId)

      setState({
        ready: true,
        authenticated: true,
        userId: session.userId,
        walletAddress: session.walletAddress,
        linkedAccounts: session.linkedAccounts,
        loading: false,
        error: null,
      })
    }

    loadSession().catch((err) => {
      console.error('Failed to load session:', err)
      setState((s: AuthProviderState) => ({
        ...s,
        ready: true,
        loading: false,
      }))
    })
  }, [])

  // Login handlers
  const loginWithEmail = useCallback(async (email: string) => {
    setState((s: AuthProviderState) => ({ ...s, loading: true, error: null }))
    sessionStorage.setItem(PENDING_EMAIL_KEY, email)
    setState((s: AuthProviderState) => ({ ...s, loading: false }))
  }, [])

  const verifyEmailCode = useCallback(
    async (_code: string) => {
      setState((s: AuthProviderState) => ({
        ...s,
        loading: true,
        error: null,
      }))

      const email = sessionStorage.getItem(PENDING_EMAIL_KEY)
      if (!email) {
        setState((s: AuthProviderState) => ({
          ...s,
          loading: false,
          error: 'No pending email verification',
        }))
        return
      }

      // Generate key via MPC
      const keyId = `email:${email}:${Date.now()}`
      const partyIds = ['party-1', 'party-2', 'party-3']

      // Register parties (in production, these would be TEE nodes)
      for (const partyId of partyIds) {
        mpcCoordinator.registerParty({
          id: partyId,
          index: partyIds.indexOf(partyId) + 1,
          endpoint: 'http://localhost:4010',
          publicKey: EMPTY_HEX,
          address: EMPTY_ADDRESS,
          stake: 0n,
          registeredAt: Date.now(),
        })
      }

      const keyResult = await mpcCoordinator.generateKey({
        keyId,
        threshold: 2,
        totalParties: 3,
        partyIds,
        curve: 'secp256k1',
      })

      const did = createDID(keyResult.publicKey, config.network)
      setMpcKeyId(keyId)

      // Create session
      const { message, claims } = createSessionMessage(did, keyResult.address)
      const signResult = await signWithMPC(message)
      const token = sessionManager.createToken(claims, signResult.signature)

      const session: SessionData = {
        userId: did,
        token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        walletAddress: keyResult.address,
        linkedAccounts: [
          {
            type: 'email',
            identifier: email,
            verifiedAt: Date.now(),
          },
        ],
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      sessionStorage.removeItem(PENDING_EMAIL_KEY)

      setState({
        ready: true,
        authenticated: true,
        userId: did,
        walletAddress: keyResult.address,
        linkedAccounts: session.linkedAccounts,
        loading: false,
        error: null,
      })
    },
    [config.network, mpcCoordinator, signWithMPC],
  )

  const loginWithWallet = useCallback(async () => {
    setState((s: AuthProviderState) => ({ ...s, loading: true, error: null }))

    const ethereum = getEthereumProvider()
    if (!ethereum) {
      setState((s: AuthProviderState) => ({
        ...s,
        loading: false,
        error: 'No wallet detected',
      }))
      return
    }

    const accounts = (await ethereum.request({
      method: 'eth_requestAccounts',
    })) as string[]
    const address = accounts[0] as Address

    const domain =
      typeof window !== 'undefined' ? window.location.host : 'babylon.game'

    const siwe = new SIWE({
      domain,
      statement: 'Sign in to Babylon with your wallet.',
      chainId: config.chainId,
      expiresIn: 300,
    })
    const siweMessage = siwe.createMessage(address)
    const message = siweMessage.message

    await ethereum.request({
      method: 'personal_sign',
      params: [message, address],
    })

    // Generate MPC key for the wallet
    const keyId = `wallet:${address}:${Date.now()}`
    const partyIds = ['party-1', 'party-2', 'party-3']

    for (const partyId of partyIds) {
      mpcCoordinator.registerParty({
        id: partyId,
        index: partyIds.indexOf(partyId) + 1,
        endpoint: 'http://localhost:4010',
        publicKey: '0x' as Hex,
        address: '0x' as Address,
        stake: 0n,
        registeredAt: Date.now(),
      })
    }

    const keyResult = await mpcCoordinator.generateKey({
      keyId,
      threshold: 2,
      totalParties: 3,
      partyIds,
      curve: 'secp256k1',
    })

    const did = createDID(keyResult.publicKey, config.network)
    setMpcKeyId(keyId)

    // Create session
    const { message: sessionMessage, claims } = createSessionMessage(
      did,
      keyResult.address,
    )
    const signResult = await signWithMPC(sessionMessage)
    const token = sessionManager.createToken(claims, signResult.signature)

    const session: SessionData = {
      userId: did,
      token,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      walletAddress: keyResult.address,
      linkedAccounts: [
        {
          type: 'wallet',
          identifier: address.toLowerCase(),
          verifiedAt: Date.now(),
        },
      ],
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))

    setState({
      ready: true,
      authenticated: true,
      userId: did,
      walletAddress: keyResult.address,
      linkedAccounts: session.linkedAccounts,
      loading: false,
      error: null,
    })
  }, [config.chainId, config.network, mpcCoordinator, signWithMPC])

  const loginWithTwitter = useCallback(async () => {
    if (!twitterProvider || !config.redirectUri) {
      setState((s: AuthProviderState) => ({
        ...s,
        error: 'Twitter OAuth not configured',
      }))
      return
    }

    const pkce = await generatePKCE()
    // TwitterProvider from browser-stubs - use getAuthorizationUrlAsync for PKCE flow
    const oauthState = {
      state: pkce.state,
      nonce: pkce.codeVerifier,
      provider: 'twitter' as const,
      appId: '0x' as Hex,
      createdAt: Date.now(),
    }
    const url = await twitterProvider.getAuthorizationUrlAsync(oauthState)
    window.location.href = url
  }, [twitterProvider, config.redirectUri])

  const loginWithDiscord = useCallback(async () => {
    if (!discordProvider || !config.redirectUri) {
      setState((s: AuthProviderState) => ({
        ...s,
        error: 'Discord OAuth not configured',
      }))
      return
    }

    const pkce = await generatePKCE()
    const oauthState = {
      state: pkce.state,
      nonce: pkce.codeVerifier,
      provider: 'discord' as const,
      appId: EMPTY_HEX,
      createdAt: Date.now(),
    }
    // DiscordProvider from browser-stubs - use getAuthorizationUrl directly
    const url = discordProvider.getAuthorizationUrl(oauthState)
    window.location.href = url
  }, [discordProvider, config.redirectUri])

  const loginWithFarcaster = useCallback(async () => {
    setState((s: AuthProviderState) => ({ ...s, loading: true, error: null }))

    const domain =
      typeof window !== 'undefined' ? window.location.host : 'babylon.game'

    // Store request for verification
    const request = {
      domain,
      nonce: crypto.randomUUID(),
      expiresAt: Date.now() + 300000,
    }
    sessionStorage.setItem('jeju_farcaster_request', JSON.stringify(request))

    setState((s: AuthProviderState) => ({
      ...s,
      loading: false,
      error: 'Please sign the message in Warpcast',
    }))
  }, [])

  const logout = useCallback(async () => {
    sessionStorage.removeItem(SESSION_KEY)
    setMpcKeyId(null)
    setState({
      ready: true,
      authenticated: false,
      userId: null,
      walletAddress: null,
      linkedAccounts: [],
      loading: false,
      error: null,
    })
  }, [])

  const login = useCallback(
    async (method: AuthMethod): Promise<SessionToken> => {
      switch (method.type) {
        case 'email':
          await loginWithEmail(method.email)
          return {
            token: '',
            expiresAt: 0,
            userId: PENDING_DID,
          }
        case 'wallet':
          await loginWithWallet()
          break
        case 'twitter':
          await loginWithTwitter()
          return {
            token: '',
            expiresAt: 0,
            userId: PENDING_DID,
          }
        case 'discord':
          await loginWithDiscord()
          return {
            token: '',
            expiresAt: 0,
            userId: PENDING_DID,
          }
        case 'farcaster':
          await loginWithFarcaster()
          break
      }

      const stored = sessionStorage.getItem(SESSION_KEY)
      if (stored) {
        const session = SessionDataSchema.parse(JSON.parse(stored))
        return {
          token: session.token,
          expiresAt: session.expiresAt,
          userId: session.userId,
        }
      }

      return {
        token: '',
        expiresAt: 0,
        userId: PENDING_DID,
      }
    },
    [
      loginWithEmail,
      loginWithWallet,
      loginWithTwitter,
      loginWithDiscord,
      loginWithFarcaster,
    ],
  )

  const linkAccount = useCallback(
    async (method: AuthMethod) => {
      if (!state.userId || !mpcKeyId) {
        throw new Error('Not authenticated')
      }

      // Would implement account linking logic here
      console.log('Link account:', method)
    },
    [state.userId, mpcKeyId],
  )

  const unlinkAccount = useCallback(
    async (type: LinkedAccount['type'], identifier: string) => {
      if (!state.userId || !mpcKeyId) {
        throw new Error('Not authenticated')
      }

      setState((s: AuthProviderState) => ({
        ...s,
        linkedAccounts: s.linkedAccounts.filter(
          (a: LinkedAccount) =>
            !(a.type === type && a.identifier === identifier),
        ),
      }))
    },
    [state.userId, mpcKeyId],
  )

  const refreshToken = useCallback(async (): Promise<SessionToken> => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (!stored || !mpcKeyId) {
      throw new Error('No session to refresh')
    }

    const session = SessionDataSchema.parse(JSON.parse(stored))

    const { message, claims } = createSessionMessage(
      session.userId,
      session.walletAddress,
    )
    const signResult = await signWithMPC(message)
    const newToken = sessionManager.createToken(claims, signResult.signature)
    const newExpiresAt = Date.now() + 24 * 60 * 60 * 1000

    session.token = newToken
    session.expiresAt = newExpiresAt
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))

    return {
      token: newToken,
      expiresAt: newExpiresAt,
      userId: session.userId,
    }
  }, [mpcKeyId, signWithMPC])

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (!stored) {
      return null
    }

    const parseResult = SessionDataSchema.safeParse(JSON.parse(stored))
    if (!parseResult.success) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }

    const session = parseResult.data
    if (Date.now() > session.expiresAt) {
      return null
    }

    return session.token
  }, [])

  const signMessage = useCallback(
    async (message: string): Promise<Hex> => {
      if (!mpcKeyId) {
        throw new Error('Not authenticated')
      }
      const result = await signWithMPC(message)
      return result.signature
    },
    [mpcKeyId, signWithMPC],
  )

  const signTypedData = useCallback(
    async (typedData: Record<string, JsonValue>): Promise<Hex> => {
      if (!mpcKeyId) {
        throw new Error('Not authenticated')
      }
      const result = await signWithMPC(JSON.stringify(typedData))
      return result.signature
    },
    [mpcKeyId, signWithMPC],
  )

  const exportBackup = useCallback(
    async (password: string): Promise<KeyBackup> => {
      if (!state.userId) {
        throw new Error('Not authenticated')
      }

      const backup = await backupManager.createBackup(state.userId, password)
      return backup
    },
    [state.userId],
  )

  const recoverWithBackup = useCallback(
    async (backup: KeyBackup, password: string) => {
      const isValid = await backupManager.verifyBackup(backup, password)
      if (!isValid) {
        throw new Error('Invalid backup or password')
      }

      setMpcKeyId(backup.userId)

      const key = mpcCoordinator.getKey(backup.userId)
      const walletAddress = key?.address ?? EMPTY_ADDRESS

      const { message, claims } = createSessionMessage(
        backup.userId,
        walletAddress,
      )
      const signResult = await signWithMPC(message)
      const token = sessionManager.createToken(claims, signResult.signature)

      const session: SessionData = {
        userId: backup.userId,
        token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        walletAddress,
        linkedAccounts: [],
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))

      setState({
        ready: true,
        authenticated: true,
        userId: backup.userId,
        walletAddress,
        linkedAccounts: [],
        loading: false,
        error: null,
      })
    },
    [mpcCoordinator, signWithMPC],
  )

  const getSession = useCallback((): SessionData | null => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (!stored) return null
    const parseResult = SessionDataSchema.safeParse(JSON.parse(stored))
    if (!parseResult.success) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return parseResult.data
  }, [])

  const hasGas = useCallback(async (): Promise<boolean> => {
    if (!state.walletAddress || !config.rpcUrl) return false

    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [state.walletAddress, 'latest'],
        id: 1,
      }),
    })

    const data: JsonRpcResponse = await response.json()
    return BigInt(data.result) > 0n
  }, [state.walletAddress, config.rpcUrl])

  const requestGas = useCallback(async (): Promise<boolean> => {
    if (!state.walletAddress || !config.paymasterConfig) {
      return false
    }

    const paymasterConfig = {
      treasuryAddress: config.paymasterConfig.treasuryAddress,
      operatorPrivateKey: config.paymasterConfig.operatorPrivateKey,
      rpcUrl: config.paymasterConfig.rpcUrl,
      chainId: config.paymasterConfig.chainId,
      policy: config.paymasterConfig.policy ?? {},
    }

    const paymaster = new TreasuryPaymaster(paymasterConfig)

    const txHash = await paymaster.fundUser(
      state.walletAddress,
      BigInt(config.paymasterConfig.defaultGasAmount ?? '1000000000000000'),
    )

    return !!txHash
  }, [state.walletAddress, config.paymasterConfig])

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
    ],
  )

  return (
    <JejuAuthContext.Provider value={contextValue}>
      {children}
    </JejuAuthContext.Provider>
  )
}

// Ethereum provider interface for wallet interactions
type EthereumRequestParams = string | number | boolean | Address | Hex | null
interface EthereumProvider {
  request: (args: {
    method: string
    params?: EthereumRequestParams[]
  }) => Promise<string | string[]>
}

function getEthereumProvider(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { ethereum?: EthereumProvider }).ethereum
}
