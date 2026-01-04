import { type IAgentRuntime, logger, ModelType, Service } from '@elizaos/core'
import type { BabylonApiClient } from '../api-client'
import { BabylonClientService } from '../plugin'
import { assertDefined } from '../types'

/**
 * Chat message generation prompt template for LLM
 */
const CHAT_MESSAGE_PROMPT = `You are participating in a Babylon prediction market chat room.
The chat theme is: {{theme}}

Generate a short, engaging message (1-2 sentences) that:
- Is relevant to the theme
- Encourages discussion or shares an interesting perspective
- Sounds natural and conversational
- Does NOT include any greetings or sign-offs

Respond with ONLY the message text, nothing else.`

/**
 * Fallback messages when LLM generation fails
 */
const FALLBACK_MESSAGES = [
  'Interesting topic about {{theme}}. What are your thoughts?',
  "I've been thinking about {{theme}} lately. Anyone want to discuss?",
  '{{theme}} is such a fascinating subject. Lets explore it together.',
  'Has anyone considered the implications of {{theme}}?',
  'I would love to hear different perspectives on {{theme}}.',
] as const

export class BabylonChatService extends Service {
  static override serviceType = 'babylon_chat' as const

  override capabilityDescription =
    'Babylon chat service for automated participation in chat rooms based on themes'

  private chatInterval?: NodeJS.Timeout
  private apiClient?: BabylonApiClient

  /**
   * Static factory method - called by ElizaOS
   */
  static override async start(
    runtime: IAgentRuntime,
  ): Promise<BabylonChatService> {
    logger.info('Starting BabylonChatService')
    const service = new BabylonChatService(runtime)
    return service
  }

  /**
   * Instance start method - called automatically after static start()
   */
  async start(): Promise<void> {
    const babylonService = this.runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')
    this.apiClient = babylonService.getClient()
    this.runtime.logger.info('Starting Babylon Chat Service...')
    this.chatInterval = setInterval(
      () => this.postRandomMessage(),
      2 * 60 * 1000,
    ) // Every 2 minutes
    this.runtime.logger.info('Babylon Chat Service started')
  }

  private async postRandomMessage(): Promise<void> {
    this.runtime.logger.info('Checking for a random chat to post in...')

    if (!this.apiClient) {
      this.runtime.logger.warn('API client not initialized')
      return
    }

    const chats = await this.apiClient.getChats()

    if (chats.length === 0) {
      this.runtime.logger.info('No active chats to post in.')
      return
    }

    const randomChat = chats[Math.floor(Math.random() * chats.length)]
    const messageContent = await this.generateChatMessage(randomChat.theme)

    await this.apiClient.sendMessage(randomChat.id, messageContent)
    this.runtime.logger.info(
      `Posted message to chat "${randomChat.name}": "${messageContent}"`,
    )
  }

  /**
   * Generate a chat message using the LLM for dynamic, contextual content.
   * Falls back to template messages if LLM generation fails.
   *
   * @param theme - The chat room theme to generate content about
   * @returns Generated message string
   */
  private async generateChatMessage(theme: string): Promise<string> {
    // Try LLM-based generation first
    const llmMessage = await this.generateMessageWithLLM(theme)
    if (llmMessage) {
      return llmMessage
    }

    // Fallback to template-based generation
    return this.generateFallbackMessage(theme)
  }

  /**
   * Generate a message using the LLM
   *
   * @param theme - The chat theme
   * @returns Generated message or null if generation fails
   */
  private async generateMessageWithLLM(theme: string): Promise<string | null> {
    const prompt = CHAT_MESSAGE_PROMPT.replace(/\{\{theme\}\}/g, theme)

    const response = await this.runtime.useModel(ModelType.TEXT_SMALL, {
      prompt,
      temperature: 0.8, // Higher temperature for more varied responses
      maxTokens: 100,
    })

    if (typeof response !== 'string' || response.trim().length === 0) {
      this.runtime.logger.warn('LLM returned empty response, using fallback')
      return null
    }

    // Clean up the response - remove quotes and extra whitespace
    const cleanedResponse = response
      .trim()
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/\s+/g, ' ') // Normalize whitespace

    // Validate response is reasonable length
    if (cleanedResponse.length < 10 || cleanedResponse.length > 500) {
      this.runtime.logger.warn(
        `LLM response length invalid (${cleanedResponse.length}), using fallback`,
      )
      return null
    }

    return cleanedResponse
  }

  /**
   * Generate a fallback message from templates when LLM is unavailable
   *
   * @param theme - The chat theme
   * @returns Template-based message
   */
  private generateFallbackMessage(theme: string): string {
    const template =
      FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)]
    return template.replace(/\{\{theme\}\}/g, theme)
  }

  /**
   * Instance stop method - cleanup
   */
  override async stop(): Promise<void> {
    this.runtime.logger.info('🛑 Stopping Babylon Chat Service...')
    if (this.chatInterval) {
      clearInterval(this.chatInterval)
      this.chatInterval = undefined
    }
    this.runtime.logger.info('✅ Babylon Chat Service stopped')
  }

  /**
   * Static stop method - called by ElizaOS
   */
  static override async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('Stopping BabylonChatService')
    const service = runtime.getService<BabylonChatService>(
      BabylonChatService.serviceType,
    )
    assertDefined(service, 'BabylonChatService')
    await service.stop()
  }
}
