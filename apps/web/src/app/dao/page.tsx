import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface DAOOverview {
  treasury: {
    ethBalance: string
    bblnBalance: string
    totalDistributed: string
  }
  revenue: {
    accumulated: string
    threshold: string
    totalReceived: string
    totalBuybacks: number
    bblnBought: string
    elizaBought: string
  }
  aiCEO: {
    address: string
    model: string
    isActive: boolean
    approvalRate: string
  }
}

interface BuybackRecord {
  id: string
  totalEthInput: string
  bblnBought: string | null
  elizaBought: string | null
  treasuryEth: string
  status: string
  txHash: string | null
  initiatedAt: string
  completedAt: string | null
}

interface DAOResponse {
  success: boolean
  overview: DAOOverview
}

interface BuybacksResponse {
  success: boolean
  buybacks: BuybackRecord[]
}

// =============================================================================
// COMPONENTS
// =============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-border">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{title}</p>
          <p className="mt-1 font-bold text-2xl">{value}</p>
          {subtitle && (
            <p className="mt-1 text-muted-foreground text-xs">{subtitle}</p>
          )}
        </div>
        <div
          className={`rounded-lg p-2 ${
            trend === 'up'
              ? 'bg-green-500/10 text-green-500'
              : trend === 'down'
                ? 'bg-red-500/10 text-red-500'
                : 'bg-primary/10 text-primary'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function AIChiefCard({
  aiCEO,
  loading,
}: {
  aiCEO: DAOOverview['aiCEO'] | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-3">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">AI CEO - Monkey King</h3>
          <p className="text-muted-foreground text-sm">
            Powered by {aiCEO?.model ?? 'Jeju Compute'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
              aiCEO?.isActive
                ? 'bg-green-500/10 text-green-500'
                : 'bg-yellow-500/10 text-yellow-500'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${aiCEO?.isActive ? 'bg-green-500' : 'bg-yellow-500'}`}
            />
            {aiCEO?.isActive ? 'Active' : 'Paused'}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-border/50 border-t pt-4">
        <div>
          <p className="text-muted-foreground text-xs">Approval Rate</p>
          <p className="font-semibold">{aiCEO?.approvalRate ?? '100%'}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Address</p>
          <p className="truncate font-mono text-xs">
            {aiCEO?.address ?? '0x...'}
          </p>
        </div>
      </div>
    </div>
  )
}

