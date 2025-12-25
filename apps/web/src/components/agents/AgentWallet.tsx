import { logger } from '@babylon/shared'
import { cn } from '@jejunetwork/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  History,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

/**
 * Transaction structure for agent wallet.
 */
interface Transaction {
  id: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  createdAt: string
}

interface TransactionsResponse {
  success: boolean
  transactions: Transaction[]
}

interface TransactionResult {
  message: string
}

interface TransactionError {
  error?: string
}

interface TradingBalanceResponse {
  success: boolean
  agentBalance: {
    tradingBalance: number
    lifetimePnL: number
  }
  userBalance: number
  transactions?: Transaction[]
}

/**
 * Agent wallet component for managing agent balances.
 *
 * Provides interface for:
 * - Ops Budget: Points used for AI operations like chat/tick (pointsBalance)
 * - Trading Balance: Points used for actual trades (virtualBalance)
 *
 * @param props - AgentWallet component props
 * @returns Agent wallet element
 */
interface AgentWalletProps {
  agent: {
    id: string
    name: string
    // Points balance (for operations)
    pointsBalance: number
    totalDeposited: number
    totalWithdrawn: number
    totalPointsSpent: number
    // Trading balance (for trades) - optional for backwards compat
    virtualBalance?: number
    lifetimePnL?: string
  }
  onUpdate: () => void
}

