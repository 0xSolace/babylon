/**
 * Agent Authentication Service
 *
 * Handles automatic authentication for Babylon agents using internal credentials.
 * Agents authenticate once and receive a session token valid for 24 hours.
 */

import { isObject } from '@babylon/shared'
import { logger } from '@elizaos/core'
import {
  getApiErrorMessage,
  isAgentAuthResponse,
  isOnboardRegisterResponse,
  isOnboardStatusResponse,
} from './types'

export class AgentAuthService {
  private sessionToken?: string
  private tokenExpiresAt = 0
  private readonly apiBaseUrl: string
  private readonly agentId: string
  private readonly agentSecret: string

  constructor(apiBaseUrl: string, agentId?: string, agentSecret?: string) {
    this.apiBaseUrl = apiBaseUrl

    // Use environment variables or provided credentials
    this.agentId =
      agentId || process.env.BABYLON_AGENT_ID || 'babylon-agent-alice'
    this.agentSecret = agentSecret || process.env.BABYLON_AGENT_SECRET || ''

    if (!this.agentSecret) {
      logger.warn(
        '⚠️  BABYLON_AGENT_SECRET not configured. Agent will not be able to authenticate.',
      )
    }
  }

  /**
   * Get valid session token, refreshing if necessary
   */
  async getSessionToken(): Promise<string> {
    // Check if we have a valid token
    if (this.sessionToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.sessionToken
    }

    // Token expired or doesn't exist, authenticate
    return await this.authenticate()
  }

  /**
   * Authenticate with the agent auth API
   */
  async authenticate(): Promise<string> {
    if (!this.agentSecret) {
      throw new Error(
        'Cannot authenticate: BABYLON_AGENT_SECRET not configured',
      )
    }

    logger.info(`🔐 Authenticating agent: ${this.agentId}...`)

    const response = await fetch(`${this.apiBaseUrl}/api/agents/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: this.agentId,
        agentSecret: this.agentSecret,
      }),
    })

    if (!response.ok) {
      const errorData: unknown = await response.json()
      throw new Error(
        `Agent authentication failed: ${getApiErrorMessage(errorData, response.statusText)}`,
      )
    }

    const data: unknown = await response.json()

    if (!isAgentAuthResponse(data) || !data.success || !data.sessionToken) {
      const errorMsg =
        isObject(data) && typeof data.error === 'string'
          ? data.error
          : 'Unknown error'
      throw new Error(`Agent authentication failed: ${errorMsg}`)
    }

    // Store session token
    this.sessionToken = data.sessionToken
    this.tokenExpiresAt = data.expiresAt || Date.now() + 24 * 60 * 60 * 1000

    logger.info(
      `✅ Agent authenticated successfully (expires in ${Math.floor((this.tokenExpiresAt - Date.now()) / 1000 / 60)} minutes)`,
    )

    // Check and trigger on-chain registration if needed
    await this.checkAndRegisterOnChain()

    return this.sessionToken
  }

  private registrationCheckPromise?: Promise<void>

  /**
   * Check if agent is registered on-chain and register if not
   * Uses a promise cache to prevent concurrent registration attempts
   */
  private async checkAndRegisterOnChain(): Promise<void> {
    if (!this.sessionToken) {
      return
    }

    // If registration check is already in progress, wait for it
    if (this.registrationCheckPromise) {
      return this.registrationCheckPromise
    }

    // Create and cache the registration check promise
    this.registrationCheckPromise = (async (): Promise<void> => {
      // Check registration status
      const statusResponse = await fetch(
        `${this.apiBaseUrl}/api/agents/onboard`,
        {
          headers: {
            Authorization: `Bearer ${this.sessionToken}`,
          },
        },
      )

      if (!statusResponse.ok) {
        throw new Error('Failed to check agent registration status')
      }

      const statusData: unknown = await statusResponse.json()

      if (!isOnboardStatusResponse(statusData)) {
        throw new Error('Invalid onboard status response format')
      }

      if (statusData.isRegistered && statusData.tokenId) {
        logger.info(
          `✅ Agent already registered on-chain with token ID: ${statusData.tokenId}`,
        )
        return
      }

      // Not registered, trigger registration
      logger.info('🔗 Registering agent on-chain...')

      const registerResponse = await fetch(
        `${this.apiBaseUrl}/api/agents/onboard`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.sessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agentName: this.agentId,
            endpoint: `${this.apiBaseUrl}/agent/${this.agentId}`,
          }),
        },
      )

      if (!registerResponse.ok) {
        const errorData: unknown = await registerResponse.json()
        throw new Error(
          `Failed to register agent on-chain: ${getApiErrorMessage(errorData, 'Unknown error')}`,
        )
      }

      const registerData: unknown = await registerResponse.json()
      if (!isOnboardRegisterResponse(registerData)) {
        throw new Error('Invalid onboard register response format')
      }

      logger.info(
        `✅ Agent registered on-chain! Token ID: ${registerData.tokenId}, Wallet: ${registerData.walletAddress}`,
      )
    })().finally(() => {
      // Clear the promise cache after completion
      this.registrationCheckPromise = undefined
    })

    return this.registrationCheckPromise
  }

  /**
   * Clear stored session token
   */
  clearSession(): void {
    this.sessionToken = undefined
    this.tokenExpiresAt = 0
  }

  /**
   * Check if agent has valid credentials configured
   */
  hasCredentials(): boolean {
    return !!this.agentSecret
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId
  }
}
