/**
 * Babylon Game Actions
 *
 * Eliza actions for interacting with Babylon prediction markets
 */

import type {
  Action,
  ActionResult,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core'
import { BabylonClientService } from '../plugin'
import type {
  BabylonActionOptions,
  BabylonActionState,
  TradeRequest,
} from '../types'
import { assertDefined, toDataRecord } from '../types'

/**
 * Buy Shares Action
 *
 * Allows agents to place bets on prediction markets
 */
export const buySharesAction: Action = {
  name: 'BUY_SHARES',
  similes: ['BUY', 'PLACE_BET', 'TAKE_POSITION', 'ENTER_MARKET', 'BET_ON'],
  description: 'Buy shares in a prediction market',
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    // Check if agent has Babylon service configured
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    if (!babylonService) {
      runtime.logger.error('Babylon service not configured')
      return false
    }

    // Extract market intent from message
    const content = message.content.text?.toLowerCase() || ''
    const hasBuyIntent =
      content.includes('buy') ||
      content.includes('bet') ||
      content.includes('take position') ||
      content.includes('go long') ||
      content.includes('yes on') ||
      content.includes('no on')

    return hasBuyIntent
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()

    if (message.content.text) {
      runtime.logger.debug(
        `BUY_SHARES triggered by: ${message.content.text.substring(0, 100)}`,
      )
    }

    // Extract state and options with proper types
    const actionState = state as BabylonActionState | undefined
    const actionOptions = options as BabylonActionOptions | undefined
    const marketId = actionState?.marketId || actionOptions?.marketId

    if (!marketId || typeof marketId !== 'string') {
      throw new Error('No market specified for trade')
    }

    // Determine trade side - use explicit side or default to 'yes'
    const stateSide = actionState?.side
    const optionsSide = actionOptions?.side
    const side: 'yes' | 'no' =
      stateSide === 'yes' || stateSide === 'no'
        ? stateSide
        : optionsSide === 'yes' || optionsSide === 'no'
          ? optionsSide
          : 'yes'

    const tradeRequest: TradeRequest = {
      marketId,
      side,
      amount: actionState?.amount || actionOptions?.amount || 10,
    }

    const wallet = await client.getWallet()
    if (wallet.availableBalance < tradeRequest.amount) {
      throw new Error(
        `Insufficient balance. Available: $${wallet.availableBalance}, Required: $${tradeRequest.amount}`,
      )
    }

    runtime.logger.info(
      `Buying ${tradeRequest.side} shares for $${tradeRequest.amount} on market ${tradeRequest.marketId}`,
    )
    const result = await client.buyShares(tradeRequest)

    const shares = result.shares ?? 0
    const avgPrice = result.avgPrice ?? 0
    const responseText = `✅ Trade executed! Bought ${shares.toFixed(2)} shares at avg price $${avgPrice.toFixed(2)}`

    callback?.({
      text: responseText,
      action: 'BUY_SHARES',
      data: toDataRecord(result),
    })

    return {
      success: true,
      text: responseText,
      data: toDataRecord(result),
    }
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Buy YES shares on this market for $50',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Analyzing market... Executing trade for $50 on YES side.',
          action: 'BUY_SHARES',
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to bet $100 on NO for question 42',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Placing bet of $100 on NO side for market 42.',
          action: 'BUY_SHARES',
        },
      },
    ],
  ],
}

/**
 * Sell Shares Action
 *
 * Allows agents to close positions and realize profits/losses
 */
export const sellSharesAction: Action = {
  name: 'SELL_SHARES',
  similes: [
    'SELL',
    'CLOSE_POSITION',
    'EXIT_MARKET',
    'TAKE_PROFIT',
    'STOP_LOSS',
  ],
  description: 'Sell shares and close position in a prediction market',
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    if (!babylonService) return false

    const content = message.content.text?.toLowerCase() || ''
    const hasSellIntent =
      content.includes('sell') ||
      content.includes('close position') ||
      content.includes('exit') ||
      content.includes('take profit') ||
      content.includes('stop loss')

    return hasSellIntent
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()

    if (message.content.text) {
      runtime.logger.debug(
        `SELL_SHARES triggered by: ${message.content.text.substring(0, 100)}`,
      )
    }

    const actionState = state as BabylonActionState | undefined
    const actionOptions = options as BabylonActionOptions | undefined
    const marketId = actionState?.marketId || actionOptions?.marketId
    const shares = actionState?.shares || actionOptions?.shares

    if (!marketId) {
      throw new Error('No market specified')
    }

    const positions = await client.getPositions()
    const position = positions.find((p) => p.marketId === marketId)

    if (!position) {
      throw new Error(`No position found for market ${marketId}`)
    }

    const sharesToSell = shares || position.shares
    runtime.logger.info(
      `Selling ${sharesToSell} shares from market ${marketId}`,
    )
    const result = await client.sellShares(marketId, sharesToSell)

    const responseText = `✅ Position closed! Sold ${sharesToSell.toFixed(2)} shares. P&L: ${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)}`

    callback?.({
      text: responseText,
      action: 'SELL_SHARES',
      data: toDataRecord(result),
    })

    return {
      success: true,
      text: responseText,
      data: toDataRecord(result),
    }
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Sell my position on market 42',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Closing position on market 42...',
          action: 'SELL_SHARES',
        },
      },
    ],
  ],
}