function BuybacksTable({ buybacks }: { buybacks: BuybackRecord[] }) {
  if (buybacks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <RefreshCw className="h-12 w-12 text-muted-foreground/30" />
        <p className="mt-4 text-muted-foreground">No buybacks executed yet</p>
        <p className="text-muted-foreground/70 text-sm">
          Buybacks execute automatically when fee threshold is reached
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-border/50 border-b">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">
              Date
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">
              ETH Used
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">
              BBLN Bought
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">
              ELIZA Bought
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {buybacks.map((buyback) => (
            <tr key={buyback.id} className="hover:bg-muted/30">
              <td className="whitespace-nowrap px-4 py-3 text-sm">
                {new Date(buyback.initiatedAt).toLocaleDateString()}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-sm">
                {(Number(buyback.totalEthInput) / 1e18).toFixed(4)} ETH
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-sm">
                {buyback.bblnBought
                  ? (Number(buyback.bblnBought) / 1e18).toFixed(2)
                  : '-'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-sm">
                {buyback.elizaBought
                  ? (Number(buyback.elizaBought) / 1e18).toFixed(2)
                  : '-'}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                    buyback.status === 'completed'
                      ? 'bg-green-500/10 text-green-500'
                      : buyback.status === 'executing'
                        ? 'bg-yellow-500/10 text-yellow-500'
                        : 'bg-red-500/10 text-red-500'
                  }`}
                >
                  {buyback.status === 'completed' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : buyback.status === 'executing' ? (
                    <Clock className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  {buyback.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================================
// PAGE
// =============================================================================

export default function DAOPage() {
  const { data: daoData, isLoading: daoLoading } = useQuery({
    queryKey: ['dao', 'overview'],
    queryFn: async (): Promise<DAOOverview | null> => {
      const res = await fetch('/api/dao')
      if (!res.ok) throw new Error('Failed to fetch DAO data')
      const data = (await res.json()) as DAOResponse
      return data.success ? data.overview : null
    },
  })

  const { data: buybacksData, isLoading: buybacksLoading } = useQuery({
    queryKey: ['dao', 'buybacks'],
    queryFn: async (): Promise<BuybackRecord[]> => {
      const res = await fetch('/api/dao/buybacks')
      if (!res.ok) throw new Error('Failed to fetch buybacks')
      const data = (await res.json()) as BuybacksResponse
      return data.success ? data.buybacks : []
    },
  })

  const overview = daoData
  const buybacks = buybacksData
  const loading = daoLoading || buybacksLoading

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-2xl">Babylon AI DAO</h1>
            <p className="text-muted-foreground">
              Decentralized governance powered by AI CEO
            </p>
          </div>
        </div>
      </div>

      {/* AI CEO Status */}
      <div className="mb-8">
        <AIChiefCard aiCEO={overview?.aiCEO || null} loading={loading} />
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Treasury ETH"
          value={overview ? `${overview.treasury.ethBalance} ETH` : '0 ETH'}
          subtitle="Protocol reserves"
          icon={Wallet}
        />
        <StatCard
          title="Treasury BBLN"
          value={
            overview
              ? `${Number(overview.treasury.bblnBalance).toLocaleString()} BBLN`
              : '0 BBLN'
          }
          subtitle="Token reserves"
          icon={Coins}
        />
        <StatCard
          title="Total Revenue"
          value={overview ? `${overview.revenue.totalReceived} ETH` : '0 ETH'}
          subtitle="All-time fees collected"
          icon={TrendingUp}
          trend="up"
        />
        <StatCard
          title="Buybacks Executed"
          value={overview ? String(overview.revenue.totalBuybacks) : '0'}
          subtitle={
            overview
              ? `${overview.revenue.bblnBought} BBLN bought`
              : '0 BBLN bought'
          }
          icon={Activity}
        />
      </div>

      {/* Revenue Distribution */}
      <div className="mb-8 rounded-xl border border-border/50 bg-card p-6">
        <h2 className="mb-4 font-semibold text-lg">Revenue Distribution</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
              <span className="font-bold text-2xl text-blue-500">30%</span>
            </div>
            <p className="font-medium">BBLN Buyback</p>
            <p className="text-muted-foreground text-sm">
              {overview ? overview.revenue.bblnBought : '0'} BBLN bought
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
              <span className="font-bold text-2xl text-purple-500">20%</span>
            </div>
            <p className="font-medium">ELIZA Buyback</p>
            <p className="text-muted-foreground text-sm">
              {overview ? overview.revenue.elizaBought : '0'} ELIZA bought
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <span className="font-bold text-2xl text-green-500">50%</span>
            </div>
            <p className="font-medium">Treasury</p>
            <p className="text-muted-foreground text-sm">
              {overview ? overview.treasury.totalDistributed : '0'} ETH
              distributed
            </p>
          </div>
        </div>

        {/* Buyback Threshold */}
        <div className="mt-6 border-border/50 border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">
                Next Buyback Threshold
              </p>
              <p className="font-semibold">
                {overview ? overview.revenue.accumulated : '0'} /{' '}
                {overview ? overview.revenue.threshold : '1'} ETH
              </p>
            </div>
            <div className="mx-4 flex-1">
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{
                    width: overview
                      ? `${Math.min(
                          100,
                          (Number(overview.revenue.accumulated) /
                            Number(overview.revenue.threshold)) *
                            100,
                        )}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buyback History */}
      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Buyback History</h2>
          <a
            href="https://jejunetwork.org/explorer"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
          >
            View on Explorer <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <BuybacksTable buybacks={buybacks ?? []} />
      </div>

      {/* Governance Links */}
      <div className="mt-8 rounded-xl border border-border/50 border-dashed p-6 text-center">
        <h3 className="font-semibold">Powered by Jeju Network</h3>
        <p className="mb-4 text-muted-foreground text-sm">
          All DAO operations are on-chain and verifiable
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="https://jejunetwork.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Jeju Network <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://jejunetwork.org/governance"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Governance Portal <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
