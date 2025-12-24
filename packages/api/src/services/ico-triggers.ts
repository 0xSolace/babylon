/**
 * ICO Triggers Service
 *
 * Time-based trigger system for ICO phase transitions.
 * Integrates with Jeju compute trigger service for decentralized scheduling.
 *
 * @packageDocumentation
 */

import { logger } from '@babylon/shared'
import type { Address, Hex } from 'viem'
import {
  type ComputeTriggerService,
  getComputeTriggerService,
  type TriggerDefinition,
} from './compute-trigger-service'
import { getICOAutomationService } from './ico-automation-service'
import { getLiquidityPoolService } from './liquidity-pool-service'

// =============================================================================
// TYPES
// =============================================================================

export type ICOPhaseType =
  | 'NOT_STARTED'
  | 'WHITELIST'
  | 'PUBLIC'
  | 'ENDED'
  | 'CLEARING'
  | 'DISTRIBUTION'

export interface ICOTimeline {
  deployAt: number // Unix timestamp
  whitelistStart: number
  publicStart: number
  presaleEnd: number
  tgeTimestamp: number
}

export interface ICOTriggerConfig {
  presaleAddress: Address
  tokenAddress: Address
  timeline: ICOTimeline
  lpConfig: {
    poolFee: 3000 | 500 | 10000
    ethPercentForLP: number
    lockDuration: number
  }
}

export interface ICOTriggerStatus {
  phase: ICOPhaseType
  totalRaised: bigint
  participants: number
  tokensSold: bigint
  currentPrice: bigint
  timeRemaining: number
  nextPhaseAt: number
  scheduledTriggers: string[]
}

export interface PhaseTransitionResult {
  phase: ICOPhaseType
  txHash: Hex
  timestamp: number
  details: Record<string, unknown>
}

// =============================================================================
// ICO TRIGGERS SERVICE
// =============================================================================

export class ICOTriggersService {
  private config: ICOTriggerConfig
  private computeTriggerService: ComputeTriggerService
  private triggerIds: Map<string, string> = new Map()
  private initialized = false

  constructor(config: ICOTriggerConfig) {
    this.config = config
    this.computeTriggerService = getComputeTriggerService()
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info(
      'Initializing ICO Triggers Service',
      {
        presaleAddress: this.config.presaleAddress,
        whitelistStart: new Date(
          this.config.timeline.whitelistStart * 1000,
        ).toISOString(),
        publicStart: new Date(
          this.config.timeline.publicStart * 1000,
        ).toISOString(),
        presaleEnd: new Date(
          this.config.timeline.presaleEnd * 1000,
        ).toISOString(),
        tgeTimestamp: new Date(
          this.config.timeline.tgeTimestamp * 1000,
        ).toISOString(),
      },
      'ICOTriggers',
    )

    // Initialize compute trigger service
    await this.computeTriggerService.initialize()

    // Register phase transition triggers
    await this.registerPhaseTriggers()

    // Register minute-by-minute monitoring trigger
    await this.registerMonitoringTrigger()

    this.initialized = true
    logger.info(
      'ICO Triggers Service initialized',
      { triggerCount: this.triggerIds.size },
      'ICOTriggers',
    )
  }

  // ===========================================================================
  // PHASE TRIGGER REGISTRATION
  // ===========================================================================

  private async registerPhaseTriggers(): Promise<void> {
    const { timeline } = this.config
    const now = Math.floor(Date.now() / 1000)

    // Register whitelist start trigger
    if (timeline.whitelistStart > now) {
      const triggerId = await this.computeTriggerService.registerTrigger({
        name: 'ico-whitelist-start',
        type: 'cron',
        cronExpression: this.timestampToCron(timeline.whitelistStart),
        action: {
          type: 'custom',
          endpoint: '/api/admin/ico/trigger',
          method: 'POST',
          payload: { phase: 'WHITELIST' },
          timeout: 60,
        },
        active: true,
      })
      this.triggerIds.set('whitelist-start', triggerId)
    }

    // Register public sale start trigger
    if (timeline.publicStart > now) {
      const triggerId = await this.computeTriggerService.registerTrigger({
        name: 'ico-public-start',
        type: 'cron',
        cronExpression: this.timestampToCron(timeline.publicStart),
        action: {
          type: 'custom',
          endpoint: '/api/admin/ico/trigger',
          method: 'POST',
          payload: { phase: 'PUBLIC' },
          timeout: 60,
        },
        active: true,
      })
      this.triggerIds.set('public-start', triggerId)
    }

    // Register presale end trigger
    if (timeline.presaleEnd > now) {
      const triggerId = await this.computeTriggerService.registerTrigger({
        name: 'ico-presale-end',
        type: 'cron',
        cronExpression: this.timestampToCron(timeline.presaleEnd),
        action: {
          type: 'custom',
          endpoint: '/api/admin/ico/trigger',
          method: 'POST',
          payload: { phase: 'ENDED' },
          timeout: 120,
        },
        active: true,
      })
      this.triggerIds.set('presale-end', triggerId)
    }

    // Register TGE trigger
    if (timeline.tgeTimestamp > now) {
      const triggerId = await this.computeTriggerService.registerTrigger({
        name: 'ico-tge',
        type: 'cron',
        cronExpression: this.timestampToCron(timeline.tgeTimestamp),
        action: {
          type: 'custom',
          endpoint: '/api/admin/ico/trigger',
          method: 'POST',
          payload: { phase: 'DISTRIBUTION' },
          timeout: 300,
        },
        active: true,
      })
      this.triggerIds.set('tge', triggerId)
    }

    logger.info(
      'Phase triggers registered',
      { triggers: Array.from(this.triggerIds.keys()) },
      'ICOTriggers',
    )
  }

