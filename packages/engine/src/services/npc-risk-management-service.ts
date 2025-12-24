/**
 * NPC Risk Management Service
 *
 * Comprehensive risk management for NPC trading:
 * - Position-level stop-losses
 * - Portfolio-level drawdown limits
 * - Daily loss limits
 * - Automatic position closure on risk triggers
 * - Liquidity preservation
 *
 * NPCs provide liquidity to the prediction markets that users can farm.
 * This service ensures NPCs don't get completely drained while still
 * providing meaningful liquidity.
 *
 * @packageDocumentation
 */

import { actorState, db, eq, poolPositions } from '@babylon/db'
import { logger } from '@babylon/shared'
import { StaticDataRegistry } from './static-data-registry'

// =============================================================================
// CONFIGURATION
// =============================================================================

export const RISK_LIMITS = {
  /** Maximum daily loss as percentage of starting balance (20%) */
  MAX_DAILY_LOSS_PCT: 20,
  /** Maximum single position loss before stop-loss triggers (25%) */
  MAX_POSITION_LOSS_PCT: 25,
  /** Maximum portfolio drawdown from peak (30%) */
  MAX_DRAWDOWN_PCT: 30,
  /** Minimum balance to maintain (in BBLN, not wei) */
  MIN_BALANCE: 100,
  /** Maximum position size as percentage of portfolio (20%) */
  MAX_POSITION_SIZE_PCT: 20,
  /** Correlation risk limit - max exposure to single asset (40%) */
  MAX_SINGLE_ASSET_EXPOSURE_PCT: 40,
  /** Leverage limit per position */
  MAX_LEVERAGE: 10,
  /** Risk check interval in milliseconds */
  CHECK_INTERVAL_MS: 30_000, // 30 seconds
} as const

/** Risk tier based on NPC personality */
export type RiskTier = 'conservative' | 'moderate' | 'aggressive'

const RISK_TIER_MULTIPLIERS: Record<RiskTier, number> = {
  conservative: 0.5, // Half the risk limits
  moderate: 1.0, // Standard limits
  aggressive: 1.5, // 50% higher limits
}

// =============================================================================
// TYPES
// =============================================================================

export interface RiskStatus {
  actorId: string
  tier: RiskTier
  currentBalance: number
  startingBalance: number
  dailyPnL: number
  dailyPnLPercent: number
  peakBalance: number
  drawdown: number
  drawdownPercent: number
  positionCount: number
  riskScore: number // 0-100
  alerts: RiskAlert[]
  isAtRisk: boolean
  shouldStopTrading: boolean
}

export interface RiskAlert {
  type:
    | 'daily_loss'
    | 'position_loss'
    | 'drawdown'
    | 'low_balance'
    | 'high_concentration'
  severity: 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  positionId?: string
}

export interface PositionRisk {
  positionId: string
  marketType: 'prediction' | 'perp'
  ticker?: string
  marketId?: string
  side: string
  size: number
  entryPrice: number
  currentPrice: number
  unrealizedPnL: number
  pnlPercent: number
  isAtRisk: boolean
  riskReason?: string
}

export interface RiskCheckResult {
  npcCount: number
  atRiskCount: number
  positionsClosedCount: number
  alerts: RiskAlert[]
}

// =============================================================================
// SERVICE
// =============================================================================

export class NPCRiskManagementService {
  private peakBalances: Map<string, number> = new Map()
  private dailyStartBalances: Map<string, { balance: number; date: string }> =
    new Map()
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private isRunning = false

  /**
   * Start automatic risk monitoring
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.checkInterval = setInterval(
      () => this.runRiskCheck(),
      RISK_LIMITS.CHECK_INTERVAL_MS,
    )

    logger.info('NPC Risk Management started', undefined, 'NPCRiskManagement')
  }

  /**
   * Stop automatic risk monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isRunning = false
    logger.info('NPC Risk Management stopped', undefined, 'NPCRiskManagement')
  }

  /**
   * Run risk check for all NPCs
   */
  async runRiskCheck(): Promise<RiskCheckResult> {
    const actors = StaticDataRegistry.getAllActors()
    const result: RiskCheckResult = {
      npcCount: actors.length,
      atRiskCount: 0,
      positionsClosedCount: 0,
      alerts: [],
    }

    for (const actor of actors) {
      const status = await this.checkNPCRisk(actor.id)
      if (status.isAtRisk) {
        result.atRiskCount++
        result.alerts.push(...status.alerts)

        // Auto-close positions if critical
        if (status.shouldStopTrading) {
          const closedCount = await this.closeRiskyPositions(
            actor.id,
            status.alerts,
          )
          result.positionsClosedCount += closedCount
        }
      }
    }

    if (result.atRiskCount > 0) {
      logger.warn(
        `Risk check completed: ${result.atRiskCount} NPCs at risk`,
        {
          atRisk: result.atRiskCount,
          positionsClosed: result.positionsClosedCount,
        },
        'NPCRiskManagement',
      )
    }

    return result
  }

