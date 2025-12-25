import {
  type AdminBalanceTrade,
  type AdminNPCTrade,
  type AdminPositionTrade,
  type AdminTrade,
  AdminTradeSchema,
  type AdminTradeType,
} from '@babylon/shared'
import { cn } from '@jejunetwork/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Plus, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Avatar } from '@/components/shared/Avatar'
import { Skeleton } from '@/components/shared/Skeleton'

/** Type-safe form data getter for string values */
function getFormString(formData: FormData, name: string): string {
  const value = formData.get(name)
  if (typeof value !== 'string') return ''
  return value
}

/** Type-safe form data getter for optional string values */
function getFormStringOptional(
  formData: FormData,
  name: string,
): string | undefined {
  const value = formData.get(name)
  if (typeof value !== 'string' || value === '') return undefined
  return value
}

/** Type-safe form data getter for number values */
function getFormNumber(formData: FormData, name: string): number {
  const value = formData.get(name)
  if (typeof value !== 'string') return 0
  return parseFloat(value)
}

/** Type-safe form data getter for optional number values */
function getFormNumberOptional(
  formData: FormData,
  name: string,
): number | undefined {
  const value = formData.get(name)
  if (typeof value !== 'string' || value === '') return undefined
  return parseFloat(value)
}

/**
 * Trading feed tab component for viewing and creating trades.
 *
 * Displays a feed of all trades in the system with filtering by trade type.
 * Shows trade details and includes a form for creating test trades. Auto-refreshes
 * every 10 seconds. Used for admin testing and monitoring.
 *
 * Features:
 * - Trade feed display
 * - Trade type filtering
 * - Trade creation form
 * - Auto-refresh (10s interval)
 * - Loading states
 * - Error handling
 *
 * @returns Trading feed tab element
 */
