'use client';

import { cn, formatCurrency } from '@babylon/shared';
import { ChevronDown } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  buildWalletPnLEntityRows,
  WALLET_PNL_TEAM_ENTITY_KEY,
} from '@/components/wallet/shared/pnlBreakdown';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import type { TeamTradingSummary } from '@/hooks/useTeamTradingSummary';
import { PnLChart } from './pnl-chart';

interface PnLTabProps {
  userId: string;
  teamSummary: TeamTradingSummary | null;
  teamSummaryLoading: boolean;
  teamSummaryError: string | null;
}

const timeFilters = ['1H', '4H', '1D', '1W', 'ALL'];

export function PnLTab({
  userId,
  teamSummary,
  teamSummaryLoading,
  teamSummaryError,
}: PnLTabProps) {
  const [selectedTime, setSelectedTime] = useState('1D');
  const [selectedEntityKey, setSelectedEntityKey] = useState(
    WALLET_PNL_TEAM_ENTITY_KEY
  );
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loading = teamSummaryLoading;

  const entities = useMemo(() => {
    if (!teamSummary) {
      return [];
    }

    return buildWalletPnLEntityRows(teamSummary);
  }, [teamSummary]);

  useOnClickOutside(dropdownRef, () => {
    setEntityDropdownOpen(false);
  });

  const handleEntitySelect = useCallback((entityKey: string) => {
    setSelectedEntityKey(entityKey);
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

  if (!teamSummary && teamSummaryError) {
    return (
      <div className="rounded-xl border border-border py-10 text-center">
        <p className="text-muted-foreground">Failed to load team P&L</p>
        <p className="mt-1 text-muted-foreground text-sm">{teamSummaryError}</p>
      </div>
    );
  }

  const selected =
    entities.find((entity) => entity.entityKey === selectedEntityKey) ??
    entities[0];

  return (
    <div className="space-y-3 md:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-base">History</div>
          <div className="text-muted-foreground text-xs">
            Shows your wallet account over time
          </div>
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

      <div className="rounded-xl border border-border p-2 md:p-3">
        <PnLChart userId={userId} timeframe={selectedTime} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-base">Per-entity P&amp;L</div>
          <div className="text-muted-foreground text-xs">
            Current P&amp;L = Lifetime P&amp;L + Unrealized P&amp;L
          </div>
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            className="flex items-center gap-1.5 font-semibold text-base"
            onClick={() => setEntityDropdownOpen((prev) => !prev)}
            type="button"
          >
            {selected?.label ?? 'Team'}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {entityDropdownOpen && (
            <div className="absolute top-full right-0 z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-border bg-background shadow-lg">
              {entities.map((entity) => (
                <button
                  key={entity.entityKey}
                  onClick={() => handleEntitySelect(entity.entityKey)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm transition-colors',
                    entity.entityKey === selectedEntityKey
                      ? 'bg-muted font-medium'
                      : 'hover:bg-muted/50'
                  )}
                  type="button"
                >
                  {entity.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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
                selected.lifetimePnl >= 0
                  ? 'text-emerald-500'
                  : 'text-red-500'
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
                selected.unrealizedPnl >= 0
                  ? 'text-emerald-500'
                  : 'text-red-500'
              )}
            >
              {fmtPnl(selected.unrealizedPnl)}
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-muted-foreground text-xs tracking-wide md:mb-3">
          Members
        </div>
        <div className="space-y-1.5 md:space-y-2">
          {entities.map((row) => (
            <button
              key={row.entityKey}
              type="button"
              onClick={() => handleEntitySelect(row.entityKey)}
              className={cn(
                'w-full rounded-xl border px-3 py-2.5 text-left transition-colors md:p-4',
                row.entityKey === selectedEntityKey
                  ? 'border-[#1a365d]/40 bg-[#1a365d]/5'
                  : 'border-border hover:bg-muted/30'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{row.label}</span>
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground tracking-wide">
                      Current
                    </div>
                    <div
                      className={cn(
                        'font-medium text-xs',
                        row.currentPnl >= 0 ? 'text-emerald-500' : 'text-red-500'
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
                        row.unrealizedPnl >= 0
                          ? 'text-emerald-500'
                          : 'text-red-500'
                      )}
                    >
                      {fmtPnl(row.unrealizedPnl)}
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