export function AgentWallet({ agent, onUpdate }: AgentWalletProps) {
  const { getAccessToken } = useAuth()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit')

  // Which wallet are we managing: 'ops' or 'trading'
  const [activeWallet, setActiveWallet] = useState<'trading' | 'ops'>('ops')

  // Fetch transactions
  const { data: pointsTransactions = [], isLoading } = useQuery({
    queryKey: ['agent', 'wallet', 'transactions', agent.id],
    queryFn: async (): Promise<Transaction[]> => {
      const token = await getAccessToken()
      if (!token) return []

      const res = await fetch(`/api/agents/${agent.id}/wallet`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        logger.error('Failed to fetch transactions', undefined, 'AgentWallet')
        return []
      }

      const data: TransactionsResponse = await res.json()
      return data.success && data.transactions ? data.transactions : []
    },
  })

  // Fetch trading balance
  const { data: tradingData } = useQuery({
    queryKey: ['agent', 'trading-balance', agent.id],
    queryFn: async (): Promise<TradingBalanceResponse | null> => {
      const token = await getAccessToken()
      if (!token) return null

      const res = await fetch(`/api/agents/${agent.id}/trading-balance`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) return null
      return res.json()
    },
  })

  const tradingBalance = {
    agentBalance:
      tradingData?.agentBalance?.tradingBalance ?? agent.virtualBalance ?? 1000,
    userBalance: tradingData?.userBalance ?? 0,
    lifetimePnL:
      tradingData?.agentBalance?.lifetimePnL ??
      parseFloat(agent.lifetimePnL ?? '0'),
  }

  const tradingTransactions = tradingData?.transactions ?? []

  // Transaction mutation
  const transactionMutation = useMutation({
    mutationFn: async ({
      action,
      amount,
    }: {
      action: 'deposit' | 'withdraw'
      amount: number
    }): Promise<TransactionResult> => {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      const endpoint =
        activeWallet === 'trading'
          ? `/api/agents/${agent.id}/trading-balance`
          : `/api/agents/${agent.id}/wallet`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, amount }),
      })

      if (!res.ok) {
        const error: TransactionError = await res.json()
        throw new Error(error.error || 'Transaction failed')
      }

      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message)
      setAmount('')
      queryClient.invalidateQueries({
        queryKey: ['agent', 'wallet', 'transactions', agent.id],
      })
      queryClient.invalidateQueries({
        queryKey: ['agent', 'trading-balance', agent.id],
      })
      onUpdate()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Transaction failed')
    },
  })

  const handleTransaction = async () => {
    const amountNum = parseFloat(amount)

    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (activeWallet === 'trading') {
      // Trading balance transfer
      if (action === 'deposit' && amountNum > tradingBalance.userBalance) {
        toast.error(
          `Insufficient balance. You have ${tradingBalance.userBalance.toFixed(2)} pts`,
        )
        return
      }
      if (action === 'withdraw' && amountNum > tradingBalance.agentBalance) {
        toast.error(
          `Insufficient agent trading balance. Agent has ${tradingBalance.agentBalance.toFixed(2)} pts`,
        )
        return
      }
    } else {
      // Ops budget transfer (also from trading balance)
      if (action === 'deposit' && amountNum > tradingBalance.userBalance) {
        toast.error(
          `Insufficient balance. You have ${tradingBalance.userBalance.toFixed(2)} pts`,
        )
        return
      }
      if (action === 'withdraw' && amountNum > agent.pointsBalance) {
        toast.error(
          `Insufficient agent ops budget. Agent has ${agent.pointsBalance.toFixed(2)} pts`,
        )
        return
      }
    }

    transactionMutation.mutate({ action, amount: amountNum })
  }

  const transactions =
    activeWallet === 'trading' ? tradingTransactions : pointsTransactions

  return (
    <div className="space-y-6">
      {/* Wallet Type Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveWallet('ops')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-all',
            activeWallet === 'ops'
              ? 'bg-[#0066FF] text-white'
              : 'bg-muted text-foreground hover:bg-muted/80',
          )}
        >
          <Zap className="h-4 w-4" />
          <span>Ops Budget</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveWallet('trading')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-all',
            activeWallet === 'trading'
              ? 'bg-emerald-600 text-white'
              : 'bg-muted text-foreground hover:bg-muted/80',
          )}
        >
          <Coins className="h-4 w-4" />
          <span>Trading Balance</span>
        </button>
      </div>

      {/* Balance Card */}
      {activeWallet === 'ops' ? (
        <div className="rounded-lg border border-[#0066FF]/30 bg-[#0066FF]/5 p-6">
          <div className="mb-2 flex items-center gap-2 text-[#0066FF] text-sm">
            <Zap className="h-4 w-4" />
            Agent Ops Budget
          </div>
          <div className="mb-4 font-bold text-3xl">
            {agent.pointsBalance.toFixed(2)} pts
          </div>
          <div className="space-y-1 text-muted-foreground text-sm">
            <div className="flex justify-between">
              <span>Total Deposited:</span>
              <span>{agent.totalDeposited.toFixed(2)} pts</span>
            </div>
            <div className="flex justify-between">
              <span>Total Withdrawn:</span>
              <span>{agent.totalWithdrawn.toFixed(2)} pts</span>
            </div>
            <div className="flex justify-between">
              <span>Total Spent:</span>
              <span>{agent.totalPointsSpent.toFixed(2)} pts</span>
            </div>
          </div>
          <p className="mt-3 text-muted-foreground text-xs">
            Used for AI operations (chat, autonomous actions)
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="mb-2 flex items-center gap-2 text-emerald-600 text-sm">
            <Coins className="h-4 w-4" />
            Agent Trading Balance
          </div>
          <div className="mb-4 font-bold text-3xl">
            {tradingBalance.agentBalance.toFixed(2)} pts
          </div>
          <div className="space-y-1 text-muted-foreground text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Lifetime P&L:
              </span>
              <span
                className={cn(
                  'font-medium',
                  tradingBalance.lifetimePnL >= 0
                    ? 'text-green-600'
                    : 'text-red-600',
                )}
              >
                {tradingBalance.lifetimePnL >= 0 ? '+' : ''}
                {tradingBalance.lifetimePnL.toFixed(2)} pts
              </span>
            </div>
          </div>
          <p className="mt-3 text-muted-foreground text-xs">
            Used for prediction market and perp trades
          </p>
        </div>
      )}

      {/* Transaction Form */}
      <div className="rounded-lg border border-border bg-card/50 p-4 backdrop-blur sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-lg">
            Transfer to{' '}
            {activeWallet === 'ops' ? 'Ops Budget' : 'Trading Balance'}
          </h3>
          <div className="text-right text-sm">
            <span className="text-muted-foreground">Your Balance: </span>
            <span className="font-medium">
              {tradingBalance.userBalance.toFixed(2)} pts
            </span>
          </div>
        </div>

        {/* Action Toggle */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAction('deposit')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg px-3 py-3 font-medium transition-all sm:px-4',
              action === 'deposit'
                ? activeWallet === 'ops'
                  ? 'bg-[#0066FF] text-primary-foreground'
                  : 'bg-emerald-600 text-white'
                : 'bg-muted text-foreground hover:bg-muted/80',
            )}
          >
            <ArrowDownToLine className="h-4 w-4 shrink-0" />
            <span>Deposit</span>
          </button>
          <button
            type="button"
            onClick={() => setAction('withdraw')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg px-3 py-3 font-medium transition-all sm:px-4',
              action === 'withdraw'
                ? activeWallet === 'ops'
                  ? 'bg-[#0066FF] text-primary-foreground'
                  : 'bg-emerald-600 text-white'
                : 'bg-muted text-foreground hover:bg-muted/80',
            )}
          >
            <ArrowUpFromLine className="h-4 w-4 shrink-0" />
            <span>Withdraw</span>
          </button>
        </div>

        {/* Amount input and submit */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount (pts)..."
            min={0.01}
            step={0.01}
            max={
              action === 'deposit'
                ? tradingBalance.userBalance
                : activeWallet === 'trading'
                  ? tradingBalance.agentBalance
                  : agent.pointsBalance
            }
            className="h-12 w-full text-base sm:h-10 sm:flex-1 sm:text-sm"
          />
          <button
            type="button"
            onClick={handleTransaction}
            disabled={transactionMutation.isPending || !amount}
            className={cn(
              'h-12 w-full rounded-lg px-6 font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-auto',
              activeWallet === 'ops'
                ? 'bg-[#0066FF] hover:bg-[#2952d9]'
                : 'bg-emerald-600 hover:bg-emerald-700',
            )}
          >
            {transactionMutation.isPending
              ? 'Processing...'
              : action === 'deposit'
                ? 'Deposit'
                : 'Withdraw'}
          </button>
        </div>

        <p className="mt-3 text-muted-foreground text-xs">
          {action === 'deposit'
            ? `Transfer pts from your balance to ${agent.name}'s ${activeWallet === 'ops' ? 'ops budget' : 'trading balance'}`
            : `Transfer pts from ${agent.name}'s ${activeWallet === 'ops' ? 'ops budget' : 'trading balance'} to your balance`}
        </p>
      </div>

      {/* Transaction History */}
      <div className="rounded-lg border border-border bg-card/50 p-6 backdrop-blur">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5" />
          <h3 className="font-semibold text-lg">
            {activeWallet === 'ops' ? 'Ops Budget' : 'Trading Balance'}{' '}
            Transaction History
          </h3>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading...
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No transactions yet
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-lg bg-muted/30 p-3 transition-all hover:bg-muted"
              >
                <div className="flex-1">
                  <div className="font-medium capitalize">
                    {tx.type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {tx.description}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {new Date(tx.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={cn(
                      'font-semibold',
                      tx.amount > 0 ? 'text-green-600' : 'text-red-600',
                    )}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {Math.abs(tx.amount).toFixed(2)} pts
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Balance: {tx.balanceAfter.toFixed(2)} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