/**
 * Check Wallet Action
 *
 * Allows agents to check their balance and available funds
 */
export const checkWalletAction: Action = {
  name: 'CHECK_WALLET',
  similes: ['CHECK_BALANCE', 'WALLET_STATUS', 'HOW_MUCH_MONEY', 'MY_BALANCE'],
  description: 'Check wallet balance and available funds',
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    if (!babylonService) return false

    const content = message.content.text?.toLowerCase() || ''
    const hasWalletIntent =
      content.includes('balance') ||
      content.includes('wallet') ||
      content.includes('how much') ||
      content.includes('funds')

    return hasWalletIntent
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()

    const actionOptions = options as BabylonActionOptions | undefined
    const actionState = state as BabylonActionState | undefined
    const showDetailed = actionOptions?.detailed === true

    const inTradingFlow = actionState?.inTradingFlow === true
    const pendingTradeAmount = actionState?.pendingTradeAmount
    const includeTradingContext = actionOptions?.includeTradingContext === true

    const messageText = message.content.text?.toLowerCase() || ''
    const detailedRequest = messageText.includes('detail') || showDetailed

    const wallet = await client.getWallet()

    let responseText = `💰 Wallet Status:\nTotal Balance: $${wallet.balance.toFixed(2)}\nAvailable: $${wallet.availableBalance.toFixed(2)}\nLocked in positions: $${wallet.lockedBalance.toFixed(2)}`

    if (detailedRequest && wallet.balance > 0) {
      const utilizationRate = (
        (wallet.lockedBalance / wallet.balance) *
        100
      ).toFixed(1)
      responseText += `\n\nDetailed Analysis:\n- Capital Utilization: ${utilizationRate}%\n- Available for Trading: ${((wallet.availableBalance / wallet.balance) * 100).toFixed(1)}%`
    }

    if ((inTradingFlow || includeTradingContext) && pendingTradeAmount) {
      const canAfford = wallet.availableBalance >= pendingTradeAmount
      const remainingAfterTrade = wallet.availableBalance - pendingTradeAmount

      responseText += `\n\n🔄 Trading Context:\n- Pending Trade: $${pendingTradeAmount.toFixed(2)}`
      responseText += canAfford
        ? `\n- Status: ✅ Sufficient funds\n- Remaining after trade: $${remainingAfterTrade.toFixed(2)}`
        : `\n- Status: ❌ Insufficient funds (need $${(pendingTradeAmount - wallet.availableBalance).toFixed(2)} more)`
    }

    callback?.({
      text: responseText,
      action: 'CHECK_WALLET',
      data: toDataRecord(wallet),
    })

    return {
      success: true,
      text: responseText,
      data: toDataRecord(wallet),
    }
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'How much money do I have?',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Checking wallet...',
          action: 'CHECK_WALLET',
        },
      },
    ],
  ],
}

/**
 * Like Post Action
 * Allows agents to like posts naturally
 */
export const likePostAction: Action = {
  name: 'LIKE_POST',
  similes: ['LIKE', 'FAVORITE', 'REACT'],
  description: 'Like a post on the feed',
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    // Check if agent has Babylon service configured
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    if (!babylonService) {
      runtime.logger.error('Babylon service not configured')
      return false
    }

    // Extract like intent from message
    const content = message.content.text?.toLowerCase() || ''
    const hasLikeIntent =
      content.includes('like') ||
      content.includes('favorite') ||
      content.includes('react') ||
      content.includes('heart') ||
      content.includes('👍') ||
      content.includes('❤️')

    return hasLikeIntent
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()

    const actionState = state as BabylonActionState | undefined
    const actionOptions = options as BabylonActionOptions | undefined
    let postId = actionOptions?.postId || actionState?.postId

    if (!postId && message.content.text) {
      const content = message.content.text
      const postIdMatch =
        content.match(/post[_-]?[\w-]+/i) || content.match(/[\w-]+(?:-\d+){2,}/)
      if (postIdMatch) {
        postId = postIdMatch[0]
      }
    }

    if (!postId) {
      throw new Error('Post ID is required. Please specify which post to like.')
    }

    await client.likePost(postId)

    const responseText = `✅ Liked post ${postId}`
    callback?.({
      text: responseText,
      action: 'LIKE_POST',
    })
    return {
      success: true,
      text: responseText,
    }
  },
}

/**
 * Create Post Action
 * Allows agents to create original posts
 */
