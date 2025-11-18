/**
 * Metrics Visualizer
 *
 * Generates visualizations and reports from benchmark results:
 * - P&L over time charts
 * - Prediction accuracy graphs
 * - Social metrics
 * - Comparison tables
 * - Performance scorecards
 *
 * Outputs HTML reports and JSON data for further analysis.
 */

import { logger } from '@/lib/logger';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { BenchmarkComparisonResult } from './BenchmarkRunner';
import type { SimulationResult } from './SimulationEngine';

export type VisualizationConfig = {
  /** Output directory for visualizations */
  outputDir: string;

  /** Generate HTML report */
  generateHtml: boolean;

  /** Generate CSV exports */
  generateCsv: boolean;

  /** Generate charts (requires chart library) */
  generateCharts: boolean;
};

export class MetricsVisualizer {
  /**
   * Generate complete visualization suite for a single run
   */
  static async visualizeSingleRun(
    result: SimulationResult,
    config: VisualizationConfig
  ): Promise<void> {
    logger.info('Generating visualizations', { resultId: result.id });

    await fs.mkdir(config.outputDir, { recursive: true });

    // 1. Generate metrics summary
    const summaryHtml = MetricsVisualizer.generateMetricsSummary(result);
    await fs.writeFile(path.join(config.outputDir, 'summary.html'), summaryHtml);

    // 2. Generate detailed metrics tables
    const detailedHtml = MetricsVisualizer.generateDetailedMetrics(result);
    await fs.writeFile(path.join(config.outputDir, 'detailed.html'), detailedHtml);

    // 3. Generate action timeline
    const timelineHtml = MetricsVisualizer.generateActionTimeline(result);
    await fs.writeFile(path.join(config.outputDir, 'timeline.html'), timelineHtml);

    // 4. Generate CSV exports if requested
    if (config.generateCsv) {
      await MetricsVisualizer.exportToCsv(result, config.outputDir);
    }

    // 5. Generate master report that links everything
    const reportHtml = MetricsVisualizer.generateMasterReport(result);
    await fs.writeFile(path.join(config.outputDir, 'index.html'), reportHtml);

    logger.info('Visualizations generated', { outputDir: config.outputDir });
  }

  /**
   * Generate comparison visualization for multiple runs
   */
  static async visualizeComparison(
    comparison: BenchmarkComparisonResult,
    config: VisualizationConfig
  ): Promise<void> {
    logger.info('Generating comparison visualizations');

    await fs.mkdir(config.outputDir, { recursive: true });

    // 1. Generate comparison summary
    const summaryHtml = MetricsVisualizer.generateComparisonSummary(comparison);
    await fs.writeFile(path.join(config.outputDir, 'comparison.html'), summaryHtml);

    // 2. Generate performance distribution charts
    const distributionHtml = MetricsVisualizer.generateDistributionCharts(comparison);
    await fs.writeFile(path.join(config.outputDir, 'distribution.html'), distributionHtml);

    // 3. Export comparison data to CSV
    if (config.generateCsv) {
      await MetricsVisualizer.exportComparisonToCsv(comparison, config.outputDir);
    }

    logger.info('Comparison visualizations generated');
  }

