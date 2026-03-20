'use client';

import { cn, formatCurrency } from '@babylon/shared';
import { ChevronDown, HelpCircle, Maximize2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useUserPositions } from '@/stores/userPositionsStore';
import { useWalletBalance } from '@/stores/walletBalanceStore';
import { PnLChart } from './pnl-chart';

interface PnLTabProps {
  userId: string;
}

interface EntityPnL {
  name: string;
  currentPnl: number;
  lifetimePnl: number;
  unrealized: number;
  isSelected?: boolean;
}

const timeFilters = ['1H', '4H', '1D', '1W', 'ALL'];

export function PnLTab({ userId }: PnLTabProps) {
  const [selectedTime, setSelectedTime] = useState('1D');
  const [selectedEntity, setSelectedEntity] = useState('Team');
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { lifetimePnL, loading: balanceLoading } = useWalletBalance(userId);
  const {
    perpPositions,
    predictionPositions,
    loading: positionsLoading,
  } = useUserPositions(userId);

  const loading = balanceLoading || positionsLoading;

  const entities = useMemo(() => {
    let ownerUnrealized = 0;
    const agentUnrealized = new Map<string, number>();

    for (const pos of perpPositions) {
      if (pos.isAgentPosition && pos.agentName) {
        agentUnrealized.set(
          pos.agentName,
          (agentUnrealized.get(pos.agentName) ?? 0) + pos.unrealizedPnL
        );
      } else {
        ownerUnrealized += pos.unrealizedPnL;
      }
    }

    for (const pos of predictionPositions) {
      const costBasis = pos.costBasis ?? pos.shares * pos.avgPrice;
      const currentValue = pos.currentValue ?? pos.shares * pos.currentPrice;
      const pnl = pos.unrealizedPnL ?? currentValue - costBasis;

      if (pos.isAgentPosition && pos.agentName) {
        agentUnrealized.set(
          pos.agentName,
          (agentUnrealized.get(pos.agentName) ?? 0) + pnl
        );
      } else {
        ownerUnrealized += pnl;
      }
    }

    const totalUnrealized =
      ownerUnrealized +
      Array.from(agentUnrealized.values()).reduce((s, v) => s + v, 0);

    const list: EntityPnL[] = [
      {
        name: 'Team',
        currentPnl: lifetimePnL,
        lifetimePnl: lifetimePnL,
        unrealized: totalUnrealized,
        isSelected: selectedEntity === 'Team',
      },
      {
        name: 'You (Owner)',
        currentPnl: lifetimePnL,
        lifetimePnl: lifetimePnL,
        unrealized: ownerUnrealized,
        isSelected: selectedEntity === 'You (Owner)',
      },
    ];

    for (const [agentName, unrealized] of agentUnrealized) {
      list.push({
        name: agentName,
        currentPnl: unrealized,
        lifetimePnl: unrealized,
        unrealized,
        isSelected: selectedEntity === agentName,
      });
    }

    return list;
  }, [perpPositions, predictionPositions, lifetimePnL, selectedEntity]);

  const handleEntitySelect = useCallback((name: string) => {
    setSelectedEntity(name);
    setEntityDropdownOpen(false);
  }, []);

  const fmtPnl = (value: number) => {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}${formatCurrency(Math.abs(value), { useThousandsSeparator: true })}`;
  };

  const fmtPercent = (value: number, base: number) => {
    if (base === 0) return '0.0%';
    const pct = (value / Math.abs(base)) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-[240px] animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="relative" ref={dropdownRef}>
          <button
            className="flex items-center gap-2 font-semibold text-lg"
            onClick={() => setEntityDropdownOpen((prev) => !prev)}
          >
            {selectedEntity}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {entityDropdownOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 min-w-[160px] rounded-md border border-border bg-background py-1 shadow-lg">
              {entities.map((entity) => (
                <button
                  key={entity.name}
                  onClick={() => handleEntitySelect(entity.name)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                    entity.name === selectedEntity && 'bg-muted font-medium'
                  )}
                >
                  {entity.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {timeFilters.map((time) => (
            <button
              key={time}
              onClick={() => setSelectedTime(time)}
              className={`rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
                selectedTime === time
                  ? 'bg-[#1a365d] text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {time}
            </button>
          ))}
          <button className="ml-1 p-1.5 text-muted-foreground hover:text-foreground">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button className="p-1.5 text-muted-foreground hover:text-foreground">
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <PnLChart userId={userId} timeframe={selectedTime} />

      {/* Table */}
      <div className="mt-6">
        <div className="grid grid-cols-4 gap-4 py-3 text-muted-foreground text-xs">
          <div>Entity</div>
          <div>Current P&L</div>
          <div>Lifetime P&L</div>
          <div>Unrealized</div>
        </div>
        {entities.map((row) => (
          <div
            key={row.name}
            className="grid grid-cols-4 items-start gap-4 border-border border-t py-4"
          >
            <div className="flex items-center gap-2">
              {row.isSelected && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#1a365d]" />
              )}
              <span className="font-medium text-sm">{row.name}</span>
            </div>
            <div>
              <div
                className={`font-medium text-sm ${
                  row.currentPnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {fmtPnl(row.currentPnl)}
              </div>
              <span
                className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-xs ${
                  row.currentPnl >= 0
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {fmtPercent(row.currentPnl, row.lifetimePnl || 1)}
              </span>
            </div>
            <div>
              <div
                className={`font-medium text-sm ${
                  row.lifetimePnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {fmtPnl(row.lifetimePnl)}
              </div>
              <span
                className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-xs ${
                  row.lifetimePnl >= 0
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {fmtPercent(row.lifetimePnl, row.lifetimePnl || 1)}
              </span>
            </div>
            <div>
              <div
                className={`font-medium text-sm ${
                  row.unrealized >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {fmtPnl(row.unrealized)}
              </div>
              <span
                className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-xs ${
                  row.unrealized >= 0
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {fmtPercent(row.unrealized, row.lifetimePnl || 1)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
