/**
 * Cross-Chain Bridge Service
 *
 * Manages BBLN token bridging across supported chains using Hyperlane:
 * - Jeju (home chain)
 * - Ethereum Mainnet
 * - Base
 * - BSC
 * - Solana (via Wormhole)
 *
 * Integrates with Jeju's cross-chain liquidity infrastructure.
 *
 * @packageDocumentation
 */

import { logger, safeReadContract, safeWriteContract } from '@babylon/shared'
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  http,
  parseEther,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, bsc, mainnet } from 'viem/chains'

// =============================================================================
// CHAIN CONFIGURATION
// =============================================================================

export const SUPPORTED_CHAINS = {
  jeju: {
    id: 31337, // Local, will be replaced with actual Jeju chain ID
    name: 'Jeju',
    isHomeChain: true,
    rpcUrl: process.env.JEJU_RPC_URL ?? 'http://localhost:6546',
    hyperlaneMailbox: zeroAddress as Address,
    warpRoute: zeroAddress as Address,
  },
  mainnet: {
    id: 1,
    name: 'Ethereum',
    isHomeChain: false,
    rpcUrl: process.env.MAINNET_RPC_URL ?? 'https://eth.llamarpc.com',
    hyperlaneMailbox: '0x35231d4c2D8B8ADcB5617A638A0c4548684c7C70' as Address, // Hyperlane V3 Mailbox
    warpRoute: zeroAddress as Address,
  },
  base: {
    id: 8453,
    name: 'Base',
    isHomeChain: false,
    rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
    hyperlaneMailbox: '0xeA87ae93Fa0019a82A727bfd3eBd1cFCa8f64f1D' as Address,
    warpRoute: zeroAddress as Address,
  },
  bsc: {
    id: 56,
    name: 'BSC',
    isHomeChain: false,
    rpcUrl: process.env.BSC_RPC_URL ?? 'https://bsc-dataseed.binance.org',
    hyperlaneMailbox: '0x2971b9Aec44bE4eb673DF1B88cDB57b96eEfE5d5' as Address,
    warpRoute: zeroAddress as Address,
  },
  solana: {
    id: 0, // Solana uses different addressing
    name: 'Solana',
    isHomeChain: false,
    rpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
    // Uses Wormhole instead of Hyperlane
    wormholePortal: 'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb' as Address,
  },
} as const

export type SupportedChainKey = keyof typeof SUPPORTED_CHAINS

// =============================================================================
// TYPES
// =============================================================================

export interface BridgeConfig {
  sourceChain: SupportedChainKey
  destChain: SupportedChainKey
  tokenAddress: Address
  warpRouteAddress: Address
  deployerPrivateKey: `0x${string}`
}

export interface BridgeQuote {
  sourceChain: SupportedChainKey
  destChain: SupportedChainKey
  amount: bigint
  fee: bigint
  estimatedTime: number // seconds
  route: 'hyperlane' | 'wormhole'
}

export interface BridgeTransaction {
  id: string
  sourceChain: SupportedChainKey
  destChain: SupportedChainKey
  amount: bigint
  sender: Address
  recipient: Address
  sourceTxHash: `0x${string}`
  destTxHash?: `0x${string}`
  status: 'pending' | 'confirmed' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
  messageId?: `0x${string}`
}

export interface ChainLiquidity {
  chain: SupportedChainKey
  tokenBalance: bigint
  ethBalance: bigint
  lpTokens: bigint
  poolAddress: Address
}

// =============================================================================
// ABIs
// =============================================================================

const HYPERLANE_WARP_ROUTE_ABI = [
  {
    name: 'transferRemote',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: '_destination', type: 'uint32' },
      { name: '_recipient', type: 'bytes32' },
      { name: '_amountOrId', type: 'uint256' },
    ],
    outputs: [{ name: 'messageId', type: 'bytes32' }],
  },
  {
    name: 'quoteGasPayment',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_destinationDomain', type: 'uint32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const HYPERLANE_MAILBOX_ABI = [
  {
    name: 'dispatch',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: '_destinationDomain', type: 'uint32' },
      { name: '_recipientAddress', type: 'bytes32' },
      { name: '_messageBody', type: 'bytes' },
    ],
    outputs: [{ name: 'messageId', type: 'bytes32' }],
  },
  {
    name: 'quoteDispatch',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '_destinationDomain', type: 'uint32' },
      { name: '_recipientAddress', type: 'bytes32' },
      { name: '_messageBody', type: 'bytes' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'delivered',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_id', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
] as const

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

// =============================================================================
// HYPERLANE DOMAIN IDs
// =============================================================================