  /**
   * Get comprehensive risk status for an NPC
   */
  async checkNPCRisk(actorId: string): Promise<RiskStatus> {
    const actor = StaticDataRegistry.getActor(actorId)
    const tier = this.getRiskTier(actor?.personality ?? '')
    const multiplier = RISK_TIER_MULTIPLIERS[tier]

    // Get current balance
    const [actorStateRow] = await db
      .select({ tradingBalance: actorState.tradingBalance })
      .from(actorState)
      .where(eq(actorState.id, actorId))
      .limit(1)

    const currentBalance = actorStateRow
      ? parseFloat(String(actorStateRow.tradingBalance))
      : 0

    // Get or set peak balance
    const peakBalance = Math.max(
      this.peakBalances.get(actorId) ?? currentBalance,
      currentBalance,
    )
    this.peakBalances.set(actorId, peakBalance)

    // Get or set daily starting balance
    const todayParts = new Date().toISOString().split('T')
    const today = todayParts[0] ?? ''
    const dailyStart = this.dailyStartBalances.get(actorId)
    let startingBalance = currentBalance

    if (!dailyStart || dailyStart.date !== today) {
      this.dailyStartBalances.set(actorId, {
        balance: currentBalance,
        date: today,
      })
      startingBalance = currentBalance
    } else {
      startingBalance = dailyStart.balance
    }

    // Calculate metrics
    const dailyPnL = currentBalance - startingBalance
    const dailyPnLPercent =
      startingBalance > 0 ? (dailyPnL / startingBalance) * 100 : 0
    const drawdown = peakBalance - currentBalance
    const drawdownPercent = peakBalance > 0 ? (drawdown / peakBalance) * 100 : 0

    // Get open positions
    const positions = await this.getOpenPositions(actorId)

    // Generate alerts
    const alerts: RiskAlert[] = []

    // Daily loss alert
    const dailyLossLimit = RISK_LIMITS.MAX_DAILY_LOSS_PCT * multiplier
    if (dailyPnLPercent < -dailyLossLimit) {
      alerts.push({
        type: 'daily_loss',
        severity:
          dailyPnLPercent < -(dailyLossLimit * 1.5) ? 'critical' : 'warning',
        message: `Daily loss of ${Math.abs(dailyPnLPercent).toFixed(2)}% exceeds limit of ${dailyLossLimit.toFixed(0)}%`,
        value: dailyPnLPercent,
        threshold: -dailyLossLimit,
      })
    }

    // Drawdown alert
    const drawdownLimit = RISK_LIMITS.MAX_DRAWDOWN_PCT * multiplier
    if (drawdownPercent > drawdownLimit) {
      alerts.push({
        type: 'drawdown',
        severity:
          drawdownPercent > drawdownLimit * 1.5 ? 'critical' : 'warning',
        message: `Portfolio drawdown of ${drawdownPercent.toFixed(2)}% exceeds limit of ${drawdownLimit.toFixed(0)}%`,
        value: drawdownPercent,
        threshold: drawdownLimit,
      })
    }

    // Low balance alert
    if (currentBalance < RISK_LIMITS.MIN_BALANCE) {
      alerts.push({
        type: 'low_balance',
        severity: 'critical',
        message: `Balance of ${currentBalance.toFixed(2)} BBLN is below minimum of ${RISK_LIMITS.MIN_BALANCE} BBLN`,
        value: currentBalance,
        threshold: RISK_LIMITS.MIN_BALANCE,
      })
    }

    // Check individual position risks
    for (const position of positions) {
      if (position.isAtRisk) {
        alerts.push({
          type: 'position_loss',
          severity:
            position.pnlPercent < -(RISK_LIMITS.MAX_POSITION_LOSS_PCT * 1.5)
              ? 'critical'
              : 'warning',
          message: `Position ${position.positionId} loss of ${Math.abs(position.pnlPercent).toFixed(2)}% exceeds limit`,
          value: position.pnlPercent,
          threshold: -RISK_LIMITS.MAX_POSITION_LOSS_PCT,
          positionId: position.positionId,
        })
      }
    }

    // Calculate overall risk score (0-100)
    const riskScore = this.calculateRiskScore({
      dailyPnLPercent,
      drawdownPercent,
      currentBalance,
      positionCount: positions.length,
      alerts,
    })

    const isAtRisk = alerts.length > 0
    const shouldStopTrading = alerts.some((a) => a.severity === 'critical')

    return {
      actorId,
      tier,
      currentBalance,
      startingBalance,
      dailyPnL,
      dailyPnLPercent,
      peakBalance,
      drawdown,
      drawdownPercent,
      positionCount: positions.length,
      riskScore,
      alerts,
      isAtRisk,
      shouldStopTrading,
    }
  }

