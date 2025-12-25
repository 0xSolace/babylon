/**
 * ERC-4337 Paymaster for Babylon - prepaid credits using BABYLON tokens for gas
 */

import type { JsonValue } from '@babylon/shared'
import { logger, toError, toHexOrNull } from '@babylon/shared'
import type { Hex } from 'viem'

/**
 * Transaction request for signing
 * Matches the TransactionRequest interface from @babylon/auth
 */
interface TransactionRequest {
  to: string
  value?: bigint
  data?: string
  from?: string
}

/** Retry with exponential backoff for transient failures */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = toError(err)
      const isRetryable =
        lastError.message.includes('fetch failed') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ETIMEDOUT')
      if (!isRetryable || attempt === retries - 1) throw lastError
      await new Promise((r) => setTimeout(r, 100 * 2 ** attempt))
    }
  }
  throw lastError
}

export interface PaymasterConfig {
  rpcUrl: string
  paymasterAddress: Hex
  entryPointAddress: Hex
  creditTokenAddress: Hex
}

export interface UserCredits {
  address: Hex
  balance: bigint
  totalDeposited: bigint
  totalSpent: bigint
  balanceUSD: number
}

export interface UserOperation {
  sender: Hex
  nonce: bigint
  initCode: Hex
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymasterAndData: Hex
  signature: Hex
}

export interface SponsorResult {
  canSponsor: boolean
  paymasterAndData: Hex
  estimatedCredits: bigint
  reason?: string
}

export interface DepositResult {
  txHash: Hex
  amount: bigint
  newBalance: bigint
}

export class PaymasterClient {
  private config: PaymasterConfig
  private initialized = false

  constructor(config: PaymasterConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    const code = await this.rpc('eth_getCode', [
      this.config.paymasterAddress,
      'latest',
    ])
    if (code === '0x' || !code) {
      throw new Error(
        `[Paymaster] Contract not found at ${this.config.paymasterAddress}`,
      )
    }
    this.initialized = true
    logger.info('[Paymaster] Initialized', {
      paymaster: this.config.paymasterAddress,
    })
  }

  async getCredits(address: Hex): Promise<UserCredits> {
    this.ensureInitialized()
    const selector = '0x7a6d6cf4'
    const paddedAddress = address.slice(2).toLowerCase().padStart(64, '0')
    const result = await this.rpc('eth_call', [
      { to: this.config.paymasterAddress, data: `${selector}${paddedAddress}` },
      'latest',
    ])
    const hex = result.slice(2)
    const balance = BigInt(`0x${hex.slice(0, 64)}`)
    const deposited = BigInt(`0x${hex.slice(64, 128)}`)
    const spent = BigInt(`0x${hex.slice(128, 192)}`)
    return {
      address,
      balance,
      totalDeposited: deposited,
      totalSpent: spent,
      balanceUSD: (Number(balance) * 0.01) / 1e18,
    }
  }

  async canSponsor(userOp: Partial<UserOperation>): Promise<SponsorResult> {
    this.ensureInitialized()
    if (!userOp.sender) {
      return {
        canSponsor: false,
        paymasterAndData: '0x' as Hex,
        estimatedCredits: 0n,
        reason: 'No sender',
      }
    }
    const credits = await this.getCredits(userOp.sender)
    const gas =
      (userOp.callGasLimit ?? 100000n) +
      (userOp.verificationGasLimit ?? 100000n) +
      (userOp.preVerificationGas ?? 21000n)
    const estimatedCredits = gas / 1000n + 1n
    if (credits.balance < estimatedCredits) {
      return {
        canSponsor: false,
        paymasterAndData: '0x' as Hex,
        estimatedCredits,
        reason: 'Insufficient credits',
      }
    }
    const validUntil = Math.floor(Date.now() / 1000) + 3600
    const validAfter = Math.floor(Date.now() / 1000) - 60
    const paymasterAndData = (this.config.paymasterAddress +
      validUntil.toString(16).padStart(12, '0') +
      validAfter.toString(16).padStart(12, '0')) as Hex
    return { canSponsor: true, paymasterAndData, estimatedCredits }
  }

  async sponsorUserOp(userOp: UserOperation): Promise<UserOperation> {
    this.ensureInitialized()
    const result = await this.canSponsor(userOp)
    if (!result.canSponsor)
      throw new Error(`[Paymaster] Cannot sponsor: ${result.reason}`)
    return { ...userOp, paymasterAndData: result.paymasterAndData }
  }

  async deposit(
    from: Hex,
    to: Hex,
    amount: bigint,
    signTx: (tx: TransactionRequest) => Promise<Hex>,
  ): Promise<DepositResult> {
    this.ensureInitialized()
    const selector = '0x6e553f65'
    const paddedTo = to.slice(2).toLowerCase().padStart(64, '0')
    const paddedAmount = amount.toString(16).padStart(64, '0')
    const signedTx = await signTx({
      to: this.config.creditTokenAddress,
      data: `${selector}${paddedTo}${paddedAmount}`,
      from,
    })
    const txHash = await this.rpc('eth_sendRawTransaction', [signedTx])
    await this.waitForTx(txHash)
    const credits = await this.getCredits(to)
    logger.info('[Paymaster] Deposit', { from, to, amount: amount.toString() })
    return { txHash, amount, newBalance: credits.balance }
  }