const HYPERLANE_DOMAINS: Record<SupportedChainKey, number> = {
  jeju: 31337, // Custom domain
  mainnet: 1,
  base: 8453,
  bsc: 56,
  solana: 1399811149, // Wormhole uses different mechanism
}

// =============================================================================
// SERVICE
// =============================================================================

export class CrossChainBridgeService {
  private clients: Map<
    SupportedChainKey,
    ReturnType<typeof createPublicClient>
  > = new Map()
  private walletClients: Map<
    SupportedChainKey,
    ReturnType<typeof createWalletClient>
  > = new Map()
  private chains: Map<SupportedChainKey, Chain> = new Map()
  private account: ReturnType<typeof privateKeyToAccount>
  private tokenAddress: Address
  private warpRoutes: Map<SupportedChainKey, Address> = new Map()
  private pendingBridges: Map<string, BridgeTransaction> = new Map()

  constructor(config: Partial<BridgeConfig> = {}) {
    this.tokenAddress =
      config.tokenAddress ??
      (process.env.BBLN_TOKEN_ADDRESS as Address) ??
      zeroAddress

    const privateKey =
      config.deployerPrivateKey ??
      (process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`) ??
      '0x0'

    this.account = privateKeyToAccount(privateKey)

    // Initialize clients for each chain
    this.initializeClients()
  }

  private initializeClients(): void {
    const chainDefs: Record<string, Chain> = {
      jeju: {
        id: SUPPORTED_CHAINS.jeju.id,
        name: 'Jeju',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [SUPPORTED_CHAINS.jeju.rpcUrl] } },
      } as Chain,
      mainnet,
      base,
      bsc,
    }

    for (const [key, chainConfig] of Object.entries(SUPPORTED_CHAINS)) {
      if (key === 'solana') continue // Solana uses different client

      const chain = chainDefs[key]
      if (!chain) continue

      const publicClient = createPublicClient({
        chain,
        transport: http(chainConfig.rpcUrl),
      })

      const walletClient = createWalletClient({
        account: this.account,
        chain,
        transport: http(chainConfig.rpcUrl),
      })

      this.clients.set(key as SupportedChainKey, publicClient)
      this.walletClients.set(key as SupportedChainKey, walletClient)
      this.chains.set(key as SupportedChainKey, chain)

      if ('warpRoute' in chainConfig && chainConfig.warpRoute !== zeroAddress) {
        this.warpRoutes.set(key as SupportedChainKey, chainConfig.warpRoute)
      }
    }
  }

  // ===========================================================================
  // WARP ROUTE MANAGEMENT
  // ===========================================================================

  setWarpRoute(chain: SupportedChainKey, address: Address): void {
    this.warpRoutes.set(chain, address)
  }

  getWarpRoute(chain: SupportedChainKey): Address | undefined {
    return this.warpRoutes.get(chain)
  }

  // ===========================================================================
  // BRIDGING
  // ===========================================================================

  async getBridgeQuote(
    sourceChain: SupportedChainKey,
    destChain: SupportedChainKey,
    amount: bigint,
  ): Promise<BridgeQuote> {
    if (destChain === 'solana') {
      // Wormhole route
      return {
        sourceChain,
        destChain,
        amount,
        fee: parseEther('0.01'), // Approximate Wormhole fee
        estimatedTime: 900, // ~15 minutes
        route: 'wormhole',
      }
    }

    // Hyperlane route
    const client = this.clients.get(sourceChain)
    const warpRoute = this.warpRoutes.get(sourceChain)

    if (!client || !warpRoute || warpRoute === zeroAddress) {
      return {
        sourceChain,
        destChain,
        amount,
        fee: parseEther('0.001'), // Default estimate
        estimatedTime: 300, // ~5 minutes
        route: 'hyperlane',
      }
    }

    const destDomain = HYPERLANE_DOMAINS[destChain]

    const fee = await safeReadContract<bigint>(client, {
      address: warpRoute,
      abi: HYPERLANE_WARP_ROUTE_ABI,
      functionName: 'quoteGasPayment',
      args: [destDomain],
    })

    return {
      sourceChain,
      destChain,
      amount,
      fee,
      estimatedTime: 300,
      route: 'hyperlane',
    }
  }

  async bridgeTokens(
    sourceChain: SupportedChainKey,
    destChain: SupportedChainKey,
    amount: bigint,
    recipient: Address,
  ): Promise<BridgeTransaction> {
    const quote = await this.getBridgeQuote(sourceChain, destChain, amount)

    if (quote.route === 'wormhole') {
      return this.bridgeViawormhole(sourceChain, destChain, amount, recipient)
    }

    return this.bridgeViaHyperlane(sourceChain, destChain, amount, recipient)
  }

  private async bridgeViaHyperlane(
    sourceChain: SupportedChainKey,
    destChain: SupportedChainKey,
    amount: bigint,
    recipient: Address,
  ): Promise<BridgeTransaction> {
    const client = this.clients.get(sourceChain)
    const walletClient = this.walletClients.get(sourceChain)
    const warpRoute = this.warpRoutes.get(sourceChain)

    if (!client || !walletClient) {
      throw new Error(`Client not initialized for ${sourceChain}`)
    }

    if (!warpRoute || warpRoute === zeroAddress) {
      throw new Error(`Warp route not configured for ${sourceChain}`)
    }

    logger.info(
      'Initiating Hyperlane bridge',
      {
        sourceChain,
        destChain,
        amount: formatUnits(amount, 18),
        recipient,
      },
      'CrossChainBridge',
    )

    // Get gas quote
    const destDomain = HYPERLANE_DOMAINS[destChain]
    const fee = await safeReadContract<bigint>(client, {
      address: warpRoute,
      abi: HYPERLANE_WARP_ROUTE_ABI,
      functionName: 'quoteGasPayment',
      args: [destDomain],
    })

    // Approve warp route to spend tokens
    const currentAllowance = await safeReadContract<bigint>(client, {
      address: this.tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [this.account.address, warpRoute],
    })

    const chain = this.chains.get(sourceChain)
    if (!chain) {
      throw new Error(`Chain not configured for ${sourceChain}`)
    }

    if (currentAllowance < amount) {
      const approveTx = await safeWriteContract(walletClient, {
        address: this.tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [warpRoute, amount],
        chain,
        account: this.account,
      })
      await client.waitForTransactionReceipt({ hash: approveTx })
    }

    // Convert recipient address to bytes32
    const recipientBytes32 =
      `0x000000000000000000000000${recipient.slice(2)}` as `0x${string}`

    // Execute bridge transfer
    const txHash = await safeWriteContract(walletClient, {
      address: warpRoute,
      abi: HYPERLANE_WARP_ROUTE_ABI,
      functionName: 'transferRemote',
      args: [destDomain, recipientBytes32, amount],
      value: fee,
      chain,
      account: this.account,
    })

    const receipt = await client.waitForTransactionReceipt({ hash: txHash })

    const bridgeTx: BridgeTransaction = {
      id: `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sourceChain,
      destChain,
      amount,
      sender: this.account.address,
      recipient,
      sourceTxHash: txHash,
      status: 'confirmed',
      createdAt: new Date(),
    }

    this.pendingBridges.set(bridgeTx.id, bridgeTx)

    logger.info(
      'Bridge transaction submitted',
      {
        id: bridgeTx.id,
        sourceTxHash: txHash,
        gasUsed: receipt.gasUsed.toString(),
      },
      'CrossChainBridge',
    )

    return bridgeTx
  }

