/**
 * Liquidity Pool Service
 *
 * Manages liquidity pool creation and management for BBLN token using Jeju XLP AMM:
 * - V2 constant-product pools for broad access
 * - LP token locking for team allocation
 * - Fee distribution (50% team / 50% holders)
 * - Cross-chain liquidity via XLPRouter
 *
 * @packageDocumentation
 */

import { logger } from '@babylon/shared'
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  http,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, bsc, mainnet, sepolia } from 'viem/chains'

// =============================================================================
// TYPES
// =============================================================================

export interface LiquidityConfig {
  // Network
  chainId: number
  rpcUrl: string

  // Contracts
  tokenAddress: Address
  wethAddress: Address
  xlpV2FactoryAddress: Address
  xlpRouterAddress: Address
  lpLockerAddress: Address
  feeDistributorAddress: Address
  ethUsdPriceFeedAddress?: Address // Chainlink ETH/USD aggregator

  // Keys
  deployerPrivateKey: `0x${string}`
  treasuryAddress: Address

  // LP Settings
  lpTokensToLock: number // % of LP tokens to lock (0-100)
  lpLockDuration: number // seconds
  teamFeeBps: number // % of trading fees to team (bps)
  holdersFeeBps: number // % of trading fees to holders (bps)
}

export interface PoolInfo {
  pairAddress: Address
  token0: Address
  token1: Address
  reserve0: bigint
  reserve1: bigint
  lpTotalSupply: bigint
  price: number // token price in ETH
}

export interface LPPosition {
  lpBalance: bigint
  token0Amount: bigint
  token1Amount: bigint
  shareOfPool: number // bps
}

export interface LockedLPInfo {
  lockId: bigint
  lpAmount: bigint
  unlockTime: number
  beneficiary: Address
  isPermanent: boolean
}

export interface FeeDistribution {
  totalFees: bigint
  teamShare: bigint
  holdersShare: bigint
  distributedAt: number
}

// =============================================================================
// CONTRACT ABIs
// =============================================================================

const XLP_V2_FACTORY_ABI = [
  {
    name: 'createPair',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
  },
  {
    name: 'getPair',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
  },
] as const