  /**
   * Get open positions for NPC with risk assessment
   */
  private async getOpenPositions(actorId: string): Promise<PositionRisk[]> {
    const positions: PositionRisk[] = []

    // Get prediction positions
    const predPositions = await db
      .select()
      .from(poolPositions)
      .where(eq(poolPositions.poolId, actorId))

    for (const pos of predPositions) {
      if (pos.closedAt) continue

      const posSize = Number(pos.size)
      const pnlPercent =
        posSize > 0 ? (Number(pos.unrealizedPnL) / posSize) * 100 : 0
      const isAtRisk = pnlPercent < -RISK_LIMITS.MAX_POSITION_LOSS_PCT

      positions.push({
        positionId: String(pos.id),
        marketType: 'prediction',
        marketId: String(pos.marketId ?? ''),
        side: String(pos.side),
        size: posSize,
        entryPrice: Number(pos.entryPrice),
        currentPrice: Number(pos.currentPrice),
        unrealizedPnL: Number(pos.unrealizedPnL),
        pnlPercent,
        isAtRisk,
        riskReason: isAtRisk
          ? `Loss exceeds ${RISK_LIMITS.MAX_POSITION_LOSS_PCT}%`
          : undefined,
      })
    }

    // Perp positions would need additional schema support
    // For now, only track prediction positions

    return positions
  }

  /**
   * Close risky positions for an NPC
   */
  private async closeRiskyPositions(
    actorId: string,
    alerts: RiskAlert[],
  ): Promise<number> {
    let closedCount = 0

    for (const alert of alerts) {
      if (alert.type === 'position_loss' && alert.positionId) {
        // Mark position as closed
        await db
          .update(poolPositions)
          .set({ closedAt: new Date() })
          .where(eq(poolPositions.id, alert.positionId))

        closedCount++

        logger.warn(
          `Closed risky position for NPC ${actorId}`,
          { positionId: alert.positionId, reason: alert.message },
          'NPCRiskManagement',
        )
      }
    }

    return closedCount
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateRiskScore(params: {
    dailyPnLPercent: number
    drawdownPercent: number
    currentBalance: number
    positionCount: number
    alerts: RiskAlert[]
  }): number {
    let score = 0

    // Daily PnL factor (40% weight)
    const dailyLossFactor = Math.max(
      0,
      -params.dailyPnLPercent / RISK_LIMITS.MAX_DAILY_LOSS_PCT,
    )
    score += dailyLossFactor * 40

    // Drawdown factor (30% weight)
    const drawdownFactor = params.drawdownPercent / RISK_LIMITS.MAX_DRAWDOWN_PCT
    score += drawdownFactor * 30

    // Balance factor (20% weight)
    const balanceFactor = Math.max(
      0,
      1 - params.currentBalance / (RISK_LIMITS.MIN_BALANCE * 10),
    )
    score += balanceFactor * 20

    // Alert factor (10% weight)
    const criticalAlerts = params.alerts.filter(
      (a) => a.severity === 'critical',
    ).length
    const warningAlerts = params.alerts.filter(
      (a) => a.severity === 'warning',
    ).length
    const alertFactor = Math.min(1, criticalAlerts * 0.5 + warningAlerts * 0.25)
    score += alertFactor * 10

    return Math.min(100, Math.max(0, score))
  }

  /**
   * Determine risk tier from personality
   */
  private getRiskTier(personality: string): RiskTier {
    const p = personality.toLowerCase()

    if (
      p.includes('conservative') ||
      p.includes('careful') ||
      p.includes('cautious') ||
      p.includes('safe')
    ) {
      return 'conservative'
    }

    if (
      p.includes('aggressive') ||
      p.includes('degen') ||
      p.includes('risk') ||
      p.includes('bold')
    ) {
      return 'aggressive'
    }

    return 'moderate'
  }

  /**
   * Get risk status for all NPCs
   */
  async getAllNPCRiskStatus(): Promise<RiskStatus[]> {
    const actors = StaticDataRegistry.getAllActors()
    const statuses: RiskStatus[] = []

    for (const actor of actors) {
      const status = await this.checkNPCRisk(actor.id)
      statuses.push(status)
    }

    return statuses.sort((a, b) => b.riskScore - a.riskScore)
  }

  /**
   * Reset daily tracking (call at midnight)
   */
  resetDailyTracking(): void {
    this.dailyStartBalances.clear()
    logger.info('Daily risk tracking reset', undefined, 'NPCRiskManagement')
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let riskManagementService: NPCRiskManagementService | null = null

export function getNPCRiskManagementService(): NPCRiskManagementService {
  if (!riskManagementService) {
    riskManagementService = new NPCRiskManagementService()
  }
  return riskManagementService
}

export function resetNPCRiskManagementService(): void {
  if (riskManagementService) {
    riskManagementService.stop()
  }
  riskManagementService = null
}
