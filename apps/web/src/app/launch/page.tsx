/**
 * BBLN Token Launch Page
 *
 * CCA Auction for BBLN token sale
 */

import { BBLN_ADDRESSES, BBLN_PRESALE_ABI } from '@babylon/shared'
import { cn } from '@jejunetwork/shared'
import { ChevronDown, Gift, Rocket } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { formatEther, parseEther } from 'viem'
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { PageContainer } from '@/components/shared/PageContainer'
import { useAuth } from '@/hooks/useAuth'

type PresalePhase =
  | 'NOT_STARTED'
  | 'WHITELIST'
  | 'PUBLIC'
  | 'ENDED'
  | 'CLEARING'
  | 'DISTRIBUTION'
  | 'FAILED'
const PHASES: PresalePhase[] = [
  'NOT_STARTED',
  'WHITELIST',
  'PUBLIC',
  'ENDED',
  'CLEARING',
  'DISTRIBUTION',
  'FAILED',
]

export default function LaunchPage() {
  const { authenticated, login } = useAuth()
  const { address, chain } = useAccount()
  const [amount, setAmount] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    mins: 0,
    secs: 0,
  })
  const [showFaq, setShowFaq] = useState<number | null>(null)

  const isMainnet = chain?.id === 1
  const isSepolia = chain?.id === 11155111
  const presaleAddress = isMainnet
    ? BBLN_ADDRESSES.mainnet.presale
    : BBLN_ADDRESSES.sepolia.presale
  const isDeployed =
    presaleAddress !== '0x0000000000000000000000000000000000000000'

  const explorerUrl = isMainnet
    ? 'https://etherscan.io'
    : isSepolia
      ? 'https://sepolia.etherscan.io'
      : null

  // Read presale stats
  const { data: statsData, refetch: refetchStats } = useReadContract({
    address: presaleAddress as `0x${string}`,
    abi: BBLN_PRESALE_ABI,
    functionName: 'getPresaleStats',
    query: {
      enabled: isDeployed,
      refetchInterval: 10000,
    },
  })

  const stats = useMemo(() => {
    if (statsData) {
      return {
        raised: statsData[0] as bigint,
        participants: Number(statsData[1]),
        tokensSold: statsData[2] as bigint,
        softCap: statsData[3] as bigint,
        hardCap: statsData[4] as bigint,
        currentPrice: statsData[5] as bigint,
        phase: PHASES[Number(statsData[6])] ?? 'NOT_STARTED',
      }
    }
    return {
      raised: 0n,
      participants: 0,
      tokensSold: 0n,
      softCap: 0n,
      hardCap: 0n,
      currentPrice: 0n,
      phase: 'NOT_STARTED' as PresalePhase,
    }
  }, [statsData])

  // Read user contribution
  const { data: contributionData } = useReadContract({
    address: presaleAddress as `0x${string}`,
    abi: BBLN_PRESALE_ABI,
    functionName: 'getContribution',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    query: {
      enabled: isDeployed && !!address,
      refetchInterval: 10000,
    },
  })

  const contribution = useMemo(() => {
    if (contributionData) {
      return {
        ethAmount: contributionData[0] as bigint,
        tokenAllocation: contributionData[1] as bigint,
        bonusTokens: contributionData[2] as bigint,
        claimable: contributionData[4] as bigint,
        claimed: contributionData[6] as boolean,
      }
    }
    return null
  }, [contributionData])

  // Preview allocation
  const { data: previewData } = useReadContract({
    address: presaleAddress as `0x${string}`,
    abi: BBLN_PRESALE_ABI,
    functionName: 'previewAllocation',
    args: [amount ? parseEther(amount) : 0n, false, false],
    query: {
      enabled: isDeployed && !!amount && parseFloat(amount) > 0,
    },
  })

  // Write contract
  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  useEffect(() => {
    if (isSuccess) {
      toast.success('Contribution successful!', {
        description: 'Your BBLN tokens will be claimable at TGE',
        action:
          explorerUrl && txHash
            ? {
                label: 'View TX',
                onClick: () =>
                  window.open(`${explorerUrl}/tx/${txHash}`, '_blank'),
              }
            : undefined,
      })
      setAmount('')
      setMaxPrice('')
      refetchStats()
    }
  }, [isSuccess, txHash, explorerUrl, refetchStats])

  // Read presale config for timeline
  const { data: configData } = useReadContract({
    address: presaleAddress as `0x${string}`,
    abi: [
      {
        name: 'config',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
          { name: 'mode', type: 'uint8' },
          { name: 'totalTokens', type: 'uint256' },
          { name: 'softCap', type: 'uint256' },
          { name: 'hardCap', type: 'uint256' },
          { name: 'minContribution', type: 'uint256' },
          { name: 'maxContribution', type: 'uint256' },
          { name: 'tokenPrice', type: 'uint256' },
          { name: 'startPrice', type: 'uint256' },
          { name: 'reservePrice', type: 'uint256' },
          { name: 'priceDecayPerBlock', type: 'uint256' },
          { name: 'whitelistStart', type: 'uint256' },
          { name: 'publicStart', type: 'uint256' },
          { name: 'presaleEnd', type: 'uint256' },
          { name: 'tgeTimestamp', type: 'uint256' },
        ],
      },
    ] as const,
    functionName: 'config',
    query: { enabled: isDeployed },
  })

  const presaleEnd = configData ? Number(configData[12]) * 1000 : 0

  // Countdown timer - uses contract data
  useEffect(() => {
    if (!presaleEnd) {
      setCountdown({ days: 0, hours: 0, mins: 0, secs: 0 })
      return
    }
    const timer = setInterval(() => {
      const diff = Math.max(0, presaleEnd - Date.now())
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [presaleEnd])

  const handleContribute = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (maxPrice && parseFloat(maxPrice) > 0) {
      writeContract({
        address: presaleAddress as `0x${string}`,
        abi: BBLN_PRESALE_ABI,
        functionName: 'contributeWithMaxPrice',
        args: [parseEther(maxPrice)],
        value: parseEther(amount),
      })
    } else {
      writeContract({
        address: presaleAddress as `0x${string}`,
        abi: BBLN_PRESALE_ABI,
        functionName: 'contribute',
        value: parseEther(amount),
      })
    }
  }

  const handleClaim = () => {
    writeContract({
      address: presaleAddress as `0x${string}`,
      abi: BBLN_PRESALE_ABI,
      functionName: 'claim',
    })
  }

  const formatTokens = (wei: bigint) => {
    const tokens = Number(wei) / 1e18
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(2)}K`
    return tokens.toFixed(2)
  }

  const progressPercent =
    stats.hardCap > 0n ? Number((stats.raised * 100n) / stats.hardCap) : 0

  const faqs = [
    {
      q: 'What is a CCA auction?',
      a: 'Continuous Clearing Auction is a fair price discovery mechanism. Price decreases over time, and all successful bidders pay the same final clearing price.',
    },
    {
      q: 'When do I receive my tokens?',
      a: 'BBLN tokens from the public sale are 100% liquid at TGE (Token Generation Event). You can claim immediately after the auction ends.',
    },
    {
      q: 'How does the ELIZA bonus work?',
      a: 'Hold ELIZA OS tokens to receive a 1.5x allocation multiplier on your BBLN purchase.',
    },
    {
      q: 'What if my max price is below the clearing price?',
      a: 'If you set a max price and the clearing price ends up higher, your ETH will be fully refunded.',
    },
  ]

  if (!authenticated) {
    return (
      <PageContainer>
        <div className="flex min-h-[80vh] flex-col items-center justify-center space-y-8 p-4">
          <div className="space-y-4 text-center">
            <Rocket className="mx-auto h-20 w-20 text-amber-500" />
            <h1 className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text font-bold text-4xl text-transparent md:text-5xl">
              Babylon Token Sale
            </h1>
            <p className="mx-auto max-w-lg text-lg text-muted-foreground">
              100M BBLN tokens via Continuous Clearing Auction.
              <br />
              Fair price discovery. ELIZA holder bonus. Instant liquidity at
              TGE.
            </p>
          </div>
          <button
            type="button"
            onClick={login}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 font-bold text-lg text-white transition-all hover:from-amber-600 hover:to-orange-600"
          >
            Connect Wallet to Participate
          </button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="min-h-screen bg-gradient-to-b from-amber-950/20 via-background to-orange-950/20">
        {/* Hero */}
        <section className="space-y-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-amber-400 text-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            {stats.phase === 'PUBLIC'
              ? 'CCA Auction Live'
              : stats.phase.replace('_', ' ')}
          </div>
          <h1 className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text font-bold text-4xl text-transparent md:text-5xl">
            Babylon Token Sale
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            100 million BBLN tokens available. Fair CCA auction. ELIZA holder
            bonus.
          </p>
        </section>

        <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Presale Card */}
            <div className="space-y-6 rounded-2xl border border-amber-500/30 bg-card/50 p-6 backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 font-bold text-2xl text-white">
                    B
                  </div>
                  <div>
                    <h2 className="font-bold text-xl">BBLN Token Sale</h2>
                    <p className="text-muted-foreground text-sm">
                      CCA Auction • 100M BBLN
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    'rounded-full px-3 py-1 font-medium text-xs',
                    stats.phase === 'PUBLIC'
                      ? 'bg-green-500/20 text-green-400'
                      : stats.phase === 'WHITELIST'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {stats.phase === 'PUBLIC'
                    ? 'Public Auction'
                    : stats.phase.replace('_', ' ')}
                </div>
              </div>

              {/* Countdown */}
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Days', value: countdown.days },
                  { label: 'Hours', value: countdown.hours },
                  { label: 'Mins', value: countdown.mins },
                  { label: 'Secs', value: countdown.secs },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-amber-950/30 p-3">
                    <div className="font-bold text-2xl">{value}</div>
                    <div className="text-muted-foreground text-xs">{label}</div>
                  </div>
                ))}
              </div>

              {/* Current Price */}
              <div className="rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">
                    Current Price
                  </span>
                  <span className="font-bold text-lg">
                    {formatEther(stats.currentPrice)} ETH
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground text-xs">
                  Price decreases over time
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Raised</span>
                  <span className="font-medium">
                    {formatEther(stats.raised)} ETH
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Participants</span>
                  <span className="font-medium">
                    {stats.participants.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tokens Sold</span>
                  <span className="font-medium">
                    {formatTokens(stats.tokensSold)} BBLN
                  </span>
                </div>

                {/* Progress */}
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span>{progressPercent.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                      style={{ width: `${Math.min(progressPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* User Contribution */}
              {contribution && contribution.ethAmount > 0n && (
                <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-950/20 p-4">
                  <h3 className="font-medium text-amber-300 text-sm">
                    Your Contribution
                  </h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Committed</span>
                    <span>{formatEther(contribution.ethAmount)} ETH</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Allocation</span>
                    <span>
                      {formatTokens(contribution.tokenAllocation)} BBLN
                    </span>
                  </div>
                  {contribution.bonusTokens > 0n && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bonus</span>
                      <span className="text-green-400">
                        +{formatTokens(contribution.bonusTokens)} BBLN
                      </span>
                    </div>
                  )}
                  {stats.phase === 'DISTRIBUTION' &&
                    !contribution.claimed &&
                    contribution.claimable > 0n && (
                      <button
                        type="button"
                        onClick={handleClaim}
                        disabled={isPending || isConfirming}
                        className="mt-4 w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-2 font-medium text-white hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
                      >
                        {isPending || isConfirming
                          ? 'Claiming...'
                          : 'Claim BBLN'}
                      </button>
                    )}
                </div>
              )}

              {/* Bid Form */}
              {(stats.phase === 'WHITELIST' || stats.phase === 'PUBLIC') && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="bid-amount"
                      className="mb-2 block text-muted-foreground text-sm"
                    >
                      Bid Amount (ETH)
                    </label>
                    <input
                      id="bid-amount"
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0"
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="max-price"
                      className="mb-2 block text-muted-foreground text-sm"
                    >
                      Max Price (optional)
                    </label>
                    <input
                      id="max-price"
                      type="number"
                      step="0.0001"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Leave empty to accept any price"
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {previewData && (previewData as bigint) > 0n && (
                    <div className="rounded-lg bg-amber-500/10 p-3 text-sm">
                      <span className="text-muted-foreground">
                        Estimated allocation:{' '}
                      </span>
                      <span className="font-medium">
                        {formatTokens(previewData as bigint)} BBLN
                      </span>
                    </div>
                  )}

                  {!isDeployed ? (
                    <div className="rounded-lg bg-muted p-4 text-center text-muted-foreground text-sm">
                      Sale not yet deployed - coming soon on{' '}
                      {isMainnet ? 'Mainnet' : 'Sepolia'}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleContribute}
                      disabled={isPending || isConfirming || !amount}
                      className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-bold text-white hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
                    >
                      {isPending || isConfirming
                        ? 'Processing...'
                        : 'Place Bid'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Info Panel */}
            <div className="space-y-6">
              {/* How CCA Works */}
              <div className="rounded-2xl border border-border bg-card/50 p-6 backdrop-blur">
                <h2 className="mb-4 font-bold text-xl">
                  How CCA Auction Works
                </h2>
                <ol className="space-y-3 text-muted-foreground text-sm">
                  {[
                    'Price starts high and decreases over time (reverse Dutch auction)',
                    'Place your bid with an optional maximum price limit',
                    'When auction ends, final clearing price is calculated',
                    'All successful bidders pay the same clearing price',
                    'Tokens distributed immediately - 100% liquid at TGE',
                  ].map((step, i) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-400 text-xs">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* ELIZA Bonus */}
              <div className="rounded-2xl border border-green-500/20 bg-green-950/10 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20">
                    <Gift className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="mb-2 font-bold text-green-400">
                      ELIZA Holder Bonus
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Hold ELIZA OS tokens to receive a 1.5x allocation bonus.
                      Early bird bidders get additional benefits.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tokenomics */}
              <div className="rounded-2xl border border-border bg-card/50 p-6 backdrop-blur">
                <h2 className="mb-4 font-bold text-xl">BBLN Tokenomics</h2>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Total Supply', value: '1,000,000,000 BBLN' },
                    { label: 'Public Sale', value: '10% (100M)' },
                    { label: 'Babylon Labs', value: '20% (4yr vest)' },
                    { label: 'Airdrop', value: '10%' },
                    { label: 'Liquidity', value: '10%' },
                    { label: 'Treasury', value: '50% (10yr unlock)' },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex justify-between border-border border-b pb-2"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cross-Chain */}
              <div className="rounded-2xl border border-border bg-card/50 p-6 backdrop-blur">
                <h2 className="mb-4 font-bold text-xl">Cross-Chain Ready</h2>
                <p className="mb-4 text-muted-foreground text-sm">
                  BBLN is deployed on Ethereum mainnet with native support for
                  bridging to:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Base',
                    'Arbitrum',
                    'Optimism',
                    'Polygon',
                    'Avalanche',
                    'BSC',
                    'Solana',
                  ].map((chain) => (
                    <span
                      key={chain}
                      className="rounded-full bg-muted px-3 py-1 text-xs"
                    >
                      {chain}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-center font-bold text-2xl">FAQ</h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div
                  key={faq.q}
                  className="overflow-hidden rounded-xl border border-border bg-card/50"
                >
                  <button
                    type="button"
                    onClick={() => setShowFaq(showFaq === i ? null : i)}
                    className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">{faq.q}</span>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 text-muted-foreground transition-transform',
                        showFaq === i && 'rotate-180',
                      )}
                    />
                  </button>
                  {showFaq === i && (
                    <div className="px-4 pb-4 text-muted-foreground text-sm">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
