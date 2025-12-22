/**
 * Babylon A2A Client
 *
 * Official A2A SDK implementation using @a2a-js/sdk.
 * All interactions follow the official A2A protocol via message/send with Tasks and Messages.
 * Implements all Babylon features as official A2A Skills.
 */

import type { AgentCard, DataPart, Message, Task, TextPart } from '@a2a-js/sdk';
import { A2AClient } from '@a2a-js/sdk/client';
import type {
  A2AChat,
  A2AFeedPost,
  A2ALeaderboardEntry,
  A2AMarketPosition,
  A2ANotification,
  A2AOrganization,
  A2APerpetualMarket,
  A2APerpPosition,
  A2APredictionMarket,
  A2ATrendingTag,
  A2AUserSearchResult,
  JsonValue,
} from '@babylon/a2a';
import { z } from 'zod';

// ============================================================================
// Response Validation Schemas (replaces type guards)
// ============================================================================

const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.number(),
    message: z.string(),
  }),
});

const SuccessResponseSchema = z.object({
  result: z.unknown(),
});

const A2APredictionMarketSchema = z.object({
  id: z.string(),
  question: z.string(),
  yesPrice: z.number().optional(),
  noPrice: z.number().optional(),
  status: z.string().optional(),
  totalVolume: z.number().optional(),
  createdAt: z.string().optional(),
});

const A2APerpetualMarketSchema = z.object({
  ticker: z.string(),
  currentPrice: z.number(),
  name: z.string().optional(),
  change24h: z.number().optional(),
  volume24h: z.number().optional(),
  fundingRate: z.number().optional(),
});

const A2AFeedPostSchema = z.object({
  id: z.string(),
  content: z.string(),
  authorId: z.string().optional(),
  createdAt: z.string().optional(),
  likesCount: z.number().optional(),
  commentsCount: z.number().optional(),
});

const A2AChatSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  lastMessage: z.string().optional(),
  lastMessageAt: z.string().optional(),
});

const A2ANotificationSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  message: z.string().optional(),
  read: z.boolean().optional(),
  createdAt: z.string().optional(),
});

const A2ALeaderboardEntrySchema = z.object({
  userId: z.string(),
  rank: z.number().optional(),
  score: z.number().optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
});

const A2ATrendingTagSchema = z.object({
  tag: z.string(),
  count: z.number().optional(),
  trend: z.string().optional(),
});

const A2AOrganizationSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  ticker: z.string().optional(),
  description: z.string().optional(),
});

const A2AUserSearchResultSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  username: z.string().optional(),
  avatarUrl: z.string().optional(),
  isVerified: z.boolean().optional(),
});

const A2AMarketPositionSchema = z.object({
  id: z.string(),
  marketId: z.string(),
  outcome: z.string().optional(),
  shares: z.number().optional(),
  avgPrice: z.number().optional(),
  currentValue: z.number().optional(),
  pnl: z.number().optional(),
});

const A2APerpPositionSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  side: z.string().optional(),
  size: z.number().optional(),
  entryPrice: z.number().optional(),
  markPrice: z.number().optional(),
  pnl: z.number().optional(),
  leverage: z.number().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/** Validate and check for JSON-RPC error responses */
function isErrorResponse(response: unknown): response is {
  error: { code: number; message: string };
} {
  return ErrorResponseSchema.safeParse(response).success;
}

/** Validate and check for successful responses with result */
function isSuccessResponse(response: unknown): response is { result: unknown } {
  return SuccessResponseSchema.safeParse(response).success;
}

/**
 * Parse an array of items using a Zod schema, filtering out invalid items
 */
function parseArraySafe<T>(items: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => schema.safeParse(item))
    .filter((result): result is z.SafeParseSuccess<T> => result.success)
    .map((result) => result.data);
}

import { ExternalServiceError, NotFoundError } from '@babylon/shared';

/**
 * A2A command with operation and params
 */
interface A2ACommand {
  operation: string;
  params: Record<string, JsonValue>;
}