const XLP_V2_PAIR_ABI = [
  {
    name: 'getReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
  },
  {
    name: 'token0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'token1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
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
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

const XLP_ROUTER_ABI = [
  {
    name: 'addLiquidityETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amountTokenDesired', type: 'uint256' },
      { name: 'amountTokenMin', type: 'uint256' },
      { name: 'amountETHMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountToken', type: 'uint256' },
      { name: 'amountETH', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' },
    ],
  },
  {
    name: 'removeLiquidityETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'amountTokenMin', type: 'uint256' },
      { name: 'amountETHMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountToken', type: 'uint256' },
      { name: 'amountETH', type: 'uint256' },
    ],
  },
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactTokensForETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const

const LP_LOCKER_ABI = [
  {
    name: 'lock',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'lpToken', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'beneficiary', type: 'address' },
    ],
    outputs: [{ name: 'lockId', type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'lockId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'extendLock',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'lockId', type: 'uint256' },
      { name: 'additionalDuration', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getLock',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'lockId', type: 'uint256' }],
    outputs: [
      { name: 'lpToken', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'unlockTime', type: 'uint256' },
      { name: 'beneficiary', type: 'address' },
      { name: 'withdrawn', type: 'bool' },
    ],
  },
  {
    name: 'getLocksForBeneficiary',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'beneficiary', type: 'address' }],
    outputs: [{ name: 'lockIds', type: 'uint256[]' }],
  },
  {
    name: 'PERMANENT_LOCK',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
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
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
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

const CHAINLINK_AGGREGATOR_ABI = [
  {
    name: 'latestRoundData',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const

// Chainlink ETH/USD price feed addresses by chain
const CHAINLINK_ETH_USD_FEEDS: Record<number, Address> = {
  1: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // Mainnet
  8453: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', // Base
  56: '0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e', // BSC
  11155111: '0x694AA1769357215DE4FAC081bf1f309aDC325306', // Sepolia
}

// =============================================================================
// LIQUIDITY POOL SERVICE
// =============================================================================

export class LiquidityPoolService {
  private config: LiquidityConfig
  private chain: Chain
  private publicClient
  private walletClient
  private account: ReturnType<typeof privateKeyToAccount>
  private pairAddress: Address | null = null

  constructor(config: Partial<LiquidityConfig> = {}) {
    const chainId = config.chainId ?? parseInt(process.env.CHAIN_ID ?? '1', 10)
    this.chain = LiquidityPoolService.getChainFromId(chainId)

    this.config = {
      chainId,
      rpcUrl:
        config.rpcUrl ?? process.env.ETH_RPC_URL ?? 'http://localhost:6545',
      tokenAddress:
        config.tokenAddress ??
        (process.env.BBLN_TOKEN_ADDRESS as Address) ??
        zeroAddress,
      wethAddress:
        config.wethAddress ??
        (process.env.WETH_ADDRESS as Address) ??
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      xlpV2FactoryAddress:
        config.xlpV2FactoryAddress ??
        (process.env.XLP_V2_FACTORY_ADDRESS as Address) ??
        zeroAddress,
      xlpRouterAddress:
        config.xlpRouterAddress ??
        (process.env.XLP_ROUTER_ADDRESS as Address) ??
        zeroAddress,
      lpLockerAddress:
        config.lpLockerAddress ??
        (process.env.LP_LOCKER_ADDRESS as Address) ??
        zeroAddress,
      feeDistributorAddress:
        config.feeDistributorAddress ??
        (process.env.FEE_DISTRIBUTOR_ADDRESS as Address) ??
        zeroAddress,
      deployerPrivateKey:
        config.deployerPrivateKey ??
        (process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`) ??
        '0x0',
      treasuryAddress:
        config.treasuryAddress ??
        (process.env.TREASURY_ADDRESS as Address) ??
        zeroAddress,
      lpTokensToLock: config.lpTokensToLock ?? 100, // 100% locked by default
      lpLockDuration: config.lpLockDuration ?? 180 * 24 * 60 * 60, // 180 days
      teamFeeBps: config.teamFeeBps ?? 5000, // 50%
      holdersFeeBps: config.holdersFeeBps ?? 5000, // 50%
    }

    this.account = privateKeyToAccount(this.config.deployerPrivateKey)

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    })

    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    })
  }

  private static getChainFromId(chainId: number): Chain {
    switch (chainId) {
      case 1:
        return mainnet
      case 11155111:
        return sepolia
      case 8453:
        return base
      case 56:
        return bsc
      default:
        return mainnet
    }
  }

  // ===========================================================================
  // POOL CREATION
  // ===========================================================================

  async createPool(): Promise<Address> {
    logger.info(
      'Creating BBLN/WETH pool',
      {
        token: this.config.tokenAddress,
        weth: this.config.wethAddress,
      },
      'LiquidityPool',
    )

    // Check if pair already exists
    const existingPair = await this.publicClient.readContract({
      address: this.config.xlpV2FactoryAddress,
      abi: XLP_V2_FACTORY_ABI,
      functionName: 'getPair',
      args: [this.config.tokenAddress, this.config.wethAddress],
    })

    if (existingPair !== zeroAddress) {
      logger.info(
        'Pool already exists',
        { pairAddress: existingPair },
        'LiquidityPool',
      )
      this.pairAddress = existingPair
      return existingPair
    }

    // Create new pair
    const txHash = await this.walletClient.writeContract({
      address: this.config.xlpV2FactoryAddress,
      abi: XLP_V2_FACTORY_ABI,
      functionName: 'createPair',
      args: [this.config.tokenAddress, this.config.wethAddress],
      chain: this.chain,
      account: this.account,
    })

    await this.publicClient.waitForTransactionReceipt({ hash: txHash })

    // Get the created pair address
    const pairAddress = await this.publicClient.readContract({
      address: this.config.xlpV2FactoryAddress,
      abi: XLP_V2_FACTORY_ABI,
      functionName: 'getPair',
      args: [this.config.tokenAddress, this.config.wethAddress],
    })

    this.pairAddress = pairAddress

    logger.info(
      'Pool created successfully',
      { pairAddress, txHash },
      'LiquidityPool',
    )

    return pairAddress
  }

  // ===========================================================================
  // LIQUIDITY MANAGEMENT
  // ===========================================================================

  async addLiquidity(
    tokenAmount: bigint,
    ethAmount: bigint,
    slippageBps: number = 100, // 1% default slippage
  ): Promise<{ txHash: `0x${string}`; lpTokens: bigint }> {
    logger.info(
      'Adding liquidity',
      {
        tokenAmount: formatUnits(tokenAmount, 18),
        ethAmount: formatEther(ethAmount),
      },
      'LiquidityPool',
    )

    // Approve token spend
    const currentAllowance = await this.publicClient.readContract({
      address: this.config.tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [this.account.address, this.config.xlpRouterAddress],
    })

    if (currentAllowance < tokenAmount) {
      const approveTx = await this.walletClient.writeContract({
        address: this.config.tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [this.config.xlpRouterAddress, tokenAmount],
        chain: this.chain,
        account: this.account,
      })
      await this.publicClient.waitForTransactionReceipt({ hash: approveTx })
    }

    // Calculate minimum amounts with slippage
    const minTokenAmount =
      (tokenAmount * (10000n - BigInt(slippageBps))) / 10000n
    const minEthAmount = (ethAmount * (10000n - BigInt(slippageBps))) / 10000n

    const deadline = Math.floor(Date.now() / 1000) + 3600 // 1 hour deadline

    // Add liquidity
    const txHash = await this.walletClient.writeContract({
      address: this.config.xlpRouterAddress,
      abi: XLP_ROUTER_ABI,
      functionName: 'addLiquidityETH',
      args: [
        this.config.tokenAddress,
        tokenAmount,
        minTokenAmount,
        minEthAmount,
        this.account.address,
        BigInt(deadline),
      ],
      value: ethAmount,
      chain: this.chain,
      account: this.account,
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    })

    // Get LP token balance after adding liquidity
    const pairAddress = await this.getPairAddress()
    const lpBalance = await this.publicClient.readContract({
      address: pairAddress,
      abi: XLP_V2_PAIR_ABI,
      functionName: 'balanceOf',
      args: [this.account.address],
    })

    logger.info(
      'Liquidity added successfully',
      {
        txHash,
        lpTokens: formatUnits(lpBalance, 18),
        gasUsed: receipt.gasUsed.toString(),
      },
      'LiquidityPool',
    )

    return { txHash, lpTokens: lpBalance }
  }

  async removeLiquidity(
    lpTokens: bigint,
    _slippageBps = 100, // Unused for now, would be used for min amounts calculation
  ): Promise<{
    txHash: `0x${string}`
    tokenAmount: bigint
    ethAmount: bigint
  }> {
    const pairAddress = await this.getPairAddress()

    // Approve LP token spend
    const approveTx = await this.walletClient.writeContract({
      address: pairAddress,
      abi: XLP_V2_PAIR_ABI,
      functionName: 'approve',
      args: [this.config.xlpRouterAddress, lpTokens],
      chain: this.chain,
      account: this.account,
    })
    await this.publicClient.waitForTransactionReceipt({ hash: approveTx })

    const deadline = Math.floor(Date.now() / 1000) + 3600

    // Remove liquidity (set min amounts to 0 for simplicity, in production calculate from reserves)
    const txHash = await this.walletClient.writeContract({
      address: this.config.xlpRouterAddress,
      abi: XLP_ROUTER_ABI,
      functionName: 'removeLiquidityETH',
      args: [
        this.config.tokenAddress,
        lpTokens,
        0n, // amountTokenMin
        0n, // amountETHMin
        this.account.address,
        BigInt(deadline),
      ],
      chain: this.chain,
      account: this.account,
    })

    await this.publicClient.waitForTransactionReceipt({ hash: txHash })

    logger.info(
      'Liquidity removed',
      { txHash, lpTokens: formatUnits(lpTokens, 18) },
      'LiquidityPool',
    )

    return { txHash, tokenAmount: 0n, ethAmount: 0n } // Would need to parse events for actual amounts
  }

  // ===========================================================================
  // LP TOKEN LOCKING
  // ===========================================================================

  async lockLPTokens(
    lpAmount: bigint,
    durationSeconds: number,
    beneficiary: Address,
    permanent: boolean = false,
  ): Promise<{ txHash: `0x${string}`; lockId: bigint }> {
    const pairAddress = await this.getPairAddress()

    logger.info(
      'Locking LP tokens',
      {
        lpAmount: formatUnits(lpAmount, 18),
        duration: durationSeconds,
        beneficiary,
        permanent,
      },
      'LiquidityPool',
    )

    // Approve LP tokens for locker
    const approveTx = await this.walletClient.writeContract({
      address: pairAddress,
      abi: XLP_V2_PAIR_ABI,
      functionName: 'approve',
      args: [this.config.lpLockerAddress, lpAmount],
      chain: this.chain,
      account: this.account,
    })
    await this.publicClient.waitForTransactionReceipt({ hash: approveTx })

    // Get permanent lock constant if needed
    let duration = BigInt(durationSeconds)
    if (permanent) {
      duration = await this.publicClient.readContract({
        address: this.config.lpLockerAddress,
        abi: LP_LOCKER_ABI,
        functionName: 'PERMANENT_LOCK',
      })
    }

    // Lock LP tokens
    const txHash = await this.walletClient.writeContract({
      address: this.config.lpLockerAddress,
      abi: LP_LOCKER_ABI,
      functionName: 'lock',
      args: [pairAddress, lpAmount, duration, beneficiary],
      chain: this.chain,
      account: this.account,
    })

    await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    })

    // Parse lockId from events (simplified - would need proper event parsing)
    const lockId = 0n // Would extract from Transfer event

    logger.info(
      'LP tokens locked successfully',
      { txHash, lockId: lockId.toString() },
      'LiquidityPool',
    )

    return { txHash, lockId }
  }

  async getLockedLPInfo(lockId: bigint): Promise<LockedLPInfo> {
    const lock = await this.publicClient.readContract({
      address: this.config.lpLockerAddress,
      abi: LP_LOCKER_ABI,
      functionName: 'getLock',
      args: [lockId],
    })

    const [_lpToken, amount, unlockTime, beneficiary, _withdrawn] = lock

    const permanentLock = await this.publicClient.readContract({
      address: this.config.lpLockerAddress,
      abi: LP_LOCKER_ABI,
      functionName: 'PERMANENT_LOCK',
    })

    return {
      lockId,
      lpAmount: amount,
      unlockTime: Number(unlockTime),
      beneficiary,
      isPermanent: unlockTime === permanentLock,
    }
  }

  async getLocksForAddress(address: Address): Promise<readonly bigint[]> {
    return this.publicClient.readContract({
      address: this.config.lpLockerAddress,
      abi: LP_LOCKER_ABI,
      functionName: 'getLocksForBeneficiary',
      args: [address],
    })
  }

  // ===========================================================================
  // POOL INFO
  // ===========================================================================

  async getPairAddress(): Promise<Address> {
    if (this.pairAddress && this.pairAddress !== zeroAddress) {
      return this.pairAddress
    }

    // If factory or token address is zero, no pair exists
    if (
      this.config.xlpV2FactoryAddress === zeroAddress ||
      this.config.tokenAddress === zeroAddress
    ) {
      return zeroAddress
    }

    const pairAddress = await this.publicClient.readContract({
      address: this.config.xlpV2FactoryAddress,
      abi: XLP_V2_FACTORY_ABI,
      functionName: 'getPair',
      args: [this.config.tokenAddress, this.config.wethAddress],
    })

    this.pairAddress = pairAddress
    return pairAddress
  }

  async getPoolInfo(): Promise<PoolInfo> {
    const pairAddress = await this.getPairAddress()

    if (pairAddress === zeroAddress) {
      return {
        pairAddress: zeroAddress,
        token0: zeroAddress,
        token1: zeroAddress,
        reserve0: 0n,
        reserve1: 0n,
        lpTotalSupply: 0n,
        price: 0,
      }
    }

    const [reserves, token0, token1, totalSupply] = await Promise.all([
      this.publicClient.readContract({
        address: pairAddress,
        abi: XLP_V2_PAIR_ABI,
        functionName: 'getReserves',
      }),
      this.publicClient.readContract({
        address: pairAddress,
        abi: XLP_V2_PAIR_ABI,
        functionName: 'token0',
      }),
      this.publicClient.readContract({
        address: pairAddress,
        abi: XLP_V2_PAIR_ABI,
        functionName: 'token1',
      }),
      this.publicClient.readContract({
        address: pairAddress,
        abi: XLP_V2_PAIR_ABI,
        functionName: 'totalSupply',
      }),
    ])

    const [reserve0, reserve1] = reserves

    // Calculate price (BBLN in ETH terms)
    let price = 0
    if (reserve0 > 0n && reserve1 > 0n) {
      // If token0 is BBLN, price = reserve1 / reserve0
      // If token0 is WETH, price = reserve0 / reserve1
      const isToken0BBLN =
        token0.toLowerCase() === this.config.tokenAddress.toLowerCase()
      if (isToken0BBLN) {
        price = Number(reserve1) / Number(reserve0)
      } else {
        price = Number(reserve0) / Number(reserve1)
      }
    }

    return {
      pairAddress,
      token0,
      token1,
      reserve0,
      reserve1,
      lpTotalSupply: totalSupply,
      price,
    }
  }

  async getLPPosition(address: Address): Promise<LPPosition> {
    const pairAddress = await this.getPairAddress()

    if (pairAddress === zeroAddress) {
      return {
        lpBalance: 0n,
        token0Amount: 0n,
        token1Amount: 0n,
        shareOfPool: 0,
      }
    }

    const [lpBalance, totalSupply, reserves] = await Promise.all([
      this.publicClient.readContract({
        address: pairAddress,
        abi: XLP_V2_PAIR_ABI,
        functionName: 'balanceOf',
        args: [address],
      }),
      this.publicClient.readContract({
        address: pairAddress,
        abi: XLP_V2_PAIR_ABI,
        functionName: 'totalSupply',
      }),
      this.publicClient.readContract({
        address: pairAddress,
        abi: XLP_V2_PAIR_ABI,
        functionName: 'getReserves',
      }),
    ])

    const [reserve0Raw, reserve1Raw] = reserves
    const reserve0 = BigInt(reserve0Raw)
    const reserve1 = BigInt(reserve1Raw)

    const shareOfPool =
      totalSupply > 0n ? Number((lpBalance * 10000n) / totalSupply) : 0

    const token0Amount =
      totalSupply > 0n ? (reserve0 * lpBalance) / totalSupply : 0n
    const token1Amount =
      totalSupply > 0n ? (reserve1 * lpBalance) / totalSupply : 0n

    return {
      lpBalance,
      token0Amount,
      token1Amount,
      shareOfPool,
    }
  }

  // ===========================================================================
  // PRICE QUERIES
  // ===========================================================================

  async getTokenPrice(): Promise<{ priceInEth: number; priceInUsd: number }> {
    const poolInfo = await this.getPoolInfo()
    const ethUsdPrice = await this.getEthUsdPrice()

    return {
      priceInEth: poolInfo.price,
      priceInUsd: poolInfo.price * ethUsdPrice,
    }
  }

  /**
   * Get ETH/USD price from Chainlink oracle
   */
  async getEthUsdPrice(): Promise<number> {
    const feedAddress =
      this.config.ethUsdPriceFeedAddress ??
      CHAINLINK_ETH_USD_FEEDS[this.config.chainId]

    if (!feedAddress) {
      throw new Error(
        `No Chainlink ETH/USD price feed configured for chain ${this.config.chainId}`,
      )
    }

    const [roundData, decimals] = await Promise.all([
      this.publicClient.readContract({
        address: feedAddress,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'latestRoundData',
      }),
      this.publicClient.readContract({
        address: feedAddress,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'decimals',
      }),
    ])

    const price = Number(roundData[1]) / 10 ** decimals
    return price
  }

  async getQuote(amountIn: bigint, tokenIn: 'bbln' | 'eth'): Promise<bigint> {
    const path =
      tokenIn === 'eth'
        ? [this.config.wethAddress, this.config.tokenAddress]
        : [this.config.tokenAddress, this.config.wethAddress]

    const amounts = await this.publicClient.readContract({
      address: this.config.xlpRouterAddress,
      abi: XLP_ROUTER_ABI,
      functionName: 'getAmountsOut',
      args: [amountIn, path],
    })

    const outputAmount = amounts[1]
    if (outputAmount === undefined) {
      throw new Error('Invalid quote: output amount not found')
    }
    return outputAmount
  }

  // ===========================================================================
  // INITIAL LIQUIDITY SETUP (For ICO)
  // ===========================================================================

  async setupInitialLiquidity(
    ethAmount: bigint,
    tokenAmount: bigint,
    lockPercentage: number = 100,
    lockDuration: number = 180 * 24 * 60 * 60, // 180 days
  ): Promise<{
    pairAddress: Address
    lpTokensReceived: bigint
    lpTokensLocked: bigint
    lockId: bigint
    txHashes: `0x${string}`[]
  }> {
    const txHashes: `0x${string}`[] = []

    logger.info(
      'Setting up initial liquidity',
      {
        ethAmount: formatEther(ethAmount),
        tokenAmount: formatUnits(tokenAmount, 18),
        lockPercentage,
        lockDuration,
      },
      'LiquidityPool',
    )

    // 1. Create pool if doesn't exist
    const pairAddress = await this.createPool()

    // 2. Add liquidity
    const { txHash: addLiqTx, lpTokens } = await this.addLiquidity(
      tokenAmount,
      ethAmount,
    )
    txHashes.push(addLiqTx)

    // 3. Lock LP tokens
    const lpToLock = (lpTokens * BigInt(lockPercentage)) / 100n
    let lockId = 0n

    if (lpToLock > 0n) {
      const { txHash: lockTx, lockId: newLockId } = await this.lockLPTokens(
        lpToLock,
        lockDuration,
        this.config.treasuryAddress,
        false, // Not permanent
      )
      txHashes.push(lockTx)
      lockId = newLockId
    }

    logger.info(
      'Initial liquidity setup complete',
      {
        pairAddress,
        lpTokensReceived: formatUnits(lpTokens, 18),
        lpTokensLocked: formatUnits(lpToLock, 18),
        lockId: lockId.toString(),
      },
      'LiquidityPool',
    )

    return {
      pairAddress,
      lpTokensReceived: lpTokens,
      lpTokensLocked: lpToLock,
      lockId,
      txHashes,
    }
  }

  // ===========================================================================
  // GETTERS
  // ===========================================================================

  getConfig(): LiquidityConfig {
    return { ...this.config }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let liquidityPoolService: LiquidityPoolService | null = null

export function getLiquidityPoolService(
  config?: Partial<LiquidityConfig>,
): LiquidityPoolService {
  if (!liquidityPoolService) {
    liquidityPoolService = new LiquidityPoolService(config)
  }
  return liquidityPoolService
}

export function resetLiquidityPoolService(): void {
  liquidityPoolService = null
}