  private async registerMonitoringTrigger(): Promise<void> {
    // Register a trigger that runs every minute to check phase transitions
    const triggerId = await this.computeTriggerService.registerTrigger({
      name: 'ico-monitor',
      type: 'cron',
      cronExpression: '0 * * * * *', // Every minute at :00 seconds
      action: {
        type: 'custom',
        endpoint: '/api/admin/ico/trigger',
        method: 'POST',
        payload: { action: 'check' },
        timeout: 30,
      },
      active: true,
    })
    this.triggerIds.set('monitor', triggerId)
  }

  // ===========================================================================
  // TIME TRIGGER HANDLER
  // ===========================================================================

  async handleTimeTrigger(): Promise<{
    action: string
    result?: PhaseTransitionResult
  }> {
    const icoService = getICOAutomationService({
      presaleAddress: this.config.presaleAddress,
      tokenAddress: this.config.tokenAddress,
    })

    const currentPhase = await icoService.getCurrentPhase()
    const now = Math.floor(Date.now() / 1000)
    const { timeline } = this.config

    logger.info(
      'ICO time trigger check',
      { currentPhase: currentPhase.name, timestamp: now },
      'ICOTriggers',
    )

    // Determine if we need to transition phases
    if (
      currentPhase.name === 'NOT_STARTED' &&
      timeline.whitelistStart <= now &&
      now < timeline.publicStart
    ) {
      return {
        action: 'whitelist_start',
        result: await this.executeWhitelistStart(),
      }
    }

    if (
      (currentPhase.name === 'NOT_STARTED' ||
        currentPhase.name === 'PRESALE_ACTIVE') &&
      timeline.publicStart <= now &&
      now < timeline.presaleEnd
    ) {
      return {
        action: 'public_start',
        result: await this.executePublicStart(),
      }
    }

    if (
      currentPhase.name === 'PRESALE_ACTIVE' &&
      timeline.presaleEnd <= now &&
      now < timeline.tgeTimestamp
    ) {
      return {
        action: 'presale_end',
        result: await this.executePresaleEnd(),
      }
    }

    if (currentPhase.name === 'PRESALE_ENDED' && timeline.tgeTimestamp <= now) {
      return {
        action: 'tge',
        result: await this.executeTGE(),
      }
    }

    return { action: 'no_action' }
  }

  // ===========================================================================
  // PHASE TRANSITION EXECUTORS
  // ===========================================================================

  async executeWhitelistStart(): Promise<PhaseTransitionResult> {
    logger.info('Executing whitelist phase start', undefined, 'ICOTriggers')

    const icoService = getICOAutomationService({
      presaleAddress: this.config.presaleAddress,
      tokenAddress: this.config.tokenAddress,
    })

    const txHash = await icoService.startPresale()

    logger.info('Whitelist phase started', { txHash }, 'ICOTriggers')

    return {
      phase: 'WHITELIST',
      txHash,
      timestamp: Math.floor(Date.now() / 1000),
      details: { type: 'whitelist_start' },
    }
  }

  async executePublicStart(): Promise<PhaseTransitionResult> {
    logger.info('Executing public sale phase start', undefined, 'ICOTriggers')

    // Public sale typically just means whitelist check is disabled
    // The actual presale contract handles this based on time
    // Log the transition for monitoring
    const timestamp = Math.floor(Date.now() / 1000)

    logger.info('Public sale phase started', { timestamp }, 'ICOTriggers')

    return {
      phase: 'PUBLIC',
      txHash: '0x0' as Hex, // No tx needed for public transition if handled by contract
      timestamp,
      details: { type: 'public_start' },
    }
  }