  /**
   * Generate metrics summary card
   */
  private static generateMetricsSummary(result: SimulationResult): string {
    const { metrics } = result;

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Benchmark Metrics Summary</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .metric-group {
      padding: 16px;
      border-radius: 8px;
      background: #f8fafc;
    }
    .metric-label {
      color: #64748b;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .metric-value {
      font-size: 32px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <h1>Benchmark Summary</h1>
  
  <div class="card metric">
    <div class="metric-group">
      <div class="metric-label">Total P&L</div>
      <div class="metric-value">$${metrics.totalPnl.toFixed(2)}</div>
    </div>
    <div class="metric-group">
      <div class="metric-label">Prediction Accuracy</div>
      <div class="metric-value">${(metrics.predictionMetrics.accuracy * 100).toFixed(1)}%</div>
    </div>
    <div class="metric-group">
      <div class="metric-label">Perp Win Rate</div>
      <div class="metric-value">${(metrics.perpMetrics.winRate * 100).toFixed(1)}%</div>
    </div>
    <div class="metric-group">
      <div class="metric-label">Optimality Score</div>
      <div class="metric-value">${metrics.optimalityScore.toFixed(1)}%</div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate detailed metrics tables
   */
  private static generateDetailedMetrics(result: SimulationResult): string {
    const { metrics } = result;

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Detailed Metrics</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    th, td {
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f8fafc;
      text-align: left;
      color: #475569;
      font-weight: 600;
    }
    tr:last-child td {
      border-bottom: none;
    }
  </style>
</head>
<body>
  <h1>Detailed Metrics</h1>

  <table>
    <tr><th colspan="2">Prediction Metrics</th></tr>
    <tr><td>Accuracy</td><td>${(metrics.predictionMetrics.accuracy * 100).toFixed(2)}%</td></tr>
    <tr><td>Total Positions</td><td>${metrics.predictionMetrics.totalPositions}</td></tr>
    <tr><td>Correct Predictions</td><td>${metrics.predictionMetrics.correctPredictions}</td></tr>
    <tr><td>Incorrect Predictions</td><td>${metrics.predictionMetrics.incorrectPredictions}</td></tr>
  </table>

  <table>
    <tr><th colspan="2">Perpetual Metrics</th></tr>
    <tr><td>Total Trades</td><td>${metrics.perpMetrics.totalTrades}</td></tr>
    <tr><td>Profitable Trades</td><td>${metrics.perpMetrics.profitableTrades}</td></tr>
    <tr><td>Win Rate</td><td>${(metrics.perpMetrics.winRate * 100).toFixed(1)}%</td></tr>
  </table>

  <table>
    <tr><th colspan="2">Timing Metrics</th></tr>
    <tr><td>Average Response Time</td><td>${metrics.timing.avgResponseTime.toFixed(0)}ms</td></tr>
    <tr><td>Max Response Time</td><td>${metrics.timing.maxResponseTime.toFixed(0)}ms</td></tr>
    <tr><td>Total Duration</td><td>${(metrics.timing.totalDuration / 1000).toFixed(1)}s</td></tr>
  </table>
</body>
</html>`;
  }

  /**
   * Generate action timeline visualization
   */
  private static generateActionTimeline(result: SimulationResult): string {
    const timeline = result.actions.map(
      (action) => `
        <div class="event">
          <div class="time">Tick ${action.tick}</div>
          <div class="type">${action.type}</div>
          <div class="details">${JSON.stringify(action.data)}</div>
        </div>
      `
    );

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Action Timeline</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1000px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .event {
      background: white;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-left: 4px solid #3b82f6;
    }
    .time {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .type {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .details {
      font-family: 'JetBrains Mono', 'Fira Mono', monospace;
      font-size: 12px;
      color: #475569;
    }
  </style>
</head>
<body>
  <h1>Action Timeline</h1>
  ${timeline.join('\n')}
</body>
</html>`;
  }

  private static async exportToCsv(result: SimulationResult, outputDir: string): Promise<void> {
    const actionsCsv = [
      'tick,type,data,duration',
      ...result.actions.map(
        (action) =>
          `${action.tick},"${action.type}","${JSON.stringify(action.data).replace(/"/g, '""')}",${action.duration}`
      ),
    ].join('\n');

    await fs.writeFile(path.join(outputDir, 'actions.csv'), actionsCsv);

    const metricsCsv = [
      'metric,value',
      `total_pnl,${result.metrics.totalPnl}`,
      `prediction_accuracy,${result.metrics.predictionMetrics.accuracy}`,
      `perp_win_rate,${result.metrics.perpMetrics.winRate}`,
      `optimality_score,${result.metrics.optimalityScore}`,
      `avg_response_time,${result.metrics.timing.avgResponseTime}`,
    ].join('\n');

    await fs.writeFile(path.join(outputDir, 'metrics.csv'), metricsCsv);
  }

  private static generateMasterReport(result: SimulationResult): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Benchmark Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      background: #0f172a;
      color: white;
    }
    .card {
      background: rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 16px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    a {
      color: #38bdf8;
      text-decoration: none;
    }
    .score-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 600;
      margin-left: 8px;
    }
    .score-excellent {
      background: rgba(16,185,129,0.15);
      color: #34d399;
    }
    .score-good {
      background: rgba(59,130,246,0.15);
      color: #60a5fa;
    }
    .score-fair {
      background: rgba(248,113,113,0.15);
      color: #f87171;
    }
    .score-poor {
      background: rgba(244,63,94,0.15);
      color: #fb7185;
    }
  </style>
</head>
<body>
  <h1>Benchmark Report</h1>

  <div class="card">
    <h2>Overall Score ${MetricsVisualizer.getScoreBadge(result.metrics.optimalityScore)}</h2>
    <p>Total P&L: $${result.metrics.totalPnl.toFixed(2)}</p>
    <p>Accuracy: ${(result.metrics.predictionMetrics.accuracy * 100).toFixed(1)}%</p>
    <p>Perp Win Rate: ${(result.metrics.perpMetrics.winRate * 100).toFixed(1)}%</p>
  </div>

  <div class="card">
    <h2>Reports</h2>
    <ul>
      <li><a href="./summary.html">Metrics Summary</a></li>
      <li><a href="./detailed.html">Detailed Metrics</a></li>
      <li><a href="./timeline.html">Action Timeline</a></li>
      <li><a href="./metrics.csv">Metrics CSV</a></li>
      <li><a href="./actions.csv">Actions CSV</a></li>
    </ul>
  </div>
</body>
</html>`;
  }

  private static generateComparisonSummary(comparison: BenchmarkComparisonResult): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Benchmark Comparison</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f8fafc;
      text-align: left;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <h1>Benchmark Comparison</h1>

  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
    <div style="background: white; padding: 16px; border-radius: 8px;">
      <div style="color: #64748b; font-size: 14px;">Average P&L</div>
      <div style="font-size: 32px; font-weight: 600;">$${comparison.comparison.avgPnl.toFixed(2)}</div>
    </div>
    <div style="background: white; padding: 16px; border-radius: 8px;">
      <div style="color: #64748b; font-size: 14px;">Average Accuracy</div>
      <div style="font-size: 32px; font-weight: 600;">${(
        comparison.comparison.avgAccuracy * 100
      ).toFixed(1)}%</div>
    </div>
    <div style="background: white; padding: 16px; border-radius: 8px;">
      <div style="color: #64748b; font-size: 14px;">Average Optimality</div>
      <div style="font-size: 32px; font-weight: 600;">${comparison.comparison.avgOptimality.toFixed(
        1
      )}%</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Run</th>
        <th>Total P&L</th>
        <th>Accuracy</th>
        <th>Optimality</th>
        <th>Duration</th>
      </tr>
    </thead>
    <tbody>
      ${comparison.runs
        .map(
          (run, index) => `
          <tr>
            <td>Run ${index + 1}</td>
            <td>$${run.metrics.totalPnl.toFixed(2)}</td>
            <td>${(run.metrics.predictionMetrics.accuracy * 100).toFixed(1)}%</td>
            <td>${run.metrics.optimalityScore.toFixed(1)}%</td>
            <td>${(run.metrics.timing.totalDuration / 1000).toFixed(1)}s</td>
          </tr>
        `
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;
  }

  private static generateDistributionCharts(comparison: BenchmarkComparisonResult): string {
    const pnls = comparison.runs.map((run) => run.metrics.totalPnl);
    const accuracies = comparison.runs.map((run) => run.metrics.predictionMetrics.accuracy * 100);
    const maxPnl = Math.max(...pnls.map((pnl) => Math.abs(pnl))) || 1;

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Performance Distribution</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .chart {
      background: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .bar {
      height: 30px;
      background: #3b82f6;
      border-radius: 4px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      color: white;
      font-size: 14px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <h1>Performance Distribution</h1>

  <div class="chart">
    <h2>P&L Distribution</h2>
    ${pnls
      .map(
        (pnl, index) => `
      <div class="bar" style="width: ${(Math.abs(pnl) / maxPnl) * 100}%">
        Run ${index + 1}: $${pnl.toFixed(2)}
      </div>
    `
      )
      .join('')}
  </div>

  <div class="chart">
    <h2>Accuracy Distribution</h2>
    ${accuracies
      .map(
        (accuracy, index) => `
      <div class="bar" style="width: ${accuracy}%">
        Run ${index + 1}: ${accuracy.toFixed(1)}%
      </div>
    `
      )
      .join('')}
  </div>
</body>
</html>`;
  }

  private static async exportComparisonToCsv(
    comparison: BenchmarkComparisonResult,
    outputDir: string
  ): Promise<void> {
    const csv = [
      'run,total_pnl,accuracy,optimality,duration',
      ...comparison.runs.map(
        (run, index) =>
          `${index + 1},${run.metrics.totalPnl},${run.metrics.predictionMetrics.accuracy},${run.metrics.optimalityScore},${run.metrics.timing.totalDuration}`
      ),
    ].join('\n');

    await fs.writeFile(path.join(outputDir, 'comparison.csv'), csv);
  }

  private static getScoreBadge(score: number): string {
    if (score >= 80) return '<span class="score-badge score-excellent">Excellent</span>';
    if (score >= 60) return '<span class="score-badge score-good">Good</span>';
    if (score >= 40) return '<span class="score-badge score-fair">Fair</span>';
    return '<span class="score-badge score-poor">Poor</span>';
  }
}
