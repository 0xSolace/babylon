/**
 * @fileoverview Debug Routes for plugin-appraisal
 *
 * =============================================================================
 * WHY HTTP ROUTES FOR DEBUGGING?
 * =============================================================================
 *
 * While the INSPECT_SITUATION action provides debugging via chat, HTTP routes
 * enable programmatic access for:
 *
 * 1. MONITORING DASHBOARDS
 *    External tools can poll /debug/appraisals/health for metrics
 *
 * 2. AUTOMATED TESTING
 *    Integration tests can verify appraisal state via HTTP
 *
 * 3. DEVELOPMENT TOOLS
 *    Browser-based debugging without needing to chat with the agent
 *
 * 4. LOGGING/ANALYTICS
 *    External systems can collect appraisal data for analysis
 *
 * =============================================================================
 * AVAILABLE ENDPOINTS
 * =============================================================================
 *
 * GET /debug/appraisals
 *   Returns all current appraisals with metadata
 *   Use case: "What's the complete situational snapshot?"
 *
 * GET /debug/appraisals/health
 *   Returns health metrics (avg confidence, staleness, critical domains)
 *   Use case: "Is the appraisal system healthy?"
 *
 * GET /debug/appraisals/:id
 *   Returns a specific appraisal by domain ID
 *   Use case: "What's the current money situation?"
 *
 * =============================================================================
 * DESIGN DECISIONS
 * =============================================================================
 *
 * WHY /debug PREFIX?
 * - Clearly marks these as debugging endpoints
 * - Allows easy filtering in proxies/firewalls
 * - Signals these aren't production APIs
 *
 * WHY JSON RESPONSES?
 * - Machine-readable for tooling
 * - Easy to consume in tests
 * - Standard format for HTTP APIs
 *
 * WHY INCLUDE FORMATTED AGE?
 * - Provides both machine-readable (ageMs) and human-readable (ageFormatted)
 * - Different consumers need different formats
 */

import type { IAgentRuntime, Route } from '@elizaos/core';
import { APPRAISAL_SERVICE_TYPE } from '../constants.ts';
import type { AppraisalService } from '../services/appraisal-service.ts';
import type { Appraisal } from '../types.ts';
import { APPRAISAL_STALENESS_THRESHOLD } from '../workers/appraisal-refresh.ts';

/**
 * Format appraisal for JSON response.
 *
 * WHY THIS FORMAT?
 * - **Original fields**: id, confidence, source, timestamp, payload preserved
 * - **Computed fields**: Add convenience fields for common use cases
 * - **Multiple age formats**: ageMs (precise), ageSeconds (readable), ageFormatted (natural)
 * - **Confidence as percentage**: confidencePercent for human readability
 *
 * WHY INCLUDE BOTH ageMs AND ageSeconds?
 * - ageMs: Precise value for programmatic comparisons
 * - ageSeconds: Human-readable for quick inspection
 * - ageFormatted: Natural language ("2m ago") for UI display
 * Different consumers need different formats - provide all three.
 *
 * @param appraisal - The appraisal to format
 * @returns Formatted object with original and computed fields
 */
function formatAppraisal(appraisal: Appraisal<unknown>) {
  const ageMs = Date.now() - appraisal.ts;
  return {
    id: appraisal.id,
    confidence: appraisal.confidence,
    confidencePercent: Math.round(appraisal.confidence * 100),
    source: appraisal.source,
    timestamp: appraisal.ts,
    ageMs,
    ageSeconds: Math.round(ageMs / 1000),
    ageFormatted: formatAge(ageMs),
    payload: appraisal.payload,
  };
}

/**
 * Format age in human-readable form.
 *
 * WHY HUMAN-READABLE?
 * HTTP responses are often inspected by humans in browsers or logs.
 * "2m ago" is instantly understood, "120000ms" requires calculation.
 *
 * @param ms - Age in milliseconds
 * @returns Human-readable string like "30s ago" or "2m ago"
 */
function formatAge(ms: number): string {
  if (ms < 1000) return 'just now';
  if (ms < 60000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  return `${Math.round(ms / 3600000)}h ago`;
}

/**
 * GET /debug/appraisals - All current appraisals
 *
 * WHY THIS ENDPOINT?
 * Provides a complete snapshot of all appraisals for debugging and monitoring.
 * Use cases:
 * - Dashboard showing all domain states
 * - Integration tests verifying evaluator outputs
 * - Debugging "what does the agent know?"
 */
const getAllAppraisalsRoute: Route = {
  type: 'GET',
  path: '/debug/appraisals',
  name: 'debug-appraisals-all',

  handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
    const service = runtime.getService(
      APPRAISAL_SERVICE_TYPE
    ) as AppraisalService | null;

    // WHY 503 SERVICE UNAVAILABLE?
    // The service not being available is a temporary condition (plugin not
    // loaded or failed to start). 503 indicates "try again later" rather
    // than 404 (not found) or 500 (server error).
    if (!service) {
      res.status(503).json({
        error: 'Appraisal service not available',
        hint: 'Ensure plugin-appraisal is loaded',
      });
      return;
    }

    const appraisals = service.getAll();
    const ids = service.getIds();

    const formatted = ids.map((id) => formatAppraisal(appraisals[id]));

    res.json({
      agent: runtime.agentId,
      timestamp: Date.now(),
      count: ids.length,
      domains: ids,
      appraisals: formatted,
    });
  },
};

