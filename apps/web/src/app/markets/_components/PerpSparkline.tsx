'use client';

import {
  ColorType,
  createChart,
  LineSeries,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { memo, useEffect, useMemo, useRef } from 'react';

interface SparklineDataPoint {
  time: Time;
  value: number;
}

interface PerpSparklineProps {
  data?: SparklineDataPoint[];
  width?: number;
  height?: number;
  color?: string;
  isPositive?: boolean;
  // If data is not provided, we can generate mock data from these props
  currentPrice?: number;
  changePercent?: number;
}

/**
 * Deterministically generates a plausible price history based on current price and change %.
 * This is a visual-only helper to provide "wow" factor without N+1 API calls.
 */
function generateMockHistory(
  currentPrice: number,
  changePercent: number
): SparklineDataPoint[] {
  const points = 20;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const history: SparklineDataPoint[] = [];

  // Reverse engineer a start price based on the change
  // price = start * (1 + change/100) -> start = price / (1 + change/100)
  const startPrice = currentPrice / (1 + changePercent / 100);

  const volatility = currentPrice * 0.005; // 0.5% volatility per step base

  // Generate path
  for (let i = 0; i < points; i++) {
    const trend =
      startPrice + (currentPrice - startPrice) * (i / (points - 1));
    // For truly deterministic we'd need a seed, but basic Math.sin is fine for "look"
    const noise = Math.sin(i * 0.5) * volatility;

    // Final simulated value blends trend and noise
    // We ensure the last point matches currentPrice exactly
    let value = trend + noise;
    if (i === points - 1) value = currentPrice;

    history.push({
      time: (nowSeconds - (points - 1 - i) * 3600) as Time, // 1 hour steps
      value,
    });
  }

  return history;
}

function PerpSparklineBase({
  data,
  width = 100,
  height = 32,
  color,
  isPositive,
  currentPrice,
  changePercent,
}: PerpSparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;
    if (currentPrice !== undefined && changePercent !== undefined) {
      return generateMockHistory(currentPrice, changePercent);
    }
    return [];
  }, [data, currentPrice, changePercent]);

  // Determine color if not explicitly provided
  const lineColor = useMemo(() => {
    if (color) return color;
    if (isPositive !== undefined) return isPositive ? '#22c55e' : '#ef4444';
    // Fallback based on data trend
    if (chartData.length >= 2) {
      const first = chartData[0]?.value;
      const last = chartData[chartData.length - 1]?.value;
      if (first !== undefined && last !== undefined) {
        return last >= first ? '#22c55e' : '#ef4444';
      }
    }
    return '#22c55e';
  }, [color, isPositive, chartData]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'transparent',
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScroll: false,
      handleScale: false,
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
    });

    chartRef.current = chart;

    seriesRef.current = chart.addSeries(LineSeries, {
      color: lineColor,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [width, height, lineColor]);

  useEffect(() => {
    if (!seriesRef.current || chartData.length === 0) return;
    seriesRef.current.setData(chartData);
    chartRef.current?.timeScale().fitContent();
  }, [chartData]);

  if (chartData.length === 0) {
    return <div style={{ width, height }} className="opacity-0" />;
  }

  return (
    <div
      ref={containerRef}
      style={{ width, height }}
      className="overflow-hidden mix-blend-lighten"
    />
  );
}

export const PerpSparkline = memo(PerpSparklineBase);
