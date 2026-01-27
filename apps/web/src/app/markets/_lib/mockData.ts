import type { Time } from 'lightweight-charts';

export interface SparklineDataPoint {
    time: Time;
    value: number;
}

/**
 * Deterministically generates a plausible price history.
 * @param currentPrice The current price anchor.
 * @param changePercent The 24h change percent to reverse-engineer start price.
 * @param points Number of data points to generate.
 * @param intervalMinutes Interval between points in minutes.
 */
export function generateMockHistory(
    currentPrice: number,
    changePercent: number,
    points: number = 20,
    intervalMinutes: number = 60
): SparklineDataPoint[] {
    const now = Math.floor(Date.now() / 1000);
    const history: SparklineDataPoint[] = [];

    // Reverse engineer a start price based on the change
    // price = start * (1 + change/100) -> start = price / (1 + change/100)
    // Adjust logic slightly for longer timeframes if needed, but linear trend is fine for mock
    const startPrice = currentPrice / (1 + changePercent / 100);

    const volatility = currentPrice * 0.005; // 0.5% volatility base

    // Generate path
    for (let i = 0; i < points; i++) {
        // Linear interpolation for the trend
        const trend = startPrice + ((currentPrice - startPrice) * (i / (points - 1)));

        // Pseudo-random noise (deterministic-ish based on index)
        const noise = Math.sin(i * 0.5) * volatility;

        // Final simulated value blends trend and noise
        let value = trend + noise;

        // Ensure the last point matches currentPrice exactly
        if (i === points - 1) value = currentPrice;

        history.push({
            time: (now - (points - 1 - i) * (intervalMinutes * 60)) as Time,
            value
        });
    }

    return history;
}

export function generatePredictionMockHistory(
    basePercent: number,
    points: number = 20
): SparklineDataPoint[] {
    const now = Math.floor(Date.now() / 1000);
    return Array.from({ length: points }, (_, i) => ({
        time: (now - (points - 1 - i) * 3600) as Time,
        value: (basePercent / 100) + (Math.sin(i * 0.5) * 0.05)
    }));
}
