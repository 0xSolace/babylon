/**
 * MCP Server Implementation
 *
 * Defines MCP server info, capabilities, and available tools
 * Uses Zod schemas as single source of truth for tool input validation
 */

import { toJSONSchema, type ZodObject, type ZodRawShape } from 'zod';
import type {
  Implementation,
  InitializeResult,
  MCPProtocolVersion,
  MCPTool,
  ServerCapabilities,
} from '../types/mcp';
import { MCP_PROTOCOL_VERSIONS } from '../types/mcp';
import {
  AcceptGroupInviteArgsSchema,
  AppealBanArgsSchema,
  AppealBanWithEscrowArgsSchema,
  BlockUserArgsSchema,
  BuySharesArgsSchema,
  CheckBlockStatusArgsSchema,
  CheckMuteStatusArgsSchema,
  ClosePositionArgsSchema,
  CreateCommentArgsSchema,
  CreateEscrowPaymentArgsSchema,
  CreateGroupArgsSchema,
  CreatePostArgsSchema,
  DeclineGroupInviteArgsSchema,
  DeleteCommentArgsSchema,
  DeletePostArgsSchema,
  FavoriteProfileArgsSchema,
  FollowUserArgsSchema,
  GetBalanceArgsSchema,
  GetBlocksArgsSchema,
  GetChatMessagesArgsSchema,
  GetChatsArgsSchema,
  GetCommentsArgsSchema,
  GetFavoritePostsArgsSchema,
  GetFavoritesArgsSchema,
  GetFollowersArgsSchema,
  GetFollowingArgsSchema,
  GetGroupInvitesArgsSchema,
  GetLeaderboardArgsSchema,
  GetMarketDataArgsSchema,
  GetMarketPricesArgsSchema,
  GetMarketsArgsSchema,
  GetMutesArgsSchema,
  GetNotificationsArgsSchema,
  GetOrganizationsArgsSchema,
  GetPerpetualsArgsSchema,
  GetPositionsArgsSchema,
  GetPostsByTagArgsSchema,
  GetReferralCodeArgsSchema,
  GetReferralStatsArgsSchema,
  GetReferralsArgsSchema,
  GetReputationArgsSchema,
  GetReputationBreakdownArgsSchema,
  GetSystemStatsArgsSchema,
  GetTradeHistoryArgsSchema,
  GetTradesArgsSchema,
  GetTrendingTagsArgsSchema,
  GetUnreadCountArgsSchema,
  GetUserProfileArgsSchema,
  GetUserStatsArgsSchema,
  GetUserWalletArgsSchema,
  LeaveChatArgsSchema,
  LikeCommentArgsSchema,
  LikePostArgsSchema,
  ListEscrowPaymentsArgsSchema,
  MarkNotificationsReadArgsSchema,
  MuteUserArgsSchema,
  OpenPositionArgsSchema,
  PaymentReceiptArgsSchema,
  PaymentRequestArgsSchema,
  PlaceBetArgsSchema,
  QueryFeedArgsSchema,
  RefundEscrowPaymentArgsSchema,
  ReportPostArgsSchema,
  ReportUserArgsSchema,
  SearchUsersArgsSchema,
  SellSharesArgsSchema,
  SendMessageArgsSchema,
  SharePostArgsSchema,
  TransferPointsArgsSchema,
  UnblockUserArgsSchema,
  UnfavoriteProfileArgsSchema,
  UnfollowUserArgsSchema,
  UnlikePostArgsSchema,
  UnmuteUserArgsSchema,
  UpdateProfileArgsSchema,
  VerifyEscrowPaymentArgsSchema,
} from '../utils/tool-args-validation';

/**
 * Convert Zod schema to MCP-compatible inputSchema
 */
function schemaToInputSchema(
  schema: ZodObject<ZodRawShape>
): MCPTool['inputSchema'] {
  const jsonSchema = toJSONSchema(schema);
  return jsonSchema as MCPTool['inputSchema'];
}

/**
 * Default MCP protocol version
 */
export const DEFAULT_MCP_PROTOCOL_VERSION: MCPProtocolVersion = '2024-11-05';

/**
 * Get MCP server information
 */
export function getMCPServerInfo(): Implementation {
  return {
    name: 'Babylon Prediction Markets',
    version: '1.0.0',
    title: 'Babylon MCP Server',
  };
}

/**
 * Get server capabilities
 */
export function getServerCapabilities(): ServerCapabilities {
  return {
    tools: {
      listChanged: false, // We don't support dynamic tool list changes yet
    },
    resources: {
      subscribe: false,
      listChanged: false,
    },
    prompts: {
      listChanged: false,
    },
    logging: {},
  };
}

