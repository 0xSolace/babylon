/**
 * Self-healing orchestrator with heartbeat monitoring, leader election, and failover.
 */

import { logger } from '@babylon/shared'
import type { Address } from 'viem'

export interface ServiceHealth {
  serviceId: string
  endpoint: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  lastCheck: Date
  lastHealthy: Date
  consecutiveFailures: number
  responseTimeMs?: number
}

export interface OrchestratorConfig {
  /** Unique orchestrator ID */
  orchestratorId: string
  /** RPC URL for on-chain operations */
  rpcUrl: string
  /** Recovery registry contract */
  recoveryRegistryAddress?: Address
  /** Health check interval in seconds */
  healthCheckIntervalSec: number
  /** Max consecutive failures before restart */
  maxConsecutiveFailures: number
  /** Heartbeat interval for leader election */
  heartbeatIntervalSec: number
  /** Services to monitor */
  services: MonitoredService[]
}

export interface MonitoredService {
  id: string
  name: string
  endpoint: string
  healthPath: string
  restartEndpoint?: string
  containerImage?: string
  priority: number // Lower = higher priority
}

export interface RecoveryAction {
  type: 'restart' | 'scale_up' | 'failover' | 'alert'
  serviceId: string
  timestamp: Date
  success: boolean
  error?: string
}

// ============================================================================
// Self-Healing Orchestrator
// ============================================================================

export class SelfHealingOrchestrator {
  private config: OrchestratorConfig
  private healthStatus: Map<string, ServiceHealth> = new Map()
  private recoveryHistory: RecoveryAction[] = []
  private isLeader = false
  private healthCheckInterval?: NodeJS.Timer
  private heartbeatInterval?: NodeJS.Timer
  private running = false

  constructor(config: OrchestratorConfig) {
    this.config = config
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.running) return
    this.running = true

    logger.info('[Orchestrator] Starting self-healing orchestrator', {
      orchestratorId: this.config.orchestratorId,
      servicesCount: this.config.services.length,
    })

    // Register on-chain for recovery discovery
    await this.registerOnChain()

    // Attempt to become leader
    await this.attemptLeaderElection()

    // Start heartbeat
    this.startHeartbeat()

    // Start health checks
    this.startHealthChecks()

    logger.info('[Orchestrator] Orchestrator started', {
      isLeader: this.isLeader,
    })
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    this.running = false

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    // Deregister from on-chain
    await this.deregisterOnChain()

