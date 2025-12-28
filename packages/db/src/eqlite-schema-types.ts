/**
 * EQLite-Native Schema Types
 *
 * Pure TypeScript type definitions for database tables.
 * Pure EQLite implementation.
 */

// ============================================================================
// Base Types
// ============================================================================

export type UUID = string
export type Timestamp = Date
export type DecimalString = string
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

// ============================================================================
// Table Metadata for Repositories
// ============================================================================

export interface TableMeta<TSelect, TInsert = Partial<TSelect>> {
  readonly tableName: string
  readonly primaryKey: keyof TSelect
  readonly $inferSelect: TSelect
  readonly $inferInsert: TInsert
}

export function _defineTable<TSelect, TInsert = Partial<TSelect>>(
  tableName: string,
  primaryKey: keyof TSelect,
): TableMeta<TSelect, TInsert> {
  return {
    tableName,
    primaryKey,
    $inferSelect: {} as TSelect,
    $inferInsert: {} as TInsert,
  }
}

// ============================================================================
// User Types
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

export type UserInsert = {
  id: string
  walletAddress?: string | null
  username?: string | null
  displayName?: string | null
  bio?: string | null
  profileImageUrl?: string | null
  isActor?: boolean
  createdAt?: Date
  updatedAt?: Date
  personality?: string | null
  postStyle?: string | null
  postExample?: string | null
  virtualBalance?: string
  totalDeposited?: string
  totalWithdrawn?: string
  lifetimePnL?: string
  profileComplete?: boolean
  hasProfileImage?: boolean
  hasUsername?: boolean
  hasBio?: boolean
  profileSetupCompletedAt?: Date | null
  farcasterUsername?: string | null
  hasFarcaster?: boolean
  hasTwitter?: boolean
  hasDiscord?: boolean
  nftTokenId?: number | null
  onChainRegistered?: boolean
  pointsAwardedForFarcaster?: boolean
  pointsAwardedForFarcasterFollow?: boolean
  pointsAwardedForProfile?: boolean
  pointsAwardedForProfileImage?: boolean
  pointsAwardedForTwitter?: boolean
  pointsAwardedForTwitterFollow?: boolean
  pointsAwardedForDiscord?: boolean
  pointsAwardedForDiscordJoin?: boolean
  pointsAwardedForUsername?: boolean
  pointsAwardedForWallet?: boolean
  pointsAwardedForReferralBonus?: boolean
  pointsAwardedForShare?: boolean
  pointsAwardedForPrivateGroup?: boolean
  pointsAwardedForPrivateChannel?: boolean
  referralCode?: string | null
  referralCount?: number
  referredBy?: string | null
  registrationIpHash?: string | null
  lastReferralIpHash?: string | null
  registrationTxHash?: string | null
  reputationPoints?: number
  twitterUsername?: string | null
  bannerDismissCount?: number
  bannerLastShown?: Date | null
  coverImageUrl?: string | null
  showFarcasterPublic?: boolean
  showTwitterPublic?: boolean
  showWalletPublic?: boolean
  usernameChangedAt?: Date | null
  agent0FeedbackCount?: number | null
  agent0MetadataCID?: string | null
  agent0RegisteredAt?: Date | null
  agent0TokenId?: number | null
  agent0TrustScore?: number | null
  bannedAt?: Date | null
  bannedBy?: string | null
  bannedReason?: string | null
  farcasterDisplayName?: string | null
  farcasterFid?: string | null
  farcasterPfpUrl?: string | null
  farcasterVerifiedAt?: Date | null
  isAdmin?: boolean
  isBanned?: boolean
  isScammer?: boolean
  isCSAM?: boolean
  appealCount?: number
  appealStaked?: boolean
  appealStakeAmount?: string | null
  appealStakeTxHash?: string | null
  appealStatus?: string | null
  appealSubmittedAt?: Date | null
  appealReviewedAt?: Date | null
  falsePositiveHistory?: JsonValue | null
  privyId?: string | null
  oauth3Id?: string | null
  kmsKeyId?: string | null
  registrationBlockNumber?: bigint | null
  registrationGasUsed?: bigint | null
  registrationTimestamp?: Date | null
  role?: string | null
  totalFeesEarned?: string
  totalFeesPaid?: string
  twitterAccessToken?: string | null
  twitterId?: string | null
  twitterRefreshToken?: string | null
  twitterTokenExpiresAt?: Date | null
  twitterVerifiedAt?: Date | null
  discordId?: string | null
  discordUsername?: string | null
  discordAccessToken?: string | null
  discordRefreshToken?: string | null
  discordTokenExpiresAt?: Date | null
  discordVerifiedAt?: Date | null
  tosAccepted?: boolean
  tosAcceptedAt?: Date | null
  tosAcceptedVersion?: string | null
  privacyPolicyAccepted?: boolean
  privacyPolicyAcceptedAt?: Date | null
  privacyPolicyAcceptedVersion?: string | null
  invitePoints?: number
  earnedPoints?: number
  bonusPoints?: number
  waitlistPosition?: number | null
  waitlistJoinedAt?: Date | null
  isWaitlistActive?: boolean
  isTest?: boolean
  pointsAwardedForEmail?: boolean
  emailVerified?: boolean
  email?: string | null
  waitlistGraduatedAt?: Date | null
  isAgent?: boolean
  managedBy?: string | null
}

// ============================================================================
// Actor Types
// ============================================================================

export interface ActorStateRow {
  id: string
  actorId: string
  state: JsonValue | null
  createdAt: Date
  updatedAt: Date
  version: number
  metadata: JsonValue | null
  tradingBalance: string | null
  reputationPoints: number | null
  hasPool: boolean | null
}

export interface ActorFollow {
  id: string
  followerId: string
  followedId: string
  createdAt: Date
}

