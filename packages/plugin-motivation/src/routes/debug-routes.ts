/**
 * @fileoverview Debug Routes for plugin-motivation
 *
 * HTTP endpoints for inspecting motivation system state.
 * Useful for debugging and monitoring agent priorities.
 *
 * Routes:
 * - GET /debug/motivation - Full motivation state
 * - GET /debug/motivation/priorities - Current priorities
 * - GET /debug/motivation/signals - Current signals
 * - GET /debug/motivation/patterns - Active patterns
 * - GET /debug/motivation/full - Complete snapshot (motivation + appraisals + homeostasis)
 */

import type { IAgentRuntime, Route } from '@elizaos/core';
import type { MotivationService } from '../services/motivation-service.ts';

/**
 * GET /debug/motivation - Full motivation state
 */
const getMotivationRoute: Route = {
  type: 'GET',
  path: '/debug/motivation',
  name: 'debug-motivation',

  handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
    const service = runtime.getService(
      'motivation'
    ) as MotivationService | null;

    if (!service) {
      res.status(503).json({
        error: 'Motivation service not available',
        hint: 'Ensure plugin-motivation is loaded',
      });
      return;
    }

    const state = service.getState();

    res.json({
      agent: runtime.agentId,
      timestamp: Date.now(),
      motivation: {
        frame: state.dominantFrame,
        priorities: state.priorities,
        constraints: state.constraints,
        opportunities: state.opportunities,
        narrative: state.narrative,
        computedAt: state.timestamp,
        ageMs: Date.now() - state.timestamp,
      },
    });
  },
};

/**
 * GET /debug/motivation/priorities - Current priorities
 */
const getPrioritiesRoute: Route = {
  type: 'GET',
  path: '/debug/motivation/priorities',
  name: 'debug-motivation-priorities',

  handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
    const service = runtime.getService(
      'motivation'
    ) as MotivationService | null;

    if (!service) {
      res.status(503).json({
        error: 'Motivation service not available',
      });
      return;
    }

    const priorities = service.getPriorities();
    const frame = service.getDominantFrame();

    res.json({
      agent: runtime.agentId,
      timestamp: Date.now(),
      frame,
      count: priorities.length,
      priorities: priorities.map((p, i) => ({
        rank: i + 1,
        need: p.need,
        intensity: p.intensity,
        intensityPercent: Math.round(p.intensity * 100),
        drivers: p.drivers,
        rationale: p.rationale,
      })),
    });
  },
};

/**
 * GET /debug/motivation/signals - Current signals
 */
const getSignalsRoute: Route = {
  type: 'GET',
  path: '/debug/motivation/signals',
  name: 'debug-motivation-signals',

  handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
    const service = runtime.getService(
      'motivation'
    ) as MotivationService | null;

    if (!service) {
      res.status(503).json({
        error: 'Motivation service not available',
      });
      return;
    }

    const signals = service.getSignals();

    if (!signals) {
      res.json({
        agent: runtime.agentId,
        timestamp: Date.now(),
        status: 'not_computed',
        signals: null,
      });
      return;
    }

    res.json({
      agent: runtime.agentId,
      timestamp: Date.now(),
      signals: {
        drives: signals.drives,
        physiological: signals.physiological,
        physiologicalStress: signals.physiologicalStress,
        resources: signals.resources,
        situational: signals.situational,
      },
    });
  },
};

/**
 * GET /debug/motivation/patterns - Active patterns
 */
const getPatternsRoute: Route = {
  type: 'GET',
  path: '/debug/motivation/patterns',
  name: 'debug-motivation-patterns',

  handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
    const service = runtime.getService(
      'motivation'
    ) as MotivationService | null;

    if (!service) {
      res.status(503).json({
        error: 'Motivation service not available',
      });
      return;
    }

    const patterns = service.getPatterns();

    res.json({
      agent: runtime.agentId,
      timestamp: Date.now(),
      count: patterns.length,
      patterns: patterns.map((p) => ({
        id: p.id,
        intensity: p.intensity,
        intensityPercent: Math.round(p.intensity * 100),
        triggers: p.triggers,
      })),
    });
  },
};

/**
 * GET /debug/motivation/full - Complete snapshot
 */
const getFullSnapshotRoute: Route = {
  type: 'GET',
  path: '/debug/motivation/full',
  name: 'debug-motivation-full',

  handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
    const motivationService = runtime.getService(
      'motivation'
    ) as MotivationService | null;
    const appraisalService = runtime.getService('appraisal') as any;
    const homeostasisService = runtime.getService('homeostasis') as any;

    const snapshot: Record<string, unknown> = {
      agent: runtime.agentId,
      timestamp: Date.now(),
    };

    // Motivation
    if (motivationService) {
      const state = motivationService.getState();
      const signals = motivationService.getSignals();
      const patterns = motivationService.getPatterns();

      snapshot.motivation = {
        available: true,
        frame: state.dominantFrame,
        priorities: state.priorities.map((p) => ({
          need: p.need,
          intensity: Math.round(p.intensity * 100) + '%',
        })),
        constraintCount: state.constraints.length,
        opportunityCount: state.opportunities.length,
        narrative: state.narrative,
        patternCount: patterns.length,
        patterns: patterns.map((p) => p.id),
      };

      if (signals) {
        snapshot.signals = signals;
      }
    } else {
      snapshot.motivation = { available: false };
    }

    // Appraisals
    if (appraisalService && typeof appraisalService.getAll === 'function') {
      const appraisals = appraisalService.getAll();
      const ids = Object.keys(appraisals);

      snapshot.appraisals = {
        available: true,
        count: ids.length,
        domains: ids,
        data: Object.fromEntries(
          ids.map((id) => [
            id,
            {
              confidence: Math.round(appraisals[id].confidence * 100) + '%',
              source: appraisals[id].source,
              payload: appraisals[id].payload,
            },
          ])
        ),
      };
    } else {
      snapshot.appraisals = { available: false };
    }

    // Homeostasis
    if (homeostasisService) {
      const data: Record<string, unknown> = { available: true };

      if (typeof homeostasisService.getDrives === 'function') {
        data.drives = homeostasisService.getDrives();
      }
      if (typeof homeostasisService.getPhysiological === 'function') {
        data.physiological = homeostasisService.getPhysiological();
      }
      if (typeof homeostasisService.getResources === 'function') {
        data.resources = homeostasisService.getResources();
      }

      snapshot.homeostasis = data;
    } else {
      snapshot.homeostasis = { available: false };
    }

    res.json(snapshot);
  },
};

/**
 * All debug routes for plugin-motivation.
 */
export const motivationDebugRoutes: Route[] = [
  getMotivationRoute,
  getPrioritiesRoute,
  getSignalsRoute,
  getPatternsRoute,
  getFullSnapshotRoute,
];

export default motivationDebugRoutes;
