/**
 * MCP Tool Arguments Validation
 *
 * Zod schemas for validating tool arguments.
 * Types are inferred from schemas using z.infer<> - no duplication.
 */

import { JsonValueSchema } from '@babylon/shared';
import { z } from 'zod';

// Core Market Operations
export const GetMarketsArgsSchema = z.object({
  type: z.enum(['prediction', 'perpetuals', 'all']).optional(),
});

export const PlaceBetArgsSchema = z.object({
  marketId: z.string().min(1),
  side: z.enum(['YES', 'NO']),
  amount: z.number().positive(),
});

export const GetBalanceArgsSchema = z.object({});

export const GetPositionsArgsSchema = z.object({
  marketId: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export const ClosePositionArgsSchema = z.object({
  positionId: z.string().min(1),
});

export const GetMarketDataArgsSchema = z.object({
  marketId: z.string().min(1),
});

export const QueryFeedArgsSchema = z.object({
  limit: z.number().int().positive().optional(),
  questionId: z.string().optional(),
});

/**
 * Validate and parse tool arguments
 */
export function validateGetMarketsArgs(args: unknown): GetMarketsArgs {
  return GetMarketsArgsSchema.parse(args);
}

export function validatePlaceBetArgs(args: unknown): PlaceBetArgs {
  return PlaceBetArgsSchema.parse(args);
}

export function validateGetBalanceArgs(args: unknown): GetBalanceArgs {
  return GetBalanceArgsSchema.parse(args);
}

export function validateGetPositionsArgs(args: unknown): GetPositionsArgs {
  return GetPositionsArgsSchema.parse(args);
}

export function validateClosePositionArgs(args: unknown): ClosePositionArgs {
  return ClosePositionArgsSchema.parse(args);
}

export function validateGetMarketDataArgs(args: unknown): GetMarketDataArgs {
  return GetMarketDataArgsSchema.parse(args);
}

export function validateQueryFeedArgs(args: unknown): QueryFeedArgs {
  return QueryFeedArgsSchema.parse(args);
}

// Market Operations - Validation Schemas
export const BuySharesArgsSchema = z.object({
  marketId: z.string().min(1),
  outcome: z.enum(['YES', 'NO']),
  amount: z.number().positive(),
});

export const SellSharesArgsSchema = z.object({
  positionId: z.string().min(1),
  shares: z.number().positive(),
});

export const OpenPositionArgsSchema = z.object({
  ticker: z.string().min(1),
  side: z.enum(['LONG', 'SHORT']),
  amount: z.number().positive(),
  leverage: z.number().min(1).max(100),
});

export const GetMarketPricesArgsSchema = z.object({
  marketId: z.string().min(1),
});

export const GetPerpetualsArgsSchema = z.object({});

export const GetTradesArgsSchema = z.object({
  limit: z.number().int().positive().optional(),
  marketId: z.string().optional(),
});

export const GetTradeHistoryArgsSchema = z.object({
  userId: z.string().min(1),
  limit: z.number().int().positive().optional(),
});

// Social Features - Validation Schemas
export const CreatePostArgsSchema = z.object({
  content: z.string().min(1).max(5000),
  type: z.enum(['post', 'article']).optional().default('post'),
});

export const DeletePostArgsSchema = z.object({
  postId: z.string().min(1),
});

export const LikePostArgsSchema = z.object({
  postId: z.string().min(1),
});

export const UnlikePostArgsSchema = z.object({
  postId: z.string().min(1),
});

export const SharePostArgsSchema = z.object({
  postId: z.string().min(1),
  comment: z.string().optional(),
});

export const GetCommentsArgsSchema = z.object({
  postId: z.string().min(1),
  limit: z.number().int().positive().optional().default(50),
});

export const CreateCommentArgsSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

export const DeleteCommentArgsSchema = z.object({
  commentId: z.string().min(1),
});

export const LikeCommentArgsSchema = z.object({
  commentId: z.string().min(1),
});

export const GetPostsByTagArgsSchema = z.object({
  tag: z.string().min(1),
  limit: z.number().int().positive().optional().default(20),
  offset: z.number().int().nonnegative().optional().default(0),
});

// User Management - Validation Schemas
export const GetUserProfileArgsSchema = z.object({
  userId: z.string().min(1),
});

export const UpdateProfileArgsSchema = z.object({
  displayName: z.string().optional(),
  bio: z.string().max(500).optional(),
  username: z.string().optional(),
  profileImageUrl: z.string().optional(),
});

export const FollowUserArgsSchema = z.object({
  userId: z.string().min(1),
});

export const UnfollowUserArgsSchema = z.object({
  userId: z.string().min(1),
});

export const GetFollowersArgsSchema = z.object({
  userId: z.string().min(1),
  limit: z.number().int().positive().optional().default(50),
});

export const GetFollowingArgsSchema = z.object({
  userId: z.string().min(1),
  limit: z.number().int().positive().optional().default(50),
});

export const SearchUsersArgsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional().default(20),
});

