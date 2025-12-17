import type { JsonValue } from '@babylon/shared';
import type { IAgentRuntime, Route } from '@elizaos/core';
import type { AutonomyService } from './service';
import { AutonomousServiceType } from './types';

// Route handler types compatible with ElizaOS
interface RouteRequest {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string | string[]>;
}

interface RouteResponse {
  status?: (code: number) => RouteResponse;
  json?: (data: unknown) => void;
}

// Helper to safely send JSON responses
function sendJson(res: RouteResponse, data: unknown, statusCode = 200): void {
  if (statusCode !== 200 && res.status) {
    res.status(statusCode).json?.(data);
  } else {
    res.json?.(data);
  }
}

// Type guard to check if service is AutonomyService
function isAutonomyService(service: unknown): service is AutonomyService {
  return (
    service !== null &&
    typeof service === 'object' &&
    'getStatus' in service &&
    'enableAutonomy' in service &&
    'disableAutonomy' in service &&
    'setLoopInterval' in service &&
    typeof (service as { getStatus: unknown }).getStatus === 'function'
  );
}

/**
 * Simple API routes for controlling autonomy via settings
 */
export const autonomyRoutes: Route[] = [
  {
    path: '/autonomy/status',
    type: 'GET',
    handler: async (
      req: RouteRequest,
      res: RouteResponse,
      runtime: IAgentRuntime
    ) => {
      void req;

      const autonomyService = runtime.getService(
        AutonomousServiceType.AUTONOMOUS
      );

      if (!autonomyService || !isAutonomyService(autonomyService)) {
        sendJson(
          res,
          { success: false, error: 'Autonomy service not available' },
          503
        );
        return;
      }

      const status = autonomyService.getStatus();

      sendJson(res, {
        success: true,
        data: {
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
          intervalSeconds: Math.round(status.interval / 1000),
          autonomousRoomId: status.autonomousRoomId,
          agentId: runtime.agentId,
          characterName: runtime.character?.name || 'Agent',
        },
      });
    },
  },

  {
    path: '/autonomy/enable',
    type: 'POST',
    handler: async (
      req: RouteRequest,
      res: RouteResponse,
      runtime: IAgentRuntime
    ) => {
      void req;

      const autonomyService = runtime.getService(
        AutonomousServiceType.AUTONOMOUS
      );

      if (!autonomyService || !isAutonomyService(autonomyService)) {
        sendJson(
          res,
          { success: false, error: 'Autonomy service not available' },
          503
        );
        return;
      }

      await autonomyService.enableAutonomy();
      const status = autonomyService.getStatus();

      sendJson(res, {
        success: true,
        message: 'Autonomy enabled',
        data: {
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
        },
      });
    },
  },

  {
    path: '/autonomy/disable',
    type: 'POST',
    handler: async (
      req: RouteRequest,
      res: RouteResponse,
      runtime: IAgentRuntime
    ) => {
      void req;

      const autonomyService = runtime.getService(
        AutonomousServiceType.AUTONOMOUS
      );

      if (!autonomyService || !isAutonomyService(autonomyService)) {
        sendJson(
          res,
          { success: false, error: 'Autonomy service not available' },
          503
        );
        return;
      }

      await autonomyService.disableAutonomy();
      const status = autonomyService.getStatus();

      sendJson(res, {
        success: true,
        message: 'Autonomy disabled',
        data: {
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
        },
      });
    },
  },

  {
    path: '/autonomy/toggle',
    type: 'POST',
    handler: async (
      req: RouteRequest,
      res: RouteResponse,
      runtime: IAgentRuntime
    ) => {
      void req;

      const autonomyService = runtime.getService(
        AutonomousServiceType.AUTONOMOUS
      );

      if (!autonomyService || !isAutonomyService(autonomyService)) {
        sendJson(
          res,
          { success: false, error: 'Autonomy service not available' },
          503
        );
        return;
      }

      const currentStatus = autonomyService.getStatus();

      if (currentStatus.enabled) {
        await autonomyService.disableAutonomy();
      } else {
        await autonomyService.enableAutonomy();
      }

      const newStatus = autonomyService.getStatus();

      sendJson(res, {
        success: true,
        message: newStatus.enabled ? 'Autonomy enabled' : 'Autonomy disabled',
        data: {
          enabled: newStatus.enabled,
          running: newStatus.running,
          interval: newStatus.interval,
        },
      });
    },
  },

  {
    path: '/autonomy/interval',
    type: 'POST',
    handler: async (
      req: RouteRequest,
      res: RouteResponse,
      runtime: IAgentRuntime
    ) => {
      const autonomyService = runtime.getService(
        AutonomousServiceType.AUTONOMOUS
      );

      if (!autonomyService || !isAutonomyService(autonomyService)) {
        sendJson(
          res,
          { success: false, error: 'Autonomy service not available' },
          503
        );
        return;
      }

      const { interval } = req.body as { interval?: JsonValue };

      if (
        typeof interval !== 'number' ||
        interval < 5000 ||
        interval > 600000
      ) {
        sendJson(
          res,
          {
            success: false,
            error:
              'Interval must be a number between 5000ms (5s) and 600000ms (10m)',
          },
          400
        );
        return;
      }

      autonomyService.setLoopInterval(interval);
      const status = autonomyService.getStatus();

      sendJson(res, {
        success: true,
        message: 'Interval updated',
        data: {
          interval: status.interval,
          intervalSeconds: Math.round(status.interval / 1000),
        },
      });
    },
  },
];