export interface ActorRelationship {
  id: string
  actorId: string
  targetActorId: string
  // Legacy column aliases (used by older code)
  actor1Id?: string
  actor2Id?: string
  relationshipType: string
  strength: number
  sentiment: number | null
  createdAt: Date
  updatedAt: Date
  metadata: JsonValue | null
  /** History of relationship changes */
  history: JsonValue | null
  /** Last interaction timestamp */
  lastInteraction: Date | null
  /** Number of interactions */
  interactionCount: number
  /** Number of relationship evolutions */
  evolutionCount: number
  /** Whether the relationship is publicly visible */
  isPublic: boolean | null
  /** Attributes affected by this relationship */
  affects: JsonValue | null
}

// ============================================================================
// Post Types
// ============================================================================

export interface Post {
  id: string
  authorId: string
  content: string
  createdAt: Date
  updatedAt: Date
  timestamp: Date
  isReply: boolean
  parentPostId: string | null
  replyCount: number
  shareCount: number
  likeCount: number
  viewCount: number
  isDeleted: boolean
  deletedAt: Date | null
  isEdited: boolean
  editedAt: Date | null
  visibility: string
  metadata: JsonValue | null
  mediaUrls: string[] | null
  /** Primary image URL for the post */
  imageUrl: string | null
  isPinned: boolean
  pinnedAt: Date | null
  marketId: string | null
  poolId: string | null
  questionId: string | null
  isArchived: boolean
  archivedAt: Date | null
  isNsfw: boolean
  isSensitive: boolean
  sensitiveReason: string | null
  groupId: string | null
  gameId: string | null
  dayNumber: number | null
  type: string | null
  /** Article title for news/article posts */
  articleTitle: string | null
  /** Bias score for article analysis */
  biasScore: number | null
  /** Source URL for articles */
  sourceUrl: string | null
  /** Original article author */
  articleAuthor: string | null
  /** Comment on post ID for quote-style comments */
  commentOnPostId: string | null
  /** Original post ID for reposts/quotes */
  originalPostId: string | null
  /** Sentiment score (-1 to 1) */
  sentiment: number | null
}

export type PostInsert = Pick<Post, 'id' | 'authorId' | 'content'> & {
  timestamp?: Date
  createdAt?: Date
  updatedAt?: Date
  isReply?: boolean
  parentPostId?: string | null
  replyCount?: number
  shareCount?: number
  likeCount?: number
  viewCount?: number
  isDeleted?: boolean
  deletedAt?: Date | null
  isEdited?: boolean
  editedAt?: Date | null
  visibility?: string
  metadata?: JsonValue | null
  mediaUrls?: string[] | null
  isPinned?: boolean
  pinnedAt?: Date | null
  marketId?: string | null
  poolId?: string | null
  questionId?: string | null
  isArchived?: boolean
  archivedAt?: Date | null
  isNsfw?: boolean
  isSensitive?: boolean
  sensitiveReason?: string | null
  groupId?: string | null
  gameId?: string | null
  dayNumber?: number | null
  type?: string | null
  commentOnPostId?: string | null
  originalPostId?: string | null
}

export interface Comment {
  id: string
  postId: string
  authorId: string
  content: string
  createdAt: Date
  updatedAt: Date
  isDeleted: boolean
  deletedAt: Date | null
  parentCommentId: string | null
  likeCount: number
}

export interface Reaction {
  id: string
  postId: string
  userId: string
  type: string
  createdAt: Date
  /** Comment ID if reaction is on a comment */
  commentId: string | null
}

export interface Share {
  id: string
  postId: string
  userId: string
  createdAt: Date
  content: string | null
}

export interface ShareAction {
  id: string
  userId: string
  postId: string
  platform: string
  createdAt: Date
  metadata: JsonValue | null
}

export interface Tag {
  id: string
  name: string
  displayName: string | null
  category: string | null
  createdAt: Date
  updatedAt: Date | null
  postCount: number
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
  period: string
  rank: number | null
  postCount: number | null
  calculatedAt: Date
  /** Related context/content for the trending tag */
  relatedContext: string | null
}

// ============================================================================
// Market Types
// ============================================================================

export interface Market {
  id: string
  creatorId: string
  title: string
  question: string | null
  description: string | null
  createdAt: Date
  updatedAt: Date
  closesAt: Date | null
  resolvedAt: Date | null
  resolution: string | null
  resolutionDetails: string | null
  resolutionProofUrl: string | null
  resolutionDescription: string | null
  isResolved: boolean
  resolved: boolean | null
  isActive: boolean
  onChainMarketId: string | null
  onChainResolved: boolean | null
  onChainResolutionTxHash?: string | null
  oracleAddress?: string | null
  volume: string
  liquidity: string
  yesShares: string | null
  noShares: string | null
  participantCount: number
  metadata: JsonValue | null
  category: string | null
  tags: string[] | null
  imageUrl: string | null
  questionId: string | null
  poolId: string | null
  endDate: Date | null
  gameId?: string | null
  dayNumber?: number | null
}

export type MarketInsert = {
  id: string
  question?: string | null
  description?: string | null
  creatorId?: string
  title?: string
  gameId?: string | null
  dayNumber?: number | null
  yesShares?: string | null
  noShares?: string | null
  liquidity?: string
  resolved?: boolean | null
  resolution?: string | null
  endDate?: Date | null
  createdAt?: Date
  updatedAt?: Date
  onChainMarketId?: string | null
  onChainResolutionTxHash?: string | null
  onChainResolved?: boolean | null
  oracleAddress?: string | null
  resolutionProofUrl?: string | null
  resolutionDescription?: string | null
  volume?: string
  isResolved?: boolean
  isActive?: boolean
  participantCount?: number
  metadata?: JsonValue | null
  category?: string | null
  tags?: string[] | null
  imageUrl?: string | null
  questionId?: string | null
  poolId?: string | null
  closesAt?: Date | null
  resolvedAt?: Date | null
  resolutionDetails?: string | null
}

export interface MarketOutcome {
  id: string
  marketId: string
  predictionMarketId: string | null
  windowId: string | null
  stockTicker: string | null
  name: string
  question: string | null
  outcome: string | null
  probability: string
  startPrice: string | null
  endPrice: string | null
  finalProbability: string | null
  changePercent: number | null
  createdAt: Date
  updatedAt: Date
}