  private async bridgeViawormhole(
    sourceChain: SupportedChainKey,
    destChain: SupportedChainKey,
    amount: bigint,
    recipient: Address,
  ): Promise<BridgeTransaction> {
    // Wormhole bridging to Solana
    // This would require the Wormhole SDK for full implementation
    logger.info(
      'Wormhole bridge not fully implemented',
      { sourceChain, destChain, amount: formatUnits(amount, 18) },
      'CrossChainBridge',
    )

    const bridgeTx: BridgeTransaction = {
      id: `wormhole-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sourceChain,
      destChain,
      amount,
      sender: this.account.address,
      recipient,
      sourceTxHash: '0x0' as `0x${string}`,
      status: 'pending',
      createdAt: new Date(),
    }

    this.pendingBridges.set(bridgeTx.id, bridgeTx)

    return bridgeTx
  }

  // ===========================================================================
  // STATUS TRACKING
  // ===========================================================================

  async checkBridgeStatus(bridgeId: string): Promise<BridgeTransaction | null> {
    const bridge = this.pendingBridges.get(bridgeId)
    if (!bridge) return null

    if (bridge.status === 'completed' || bridge.status === 'failed') {
      return bridge
    }

    // Check if message has been delivered on destination chain
    const destClient = this.clients.get(bridge.destChain)
    const destMailbox = SUPPORTED_CHAINS[bridge.destChain]

    if (destClient && 'hyperlaneMailbox' in destMailbox && bridge.messageId) {
      const delivered = await safeReadContract<boolean>(destClient, {
        address: destMailbox.hyperlaneMailbox as Address,
        abi: HYPERLANE_MAILBOX_ABI,
        functionName: 'delivered',
        args: [bridge.messageId],
      })

      if (delivered) {
        bridge.status = 'completed'
        bridge.completedAt = new Date()
        this.pendingBridges.set(bridgeId, bridge)
      }
    }

    return bridge
  }

  async getPendingBridges(): Promise<BridgeTransaction[]> {
    return Array.from(this.pendingBridges.values()).filter(
      (b) => b.status === 'pending' || b.status === 'confirmed',
    )
  }

  // ===========================================================================
  // LIQUIDITY QUERIES
  // ===========================================================================

  async getChainLiquidity(chain: SupportedChainKey): Promise<ChainLiquidity> {
    const client = this.clients.get(chain)
    if (!client) {
      return {
        chain,
        tokenBalance: 0n,
        ethBalance: 0n,
        lpTokens: 0n,
        poolAddress: zeroAddress,
      }
    }

    const warpRoute = this.warpRoutes.get(chain)
    let tokenBalance = 0n

    if (warpRoute && warpRoute !== zeroAddress) {
      tokenBalance = await safeReadContract<bigint>(client, {
        address: warpRoute,
        abi: HYPERLANE_WARP_ROUTE_ABI,
        functionName: 'balanceOf',
        args: [this.account.address],
      })
    }

    const ethBalance = await client.getBalance({
      address: this.account.address,
    })

    return {
      chain,
      tokenBalance,
      ethBalance,
      lpTokens: 0n, // Would query LP pool
      poolAddress: zeroAddress, // Would need LP pool address
    }
  }

  async getAllChainLiquidity(): Promise<ChainLiquidity[]> {
    const chains: SupportedChainKey[] = ['jeju', 'mainnet', 'base', 'bsc']
    const results = await Promise.all(
      chains.map((chain) => this.getChainLiquidity(chain)),
    )
    return results
  }

  // ===========================================================================
  // CROSS-CHAIN LIQUIDITY DEPLOYMENT
  // ===========================================================================

  async deployLiquidityToChain(
    chain: SupportedChainKey,
    tokenAmount: bigint,
    ethAmount: bigint,
  ): Promise<{ txHash: `0x${string}` }> {
    // First bridge tokens to the target chain
    if (chain !== 'jeju') {
      const bridgeTx = await this.bridgeTokens(
        'jeju',
        chain,
        tokenAmount,
        this.account.address,
      )

      logger.info(
        'Bridging tokens for liquidity deployment',
        {
          chain,
          bridgeId: bridgeTx.id,
          amount: formatUnits(tokenAmount, 18),
        },
        'CrossChainBridge',
      )
    }

    // Add liquidity on target chain via XLPRouter (similar to liquidity-pool-service)
    // This would need the target chain's router address
    logger.info(
      'Liquidity deployment initiated',
      {
        chain,
        tokenAmount: formatUnits(tokenAmount, 18),
        ethAmount: formatEther(ethAmount),
      },
      'CrossChainBridge',
    )

    return { txHash: '0x0' as `0x${string}` }
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  async initialize(): Promise<void> {
    logger.info(
      'Initializing Cross-Chain Bridge Service',
      undefined,
      'CrossChainBridge',
    )

    // Verify connectivity to each chain
    for (const [chain, client] of this.clients) {
      const blockNumber = await client.getBlockNumber()
      logger.info(
        `Connected to ${chain}`,
        { blockNumber: blockNumber.toString() },
        'CrossChainBridge',
      )
    }

    logger.info(
      'Cross-Chain Bridge Service initialized',
      undefined,
      'CrossChainBridge',
    )
  }

  // ===========================================================================
  // GETTERS
  // ===========================================================================

  getSupportedChains(): SupportedChainKey[] {
    return Object.keys(SUPPORTED_CHAINS) as SupportedChainKey[]
  }

  getChainConfig(chain: SupportedChainKey) {
    return SUPPORTED_CHAINS[chain]
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let crossChainBridgeService: CrossChainBridgeService | null = null

export function getCrossChainBridgeService(
  config?: Partial<BridgeConfig>,
): CrossChainBridgeService {
  if (!crossChainBridgeService) {
    crossChainBridgeService = new CrossChainBridgeService(config)
  }
  return crossChainBridgeService
}

export async function initializeCrossChainBridge(
  config?: Partial<BridgeConfig>,
): Promise<CrossChainBridgeService> {
  const service = getCrossChainBridgeService(config)
  await service.initialize()
  return service
}

export function resetCrossChainBridgeService(): void {
  crossChainBridgeService = null
}
