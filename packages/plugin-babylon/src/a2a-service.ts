/**
 * A2A Service for ElizaOS Plugin
 *
 * TODO: This service needs to be updated to use the actual A2A SDK.
 * Currently stubbed to allow compilation.
 *
 * The real implementation should use @a2a-js/sdk for A2A protocol communication.
 */

import type { IAgentRuntime } from '@elizaos/core'
import { logger, Service } from '@elizaos/core'

/**
 * Local type definitions for A2A integration
 * TODO: Import from @babylon/a2a once proper client is available
 */
interface AgentCapabilities {
  strategies: string[]
  markets: string[]
  actions: string[]
  version: string
  skills?: string[]
  domains?: string[]
}

interface AgentProfile {
  agentId: string
  address: string
  capabilities: AgentCapabilities
  reputation?: number
}

interface MarketData {
  marketId: string
  prices?: number[]
  volume?: string
  timestamp: number
}

interface A2AServiceConfig {
  endpoint?: string
  enabled?: boolean
  autoReconnect?: boolean
  reconnectInterval?: number
  heartbeatInterval?: number
}

/**
 * Babylon A2A Service
 *
 * Provides agent-to-agent communication capabilities for ElizaOS plugins.
 * TODO: Implement actual A2A WebSocket client using @a2a-js/sdk
 */
export class BabylonA2AService extends Service {
  static override serviceType = 'babylon-a2a' as const

  override capabilityDescription =
    'A2A integration for agent-to-agent communication (stub implementation)'

  private a2aConfig: A2AServiceConfig
  private connected = false

  constructor(runtime: IAgentRuntime, config: A2AServiceConfig = {}) {
    super(runtime)
    this.a2aConfig = {
      enabled: !!config.endpoint,
      autoReconnect: true,
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
      ...config,
    }
  }

  static override async start(
    runtime: IAgentRuntime,
    config?: A2AServiceConfig,
  ): Promise<BabylonA2AService> {
    logger.info('Starting BabylonA2AService (stub)')
    const service = new BabylonA2AService(runtime, config)
    return service
  }

  async start(): Promise<void> {
    if (!this.a2aConfig.enabled || !this.a2aConfig.endpoint) {
      logger.info('A2A integration disabled or endpoint not configured')
      return
    }

    logger.warn(
      'A2A service is a stub implementation - real A2A client not yet integrated',
    )
    this.connected = false
  }

  async connect(): Promise<void> {
    logger.warn('A2A connect() called but service is stub - no-op')
  }

  async getMarketData(_marketId: string): Promise<MarketData> {
    logger.warn('A2A getMarketData() called but service is stub')
    return {
      marketId: _marketId,
      prices: [],
      volume: '0',
      timestamp: Date.now(),
    }
  }

  async subscribeMarket(marketId: string): Promise<void> {
    logger.warn(`A2A subscribeMarket(${marketId}) called but service is stub`)
  }

  async discoverAgents(_filters?: {
    strategies?: string[]
    minReputation?: number
    markets?: string[]
  }): Promise<{ agents: AgentProfile[]; total: number }> {
    logger.warn('A2A discoverAgents() called but service is stub')
    return { agents: [], total: 0 }
  }

  async shareAnalysis(analysis: {
    marketId: string
    analyst: string
    prediction: number
    confidence: number
    reasoning: string
    dataPoints?: Record<string, unknown>
    timestamp: number
  }): Promise<void> {
    logger.warn(
      `A2A shareAnalysis() called for ${analysis.marketId} but service is stub`,
    )
  }

  isConnected(): boolean {
    return this.connected
  }

  async disconnect(): Promise<void> {
    this.connected = false
    logger.info('A2A service disconnected (stub)')
  }

  override async stop(): Promise<void> {
    await this.disconnect()
    this.runtime.logger.info('✅ Babylon A2A Service stopped')
  }

  static override async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('Stopping BabylonA2AService')
    const service = runtime.getService<BabylonA2AService>(
      BabylonA2AService.serviceType,
    )
    await service?.stop()
  }
}
