/**
 * @fileoverview Debug Provider - Observability for motivation flow
 *
 * This provider is for DEBUGGING ONLY. It outputs detailed information about:
 * - All registered appraisals with full payloads
 * - Appraisal health metrics (count, confidence, staleness)
 * - Data flow status
 *
 * Unlike the main appraisal provider, this one is verbose and designed
 * for developer inspection, not LLM context.
 */

import type {
  IAgentRuntime,
  Memory,
  Provider,
  ProviderResult,
  ProviderValue,
  State,
} from '@elizaos/core';
import { APPRAISAL_SERVICE_TYPE } from '../constants.ts';
import type { AppraisalService } from '../services/appraisal-service.ts';
import type { Appraisal } from '../types.ts';

/**
 * Calculate health metrics for appraisals.
 */
function calculateMetrics(appraisals: Record<string, Appraisal>): {
  count: number;
  avgConfidence: number;
  avgAgeMs: number;
  staleCount: number;
  criticalDomains: string[];
} {
  const ids = Object.keys(appraisals);
  const now = Date.now();

  if (ids.length === 0) {
    return {
      count: 0,
      avgConfidence: 0,
      avgAgeMs: 0,
      staleCount: 0,
      criticalDomains: [],
    };
  }

  let totalConfidence = 0;
  let totalAge = 0;
  let staleCount = 0;
  const criticalDomains: string[] = [];

  for (const id of ids) {
    const appraisal = appraisals[id];
    totalConfidence += appraisal.confidence;
    const age = now - appraisal.ts;
    totalAge += age;

    // Consider stale if > 10 minutes old
    if (age > 600000) {
      staleCount++;
    }

    // Check for critical status
    const payload = appraisal.payload as Record<string, unknown>;
    if (
      payload.status === 'critical' ||
      payload.status === 'vulnerable' ||
      payload.sentiment === 'negative'
    ) {
      criticalDomains.push(id);
    }
  }

  return {
    count: ids.length,
    avgConfidence: totalConfidence / ids.length,
    avgAgeMs: totalAge / ids.length,
    staleCount,
    criticalDomains,
  };
}

/**
 * Debug Provider
 *
 * Provides verbose debugging information about the appraisal system.
 * Position 99 = runs late, after everything else.
 */
export const appraisalDebugProvider: Provider = {
  name: 'APPRAISAL_DEBUG',

  description:
    'Debugging information for the appraisal system (developer use only)',

  /** High position = runs late, captures final state */
  position: 99,

  /** Always dynamic - state changes constantly */
  dynamic: true,

  /**
   * Get debug information.
   */
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<ProviderResult> => {
    const service = runtime.getService(
      APPRAISAL_SERVICE_TYPE
    ) as AppraisalService | null;

    if (!service) {
      return {
        text: '[APPRAISAL_DEBUG] Service not available',
        data: { available: false },
        values: { appraisalDebugAvailable: false },
      };
    }

    const appraisals = service.getAll();
    const ids = service.getIds();
    const metrics = calculateMetrics(appraisals);

    // Build debug text
    const lines: string[] = [];
    lines.push('=== APPRAISAL DEBUG ===');
    lines.push('');

    // Health metrics
    lines.push('HEALTH METRICS:');
    lines.push(`  Domains tracked: ${metrics.count}`);
    lines.push(`  Avg confidence: ${Math.round(metrics.avgConfidence * 100)}%`);
    lines.push(`  Avg age: ${Math.round(metrics.avgAgeMs / 1000)}s`);
    lines.push(`  Stale count: ${metrics.staleCount}`);

    if (metrics.criticalDomains.length > 0) {
      lines.push(`  ⚠️ CRITICAL: ${metrics.criticalDomains.join(', ')}`);
    }

    lines.push('');

    // Per-domain details
    lines.push('DOMAIN DETAILS:');
    for (const id of ids) {
      const appraisal = appraisals[id];
      const ageMs = Date.now() - appraisal.ts;
      const ageSec = Math.round(ageMs / 1000);

      lines.push(`  [${id}]`);
      lines.push(
        `    conf=${Math.round(appraisal.confidence * 100)}% age=${ageSec}s src=${appraisal.source}`
      );
      lines.push(`    payload=${JSON.stringify(appraisal.payload)}`);
    }

    if (ids.length === 0) {
      lines.push('  (no appraisals registered)');
    }

    lines.push('');
    lines.push('=== END DEBUG ===');

    const text = lines.join('\n');

    return {
      text,
      data: {
        available: true,
        metrics,
        appraisals,
        ids,
        timestamp: Date.now(),
      } as Record<string, ProviderValue>,
      values: {
        appraisalDebugAvailable: true,
        appraisalCount: metrics.count,
        appraisalAvgConfidence: Math.round(metrics.avgConfidence * 100),
        appraisalStaleCount: metrics.staleCount,
        appraisalCriticalDomains: metrics.criticalDomains.join(','),
      } as Record<string, ProviderValue>,
    };
  },
};

export default appraisalDebugProvider;
