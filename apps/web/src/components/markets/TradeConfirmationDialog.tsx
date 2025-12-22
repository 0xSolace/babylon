/**
 * TradeConfirmationDialog - Confirmation dialog for prediction market trades
 *
 * TODO: Implement trade confirmation UI
 */

'use client';

import type { ReactNode } from 'react';

/** Details for closing a perpetual position */
export interface ClosePerpDetails {
  type: 'close-perp';
  ticker: string;
  side: 'LONG' | 'SHORT';
  size: number;
  leverage: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

/** Details for selling a prediction position */
export interface SellPredictionDetails {
  type: 'sell-prediction';
  question: string;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  expectedValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export type TradeDetails = ClosePerpDetails | SellPredictionDetails | null;

export interface TradeConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  side?: 'YES' | 'NO';
  shares?: number;
  cost?: number;
  loading?: boolean;
  isSubmitting?: boolean;
  tradeDetails?: TradeDetails;
  children?: ReactNode;
}

export function TradeConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  side,
  shares,
  cost,
  loading,
  isSubmitting,
  tradeDetails,
}: TradeConfirmationDialogProps) {
  if (!open) return null;

  const isPending = loading || isSubmitting;

  // Render trade details based on type
  const renderDetails = () => {
    if (tradeDetails?.type === 'close-perp') {
      return (
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Position:</span>{' '}
            {tradeDetails.ticker} {tradeDetails.side}
          </p>
          <p>
            <span className="text-muted-foreground">Size:</span>{' '}
            {tradeDetails.size.toFixed(4)} @ {tradeDetails.leverage}x
          </p>
          <p>
            <span className="text-muted-foreground">Entry:</span> $
            {tradeDetails.entryPrice.toFixed(2)}
          </p>
          <p>
            <span className="text-muted-foreground">Current:</span> $
            {tradeDetails.currentPrice.toFixed(2)}
          </p>
          <p
            className={
              tradeDetails.unrealizedPnL >= 0
                ? 'text-green-500'
                : 'text-red-500'
            }
          >
            <span className="text-muted-foreground">PnL:</span> $
            {tradeDetails.unrealizedPnL.toFixed(2)} (
            {tradeDetails.unrealizedPnLPercent.toFixed(2)}%)
          </p>
        </div>
      );
    }

    if (tradeDetails?.type === 'sell-prediction') {
      return (
        <div className="space-y-2 text-sm">
          <p className="line-clamp-2">
            <span className="text-muted-foreground">Question:</span>{' '}
            {tradeDetails.question}
          </p>
          <p>
            <span className="text-muted-foreground">Position:</span>{' '}
            {tradeDetails.shares.toFixed(2)} {tradeDetails.side} shares
          </p>
          <p>
            <span className="text-muted-foreground">Avg Price:</span> $
            {tradeDetails.avgPrice.toFixed(4)}
          </p>
          <p>
            <span className="text-muted-foreground">Current:</span> $
            {tradeDetails.currentPrice.toFixed(4)}
          </p>
          <p>
            <span className="text-muted-foreground">Expected Value:</span> $
            {tradeDetails.expectedValue.toFixed(2)}
          </p>
          <p
            className={
              tradeDetails.unrealizedPnL >= 0
                ? 'text-green-500'
                : 'text-red-500'
            }
          >
            <span className="text-muted-foreground">PnL:</span> $
            {tradeDetails.unrealizedPnL.toFixed(2)} (
            {tradeDetails.unrealizedPnLPercent.toFixed(2)}%)
          </p>
        </div>
      );
    }

    // Legacy fallback for simple buy confirmation
    if (shares !== undefined && cost !== undefined && side) {
      return (
        <p className="text-muted-foreground">
          Buy {shares.toFixed(2)} {side} shares for ${cost.toFixed(2)}?
        </p>
      );
    }

    return null;
  };

  const getTitle = () => {
    if (tradeDetails?.type === 'close-perp') return 'Close Position';
    if (tradeDetails?.type === 'sell-prediction') return 'Sell Position';
    return 'Confirm Trade';
  };

  const getConfirmText = () => {
    if (isPending) return 'Processing...';
    if (tradeDetails?.type === 'close-perp') return 'Close Position';
    if (tradeDetails?.type === 'sell-prediction') return 'Sell';
    return 'Confirm';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-4 font-semibold text-lg">{getTitle()}</h2>
        <div className="mb-4">{renderDetails()}</div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded bg-muted px-4 py-2 font-medium"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded bg-primary px-4 py-2 font-medium text-primary-foreground"
            disabled={isPending}
          >
            {getConfirmText()}
          </button>
        </div>
      </div>
    </div>
  );
}
