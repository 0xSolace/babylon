'use client';

import { cn, formatCurrency } from '@babylon/shared/utils';
import { ChevronDown } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { usePnlHistory } from '@/hooks/usePnlHistory';
import { useUserPositions } from '@/stores/userPositionsStore';
import { useWalletBalance } from '@/stores/walletBalanceStore';

interface WalletPnLProps {
  userId: string;
  mode?: 'sidebar' | 'page';
}

interface EntityPnL {
  name: string;
  currentPnl: number;
  lifetimePnl: number;
  unrealized: number;
  isSelected?: boolean;
}

const timeframes = ['1H', '4H', '1D', '1W', 'ALL'];

export function WalletPnL({ userId, mode = 'page' }: WalletPnLProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [selectedEntity, setSelectedEntity] = useState('Team');
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { lifetimePnL, loading: balanceLoading } = useWalletBalance(userId);
  const {
    perpPositions,
    predictionPositions,
    loading: positionsLoading,
  } = useUserPositions(userId);

  const { points: pnlPoints, loading: chartLoading } = usePnlHistory(
    userId,
    selectedTimeframe
  );

  const isSidebar = mode === 'sidebar';
  const loading = balanceLoading || positionsLoading;

  // Build entity P&L list by grouping positions by agent
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

  // Format chart data from API points
  const chartData = useMemo(() => {
    if (pnlPoints.length === 0) return [];
    return pnlPoints.map((p) => {
      const d = new Date(p.time);
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return { time: `${hours}:${minutes}`, value: p.value };
    });
  }, [pnlPoints]);

  // Calculate Y-axis domain dynamically from data
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100] as const;
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.1, 1);
    return [Math.floor(min - padding), Math.ceil(max + padding)] as const;
  }, [chartData]);

  // Current value from the latest chart point
  const lastPoint = chartData[chartData.length - 1];
  const firstPoint = chartData[0];
  const currentValue =
    chartData.length > 0 && lastPoint ? lastPoint.value : null;

  // Determine chart color based on P&L direction
  const isPnlPositive =
    chartData.length >= 2 && lastPoint && firstPoint
      ? lastPoint.value >= firstPoint.value
      : true;
  const chartColor = isPnlPositive ? '#10b981' : '#f87171';

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
      <div className="space-y-4 p-4">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div
          className={cn(
            'animate-pulse rounded bg-muted',
            isSidebar ? 'h-[160px]' : 'h-[240px]'
          )}
        />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setEntityDropdownOpen((prev) => !prev)}
          >
            {selectedEntity}
            <ChevronDown className="h-4 w-4" />
          </Button>
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

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-muted p-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium text-xs transition-colors',
                  selectedTimeframe === tf
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div
        className={cn(
          'relative mb-6 w-full',
          isSidebar ? 'h-[160px]' : 'h-[240px]'
        )}
      >
        {chartLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            No P&L data for this timeframe
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 50, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={chartColor}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor={chartColor}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  dy={10}
                />
                <YAxis
                  domain={[yDomain[0], yDomain[1]]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(value) => `b${value}`}
                  orientation="right"
                  dx={10}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded bg-foreground px-2 py-1 text-background text-xs">
                          b{Number(payload[0].value).toFixed(2)}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={2}
                  fill="url(#pnlGradient)"
                  strokeDasharray="0"
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Current Value Label */}
            {currentValue !== null && (
              <div className="absolute top-[15%] right-0 rounded bg-foreground px-2 py-0.5 font-medium text-background text-xs">
                b{currentValue.toFixed(2)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Table */}
      {isSidebar ? (
        // Compact: Entity + Current P&L only
        <table className="w-full">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className="pb-3 font-normal">Entity</th>
              <th className="pb-3 font-normal">Current P&L</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity) => (
              <tr
                key={entity.name}
                className="border-border border-b last:border-0"
              >
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    {entity.isSelected && (
                      <div className="h-2 w-2 rounded-full bg-sky-500" />
                    )}
                    <span className="font-medium text-sm">{entity.name}</span>
                  </div>
                </td>
                <td className="py-3">
                  <div
                    className={cn(
                      'font-semibold text-sm',
                      entity.currentPnl >= 0
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    )}
                  >
                    {fmtPnl(entity.currentPnl)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // Full table
        <table className="w-full">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className="pb-3 font-normal">Entity</th>
              <th className="pb-3 font-normal">Current P&L</th>
              <th className="pb-3 font-normal">Lifetime P&L</th>
              <th className="pb-3 font-normal">Unrealized</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity) => (
              <tr
                key={entity.name}
                className="border-border border-b last:border-0"
              >
                <td className="py-4">
                  <div className="flex items-center gap-2">
                    {entity.isSelected && (
                      <div className="h-2 w-2 rounded-full bg-sky-500" />
                    )}
                    <span className="font-medium text-sm">{entity.name}</span>
                  </div>
                </td>
                <td className="py-4">
                  <div
                    className={cn(
                      'font-semibold text-sm',
                      entity.currentPnl >= 0
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    )}
                  >
                    {fmtPnl(entity.currentPnl)}
                  </div>
                </td>
                <td className="py-4">
                  <div
                    className={cn(
                      'font-semibold text-sm',
                      entity.lifetimePnl >= 0
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    )}
                  >
                    {fmtPnl(entity.lifetimePnl)}
                  </div>
                </td>
                <td className="py-4">
                  <div
                    className={cn(
                      'font-semibold text-sm',
                      entity.unrealized >= 0
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    )}
                  >
                    {fmtPnl(entity.unrealized)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