export const GetUserWalletArgsSchema = z.object({
  userId: z.string().min(1),
});

export const GetUserStatsArgsSchema = z.object({
  userId: z.string().min(1),
});

// Chats & Messaging - Validation Schemas
export const GetChatsArgsSchema = z.object({
  filter: z.enum(['all', 'dms', 'groups']).optional(),
});

export const GetChatMessagesArgsSchema = z.object({
  chatId: z.string().min(1),
  limit: z.number().int().positive().optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

export const SendMessageArgsSchema = z.object({
  chatId: z.string().min(1),
  content: z.string().min(1).max(5000),
});

export const CreateGroupArgsSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string().min(1)).min(1),
});

export const LeaveChatArgsSchema = z.object({
  chatId: z.string().min(1),
});

export const GetUnreadCountArgsSchema = z.object({});

// Notifications - Validation Schemas
export const GetNotificationsArgsSchema = z.object({
  limit: z.number().int().positive().optional().default(100),
});

export const MarkNotificationsReadArgsSchema = z.object({
  notificationIds: z.array(z.string().min(1)),
});

export const GetGroupInvitesArgsSchema = z.object({});

export const AcceptGroupInviteArgsSchema = z.object({
  inviteId: z.string().min(1),
});

export const DeclineGroupInviteArgsSchema = z.object({
  inviteId: z.string().min(1),
});

// Leaderboard & Stats - Validation Schemas
export const GetLeaderboardArgsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().optional().default(100),
  pointsType: z.enum(['all', 'earned', 'referral']).optional().default('all'),
  minPoints: z.number().nonnegative().optional().default(0),
});

export const GetSystemStatsArgsSchema = z.object({});

// Referrals & Rewards - Validation Schemas
export const GetReferralCodeArgsSchema = z.object({});

export const GetReferralsArgsSchema = z.object({});

export const GetReferralStatsArgsSchema = z.object({});

// Reputation - Validation Schemas
export const GetReputationArgsSchema = z.object({
  userId: z.string().optional(),
});

export const GetReputationBreakdownArgsSchema = z.object({
  userId: z.string().min(1),
});

// Trending & Discovery - Validation Schemas
export const GetTrendingTagsArgsSchema = z.object({
  limit: z.number().int().positive().optional().default(20),
});

// Organizations - Validation Schemas
export const GetOrganizationsArgsSchema = z.object({
  limit: z.number().int().positive().optional().default(50),
});

// x402 Micropayments - Validation Schemas
export const PaymentRequestArgsSchema = z.object({
  to: z.string().min(1),
  amount: z.string().min(1),
  service: z.string().min(1),
  metadata: z.record(z.string(), JsonValueSchema).optional(),
  from: z.string().optional(),
});

export const PaymentReceiptArgsSchema = z.object({
  requestId: z.string().min(1),
  txHash: z.string().min(1),
});

// Moderation - Validation Schemas
export const BlockUserArgsSchema = z.object({
  userId: z.string().min(1),
});

export const UnblockUserArgsSchema = z.object({
  userId: z.string().min(1),
});

export const MuteUserArgsSchema = z.object({
  userId: z.string().min(1),
});

