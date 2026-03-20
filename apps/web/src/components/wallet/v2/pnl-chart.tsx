'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePnlHistory } from '@/hooks/usePnlHistory';

interface PnLChartProps {
  userId: string;
  timeframe: string;
}

export function PnLChart({ userId, timeframe }: PnLChartProps) {
  const { points, loading } = usePnlHistory(userId, timeframe);

  const chartData = useMemo(() => {
    if (points.length === 0) return [];
    return points.map((p) => {
      const d = new Date(p.time);
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return { time: `${hours}:${minutes}`, value: p.value };
    });
  }, [points]);

  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100] as const;
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.1, 1);
    return [Math.floor(min - padding), Math.ceil(max + padding)] as const;
  }, [chartData]);

  // Estimate Y-axis width based on the longest label
  const yAxisWidth = useMemo(() => {
    if (chartData.length === 0) return 40;
    const maxLabel = `b${Math.round(yDomain[1]).toLocaleString()}`;
    return Math.max(maxLabel.length * 7, 38);
  }, [chartData, yDomain]);

  const isPnlPositive =
    chartData.length >= 2
      ? (chartData.at(-1)?.value ?? 0) >= (chartData[0]?.value ?? 0)
      : true;
  const chartColor = isPnlPositive ? '#10b981' : '#f87171';

  if (loading) {
    return (
      <div className="flex h-72 w-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-72 w-full items-center justify-center text-muted-foreground text-sm">
        No P&L data for this timeframe
      </div>
    );
  }

  return (
    <div className="h-72 w-full [&_*:focus]:outline-none [&_*]:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <YAxis
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(value) => `b${Math.round(value).toLocaleString()}`}
            domain={[yDomain[0], yDomain[1]]}
            width={yAxisWidth}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded bg-[#1a365d] px-2 py-1 font-medium text-white text-xs">
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
            fillOpacity={1}
            fill="url(#colorValue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