export interface Question {
  id: string
  marketId: string
  question: string
  text: string
  type: string
  options: JsonValue | null
  correctAnswer: string | null
  outcome: string | null
  rank: number | null
  createdAt: Date
  createdDate: Date
  updatedAt: Date
  resolvedAt: Date | null
  resolutionDate: Date | null
  resolutionProofUrl: string | null
  resolutionDescription: string | null
  resolvedOutcome: string | null
  questionNumber: number | null
  scenarioId: string | null
  status: string | null
}

export interface PredictionPriceHistory {
  id: string
  marketId: string
  outcomeId: string | null
  price: string
  timestamp: Date
  volume: string | null
  // Extended fields for snapshots
  yesPrice?: number
  noPrice?: number
  yesShares?: string
  noShares?: string
  liquidity?: string
  eventType?: string
  source?: string
  createdAt?: Date
}

export type NewPredictionPriceHistory = Omit<
  PredictionPriceHistory,
  'timestamp'
> & {
  timestamp?: Date
}

export interface Organization {
  id: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
  metadata: JsonValue | null
  /** Current stock price */
  currentPrice: string | null
}

export interface OrganizationStateRow {
  id: string
  organizationId: string
  state: JsonValue | null
  createdAt: Date
  updatedAt: Date
  currentPrice: string | null
}

export interface StockPrice {
  id: string
  organizationId: string
  price: string
  timestamp: Date
  volume: string | null
  isSnapshot: boolean
}

// ============================================================================
// Trading Types
// ============================================================================

export interface Position {
  id: string
  userId: string
  marketId: string
  outcome: string
  side: string | boolean
  shares: string
  avgPrice: string
  pnl: string
  status: string | null
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
  realizedPnL: string
  unrealizedPnL: string
  isClosed: boolean
  closedAt: Date | null
  metadata: JsonValue | null
  questionId?: string | null
  amount?: string | null
  /** Date when the question was resolved */
  questionResolutionDate?: Date | null
}

export type PositionInsert = {
  id: string
  userId: string
  marketId: string
  side: string | boolean
  shares: string
  avgPrice: string
  outcome?: string | null
  pnl?: string | null
  questionId?: string | null
  resolvedAt?: Date | null
  status?: string | null
  createdAt?: Date
  updatedAt?: Date
  realizedPnL?: string
  unrealizedPnL?: string
  isClosed?: boolean
  closedAt?: Date | null
  metadata?: JsonValue | null
  amount?: string | null
}

// Aliases for compatibility with existing code
export type NewMarket = MarketInsert
export type NewPosition = PositionInsert
export type NewPool = PoolInsert

export interface PerpPosition {
  id: string
  userId: string
  marketId: string
  organizationId: string | null
  ticker: string | null
  side: string
  size: string
  entryPrice: string
  currentPrice: string | null
  leverage: number
  margin: string
  unrealizedPnL: string
  unrealizedPnLPercent: number | null
  realizedPnL: string
  fundingPaid: string
  liquidationPrice: string | null
  openedAt: Date
  lastUpdated: Date
  createdAt: Date
  updatedAt: Date
  closedAt: Date | null
  metadata: JsonValue | null
}

export interface PerpMarketSnapshot {
  id: string
  marketId: string
  ticker: string | null
  price: string
  currentPrice: number | null
  openInterest: string
  volume24h: string
  fundingRate: string
  change24h: number | null
  changePercent24h: number | null
  timestamp: Date
}

export interface Pool {
  id: string
  creatorId: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
  totalLiquidity: string
  totalShares: string
  feeRate: string
  isActive: boolean
  metadata: JsonValue | null
  marketId: string | null
  /** NPC actor managing this pool */
  npcActorId: string | null
  /** Total deposits in pool */
  totalDeposits: string | null
  /** Total value of pool */
  totalValue: string | null
  /** Available balance not allocated to positions */
  availableBalance: string | null
}

export type PoolInsert = Omit<Pool, 'createdAt' | 'updatedAt'> & {
  createdAt?: Date
  updatedAt?: Date
}

export interface PoolPosition {
  id: string
  poolId: string
  userId: string
  shares: string
  depositedAmount: string
  createdAt: Date
  updatedAt: Date
  /** Market ticker symbol */
  ticker: string | null
  /** Position side: 'long' or 'short' */
  side: string | null
  /** Position size */
  size: string | null
  /** Market type: 'perp', 'spot', etc */
  marketType: string | null
  /** Reference to market */
  marketId: string | null
  /** Entry price */
  entryPrice: string | null
  /** Current market price */
  currentPrice: string | null
  /** Unrealized profit/loss */
  unrealizedPnL: string | null
  /** When position was opened */
  openedAt: Date | null
  /** When position was closed */
  closedAt: Date | null
  /** Leverage multiplier */
  leverage: number | null
}

export interface PoolDeposit {
  id: string
  poolId: string
  userId: string
  amount: string
  shares: string
  createdAt: Date
  txHash: string | null
}

export interface TradingFee {
  id: string
  userId: string
  marketId: string | null
  poolId: string | null
  amount: string
  feeType: string
  createdAt: Date
  txHash: string | null
}

export interface BalanceTransaction {
  id: string
  userId: string
  type: string
  amount: string
  balanceBefore: string
  balanceAfter: string
  reference: string | null
  /** Description of the transaction */
  description: string | null
  createdAt: Date
  metadata: JsonValue | null
  /** Related entity ID (trade, position, etc.) */
  relatedId: string | null
}

export interface PointsTransaction {
  id: string
  userId: string
  type: string
  amount: number
  reason: string | null
  reference: string | null
  createdAt: Date
  metadata: JsonValue | null
}

// ============================================================================
// Chat/Message Types
// ============================================================================

export interface Chat {
  id: string
  createdAt: Date
  updatedAt: Date
  name: string | null
  /** Description of the chat */
  description: string | null
  type: string
  isGroup: boolean
  groupOwnerId: string | null
  /** User who created this chat */
  createdBy: string | null
  lastMessageAt: Date | null
  lastMessagePreview: string | null
  participantCount: number
  metadata: JsonValue | null
  isArchived: boolean
  archivedAt: Date | null
  imageUrl: string | null
  /** Game ID for game-specific chats */
  gameId: string | null
  /** NPC admin ID if chat is managed by an NPC */
  npcAdminId: string | null
}