  async executePresaleEnd(): Promise<PhaseTransitionResult> {
    logger.info('Executing presale end', undefined, 'ICOTriggers')

    const icoService = getICOAutomationService({
      presaleAddress: this.config.presaleAddress,
      tokenAddress: this.config.tokenAddress,
    })

    // Get final stats before ending
    const stats = await icoService.getPresaleStats()

    logger.info(
      'Presale ended',
      {
        totalRaised: stats.totalRaised.toString(),
        participants: stats.totalParticipants,
      },
      'ICOTriggers',
    )

    return {
      phase: 'ENDED',
      txHash: '0x0' as Hex, // Presale end is time-based in contract
      timestamp: Math.floor(Date.now() / 1000),
      details: {
        type: 'presale_end',
        totalRaised: stats.totalRaised.toString(),
        participants: stats.totalParticipants,
      },
    }
  }

  async executeTGE(): Promise<PhaseTransitionResult> {
    logger.info('Executing TGE', undefined, 'ICOTriggers')

    const icoService = getICOAutomationService({
      presaleAddress: this.config.presaleAddress,
      tokenAddress: this.config.tokenAddress,
    })

    // Finalize presale and execute TGE
    const tgeResult = await icoService.finalize()

    if (!tgeResult.success) {
      logger.warn(
        'TGE failed - presale did not meet soft cap',
        undefined,
        'ICOTriggers',
      )
      return {
        phase: 'DISTRIBUTION',
        txHash: tgeResult.txHash,
        timestamp: Math.floor(Date.now() / 1000),
        details: {
          type: 'tge_failed',
          success: false,
        },
      }
    }

    // Create liquidity pool if TGE successful
    const lpService = getLiquidityPoolService({
      tokenAddress: this.config.tokenAddress,
    })

    const lpResult = await lpService.setupInitialLiquidity(
      tgeResult.ethToLiquidity,
      tgeResult.tokensDistributed / 10n, // 10% of distributed tokens to LP
      100, // Lock 100% of LP tokens
      this.config.lpConfig.lockDuration,
    )

    logger.info(
      'TGE completed successfully',
      {
        txHash: tgeResult.txHash,
        lpPairAddress: tgeResult.lpPairAddress,
        tokensDistributed: tgeResult.tokensDistributed.toString(),
        lpTokensLocked: lpResult.lpTokensLocked.toString(),
      },
      'ICOTriggers',
    )

    return {
      phase: 'DISTRIBUTION',
      txHash: tgeResult.txHash,
      timestamp: Math.floor(Date.now() / 1000),
      details: {
        type: 'tge_success',
        success: true,
        lpPairAddress: tgeResult.lpPairAddress,
        tokensDistributed: tgeResult.tokensDistributed.toString(),
        ethToTreasury: tgeResult.ethToTreasury.toString(),
        ethToLiquidity: tgeResult.ethToLiquidity.toString(),
        lpTokensLocked: lpResult.lpTokensLocked.toString(),
        lpLockId: lpResult.lockId.toString(),
      },
    }
  }

  // ===========================================================================
  // STATUS AND MONITORING
  // ===========================================================================

  async getICOStatus(): Promise<ICOTriggerStatus> {
    const icoService = getICOAutomationService({
      presaleAddress: this.config.presaleAddress,
      tokenAddress: this.config.tokenAddress,
    })

    const [phase, stats] = await Promise.all([
      icoService.getCurrentPhase(),
      icoService.getPresaleStats(),
    ])

    const now = Math.floor(Date.now() / 1000)
    const { timeline } = this.config

    // Map internal phase to ICOPhaseType
    let icoPhase: ICOPhaseType = 'NOT_STARTED'
    let nextPhaseAt = timeline.whitelistStart

    if (phase.name === 'FAILED') {
      icoPhase = 'NOT_STARTED'
    } else if (phase.name === 'TGE_COMPLETE') {
      icoPhase = 'DISTRIBUTION'
      nextPhaseAt = 0
    } else if (phase.name === 'PRESALE_ENDED') {
      icoPhase = 'CLEARING'
      nextPhaseAt = timeline.tgeTimestamp
    } else if (phase.name === 'PRESALE_ACTIVE') {
      if (now < timeline.publicStart) {
        icoPhase = 'WHITELIST'
        nextPhaseAt = timeline.publicStart
      } else {
        icoPhase = 'PUBLIC'
        nextPhaseAt = timeline.presaleEnd
      }
    }

    // Calculate current price (Dutch auction style - decreasing)
    const currentPrice = this.calculateCurrentPrice(now)

    return {
      phase: icoPhase,
      totalRaised: stats.totalRaised,
      participants: stats.totalParticipants,
      tokensSold: stats.tokensAllocated,
      currentPrice,
      timeRemaining: stats.timeRemaining,
      nextPhaseAt,
      scheduledTriggers: Array.from(this.triggerIds.keys()),
    }
  }

