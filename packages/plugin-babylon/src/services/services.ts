/**
 * Babylon Game Services
 *
 * Services handle background operations and long-running integrations.
 * BabylonTradingService manages automated market monitoring and portfolio review.
 * SocialInteractionService manages autonomous social interactions.
 */

import { type IAgentRuntime, logger, type Memory, Service } from '@elizaos/core'
import type { SocialInteractionState } from '../types'
import { assertDefined, BABYLON_ROOM_ID, SYSTEM_ENTITY_ID } from '../types'

// Note: BabylonTradingService is defined in plugin.ts, not here
// This file only contains SocialInteractionService

/**
 * Social Interaction Service
 *
 * Autonomous service following ElizaOS patterns:
 * - Periodically triggers social feed evaluation
 * - Uses evaluators to decide when to interact
 * - Executes actions through runtime.processActions()
 *
 * This follows the same pattern as BabylonTradingService:
 * Provider → Evaluator → Action
 */
export class SocialInteractionService extends Service {
  static override serviceType = 'babylon-social' as const

  override capabilityDescription =
    'Autonomous social interactions including liking posts, creating posts, following users, and commenting'

  private socialCheckInterval?: NodeJS.Timeout
  private lastCheckTime = 0
  private checkIntervalMs: number
  private interactionCooldown = 30000 // 30 seconds minimum between interactions

  constructor(runtime: IAgentRuntime) {
    super(runtime)

    // Randomize check interval (5-15 minutes) to feel natural
    const baseInterval = 5 * 60 * 1000 // 5 minutes base
    this.checkIntervalMs = baseInterval + Math.random() * 10 * 60 * 1000 // 5-15 min
  }

  /**
   * Static factory method - called by ElizaOS
   */
  static override async start(
    runtime: IAgentRuntime,
  ): Promise<SocialInteractionService> {
    logger.info('Starting SocialInteractionService')
    const service = new SocialInteractionService(runtime)
    logger.info(
      `🤖 Social Interaction Service created - check interval: ${Math.round(service.checkIntervalMs / 60000)}min`,
    )
    return service
  }

  /**
   * Instance start method - called automatically after static start()
   */
  async start(): Promise<void> {
    this.runtime.logger.info('🚀 Starting Social Interaction Service')

    // Start periodic social feed checks
    this.socialCheckInterval = setInterval(async () => {
      if (Date.now() - this.lastCheckTime < this.interactionCooldown) {
        return
      }

      await this.checkAndInteract()
      this.lastCheckTime = Date.now()
    }, this.checkIntervalMs)
  }

  /**
   * Instance stop method - cleanup
   */
  override async stop(): Promise<void> {
    if (this.socialCheckInterval) {
      clearInterval(this.socialCheckInterval)
      this.socialCheckInterval = undefined
    }

    this.runtime.logger.info('✅ Social Interaction Service stopped')
  }