export type ChatInsert = Omit<Chat, 'createdAt' | 'updatedAt'> & {
  createdAt?: Date
  updatedAt?: Date
}

export interface ChatParticipant {
  id: string
  chatId: string
  userId: string
  joinedAt: Date
  leftAt: Date | null
  role: string | null
  lastReadAt: Date | null
  /** Last message timestamp for this participant */
  lastMessageAt: Date | null
  /** Message count for this participant */
  messageCount: number | null
  /** Whether the participant is active in the chat */
  isActive: boolean
  /** Who invited this participant */
  invitedBy: string | null
}

export interface ChatAdmin {
  id: string
  chatId: string
  userId: string
  createdAt: Date
  permissions: JsonValue | null
}

export interface ChatInvite {
  id: string
  chatId: string
  inviterId: string
  inviteeId: string | null
  /** ID of the user who was invited */
  invitedUserId: string | null
  /** Who sent the invite */
  invitedBy: string | null
  /** When the invite was sent */
  invitedAt: Date | null
  code: string | null
  createdAt: Date
  expiresAt: Date | null
  usedAt: Date | null
  usedBy: string | null
  /** Status of the invite: pending, accepted, rejected, expired */
  status: string
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  content: string
  createdAt: Date
  updatedAt: Date
  isDeleted: boolean
  deletedAt: Date | null
  isEdited: boolean
  editedAt: Date | null
  replyToId: string | null
  metadata: JsonValue | null
  readBy: string[] | null
  deliveredTo: string[] | null
}

export type MessageInsert = Omit<Message, 'createdAt' | 'updatedAt'> & {
  createdAt?: Date
  updatedAt?: Date
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
  joinedAt: Date
  invitedBy: string | null
  role: string | null
  /** NPC admin ID if managed by an NPC */
  npcAdminId: string | null
  /** Whether membership is active */
  isActive: boolean
  /** Count of messages sent by this member */
  messageCount: number
  /** Quality score for this member */
  qualityScore: number | null
}

export interface UserMessagingKey {
  id: string
  userId: string
  publicKey: string
  keyType: string
  createdAt: Date
  expiresAt: Date | null
  isRevoked: boolean
  revokedAt: Date | null
}

export interface MessageReceipt {
  id: string
  messageId: string
  userId: string
  deliveredAt: Date | null
  readAt: Date | null
}

// ============================================================================
// User Group Types
// ============================================================================

export interface UserGroup {
  id: string
  name: string
  description: string | null
  ownerId: string
  createdAt: Date
  updatedAt: Date
  isPrivate: boolean
  imageUrl: string | null
  memberCount: number
  metadata: JsonValue | null
}

export interface UserGroupAdmin {
  id: string
  groupId: string
  userId: string
  createdAt: Date
  permissions: JsonValue | null
}

export interface UserGroupInvite {
  id: string
  groupId: string
  inviterId: string
  inviteeId: string | null
  /** ID of user who was invited */
  invitedUserId: string | null
  /** ID of user who sent the invite */
  invitedBy: string | null
  code: string | null
  createdAt: Date
  expiresAt: Date | null
  usedAt: Date | null
  /** Invite status: 'pending', 'accepted', 'rejected', 'expired' */
  status: string
  /** When the invite was sent */
  invitedAt: Date | null
  /** When the invitee responded */
  respondedAt: Date | null
}

export interface UserGroupMember {
  id: string
  groupId: string
  userId: string
  joinedAt: Date
  role: string | null
}

export interface PendingGroupInviteCandidate {
  id: string
  groupId: string
  userId: string
  createdAt: Date
  expiresAt: Date | null
  /** NPC ID that created the invite */
  npcId: string | null
  /** Whether candidate has been processed */
  processed: boolean
  /** When candidate was queued */
  queuedAt: Date | null
  /** When candidate was processed */
  processedAt: Date | null
  /** Group chat ID for the invite */
  groupChatId: string | null
  /** Engagement score for prioritization */
  engagementScore: number | null
  /** Type of trigger that created this candidate */
  triggerType: string | null
  /** ID of the trigger event */
  triggerId: string | null
  /** Priority multiplier for queue ordering */
  priorityMultiplier: number | null
  /** Outcome of processing: 'invited', 'expired', 'skipped', 'already_member' */
  outcome: string | null
}

// ============================================================================
// User Relationship Types
// ============================================================================

export interface Follow {
  id: string
  followerId: string
  followingId: string
  createdAt: Date
}

export interface FollowStatus {
  id: string
  userId: string
  targetUserId: string
  isFollowing: boolean
  isFollowedBy: boolean
  updatedAt: Date
  /** NPC actor ID if following an NPC */
  npcId: string | null
  /** Whether the follow is active */
  isActive: boolean
  /** When the follow was created */
  followedAt: Date | null
}

export interface UserBlock {
  id: string
  blockerId: string
  blockedId: string
  createdAt: Date
  reason: string | null
}

export interface UserMute {
  id: string
  muterId: string
  mutedId: string
  createdAt: Date
  expiresAt: Date | null
  reason: string | null
}

export interface UserActorFollow {
  id: string
  userId: string
  actorId: string
  createdAt: Date
}

export interface UserInteraction {
  id: string
  userId: string
  targetUserId: string
  interactionType: string
  createdAt: Date
  metadata: JsonValue | null
  /** NPC actor ID for NPC interactions */
  npcId: string | null
  /** Quality score of the interaction */
  qualityScore: number | null
  /** Timestamp of interaction */
  timestamp: Date
  /** Post ID for post-related interactions */
  postId: string | null
  /** Comment ID for comment-related interactions */
  commentId: string | null
}

export interface Favorite {
  id: string
  userId: string
  postId: string | null
  marketId: string | null
  /** Target user for user favorites */
  targetUserId: string | null
  createdAt: Date
}

