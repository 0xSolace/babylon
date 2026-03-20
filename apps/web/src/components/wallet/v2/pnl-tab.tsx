'use client';

import { cn, formatCurrency } from '@babylon/shared';
import { ChevronDown } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
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
        currentPnl: lifetimePnL + totalUnrealized,
        lifetimePnl: lifetimePnL,
        unrealized: totalUnrealized,
        isSelected: selectedEntity === 'Team',
      },
      {
        name: 'You',
        currentPnl: lifetimePnL + ownerUnrealized,
        lifetimePnl: lifetimePnL,
        unrealized: ownerUnrealized,
        isSelected: selectedEntity === 'You',
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

  useOnClickOutside(dropdownRef, () => {
    setEntityDropdownOpen(false);
  });

  const handleEntitySelect = useCallback((name: string) => {
    setSelectedEntity(name);
    setEntityDropdownOpen(false);
  }, []);

  const fmtPnl = (value: number) => {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}${formatCurrency(Math.abs(value), { useThousandsSeparator: true })}`;
  };

  if (loading) {
    return (
      <div className="space-y-3 md:space-y-4">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-[200px] animate-pulse rounded-xl bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // Find selected entity for the hero display
  const selected = entities.find((e) => e.isSelected) ?? entities[0];

  return (
    <div className="space-y-3 md:space-y-5">
      {/* Header: entity selector + time filters */}
      <div className="flex items-center justify-between">
        <div className="relative" ref={dropdownRef}>
          <button
            className="flex items-center gap-1.5 font-semibold text-base"
            onClick={() => setEntityDropdownOpen((prev) => !prev)}
          >
            {selectedEntity}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {entityDropdownOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-border bg-background shadow-lg">
              {entities.map((entity) => (
                <button
                  key={entity.name}
                  onClick={() => handleEntitySelect(entity.name)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm transition-colors',
                    entity.name === selectedEntity
                      ? 'bg-muted font-medium'
                      : 'hover:bg-muted/50'
                  )}
                >
                  {entity.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {timeFilters.map((time) => (
            <button
              key={time}
              onClick={() => setSelectedTime(time)}
              className={`rounded-md px-2.5 py-1 font-medium text-xs transition-colors ${
                selectedTime === time
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      {/* Selected entity P&L summary */}
      {selected && (
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3 md:gap-3">
          <div className="rounded-xl border border-border px-3 py-2.5 md:p-4">
            <div className="mb-1 text-muted-foreground text-xs tracking-wide">
              Current
            </div>
            <div
              className={cn(
                'font-semibold text-sm md:text-base',
                selected.currentPnl >= 0 ? 'text-emerald-500' : 'text-red-500'
              )}
            >
              {fmtPnl(selected.currentPnl)}
            </div>
          </div>
          <div className="rounded-xl border border-border px-3 py-2.5 md:p-4">
            <div className="mb-1 text-muted-foreground text-xs tracking-wide">
              Lifetime
            </div>
            <div
              className={cn(
                'font-semibold text-sm md:text-base',
                selected.lifetimePnl >= 0 ? 'text-emerald-500' : 'text-red-500'
              )}
            >
              {fmtPnl(selected.lifetimePnl)}
            </div>
          </div>
          <div className="rounded-xl border border-border px-3 py-2.5 md:p-4">
            <div className="mb-1 text-muted-foreground text-xs tracking-wide">
              Unrealized
            </div>
            <div
              className={cn(
                'font-semibold text-sm md:text-base',
                selected.unrealized >= 0 ? 'text-emerald-500' : 'text-red-500'
              )}
            >
              {fmtPnl(selected.unrealized)}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="rounded-xl border border-border p-2 md:p-3">
        <PnLChart userId={userId} timeframe={selectedTime} />
      </div>

      {/* Members */}
      <div>
        <div className="mb-2 text-muted-foreground text-xs tracking-wide md:mb-3">
          Members
        </div>
        <div className="space-y-1.5 md:space-y-2">
          {entities.map((row) => (
            <button
              key={row.name}
              type="button"
              onClick={() => handleEntitySelect(row.name)}
              className={cn(
                'w-full rounded-xl border px-3 py-2.5 text-left transition-colors md:p-4',
                row.isSelected
                  ? 'border-[#1a365d]/40 bg-[#1a365d]/5'
                  : 'border-border hover:bg-muted/30'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{row.name}</span>
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground tracking-wide">
                      Current
                    </div>
                    <div
                      className={cn(
                        'font-medium text-xs',
                        row.currentPnl >= 0
                          ? 'text-emerald-500'
                          : 'text-red-500'
                      )}
                    >
                      {fmtPnl(row.currentPnl)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground tracking-wide">
                      Lifetime
                    </div>
                    <div
                      className={cn(
                        'font-medium text-xs',
                        row.lifetimePnl >= 0
                          ? 'text-emerald-500'
                          : 'text-red-500'
                      )}
                    >
                      {fmtPnl(row.lifetimePnl)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground tracking-wide">
                      Unreal.
                    </div>
                    <div
                      className={cn(
                        'font-medium text-xs',
                        row.unrealized >= 0
                          ? 'text-emerald-500'
                          : 'text-red-500'
                      )}
                    >
                      {fmtPnl(row.unrealized)}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