  /**
   * Static stop method - called by ElizaOS
   */
  static override async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('Stopping SocialInteractionService')
    const service = runtime.getService<SocialInteractionService>(
      SocialInteractionService.serviceType,
    )
    assertDefined(service, 'SocialInteractionService')
    await service.stop()
  }

  /**
   * Check social feed and trigger interactions using ElizaOS pattern
   * Provider → Evaluator → Action
   */
  private async checkAndInteract(): Promise<void> {
    this.runtime.logger.info(
      `📱 [${new Date().toLocaleTimeString()}] Checking social feed...`,
    )

    const socialMessage: Memory = {
      entityId: SYSTEM_ENTITY_ID,
      agentId: this.runtime.agentId,
      roomId: BABYLON_ROOM_ID,
      content: {
        text: 'check social feed',
      },
      createdAt: Date.now(),
    }

    const state = await this.runtime.composeState(socialMessage)
    await this.runtime.evaluate(socialMessage, state, false)

    // Access state properties with proper typing
    const socialState = state as SocialInteractionState
    const shouldLike = socialState.shouldLike
    const shouldComment = socialState.shouldComment
    const shouldFollow = socialState.shouldFollow
    const shouldPost = socialState.shouldPost
    const targetPostId = socialState.targetPostId
    const targetUserId = socialState.targetUserId

    if (shouldLike && targetPostId) {
      await this.executeLikeAction(targetPostId)
    }

    if (shouldComment && targetPostId) {
      await this.executeCommentAction(targetPostId)
    }

    if (shouldFollow && targetUserId) {
      await this.executeFollowAction(targetUserId)
    }

    if (shouldPost) {
      await this.executePostAction()
    }

    if (!shouldLike && !shouldComment && !shouldFollow && !shouldPost) {
      this.runtime.logger.info('   No social interactions recommended')
    }
  }

  /**
   * Execute like action through ElizaOS action system
   */
  private async executeLikeAction(postId: string): Promise<void> {
    const likeMessage: Memory = {
      entityId: SYSTEM_ENTITY_ID,
      agentId: this.runtime.agentId,
      roomId: BABYLON_ROOM_ID,
      content: {
        text: `like post ${postId}`,
      },
      createdAt: Date.now(),
    }

    const state = await this.runtime.composeState(likeMessage)
    Object.assign(state, { postId })

    await this.runtime.processActions(
      likeMessage,
      [],
      state,
      async (response) => {
        if (response.error) {
          this.runtime.logger.error(`   ❌ Like failed: ${response.text}`)
        } else {
          this.runtime.logger.info(`   👍 ${response.text}`)
        }
        return []
      },
    )
  }

  /**
   * Execute comment action through ElizaOS action system
   */
  private async executeCommentAction(postId: string): Promise<void> {
    const character = this.runtime.character
    const topics = character.topics || ['prediction markets']
    const topic = topics[Math.floor(Math.random() * topics.length)]

    // Simple comment templates (in production, use LLM for natural responses)
    const comments = [
      'Interesting perspective',
      'Good point',
      'Agreed',
      `Thoughts on ${topic}?`,
      'Thanks for sharing',
    ]

    const content = comments[Math.floor(Math.random() * comments.length)]

    const commentMessage: Memory = {
      entityId: SYSTEM_ENTITY_ID,
      agentId: this.runtime.agentId,
      roomId: BABYLON_ROOM_ID,
      content: {
        text: content,
      },
      createdAt: Date.now(),
    }

    const state = await this.runtime.composeState(commentMessage)
    Object.assign(state, { postId })
    Object.assign(state, { commentContent: content })

    await this.runtime.processActions(
      commentMessage,
      [],
      state,
      async (response) => {
        if (response.error) {
          this.runtime.logger.error(`   ❌ Comment failed: ${response.text}`)
        } else {
          this.runtime.logger.info(`   💬 ${response.text}`)
        }
        return []
      },
    )
  }

  /**
   * Execute follow action through ElizaOS action system
   */
  private async executeFollowAction(userId: string): Promise<void> {
    const followMessage: Memory = {
      entityId: SYSTEM_ENTITY_ID,
      agentId: this.runtime.agentId,
      roomId: BABYLON_ROOM_ID,
      content: {
        text: `follow user ${userId}`,
      },
      createdAt: Date.now(),
    }

    const state = await this.runtime.composeState(followMessage)
    Object.assign(state, { userId })

    await this.runtime.processActions(
      followMessage,
      [],
      state,
      async (response) => {
        if (response.error) {
          this.runtime.logger.error(`   ❌ Follow failed: ${response.text}`)
        } else {
          this.runtime.logger.info(`   👤 ${response.text}`)
        }
        return []
      },
    )
  }

  /**
   * Execute post creation action through ElizaOS action system
   */
  private async executePostAction(): Promise<void> {
    const character = this.runtime.character
    const topics = character.topics || ['prediction markets', 'trading']
    const topic = topics[Math.floor(Math.random() * topics.length)]

    // Simple post templates (in production, use LLM for personality-driven content)
    const templates = [
      `Watching ${topic} closely today 📊`,
      `Interesting movements in ${topic}...`,
      `Thoughts on recent ${topic} developments?`,
      `Keeping an eye on ${topic} trends`,
    ]

    const content = templates[Math.floor(Math.random() * templates.length)]

    const postMessage: Memory = {
      entityId: SYSTEM_ENTITY_ID,
      agentId: this.runtime.agentId,
      roomId: BABYLON_ROOM_ID,
      content: {
        text: content,
      },
      createdAt: Date.now(),
    }

    const state = await this.runtime.composeState(postMessage)
    Object.assign(state, { postContent: content })

    await this.runtime.processActions(
      postMessage,
      [],
      state,
      async (response) => {
        if (response.error) {
          this.runtime.logger.error(`   ❌ Post failed: ${response.text}`)
        } else {
          this.runtime.logger.info(`   📝 ${response.text}`)
        }
        return []
      },
    )
  }
}