export interface Referral {
  id: string
  referrerId: string
  referredId: string
  referredUserId: string
  referralCode: string
  status: string
  signupPointsAwarded: boolean
  qualifiedAt: Date | null
  suspiciousReferralFlags: JsonValue | null
  createdAt: Date
  completedAt: Date | null
  rewardClaimed: boolean
  metadata: JsonValue | null
}

// ============================================================================
// Profile Types
// ============================================================================

export interface OnboardingIntent {
  id: string
  userId: string
  step: string
  completedAt: Date | null
  createdAt: Date
  metadata: JsonValue | null
}

export interface ProfileUpdateLog {
  id: string
  userId: string
  field: string
  changedFields: string[]
  oldValue: string | null
  newValue: string | null
  backendSigned: boolean
  txHash: string | null
  createdAt: Date
}

export interface TwitterOAuthToken {
  id: string
  userId: string
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Notification Types
// ============================================================================

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body: string | null
  /** Message content (alias for body) */
  message: string | null
  createdAt: Date
  readAt: Date | null
  isRead: boolean
  /** Alias for isRead */
  read: boolean
  metadata: JsonValue | null
  actionUrl: string | null
  senderId: string | null
  actorId: string | null
  postId: string | null
  commentId: string | null
}

export type NotificationInsert = Omit<Notification, 'createdAt'> & {
  createdAt?: Date
}

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentRegistry {
  id: string
  agentId: string | null
  userId: string
  actorId: string | null
  name: string
  description: string | null
  type: string
  status: string
  trustLevel: string | null
  createdAt: Date
  updatedAt: Date
  registeredAt: Date | null
  lastActiveAt: Date | null
  terminatedAt: Date | null
  isActive: boolean
  model: string | null
  systemPrompt: string | null
  temperature: number | null
  maxTokens: number | null
  metadata: JsonValue | null
  avatarUrl: string | null
  capabilities: string[] | null
  version: string | null
  runtimeInstanceId: string | null
  discoveryCardVersion: string | null
  discoveryEndpointA2a: string | null
  discoveryEndpointMcp: string | null
  discoveryEndpointRpc: string | null
  discoveryAuthRequired: boolean | null
  discoveryAuthMethods: string[] | null
  discoveryRateLimit: number | null
  discoveryCostPerAction: number | null
  onChainTokenId: string | null
  onChainTxHash: string | null
  onChainServerWallet: string | null
  onChainReputationScore: number | null
  onChainChainId: string | null
  onChainIdentityRegistry: string | null
  onChainReputationSystem: string | null
  agent0TokenId: string | null
  agent0MetadataCID: string | null
  agent0SubgraphOwner: string | null
  agent0SubgraphMetadataURI: string | null
  agent0SubgraphTimestamp: Date | null
  agent0DiscoveryEndpoint: string | null
}

export type AgentRegistryInsert = Omit<
  AgentRegistry,
  'createdAt' | 'updatedAt'
> & {
  createdAt?: Date
  updatedAt?: Date
}

export interface AgentCapability {
  id: string
  agentId: string
  agentRegistryId: string | null
  name: string
  description: string | null
  enabled: boolean
  strategies: string[] | null
  markets: string[] | null
  actions: string[] | null
  skills: string[] | null
  domains: string[] | null
  version: string | null
  x402Support: boolean | null
  platform: string | null
  userType: string | null
  gameNetworkChainId: number | null
  gameNetworkRpcUrl: string | null
  gameNetworkExplorerUrl: string | null
  a2aEndpoint: string | null
  mcpEndpoint: string | null
  createdAt: Date
  metadata: JsonValue | null
}

export interface AgentLog {
  id: string
  agentId: string
  agentUserId: string | null
  type: string
  content: string
  createdAt: Date
  metadata: JsonValue | null
  level: string | null
}

export type AgentLogInsert = {
  id: string
  agentId?: string
  agentUserId?: string | null
  type: string
  content?: string
  message?: string // Alias for content
  createdAt?: Date
  metadata?: JsonValue | null
  level?: string | null
  prompt?: string | null
  completion?: string | null
  thinking?: string | null
}

export interface AgentMessage {
  id: string
  agentId: string
  agentUserId: string | null
  userId: string
  role: string
  content: string
  createdAt: Date
  metadata: JsonValue | null
  tokenCount: number | null
}

export type AgentMessageInsert = Omit<AgentMessage, 'createdAt'> & {
  createdAt?: Date
}

export interface AgentPerformanceMetrics {
  id: string
  agentId: string
  userId: string | null
  period: string
  totalMessages: number
  totalTrades: number
  profitableTrades: number
  winRate: number | null
  avgResponseTime: number | null
  successRate: number | null
  errorCount: number
  tokenUsage: number
  reputationScore: number | null
  gamesPlayed: number | null
  totalFeedbackCount: number | null
  averageFeedbackScore: number | null
  lastActivityAt: Date | null
  lastSyncedAt: Date | null
  onChainReputationSync: boolean
  createdAt: Date
  updatedAt: Date
  metadata: JsonValue | null
  /** Trust level: 'low', 'medium', 'high' */
  trustLevel: string | null
  /** Confidence score (0-1) */
  confidenceScore: number | null
  /** Normalized PnL for comparison */
  normalizedPnL: number | null
  /** Number of games won */
  gamesWon: number | null
  /** Average score across games */
  averageGameScore: number | null
  /** First activity timestamp */
  firstActivityAt: Date | null
  /** Score from last game played */
  lastGameScore: number | null
  /** When last game was played */
  lastGamePlayedAt: Date | null
  /** Count of intel-related feedback */
  intelFeedbackCount: number | null
  /** Average intel quality score */
  averageIntelScore: number | null
  /** Count of positive feedback */
  positiveCount: number | null
  /** Count of neutral feedback */
  neutralCount: number | null
  /** Count of negative feedback */
  negativeCount: number | null
  /** Total number of interactions */
  totalInteractions: number | null
}

