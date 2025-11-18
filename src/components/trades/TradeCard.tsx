'use client';

import { Avatar } from '@/components/shared/Avatar';
import { cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight, Coins, Send, TrendingDown, TrendingUp } from 'lucide-react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useRouter } from 'next/navigation';

type TradeType = 'balance' | 'npc' | 'position' | 'perp' | 'transfer';

type BaseTrade = {
  type: TradeType;
  id: string;
  timestamp: Date | string;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    isActor: boolean;
  } | null;
};

interface BalanceTrade extends BaseTrade {
  type: 'balance';
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  transactionType: string;
  description: string | null;
  relatedId: string | null;
}

interface NPCTrade extends BaseTrade {
  type: 'npc';
  marketType: string;
  ticker: string | null;
  marketId: string | null;
  action: string;
  side: string | null;
  amount: number;
  price: number;
  sentiment: number | null;
  reason: string | null;
}

interface PositionTrade extends BaseTrade {
  type: 'position';
  market: {
    id: string;
    question: string;
    resolved: boolean;
    resolution: boolean | null;
  } | null;
  side: string;
  shares: string;
  avgPrice: string;
  createdAt: Date | string;
}

interface PerpTrade extends BaseTrade {
  type: 'perp';
  ticker: string;
  organization: {
    id: string;
    name: string;
    ticker: string;
  } | null;
  side: 'long' | 'short';
  entryPrice: string;
  currentPrice: string;
  size: string;
  leverage: number;
  unrealizedPnL: string;
  liquidationPrice: string;
  closedAt: Date | string | null;
}

interface TransferTrade extends BaseTrade {
  type: 'transfer';
  otherParty: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    isActor: boolean;
  } | null;
  amount: number;
  pointsBefore: number;
  pointsAfter: number;
  direction: 'sent' | 'received';
  message?: string;
}

export type Trade = BalanceTrade | NPCTrade | PositionTrade | PerpTrade | TransferTrade;

type TradeCardProps = {
  trade: Trade;
};

export function TradeCard({ trade }: TradeCardProps) {
  const router = useRouter();

  // Handle null user (should not happen, but be safe)
  if (!trade.user) return null;

  const displayName = trade.user.displayName || trade.user.username || 'Anonymous';

  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (Number.isNaN(num)) return '$0.00';
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/profile/${trade.user?.id}`);
  };

  const handleAssetClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (trade.type === 'npc') {
      if (trade.marketType === 'perp' && trade.ticker) {
        router.push(`/markets/perps/${trade.ticker}`);
      } else if (trade.marketType === 'prediction' && trade.marketId) {
        router.push(`/markets/predictions/${trade.marketId}`);
      }
    } else if (trade.type === 'position' && trade.market) {
      router.push(`/markets/predictions/${trade.market.id}`);
    } else if (trade.type === 'perp') {
      router.push(`/markets/perps/${trade.ticker}`);
    }
  };

  return (
    <div className="border-border border-b bg-card p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <button
          type="button"
          className="flex-shrink-0 cursor-pointer rounded-full bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={handleProfileClick}
          aria-label={`View ${displayName}'s profile`}
        >
          <Avatar src={trade.user.profileImageUrl || undefined} alt={displayName} size="sm" />
        </button>

        {/* Trade Content */}
        <div className="min-w-0 flex-1">
          {/* User Info */}
          <div className="mb-1 flex items-center gap-2">
            <button
              type="button"
              className="cursor-pointer truncate rounded bg-transparent p-0 text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              onClick={handleProfileClick}
            >
              {displayName}
            </button>
            {trade.user.isActor && (
              <span className="rounded bg-purple-500/20 px-2 py-0.5 text-purple-500 text-xs">
                NPC
              </span>
            )}
            <span className="text-muted-foreground text-xs">{formatTime(trade.timestamp)}</span>
          </div>

          {/* Trade Details */}
          {trade.type === 'balance' && (
            <BalanceTradeContent
              trade={trade}
              onAssetClick={handleAssetClick}
              formatCurrency={formatCurrency}
            />
          )}
          {trade.type === 'npc' && (
            <NPCTradeContent
              trade={trade}
              onAssetClick={handleAssetClick}
              formatCurrency={formatCurrency}
            />
          )}
          {trade.type === 'position' && (
            <PositionTradeContent
              trade={trade}
              onAssetClick={handleAssetClick}
              formatCurrency={formatCurrency}
            />
          )}
          {trade.type === 'perp' && (
            <PerpTradeContent
              trade={trade}
              onAssetClick={handleAssetClick}
              formatCurrency={formatCurrency}
            />
          )}
          {trade.type === 'transfer' && <TransferTradeContent trade={trade} router={router} />}
        </div>
      </div>
    </div>
  );
}

function BalanceTradeContent({
  trade,
  onAssetClick,
  formatCurrency,
}: {
  trade: BalanceTrade;
  onAssetClick: (e: React.MouseEvent) => void;
  formatCurrency: (value: string | number) => string;
}) {
  const amount = parseFloat(trade.amount);
  const isPositive = amount >= 0;
  const actionText = trade.transactionType.replace('_', ' ').toUpperCase();

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {isPositive ? (
          <ArrowUpRight className="h-4 w-4 text-green-500" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-red-500" />
        )}
        <span className="text-muted-foreground text-sm">{actionText}</span>
        <span
          className={cn('font-semibold text-base', isPositive ? 'text-green-600' : 'text-red-600')}
        >
          {isPositive ? '+' : ''}
          {formatCurrency(amount)}
        </span>
      </div>
      {trade.description && (
        <button
          type="button"
          className="line-clamp-2 cursor-pointer rounded bg-transparent p-0 text-left text-foreground text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={onAssetClick}
        >
          {trade.description}
        </button>
      )}
    </div>
  );
}