export interface BabylonA2AClientConfig {
  /** Base URL of Babylon server (e.g., http://localhost:5007) */
  baseUrl: string;
  /** Agent wallet address */
  address: string;
  /** Agent token ID from ERC-8004 registry */
  tokenId: number;
  /** Private key for signing (optional, for authenticated requests) */
  privateKey?: string;
  /** Babylon-issued API key for A2A server authentication */
  apiKey: string;
}

/**
 * Official A2A Client for Babylon
 *
 * Uses message/send to interact with Babylon's A2A server.
 * All operations are sent as Messages with Parts (TextPart, DataPart).
 */
export class BabylonA2AClient {
  private client?: A2AClient;
  private clientPromise?: Promise<A2AClient>;
  private config: BabylonA2AClientConfig;
  private agentCard: AgentCard | null = null;
  public agentId: string | null = null;

  constructor(config: BabylonA2AClientConfig) {
    this.config = config;
    this.agentId = `agent-${config.tokenId}-${config.address.slice(0, 8)}`;
  }

  /**
   * Get or initialize the A2A client (lazy initialization)
   */
  private async getClient(): Promise<A2AClient> {
    if (this.client) {
      return this.client;
    }

    if (!this.clientPromise) {
      const agentCardUrl = `${this.config.baseUrl}/.well-known/agent-card`;
      // A2AClient.fromCardUrl accepts options with fetchImpl
      // Type assertion needed because SDK types may not fully expose all options
      type A2AClientOptions = {
        fetchImpl?: (
          url: string | URL | Request,
          init?: RequestInit
        ) => Promise<Response>;
      };
      const options: A2AClientOptions = {
        fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
          // Add authentication headers
          const headers = new Headers(init?.headers);
          headers.set('x-agent-id', this.agentId!);
          headers.set('x-agent-address', this.config.address);
          headers.set('x-agent-token-id', this.config.tokenId.toString());
          if (this.config.apiKey) {
            headers.set('x-babylon-api-key', this.config.apiKey);
          }
          return fetch(url, { ...init, headers });
        },
      };
      this.clientPromise = A2AClient.fromCardUrl(
        agentCardUrl,
        options as Parameters<typeof A2AClient.fromCardUrl>[1]
      );
    }