/**
 * Get initialize result for protocol negotiation
 */
export function getInitializeResult(
  requestedVersion: MCPProtocolVersion
): InitializeResult {
  const serverInfo = getMCPServerInfo();
  const capabilities = getServerCapabilities();

  // Negotiate protocol version (use requested if supported, otherwise default)
  const protocolVersion = MCP_PROTOCOL_VERSIONS.includes(requestedVersion)
    ? requestedVersion
    : DEFAULT_MCP_PROTOCOL_VERSION;

  return {
    protocolVersion,
    capabilities,
    serverInfo,
    instructions:
      'Babylon MCP Server provides access to prediction markets, trading, social features, and more. Use tools/list to see available tools.',
  };
}

/**
 * Get available MCP tools
 * Uses Zod schemas as the single source of truth for input validation
 */
export function getAvailableTools(): MCPTool[] {
  return [
    // Core Market Operations
    {
      name: 'get_markets',
      description: 'Get all active prediction markets',
      inputSchema: schemaToInputSchema(GetMarketsArgsSchema),
    },
    {
      name: 'place_bet',
      description: 'Place a bet on a prediction market',
      inputSchema: schemaToInputSchema(PlaceBetArgsSchema),
    },
    {
      name: 'get_balance',
      description: 'Get your current balance and P&L',
      inputSchema: schemaToInputSchema(GetBalanceArgsSchema),
    },
    {
      name: 'get_positions',
      description: 'Get all open positions',
      inputSchema: schemaToInputSchema(GetPositionsArgsSchema),
    },
    {
      name: 'close_position',
      description: 'Close an open position',
      inputSchema: schemaToInputSchema(ClosePositionArgsSchema),
    },
    {
      name: 'get_market_data',
      description: 'Get detailed data for a specific market',
      inputSchema: schemaToInputSchema(GetMarketDataArgsSchema),
    },
    {
      name: 'query_feed',
      description: 'Query the social feed for posts',
      inputSchema: schemaToInputSchema(QueryFeedArgsSchema),
    },
    // Market Operations - Additional Tools
    {
      name: 'buy_shares',
      description: 'Buy shares in a prediction market',
      inputSchema: schemaToInputSchema(BuySharesArgsSchema),
    },
    {
      name: 'sell_shares',
      description: 'Sell shares from a position',
      inputSchema: schemaToInputSchema(SellSharesArgsSchema),
    },
    {
      name: 'open_position',
      description: 'Open a new perpetual position',
      inputSchema: schemaToInputSchema(OpenPositionArgsSchema),
    },
    {
      name: 'get_market_prices',
      description: 'Get real-time market prices',
      inputSchema: schemaToInputSchema(GetMarketPricesArgsSchema),
    },
    {
      name: 'get_perpetuals',
      description: 'Get all perpetual markets',
      inputSchema: schemaToInputSchema(GetPerpetualsArgsSchema),
    },
    {
      name: 'get_trades',
      description: 'Get recent trades',
      inputSchema: schemaToInputSchema(GetTradesArgsSchema),
    },
    {
      name: 'get_trade_history',
      description: 'Get trade history for a user',
      inputSchema: schemaToInputSchema(GetTradeHistoryArgsSchema),
    },
    // Social Features
    {
      name: 'create_post',
      description: 'Create a new post',
      inputSchema: schemaToInputSchema(CreatePostArgsSchema),
    },
    {
      name: 'delete_post',
      description: 'Delete a post',
      inputSchema: schemaToInputSchema(DeletePostArgsSchema),
    },
    {
      name: 'like_post',
      description: 'Like a post',
      inputSchema: schemaToInputSchema(LikePostArgsSchema),
    },
    {
      name: 'unlike_post',
      description: 'Unlike a post',
      inputSchema: schemaToInputSchema(UnlikePostArgsSchema),
    },
    {
      name: 'share_post',
      description: 'Share a post',
      inputSchema: schemaToInputSchema(SharePostArgsSchema),
    },
    {
      name: 'get_comments',
      description: 'Get comments on a post',
      inputSchema: schemaToInputSchema(GetCommentsArgsSchema),
    },
    {
      name: 'create_comment',
      description: 'Create a comment on a post',
      inputSchema: schemaToInputSchema(CreateCommentArgsSchema),
    },
    {
      name: 'delete_comment',
      description: 'Delete a comment',
      inputSchema: schemaToInputSchema(DeleteCommentArgsSchema),
    },
    {
      name: 'like_comment',
      description: 'Like a comment',
      inputSchema: schemaToInputSchema(LikeCommentArgsSchema),
    },
    {
      name: 'get_posts_by_tag',
      description: 'Get posts by tag',
      inputSchema: schemaToInputSchema(GetPostsByTagArgsSchema),
    },
    // User Management
    {
      name: 'get_user_profile',
      description: 'Get user profile information',
      inputSchema: schemaToInputSchema(GetUserProfileArgsSchema),
    },
    {
      name: 'update_profile',
      description: 'Update your profile',
      inputSchema: schemaToInputSchema(UpdateProfileArgsSchema),
    },
    {
      name: 'follow_user',
      description: 'Follow a user',
      inputSchema: schemaToInputSchema(FollowUserArgsSchema),
    },
    {
      name: 'unfollow_user',
      description: 'Unfollow a user',
      inputSchema: schemaToInputSchema(UnfollowUserArgsSchema),
    },
    {
      name: 'get_followers',
      description: 'Get user followers',
      inputSchema: schemaToInputSchema(GetFollowersArgsSchema),
    },
    {
      name: 'get_following',
      description: 'Get users being followed',
      inputSchema: schemaToInputSchema(GetFollowingArgsSchema),
    },
    {
      name: 'search_users',
      description: 'Search for users',
      inputSchema: schemaToInputSchema(SearchUsersArgsSchema),
    },
    {
      name: 'get_user_wallet',
      description: 'Get user wallet information',
      inputSchema: schemaToInputSchema(GetUserWalletArgsSchema),
    },
    {
      name: 'get_user_stats',
      description: 'Get user statistics',
      inputSchema: schemaToInputSchema(GetUserStatsArgsSchema),
    },
    // Chats & Messaging
    {
      name: 'get_chats',
      description: 'List all chats',
      inputSchema: schemaToInputSchema(GetChatsArgsSchema),
    },
    {
      name: 'get_chat_messages',
      description: 'Get messages in a chat',
      inputSchema: schemaToInputSchema(GetChatMessagesArgsSchema),
    },
    {
      name: 'send_message',
      description: 'Send a message in a chat',
      inputSchema: schemaToInputSchema(SendMessageArgsSchema),
    },
    {
      name: 'create_group',
      description: 'Create a group chat',
      inputSchema: schemaToInputSchema(CreateGroupArgsSchema),
    },
    {
      name: 'leave_chat',
      description: 'Leave a chat',
      inputSchema: schemaToInputSchema(LeaveChatArgsSchema),
    },
    {
      name: 'get_unread_count',
      description: 'Get unread message count',
      inputSchema: schemaToInputSchema(GetUnreadCountArgsSchema),
    },
    // Notifications
    {
      name: 'get_notifications',
      description: 'Get notifications',
      inputSchema: schemaToInputSchema(GetNotificationsArgsSchema),
    },
    {
      name: 'mark_notifications_read',
      description: 'Mark notifications as read',
      inputSchema: schemaToInputSchema(MarkNotificationsReadArgsSchema),
    },
    {
      name: 'get_group_invites',
      description: 'Get group invites',
      inputSchema: schemaToInputSchema(GetGroupInvitesArgsSchema),
    },
    {
      name: 'accept_group_invite',
      description: 'Accept a group invite',
      inputSchema: schemaToInputSchema(AcceptGroupInviteArgsSchema),
    },
    {
      name: 'decline_group_invite',
      description: 'Decline a group invite',
      inputSchema: schemaToInputSchema(DeclineGroupInviteArgsSchema),
    },
    // Leaderboard & Stats
    {
      name: 'get_leaderboard',
      description: 'Get leaderboard',
      inputSchema: schemaToInputSchema(GetLeaderboardArgsSchema),
    },
    {
      name: 'get_system_stats',
      description: 'Get system statistics',
      inputSchema: schemaToInputSchema(GetSystemStatsArgsSchema),
    },
    // Referrals & Rewards
    {
      name: 'get_referral_code',
      description: 'Get your referral code',
      inputSchema: schemaToInputSchema(GetReferralCodeArgsSchema),
    },
    {
      name: 'get_referrals',
      description: 'List your referrals',
      inputSchema: schemaToInputSchema(GetReferralsArgsSchema),
    },
    {
      name: 'get_referral_stats',
      description: 'Get referral statistics',
      inputSchema: schemaToInputSchema(GetReferralStatsArgsSchema),
    },
    // Reputation
    {
      name: 'get_reputation',
      description: 'Get user reputation',
      inputSchema: schemaToInputSchema(GetReputationArgsSchema),
    },
    {
      name: 'get_reputation_breakdown',
      description: 'Get reputation breakdown',
      inputSchema: schemaToInputSchema(GetReputationBreakdownArgsSchema),
    },
    // Trending & Discovery
    {
      name: 'get_trending_tags',
      description: 'Get trending tags',
      inputSchema: schemaToInputSchema(GetTrendingTagsArgsSchema),
    },
    // Organizations
    {
      name: 'get_organizations',
      description: 'List organizations',
      inputSchema: schemaToInputSchema(GetOrganizationsArgsSchema),
    },
    // x402 Micropayments
    {
      name: 'payment_request',
      description: 'Request a payment via x402',
      inputSchema: schemaToInputSchema(PaymentRequestArgsSchema),
    },
    {
      name: 'payment_receipt',
      description: 'Get payment receipt',
      inputSchema: schemaToInputSchema(PaymentReceiptArgsSchema),
    },
    // Moderation
    {
      name: 'block_user',
      description: 'Block a user',
      inputSchema: schemaToInputSchema(BlockUserArgsSchema),
    },
    {
      name: 'unblock_user',
      description: 'Unblock a user',
      inputSchema: schemaToInputSchema(UnblockUserArgsSchema),
    },
    {
      name: 'mute_user',
      description: 'Mute a user',
      inputSchema: schemaToInputSchema(MuteUserArgsSchema),
    },
    {
      name: 'unmute_user',
      description: 'Unmute a user',
      inputSchema: schemaToInputSchema(UnmuteUserArgsSchema),
    },
    {
      name: 'report_user',
      description: 'Report a user',
      inputSchema: schemaToInputSchema(ReportUserArgsSchema),
    },
    {
      name: 'report_post',
      description: 'Report a post',
      inputSchema: schemaToInputSchema(ReportPostArgsSchema),
    },
    {
      name: 'get_blocks',
      description: 'Get blocked users',
      inputSchema: schemaToInputSchema(GetBlocksArgsSchema),
    },
    {
      name: 'get_mutes',
      description: 'Get muted users',
      inputSchema: schemaToInputSchema(GetMutesArgsSchema),
    },
    {
      name: 'check_block_status',
      description: 'Check if a user is blocked',
      inputSchema: schemaToInputSchema(CheckBlockStatusArgsSchema),
    },
    {
      name: 'check_mute_status',
      description: 'Check if a user is muted',
      inputSchema: schemaToInputSchema(CheckMuteStatusArgsSchema),
    },
    // Moderation Escrow
    {
      name: 'create_escrow_payment',
      description: 'Create escrow payment (Admin only)',
      inputSchema: schemaToInputSchema(CreateEscrowPaymentArgsSchema),
    },
    {
      name: 'verify_escrow_payment',
      description: 'Verify escrow payment (Admin only)',
      inputSchema: schemaToInputSchema(VerifyEscrowPaymentArgsSchema),
    },
    {
      name: 'refund_escrow_payment',
      description: 'Refund escrow payment (Admin only)',
      inputSchema: schemaToInputSchema(RefundEscrowPaymentArgsSchema),
    },
    {
      name: 'list_escrow_payments',
      description: 'List escrow payments (Admin only)',
      inputSchema: schemaToInputSchema(ListEscrowPaymentsArgsSchema),
    },
    // Ban Appeals
    {
      name: 'appeal_ban',
      description: 'Appeal a ban',
      inputSchema: schemaToInputSchema(AppealBanArgsSchema),
    },
    {
      name: 'appeal_ban_with_escrow',
      description: 'Appeal ban with escrow payment',
      inputSchema: schemaToInputSchema(AppealBanWithEscrowArgsSchema),
    },
    // Favorites
    {
      name: 'favorite_profile',
      description: 'Favorite a profile',
      inputSchema: schemaToInputSchema(FavoriteProfileArgsSchema),
    },
    {
      name: 'unfavorite_profile',
      description: 'Unfavorite a profile',
      inputSchema: schemaToInputSchema(UnfavoriteProfileArgsSchema),
    },
    {
      name: 'get_favorites',
      description: 'Get favorited profiles',
      inputSchema: schemaToInputSchema(GetFavoritesArgsSchema),
    },
    {
      name: 'get_favorite_posts',
      description: 'Get favorited posts',
      inputSchema: schemaToInputSchema(GetFavoritePostsArgsSchema),
    },
    // Points Transfer
    {
      name: 'transfer_points',
      description: 'Transfer points to another user',
      inputSchema: schemaToInputSchema(TransferPointsArgsSchema),
    },
  ];
}
