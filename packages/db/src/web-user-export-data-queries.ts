/**
 * GDPR-style full user data export (GET /api/users/export-data).
 */

import { desc, eq, or } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { agentPerformanceMetrics } from './tables/agent-performance-metrics';
import { balanceTransactions } from './tables/balance-transactions';
import { comments } from './tables/comments';
import { feedbacks } from './tables/feedbacks';
import { follows } from './tables/follows';
import { notifications } from './tables/notifications';
import { pointsTransactions } from './tables/points-transactions';
import { positions } from './tables/positions';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { referrals } from './tables/referrals';
import { tradingFees } from './tables/trading-fees';
import { users } from './tables/user';

type ExportDb = DrizzleClient | Transaction;

export async function fetchUserGdprExportBundle(db: ExportDb, userId: string) {
  const [
    userRows,
    userComments,
    userReactions,
    userPosts,
    userPositions,
    userFollows,
    userFollowers,
    userBalanceTransactions,
    userPointsTransactions,
    userReferrals,
    userNotifications,
    userFeedback,
    performanceMetricsRows,
    userTradingFees,
    referralFeesEarned,
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        privyId: users.privyId,
        walletAddress: users.walletAddress,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        profileImageUrl: users.profileImageUrl,
        coverImageUrl: users.coverImageUrl,
        email: users.email,
        virtualBalance: users.virtualBalance,
        totalDeposited: users.totalDeposited,
        totalWithdrawn: users.totalWithdrawn,
        lifetimePnL: users.lifetimePnL,
        onChainRegistered: users.onChainRegistered,
        nftTokenId: users.nftTokenId,
        registrationTxHash: users.registrationTxHash,
        registrationBlockNumber: users.registrationBlockNumber,
        registrationTimestamp: users.registrationTimestamp,
        reputationPoints: users.reputationPoints,
        invitePoints: users.invitePoints,
        earnedPoints: users.earnedPoints,
        bonusPoints: users.bonusPoints,
        profileComplete: users.profileComplete,
        hasFarcaster: users.hasFarcaster,
        hasTwitter: users.hasTwitter,
        farcasterUsername: users.farcasterUsername,
        farcasterFid: users.farcasterFid,
        twitterUsername: users.twitterUsername,
        twitterId: users.twitterId,
        referralCode: users.referralCode,
        referredBy: users.referredBy,
        referralCount: users.referralCount,
        waitlistPosition: users.waitlistPosition,
        waitlistJoinedAt: users.waitlistJoinedAt,
        isWaitlistActive: users.isWaitlistActive,
        waitlistGraduatedAt: users.waitlistGraduatedAt,
        tosAccepted: users.tosAccepted,
        tosAcceptedAt: users.tosAcceptedAt,
        tosAcceptedVersion: users.tosAcceptedVersion,
        privacyPolicyAccepted: users.privacyPolicyAccepted,
        privacyPolicyAcceptedAt: users.privacyPolicyAcceptedAt,
        privacyPolicyAcceptedVersion: users.privacyPolicyAcceptedVersion,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({
        id: comments.id,
        content: comments.content,
        postId: comments.postId,
        parentCommentId: comments.parentCommentId,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
      })
      .from(comments)
      .where(eq(comments.authorId, userId)),
    db
      .select({
        id: reactions.id,
        postId: reactions.postId,
        commentId: reactions.commentId,
        type: reactions.type,
        createdAt: reactions.createdAt,
      })
      .from(reactions)
      .where(eq(reactions.userId, userId)),
    db
      .select({
        id: posts.id,
        type: posts.type,
        content: posts.content,
        fullContent: posts.fullContent,
        articleTitle: posts.articleTitle,
        timestamp: posts.timestamp,
        createdAt: posts.createdAt,
        deletedAt: posts.deletedAt,
      })
      .from(posts)
      .where(eq(posts.authorId, userId)),
    db
      .select({
        id: positions.id,
        marketId: positions.marketId,
        side: positions.side,
        shares: positions.shares,
        avgPrice: positions.avgPrice,
        createdAt: positions.createdAt,
        updatedAt: positions.updatedAt,
      })
      .from(positions)
      .where(eq(positions.userId, userId)),
    db
      .select({
        id: follows.id,
        followingId: follows.followingId,
        createdAt: follows.createdAt,
      })
      .from(follows)
      .where(eq(follows.followerId, userId)),
    db
      .select({
        id: follows.id,
        followerId: follows.followerId,
        createdAt: follows.createdAt,
      })
      .from(follows)
      .where(eq(follows.followingId, userId)),
    db
      .select({
        id: balanceTransactions.id,
        type: balanceTransactions.type,
        amount: balanceTransactions.amount,
        balanceBefore: balanceTransactions.balanceBefore,
        balanceAfter: balanceTransactions.balanceAfter,
        relatedId: balanceTransactions.relatedId,
        description: balanceTransactions.description,
        createdAt: balanceTransactions.createdAt,
      })
      .from(balanceTransactions)
      .where(eq(balanceTransactions.userId, userId))
      .orderBy(desc(balanceTransactions.createdAt)),
    db
      .select({
        id: pointsTransactions.id,
        amount: pointsTransactions.amount,
        pointsBefore: pointsTransactions.pointsBefore,
        pointsAfter: pointsTransactions.pointsAfter,
        reason: pointsTransactions.reason,
        metadata: pointsTransactions.metadata,
        createdAt: pointsTransactions.createdAt,
      })
      .from(pointsTransactions)
      .where(eq(pointsTransactions.userId, userId))
      .orderBy(desc(pointsTransactions.createdAt)),
    db
      .select({
        id: referrals.id,
        referralCode: referrals.referralCode,
        referredUserId: referrals.referredUserId,
        status: referrals.status,
        createdAt: referrals.createdAt,
        completedAt: referrals.completedAt,
      })
      .from(referrals)
      .where(eq(referrals.referrerId, userId)),
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        actorId: notifications.actorId,
        postId: notifications.postId,
        commentId: notifications.commentId,
        title: notifications.title,
        message: notifications.message,
        read: notifications.read,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(100),
    db
      .select({
        id: feedbacks.id,
        fromUserId: feedbacks.fromUserId,
        toUserId: feedbacks.toUserId,
        score: feedbacks.score,
        rating: feedbacks.rating,
        comment: feedbacks.comment,
        category: feedbacks.category,
        interactionType: feedbacks.interactionType,
        createdAt: feedbacks.createdAt,
      })
      .from(feedbacks)
      .where(
        or(eq(feedbacks.fromUserId, userId), eq(feedbacks.toUserId, userId))
      ),
    db
      .select({
        id: agentPerformanceMetrics.id,
        gamesPlayed: agentPerformanceMetrics.gamesPlayed,
        gamesWon: agentPerformanceMetrics.gamesWon,
        averageGameScore: agentPerformanceMetrics.averageGameScore,
        normalizedPnL: agentPerformanceMetrics.normalizedPnL,
        totalTrades: agentPerformanceMetrics.totalTrades,
        profitableTrades: agentPerformanceMetrics.profitableTrades,
        winRate: agentPerformanceMetrics.winRate,
        averageROI: agentPerformanceMetrics.averageROI,
        reputationScore: agentPerformanceMetrics.reputationScore,
        trustLevel: agentPerformanceMetrics.trustLevel,
        totalFeedbackCount: agentPerformanceMetrics.totalFeedbackCount,
        averageFeedbackScore: agentPerformanceMetrics.averageFeedbackScore,
        createdAt: agentPerformanceMetrics.createdAt,
        updatedAt: agentPerformanceMetrics.updatedAt,
      })
      .from(agentPerformanceMetrics)
      .where(eq(agentPerformanceMetrics.userId, userId))
      .limit(1),
    db
      .select({
        id: tradingFees.id,
        tradeType: tradingFees.tradeType,
        tradeId: tradingFees.tradeId,
        marketId: tradingFees.marketId,
        feeAmount: tradingFees.feeAmount,
        platformFee: tradingFees.platformFee,
        referrerFee: tradingFees.referrerFee,
        createdAt: tradingFees.createdAt,
      })
      .from(tradingFees)
      .where(eq(tradingFees.userId, userId))
      .orderBy(desc(tradingFees.createdAt))
      .limit(100),
    db
      .select({
        id: tradingFees.id,
        userId: tradingFees.userId,
        tradeType: tradingFees.tradeType,
        referrerFee: tradingFees.referrerFee,
        createdAt: tradingFees.createdAt,
      })
      .from(tradingFees)
      .where(eq(tradingFees.referrerId, userId))
      .orderBy(desc(tradingFees.createdAt))
      .limit(100),
  ]);

  return {
    user: userRows[0],
    userComments,
    userReactions,
    userPosts,
    userPositions,
    userFollows,
    userFollowers,
    userBalanceTransactions,
    userPointsTransactions,
    userReferrals,
    userNotifications,
    userFeedback,
    performanceMetrics: performanceMetricsRows[0],
    userTradingFees,
    referralFeesEarned,
  };
}