function NPCTradeContent({
  trade,
  onAssetClick,
  formatCurrency,
}: {
  trade: NPCTrade;
  onAssetClick: (e: React.MouseEvent) => void;
  formatCurrency: (value: string | number) => string;
}) {
  const isLong = trade.side === 'long' || trade.side === 'YES';
  const action = trade.action.toUpperCase();

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded px-2 py-1 font-medium text-xs',
            isLong ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
          )}
        >
          {action}
        </span>
        {trade.ticker && (
          <button
            type="button"
            className="cursor-pointer rounded bg-transparent p-0 text-left font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            onClick={onAssetClick}
          >
            {trade.ticker}
          </button>
        )}
        {trade.side && (
          <span className={cn('font-medium text-xs', isLong ? 'text-green-600' : 'text-red-600')}>
            {trade.side}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <span>Amount: {formatCurrency(trade.amount)}</span>
        <span>Price: {formatCurrency(trade.price)}</span>
      </div>
      {trade.reason && (
        <p className="line-clamp-2 text-muted-foreground text-xs italic">
          &quot;{trade.reason}&quot;
        </p>
      )}
    </div>
  );
}

function PositionTradeContent({
  trade,
  onAssetClick,
  formatCurrency,
}: {
  trade: PositionTrade;
  onAssetClick: (e: React.MouseEvent) => void;
  formatCurrency: (value: string | number) => string;
}) {
  const isYes = trade.side === 'YES';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded px-2 py-1 font-medium text-xs',
            isYes ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
          )}
        >
          {trade.side}
        </span>
        <span className="text-muted-foreground text-sm">Position</span>
      </div>
      {trade.market && (
        <button
          type="button"
          className="line-clamp-2 cursor-pointer rounded bg-transparent p-0 text-left font-medium text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={onAssetClick}
        >
          {trade.market.question}
        </button>
      )}
      <div className="flex items-center gap-3 text-muted-foreground text-xs">
        <span>Shares: {parseFloat(trade.shares).toFixed(2)}</span>
        <span>Avg Price: {formatCurrency(trade.avgPrice)}</span>
      </div>
    </div>
  );
}

function PerpTradeContent({
  trade,
  onAssetClick,
  formatCurrency,
}: {
  trade: PerpTrade;
  onAssetClick: (e: React.MouseEvent) => void;
  formatCurrency: (value: string | number) => string;
}) {
  const isLong = trade.side === 'long';
  const pnl = parseFloat(trade.unrealizedPnL);
  const isPnLPositive = pnl >= 0;
  const isClosed = trade.closedAt !== null;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {isLong ? (
          <TrendingUp className="h-4 w-4 text-green-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500" />
        )}
        <span
          className={cn(
            'rounded px-2 py-1 font-medium text-xs',
            isLong ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
          )}
        >
          {trade.side.toUpperCase()}
        </span>
        <button
          type="button"
          className="cursor-pointer rounded bg-transparent p-0 text-left font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={onAssetClick}
        >
          {trade.ticker}
        </button>
        <span className="text-muted-foreground text-xs">{trade.leverage}x</span>
        {isClosed && (
          <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground text-xs">CLOSED</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <span>Size: {formatCurrency(trade.size)}</span>
        <span>Entry: {formatCurrency(trade.entryPrice)}</span>
      </div>
      {!isClosed && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">PnL:</span>
          <span className={cn('font-semibold', isPnLPositive ? 'text-green-600' : 'text-red-600')}>
            {isPnLPositive ? '+' : ''}
            {formatCurrency(pnl)}
          </span>
        </div>
      )}
    </div>
  );
}

function TransferTradeContent({
  trade,
  router,
}: {
  trade: TransferTrade;
  router: AppRouterInstance;
}) {
  const isSent = trade.direction === 'sent';
  const otherPartyName = trade.otherParty?.displayName || trade.otherParty?.username || 'Unknown';

  const handleOtherPartyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (trade.otherParty) {
      router.push(`/profile/${trade.otherParty.id}`);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {isSent ? (
          <Send className="h-4 w-4 text-blue-500" />
        ) : (
          <Coins className="h-4 w-4 text-green-500" />
        )}
        <span className="text-muted-foreground text-sm">
          {isSent ? 'Sent points to' : 'Received points from'}
        </span>
        <button
          type="button"
          className="cursor-pointer rounded bg-transparent p-0 text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={handleOtherPartyClick}
        >
          {otherPartyName}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('font-semibold text-base', isSent ? 'text-red-600' : 'text-green-600')}>
          {isSent ? '-' : '+'}
          {Math.abs(trade.amount)} pts
        </span>
        <span className="text-muted-foreground text-xs">Balance: {trade.pointsAfter} pts</span>
      </div>
      {trade.message && (
        <p className="text-muted-foreground text-sm italic">&quot;{trade.message}&quot;</p>
      )}
    </div>
  );
}
