/**
 * Database Model Types
 *
 * Pure TypeScript interfaces for all database tables.
 * These types match the EQLite schema definitions.
 *
 * Example:
 *   import type { User, Post, Market } from '@babylon/db';
 *
 *   const user: User | null = await db.user.findUnique({ where: { id } });
 *   const posts: Post[] = await db.post.findMany({ where: { authorId: user?.id } });
 */

import type { JsonValue } from './types'

// ============================================================================
// Select Types (what you get when reading from the database)
// ============================================================================

export interface User {
  id: string
  walletAddress: string | null
  username: string | null
  displayName: string | null
  bio: string | null
  profileImageUrl: string | null
  isActor: boolean
  createdAt: Date
  updatedAt: Date
  personality: string | null
  postStyle: string | null
  postExample: string | null
  virtualBalance: string
  totalDeposited: string
  totalWithdrawn: string
  lifetimePnL: string
  profileComplete: boolean
  hasProfileImage: boolean
  hasUsername: boolean
  hasBio: boolean
  profileSetupCompletedAt: Date | null
  farcasterUsername: string | null
  hasFarcaster: boolean
  hasTwitter: boolean
  hasDiscord: boolean
  nftTokenId: number | null
  onChainRegistered: boolean
  pointsAwardedForFarcaster: boolean
  pointsAwardedForFarcasterFollow: boolean
  pointsAwardedForProfile: boolean
  pointsAwardedForProfileImage: boolean
  pointsAwardedForTwitter: boolean
  pointsAwardedForTwitterFollow: boolean
  pointsAwardedForDiscord: boolean
  pointsAwardedForDiscordJoin: boolean
  pointsAwardedForUsername: boolean
  pointsAwardedForWallet: boolean
  pointsAwardedForReferralBonus: boolean
  pointsAwardedForShare: boolean
  pointsAwardedForPrivateGroup: boolean
  pointsAwardedForPrivateChannel: boolean
  referralCode: string | null
  referralCount: number
  referredBy: string | null
  registrationIpHash: string | null
  lastReferralIpHash: string | null
  registrationTxHash: string | null
  reputationPoints: number
  twitterUsername: string | null
  bannerDismissCount: number
  bannerLastShown: Date | null
  coverImageUrl: string | null
  showFarcasterPublic: boolean
  showTwitterPublic: boolean
  showWalletPublic: boolean
  usernameChangedAt: Date | null
  agent0FeedbackCount: number | null
  agent0MetadataCID: string | null
  agent0RegisteredAt: Date | null
  agent0TokenId: number | null
  agent0TrustScore: number | null
  bannedAt: Date | null
  bannedBy: string | null
  bannedReason: string | null
  farcasterDisplayName: string | null
  farcasterFid: string | null
  farcasterPfpUrl: string | null
  farcasterVerifiedAt: Date | null
  isAdmin: boolean
  isBanned: boolean
  isScammer: boolean
  isCSAM: boolean
  appealCount: number
  appealStaked: boolean
  appealStakeAmount: string | null
  appealStakeTxHash: string | null
  appealStatus: string | null
  appealSubmittedAt: Date | null
  appealReviewedAt: Date | null
  falsePositiveHistory: JsonValue | null
  privyId: string | null
  oauth3Id: string | null
  kmsKeyId: string | null
  registrationBlockNumber: bigint | null
  registrationGasUsed: bigint | null
  registrationTimestamp: Date | null
  role: string | null
  totalFeesEarned: string
  totalFeesPaid: string
  twitterAccessToken: string | null
  twitterId: string | null
  twitterRefreshToken: string | null
  twitterTokenExpiresAt: Date | null
  twitterVerifiedAt: Date | null
  discordId: string | null
  discordUsername: string | null
  discordAccessToken: string | null
  discordRefreshToken: string | null
  discordTokenExpiresAt: Date | null
  discordVerifiedAt: Date | null
  tosAccepted: boolean
  tosAcceptedAt: Date | null
  tosAcceptedVersion: string | null
  privacyPolicyAccepted: boolean
  privacyPolicyAcceptedAt: Date | null
  privacyPolicyAcceptedVersion: string | null
  invitePoints: number
  earnedPoints: number
  bonusPoints: number
  waitlistPosition: number | null
  waitlistJoinedAt: Date | null
  isWaitlistActive: boolean
  isTest: boolean
  pointsAwardedForEmail: boolean
  emailVerified: boolean
  email: string | null
  waitlistGraduatedAt: Date | null
  isAgent: boolean
  managedBy: string | null
}