/**
 * GET /debug/appraisals/health - Health metrics
 *
 * WHY THIS ENDPOINT?
 * Provides aggregate health metrics for monitoring and alerting.
 * Use cases:
 * - Health check endpoint for monitoring systems
 * - Dashboard showing system health
 * - Alerting when confidence drops or appraisals go stale
 *
 * WHY THESE METRICS?
 * - domainCount: How many domains are tracked (coverage)
 * - avgConfidence: Overall data quality
 * - avgAge: Freshness of data
 * - staleCount: How many need refresh
 * - criticalDomains: Urgent issues requiring attention
 */
const getAppraisalHealthRoute: Route = {
  type: 'GET',
  path: '/debug/appraisals/health',
  name: 'debug-appraisals-health',

  handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
    const service = runtime.getService(
      APPRAISAL_SERVICE_TYPE
    ) as AppraisalService | null;

    if (!service) {
      res.status(503).json({
        error: 'Appraisal service not available',
        status: 'unhealthy',
      });
      return;
    }

    const appraisals = service.getAll();
    const ids = Object.keys(appraisals);
    const now = Date.now();

    // Calculate health metrics
    let totalConfidence = 0;
    let totalAge = 0;
    let staleCount = 0;
    const criticalDomains: string[] = [];

    for (const id of ids) {
      const appraisal = appraisals[id];
      totalConfidence += appraisal.confidence;
      const age = now - appraisal.ts;
      totalAge += age;

      // Consider stale if older than threshold
      // WHY USE APPRAISAL_STALENESS_THRESHOLD?
      // Ensures consistency with the refresh worker. Both the health endpoint
      // and the refresh worker should agree on what "stale" means. Using the
      // same constant prevents confusion when debugging staleness issues.
      if (age > APPRAISAL_STALENESS_THRESHOLD) {
        staleCount++;
      }

      // Check for critical status
      const payload = appraisal.payload as Record<string, unknown>;
      if (
        payload.status === 'critical' ||
        payload.status === 'vulnerable' ||
        payload.status === 'isolated' ||
        payload.sentiment === 'negative'
      ) {
        criticalDomains.push(id);
      }
    }

    const avgConfidence = ids.length > 0 ? totalConfidence / ids.length : 0;
    const avgAgeMs = ids.length > 0 ? totalAge / ids.length : 0;

    res.json({
      agent: runtime.agentId,
      status: ids.length > 0 ? 'healthy' : 'no_data',
      timestamp: now,
      metrics: {
        domainCount: ids.length,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        avgConfidencePercent: Math.round(avgConfidence * 100),
        avgAgeMs: Math.round(avgAgeMs),
        avgAgeSeconds: Math.round(avgAgeMs / 1000),
        staleCount,
        criticalDomains,
        hasCritical: criticalDomains.length > 0,
      },
      domains: ids,
    });
  },
};

/**
 * GET /debug/appraisals/:id - Specific appraisal
 *
 * WHY THIS ENDPOINT?
 * Allows targeted inspection of a single domain without fetching all.
 * Use cases:
 * - "What's the current money situation?"
 * - Testing a specific evaluator's output
 * - Monitoring a critical domain
 *
 * WHY RETURN 404 WITH AVAILABLE DOMAINS?
 * Helps developers discover what domains exist. If they typo the domain
 * name, the error response shows them the correct options.
 */
const getAppraisalByIdRoute: Route = {
  type: 'GET',
  path: '/debug/appraisals/:id',
  name: 'debug-appraisals-by-id',

  handler: async (req: any, res: any, runtime: IAgentRuntime) => {
    const service = runtime.getService(
      APPRAISAL_SERVICE_TYPE
    ) as AppraisalService | null;
    const id = req.params?.id;

    if (!service) {
      res.status(503).json({
        error: 'Appraisal service not available',
      });
      return;
    }

    if (!id) {
      res.status(400).json({
        error: 'Missing id parameter',
      });
      return;
    }

    const appraisal = service.get<unknown>(id);

    if (!appraisal) {
      res.status(404).json({
        error: `No appraisal found for domain: ${id}`,
        availableDomains: service.getIds(),
      });
      return;
    }

    res.json({
      agent: runtime.agentId,
      timestamp: Date.now(),
      appraisal: formatAppraisal(appraisal as Appraisal<unknown>),
    });
  },
};

/**
 * All debug routes for plugin-appraisal.
 */
export const appraisalDebugRoutes: Route[] = [
  getAllAppraisalsRoute,
  getAppraisalHealthRoute,
  getAppraisalByIdRoute,
];

export default appraisalDebugRoutes;
