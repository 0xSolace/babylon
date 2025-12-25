import {
  type FeeStatsResponse,
  FeeStatsResponseSchema,
  type SystemStatsResponse,
  SystemStatsResponseSchema,
  type TokenStatsResponse,
  TokenStatsResponseSchema,
} from '@babylon/shared'
import { cn } from '@jejunetwork/shared'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Award,
  Brain,
  DollarSign,
  Shield,
  ShoppingCart,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { Skeleton } from '@/components/shared/Skeleton'

/**
 * Stats tab component for displaying comprehensive system statistics.
 *
 * Displays detailed system-wide statistics including user metrics, market
 * statistics, trading activity, social engagement, financial data, and
 * fee collection. Shows top users and recent signups.
 *
 * Features:
 * - User statistics (total, actors, real users, admins)
 * - Market statistics
 * - Trading activity metrics
 * - Social engagement metrics
 * - Financial statistics
 * - Fee collection breakdown
 * - Top users by balance/reputation
 * - Recent signups
 * - Loading states
 * - Error handling
 *
 * @returns Stats tab element
 */
export function StatsTab() {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<SystemStatsResponse>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()
      const validation = SystemStatsResponseSchema.safeParse(data)
      if (!validation.success) {
        throw new Error('Invalid system stats data structure')
      }
      return validation.data
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const { data: feeStats } = useQuery<FeeStatsResponse | null>({
    queryKey: ['admin', 'fees', 'platform'],
    queryFn: async () => {
      const response = await fetch('/api/admin/fees')
      if (!response.ok) return null
      const data = await response.json()
      const validation = FeeStatsResponseSchema.safeParse(data)
      if (validation.success) {
        return validation.data
      }
      return null
    },
    refetchInterval: 30000,
  })

  const { data: tokenStats } = useQuery<TokenStatsResponse | null>({
    queryKey: ['admin', 'stats', 'tokens'],
    queryFn: async () => {
      const response = await fetch('/api/stats/tokens?period=day&limit=50')
      if (!response.ok) return null
      const data = await response.json()
      const validation = TokenStatsResponseSchema.safeParse(data)
      if (validation.success) {
        return validation.data
      }
      return null
    },
    refetchInterval: 30000,
  })

  const formatCurrency = (value: string) => {
    const num = parseFloat(value)
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`
    return value.toLocaleString()
  }

  const StatItem = ({
    icon: Icon,
    label,
    value,
    color = 'primary',
  }: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string | number
    color?: 'primary' | 'green' | 'blue' | 'orange' | 'red' | 'purple'
  }) => {
    const colorClasses = {
      primary: 'text-primary',
      green: 'text-green-500',
      blue: 'text-blue-500',
      orange: 'text-orange-500',
      red: 'text-red-500',
      purple: 'text-purple-500',
    }

    return (
      <div className="flex items-center gap-3">
        <Icon className={cn('h-4 w-4 flex-shrink-0', colorClasses[color])} />
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground text-sm">{label}</div>
          <div className="font-bold text-xl">{value}</div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-full space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-8 text-center text-red-500">
        {error instanceof Error ? error.message : 'Failed to load statistics'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats - Cleaner, less boxy design */}
      <div className="rounded-lg border border-border bg-gradient-to-br from-card to-accent/20 p-6">
        <h2 className="mb-6 font-semibold text-lg text-muted-foreground uppercase tracking-wide">
          Platform Overview
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Users Column */}
          <div className="space-y-4">
            <StatItem
              icon={Users}
              label="Total Users"
              value={formatNumber(stats.users.total)}
              color="blue"
            />
            <StatItem
              icon={Activity}
              label="NPCs/Actors"
              value={formatNumber(stats.users.actors)}
              color="purple"
            />
            <StatItem
              icon={UserCheck}
              label="Real Users"
              value={formatNumber(stats.users.realUsers)}
              color="green"
            />
          </div>

          {/* Activity Column */}
          <div className="space-y-4">
            <StatItem
              icon={TrendingUp}
              label="Total Markets"
              value={formatNumber(stats.markets.total)}
              color="green"
            />
            <StatItem
              icon={ShoppingCart}
              label="Active Markets"
              value={formatNumber(stats.markets.active)}
              color="blue"
            />
            <StatItem
              icon={Activity}
              label="Positions"
              value={formatNumber(stats.markets.positions)}
              color="primary"
            />
          </div>

          {/* Financial Column */}
          <div className="space-y-4">
            <StatItem
              icon={DollarSign}
              label="Total Balance"
              value={formatCurrency(stats.financial.totalVirtualBalance)}
              color="green"
            />
            <StatItem
              icon={DollarSign}
              label="Deposited"
              value={formatCurrency(stats.financial.totalDeposited)}
              color="blue"
            />
            <StatItem
              icon={TrendingUp}
              label="Lifetime P&L"
              value={formatCurrency(stats.financial.totalLifetimePnL)}
              color={
                parseFloat(stats.financial.totalLifetimePnL) >= 0
                  ? 'green'
                  : 'red'
              }
            />
          </div>

          {/* Engagement Column */}
          <div className="space-y-4">
            <StatItem
              icon={Activity}
              label="Total Posts"
              value={formatNumber(stats.social.posts)}
              color="blue"
            />
            <StatItem
              icon={Activity}
              label="Comments"
              value={formatNumber(stats.social.comments)}
              color="green"
            />
            <StatItem
              icon={Award}
              label="Reactions"
              value={formatNumber(stats.social.reactions)}
              color="orange"
            />
          </div>
        </div>
      </div>

      {/* Fee Stats (if available) */}
      {feeStats && (
        <div className="rounded-lg border border-green-500/20 bg-gradient-to-br from-green-500/10 to-blue-500/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-lg text-muted-foreground uppercase tracking-wide">
              Trading Fees (0.1%)
            </h2>
            <DollarSign className="h-6 w-6 text-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Total Collected
              </div>
              <div className="font-bold text-2xl text-green-500">
                {formatCurrency(
                  feeStats.platformStats.totalFeesCollected.toString(),
                )}
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Platform Revenue
              </div>
              <div className="font-bold text-xl">
                {formatCurrency(
                  feeStats.platformStats.totalPlatformFees.toString(),
                )}
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Referral Payouts
              </div>
              <div className="font-bold text-xl">
                {formatCurrency(
                  feeStats.platformStats.totalReferrerFees.toString(),
                )}
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Trades with Fees
              </div>
              <div className="font-bold text-xl">
                {formatNumber(feeStats.platformStats.totalTrades)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Token Stats (LLM Usage) */}
      {tokenStats && tokenStats.summary.tickCount > 0 && (
        <div className="rounded-lg border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-lg text-muted-foreground uppercase tracking-wide">
              LLM Token Usage (24h)
            </h2>
            <Brain className="h-6 w-6 text-purple-500" />
          </div>

          {/* Summary Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Total Tokens
              </div>
              <div className="font-bold text-2xl text-purple-500">
                {formatNumber(tokenStats.summary.totalTokens)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Input Tokens
              </div>
              <div className="font-bold text-xl">
                {formatNumber(tokenStats.summary.totalInputTokens)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Output Tokens
              </div>
              <div className="font-bold text-xl">
                {formatNumber(tokenStats.summary.totalOutputTokens)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                LLM Calls
              </div>
              <div className="font-bold text-xl">
                {formatNumber(tokenStats.summary.totalCalls)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Est. Cost (USD)
              </div>
              <div className="font-bold text-green-500 text-xl">
                ${tokenStats.summary.estimatedTotalCostUSD.toFixed(4)}
              </div>
            </div>
          </div>

          {/* Per Tick Averages */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-md bg-background/50 p-3">
              <div className="mb-1 text-muted-foreground text-xs">
                Avg Calls/Tick
              </div>
              <div className="font-semibold">
                {formatNumber(tokenStats.summary.avgCallsPerTick)}
              </div>
            </div>
            <div className="rounded-md bg-background/50 p-3">
              <div className="mb-1 text-muted-foreground text-xs">
                Avg Input/Tick
              </div>
              <div className="font-semibold">
                {formatNumber(tokenStats.summary.avgInputTokensPerTick)}
              </div>
            </div>
            <div className="rounded-md bg-background/50 p-3">
              <div className="mb-1 text-muted-foreground text-xs">
                Avg Output/Tick
              </div>
              <div className="font-semibold">
                {formatNumber(tokenStats.summary.avgOutputTokensPerTick)}
              </div>
            </div>
            <div className="rounded-md bg-background/50 p-3">
              <div className="mb-1 text-muted-foreground text-xs">
                Ticks (24h)
              </div>
              <div className="font-semibold">
                {formatNumber(tokenStats.summary.tickCount)}
              </div>
            </div>
          </div>

          {/* By Model */}
          {tokenStats.byModel.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 font-medium text-muted-foreground text-sm">
                By Model
              </h3>
              <div className="space-y-2">
                {tokenStats.byModel.slice(0, 5).map((model) => (
                  <div
                    key={`${model.provider}-${model.model}`}
                    className="flex items-center justify-between rounded-md bg-background/50 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="font-mono text-sm">{model.model}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
                        {model.provider}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {formatNumber(model.callCount)} calls
                      </span>
                      <span className="font-medium">
                        {formatNumber(model.totalTokens)} tokens
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Prompt Type */}
          {tokenStats.byPromptType.length > 0 && (
            <div>
              <h3 className="mb-2 font-medium text-muted-foreground text-sm">
                By Prompt Type
              </h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {tokenStats.byPromptType.slice(0, 9).map((pt) => (
                  <div
                    key={pt.promptType}
                    className="flex items-center justify-between rounded-md bg-background/50 p-2"
                  >
                    <span className="truncate font-mono text-muted-foreground text-xs">
                      {pt.promptType}
                    </span>
                    <div className="ml-2 flex items-center gap-2 text-xs">
                      <span>{formatNumber(pt.callCount)}x</span>
                      <span className="font-medium">
                        {formatNumber(pt.totalTokens)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-muted-foreground text-sm">
              User Signups
            </h3>
            <UserCheck className="h-4 w-4 text-green-500" />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">Today</span>
              <span className="font-bold text-lg">
                {formatNumber(stats.users.signups.today)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">This Week</span>
              <span className="font-bold text-lg">
                {formatNumber(stats.users.signups.thisWeek)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">This Month</span>
              <span className="font-bold text-lg">
                {formatNumber(stats.users.signups.thisMonth)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-muted-foreground text-sm">
              Trading Activity
            </h3>
            <Activity className="h-4 w-4 text-purple-500" />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">NPC Trades</span>
              <span className="font-bold text-lg">
                {formatNumber(stats.trading.npcTrades)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">
                Balance Txns
              </span>
              <span className="font-bold text-lg">
                {formatNumber(stats.trading.balanceTransactions)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">
                Pool Deposits
              </span>
              <span className="font-bold text-lg">
                {formatNumber(stats.pools.deposits)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-muted-foreground text-sm">
              Moderation
            </h3>
            <Shield className="h-4 w-4 text-orange-500" />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">Admins</span>
              <span className="font-bold text-lg">
                {formatNumber(stats.users.admins)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">
                Banned Users
              </span>
              <span className="font-bold text-lg text-red-500">
                {formatNumber(stats.users.banned)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">Referrals</span>
              <span className="font-bold text-lg">
                {formatNumber(stats.engagement.referrals)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Users & Recent Signups */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top by Balance */}
        <div>
          <h2 className="mb-3 font-semibold text-lg text-muted-foreground uppercase tracking-wide">
            Top Users by Balance
          </h2>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {stats.topUsers.byBalance.map((user, index) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 transition-colors hover:bg-accent/50"
              >
                <div className="w-6 font-bold text-muted-foreground text-sm">
                  #{index + 1}
                </div>
                <Avatar
                  src={user.profileImageUrl}
                  alt={user.displayName || user.username || 'User'}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-sm">
                    {user.displayName || user.username || 'Anonymous'}
                  </div>
                  {user.username && user.displayName !== user.username && (
                    <div className="truncate text-muted-foreground text-xs">
                      @{user.username}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600 text-sm">
                    {formatCurrency(user.virtualBalance)}
                  </div>
                  <div
                    className={cn(
                      'text-xs',
                      parseFloat(user.lifetimePnL) >= 0
                        ? 'text-green-600'
                        : 'text-red-600',
                    )}
                  >
                    P&L: {formatCurrency(user.lifetimePnL)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Signups */}
        <div>
          <h2 className="mb-3 font-semibold text-lg text-muted-foreground uppercase tracking-wide">
            Recent Signups
          </h2>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {stats.recentSignups.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 transition-colors hover:bg-accent/50"
              >
                <Avatar
                  src={user.profileImageUrl}
                  alt={user.displayName || user.username || 'User'}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-sm">
                    {user.displayName || user.username || 'Anonymous'}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-1">
                  {user.onChainRegistered && (
                    <span className="rounded bg-green-500/20 px-2 py-0.5 text-green-500 text-xs">
                      On-chain
                    </span>
                  )}
                  {user.hasFarcaster && (
                    <span className="rounded bg-purple-500/20 px-2 py-0.5 text-purple-500 text-xs">
                      FC
                    </span>
                  )}
                  {user.hasTwitter && (
                    <span className="rounded bg-blue-500/20 px-2 py-0.5 text-blue-500 text-xs">
                      X
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
