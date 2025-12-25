import { type FeeStatsResponse, FeeStatsResponseSchema } from '@babylon/shared'
import { cn } from '@jejunetwork/shared'
import { useQuery } from '@tanstack/react-query'
import { Award, DollarSign, RefreshCw, TrendingUp, Users } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { Skeleton } from '@/components/shared/Skeleton'

/**
 * Fees tab component for displaying fee collection statistics.
 *
 * Displays comprehensive fee statistics including platform fees, user fees,
 * NPC fees, referrer fees, and fee trends. Shows top fee payers, top referral
 * earners, and recent fees. Includes charts for fee trends over time.
 *
 * Features:
 * - Fee statistics dashboard
 * - Fee breakdown by type
 * - Top fee payers list
 * - Top referral earners list
 * - Recent fees list
 * - Fee trend charts
 * - Loading states
 * - Error handling
 *
 * @returns Fees tab element
 */
export function FeesTab() {
  const {
    data: stats,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<FeeStatsResponse>({
    queryKey: ['admin', 'fees'],
    queryFn: async () => {
      const response = await fetch('/api/admin/fees')
      if (!response.ok) {
        throw new Error('Failed to fetch fee statistics')
      }
      const data = await response.json()
      const validation = FeeStatsResponseSchema.safeParse(data)
      if (!validation.success) {
        throw new Error('Invalid data structure for fee statistics')
      }
      return validation.data
    },
  })

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
    return `$${value.toFixed(2)}`
  }

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`
    return value.toLocaleString()
  }

  const formatTradeType = (type: string) => {
    const typeMap: Record<string, string> = {
      pred_buy: 'Prediction Buy',
      pred_sell: 'Prediction Sell',
      perp_open: 'Perp Open',
      perp_close: 'Perp Close',
      npc_pred_buy: 'NPC Prediction Buy',
      npc_pred_sell: 'NPC Prediction Sell',
      npc_perp_open: 'NPC Perp Open',
      npc_perp_close: 'NPC Perp Close',
    }
    return typeMap[type] || type
  }

  const StatCard = ({
    icon: Icon,
    label,
    value,
    subtitle,
    color = 'primary',
  }: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string | number
    subtitle?: string
    color?: 'primary' | 'green' | 'blue' | 'orange' | 'purple'
  }) => {
    const colorClasses = {
      primary: 'text-primary',
      green: 'text-green-500',
      blue: 'text-blue-500',
      orange: 'text-orange-500',
      purple: 'text-purple-500',
    }

    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-3">
          <Icon className={cn('h-5 w-5', colorClasses[color])} />
          <span className="text-muted-foreground text-sm">{label}</span>
        </div>
        <div className="font-bold text-2xl">{value}</div>
        {subtitle && (
          <div className="mt-1 text-muted-foreground text-xs">{subtitle}</div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-8 text-center text-red-500">
        {error instanceof Error
          ? error.message
          : 'Failed to load fee statistics'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl">Fee Statistics</h2>
          <p className="text-muted-foreground text-sm">
            Platform-wide trading fee analytics
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Total Fees Collected"
          value={formatCurrency(stats.platformStats.totalFeesCollected)}
          subtitle={`${formatNumber(stats.platformStats.totalTrades)} trades`}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          label="Platform Revenue"
          value={formatCurrency(stats.platformStats.totalPlatformFees)}
          subtitle="50% of fees"
          color="blue"
        />
        <StatCard
          icon={Award}
          label="Referral Payouts"
          value={formatCurrency(stats.platformStats.totalReferrerFees)}
          subtitle="50% of fees"
          color="orange"
        />
        <StatCard
          icon={Users}
          label="Average Fee/Trade"
          value={formatCurrency(
            stats.platformStats.totalTrades > 0
              ? stats.platformStats.totalFeesCollected /
                  stats.platformStats.totalTrades
              : 0,
          )}
          subtitle="0.1% fee rate"
          color="purple"
        />
      </div>

      {/* Fee Trend Chart - Planned feature: Add feeTrend to FeeStatsResponse schema when historical data is available */}

      {/* Fee Breakdown by Type */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 font-semibold text-lg">Fees by Trade Type</h3>
        <div className="space-y-3">
          {stats.feesByType.map(
            (item: {
              tradeType: string
              totalFees: number
              platformFees: number
              referrerFees: number
              tradeCount: number
            }) => (
              <div
                key={item.tradeType}
                className="flex items-center justify-between rounded-lg bg-accent/20 p-3"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {formatTradeType(item.tradeType)}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {formatNumber(item.tradeCount)} trades
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-500">
                    {formatCurrency(item.totalFees)}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Platform: {formatCurrency(item.platformFees)}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Top Fee Payers & Referral Earners */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Fee Payers */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 font-semibold text-lg">Top Fee Payers</h3>
          <div className="space-y-3">
            {stats.topFeePayers.map(
              (
                user: {
                  userId: string
                  username: string
                  displayName: string
                  profileImageUrl: string | null
                  isNPC: boolean
                  totalFees: number
                  tradeCount: number
                },
                index: number,
              ) => (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent/50"
                >
                  <div className="w-6 font-bold text-muted-foreground text-sm">
                    #{index + 1}
                  </div>
                  <Avatar
                    src={user.profileImageUrl}
                    alt={user.displayName}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate font-medium text-sm">
                      {user.displayName}
                      {user.isNPC && (
                        <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-500 text-xs">
                          NPC
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatNumber(user.tradeCount)} trades
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-500 text-sm">
                      {formatCurrency(user.totalFees)}
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Top Referral Earners */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 font-semibold text-lg">Top Referral Earners</h3>
          <div className="space-y-3">
            {stats.topReferralEarners.length > 0 ? (
              stats.topReferralEarners.map((user, index) => (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent/50"
                >
                  <div className="w-6 font-bold text-muted-foreground text-sm">
                    #{index + 1}
                  </div>
                  <Avatar
                    src={user.profileImageUrl}
                    alt={user.displayName}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">
                      {user.displayName}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatNumber(user.referralCount)} referral trades
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-500 text-sm">
                      {formatCurrency(user.totalEarned)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No referral earnings yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Fee Transactions - Planned feature: Add recentFees to FeeStatsResponse schema when transaction logging is implemented */}
    </div>
  )
}