  async getParticipantCount(): Promise<number> {
    const icoService = getICOAutomationService({
      presaleAddress: this.config.presaleAddress,
      tokenAddress: this.config.tokenAddress,
    })

    const stats = await icoService.getPresaleStats()
    return stats.totalParticipants
  }

  async getTotalRaised(): Promise<bigint> {
    const icoService = getICOAutomationService({
      presaleAddress: this.config.presaleAddress,
      tokenAddress: this.config.tokenAddress,
    })

    const stats = await icoService.getPresaleStats()
    return stats.totalRaised
  }

  // ===========================================================================
  // SCHEDULE MANAGEMENT
  // ===========================================================================

  async scheduleICO(newTimeline?: Partial<ICOTimeline>): Promise<void> {
    if (newTimeline) {
      this.config.timeline = { ...this.config.timeline, ...newTimeline }
    }

    // Clear existing triggers
    for (const [name, triggerId] of this.triggerIds) {
      if (name !== 'monitor') {
        await this.computeTriggerService.deleteTrigger(triggerId)
      }
    }

    // Re-register phase triggers with new timeline
    await this.registerPhaseTriggers()

    logger.info(
      'ICO schedule updated',
      {
        whitelistStart: new Date(
          this.config.timeline.whitelistStart * 1000,
        ).toISOString(),
        publicStart: new Date(
          this.config.timeline.publicStart * 1000,
        ).toISOString(),
        presaleEnd: new Date(
          this.config.timeline.presaleEnd * 1000,
        ).toISOString(),
        tgeTimestamp: new Date(
          this.config.timeline.tgeTimestamp * 1000,
        ).toISOString(),
      },
      'ICOTriggers',
    )
  }

  getConfig(): ICOTriggerConfig {
    return { ...this.config }
  }

  getScheduledTriggers(): TriggerDefinition[] {
    return this.computeTriggerService
      .listTriggers()
      .filter((t) => t.name.startsWith('ico-'))
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private timestampToCron(timestamp: number): string {
    const date = new Date(timestamp * 1000)
    const minute = date.getUTCMinutes()
    const hour = date.getUTCHours()
    const dayOfMonth = date.getUTCDate()
    const month = date.getUTCMonth() + 1
    // Cron format: minute hour day month dayOfWeek
    return `${minute} ${hour} ${dayOfMonth} ${month} *`
  }

  private calculateCurrentPrice(now: number): bigint {
    const { timeline } = this.config

    // If before whitelist, return starting price
    if (now < timeline.whitelistStart) {
      return 50000000000000n // 0.00005 ETH (starting price)
    }

    // If after presale end, return reserve price
    if (now >= timeline.presaleEnd) {
      return 25000000000000n // 0.000025 ETH (reserve price)
    }

    // Calculate linear price decay
    const totalDuration = timeline.presaleEnd - timeline.whitelistStart
    const elapsed = now - timeline.whitelistStart
    const startPrice = 50000000000000n
    const reservePrice = 25000000000000n
    const priceDrop = startPrice - reservePrice
    const currentDrop = (priceDrop * BigInt(elapsed)) / BigInt(totalDuration)

    return startPrice - currentDrop
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  async shutdown(): Promise<void> {
    for (const [name, triggerId] of this.triggerIds) {
      await this.computeTriggerService.deleteTrigger(triggerId)
      logger.info(`Cancelled ICO trigger: ${name}`, undefined, 'ICOTriggers')
    }
    this.triggerIds.clear()
    this.initialized = false
    logger.info('ICO Triggers Service shut down', undefined, 'ICOTriggers')
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let icoTriggersService: ICOTriggersService | null = null

export function getICOTriggersService(
  config?: ICOTriggerConfig,
): ICOTriggersService {
  if (!icoTriggersService && config) {
    icoTriggersService = new ICOTriggersService(config)
  }
  if (!icoTriggersService) {
    throw new Error('ICO Triggers Service not initialized - config required')
  }
  return icoTriggersService
}

export async function initializeICOTriggers(
  config: ICOTriggerConfig,
): Promise<ICOTriggersService> {
  const service = getICOTriggersService(config)
  await service.initialize()
  return service
}

export function resetICOTriggersService(): void {
  if (icoTriggersService) {
    icoTriggersService.shutdown()
  }
  icoTriggersService = null
}
