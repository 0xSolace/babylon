/**
 * User Data Export API
 *
 * @route GET /api/users/export-data - Export user data
 * @access Authenticated
 *
 * @description
 * Exports all user data in JSON format for GDPR compliance (right to data portability).
 * Includes user profile, posts, comments, reactions, positions, transactions, referrals,
 * notifications, and all associated data.
 *
 * @openapi
 * /api/users/export-data:
 *   get:
 *     tags:
 *       - Users
 *     summary: Export user data
 *     description: Exports all user data for GDPR compliance (right to data portability)
 *     security:
 *       - PrivyAuth: []
 *     responses:
 *       200:
 *         description: User data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 posts:
 *                   type: array
 *                 comments:
 *                   type: array
 *                 reactions:
 *                   type: array
 *                 positions:
 *                   type: array
 *                 transactions:
 *                   type: array
 *                 referrals:
 *                   type: array
 *                 notifications:
 *                   type: array
 *                 exportedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *
 * @example
 * ```typescript
 * const data = await fetch('/api/users/export-data', {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * }).then(r => r.json());
 * ```
 *
 * @see GDPR Article 20 - Right to data portability
 */

import { authenticate, successResponse, withErrorHandling } from '@babylon/api';
import { fetchUserGdprExportBundle } from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  const userId = authUser.dbUserId ?? authUser.userId;

  logger.info(
    'User requested data export',
    { userId },
    'GET /api/users/export-data'
  );

  return asUser(authUser, async (db) => {
    const {
      user,
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
      performanceMetrics,
      userTradingFees,
      referralFeesEarned,
    } = await fetchUserGdprExportBundle(db, userId);

    if (!user) {
      return successResponse({ error: 'User not found' }, 404);
    }

    // Compile all data into a comprehensive export
    const exportData = {
      export_info: {
        exported_at: new Date().toISOString(),
        user_id: userId,
        format_version: '1.0',
      },
      personal_information: {
        ...user,
        // Important notice about blockchain data
        blockchain_notice:
          'On-chain data (wallet address, NFT token ID, registration transaction) is recorded on public blockchain and cannot be deleted.',
      },
      content: {
        posts: userPosts,
        comments: userComments,
        reactions: userReactions,
      },
      trading: {
        positions: userPositions,
        balance_transactions: userBalanceTransactions,
      },
      social: {
        following: userFollows,
        followers: userFollowers,
        referrals: userReferrals,
      },
      points_and_reputation: {
        points_transactions: userPointsTransactions,
        performance_metrics: performanceMetrics ?? null,
        feedback_given_and_received: userFeedback,
      },
      financial: {
        trading_fees_paid: userTradingFees,
        referral_fees_earned: referralFeesEarned,
      },
      notifications: userNotifications,
      legal_consent: {
        terms_of_service: {
          accepted: user.tosAccepted,
          accepted_at: user.tosAcceptedAt,
          version: user.tosAcceptedVersion,
        },
        privacy_policy: {
          accepted: user.privacyPolicyAccepted,
          accepted_at: user.privacyPolicyAcceptedAt,
          version: user.privacyPolicyAcceptedVersion,
        },
      },
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="babylon-data-export-${userId}-${Date.now()}.json"`,
      },
    });
  });
});