    this.client = await this.clientPromise;
    return this.client;
  }

  /**
   * Connect to Babylon and fetch agent card
   */
  async connect(): Promise<void> {
    // Initialize client
    await this.getClient();

    // Note: agentCardPromise is private in A2AClient, so we can't access it directly
    // The agent card will be fetched when needed through other methods

    // Verify connection by sending a test message
    await this.sendMessage('ping', { operation: 'stats.system', params: {} });
  }

  /**
   * Send a message to Babylon using official A2A protocol
   *
   * @param text Text content of the message
   * @param command Structured command data (action + params)
   * @returns Task or Message response
   */
  async sendMessage(
    text: string,
    command: A2ACommand
  ): Promise<Task | Message> {
    if (!command || typeof command.operation !== 'string') {
      throw new Error(
        'A2A command must include an operation string (e.g., "social.create_post", "markets.buy_shares")'
      );
    }

    const structuredCommand = {
      operation: command.operation,
      params: command.params || {},
    };
    const parts: Array<TextPart | DataPart> = [
      {
        kind: 'text',
        text,
      },
    ];

    parts.push({
      kind: 'data',
      data: structuredCommand,
    });

    const message: Message = {
      kind: 'message',
      messageId: `msg-${Date.now()}-${Math.random()}`,
      role: 'user',
      parts,
      contextId: this.agentId || undefined,
    };

    const client = await this.getClient();
    const response = await client.sendMessage({ message });

    if (isErrorResponse(response)) {
      throw new ExternalServiceError(
        'A2A',
        `Error [${response.error.code}]: ${response.error.message}`,
        response.error.code
      );
    }

    if (!isSuccessResponse(response)) {
      throw new ExternalServiceError(
        'A2A',
        'Unexpected response format - no result'
      );
    }

    const result = response.result as unknown as Record<string, unknown>;
    // Response can be either a Message or Task
    if ('task' in result && result.task) {
      return result.task as unknown as Task;
    }
    if ('message' in result && result.message) {
      return result.message as unknown as Message;
    }
    // Fallback - check if result itself is a Task or Message
    if (result && typeof result === 'object') {
      // Check if it's a Task (has 'status' property)
      if (
        'status' in result &&
        'id' in result &&
        typeof result.id === 'string'
      ) {
        return result as unknown as Task;
      }
      // Check if it's a Message (has 'kind' === 'message' or 'parts' property)
      if (
        ('kind' in result && result.kind === 'message') ||
        ('parts' in result && Array.isArray(result.parts))
      ) {
        return result as unknown as Message;
      }
      // Check if it's wrapped in a result object
      if (
        'task' in result &&
        result.task &&
        typeof result.task === 'object' &&
        'id' in result.task
      ) {
        return result.task as unknown as Task;
      }
      if (
        'message' in result &&
        result.message &&
        typeof result.message === 'object' &&
        'parts' in result.message
      ) {
        return result.message as unknown as Message;
      }
    }
    throw new ExternalServiceError('A2A', 'Unexpected response format');
  }

  // normalizeCommand removed - now using operation/params format directly

  /**
   * Get task status
   */
  async getTask(taskId: string): Promise<Task> {
    const client = await this.getClient();
    // A2AClient.getTask accepts either string or TaskQueryParams object
    // Using object format for type safety
    const response = await client.getTask({ id: taskId });

    if (isErrorResponse(response)) {
      throw new ExternalServiceError(
        'A2A',
        `Error [${response.error.code}]: ${response.error.message}`,
        response.error.code
      );
    }

    if (!isSuccessResponse(response)) {
      throw new ExternalServiceError(
        'A2A',
        'Unexpected response format - no result'
      );
    }

    const result = response.result as unknown as Record<string, unknown>;
    if ('task' in result && result.task) {
      return result.task as unknown as Task;
    }
    throw new NotFoundError('Task', taskId);
  }

  /**
   * Wait for task to complete and return final result
   */
  async waitForTask(taskId: string, maxWaitMs = 30000): Promise<Task> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < maxWaitMs) {
      const task = await this.getTask(taskId);

      if (
        task.status.state === 'completed' ||
        task.status.state === 'failed' ||
        task.status.state === 'canceled'
      ) {
        return task;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Task ${taskId} did not complete within ${maxWaitMs}ms`);
  }

  /**
   * Extract result from task artifacts or messages
   */
  private extractResult(
    taskOrMessage: Task | Message
  ): Record<string, JsonValue> {
    if (taskOrMessage.kind === 'task') {
      // It's a Task
      const task = taskOrMessage as Task;
      if (task.artifacts && task.artifacts.length > 0) {
        // Extract from artifacts
        const artifact = task.artifacts[0];
        if (artifact.parts) {
          for (const part of artifact.parts) {
            if (part.kind === 'data') {
              const dataPart = part as DataPart;
              return dataPart.data as Record<string, JsonValue>;
            }
          }
        }
      }
      // Check last message in history
      if (task.history && task.history.length > 0) {
        const lastMessage = task.history[task.history.length - 1];
        if (lastMessage.parts) {
          for (const part of lastMessage.parts) {
            if (part.kind === 'data') {
              const dataPart = part as DataPart;
              return dataPart.data as Record<string, JsonValue>;
            }
          }
        }
      }
      // Check status message
      if (task.status?.message?.parts) {
        for (const part of task.status.message.parts) {
          if (part.kind === 'data') {
            const dataPart = part as DataPart;
            return dataPart.data as Record<string, JsonValue>;
          }
        }
      }
      return {};
    }
    // It's a Message
    const message = taskOrMessage as Message;
    if (message.parts) {
      for (const part of message.parts) {
        if (part.kind === 'data') {
          const dataPart = part as DataPart;
          return dataPart.data as Record<string, JsonValue>;
        }
      }
    }
    return {};
  }

  // ===== Trading Methods (via message/send) =====

  /**
   * Buy prediction market shares
   * NOTE: This operation is not yet supported by the executor
   * The executor currently only supports: social.create_post, social.get_feed, markets.list_prediction, users.search, stats.system, stats.leaderboard
   */
  async buyShares(
    marketId: string,
    outcome: 'YES' | 'NO',
    amount: number
  ): Promise<Record<string, JsonValue>> {
    throw new Error(
      'markets.buy_shares operation not yet supported by executor. Only basic operations are available.'
    );
  }

  /**
   * Sell prediction market shares
   */
  async sellShares(
    positionId: string,
    shares: number
  ): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Sell ${shares} shares from position ${positionId}`,
      {
        operation: 'markets.sell_shares',
        params: {
          positionId,
          shares,
        },
      }
    );

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  /**
   * Open perpetual position
   */
  async openPosition(
    ticker: string,
    side: 'LONG' | 'SHORT',
    amount: number,
    leverage: number
  ): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Open ${side} position on ${ticker} with $${amount} at ${leverage}x leverage`,
      {
        operation: 'markets.open_perp_position',
        params: {
          ticker,
          side,
          amount,
          leverage,
        },
      }
    );

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  /**
   * Close perpetual position
   */
  async closePosition(positionId: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(`Close position ${positionId}`, {
      operation: 'markets.close_perp_position',
      params: {
        positionId,
      },
    });

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  /**
   * Get predictions (query skill)
   * SUPPORTED: Uses markets.list_prediction operation
   */
  async getPredictions(params?: {
    userId?: string;
    status?: 'active' | 'resolved';
  }): Promise<{ predictions: A2APredictionMarket[] }> {
    const response = await this.sendMessage(
      'What prediction markets are available?',
      {
        operation: 'markets.list_prediction',
        params: params || {},
      }
    );

    if ('status' in response) {
      const task = await this.waitForTask(response.id);
      const result = this.extractResult(task);
      return {
        predictions: parseArraySafe(
          result.predictions,
          A2APredictionMarketSchema
        ) as A2APredictionMarket[],
      };
    }

    const result = this.extractResult(response);
    return {
      predictions: parseArraySafe(
        result.predictions,
        A2APredictionMarketSchema
      ) as A2APredictionMarket[],
    };
  }

  /**
   * Get perpetuals (query skill)
   */
  async getPerpetuals(): Promise<{ perpetuals: A2APerpetualMarket[] }> {
    const response = await this.sendMessage(
      'What perpetual futures markets are available?',
      {
        operation: 'markets.list_perpetuals',
        params: {},
      }
    );

    if ('status' in response) {
      const task = await this.waitForTask(response.id);
      const result = this.extractResult(task);
      return {
        perpetuals: parseArraySafe(
          result.perpetuals,
          A2APerpetualMarketSchema
        ) as A2APerpetualMarket[],
      };
    }

    const result = this.extractResult(response);
    return {
      perpetuals: parseArraySafe(
        result.perpetuals,
        A2APerpetualMarketSchema
      ) as A2APerpetualMarket[],
    };
  }

  /**
   * Get all markets
   */
  async getMarkets(): Promise<{
    predictions: A2APredictionMarket[];
    perps: A2APerpetualMarket[];
  }> {
    const [predictions, perps] = await Promise.all([
      this.getPredictions({ status: 'active' }),
      this.getPerpetuals(),
    ]);
    return {
      predictions: predictions.predictions || [],
      perps: perps.perpetuals || [],
    };
  }

  /**
   * Get balance (query skill)
   */
  async getBalance(): Promise<{ balance: number }> {
    const response = await this.sendMessage('What is my current balance?', {
      operation: 'portfolio.get_balance',
      params: {},
    });

    if ('status' in response) {
      const task = await this.waitForTask(response.id);
      const result = this.extractResult(task);
      return {
        balance: typeof result.balance === 'number' ? result.balance : 0,
      };
    }

    const result = this.extractResult(response);
    return { balance: typeof result.balance === 'number' ? result.balance : 0 };
  }

  /**
   * Get positions (query skill)
   */
  async getPositions(userId?: string): Promise<{
    marketPositions: A2AMarketPosition[];
    perpPositions: A2APerpPosition[];
    totalPnL: number;
  }> {
    const response = await this.sendMessage(
      userId
        ? `What are user ${userId}'s positions?`
        : 'What are my current positions?',
      {
        operation: 'portfolio.get_positions',
        params: userId ? { userId } : {},
      }
    );

    if ('status' in response) {
      const task = await this.waitForTask(response.id);
      const result = this.extractResult(task);
      return {
        marketPositions: parseArraySafe(
          result.marketPositions,
          A2AMarketPositionSchema
        ) as A2AMarketPosition[],
        perpPositions: parseArraySafe(
          result.perpPositions,
          A2APerpPositionSchema
        ) as A2APerpPosition[],
        totalPnL: typeof result.totalPnL === 'number' ? result.totalPnL : 0,
      };
    }

    const result = this.extractResult(response);
    return {
      marketPositions: parseArraySafe(
        result.marketPositions,
        A2AMarketPositionSchema
      ) as A2AMarketPosition[],
      perpPositions: parseArraySafe(
        result.perpPositions,
        A2APerpPositionSchema
      ) as A2APerpPosition[],
      totalPnL: typeof result.totalPnL === 'number' ? result.totalPnL : 0,
    };
  }

  /**
   * Get portfolio (combines balance and positions)
   */
  async getPortfolio(): Promise<{
    balance: number;
    positions: Array<A2AMarketPosition | A2APerpPosition>;
    pnl: number;
  }> {
    const [balance, positions] = await Promise.all([
      this.getBalance(),
      this.getPositions(),
    ]);

    return {
      balance: balance.balance,
      positions: [
        ...(positions.marketPositions || []),
        ...(positions.perpPositions || []),
      ],
      pnl: positions.totalPnL || 0,
    };
  }

  /**
   * Get feed (query skill)
   * SUPPORTED: Uses social.get_feed operation
   */
  async getFeed(params?: {
    limit?: number;
    offset?: number;
    following?: boolean;
    type?: 'post' | 'article';
  }): Promise<{ posts: A2AFeedPost[] }> {
    const response = await this.sendMessage(
      'Show me recent posts from the feed',
      {
        operation: 'social.get_feed',
        params: params || {},
      }
    );

    if ('status' in response) {
      const task = await this.waitForTask(response.id);
      const result = this.extractResult(task);
      return {
        posts: parseArraySafe(result.posts, A2AFeedPostSchema) as A2AFeedPost[],
      };
    }

    const result = this.extractResult(response);
    return {
      posts: parseArraySafe(result.posts, A2AFeedPostSchema) as A2AFeedPost[],
    };
  }

  /**
   * Create post (action skill)
   * SUPPORTED: Uses social.create_post operation
   */
  async createPost(
    content: string,
    type: 'post' | 'article' = 'post'
  ): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(`Post: ${content}`, {
      operation: 'social.create_post',
      params: {
        content,
        type,
      },
    });

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  /**
   * Create comment (action skill)
   */
  async createComment(
    postId: string,
    content: string
  ): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Comment on post ${postId}: ${content}`,
      {
        operation: 'social.create_comment',
        params: {
          postId,
          content,
        },
      }
    );

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  /**
   * Like post (action skill)
   */
  async likePost(postId: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(`Like post ${postId}`, {
      operation: 'social.like_post',
      params: {
        postId,
      },
    });

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  /**
   * Send message (action skill)
   */
  async sendMessageToChat(
    chatId: string,
    content: string
  ): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Send message to chat ${chatId}: ${content}`,
      {
        operation: 'chats.send_message',
        params: {
          chatId,
          content,
        },
      }
    );

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  /**
   * Get chats (query skill)
   */
  async getChats(
    filter?: 'all' | 'dms' | 'groups'
  ): Promise<{ chats: A2AChat[] }> {
    const response = await this.sendMessage('What are my chats?', {
      operation: 'chats.get_chats',
      params: { filter: filter as JsonValue },
    });

    if ('status' in response) {
      const task = await this.waitForTask(response.id);
      const result = this.extractResult(task);
      return {
        chats: parseArraySafe(result.chats, A2AChatSchema) as A2AChat[],
      };
    }

    const result = this.extractResult(response);
    return {
      chats: parseArraySafe(result.chats, A2AChatSchema) as A2AChat[],
    };
  }

  /**
   * Get notifications (query skill)
   */
  async getNotifications(
    limit?: number
  ): Promise<{ notifications: A2ANotification[] }> {
    const response = await this.sendMessage('What are my notifications?', {
      operation: 'notifications.get_notifications',
      params: { limit: limit as JsonValue },
    });

    if ('status' in response) {
      const task = await this.waitForTask(response.id);
      const result = this.extractResult(task);
      return {
        notifications: parseArraySafe(
          result.notifications,
          A2ANotificationSchema
        ) as A2ANotification[],
      };
    }

    const result = this.extractResult(response);
    return {
      notifications: parseArraySafe(
        result.notifications,
        A2ANotificationSchema
      ) as A2ANotification[],
    };
  }

  /**
   * Get leaderboard (query skill)
   * SUPPORTED: Uses stats.leaderboard operation
   */
  async getLeaderboard(params?: {
    page?: number;
    pageSize?: number;
    pointsType?: 'all' | 'earned' | 'referral';
    minPoints?: number;
    limit?: number;
  }): Promise<{ leaderboard: A2ALeaderboardEntry[] }> {
    const response = await this.sendMessage('Show me the leaderboard', {
      operation: 'stats.leaderboard',
      params: params || {},
    });

    if ('status' in response) {
      const task = await this.waitForTask(response.id);
      const result = this.extractResult(task);
      return {
        leaderboard: parseArraySafe(
          result.leaderboard,
          A2ALeaderboardEntrySchema
        ) as A2ALeaderboardEntry[],
      };
    }

    const result = this.extractResult(response);
    return {
      leaderboard: parseArraySafe(
        result.leaderboard,
        A2ALeaderboardEntrySchema
      ) as A2ALeaderboardEntry[],
    };
  }

  /**
   * Get user profile (query skill)
   */
  async getUserProfile(userId: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Show me user ${userId}'s profile`,
      {
        operation: 'users.get_user_profile',
        params: {
          userId,
        },
      }
    );

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  /**
   * Get system stats (query skill)
   * SUPPORTED: Uses stats.system operation
   */
  async getSystemStats(): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage('What are the system statistics?', {
      operation: 'stats.system',
      params: {},
    });

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  /**
   * Get reputation (query skill)
   */
  async getReputation(userId?: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      userId
        ? `What is user ${userId}'s reputation?`
        : 'What is my reputation?',
      {
        operation: 'stats.get_reputation',
        params: userId ? { userId } : {},
      }
    );

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  /**
   * Get trending tags (query skill)
   */
  async getTrendingTags(limit?: number): Promise<{ tags: A2ATrendingTag[] }> {
    const response = await this.sendMessage('What topics are trending?', {
      operation: 'stats.get_trending_tags',
      params: { limit: limit as JsonValue },
    });

    if ('status' in response) {
      const task = await this.waitForTask(response.id);
      const result = this.extractResult(task);
      return {
        tags: parseArraySafe(
          result.tags,
          A2ATrendingTagSchema
        ) as A2ATrendingTag[],
      };
    }

    const result = this.extractResult(response);
    return {
      tags: parseArraySafe(
        result.tags,
        A2ATrendingTagSchema
      ) as A2ATrendingTag[],
    };
  }

  /**
   * Get organizations (query skill)
   */
  async getOrganizations(
    limit?: number
  ): Promise<{ organizations: A2AOrganization[] }> {
    const response = await this.sendMessage(
      'What organizations/perpetual markets are available?',
      {
        operation: 'markets.get_organizations',
        params: { limit: limit as JsonValue },
      }
    );

    if ('status' in response) {
      const task = await this.waitForTask(response.id);
      const result = this.extractResult(task);
      return {
        organizations: parseArraySafe(
          result.organizations,
          A2AOrganizationSchema
        ) as A2AOrganization[],
      };
    }

    const result = this.extractResult(response);
    return {
      organizations: parseArraySafe(
        result.organizations,
        A2AOrganizationSchema
      ) as A2AOrganization[],
    };
  }

  /**
   * Search users (query skill)
   * SUPPORTED: Uses users.search operation
   */
  async searchUsers(
    query: string,
    limit?: number
  ): Promise<{ users: A2AUserSearchResult[] }> {
    const response = await this.sendMessage(`Search for users: ${query}`, {
      operation: 'users.search',
      params: {
        query,
        limit: limit as JsonValue,
      },
    });

    if ('status' in response) {
      const task = await this.waitForTask(response.id);
      const result = this.extractResult(task);
      return {
        users: parseArraySafe(
          result.users,
          A2AUserSearchResultSchema
        ) as A2AUserSearchResult[],
      };
    }

    const result = this.extractResult(response);
    return {
      users: parseArraySafe(
        result.users,
        A2AUserSearchResultSchema
      ) as A2AUserSearchResult[],
    };
  }

  /**
   * Follow user (action skill)
   */
  async followUser(userId: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(`Follow user ${userId}`, {
      operation: 'users.follow_user',
      params: {
        userId,
      },
    });

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  /**
   * Unfollow user (action skill)
   */
  async unfollowUser(userId: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(`Unfollow user ${userId}`, {
      operation: 'users.unfollow_user',
      params: {
        userId,
      },
    });

    if (response.kind === 'task') {
      const task = response as Task;
      if (
        task.status.state !== 'completed' &&
        task.status.state !== 'failed' &&
        task.status.state !== 'canceled'
      ) {
        const completedTask = await this.waitForTask(task.id);
        return this.extractResult(completedTask);
      }
      return this.extractResult(task);
    }

    return this.extractResult(response);
  }

  // Moderation Operations

  /**
   * Block a user
   */
  async blockUser(params: {
    userId: string;
    reason?: string;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(`Block user ${params.userId}`, {
      operation: 'moderation.block_user',
      params,
    });

    return this.extractResult(response);
  }

  /**
   * Unblock a user
   */
  async unblockUser(params: {
    userId: string;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(`Unblock user ${params.userId}`, {
      operation: 'moderation.unblock_user',
      params,
    });

    return this.extractResult(response);
  }

  /**
   * Mute a user
   */
  async muteUser(params: {
    userId: string;
    reason?: string;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(`Mute user ${params.userId}`, {
      operation: 'moderation.mute_user',
      params,
    });

    return this.extractResult(response);
  }

  /**
   * Unmute a user
   */
  async unmuteUser(params: {
    userId: string;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(`Unmute user ${params.userId}`, {
      operation: 'moderation.unmute_user',
      params,
    });

    return this.extractResult(response);
  }

  /**
   * Report a user
   */
  async reportUser(params: {
    userId: string;
    category: string;
    reason: string;
    evidence?: string;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Report user ${params.userId} for ${params.category}`,
      {
        operation: 'moderation.report_user',
        params,
      }
    );

    return this.extractResult(response);
  }

  /**
   * Report a post
   */
  async reportPost(params: {
    postId: string;
    category: string;
    reason: string;
    evidence?: string;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Report post ${params.postId} for ${params.category}`,
      {
        operation: 'moderation.report_post',
        params,
      }
    );

    return this.extractResult(response);
  }

  /**
   * Get list of blocked users
   */
  async getBlocks(params?: {
    limit?: number;
    offset?: number;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage('Get my blocked users list', {
      operation: 'moderation.get_blocks',
      params: params || {},
    });

    return this.extractResult(response);
  }

  /**
   * Get list of muted users
   */
  async getMutes(params?: {
    limit?: number;
    offset?: number;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage('Get my muted users list', {
      operation: 'moderation.get_mutes',
      params: params || {},
    });

    return this.extractResult(response);
  }

  /**
   * Check if a user is blocked
   */
  async checkBlockStatus(params: {
    userId: string;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Check if user ${params.userId} is blocked`,
      {
        operation: 'moderation.check_block_status',
        params,
      }
    );

    return this.extractResult(response);
  }

  /**
   * Check if a user is muted
   */
  async checkMuteStatus(params: {
    userId: string;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Check if user ${params.userId} is muted`,
      {
        operation: 'moderation.check_mute_status',
        params,
      }
    );

    return this.extractResult(response);
  }

  /**
   * Disconnect (cleanup)
   */
  async disconnect(): Promise<void> {
    // No-op for HTTP client, but kept for API compatibility
  }
}
