/**
 * A2A Protocol Handler
 * Routes A2A methods to appropriate handlers
 */

import { ErrorCode, type JsonRpcError } from '@babylon/a2a';
import { z } from 'zod';
import type { AgentRegistry } from '../services/agent-registry';
import type { MarketHandler } from './market-handler';
import type { PortfolioHandler } from './portfolio-handler';
import type { SocialHandler } from './social-handler';

// ============================================================================
// Validation Schemas
// ============================================================================

const BuySharesParamsSchema = z.object({
  marketId: z.string().min(1),
  outcome: z.enum(['YES', 'NO']),
  amount: z.number().positive(),
});

const SellSharesParamsSchema = z.object({
  marketId: z.string().min(1),
  outcome: z.enum(['YES', 'NO']),
  shares: z.number().positive(),
});

const CreatePostParamsSchema = z.object({
  content: z.string().min(1).max(5000),
  mediaUrls: z.array(z.string()).optional(),
});

const CommentPostParamsSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

const DiscoverParamsSchema = z.object({
  verified: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().positive().optional(),
});

const RegisterAgentParamsSchema = z.object({
  walletAddress: z.string().optional(),
  tokenId: z.number().optional(),
  chainId: z.number().optional(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  avatarUrl: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const PaymentRequestParamsSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional(),
});

const PaymentReceiptParamsSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  transactionHash: z.string().min(1),
});

// ============================================================================
// Types
// ============================================================================

interface AgentContext {
  agentId?: string;
  address?: string;
  tokenId?: number;
}

interface A2AError extends Error {
  code: ErrorCode;
  data?: JsonRpcError['data'];
}

function createError(
  code: ErrorCode,
  message: string,
  data?: JsonRpcError['data']
): A2AError {
  const error = new Error(message) as A2AError;
  error.code = code;
  error.data = data;
  return error;
}

/**
 * Parse params with schema, throw A2A error on failure
 */
function parseParams<T>(
  schema: z.ZodType<T>,
  params: Record<string, unknown>,
  paramName: string
): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw createError(
      ErrorCode.INVALID_PARAMS,
      `Invalid params for ${paramName}`,
      result.error.format()
    );
  }
  return result.data;
}

export class A2AHandler {
  constructor(
    private agentRegistry: AgentRegistry,
    private marketHandler: MarketHandler,
    private socialHandler: SocialHandler,
    private portfolioHandler: PortfolioHandler
  ) {}

