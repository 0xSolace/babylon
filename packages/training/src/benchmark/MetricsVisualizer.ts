/**
 * Metrics Visualizer
 *
 * Generates visualizations for benchmark results.
 * This is a stub implementation - the original was deleted in a merge.
 * Methods log warnings and write minimal output files.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { SimulationResult } from './SimulationEngine';

export interface VisualizationOptions {
  outputDir: string;
  generateHtml?: boolean;
  generateCsv?: boolean;
  generateCharts?: boolean;
}

export interface ComparisonData {
  runs: Array<SimulationResult & { actions: unknown[] }>;
  comparison: {
    avgPnl: number;
    avgAccuracy: number;
    avgOptimality: number;
    bestRun: string;
    worstRun: string;
  };
}

/**
 * MetricsVisualizer provides visualization utilities for benchmark results.
 * @deprecated This is a stub - full visualization was removed in merge
 */
export class MetricsVisualizer {
  /**
   * Visualize comparison across multiple benchmark runs
   */
  static async visualizeComparison(
    data: ComparisonData,
    options: VisualizationOptions
  ): Promise<void> {
    console.warn(
      '[MetricsVisualizer] visualizeComparison is a stub - writing minimal output'
    );

    await fs.mkdir(options.outputDir, { recursive: true });

    // Write comparison summary JSON
    const summaryPath = path.join(options.outputDir, 'comparison-summary.json');
    await fs.writeFile(
      summaryPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          isStub: true,
          comparison: data.comparison,
          runCount: data.runs.length,
        },
        null,
        2
      )
    );

    if (options.generateHtml) {
      const htmlPath = path.join(options.outputDir, 'comparison.html');
      await fs.writeFile(
        htmlPath,
        `<!DOCTYPE html>
<html>
<head><title>Benchmark Comparison</title></head>
<body>
  <h1>Benchmark Comparison (Stub)</h1>
  <p>Full visualization was removed in merge. Summary:</p>
  <pre>${JSON.stringify(data.comparison, null, 2)}</pre>
</body>
</html>`
      );
    }

    if (options.generateCsv) {
      const csvPath = path.join(options.outputDir, 'comparison.csv');
      const header = 'run_id,total_pnl,accuracy,optimality\n';
      const rows = data.runs
        .map(
          (r) =>
            `${r.id},${r.metrics.totalPnl},${r.metrics.predictionMetrics.accuracy},${r.metrics.optimalityScore}`
        )
        .join('\n');
      await fs.writeFile(csvPath, header + rows);
    }
  }

  /**
   * Visualize a single benchmark run
   */
  static async visualizeSingleRun(
    result: SimulationResult,
    options: VisualizationOptions
  ): Promise<void> {
    console.warn(
      '[MetricsVisualizer] visualizeSingleRun is a stub - writing minimal output'
    );

    await fs.mkdir(options.outputDir, { recursive: true });

    if (options.generateHtml) {
      const htmlPath = path.join(options.outputDir, 'result.html');
      await fs.writeFile(
        htmlPath,
        `<!DOCTYPE html>
<html>
<head><title>Benchmark Result</title></head>
<body>
  <h1>Benchmark Result (Stub)</h1>
  <p>Full visualization was removed in merge. Summary:</p>
  <pre>${JSON.stringify(result.metrics, null, 2)}</pre>
</body>
</html>`
      );
    }

    if (options.generateCsv) {
      const csvPath = path.join(options.outputDir, 'metrics.csv');
      const { metrics } = result;
      await fs.writeFile(
        csvPath,
        `metric,value
total_pnl,${metrics.totalPnl}
prediction_accuracy,${metrics.predictionMetrics.accuracy}
optimality_score,${metrics.optimalityScore}
avg_response_time,${metrics.timing.avgResponseTime}
`
      );
    }
  }

  /**
   * Generate a comparison report between baseline and challenger
   * @deprecated Use visualizeComparison instead
   */
  static async generateComparisonReport(
    _baseline: SimulationResult,
    _challenger: SimulationResult,
    _outputDir: string
  ): Promise<void> {
    console.warn(
      '[MetricsVisualizer] generateComparisonReport is a stub - not implemented'
    );
  }
}