export interface AgentGoal {
  id: string
  agentId: string
  agentUserId: string | null
  name: string
  description: string | null
  status: string
  priority: number
  target: JsonValue | null
  progress: number | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
  deadline: Date | null
  metadata: JsonValue | null
}

export interface AgentGoalAction {
  id: string
  goalId: string
  agentId: string
  agentUserId: string | null
  actionType: string
  description: string | null
  status: string
  createdAt: Date
  completedAt: Date | null
  result: JsonValue | null
  metadata: JsonValue | null
  impact: number | null
}

export interface AgentPointsTransaction {
  id: string
  agentId: string
  userId: string
  type: string
  amount: number
  reason: string | null
  createdAt: Date
  metadata: JsonValue | null
}

export interface AgentTrade {
  id: string
  agentId: string
  agentUserId: string | null
  marketId: string
  side: string
  amount: string
  price: string
  pnl: string
  status: string
  createdAt: Date
  executedAt: Date | null
  metadata: JsonValue | null
  /** Trade action type: 'buy', 'sell', 'open', 'close' */
  action: string | null
  /** Market type: 'perp', 'spot', etc */
  marketType: string | null
  /** Ticker symbol */
  ticker: string | null
}

export interface ExternalAgentConnection {
  id: string
  userId: string
  agentId: string | null
  agentRegistryId: string | null
  provider: string
  protocol: string | null
  endpoint: string | null
  externalId: string
  name: string | null
  authType: string | null
  authCredentials: string | null
  createdAt: Date
  updatedAt: Date
  lastConnected: Date | null
  lastSyncAt: Date | null
  metadata: JsonValue | null
  isActive: boolean
  isHealthy: boolean
}