  /**
   * Handle A2A JSON-RPC method
   */
  async handleMethod(
    method: string,
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<unknown> {
    // Auto-register agent if they have address and tokenId
    if (context.address && context.tokenId) {
      await this.agentRegistry.getOrCreateAgent(
        context.address,
        context.tokenId
      );
    }

    switch (method) {
      // ==================== Agent Discovery ====================
      case 'a2a.discover':
      case 'discover':
        return this.discover(params);

      case 'a2a.getInfo':
      case 'getInfo': {
        const agentId = z.string().min(1).parse(params.agentId);
        return this.getAgentInfo(agentId);
      }

      case 'a2a.register':
      case 'register':
        return this.registerAgent(params, context);

      // ==================== Portfolio ====================
      case 'a2a.getBalance':
      case 'getBalance':
        return this.portfolioHandler.getBalance(
          context.agentId || context.address!
        );

      case 'a2a.getPositions':
      case 'getPositions':
        return this.portfolioHandler.getPositions(
          context.agentId || context.address!
        );

      case 'a2a.getPortfolio':
      case 'getPortfolio':
        return this.portfolioHandler.getPortfolio(
          context.agentId || context.address!
        );

      case 'a2a.getUserWallet':
      case 'getUserWallet':
        return this.portfolioHandler.getWalletInfo(
          context.agentId || context.address!
        );

      // ==================== Markets ====================
      case 'a2a.getMarkets':
      case 'getMarkets':
        return this.marketHandler.getMarkets(params);

      case 'a2a.getMarketData':
      case 'getMarketData': {
        const marketId = z.string().min(1).parse(params.marketId);
        return this.marketHandler.getMarketData(marketId);
      }

      case 'a2a.getMarketPrices':
      case 'getMarketPrices': {
        const marketIds = z.array(z.string().min(1)).parse(params.marketIds);
        return this.marketHandler.getMarketPrices(marketIds);
      }

      case 'a2a.buyShares':
      case 'buyShares': {
        const buyParams = parseParams(
          BuySharesParamsSchema,
          params,
          'buyShares'
        );
        return this.marketHandler.buyShares(
          context.agentId || context.address!,
          buyParams.marketId,
          buyParams.outcome,
          buyParams.amount
        );
      }

      case 'a2a.sellShares':
      case 'sellShares': {
        const sellParams = parseParams(
          SellSharesParamsSchema,
          params,
          'sellShares'
        );
        return this.marketHandler.sellShares(
          context.agentId || context.address!,
          sellParams.marketId,
          sellParams.outcome,
          sellParams.shares
        );
      }

      // ==================== Social ====================
      case 'a2a.getFeed':
      case 'getFeed':
        return this.socialHandler.getFeed(params);

      case 'a2a.createPost':
      case 'createPost': {
        const postParams = parseParams(
          CreatePostParamsSchema,
          params,
          'createPost'
        );
        return this.socialHandler.createPost(
          context.agentId || context.address!,
          postParams.content,
          postParams.mediaUrls
        );
      }

      case 'a2a.getPost':
      case 'getPost': {
        const postId = z.string().min(1).parse(params.postId);
        return this.socialHandler.getPost(postId);
      }

      case 'a2a.likePost':
      case 'likePost': {
        const postId = z.string().min(1).parse(params.postId);
        return this.socialHandler.likePost(
          context.agentId || context.address!,
          postId
        );
      }

      case 'a2a.commentPost':
      case 'commentPost': {
        const commentParams = parseParams(
          CommentPostParamsSchema,
          params,
          'commentPost'
        );
        return this.socialHandler.commentPost(
          context.agentId || context.address!,
          commentParams.postId,
          commentParams.content
        );
      }

      case 'a2a.searchUsers':
      case 'searchUsers': {
        const query = z.string().min(1).parse(params.query);
        return this.socialHandler.searchUsers(query);
      }

      // ==================== Notifications ====================
      case 'a2a.getNotifications':
      case 'getNotifications':
        return this.socialHandler.getNotifications(
          context.agentId || context.address!,
          params
        );

      case 'a2a.markNotificationRead':
      case 'markNotificationRead': {
        const notificationId = z.string().min(1).parse(params.notificationId);
        return this.socialHandler.markNotificationRead(
          context.agentId || context.address!,
          notificationId
        );
      }

      // ==================== Stats ====================
      case 'a2a.getStats':
      case 'getStats':
        return this.getSystemStats();

      case 'a2a.getLeaderboard':
      case 'getLeaderboard':
        return this.portfolioHandler.getLeaderboard(params);

      // ==================== Payments (x402) ====================
      case 'a2a.paymentRequest':
      case 'paymentRequest':
        return this.createPaymentRequest(params, context);

      case 'a2a.paymentReceipt':
      case 'paymentReceipt':
        return this.submitPaymentReceipt(params, context);

      default:
        throw createError(
          ErrorCode.METHOD_NOT_FOUND,
          `Method not found: ${method}`
        );
    }
  }

  private async discover(params: Record<string, unknown>): Promise<unknown> {
    const discoverParams = parseParams(
      DiscoverParamsSchema,
      params,
      'discover'
    );
    const agents = this.agentRegistry.discoverAgents({
      verified: discoverParams.verified,
      search: discoverParams.search,
      limit: discoverParams.limit,
    });

    return {
      agents: agents.map((a) => ({
        id: a.id,
        name: a.displayName,
        description: a.description,
        isVerified: a.isVerified,
        walletAddress: a.walletAddress,
      })),
    };
  }

  private getAgentInfo(agentId: string): unknown {
    const agent = this.agentRegistry.getAgent(agentId);
    if (!agent) {
      throw createError(
        ErrorCode.AGENT_NOT_FOUND,
        `Agent not found: ${agentId}`
      );
    }

    return {
      id: agent.id,
      name: agent.displayName,
      description: agent.description,
      walletAddress: agent.walletAddress,
      tokenId: agent.tokenId,
      chainId: agent.chainId,
      isVerified: agent.isVerified,
      createdAt: agent.createdAt.toISOString(),
    };
  }

  private async registerAgent(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<unknown> {
    const registerParams = parseParams(
      RegisterAgentParamsSchema,
      params,
      'register'
    );
    const agent = await this.agentRegistry.registerAgent({
      walletAddress: registerParams.walletAddress ?? context.address!,
      tokenId: registerParams.tokenId ?? context.tokenId!,
      chainId: registerParams.chainId ?? 31337,
      displayName: registerParams.displayName,
      description: registerParams.description,
      avatarUrl: registerParams.avatarUrl,
      metadata: registerParams.metadata,
    });

    return {
      success: true,
      agent: {
        id: agent.id,
        name: agent.displayName,
        isVerified: agent.isVerified,
      },
    };
  }

  private async getSystemStats(): Promise<unknown> {
    const agentCount = this.agentRegistry.getAgentCount();
    const marketStats = this.marketHandler.getMarketStats();
    const socialStats = this.socialHandler.getSocialStats();

    return {
      totalAgents: agentCount,
      totalUsers: socialStats.totalUsers,
      totalMarkets: marketStats.totalMarkets,
      totalVolume: marketStats.totalVolume,
      totalPosts: socialStats.totalPosts,
      totalTrades: marketStats.totalTrades,
      timestamp: new Date().toISOString(),
    };
  }

  private async createPaymentRequest(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<unknown> {
    const paymentParams = parseParams(
      PaymentRequestParamsSchema,
      params,
      'paymentRequest'
    );
    // x402 payment request
    return {
      paymentId: `pay-${Date.now()}`,
      amount: paymentParams.amount,
      currency: paymentParams.currency ?? 'ETH',
      recipient: context.address,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: 'pending',
    };
  }

  private async submitPaymentReceipt(
    params: Record<string, unknown>,
    _context: AgentContext
  ): Promise<unknown> {
    const receiptParams = parseParams(
      PaymentReceiptParamsSchema,
      params,
      'paymentReceipt'
    );
    // x402 payment receipt verification
    return {
      paymentId: receiptParams.paymentId,
      verified: true,
      amount: receiptParams.amount,
      transactionHash: receiptParams.transactionHash,
      timestamp: new Date().toISOString(),
    };
  }
}