export const createPostAction: Action = {
  name: 'CREATE_POST',
  similes: ['POST', 'PUBLISH', 'SHARE_THOUGHT'],
  description: 'Create a new post on the feed',
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    // Check if agent has Babylon service configured
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    if (!babylonService) {
      runtime.logger.error('Babylon service not configured')
      return false
    }

    // Extract post intent from message
    const content = message.content.text?.toLowerCase() || ''
    const hasPostIntent =
      content.includes('post') ||
      content.includes('publish') ||
      content.includes('share') ||
      content.includes('tweet') ||
      content.length > 10 // Any substantial message could be a post

    return hasPostIntent
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()

    const actionState = state as BabylonActionState | undefined
    const actionOptions = options as BabylonActionOptions | undefined
    const content =
      actionOptions?.content || actionState?.postContent || message.content.text

    if (!content || content.trim().length === 0) {
      throw new Error('Post content is required')
    }

    const result = await client.createPost(content)

    const responseText = `✅ Created post: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`
    callback?.({
      text: responseText,
      action: 'CREATE_POST',
    })
    return {
      success: true,
      text: responseText,
      data: result,
    }
  },
}

/**
 * Follow User Action
 * Allows agents to follow interesting users
 */
export const followUserAction: Action = {
  name: 'FOLLOW_USER',
  similes: ['FOLLOW', 'SUBSCRIBE'],
  description: 'Follow a user or actor',
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    // Check if agent has Babylon service configured
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    if (!babylonService) {
      runtime.logger.error('Babylon service not configured')
      return false
    }

    // Extract follow intent from message
    const content = message.content.text?.toLowerCase() || ''
    const hasFollowIntent =
      content.includes('follow') ||
      content.includes('subscribe') ||
      content.includes('@') || // User mention
      content.match(/follow\s+\w+/i) !== null // "follow username" pattern

    return hasFollowIntent
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()

    const actionState = state as BabylonActionState | undefined
    const actionOptions = options as BabylonActionOptions | undefined
    let userId = actionOptions?.userId || actionState?.userId

    if (!userId && message.content.text) {
      const content = message.content.text
      const mentionMatch = content.match(/@(\w+)/i)
      const userIdMatch =
        content.match(/(?:user|actor)[_-]?[\w-]+/i) ||
        content.match(/[\w-]+(?:-\d+){1,}/)

      if (mentionMatch) {
        runtime.logger.debug(
          `Found mention in follow message: ${mentionMatch[1]}`,
        )
      } else if (userIdMatch) {
        userId = userIdMatch[0]
      }
    }

    if (!userId) {
      throw new Error(
        'User ID is required. Please specify which user to follow.',
      )
    }

    await client.followUser(userId)

    const responseText = `✅ Started following user ${userId}`
    callback?.({
      text: responseText,
      action: 'FOLLOW_USER',
    })
    return {
      success: true,
      text: responseText,
    }
  },
}

/**
 * Comment on Post Action
 * Allows agents to comment on posts
 */
export const commentOnPostAction: Action = {
  name: 'COMMENT_ON_POST',
  similes: ['COMMENT', 'REPLY', 'RESPOND'],
  description: 'Comment on a post',
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    // Check if agent has Babylon service configured
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    if (!babylonService) {
      runtime.logger.error('Babylon service not configured')
      return false
    }

    // Extract comment intent from message
    const content = message.content.text?.toLowerCase() || ''
    const hasCommentIntent =
      content.includes('comment') ||
      content.includes('reply') ||
      content.includes('respond') ||
      content.includes('answer') ||
      (content.length > 10 && !content.match(/^(buy|sell|follow|like|post)/i)) // Substantial message that's not another action

    return hasCommentIntent
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()

    const actionState = state as BabylonActionState | undefined
    const actionOptions = options as BabylonActionOptions | undefined
    let postId = actionOptions?.postId || actionState?.postId

    if (!postId && message.content.text) {
      const messageContent = message.content.text
      const postIdMatch =
        messageContent.match(/post[_-]?[\w-]+/i) ||
        messageContent.match(/[\w-]+(?:-\d+){2,}/)
      if (postIdMatch) {
        postId = postIdMatch[0]
      }
    }

    const content =
      actionOptions?.content ||
      actionState?.commentContent ||
      message.content.text

    if (!postId) {
      throw new Error(
        'Post ID is required. Please specify which post to comment on.',
      )
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Comment content is required')
    }

    const result = await client.commentOnPost(postId, content)

    const responseText = `✅ Commented on post ${postId}`
    callback?.({
      text: responseText,
      action: 'COMMENT_ON_POST',
    })
    return {
      success: true,
      text: responseText,
      data: result,
    }
  },
}

// Export all actions
export const babylonGameActions: Action[] = [
  buySharesAction,
  sellSharesAction,
  checkWalletAction,
  likePostAction,
  createPostAction,
  followUserAction,
  commentOnPostAction,
]