export interface UserAgentConfig {
  id: string
  userId: string
  agentId: string | null
  config: JsonValue | null
  style: string | null
  systemPrompt: string | null
  personality: string | null
  tradingStrategy: string | null
  messageExamples: JsonValue | null
  pointsBalance: number
  totalDeposited: number
  totalWithdrawn: number
  totalPointsSpent: number
  a2aEnabled: boolean
  autonomousTrading: boolean
  autonomousPosting: boolean
  autonomousCommenting: boolean
  autonomousDMs: boolean
  autonomousGroupChats: boolean
  planningHorizon: string | null
  maxActionsPerTick: number | null
  riskTolerance: string | null
  directives: JsonValue | null
  constraints: JsonValue | null
  modelTier: string | null
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// NPC Types
// ============================================================================

export interface NPCTrade {
  id: string
  npcActorId: string
  marketId: string
  side: string
  amount: string
  price: string
  createdAt: Date
  metadata: JsonValue | null
  /** Trade action type: 'buy', 'sell', 'open', 'close' */
  action: string | null
  /** Market type: 'perp', 'spot', etc */
  marketType: string | null
  /** Ticker symbol */
  ticker: string | null
  /** When trade was executed */
  executedAt: Date | null
}

export interface NPCInteraction {
  id: string
  npcActorId: string
  userId: string
  interactionType: string
  content: string | null
  createdAt: Date
  metadata: JsonValue | null
  /** Timestamp of interaction */
  timestamp: Date
  /** First actor in interaction */
  actor1Id: string | null
  /** Second actor in interaction */
  actor2Id: string | null
  /** Sentiment of interaction (-1 to 1) */
  sentiment: number | null
  /** Context/description of interaction */
  context: string | null
}

// ============================================================================
// Training Types
// ============================================================================

export interface Trajectory {
  id: string
  trajectoryId: string
  agentId: string
  windowId: string | null
  windowHours: number | null
  scenarioId: string | null
  episodeId: string | null
  archetype: string | null
  startTime: Date | null
  endTime: Date | null
  durationMs: number | null
  stepsJson: string
  rewardComponentsJson: string | null
  metricsJson: string | null
  metadataJson: string | null
  totalReward: number | null
  finalPnL: number | null
  finalBalance: number | null
  tradesExecuted: number | null
  postsCreated: number | null
  episodeLength: number | null
  finalStatus: string | null
  isTrainingData: boolean
  aiJudgeReward: number | null
  aiJudgeReasoning: string | null
  judgedAt: Date | null
  usedInTraining: boolean
  isEvaluation: boolean
  createdAt: Date
  updatedAt: Date
}

export interface RewardJudgment {
  id: string
  trajectoryId: string
  judgerId: string | null
  score: number
  feedback: string | null
  createdAt: Date
  metadata: JsonValue | null
}

export interface TrainingBatch {
  id: string
  batchId: string
  name: string
  modelVersion: string | null
  trajectoryIds: string[] | null
  status: string
  trajectoryCount: number
  trainingLoss: number | null
  error: string | null
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  completedAt: Date | null
  metadata: JsonValue | null
}

export interface TrainedModel {
  id: string
  modelId: string | null
  name: string
  baseModel: string
  version: string
  trainingBatchId: string | null
  status: string
  storagePath: string | null
  accuracy: number | null
  avgReward: number | null
  benchmarkScore: number | null
  evalMetrics: JsonValue | null
  agentsUsing: number
  deployedAt: Date | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  metadata: JsonValue | null
  performanceMetrics: JsonValue | null
  /** HuggingFace repository name for deployed models */
  huggingFaceRepo: string | null
}

export interface BenchmarkResult {
  id: string
  modelId: string
  benchmarkId: string | null
  benchmarkName: string
  score: number
  totalPnl: string
  predictionAccuracy: number | null
  optimalityScore: number | null
  runAt: Date
  createdAt: Date
  detailedMetrics: JsonValue | null
  metadata: JsonValue | null
  /** Path to benchmark data/results file */
  benchmarkPath: string | null
  /** Model version that was benchmarked */
  modelVersion: string | null
  /** Perpetual trading win rate */
  perpWinRate: number | null
  /** Prediction trading win rate */
  predWinRate: number | null
  /** Average return per trade */
  avgReturn: number | null
  /** Sharpe ratio */
  sharpeRatio: number | null
  /** Delta from baseline PnL */
  baselinePnlDelta: number | null
  /** Delta from baseline accuracy */
  baselineAccuracyDelta: number | null
  /** Whether this result improved over baseline */
  improved: boolean | null
  /** Duration in milliseconds */
  duration: number | null
}

export interface LlmCallLog {
  id: string
  trajectoryId: string | null
  stepId: string | null
  callId: string | null
  agentId: string | null
  timestamp: Date
  model: string
  purpose: string | null
  actionType: string | null
  systemPrompt: string | null
  userPrompt: string | null
  messagesJson: string | null
  response: string | null
  reasoning: string | null
  temperature: number | null
  maxTokens: number | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number | null
  createdAt: Date
  metadata: JsonValue | null
}

// ============================================================================
// Oracle Types
// ============================================================================

export interface OracleCommitment {
  id: string
  marketId: string
  oracleId: string
  commitment: string
  createdAt: Date
  revealedAt: Date | null
  revealedValue: string | null
  /** Question ID for question-based oracles */
  questionId: string | null
  /** Session ID for the oracle commitment */
  sessionId: string | null
  /** Encrypted salt for commitment verification */
  saltEncrypted: string | null
}

export interface OracleTransaction {
  id: string
  oracleId: string
  marketId: string
  txHash: string
  type: string
  data: JsonValue | null
  createdAt: Date
  confirmedAt: Date | null
}

// ============================================================================
// Game Types
// ============================================================================

export interface Game {
  id: string
  name: string
  type: string
  status: string
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  endedAt: Date | null
  pausedAt: Date | null
  lastTickAt: Date | null
  config: JsonValue | null
  metadata: JsonValue | null
  isContinuous: boolean
  isRunning: boolean
  dayNumber: number | null
  currentDay: number | null
  currentDate: Date
  speed: number
  activeQuestions: number
}

export interface GameConfig {
  id: string
  gameId: string
  key: string
  value: JsonValue
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// System Types
// ============================================================================

export interface OAuthState {
  id: string
  state: string
  provider: string
  userId: string | null
  redirectUrl: string | null
  createdAt: Date
  expiresAt: Date
  usedAt: Date | null
}

export interface SystemSettings {
  id: string
  key: string
  value: JsonValue
  createdAt: Date
  updatedAt: Date
}

export interface GenerationLock {
  id: string
  lockType: string
  resourceType: string
  resourceId: string
  operation: string | null
  lockedBy: string
  lockedAt: Date
  expiresAt: Date
  metadata: JsonValue | null
}

export interface RealtimeOutbox {
  id: string
  eventType: string
  type: string | null
  version: string | null
  payload: JsonValue
  channel: string | null
  status: string
  attempts: number
  createdAt: Date
  updatedAt: Date | null
  processedAt: Date | null
  lastError: string | null
  retryCount: number
}

// ============================================================================
// Content Types
// ============================================================================

export interface WorldEvent {
  id: string
  type: string
  eventType: string
  title: string
  description: string | null
  visibility: string
  dayNumber: number | null
  pointsToward: string | null
  occurredAt: Date
  timestamp: Date
  createdAt: Date
  metadata: JsonValue | null
  impact: JsonValue | null
  actors: JsonValue | null
  relatedQuestion: string | null
  /** Game ID this event belongs to */
  gameId: string | null
}

export interface WorldFact {
  id: string
  category: string
  fact: string
  source: string | null
  createdAt: Date
  verifiedAt: Date | null
  metadata: JsonValue | null
}

export interface RSSFeedSource {
  id: string
  name: string
  url: string
  /** Feed URL (alias for url) */
  feedUrl: string
  category: string | null
  isActive: boolean
  lastFetchedAt: Date | null
  createdAt: Date
  metadata: JsonValue | null
}

export interface RSSHeadline {
  id: string
  sourceId: string
  title: string
  url: string
  link?: string // Alias for url
  publishedAt: Date
  fetchedAt: Date
  summary: string | null
  metadata: JsonValue | null
}

export interface ParodyHeadline {
  id: string
  originalHeadlineId: string | null
  title: string
  content: string | null
  authorId: string | null
  createdAt: Date
  metadata: JsonValue | null
}

export interface WidgetCache {
  id: string
  widgetType: string
  /** Widget name (alias for widgetType) */
  widget: string
  key: string
  data: JsonValue
  createdAt: Date
  expiresAt: Date
}

export interface TickTokenStats {
  id: string
  tickId: string
  provider: string | null
  model: string | null
  totalCalls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  estimatedCostUSD: number | null
  tickStartedAt: Date | null
  tickCompletedAt: Date | null
  tickDurationMs: number | null
  byPromptType: JsonValue | null
  byModel: JsonValue | null
  createdAt: Date
}

export interface QuestionArcPlan {
  id: string
  questionId: string
  arcType: string
  phases: JsonValue
  phaseRatios: JsonValue | null
  uncertaintyPeakDay: number | null
  clarityOnsetDay: number | null
  verificationDay: number | null
  insiderActorIds: JsonValue | null
  deceiverActorIds: JsonValue | null
  status: string
  createdAt: Date
  updatedAt: Date
  metadata: JsonValue | null
}

// ============================================================================
// Report/Moderation Types
// ============================================================================

export interface Report {
  id: string
  reporterId: string
  reportedUserId: string | null
  reportedPostId: string | null
  reportedMessageId: string | null
  reason: string
  description: string | null
  category: string | null
  evidence: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
  resolvedBy: string | null
  resolution: string | null
  metadata: JsonValue | null
  /** Type of report: spam, harassment, etc. */
  reportType: string | null
}

export interface ModerationEscrow {
  id: string
  reportId: string | null
  userId: string
  adminId: string | null
  recipientId: string | null
  amount: string
  amountUSD: string | null
  amountWei: string | null
  status: string
  reason: string | null
  paymentRequestId: string | null
  paymentTxHash: string | null
  refundTxHash: string | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
  releasedAt: Date | null
  refundedAt: Date | null
  refundedBy: string | null
  metadata: JsonValue | null
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

// ============================================================================
// API Key Types
// ============================================================================

export interface UserApiKey {
  id: string
  userId: string
  name: string
  keyHash: string
  prefix: string
  permissions: JsonValue | null
  createdAt: Date
  lastUsedAt: Date | null
  expiresAt: Date | null
  isRevoked: boolean
  revokedAt: Date | null
}

// ============================================================================
// Messaging Types (Additional)
// ============================================================================

export interface MessagingPreKey {
  id: string
  userId: string
  keyId: number
  publicKey: string
  createdAt: Date
  usedAt: Date | null
}

// ============================================================================
// Token Types
// ============================================================================

export interface TokenBalance {
  id: string
  userId: string
  tokenAddress: string
  chainId: number
  balance: string
  createdAt: Date
  updatedAt: Date
}

export interface TokenTransaction {
  id: string
  userId: string
  tokenAddress: string
  chainId: number
  txHash: string
  type: string
  amount: string
  from: string
  to: string
  createdAt: Date
  metadata: JsonValue | null
}

export interface AirdropAllocation {
  id: string
  userId: string
  amount: string
  reason: string
  claimedAt: Date | null
  createdAt: Date
  metadata: JsonValue | null
  /** Total allocation amount for vesting */
  totalAllocation: string | null
  /** Number of drips that have been unlocked */
  dripsUnlocked: number | null
  /** Total amount claimed so far */
  totalClaimed: string | null
  /** Last time a drip was claimed */
  lastDripTime: Date | null
  /** Last drip action type */
  lastDripAction: string | null
  /** Bonus multiplier for special allocations */
  bonusMultiplier: number | null
  /** Whether user is an Eliza holder */
  isElizaHolder: boolean | null
  /** Whether allocation is registered on-chain */
  registeredOnChain: boolean | null
}

export interface AirdropClaim {
  id: string
  userId: string
  allocationId: string
  amount: string
  txHash: string | null
  status: string
  createdAt: Date
  claimedAt: Date | null
}

export interface VestingSchedule {
  id: string
  userId: string
  totalAmount: string
  claimedAmount: string
  startDate: Date
  endDate: Date
  cliffDate: Date | null
  vestingPeriod: number
  createdAt: Date
  updatedAt: Date
  metadata: JsonValue | null
}

export interface TokenDeployment {
  id: string
  name: string
  symbol: string
  tokenAddress: string
  chainId: number
  deployedBy: string
  deployedAt: Date
  txHash: string
  metadata: JsonValue | null
}

export interface ElizaHolder {
  id: string
  userId: string | null
  walletAddress: string
  ethereumBalance: string | null
  baseBalance: string | null
  bscBalance: string | null
  totalBalance: string
  balance: string
  qualifiesForBonus: boolean
  snapshotAt: Date
  lastVerifiedAt: Date | null
  createdAt: Date
  updatedAt: Date | null
  /** Alias for ethereumBalance - mainnet ELIZA balance */
  mainnetBalance: string | null
  /** When the holder was verified (alias for lastVerifiedAt) */
  verifiedAt: Date | null
}

export interface ElizaHolderAllocation {
  id: string
  userId: string | null
  holderId: string
  walletAddress: string | null
  baseAllocation: string | null
  bonusAllocation: string | null
  totalAllocation: string | null
  bonusBps: number | null
  amount: string
  reason: string
  createdAt: Date
  updatedAt: Date | null
  claimedAt: Date | null
}

// ============================================================================
// Engagement Types
// ============================================================================

export interface DailyEngagement {
  id: string
  userId: string
  dateKey: string
  /** Whether user has liked a post today */
  hasLiked: boolean
  likedPostId: string | null
  likedAt: Date | null
  /** Whether user has commented today */
  hasCommented: boolean
  commentedPostId: string | null
  commentId: string | null
  commentedAt: Date | null
  /** Whether user has posted today */
  hasPosted: boolean
  postedId: string | null
  postedAt: Date | null
  /** Count of social actions */
  socialActionsCount: number
  /** Whether social track is complete (2 of 3 actions) */
  socialTrackComplete: boolean
  /** Whether user has traded today */
  hasTraded: boolean
  tradeId: string | null
  tradeType: string | null
  tradedAt: Date | null
  /** Whether trading track is complete */
  tradingTrackComplete: boolean
  /** Whether qualified for daily drip */
  qualifiedForDrip: boolean
  qualifiedAt: Date | null
  /** Whether drip was claimed */
  dripClaimed: boolean
  dripAmount: string | null
  dripClaimedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Fee/Buyback Types
// ============================================================================

export interface FeeAccumulator {
  id: string
  tokenAddress: string
  chainId: number
  totalFees: string
  lastUpdatedAt: Date
  createdAt: Date
}

export interface BuybackRecord {
  id: string
  tokenAddress: string
  chainId: number
  amount: string
  txHash: string
  initiatedAt: Date
  executedAt: Date | null
  createdAt: Date
  metadata: JsonValue | null
  /** Total ETH input for buyback */
  totalEthInput: string | null
  /** BBLN tokens received from buyback */
  bblnReceived: string | null
  /** ELIZA tokens received from buyback */
  elizaReceived: string | null
  /** ETH amount sent to treasury */
  treasuryEthAmount: string | null
  /** Buyback status: pending, executing, completed, failed */
  status: string | null
  /** Transaction hash for BBLN swap */
  bblnSwapTxHash: string | null
  /** When the buyback was completed */
  completedAt: Date | null
}

export interface FeeContribution {
  id: string
  userId: string
  tokenAddress: string
  amount: string
  txHash: string | null
  createdAt: Date
  metadata: JsonValue | null
}

// ============================================================================
// Admin Types
// ============================================================================

export interface AdminAuditLog {
  id: string
  adminId: string
  action: string
  resourceType: string
  resourceId: string | null
  previousValue: JsonValue | null
  newValue: JsonValue | null
  metadata: JsonValue | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

// ============================================================================
// Type Helpers
// =======================================================================export type InferSelect<T extends TableMeta<unknown, unknown>> = T['$inferSeexport type InferInsert<T extends TableMeta<unknown, unknown>> = T['$inferInsert']
