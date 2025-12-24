import {
  getICOAutomationService,
  getICOTriggersService,
  getLiquidityPoolService,
  type ICOTriggerConfig,
  initializeICOTriggers,
} from '@babylon/api'
import { toAddress, toHexString } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import { formatEther } from 'viem'
import {
  authMiddleware,
  getAuthContext,
  requireAdmin,
} from '../middleware/auth'
import { heavyRateLimiter } from '../middleware/rate-limit'
import { toPoolFee } from '../utils'

/**
 * ICO Routes
 *
 * Public and admin endpoints for BBLN token ICO management.
 *
 * Public endpoints:
 * - GET /api/ico/status - Get current ICO status
 *
 * Admin endpoints:
 * - POST /api/admin/ico/schedule - Schedule ICO timeline
 * - POST /api/admin/ico/trigger - Manual trigger for phase transitions
 * - GET /api/admin/ico/config - Get ICO configuration
 * - POST /api/admin/ico/initialize - Initialize ICO services
 */

// =============================================================================
// PUBLIC ICO ROUTES
// =============================================================================

const createIcoPublicRoutes = () =>
  new Elysia({ prefix: '/api/ico' })
    .use(authMiddleware)

    // Get current ICO status
    .get(
      '/status',
      async () => {
        try {
          const triggersService = getICOTriggersService()
          const status = await triggersService.getICOStatus()

          return {
            phase: status.phase,
            totalRaised: formatEther(status.totalRaised),
            totalRaisedWei: status.totalRaised.toString(),
            participants: status.participants,
            tokensSold: status.tokensSold.toString(),
            currentPrice: formatEther(status.currentPrice),
            currentPriceWei: status.currentPrice.toString(),
            timeRemaining: status.timeRemaining,
            nextPhaseAt: status.nextPhaseAt,
            nextPhaseAtISO:
              status.nextPhaseAt > 0
                ? new Date(status.nextPhaseAt * 1000).toISOString()
                : null,
          }
        } catch (_error) {
          // Service not initialized yet
          return {
            phase: 'NOT_STARTED',
            totalRaised: '0',
            totalRaisedWei: '0',
            participants: 0,
            tokensSold: '0',
            currentPrice: '0',
            currentPriceWei: '0',
            timeRemaining: 0,
            nextPhaseAt: 0,
            nextPhaseAtISO: null,
            message: 'ICO not yet initialized',
          }
        }
      },
      {
        detail: {
          tags: ['ICO'],
          summary: 'Get current ICO status',
          description:
            'Returns the current phase, total raised, participant count, and time remaining',
        },
      },
    )

    // Get pool info
    .get(
      '/pool',
      async () => {
        try {
          const lpService = getLiquidityPoolService()
          const poolInfo = await lpService.getPoolInfo()
          const price = await lpService.getTokenPrice()

          return {
            pairAddress: poolInfo.pairAddress,
            reserve0: poolInfo.reserve0.toString(),
            reserve1: poolInfo.reserve1.toString(),
            lpTotalSupply: poolInfo.lpTotalSupply.toString(),
            priceInEth: price.priceInEth,
            priceInUsd: price.priceInUsd,
          }
        } catch (_error) {
          return {
            pairAddress: null,
            reserve0: '0',
            reserve1: '0',
            lpTotalSupply: '0',
            priceInEth: 0,
            priceInUsd: 0,
            message: 'Pool not yet created',
          }
        }
      },
      {
        detail: {
          tags: ['ICO'],
          summary: 'Get liquidity pool info',
          description:
            'Returns the BBLN/WETH pool information and current price',
        },
      },
    )

    // Get contribution for authenticated user
    .get(
      '/contribution',
      async (ctx) => {
        const { user } = getAuthContext(ctx)
        if (!user?.walletAddress) {
          return {
            ethAmount: '0',
            tokenAllocation: '0',
            claimedTokens: '0',
            claimable: '0',
            isRefunded: false,
            elizaBonus: '0',
          }
        }

        try {
          const icoService = getICOAutomationService()
          const contribution = await icoService.getContribution(
            user.walletAddress,
          )

          return {
            address: contribution.address,
            ethAmount: formatEther(contribution.ethAmount),
            ethAmountWei: contribution.ethAmount.toString(),
            tokenAllocation: contribution.tokenAllocation.toString(),
            claimedTokens: contribution.claimedTokens.toString(),
            claimable: contribution.claimable.toString(),
            isRefunded: contribution.isRefunded,
            elizaBonus: contribution.elizaBonus.toString(),
          }
        } catch {
          return {
            ethAmount: '0',
            tokenAllocation: '0',
            claimedTokens: '0',
            claimable: '0',
            isRefunded: false,
            elizaBonus: '0',
          }
        }
      },
      {
        detail: {
          tags: ['ICO'],
          summary: 'Get user contribution',
          description:
            'Returns the contribution details for the authenticated user',
        },
      },
    )

export const icoPublicRoutes = createIcoPublicRoutes()

// =============================================================================
// ADMIN ICO ROUTES
// =============================================================================