export function TradingFeedTab() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | AdminTradeType>('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Show/hide form fields based on trade type
  useEffect(() => {
    const tradeTypeSelect = document.querySelector<HTMLSelectElement>(
      'select[name="tradeType"]',
    )
    const balanceFields = document.getElementById('balanceFields')
    const npcFields = document.getElementById('npcFields')

    const handleTradeTypeChange = () => {
      if (!tradeTypeSelect || !balanceFields || !npcFields) {
        throw new Error('Trade form elements not found')
      }

      if (tradeTypeSelect.value === 'balance') {
        balanceFields.classList.remove('hidden')
        npcFields.classList.add('hidden')
        // Make balance fields required
        balanceFields
          .querySelectorAll('input[required], select[required]')
          .forEach((el) => {
            el.setAttribute('required', '')
          })
        // Remove required from NPC fields
        npcFields.querySelectorAll('input[required]').forEach((el) => {
          el.removeAttribute('required')
        })
      } else {
        balanceFields.classList.add('hidden')
        npcFields.classList.remove('hidden')
        // Remove required from balance fields
        balanceFields
          .querySelectorAll('input[required], select[required]')
          .forEach((el) => {
            el.removeAttribute('required')
          })
        // Make NPC fields required
        npcFields.querySelectorAll('input[required]').forEach((el) => {
          el.setAttribute('required', '')
        })
      }
    }

    if (tradeTypeSelect) {
      tradeTypeSelect.addEventListener('change', handleTradeTypeChange)
      // Set initial state
      handleTradeTypeChange()

      return () => {
        tradeTypeSelect.removeEventListener('change', handleTradeTypeChange)
      }
    }
    return undefined
  }, [])

  const {
    data: trades = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<AdminTrade[]>({
    queryKey: ['admin', 'trades', filter],
    queryFn: async () => {
      const url =
        filter === 'all'
          ? '/api/admin/trades?limit=50'
          : `/api/admin/trades?limit=50&type=${filter}`

      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch trades')
      const data = await response.json()
      const validation = z.array(AdminTradeSchema).safeParse(data.trades)
      if (!validation.success) {
        throw new Error('Invalid trade data structure')
      }
      return validation.data || []
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  const createTradeMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await fetch('/api/admin/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create trade')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('Trade created successfully')
      setShowCreateForm(false)
      setCreateError(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'trades'] })
    },
    onError: (error) => {
      setCreateError(
        error instanceof Error ? error.message : 'Failed to create trade',
      )
    },
  })

  const handleCreateTrade = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreateError(null)

    const formData = new FormData(e.currentTarget)
    const tradeType = getFormString(formData, 'tradeType')
    const payload: Record<string, unknown> = { type: tradeType }

    if (tradeType === 'balance') {
      payload.userId = getFormString(formData, 'userId')
      payload.transactionType = getFormString(formData, 'transactionType')
      payload.amount = getFormNumber(formData, 'amount')
      payload.description = getFormStringOptional(formData, 'description')
      payload.relatedId = getFormStringOptional(formData, 'relatedId')
      payload.updateBalance = formData.get('updateBalance') === 'true'
    } else if (tradeType === 'npc') {
      payload.npcActorId = getFormString(formData, 'npcActorId')
      payload.marketType = getFormString(formData, 'marketType')
      payload.ticker = getFormStringOptional(formData, 'ticker')
      payload.marketId = getFormStringOptional(formData, 'marketId')
      payload.action = getFormString(formData, 'action')
      payload.side = getFormStringOptional(formData, 'side')
      payload.amount = getFormNumber(formData, 'amount')
      payload.price = getFormNumber(formData, 'price')
      payload.sentiment = getFormNumberOptional(formData, 'sentiment')
      payload.reason = getFormStringOptional(formData, 'reason')
    }

    createTradeMutation.mutate(payload)
  }

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  const TradeCard = ({ trade }: { trade: AdminTrade }) => {
    // Handle null user (should not happen, but be safe)
    if (!trade.user) return null

    const displayName =
      trade.user.displayName || trade.user.username || 'Anonymous'

    return (
      <div className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
        <div className="flex items-start gap-3">
          <Avatar
            src={trade.user.profileImageUrl || undefined}
            alt={displayName}
            size="sm"
          />

          <div className="min-w-0 flex-1">
            {/* User Info */}
            <div className="mb-1 flex items-center gap-2">
              <span className="truncate font-medium">{displayName}</span>
              {trade.user.isActor && (
                <span className="rounded bg-purple-500/20 px-2 py-0.5 text-purple-500 text-xs">
                  NPC
                </span>
              )}
              <span className="text-muted-foreground text-xs">
                {formatTime(trade.timestamp)}
              </span>
            </div>

            {/* Trade Details */}
            {trade.type === 'balance' && <BalanceTradeDetails trade={trade} />}
            {trade.type === 'npc' && <NPCTradeDetails trade={trade} />}
            {trade.type === 'position' && (
              <PositionTradeDetails trade={trade} />
            )}
          </div>
        </div>
      </div>
    )
  }

  const BalanceTradeDetails = ({ trade }: { trade: AdminBalanceTrade }) => {
    const amount = parseFloat(trade.amount)
    const isPositive = amount >= 0

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded px-2 py-1 font-medium text-xs',
              isPositive
                ? 'bg-green-500/20 text-green-500'
                : 'bg-red-500/20 text-red-500',
            )}
          >
            {trade.transactionType}
          </span>
          <span
            className={cn(
              'font-bold text-lg',
              isPositive ? 'text-green-600' : 'text-red-600',
            )}
          >
            {isPositive ? '+' : ''}
            {formatCurrency(amount)}
          </span>
        </div>
        {trade.description && (
          <p className="text-muted-foreground text-sm">{trade.description}</p>
        )}
        <div className="text-muted-foreground text-xs">
          Balance: {formatCurrency(trade.balanceBefore)} →{' '}
          {formatCurrency(trade.balanceAfter)}
        </div>
      </div>
    )
  }

  const NPCTradeDetails = ({ trade }: { trade: AdminNPCTrade }) => {
    const isLong = trade.side === 'long' || trade.side === 'YES'

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded px-2 py-1 font-medium text-xs',
              isLong
                ? 'bg-green-500/20 text-green-500'
                : 'bg-red-500/20 text-red-500',
            )}
          >
            {trade.action.toUpperCase()}
          </span>
          {trade.ticker && <span className="font-bold">{trade.ticker}</span>}
          {trade.side && (
            <span
              className={cn(
                'font-medium text-xs',
                isLong ? 'text-green-600' : 'text-red-600',
              )}
            >
              {trade.side}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>Amount: {formatCurrency(trade.amount)}</span>
          <span>Price: {formatCurrency(trade.price)}</span>
          {trade.sentiment !== null && (
            <span
              className={cn(
                'text-xs',
                trade.sentiment > 0
                  ? 'text-green-600'
                  : trade.sentiment < 0
                    ? 'text-red-600'
                    : 'text-gray-600',
              )}
            >
              Sentiment: {trade.sentiment > 0 ? '+' : ''}
              {(trade.sentiment * 100).toFixed(0)}%
            </span>
          )}
        </div>
        {trade.reason && (
          <p className="text-muted-foreground text-xs italic">
            &quot;{trade.reason}&quot;
          </p>
        )}
      </div>
    )
  }

  const PositionTradeDetails = ({ trade }: { trade: AdminPositionTrade }) => {
    const isYes = trade.side === 'YES'

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded px-2 py-1 font-medium text-xs',
              isYes
                ? 'bg-green-500/20 text-green-500'
                : 'bg-red-500/20 text-red-500',
            )}
          >
            {trade.side}
          </span>
        </div>
        <p className="line-clamp-2 font-medium text-sm">
          {trade.market.question}
        </p>
        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <span>Shares: {trade.shares.toFixed(2)}</span>
          <span>Avg Cost: {formatCurrency(trade.avgCost)}</span>
        </div>
        {trade.market.resolved && (
          <div className="text-xs">
            <span className="text-muted-foreground">Resolved: </span>
            <span
              className={cn(
                'font-medium',
                trade.market.resolution ? 'text-green-600' : 'text-red-600',
              )}
            >
              {trade.market.resolution ? 'YES' : 'NO'}
            </span>
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-full space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'balance', 'npc', 'position'] as const).map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded px-3 py-1.5 font-medium text-sm transition-colors',
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {f === 'all'
                ? 'All'
                : f === 'balance'
                  ? 'Balance'
                  : f === 'npc'
                    ? 'NPC'
                    : 'Position'}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 rounded bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Trade
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded bg-muted px-3 py-1.5 font-medium text-sm transition-colors hover:bg-muted/80 disabled:opacity-50"
          >
            <RefreshCw
              className={cn('h-4 w-4', isFetching && 'animate-spin')}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Create Trade Form */}
      {showCreateForm && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-lg">Create Trade</h3>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false)
                setCreateError(null)
              }}
              className="rounded p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreateTrade} className="space-y-4">
            <div>
              <label
                htmlFor="trade-type-select"
                className="mb-1 block font-medium text-sm"
              >
                Trade Type
              </label>
              <select
                id="trade-type-select"
                name="tradeType"
                required
                className="w-full rounded-lg border border-border bg-muted px-3 py-2"
              >
                <option value="balance">Balance Transaction</option>
                <option value="npc">NPC Trade</option>
              </select>
            </div>

            {/* Balance Transaction Fields */}
            <div id="balanceFields" className="space-y-3">
              <div>
                <label
                  htmlFor="user-id-input"
                  className="mb-1 block font-medium text-sm"
                >
                  User ID
                </label>
                <input
                  id="user-id-input"
                  type="text"
                  name="userId"
                  required
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="User ID"
                />
              </div>
              <div>
                <label
                  htmlFor="transaction-type-select"
                  className="mb-1 block font-medium text-sm"
                >
                  Transaction Type
                </label>
                <select
                  id="transaction-type-select"
                  name="transactionType"
                  required
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                >
                  <option value="pred_buy">Prediction Buy</option>
                  <option value="pred_sell">Prediction Sell</option>
                  <option value="perp_open">Perp Open</option>
                  <option value="perp_close">Perp Close</option>
                  <option value="perp_liquidation">Perp Liquidation</option>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="amount-input"
                  className="mb-1 block font-medium text-sm"
                >
                  Amount
                </label>
                <input
                  id="amount-input"
                  type="number"
                  name="amount"
                  required
                  step="0.01"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label
                  htmlFor="description-input"
                  className="mb-1 block font-medium text-sm"
                >
                  Description (optional)
                </label>
                <input
                  id="description-input"
                  type="text"
                  name="description"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="Trade description"
                />
              </div>
              <div>
                <label
                  htmlFor="related-id-input"
                  className="mb-1 block font-medium text-sm"
                >
                  Related ID (optional)
                </label>
                <input
                  id="related-id-input"
                  type="text"
                  name="relatedId"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="Related entity ID"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="update-balance-checkbox"
                  type="checkbox"
                  name="updateBalance"
                  value="true"
                  defaultChecked
                  className="h-4 w-4"
                />
                <label htmlFor="update-balance-checkbox" className="text-sm">
                  Update user balance
                </label>
              </div>
            </div>

            {/* NPC Trade Fields */}
            <div id="npcFields" className="hidden space-y-3">
              <div>
                <label
                  htmlFor="npc-actor-id-input"
                  className="mb-1 block font-medium text-sm"
                >
                  NPC Actor ID
                </label>
                <input
                  id="npc-actor-id-input"
                  type="text"
                  name="npcActorId"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="Actor ID"
                />
              </div>
              <div>
                <label
                  htmlFor="market-type-select"
                  className="mb-1 block font-medium text-sm"
                >
                  Market Type
                </label>
                <select
                  id="market-type-select"
                  name="marketType"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                >
                  <option value="prediction">Prediction</option>
                  <option value="perp">Perpetual</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="ticker-input"
                  className="mb-1 block font-medium text-sm"
                >
                  Ticker (for perp)
                </label>
                <input
                  id="ticker-input"
                  type="text"
                  name="ticker"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="Ticker symbol"
                />
              </div>
              <div>
                <label
                  htmlFor="market-id-input"
                  className="mb-1 block font-medium text-sm"
                >
                  Market ID (for prediction)
                </label>
                <input
                  id="market-id-input"
                  type="text"
                  name="marketId"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="Market ID"
                />
              </div>
              <div>
                <label
                  htmlFor="action-input"
                  className="mb-1 block font-medium text-sm"
                >
                  Action
                </label>
                <input
                  id="action-input"
                  type="text"
                  name="action"
                  required
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="e.g., BUY, SELL"
                />
              </div>
              <div>
                <label
                  htmlFor="side-input"
                  className="mb-1 block font-medium text-sm"
                >
                  Side (optional)
                </label>
                <input
                  id="side-input"
                  type="text"
                  name="side"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="e.g., long, short, YES, NO"
                />
              </div>
              <div>
                <label
                  htmlFor="npc-amount-input"
                  className="mb-1 block font-medium text-sm"
                >
                  Amount
                </label>
                <input
                  id="npc-amount-input"
                  type="number"
                  name="amount"
                  required
                  step="0.01"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label
                  htmlFor="price-input"
                  className="mb-1 block font-medium text-sm"
                >
                  Price
                </label>
                <input
                  id="price-input"
                  type="number"
                  name="price"
                  required
                  step="0.01"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label
                  htmlFor="sentiment-input"
                  className="mb-1 block font-medium text-sm"
                >
                  Sentiment (optional)
                </label>
                <input
                  id="sentiment-input"
                  type="number"
                  name="sentiment"
                  step="0.01"
                  min="-1"
                  max="1"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="-1 to 1"
                />
              </div>
              <div>
                <label
                  htmlFor="reason-textarea"
                  className="mb-1 block font-medium text-sm"
                >
                  Reason (optional)
                </label>
                <textarea
                  id="reason-textarea"
                  name="reason"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2"
                  placeholder="Trade reasoning"
                />
              </div>
            </div>

            {createError && (
              <div className="rounded bg-red-500/10 p-2 text-red-500 text-sm">
                {createError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createTradeMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createTradeMutation.isPending ? 'Creating...' : 'Create Trade'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setCreateError(null)
                }}
                className="rounded-lg bg-muted px-4 py-2 text-foreground hover:bg-muted/80"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Trades List */}
      {trades.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Activity className="mx-auto mb-3 h-12 w-12 opacity-50" />
          <p>No trades found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} />
          ))}
        </div>
      )}
    </div>
  )
}