export interface ActorStateRow {
  id: string
  actorId: string
  state: JsonValue
  createdAt: Date
  updatedAt: Date
}

export interface ActorFollow {
  id: string
  actorId: string
  followerId: string
  createdAt: Date
}

export interface ActorRelationship {
  id: string
  actorId: string
  relatedActorId: string
  relationshipType: string
  createdAt: Date
}

export interface Post {
  id: string
  content: string
  authorId: string
  gameId: string | null
  dayNumber: number | null
  type: string
  timestamp: Date
  createdAt: Date
  updatedAt: Date | null
  deletedAt: Date | null
  commentOnPostId: string | null
  parentCommentId: string | null
  originalPostId: string | null
  articleTitle: string | null
  imageUrl: string | null
  mediaUrls: string[] | null
  visibility: string | null
  metadata: JsonValue | null
}

export interface Comment {
  id: string
  content: string
  postId: string
  authorId: string
  parentCommentId: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface Reaction {
  id: string
  postId: string | null
  commentId: string | null
  userId: string
  type: string
  createdAt: Date
}

export interface Share {
  id: string
  postId: string
  userId: string
  createdAt: Date
}

export interface Market {
  id: string
  question: string
  description: string | null
  gameId: string | null
  dayNumber: number | null
  yesShares: string
  noShares: string
  liquidity: string
  resolved: boolean
  resolution: boolean | null
  endDate: Date
  createdAt: Date
  updatedAt: Date
  onChainMarketId: string | null
  onChainResolved: boolean
}

export interface Position {
  id: string
  userId: string
  marketId: string
  side: boolean
  shares: string
  avgPrice: string
  amount: string
  status: string
  pnl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PerpPosition {
  id: string
  userId: string
  ticker: string
  organizationId: string
  side: string
  entryPrice: number
  currentPrice: number
  size: number
  leverage: number
  liquidationPrice: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  openedAt: Date
  lastUpdated: Date
  closedAt: Date | null
  realizedPnL: number | null
}

export interface Pool {
  id: string
  name: string
  npcActorId: string
  createdAt: Date
  updatedAt: Date
}

export interface PoolPosition {
  id: string
  poolId: string
  userId: string
  shares: string
  createdAt: Date
  updatedAt: Date
}

export interface PoolDeposit {
  id: string
  poolId: string
  userId: string
  amount: string
  createdAt: Date
}

export interface OrganizationStateRow {
  id: string
  organizationId: string
  state: JsonValue
  createdAt: Date
  updatedAt: Date
}

export interface StockPrice {
  id: string
  ticker: string
  price: number
  timestamp: Date
}

export interface Question {
  id: string
  question: string
  marketId: string
  createdAt: Date
}

export interface PredictionPriceHistory {
  id: string
  marketId: string
  yesPrice: string
  noPrice: string
  timestamp: Date
}

export interface Chat {
  id: string
  name: string | null
  description: string | null
  isGroup: boolean
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ChatParticipant {
  id: string
  chatId: string
  userId: string
  joinedAt: Date
}

export interface ChatAdmin {
  id: string
  chatId: string
  userId: string
  createdAt: Date
}

export interface ChatInvite {
  id: string
  chatId: string
  inviterId: string
  inviteeId: string
  createdAt: Date
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  content: string
  createdAt: Date
}

export interface Notification {
  id: string
  userId: string
  type: string
  actorId: string | null
  postId: string | null
  chatId: string | null
  message: string
  title: string
  read: boolean
  createdAt: Date
}

export interface DMAcceptance {
  id: string
  userId: string
  acceptedUserId: string
  createdAt: Date
}

export interface GroupChatMembership {
  id: string
  chatId: string
  userId: string
  role: string
  createdAt: Date
}

export interface UserInteraction {
  id: string
  userId: string
  npcId: string
  postId: string
  commentId: string
  timestamp: Date
  qualityScore: number
  wasFollowed: boolean
  wasInvitedToChat: boolean
}

export interface AgentRegistry {
  id: string
  userId: string
  name: string
  description: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface AgentCapability {
  id: string
  agentId: string
  capability: string
  createdAt: Date
}

export interface AgentLog {
  id: string
  agentId: string
  level: string
  message: string
  metadata: JsonValue | null
  createdAt: Date
}

export interface AgentMessage {
  id: string
  agentId: string
  content: string
  role: string
  createdAt: Date
}

export interface AgentPerformanceMetrics {
  id: string
  userId: string
  totalTrades: number
  winRate: number
  avgPnL: number
  createdAt: Date
  updatedAt: Date
}

export interface AgentGoal {
  id: string
  agentId: string
  goal: string
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface AgentGoalAction {
  id: string
  goalId: string
  action: string
  status: string
  createdAt: Date
}

export interface AgentPointsTransaction {
  id: string
  agentId: string
  points: number
  reason: string
  createdAt: Date
}

export interface AgentTrade {
  id: string
  agentId: string
  marketId: string
  side: boolean
  amount: string
  price: string
  createdAt: Date
}

export interface ExternalAgentConnection {
  id: string
  userId: string
  agentRegistryId: string
  createdAt: Date
}

export interface NPCTrade {
  id: string
  npcId: string
  marketId: string
  side: boolean
  amount: string
  createdAt: Date
}

export interface NPCInteraction {
  id: string
  npcId: string
  userId: string
  interactionType: string
  createdAt: Date
}

export interface TradingFee {
  id: string
  userId: string
  amount: string
  feeType: string
  createdAt: Date
}

export interface BalanceTransaction {
  id: string
  userId: string
  type: string
  amount: string
  balanceBefore: string
  balanceAfter: string
  relatedId: string | null
  description: string | null
  createdAt: Date
}

export interface PointsTransaction {
  id: string
  userId: string
  points: number
  reason: string
  createdAt: Date
}

export interface UserActorFollow {
  id: string
  userId: string
  actorId: string
  createdAt: Date
}

export interface UserGroup {
  id: string
  name: string
  description: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface UserGroupAdmin {
  id: string
  groupId: string
  userId: string
  createdAt: Date
}

export interface UserGroupInvite {
  id: string
  groupId: string
  inviterId: string
  inviteeId: string
  createdAt: Date
}

export interface UserGroupMember {
  id: string
  groupId: string
  userId: string
  createdAt: Date
}

export interface UserBlock {
  id: string
  blockerId: string
  blockedId: string
  reason: string | null
  createdAt: Date
}

export interface UserMute {
  id: string
  muterId: string
  mutedId: string
  reason: string | null
  createdAt: Date
}

export interface Report {
  id: string
  reporterId: string
  reportedId: string
  reason: string
  status: string
  createdAt: Date
}

export interface TwitterOAuthToken {
  id: string
  userId: string
  oauth1Token: string
  oauth1TokenSecret: string
  screenName: string | null
  createdAt: Date
  updatedAt: Date
}

export interface OnboardingIntent {
  id: string
  userId: string
  status: string
  referralCode: string | null
  payload: JsonValue | null
  profileApplied: boolean
  profileCompletedAt: Date | null
  onchainStartedAt: Date | null
  onchainCompletedAt: Date | null
  lastError: JsonValue | null
  createdAt: Date
  updatedAt: Date
}

export interface Favorite {
  id: string
  userId: string
  targetUserId: string
  createdAt: Date
}

export interface Follow {
  id: string
  followerId: string
  followingId: string
  createdAt: Date
}

export interface FollowStatus {
  id: string
  userId: string
  npcId: string
  followedAt: Date
  unfollowedAt: Date | null
  isActive: boolean
  followReason: string | null
}

export interface ProfileUpdateLog {
  id: string
  userId: string
  changedFields: string[]
  backendSigned: boolean
  txHash: string | null
  createdAt: Date
}

export interface ShareAction {
  id: string
  userId: string
  postId: string
  platform: string
  createdAt: Date
}

export interface Tag {
  id: string
  name: string
  createdAt: Date
}

export interface PostTag {
  id: string
  postId: string
  tagId: string
  createdAt: Date
}

export interface TrendingTag {
  id: string
  tagId: string
  score: number
  createdAt: Date
}

export interface LlmCallLog {
  id: string
  model: string
  prompt: string
  response: string
  latency: number
  createdAt: Date
}

export interface MarketOutcome {
  id: string
  marketId: string
  outcome: boolean
  resolvedAt: Date
}

export interface TrainedModel {
  id: string
  name: string
  version: string
  createdAt: Date
}

export interface TrainingBatch {
  id: string
  modelId: string
  status: string
  createdAt: Date
}

export interface BenchmarkResult {
  id: string
  modelId: string
  benchmarkId: string | null
  benchmarkName: string
  benchmarkPath: string | null
  score: number
  totalPnl: string
  predictionAccuracy: number | null
  optimalityScore: number | null
  detailedMetrics: JsonValue | null
  metadata: JsonValue | null
  modelVersion: string | null
  perpWinRate: number | null
  predWinRate: number | null
  avgReturn: number | null
  sharpeRatio: number | null
  baselinePnlDelta: number | null
  baselineAccuracyDelta: number | null
  improved: boolean | null
  duration: number | null
  runAt: Date
  createdAt: Date
}

export interface Trajectory {
  id: string
  agentId: string
  trajectory: JsonValue
  createdAt: Date
}

export interface RewardJudgment {
  id: string
  trajectoryId: string
  reward: number
  createdAt: Date
}

export interface OracleCommitment {
  id: string
  marketId: string
  commitment: string
  createdAt: Date
}

export interface OracleTransaction {
  id: string
  commitmentId: string
  txHash: string
  createdAt: Date
}

export interface RealtimeOutbox {
  id: string
  eventType: string
  payload: JsonValue
  createdAt: Date
}

export interface Game {
  id: string
  name: string
  status: string
  dayNumber: number
  createdAt: Date
  updatedAt: Date
}

export interface GameConfig {
  id: string
  gameId: string
  config: JsonValue
  createdAt: Date
}

export interface OAuthState {
  id: string
  state: string
  redirectUri: string
  createdAt: Date
}

export interface SystemSettings {
  id: string
  key: string
  value: JsonValue
  createdAt: Date
  updatedAt: Date
}

export interface WorldEvent {
  id: string
  eventType: string
  data: JsonValue
  createdAt: Date
}

export interface WorldFact {
  id: string
  fact: string
  source: string
  createdAt: Date
}

export interface RSSFeedSource {
  id: string
  url: string
  name: string
  createdAt: Date
}

export interface RSSHeadline {
  id: string
  sourceId: string
  title: string
  url: string
  createdAt: Date
}

export interface ParodyHeadline {
  id: string
  originalId: string
  parody: string
  createdAt: Date
}

export interface ModerationEscrow {
  id: string
  userId: string
  amount: string
  status: string
  createdAt: Date
}

export interface GenerationLock {
  id: string
  resourceType: string
  resourceId: string
  lockedAt: Date
  expiresAt: Date
}

export interface Feedback {
  id: string
  userId: string
  toUserId: string | null
  agent0TokenId: string | null
  type: string
  content: string
  comment: string | null
  category: string | null
  interactionType: string | null
  rating: number | null
  score: number | null
  createdAt: Date
  updatedAt: Date | null
  respondedAt: Date | null
  response: string | null
  metadata: JsonValue | null
}

export interface Referral {
  id: string
  referrerId: string
  referredUserId: string | null
  referralCode: string
  status: string
  createdAt: Date
  completedAt: Date | null
  qualifiedAt: Date | null
  signupPointsAwarded: boolean
  suspiciousReferralFlags: JsonValue | null
}

export interface WidgetCache {
  id: string
  widgetId: string
  data: JsonValue
  createdAt: Date
  expiresAt: Date
}

export interface UserAgentConfig {
  id: string
  userId: string
  config: JsonValue
  createdAt: Date
  updatedAt: Date
}

export interface UserApiKey {
  id: string
  userId: string
  keyHash: string
  name: string | null
  lastUsedAt: Date | null
  createdAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
}

export interface TickTokenStats {
  id: string
  tokenId: string
  stats: JsonValue
  createdAt: Date
}

// ============================================================================
// Insert Types (what you provide when inserting into the database)
// ============================================================================

export type NewUser = Partial<User> & Pick<User, 'id'>
export type NewActorStateRow = Partial<ActorStateRow> &
  Pick<ActorStateRow, 'id' | 'actorId' | 'state'>
export type NewActorFollow = Partial<ActorFollow> &
  Pick<ActorFollow, 'id' | 'actorId' | 'followerId'>
export type NewActorRelationship = Partial<ActorRelationship> &
  Pick<
    ActorRelationship,
    'id' | 'actorId' | 'relatedActorId' | 'relationshipType'
  >
export type NewPost = Partial<Post> & Pick<Post, 'id' | 'content' | 'authorId'>
export type NewComment = Partial<Comment> &
  Pick<Comment, 'id' | 'content' | 'postId' | 'authorId'>
export type NewReaction = Partial<Reaction> & Pick<Reaction, 'id' | 'userId'>
export type NewShare = Partial<Share> & Pick<Share, 'id' | 'postId' | 'userId'>
export type NewMarket = Partial<Market> &
  Pick<Market, 'id' | 'question' | 'endDate'>
export type NewPosition = Partial<Position> &
  Pick<Position, 'id' | 'userId' | 'marketId' | 'side' | 'shares' | 'avgPrice'>
export type NewPerpPosition = Partial<PerpPosition> &
  Pick<PerpPosition, 'id' | 'userId' | 'ticker' | 'organizationId'>
export type NewPool = Partial<Pool> & Pick<Pool, 'id' | 'name' | 'npcActorId'>
export type NewPoolPosition = Partial<PoolPosition> &
  Pick<PoolPosition, 'id' | 'poolId' | 'userId'>
export type NewPoolDeposit = Partial<PoolDeposit> &
  Pick<PoolDeposit, 'id' | 'poolId' | 'userId' | 'amount'>
export type NewOrganizationStateRow = Partial<OrganizationStateRow> &
  Pick<OrganizationStateRow, 'id' | 'organizationId' | 'state'>
export type NewStockPrice = Partial<StockPrice> &
  Pick<StockPrice, 'id' | 'ticker' | 'price'>
export type NewQuestion = Partial<Question> &
  Pick<Question, 'id' | 'question' | 'marketId'>
export type NewPredictionPriceHistory = Partial<PredictionPriceHistory> &
  Pick<PredictionPriceHistory, 'id' | 'marketId' | 'yesPrice' | 'noPrice'>
export type NewChat = Partial<Chat> & Pick<Chat, 'id'>
export type NewChatParticipant = Partial<ChatParticipant> &
  Pick<ChatParticipant, 'id' | 'chatId' | 'userId'>
export type NewChatAdmin = Partial<ChatAdmin> &
  Pick<ChatAdmin, 'id' | 'chatId' | 'userId'>
export type NewChatInvite = Partial<ChatInvite> &
  Pick<ChatInvite, 'id' | 'chatId' | 'inviterId' | 'inviteeId'>
export type NewMessage = Partial<Message> &
  Pick<Message, 'id' | 'chatId' | 'senderId' | 'content'>
export type NewNotification = Partial<Notification> &
  Pick<Notification, 'id' | 'userId' | 'type' | 'message' | 'title'>
export type NewDMAcceptance = Partial<DMAcceptance> &
  Pick<DMAcceptance, 'id' | 'userId' | 'acceptedUserId'>
export type NewGroupChatMembership = Partial<GroupChatMembership> &
  Pick<GroupChatMembership, 'id' | 'chatId' | 'userId'>
export type NewUserInteraction = Partial<UserInteraction> &
  Pick<UserInteraction, 'id' | 'userId' | 'npcId' | 'postId' | 'commentId'>
export type NewAgentRegistry = Partial<AgentRegistry> &
  Pick<AgentRegistry, 'id' | 'userId' | 'name'>
export type NewAgentCapability = Partial<AgentCapability> &
  Pick<AgentCapability, 'id' | 'agentId' | 'capability'>
export type NewAgentLog = Partial<AgentLog> &
  Pick<AgentLog, 'id' | 'agentId' | 'level' | 'message'>
export type NewAgentMessage = Partial<AgentMessage> &
  Pick<AgentMessage, 'id' | 'agentId' | 'content' | 'role'>
export type NewAgentPerformanceMetrics = Partial<AgentPerformanceMetrics> &
  Pick<AgentPerformanceMetrics, 'id' | 'userId'>
export type NewAgentGoal = Partial<AgentGoal> &
  Pick<AgentGoal, 'id' | 'agentId' | 'goal'>
export type NewAgentGoalAction = Partial<AgentGoalAction> &
  Pick<AgentGoalAction, 'id' | 'goalId' | 'action'>
export type NewAgentPointsTransaction = Partial<AgentPointsTransaction> &
  Pick<AgentPointsTransaction, 'id' | 'agentId' | 'points' | 'reason'>
export type NewAgentTrade = Partial<AgentTrade> &
  Pick<AgentTrade, 'id' | 'agentId' | 'marketId' | 'side' | 'amount' | 'price'>
export type NewExternalAgentConnection = Partial<ExternalAgentConnection> &
  Pick<ExternalAgentConnection, 'id' | 'userId' | 'agentRegistryId'>
export type NewNPCTrade = Partial<NPCTrade> &
  Pick<NPCTrade, 'id' | 'npcId' | 'marketId' | 'side' | 'amount'>
export type NewNPCInteraction = Partial<NPCInteraction> &
  Pick<NPCInteraction, 'id' | 'npcId' | 'userId' | 'interactionType'>
export type NewTradingFee = Partial<TradingFee> &
  Pick<TradingFee, 'id' | 'userId' | 'amount' | 'feeType'>
export type NewBalanceTransaction = Partial<BalanceTransaction> &
  Pick<
    BalanceTransaction,
    'id' | 'userId' | 'type' | 'amount' | 'balanceBefore' | 'balanceAfter'
  >
export type NewPointsTransaction = Partial<PointsTransaction> &
  Pick<PointsTransaction, 'id' | 'userId' | 'points' | 'reason'>
export type NewUserActorFollow = Partial<UserActorFollow> &
  Pick<UserActorFollow, 'id' | 'userId' | 'actorId'>
export type NewUserGroup = Partial<UserGroup> &
  Pick<UserGroup, 'id' | 'name' | 'createdBy'>
export type NewUserGroupAdmin = Partial<UserGroupAdmin> &
  Pick<UserGroupAdmin, 'id' | 'groupId' | 'userId'>
export type NewUserGroupInvite = Partial<UserGroupInvite> &
  Pick<UserGroupInvite, 'id' | 'groupId' | 'inviterId' | 'inviteeId'>
export type NewUserGroupMember = Partial<UserGroupMember> &
  Pick<UserGroupMember, 'id' | 'groupId' | 'userId'>
export type NewUserBlock = Partial<UserBlock> &
  Pick<UserBlock, 'id' | 'blockerId' | 'blockedId'>
export type NewUserMute = Partial<UserMute> &
  Pick<UserMute, 'id' | 'muterId' | 'mutedId'>
export type NewReport = Partial<Report> &
  Pick<Report, 'id' | 'reporterId' | 'reportedId' | 'reason'>
export type NewTwitterOAuthToken = Partial<TwitterOAuthToken> &
  Pick<TwitterOAuthToken, 'id' | 'userId' | 'oauth1Token' | 'oauth1TokenSecret'>
export type NewOnboardingIntent = Partial<OnboardingIntent> &
  Pick<OnboardingIntent, 'id' | 'userId'>
export type NewFavorite = Partial<Favorite> &
  Pick<Favorite, 'id' | 'userId' | 'targetUserId'>
export type NewFollow = Partial<Follow> &
  Pick<Follow, 'id' | 'followerId' | 'followingId'>
export type NewFollowStatus = Partial<FollowStatus> &
  Pick<FollowStatus, 'id' | 'userId' | 'npcId'>
export type NewProfileUpdateLog = Partial<ProfileUpdateLog> &
  Pick<ProfileUpdateLog, 'id' | 'userId' | 'changedFields' | 'backendSigned'>
export type NewShareAction = Partial<ShareAction> &
  Pick<ShareAction, 'id' | 'userId' | 'postId' | 'platform'>
export type NewTag = Partial<Tag> & Pick<Tag, 'id' | 'name'>
export type NewPostTag = Partial<PostTag> &
  Pick<PostTag, 'id' | 'postId' | 'tagId'>
export type NewTrendingTag = Partial<TrendingTag> &
  Pick<TrendingTag, 'id' | 'tagId' | 'score'>
export type NewLlmCallLog = Partial<LlmCallLog> &
  Pick<LlmCallLog, 'id' | 'model' | 'prompt' | 'response' | 'latency'>
export type NewMarketOutcome = Partial<MarketOutcome> &
  Pick<MarketOutcome, 'id' | 'marketId' | 'outcome'>
export type NewTrainedModel = Partial<TrainedModel> &
  Pick<TrainedModel, 'id' | 'name' | 'version'>
export type NewTrainingBatch = Partial<TrainingBatch> &
  Pick<TrainingBatch, 'id' | 'modelId'>
export type NewBenchmarkResult = Partial<BenchmarkResult> &
  Pick<BenchmarkResult, 'id' | 'modelId' | 'score'>
export type NewTrajectory = Partial<Trajectory> &
  Pick<Trajectory, 'id' | 'agentId' | 'trajectory'>
export type NewRewardJudgment = Partial<RewardJudgment> &
  Pick<RewardJudgment, 'id' | 'trajectoryId' | 'reward'>
export type NewOracleCommitment = Partial<OracleCommitment> &
  Pick<OracleCommitment, 'id' | 'marketId' | 'commitment'>
export type NewOracleTransaction = Partial<OracleTransaction> &
  Pick<OracleTransaction, 'id' | 'commitmentId' | 'txHash'>
export type NewRealtimeOutbox = Partial<RealtimeOutbox> &
  Pick<RealtimeOutbox, 'id' | 'eventType' | 'payload'>
export type NewGame = Partial<Game> & Pick<Game, 'id' | 'name'>
export type NewGameConfig = Partial<GameConfig> &
  Pick<GameConfig, 'id' | 'gameId' | 'config'>
export type NewOAuthState = Partial<OAuthState> &
  Pick<OAuthState, 'id' | 'state' | 'redirectUri'>
export type NewSystemSettings = Partial<SystemSettings> &
  Pick<SystemSettings, 'id' | 'key' | 'value'>
export type NewWorldEvent = Partial<WorldEvent> &
  Pick<WorldEvent, 'id' | 'eventType' | 'data'>
export type NewWorldFact = Partial<WorldFact> &
  Pick<WorldFact, 'id' | 'fact' | 'source'>
export type NewRSSFeedSource = Partial<RSSFeedSource> &
  Pick<RSSFeedSource, 'id' | 'url' | 'name'>
export type NewRSSHeadline = Partial<RSSHeadline> &
  Pick<RSSHeadline, 'id' | 'sourceId' | 'title' | 'url'>
export type NewParodyHeadline = Partial<ParodyHeadline> &
  Pick<ParodyHeadline, 'id' | 'originalId' | 'parody'>
export type NewModerationEscrow = Partial<ModerationEscrow> &
  Pick<ModerationEscrow, 'id' | 'userId' | 'amount'>
export type NewGenerationLock = Partial<GenerationLock> &
  Pick<GenerationLock, 'id' | 'resourceType' | 'resourceId'>
export type NewFeedback = Partial<Feedback> &
  Pick<Feedback, 'id' | 'userId' | 'content'>
export type NewReferral = Partial<Referral> &
  Pick<Referral, 'id' | 'referrerId' | 'referralCode'>
export type NewWidgetCache = Partial<WidgetCache> &
  Pick<WidgetCache, 'id' | 'widgetId' | 'data'>
export type NewUserAgentConfig = Partial<UserAgentConfig> &
  Pick<UserAgentConfig, 'id' | 'userId' | 'config'>
export type NewUserApiKey = Partial<UserApiKey> &
  Pick<UserApiKey, 'id' | 'userId' | 'keyHash'>
export type NewTickTokenStats = Partial<TickTokenStats> &
  Pick<TickTokenStats, 'id' | 'tokenId' | 'stats'>

// ============================================================================
// Types with Relations (for queries using include/with)
// ============================================================================

/** Chat with participants relation */
export type ChatWithParticipants = Chat & {
  ChatParticipant: ChatParticipant[]
}

/** Chat with participants and messages */
export type ChatWithParticipantsAndMessages = Chat & {
  ChatParticipant: ChatParticipant[]
  Message: Message[]
}

/** Chat with all common relations */
export type ChatWithRelations = Chat & {
  ChatParticipant?: ChatParticipant[]
  ChatAdmin?: ChatAdmin[]
  Message?: Message[]
}

/** User with performance metrics */
export type UserWithMetrics = User & {
  AgentPerformanceMetrics?: AgentPerformanceMetrics | null
}

/** User with all agent-related relations */
export type UserWithAgentRelations = User & {
  AgentPerformanceMetrics?: AgentPerformanceMetrics | null
  AgentRegistry?: AgentRegistry | null
  AgentCapability?: AgentCapability | null
  agentConfig?: UserAgentConfig | null
}

/**
 * Static actor data reference for future migration
 * For full actor data, use StaticDataRegistry.getActor(authorId) from @babylon/engine
 */
export interface ActorRef {
  id: string
  name: string
  profileImageUrl?: string | null
}

/** Post with author and reactions */
export type PostWithRelations = Post & {
  author?: User | ActorRef | null
  reactions?: Reaction[]
  comments?: Comment[]
  shares?: Share[]
}

/** Message with sender */
export type MessageWithSender = Message & {
  sender?: User | ActorRef | null
}

/** Pool with actor state
 * For full actor data (name, description, etc.), use StaticDataRegistry.getActor(npcActorId)
 */
export type PoolWithActorState = Pool & {
  actorState?: ActorStateRow | null
}

/** BalanceTransaction with user relation */
export type BalanceTransactionWithUser = BalanceTransaction & {
  user?: Pick<
    User,
    'id' | 'username' | 'displayName' | 'profileImageUrl' | 'isActor'
  > | null
}

/** ModerationEscrow with relations */
export type ModerationEscrowWithRelations = ModerationEscrow & {
  recipient?: Pick<
    User,
    'id' | 'username' | 'displayName' | 'profileImageUrl'
  > | null
  admin?: Pick<User, 'id' | 'username' | 'displayName' | 'walletAddress'> | null
  refundedByUser?: Pick<User, 'id' | 'username' | 'displayName'> | null
}

/** TradingFee with user relation */
export type TradingFeeWithUser = TradingFee & {
  user?: Pick<
    User,
    'id' | 'username' | 'displayName' | 'profileImageUrl' | 'isActor'
  > | null
}

/** ExternalAgentConnection with agentRegistry relation */
export type ExternalAgentConnectionWithRegistry = ExternalAgentConnection & {
  agentRegistry?:
    | (AgentRegistry & {
        capabilities?: AgentCapability[]
      })
    | null
}

/** AgentGoal with actions relation */
export type AgentGoalWithActions = AgentGoal & {
  actions?: AgentGoalAction[]
}