    logger.info('[Orchestrator] Orchestrator stopped')
  }

  /**
   * Get health status for all services
   */
  getHealthStatus(): ServiceHealth[] {
    return Array.from(this.healthStatus.values())
  }

  /**
   * Get recovery history
   */
  getRecoveryHistory(limit = 50): RecoveryAction[] {
    return this.recoveryHistory.slice(-limit)
  }

  /**
   * Manual health check trigger
   */
  async triggerHealthCheck(serviceId?: string): Promise<ServiceHealth[]> {
    if (serviceId) {
      const service = this.config.services.find((s) => s.id === serviceId)
      if (service) {
        await this.checkServiceHealth(service)
      }
    } else {
      await this.runHealthChecks()
    }
    return this.getHealthStatus()
  }

  /**
   * Manual recovery trigger
   */
  async triggerRecovery(serviceId: string): Promise<RecoveryAction> {
    const service = this.config.services.find((s) => s.id === serviceId)
    if (!service) {
      throw new Error(`Service ${serviceId} not found`)
    }

    return this.attemptRecovery(service)
  }

  // ============================================================================
  // Health Checking
  // ============================================================================

  private startHealthChecks(): void {
    // Run immediately
    this.runHealthChecks()

    // Schedule periodic checks
    this.healthCheckInterval = setInterval(
      () => this.runHealthChecks(),
      this.config.healthCheckIntervalSec * 1000,
    )
  }

  private async runHealthChecks(): Promise<void> {
    if (!this.running) return

    // Only leader runs health checks to avoid duplicate recovery actions
    if (!this.isLeader) {
      logger.debug('[Orchestrator] Skipping health check (not leader)')
      return
    }

    logger.debug('[Orchestrator] Running health checks')

    // Check all services in parallel
    await Promise.all(
      this.config.services.map((service) => this.checkServiceHealth(service)),
    )

    // Trigger recovery for unhealthy services
    for (const [serviceId, health] of this.healthStatus) {
      if (health.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        const service = this.config.services.find((s) => s.id === serviceId)
        if (service) {
          await this.attemptRecovery(service)
        }
      }
    }
  }

  private async checkServiceHealth(service: MonitoredService): Promise<void> {
    const healthUrl = `${service.endpoint}${service.healthPath}`
    const startTime = Date.now()

    let status: ServiceHealth['status'] = 'unknown'
    let responseTimeMs: number | undefined

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      })

      responseTimeMs = Date.now() - startTime

      if (response.ok) {
        status = 'healthy'
      } else if (response.status >= 500) {
        status = 'unhealthy'
      } else {
        status = 'degraded'
      }
    } catch {
      status = 'unhealthy'
    }

    // Update health status
    const existing = this.healthStatus.get(service.id)
    const now = new Date()

    const newHealth: ServiceHealth = {
      serviceId: service.id,
      endpoint: service.endpoint,
      status,
      lastCheck: now,
      lastHealthy: status === 'healthy' ? now : (existing?.lastHealthy ?? now),
      consecutiveFailures:
        status === 'healthy' ? 0 : (existing?.consecutiveFailures ?? 0) + 1,
      responseTimeMs,
    }

    this.healthStatus.set(service.id, newHealth)

    logger.debug('[Orchestrator] Health check complete', {
      serviceId: service.id,
      status,
      consecutiveFailures: newHealth.consecutiveFailures,
    })
  }

  // ============================================================================
  // Recovery
  // ============================================================================

  private async attemptRecovery(
    service: MonitoredService,
  ): Promise<RecoveryAction> {
    logger.warn('[Orchestrator] Attempting recovery', {
      serviceId: service.id,
      endpoint: service.endpoint,
    })

    const action: RecoveryAction = {
      type: 'restart',
      serviceId: service.id,
      timestamp: new Date(),
      success: false,
    }

    try {
      // Try restart endpoint first
      if (service.restartEndpoint) {
        await this.callRestartEndpoint(service)
        action.success = true
      }
      // Try container restart via compute marketplace
      else if (service.containerImage) {
        await this.restartContainer(service)
        action.success = true
      }
      // Failover to backup
      else {
        await this.triggerFailover(service)
        action.type = 'failover'
        action.success = true
      }

      // Reset failure count on successful recovery
      const health = this.healthStatus.get(service.id)
      if (health) {
        health.consecutiveFailures = 0
      }

      logger.info('[Orchestrator] Recovery successful', {
        serviceId: service.id,
        actionType: action.type,
      })
    } catch (error) {
      action.success = false
      action.error = error instanceof Error ? error.message : 'Unknown error'

      logger.error('[Orchestrator] Recovery failed', {
        serviceId: service.id,
        error: action.error,
      })

      // Send alert on recovery failure
      await this.sendAlert(service, action.error)
    }

    this.recoveryHistory.push(action)
    return action
  }

  private async callRestartEndpoint(service: MonitoredService): Promise<void> {
    if (!service.restartEndpoint) return

    const response = await fetch(service.restartEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Orchestrator-Id': this.config.orchestratorId,
        Authorization: `Bearer ${process.env.ORCHESTRATOR_SECRET ?? ''}`,
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      throw new Error(`Restart endpoint returned ${response.status}`)
    }
  }

  private async restartContainer(service: MonitoredService): Promise<void> {
    if (!service.containerImage) {
      logger.warn('[Orchestrator] No container image configured', {
        serviceId: service.id,
      })
      return
    }

    const computeEndpoint =
      process.env.JEJU_COMPUTE_ENDPOINT ?? 'http://localhost:4500'

    logger.info('[Orchestrator] Restarting container via compute marketplace', {
      serviceId: service.id,
      image: service.containerImage,
    })

    // Call compute marketplace to restart container
    const response = await fetch(`${computeEndpoint}/containers/restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.COMPUTE_API_KEY ?? ''}`,
      },
      body: JSON.stringify({
        serviceId: service.id,
        image: service.containerImage,
        orchestratorId: this.config.orchestratorId,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Container restart failed (${response.status}): ${text}`)
    }

    const result = (await response.json()) as { containerId: string }
    logger.info('[Orchestrator] Container restarted', {
      serviceId: service.id,
      containerId: result.containerId,
    })

    // Wait for health check to pass
    const maxWait = 60000 // 60 seconds
    const interval = 2000 // 2 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, interval))

      await this.checkServiceHealth(service)
      const healthStatus = this.healthStatus.get(service.id)
      if (healthStatus?.status === 'healthy') {
        logger.info('[Orchestrator] Container healthy after restart', {
          serviceId: service.id,
          waitTimeMs: Date.now() - startTime,
        })
        return
      }
    }

    throw new Error('Container did not become healthy after restart')
  }

  private async triggerFailover(service: MonitoredService): Promise<void> {
    const computeEndpoint =
      process.env.JEJU_COMPUTE_ENDPOINT ?? 'http://localhost:4500'

    logger.warn('[Orchestrator] Triggering failover', {
      serviceId: service.id,
    })

    // Find healthy backup instance from compute marketplace
    const backupsResponse = await fetch(
      `${computeEndpoint}/services/${service.id}/backups`,
      {
        headers: {
          Authorization: `Bearer ${process.env.COMPUTE_API_KEY ?? ''}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!backupsResponse.ok) {
      throw new Error('Failed to fetch backup instances')
    }

    const backups = (await backupsResponse.json()) as Array<{
      instanceId: string
      endpoint: string
      region: string
    }>

    if (backups.length === 0) {
      throw new Error('No backup instances available')
    }

    // Find a healthy backup
    type BackupInstance = {
      instanceId: string
      endpoint: string
      region: string
    }
    let healthyBackup: BackupInstance | null = null
    for (const backup of backups) {
      const tempService = {
        ...service,
        id: `${service.id}-backup-${backup.instanceId}`,
        endpoint: backup.endpoint,
      }
      await this.checkServiceHealth(tempService)
      const healthStatus = this.healthStatus.get(tempService.id)

      if (healthStatus?.status === 'healthy') {
        healthyBackup = backup
        break
      }
    }

    if (!healthyBackup) {
      throw new Error('No healthy backup instances found')
    }

    // Promote backup to primary
    const promoteResponse = await fetch(
      `${computeEndpoint}/services/${service.id}/promote`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.COMPUTE_API_KEY ?? ''}`,
        },
        body: JSON.stringify({
          instanceId: healthyBackup.instanceId,
        }),
        signal: AbortSignal.timeout(30000),
      },
    )

    if (!promoteResponse.ok) {
      throw new Error('Failed to promote backup instance')
    }

    logger.info('[Orchestrator] Failover complete', {
      serviceId: service.id,
      newInstanceId: healthyBackup.instanceId,
      region: healthyBackup.region,
    })

    // Send alert about failover
    await this.sendAlert(
      service,
      `Failover triggered: promoted ${healthyBackup.instanceId} in ${healthyBackup.region}`,
    )
  }

  private async sendAlert(
    service: MonitoredService,
    message: string,
  ): Promise<void> {
    logger.error('[Orchestrator] ALERT', {
      serviceId: service.id,
      message,
    })

    // Send to configured alert endpoints
    const webhooks = (process.env.ALERT_WEBHOOKS ?? '')
      .split(',')
      .filter(Boolean)

    await Promise.allSettled(
      webhooks.map(async (webhook) => {
        await fetch(webhook.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'service_alert',
            serviceId: service.id,
            serviceName: service.name,
            message,
            timestamp: new Date().toISOString(),
            orchestratorId: this.config.orchestratorId,
          }),
          signal: AbortSignal.timeout(5000),
        })
      }),
    )

    // Also emit metrics for observability
    const metricsEndpoint = process.env.METRICS_ENDPOINT
    if (metricsEndpoint) {
      await fetch(`${metricsEndpoint}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertType: 'service_recovery',
          serviceId: service.id,
          message,
          severity: 'critical',
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {
        // Metrics are best-effort
      })
    }
  }

  // ============================================================================
  // Leader Election
  // ============================================================================

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(
      () => this.sendHeartbeat(),
      this.config.heartbeatIntervalSec * 1000,
    )
  }

  private async attemptLeaderElection(): Promise<void> {
    // Simple leader election via on-chain registration
    // The first orchestrator to register becomes leader
    // Others become followers and monitor the leader

    try {
      const isLeader = await this.registerAsLeader()
      this.isLeader = isLeader

      if (isLeader) {
        logger.info('[Orchestrator] Elected as leader')
      } else {
        logger.info('[Orchestrator] Running as follower')
      }
    } catch (error) {
      logger.warn(
        '[Orchestrator] Leader election failed, assuming follower role',
        {
          error,
        },
      )
      this.isLeader = false
    }
  }

  /**
   * Register as leader. Currently single-instance mode.
   * Future: Implement distributed leader election via ServerRegistry on-chain.
   */
  private async registerAsLeader(): Promise<boolean> {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('[Orchestrator] Single-instance leader election')
    }
    return true
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.running) return
    logger.debug('[Orchestrator] Sending heartbeat', {
      isLeader: this.isLeader,
    })
    if (!this.isLeader) {
      await this.checkLeaderHealth()
    }
  }

  /**
   * Check leader health. Currently single-instance mode.
   * Future: Monitor via ServerRegistry heartbeats on-chain.
   */
  private async checkLeaderHealth(): Promise<void> {
    // Single-instance mode - nothing to check
  }

  // ============================================================================
  // On-Chain Registration
  // ============================================================================

  private async registerOnChain(): Promise<void> {
    if (!this.config.recoveryRegistryAddress) return

    logger.debug('[Orchestrator] Registering on-chain', {
      orchestratorId: this.config.orchestratorId,
    })

    // In production:
    // 1. Register orchestrator in recovery registry
    // 2. Include endpoint for recovery triggers
    // 3. Enable permissionless recovery activation
  }

  private async deregisterOnChain(): Promise<void> {
    if (!this.config.recoveryRegistryAddress) return

    logger.debug('[Orchestrator] Deregistering from chain')
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createBabylonOrchestrator(): SelfHealingOrchestrator {
  const baseUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000'

  return new SelfHealingOrchestrator({
    orchestratorId: `orchestrator-${Date.now()}`,
    rpcUrl: process.env.JEJU_RPC_URL ?? 'http://localhost:6546',
    recoveryRegistryAddress: process.env.RECOVERY_REGISTRY_ADDRESS as
      | Address
      | undefined,
    healthCheckIntervalSec: 30,
    maxConsecutiveFailures: 3,
    heartbeatIntervalSec: 10,
    services: [
      {
        id: 'babylon-game',
        name: 'Babylon Game Engine',
        endpoint: baseUrl,
        healthPath: '/api/health',
        restartEndpoint: `${baseUrl}/api/admin/restart`,
        containerImage: 'babylon-game:latest',
        priority: 1,
      },
      {
        id: 'babylon-cron',
        name: 'Babylon Cron Service',
        endpoint: baseUrl,
        healthPath: '/api/cron/health',
        priority: 2,
      },
      {
        id: 'babylon-training-cpu',
        name: 'Babylon Training (CPU)',
        endpoint: process.env.TRAINING_CPU_ENDPOINT ?? 'http://localhost:8081',
        healthPath: '/health',
        containerImage: 'babylon-training-cpu:latest',
        priority: 3,
      },
      {
        id: 'babylon-training-gpu',
        name: 'Babylon Training (GPU)',
        endpoint: process.env.TRAINING_GPU_ENDPOINT ?? 'http://localhost:8082',
        healthPath: '/health',
        containerImage: 'babylon-training-gpu:latest',
        priority: 4,
      },
    ],
  })
}

// Global orchestrator instance
let orchestrator: SelfHealingOrchestrator | null = null

export function getOrchestrator(): SelfHealingOrchestrator {
  if (!orchestrator) {
    orchestrator = createBabylonOrchestrator()
  }
  return orchestrator
}

async function _startOrchestrator(): Promise<void> {
  const orch = getOrchestrator()
  await orch.start()
}