export const UnmuteUserArgsSchema = z.object({
  userId: z.string().min(1),
});

export const ReportUserArgsSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(1),
});

export const ReportPostArgsSchema = z.object({
  postId: z.string().min(1),
  reason: z.string().min(1),
});

export const GetBlocksArgsSchema = z.object({});

export const GetMutesArgsSchema = z.object({});

export const CheckBlockStatusArgsSchema = z.object({
  userId: z.string().min(1),
});

export const CheckMuteStatusArgsSchema = z.object({
  userId: z.string().min(1),
});

// Moderation Escrow - Validation Schemas
export const CreateEscrowPaymentArgsSchema = z.object({
  recipientId: z.string().min(1),
  amountUSD: z.number().positive(),
  reason: z.string().optional(),
  recipientWalletAddress: z.string().min(1),
});

export const VerifyEscrowPaymentArgsSchema = z.object({
  escrowId: z.string().min(1),
  txHash: z.string().min(1),
  fromAddress: z.string().min(1),
  toAddress: z.string().min(1),
  amount: z.string().min(1),
});

export const RefundEscrowPaymentArgsSchema = z.object({
  escrowId: z.string().min(1),
  refundTxHash: z.string().min(1),
  reason: z.string().optional(),
});

export const ListEscrowPaymentsArgsSchema = z.object({
  recipientId: z.string().optional(),
  adminId: z.string().optional(),
  status: z.enum(['pending', 'paid', 'refunded', 'expired']).optional(),
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

// Ban Appeals - Validation Schemas
export const AppealBanArgsSchema = z.object({
  reason: z.string().min(10).max(2000),
});

export const AppealBanWithEscrowArgsSchema = z.object({
  reason: z.string().min(10).max(2000),
  escrowPaymentTxHash: z.string().min(1),
});

// Favorites - Validation Schemas
export const FavoriteProfileArgsSchema = z.object({
  userId: z.string().min(1),
});

export const UnfavoriteProfileArgsSchema = z.object({
  userId: z.string().min(1),
});

export const GetFavoritesArgsSchema = z.object({
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

export const GetFavoritePostsArgsSchema = z.object({
  limit: z.number().int().positive().max(100).optional().default(20),
  offset: z.number().int().nonnegative().optional().default(0),
});

// Points Transfer - Validation Schemas
export const TransferPointsArgsSchema = z.object({
  recipientId: z.string().min(1),
  amount: z.number().int().positive(),
  message: z.string().max(200).optional(),
});

// Inferred Types from Schemas - Single Source of Truth
export type GetMarketsArgs = z.infer<typeof GetMarketsArgsSchema>;
export type PlaceBetArgs = z.infer<typeof PlaceBetArgsSchema>;
export type GetBalanceArgs = z.infer<typeof GetBalanceArgsSchema>;
export type GetPositionsArgs = z.infer<typeof GetPositionsArgsSchema>;
export type ClosePositionArgs = z.infer<typeof ClosePositionArgsSchema>;
export type GetMarketDataArgs = z.infer<typeof GetMarketDataArgsSchema>;
export type QueryFeedArgs = z.infer<typeof QueryFeedArgsSchema>;
export type BuySharesArgs = z.infer<typeof BuySharesArgsSchema>;
export type SellSharesArgs = z.infer<typeof SellSharesArgsSchema>;
export type OpenPositionArgs = z.infer<typeof OpenPositionArgsSchema>;
export type GetMarketPricesArgs = z.infer<typeof GetMarketPricesArgsSchema>;
export type GetPerpetualsArgs = z.infer<typeof GetPerpetualsArgsSchema>;
export type GetTradesArgs = z.infer<typeof GetTradesArgsSchema>;
export type GetTradeHistoryArgs = z.infer<typeof GetTradeHistoryArgsSchema>;
export type CreatePostArgs = z.infer<typeof CreatePostArgsSchema>;
export type DeletePostArgs = z.infer<typeof DeletePostArgsSchema>;
export type LikePostArgs = z.infer<typeof LikePostArgsSchema>;
export type UnlikePostArgs = z.infer<typeof UnlikePostArgsSchema>;
export type SharePostArgs = z.infer<typeof SharePostArgsSchema>;
export type GetCommentsArgs = z.infer<typeof GetCommentsArgsSchema>;
export type CreateCommentArgs = z.infer<typeof CreateCommentArgsSchema>;
export type DeleteCommentArgs = z.infer<typeof DeleteCommentArgsSchema>;
export type LikeCommentArgs = z.infer<typeof LikeCommentArgsSchema>;
export type GetPostsByTagArgs = z.infer<typeof GetPostsByTagArgsSchema>;
export type GetUserProfileArgs = z.infer<typeof GetUserProfileArgsSchema>;
export type UpdateProfileArgs = z.infer<typeof UpdateProfileArgsSchema>;
export type FollowUserArgs = z.infer<typeof FollowUserArgsSchema>;
export type UnfollowUserArgs = z.infer<typeof UnfollowUserArgsSchema>;
export type GetFollowersArgs = z.infer<typeof GetFollowersArgsSchema>;
export type GetFollowingArgs = z.infer<typeof GetFollowingArgsSchema>;
export type SearchUsersArgs = z.infer<typeof SearchUsersArgsSchema>;
export type GetUserWalletArgs = z.infer<typeof GetUserWalletArgsSchema>;
export type GetUserStatsArgs = z.infer<typeof GetUserStatsArgsSchema>;
export type GetChatsArgs = z.infer<typeof GetChatsArgsSchema>;
export type GetChatMessagesArgs = z.infer<typeof GetChatMessagesArgsSchema>;
export type SendMessageArgs = z.infer<typeof SendMessageArgsSchema>;
export type CreateGroupArgs = z.infer<typeof CreateGroupArgsSchema>;
export type LeaveChatArgs = z.infer<typeof LeaveChatArgsSchema>;
export type GetUnreadCountArgs = z.infer<typeof GetUnreadCountArgsSchema>;
export type GetNotificationsArgs = z.infer<typeof GetNotificationsArgsSchema>;
export type MarkNotificationsReadArgs = z.infer<
  typeof MarkNotificationsReadArgsSchema
>;
export type GetGroupInvitesArgs = z.infer<typeof GetGroupInvitesArgsSchema>;
export type AcceptGroupInviteArgs = z.infer<typeof AcceptGroupInviteArgsSchema>;
export type DeclineGroupInviteArgs = z.infer<
  typeof DeclineGroupInviteArgsSchema
>;
export type GetLeaderboardArgs = z.infer<typeof GetLeaderboardArgsSchema>;
export type GetSystemStatsArgs = z.infer<typeof GetSystemStatsArgsSchema>;
export type GetReferralCodeArgs = z.infer<typeof GetReferralCodeArgsSchema>;
export type GetReferralsArgs = z.infer<typeof GetReferralsArgsSchema>;
export type GetReferralStatsArgs = z.infer<typeof GetReferralStatsArgsSchema>;
export type GetReputationArgs = z.infer<typeof GetReputationArgsSchema>;
export type GetReputationBreakdownArgs = z.infer<
  typeof GetReputationBreakdownArgsSchema
>;
export type GetTrendingTagsArgs = z.infer<typeof GetTrendingTagsArgsSchema>;
export type GetOrganizationsArgs = z.infer<typeof GetOrganizationsArgsSchema>;
export type PaymentRequestArgs = z.infer<typeof PaymentRequestArgsSchema>;
export type PaymentReceiptArgs = z.infer<typeof PaymentReceiptArgsSchema>;
export type BlockUserArgs = z.infer<typeof BlockUserArgsSchema>;
export type UnblockUserArgs = z.infer<typeof UnblockUserArgsSchema>;
export type MuteUserArgs = z.infer<typeof MuteUserArgsSchema>;
export type UnmuteUserArgs = z.infer<typeof UnmuteUserArgsSchema>;
export type ReportUserArgs = z.infer<typeof ReportUserArgsSchema>;
export type ReportPostArgs = z.infer<typeof ReportPostArgsSchema>;
export type GetBlocksArgs = z.infer<typeof GetBlocksArgsSchema>;
export type GetMutesArgs = z.infer<typeof GetMutesArgsSchema>;
export type CheckBlockStatusArgs = z.infer<typeof CheckBlockStatusArgsSchema>;
export type CheckMuteStatusArgs = z.infer<typeof CheckMuteStatusArgsSchema>;
export type CreateEscrowPaymentArgs = z.infer<
  typeof CreateEscrowPaymentArgsSchema
>;
export type VerifyEscrowPaymentArgs = z.infer<
  typeof VerifyEscrowPaymentArgsSchema
>;
export type RefundEscrowPaymentArgs = z.infer<
  typeof RefundEscrowPaymentArgsSchema
>;
export type ListEscrowPaymentsArgs = z.infer<
  typeof ListEscrowPaymentsArgsSchema
>;
export type AppealBanArgs = z.infer<typeof AppealBanArgsSchema>;
export type AppealBanWithEscrowArgs = z.infer<
  typeof AppealBanWithEscrowArgsSchema
>;
export type FavoriteProfileArgs = z.infer<typeof FavoriteProfileArgsSchema>;
export type UnfavoriteProfileArgs = z.infer<typeof UnfavoriteProfileArgsSchema>;
export type GetFavoritesArgs = z.infer<typeof GetFavoritesArgsSchema>;
export type GetFavoritePostsArgs = z.infer<typeof GetFavoritePostsArgsSchema>;
export type TransferPointsArgs = z.infer<typeof TransferPointsArgsSchema>;

// Validation Functions - Market Operations
export function validateBuySharesArgs(args: unknown): BuySharesArgs {
  return BuySharesArgsSchema.parse(args);
}

export function validateSellSharesArgs(args: unknown): SellSharesArgs {
  return SellSharesArgsSchema.parse(args);
}

export function validateOpenPositionArgs(args: unknown): OpenPositionArgs {
  return OpenPositionArgsSchema.parse(args);
}

export function validateGetMarketPricesArgs(
  args: unknown
): GetMarketPricesArgs {
  return GetMarketPricesArgsSchema.parse(args);
}

export function validateGetPerpetualsArgs(args: unknown): GetPerpetualsArgs {
  return GetPerpetualsArgsSchema.parse(args);
}

export function validateGetTradesArgs(args: unknown): GetTradesArgs {
  return GetTradesArgsSchema.parse(args);
}

export function validateGetTradeHistoryArgs(
  args: unknown
): GetTradeHistoryArgs {
  return GetTradeHistoryArgsSchema.parse(args);
}

// Validation Functions - Social Features
export function validateCreatePostArgs(args: unknown): CreatePostArgs {
  return CreatePostArgsSchema.parse(args);
}

export function validateDeletePostArgs(args: unknown): DeletePostArgs {
  return DeletePostArgsSchema.parse(args);
}

export function validateLikePostArgs(args: unknown): LikePostArgs {
  return LikePostArgsSchema.parse(args);
}

export function validateUnlikePostArgs(args: unknown): UnlikePostArgs {
  return UnlikePostArgsSchema.parse(args);
}

export function validateSharePostArgs(args: unknown): SharePostArgs {
  return SharePostArgsSchema.parse(args);
}

export function validateGetCommentsArgs(args: unknown): GetCommentsArgs {
  return GetCommentsArgsSchema.parse(args);
}

export function validateCreateCommentArgs(args: unknown): CreateCommentArgs {
  return CreateCommentArgsSchema.parse(args);
}

export function validateDeleteCommentArgs(args: unknown): DeleteCommentArgs {
  return DeleteCommentArgsSchema.parse(args);
}

export function validateLikeCommentArgs(args: unknown): LikeCommentArgs {
  return LikeCommentArgsSchema.parse(args);
}

export function validateGetPostsByTagArgs(args: unknown): GetPostsByTagArgs {
  return GetPostsByTagArgsSchema.parse(args);
}

// Validation Functions - User Management
export function validateGetUserProfileArgs(args: unknown): GetUserProfileArgs {
  return GetUserProfileArgsSchema.parse(args);
}

export function validateUpdateProfileArgs(args: unknown): UpdateProfileArgs {
  return UpdateProfileArgsSchema.parse(args);
}

export function validateFollowUserArgs(args: unknown): FollowUserArgs {
  return FollowUserArgsSchema.parse(args);
}

export function validateUnfollowUserArgs(args: unknown): UnfollowUserArgs {
  return UnfollowUserArgsSchema.parse(args);
}

export function validateGetFollowersArgs(args: unknown): GetFollowersArgs {
  return GetFollowersArgsSchema.parse(args);
}

export function validateGetFollowingArgs(args: unknown): GetFollowingArgs {
  return GetFollowingArgsSchema.parse(args);
}

export function validateSearchUsersArgs(args: unknown): SearchUsersArgs {
  return SearchUsersArgsSchema.parse(args);
}

export function validateGetUserWalletArgs(args: unknown): GetUserWalletArgs {
  return GetUserWalletArgsSchema.parse(args);
}

export function validateGetUserStatsArgs(args: unknown): GetUserStatsArgs {
  return GetUserStatsArgsSchema.parse(args);
}

// Validation Functions - Chats & Messaging
export function validateGetChatsArgs(args: unknown): GetChatsArgs {
  return GetChatsArgsSchema.parse(args);
}

export function validateGetChatMessagesArgs(
  args: unknown
): GetChatMessagesArgs {
  return GetChatMessagesArgsSchema.parse(args);
}

export function validateSendMessageArgs(args: unknown): SendMessageArgs {
  return SendMessageArgsSchema.parse(args);
}

export function validateCreateGroupArgs(args: unknown): CreateGroupArgs {
  return CreateGroupArgsSchema.parse(args);
}

export function validateLeaveChatArgs(args: unknown): LeaveChatArgs {
  return LeaveChatArgsSchema.parse(args);
}

export function validateGetUnreadCountArgs(args: unknown): GetUnreadCountArgs {
  return GetUnreadCountArgsSchema.parse(args);
}

// Validation Functions - Notifications
export function validateGetNotificationsArgs(
  args: unknown
): GetNotificationsArgs {
  return GetNotificationsArgsSchema.parse(args);
}

export function validateMarkNotificationsReadArgs(
  args: unknown
): MarkNotificationsReadArgs {
  return MarkNotificationsReadArgsSchema.parse(args);
}

export function validateGetGroupInvitesArgs(
  args: unknown
): GetGroupInvitesArgs {
  return GetGroupInvitesArgsSchema.parse(args);
}

export function validateAcceptGroupInviteArgs(
  args: unknown
): AcceptGroupInviteArgs {
  return AcceptGroupInviteArgsSchema.parse(args);
}

export function validateDeclineGroupInviteArgs(
  args: unknown
): DeclineGroupInviteArgs {
  return DeclineGroupInviteArgsSchema.parse(args);
}

// Validation Functions - Leaderboard & Stats
export function validateGetLeaderboardArgs(args: unknown): GetLeaderboardArgs {
  return GetLeaderboardArgsSchema.parse(args);
}

export function validateGetSystemStatsArgs(args: unknown): GetSystemStatsArgs {
  return GetSystemStatsArgsSchema.parse(args);
}

// Validation Functions - Referrals & Rewards
export function validateGetReferralCodeArgs(
  args: unknown
): GetReferralCodeArgs {
  return GetReferralCodeArgsSchema.parse(args);
}

export function validateGetReferralsArgs(args: unknown): GetReferralsArgs {
  return GetReferralsArgsSchema.parse(args);
}

export function validateGetReferralStatsArgs(
  args: unknown
): GetReferralStatsArgs {
  return GetReferralStatsArgsSchema.parse(args);
}

// Validation Functions - Reputation
export function validateGetReputationArgs(args: unknown): GetReputationArgs {
  return GetReputationArgsSchema.parse(args);
}

export function validateGetReputationBreakdownArgs(
  args: unknown
): GetReputationBreakdownArgs {
  return GetReputationBreakdownArgsSchema.parse(args);
}

// Validation Functions - Trending & Discovery
export function validateGetTrendingTagsArgs(
  args: unknown
): GetTrendingTagsArgs {
  return GetTrendingTagsArgsSchema.parse(args);
}

// Validation Functions - Organizations
export function validateGetOrganizationsArgs(
  args: unknown
): GetOrganizationsArgs {
  return GetOrganizationsArgsSchema.parse(args);
}

// Validation Functions - x402 Micropayments
export function validatePaymentRequestArgs(args: unknown): PaymentRequestArgs {
  return PaymentRequestArgsSchema.parse(args);
}

export function validatePaymentReceiptArgs(args: unknown): PaymentReceiptArgs {
  return PaymentReceiptArgsSchema.parse(args);
}

// Validation Functions - Moderation
export function validateBlockUserArgs(args: unknown): BlockUserArgs {
  return BlockUserArgsSchema.parse(args);
}

export function validateUnblockUserArgs(args: unknown): UnblockUserArgs {
  return UnblockUserArgsSchema.parse(args);
}

export function validateMuteUserArgs(args: unknown): MuteUserArgs {
  return MuteUserArgsSchema.parse(args);
}

export function validateUnmuteUserArgs(args: unknown): UnmuteUserArgs {
  return UnmuteUserArgsSchema.parse(args);
}

export function validateReportUserArgs(args: unknown): ReportUserArgs {
  return ReportUserArgsSchema.parse(args);
}

export function validateReportPostArgs(args: unknown): ReportPostArgs {
  return ReportPostArgsSchema.parse(args);
}

export function validateGetBlocksArgs(args: unknown): GetBlocksArgs {
  return GetBlocksArgsSchema.parse(args);
}

export function validateGetMutesArgs(args: unknown): GetMutesArgs {
  return GetMutesArgsSchema.parse(args);
}

export function validateCheckBlockStatusArgs(
  args: unknown
): CheckBlockStatusArgs {
  return CheckBlockStatusArgsSchema.parse(args);
}

export function validateCheckMuteStatusArgs(
  args: unknown
): CheckMuteStatusArgs {
  return CheckMuteStatusArgsSchema.parse(args);
}

// Validation Functions - Moderation Escrow
export function validateCreateEscrowPaymentArgs(
  args: unknown
): CreateEscrowPaymentArgs {
  return CreateEscrowPaymentArgsSchema.parse(args);
}

export function validateVerifyEscrowPaymentArgs(
  args: unknown
): VerifyEscrowPaymentArgs {
  return VerifyEscrowPaymentArgsSchema.parse(args);
}

export function validateRefundEscrowPaymentArgs(
  args: unknown
): RefundEscrowPaymentArgs {
  return RefundEscrowPaymentArgsSchema.parse(args);
}

export function validateListEscrowPaymentsArgs(
  args: unknown
): ListEscrowPaymentsArgs {
  return ListEscrowPaymentsArgsSchema.parse(args);
}

// Validation Functions - Ban Appeals
export function validateAppealBanArgs(args: unknown): AppealBanArgs {
  return AppealBanArgsSchema.parse(args);
}

export function validateAppealBanWithEscrowArgs(
  args: unknown
): AppealBanWithEscrowArgs {
  return AppealBanWithEscrowArgsSchema.parse(args);
}

// Validation Functions - Favorites
export function validateFavoriteProfileArgs(
  args: unknown
): FavoriteProfileArgs {
  return FavoriteProfileArgsSchema.parse(args);
}

export function validateUnfavoriteProfileArgs(
  args: unknown
): UnfavoriteProfileArgs {
  return UnfavoriteProfileArgsSchema.parse(args);
}

export function validateGetFavoritesArgs(args: unknown): GetFavoritesArgs {
  return GetFavoritesArgsSchema.parse(args);
}

export function validateGetFavoritePostsArgs(
  args: unknown
): GetFavoritePostsArgs {
  return GetFavoritePostsArgsSchema.parse(args);
}

// Validation Functions - Points Transfer
export function validateTransferPointsArgs(args: unknown): TransferPointsArgs {
  return TransferPointsArgsSchema.parse(args);
}