const createIcoAdminRoutes = () =>
  new Elysia({ prefix: '/api/admin/ico' })
    .use(requireAdmin)
    .use(heavyRateLimiter)

    // Schedule ICO timeline
    .post(
      '/schedule',
      async ({ body }) => {
        const { timeline, lpConfig, presaleAddress, tokenAddress } = body

        const config: ICOTriggerConfig = {
          presaleAddress: toAddress(presaleAddress),
          tokenAddress: toAddress(tokenAddress),
          timeline: {
            deployAt: timeline.deployAt,
            whitelistStart: timeline.whitelistStart,
            publicStart: timeline.publicStart,
            presaleEnd: timeline.presaleEnd,
            tgeTimestamp: timeline.tgeTimestamp,
          },
          lpConfig: {
            poolFee: toPoolFee(lpConfig.poolFee),
            ethPercentForLP: lpConfig.ethPercentForLP,
            lockDuration: lpConfig.lockDuration,
          },
        }

        try {
          const service = await initializeICOTriggers(config)
          await service.scheduleICO()

          return {
            success: true,
            message: 'ICO scheduled successfully',
            config: service.getConfig(),
            scheduledTriggers: service.getScheduledTriggers().map((t) => ({
              id: t.id,
              name: t.name,
              type: t.type,
              cronExpression: t.cronExpression,
              active: t.active,
            })),
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false,
            error: message,
          }
        }
      },
      {
        body: t.Object({
          presaleAddress: t.String(),
          tokenAddress: t.String(),
          timeline: t.Object({
            deployAt: t.Number(),
            whitelistStart: t.Number(),
            publicStart: t.Number(),
            presaleEnd: t.Number(),
            tgeTimestamp: t.Number(),
          }),
          lpConfig: t.Object({
            poolFee: t.Number(),
            ethPercentForLP: t.Number(),
            lockDuration: t.Number(),
          }),
        }),
        detail: {
          tags: ['Admin', 'ICO'],
          summary: 'Schedule ICO timeline',
          description:
            'Schedule the ICO with whitelist, public sale, and TGE timestamps',
        },
      },
    )

    // Manual trigger for phase transitions
    .post(
      '/trigger',
      async ({ body }) => {
        const { phase, action } = body

        try {
          const triggersService = getICOTriggersService()

          // If action is 'check', run the time-based check
          if (action === 'check') {
            const result = await triggersService.handleTimeTrigger()
            return {
              success: true,
              action: result.action,
              result: result.result
                ? {
                    phase: result.result.phase,
                    txHash: result.result.txHash,
                    timestamp: result.result.timestamp,
                    details: result.result.details,
                  }
                : undefined,
            }
          }

          // Manual phase triggers
          let result:
            | Awaited<ReturnType<typeof triggersService.executeWhitelistStart>>
            | undefined
          switch (phase) {
            case 'WHITELIST':
              result = await triggersService.executeWhitelistStart()
              break
            case 'PUBLIC':
              result = await triggersService.executePublicStart()
              break
            case 'ENDED':
              result = await triggersService.executePresaleEnd()
              break
            case 'DISTRIBUTION':
              result = await triggersService.executeTGE()
              break
            default:
              return {
                success: false,
                error: `Unknown phase: ${phase}`,
              }
          }

          return {
            success: true,
            phase: result.phase,
            txHash: result.txHash,
            timestamp: result.timestamp,
            details: result.details,
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false,
            error: message,
          }
        }
      },
      {
        body: t.Object({
          phase: t.Optional(
            t.Union([
              t.Literal('WHITELIST'),
              t.Literal('PUBLIC'),
              t.Literal('ENDED'),
              t.Literal('DISTRIBUTION'),
            ]),
          ),
          action: t.Optional(t.Literal('check')),
        }),
        detail: {
          tags: ['Admin', 'ICO'],
          summary: 'Manual trigger for ICO phase',
          description:
            'Manually trigger a phase transition or run the time-based check',
        },
      },
    )

    // Get ICO configuration
    .get(
      '/config',
      async () => {
        try {
          const triggersService = getICOTriggersService()
          const config = triggersService.getConfig()
          const scheduledTriggers = triggersService.getScheduledTriggers()

          return {
            presaleAddress: config.presaleAddress,
            tokenAddress: config.tokenAddress,
            timeline: {
              deployAt: config.timeline.deployAt,
              deployAtISO: new Date(
                config.timeline.deployAt * 1000,
              ).toISOString(),
              whitelistStart: config.timeline.whitelistStart,
              whitelistStartISO: new Date(
                config.timeline.whitelistStart * 1000,
              ).toISOString(),
              publicStart: config.timeline.publicStart,
              publicStartISO: new Date(
                config.timeline.publicStart * 1000,
              ).toISOString(),
              presaleEnd: config.timeline.presaleEnd,
              presaleEndISO: new Date(
                config.timeline.presaleEnd * 1000,
              ).toISOString(),
              tgeTimestamp: config.timeline.tgeTimestamp,
              tgeTimestampISO: new Date(
                config.timeline.tgeTimestamp * 1000,
              ).toISOString(),
            },
            lpConfig: config.lpConfig,
            scheduledTriggers: scheduledTriggers.map((t) => ({
              id: t.id,
              name: t.name,
              type: t.type,
              cronExpression: t.cronExpression,
              active: t.active,
            })),
          }
        } catch {
          return {
            error: 'ICO not configured',
            message: 'Use POST /api/admin/ico/schedule to configure the ICO',
          }
        }
      },
      {
        detail: {
          tags: ['Admin', 'ICO'],
          summary: 'Get ICO configuration',
          description:
            'Returns the current ICO configuration and scheduled triggers',
        },
      },
    )

    // Initialize ICO automation services
    .post(
      '/initialize',
      async ({ body }) => {
        const {
          chainId,
          rpcUrl,
          presaleAddress,
          tokenAddress,
          deployerPrivateKey,
        } = body

        try {
          const icoService = getICOAutomationService({
            chainId,
            rpcUrl,
            presaleAddress: toAddress(presaleAddress),
            tokenAddress: toAddress(tokenAddress),
            deployerPrivateKey: toHexString(deployerPrivateKey),
            devMode: process.env.NODE_ENV !== 'production',
          })

          await icoService.initialize()
          const status = await icoService.getFullStatus()

          return {
            success: true,
            message: 'ICO automation initialized',
            status: {
              phase: status.phase.name,
              stats: {
                totalRaised: status.stats.totalRaised.toString(),
                participants: status.stats.totalParticipants,
                isActive: status.stats.isActive,
                isFinalized: status.stats.isFinalized,
              },
              scheduledTasks: status.scheduledTasks,
            },
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false,
            error: message,
          }
        }
      },
      {
        body: t.Object({
          chainId: t.Optional(t.Number()),
          rpcUrl: t.Optional(t.String()),
          presaleAddress: t.String(),
          tokenAddress: t.String(),
          deployerPrivateKey: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Admin', 'ICO'],
          summary: 'Initialize ICO automation',
          description:
            'Initialize the ICO automation service with contract addresses',
        },
      },
    )

    // Start presale manually
    .post(
      '/start',
      async () => {
        try {
          const icoService = getICOAutomationService()
          const txHash = await icoService.startPresale()

          return {
            success: true,
            message: 'Presale started',
            txHash,
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false,
            error: message,
          }
        }
      },
      {
        detail: {
          tags: ['Admin', 'ICO'],
          summary: 'Start presale',
          description:
            'Manually start the presale (requires initialized service)',
        },
      },
    )

    // Finalize presale and execute TGE
    .post(
      '/finalize',
      async () => {
        try {
          const icoService = getICOAutomationService()
          const result = await icoService.finalize()

          return {
            success: result.success,
            message: result.success
              ? 'TGE completed successfully'
              : 'Presale failed - soft cap not reached',
            lpPairAddress: result.lpPairAddress,
            tokensDistributed: result.tokensDistributed.toString(),
            ethToTreasury: result.ethToTreasury.toString(),
            ethToLiquidity: result.ethToLiquidity.toString(),
            txHash: result.txHash,
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          return {
            success: false,
            error: message,
          }
        }
      },
      {
        detail: {
          tags: ['Admin', 'ICO'],
          summary: 'Finalize presale and execute TGE',
          description:
            'Finalize the presale, distribute tokens, and create liquidity pool',
        },
      },
    )

    // Get full ICO status (admin view)
    .get(
      '/status',
      async () => {
        try {
          const icoService = getICOAutomationService()
          const status = await icoService.getFullStatus()

          return {
            phase: status.phase,
            stats: {
              totalRaised: status.stats.totalRaised.toString(),
              totalRaisedEth: formatEther(status.stats.totalRaised),
              participants: status.stats.totalParticipants,
              tokensAllocated: status.stats.tokensAllocated.toString(),
              progress: status.stats.progress,
              timeRemaining: status.stats.timeRemaining,
              isActive: status.stats.isActive,
              isFinalized: status.stats.isFinalized,
              isFailed: status.stats.isFailed,
            },
            config: {
              chainId: status.config.chainId,
              presaleAddress: status.config.presaleAddress,
              tokenAddress: status.config.tokenAddress,
              devMode: status.config.devMode,
            },
            scheduledTasks: status.scheduledTasks,
          }
        } catch {
          return {
            error: 'ICO service not initialized',
            message: 'Use POST /api/admin/ico/initialize first',
          }
        }
      },
      {
        detail: {
          tags: ['Admin', 'ICO'],
          summary: 'Get full ICO status (admin)',
          description: 'Returns detailed ICO status including configuration',
        },
      },
    )

export const icoAdminRoutes = createIcoAdminRoutes()

// =============================================================================
// COMBINED ROUTES
// =============================================================================

const createIcoRoutes = () =>
  new Elysia({ name: 'ico-routes' }).use(icoPublicRoutes).use(icoAdminRoutes)

export const icoRoutes = createIcoRoutes()
