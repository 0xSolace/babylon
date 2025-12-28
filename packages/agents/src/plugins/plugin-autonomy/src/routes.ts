import type {
  IAgentRuntime,
  Route,
  RouteRequest,
  RouteResponse,
} from '@elizaos/core'
import type { JsonValue } from '@jejunetwork/shared'
import type { AutonomyService } from './service'
import { AutonomousServiceType } from './types'

// Helper to safely send JSON responses
function sendJson(res: RouteResponse, data: unknown, statusCode = 200): void {
  if (statusCode !== 200 && res.status) {
    res.status(statusCode).json?.(data)
  } else {
    res.json?.(data)
  }
}

// Type guard to check if service is AutonomyService
function isAutonomyService(service: unknown): service is AutonomyService {
  if (service === null || typeof service !== 'object') return false
  const obj = service as Record<string, unknown>
  return (
    'getStatus' in obj &&
    'enableAutonomy' in obj &&
    'disableAutonomy' in obj &&
    'setLoopInterval' in obj &&
    typeof obj.getStatus === 'function'
  )
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
      runtime: IAgentRuntime,
    ) => {
      void req

      const autonomyService = runtime.getService(
        AutonomousServiceType.AUTONOMOUS,
      )

      if (!autonomyService || !isAutonomyService(autonomyService)) {
        sendJson(
          res,
          { success: false, error: 'Autonomy service not available' },
          503,
        )
        return
      }

      const status = autonomyService.getStatus()

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
      })
    },
  },

  {
    path: '/autonomy/enable',
    type: 'POST',
    handler: async (
      req: RouteRequest,
      res: RouteResponse,
      runtime: IAgentRuntime,
    ) => {
      void req

      const autonomyService = runtime.getService(
        AutonomousServiceType.AUTONOMOUS,
      )

      if (!autonomyService || !isAutonomyService(autonomyService)) {
        sendJson(
          res,
          { success: false, error: 'Autonomy service not available' },
          503,
        )
        return
      }

      await autonomyService.enableAutonomy()
      const status = autonomyService.getStatus()

      sendJson(res, {
        success: true,
        message: 'Autonomy enabled',
        data: {
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
        },
      })
    },
  },

  {
    path: '/autonomy/disable',
    type: 'POST',
    handler: async (
      req: RouteRequest,
      res: RouteResponse,
      runtime: IAgentRuntime,
    ) => {
      void req

      const autonomyService = runtime.getService(
        AutonomousServiceType.AUTONOMOUS,
      )

      if (!autonomyService || !isAutonomyService(autonomyService)) {
        sendJson(
          res,
          { success: false, error: 'Autonomy service not available' },
          503,
        )
        return
      }

      await autonomyService.disableAutonomy()
      const status = autonomyService.getStatus()

      sendJson(res, {
        success: true,
        message: 'Autonomy disabled',
        data: {
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
        },
      })
    },
  },

  {
    path: '/autonomy/toggle',
    type: 'POST',
    handler: async (
      req: RouteRequest,
      res: RouteResponse,
      runtime: IAgentRuntime,
    ) => {
      void req

      const autonomyService = runtime.getService(
        AutonomousServiceType.AUTONOMOUS,
      )

      if (!autonomyService || !isAutonomyService(autonomyService)) {
        sendJson(
          res,
          { success: false, error: 'Autonomy service not available' },
          503,
        )
        return
      }

      const currentStatus = autonomyService.getStatus()

      if (currentStatus.enabled) {
        await autonomyService.disableAutonomy()
      } else {
        await autonomyService.enableAutonomy()
      }

      const newStatus = autonomyService.getStatus()

      sendJson(res, {
        success: true,
        message: newStatus.enabled ? 'Autonomy enabled' : 'Autonomy disabled',
        data: {
          enabled: newStatus.enabled,
          running: newStatus.running,
          interval: newStatus.interval,
        },
      })
    },
  },

  {
    path: '/autonomy/interval',
    type: 'POST',
    handler: async (
      req: RouteRequest,
      res: RouteResponse,
      runtime: IAgentRuntime,
    ) => {
      const autonomyService = runtime.getService(
        AutonomousServiceType.AUTONOMOUS,
      )

      if (!autonomyService || !isAutonomyService(autonomyService)) {
        sendJson(
          res,
          { success: false, error: 'Autonomy service not available' },
          503,
        )
        return
      }

      const { interval } = req.body as { interval?: JsonValue }

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
          400,
        )
        return
      }

      autonomyService.setLoopInterval(interval)
      const status = autonomyService.getStatus()

      sendJson(res, {
        success: true,
        message: 'Interval updated',
        data: {
          interval: status.interval,
          intervalSeconds: Math.round(status.interval / 1000),
        },
      })
    },
  },
]