  async getUsageHistory(address: Hex, limit = 100) {
    this.ensureInitialized()
    const apiUrl =
      process.env.JEJU_PAYMASTER_API_URL ??
      (process.env.PUBLIC_JEJU_NETWORK === 'mainnet'
        ? 'https://paymaster.jeju.network'
        : 'https://paymaster.testnet.jeju.network')
    const response = await fetch(
      `${apiUrl}/api/v1/usage/${address}?limit=${limit}`,
      {
        signal: AbortSignal.timeout(10000),
      },
    )
    if (!response.ok)
      throw new Error(`[Paymaster] Usage fetch failed: ${response.status}`)
    const { usage } = (await response.json()) as {
      usage: Array<{
        txHash: Hex
        timestamp: number
        gasUsed: string
        creditsSpent: string
        operation: string
      }>
    }
    return usage.map((u) => ({
      ...u,
      gasUsed: BigInt(u.gasUsed),
      creditsSpent: BigInt(u.creditsSpent),
    }))
  }

  async getGasPrice() {
    this.ensureInitialized()
    const response = await fetch(this.config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'eth_maxPriorityFeePerGas',
          params: [],
        },
      ]),
      signal: AbortSignal.timeout(10000),
    })
    const results = (await response.json()) as Array<{ result?: Hex }>
    if (!results[0]?.result) {
      throw new Error('[Paymaster] Failed to get gas price from RPC')
    }
    if (!results[1]?.result) {
      throw new Error('[Paymaster] Failed to get max priority fee from RPC')
    }
    return {
      baseFee: BigInt(results[0].result),
      maxPriorityFee: BigInt(results[1].result),
      creditPerGas: 1000n,
    }
  }

  private async rpc(method: string, params: JsonValue[]): Promise<Hex> {
    return withRetry(async () => {
      const response = await fetch(this.config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(10000),
      })
      const { result, error } = (await response.json()) as {
        result?: Hex
        error?: { message: string }
      }
      if (error) throw new Error(`[Paymaster] RPC error: ${error.message}`)
      if (!result) {
        throw new Error('[Paymaster] No result returned from RPC call')
      }
      return result
    })
  }

  private async waitForTx(txHash: Hex): Promise<void> {
    for (let i = 0; i < 60; i++) {
      const receipt = await this.rpc('eth_getTransactionReceipt', [txHash])
      if (receipt && typeof receipt === 'object' && receipt !== null) {
        const receiptObj = receipt as { status?: Hex }
        if (receiptObj.status === '0x1') return
        if (receiptObj.status !== undefined) {
          throw new Error(`Transaction reverted: ${txHash}`)
        }
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    throw new Error(`Transaction not confirmed: ${txHash}`)
  }

  private ensureInitialized(): void {
    if (!this.initialized) throw new Error('[Paymaster] Not initialized')
  }
}

let paymasterClient: PaymasterClient | null = null

export function getPaymasterClient(): PaymasterClient {
  if (paymasterClient) return paymasterClient

  const network = process.env.PUBLIC_JEJU_NETWORK
  if (!network) throw new Error('[Paymaster] PUBLIC_JEJU_NETWORK not set')

  type Network = 'localnet' | 'testnet' | 'mainnet'
  const rpcUrls: Record<Network, string> = {
    localnet: 'http://127.0.0.1:6546',
    testnet: 'https://testnet-rpc.jeju.network',
    mainnet: 'https://rpc.jeju.network',
  }
  // Paymaster addresses - testnet/mainnet require env var configuration
  const paymasterAddrs: Record<Network, Hex | null> = {
    localnet: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Hex,
    testnet: null, // Set PAYMASTER_ADDRESS for testnet
    mainnet: null, // Set PAYMASTER_ADDRESS for mainnet
  }
  const entryPointAddrs: Record<Network, Hex> = {
    localnet: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as Hex,
    testnet: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Hex, // Standard ERC-4337 v0.6
    mainnet: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Hex, // Standard ERC-4337 v0.6
  }
  // Credit token addresses - testnet/mainnet require env var configuration
  const tokenAddrs: Record<Network, Hex | null> = {
    localnet: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as Hex,
    testnet: null, // Set CREDIT_TOKEN_ADDRESS for testnet
    mainnet: null, // Set CREDIT_TOKEN_ADDRESS for mainnet
  }

  const net: Network =
    network === 'mainnet' || network === 'testnet' ? network : 'localnet'

  // Resolve addresses with env var fallback
  const paymasterAddr =
    toHexOrNull(process.env.PAYMASTER_ADDRESS) ?? paymasterAddrs[net]
  const tokenAddr =
    toHexOrNull(process.env.CREDIT_TOKEN_ADDRESS) ?? tokenAddrs[net]

  if (!paymasterAddr) {
    throw new Error(
      `[Paymaster] PAYMASTER_ADDRESS required for ${net}. Deploy paymaster contract and set env var.`,
    )
  }
  if (!tokenAddr) {
    throw new Error(
      `[Paymaster] CREDIT_TOKEN_ADDRESS required for ${net}. Deploy credit token and set env var.`,
    )
  }

  const entryPointAddr =
    toHexOrNull(process.env.ENTRY_POINT_ADDRESS) ?? entryPointAddrs[net]

  paymasterClient = new PaymasterClient({
    rpcUrl: process.env.JEJU_RPC_URL ?? rpcUrls[net],
    paymasterAddress: paymasterAddr,
    entryPointAddress: entryPointAddr,
    creditTokenAddress: tokenAddr,
  })
  return paymasterClient
}

async function _initializePaymaster(): Promise<PaymasterClient> {
  const client = getPaymasterClient()
  await client.initialize()
  return client
}

function _resetPaymasterClient(): void {
  paymasterClient = null
}

function _isPaymasterAvailable(): boolean {
  return !!process.env.PUBLIC_JEJU_NETWORK
}
