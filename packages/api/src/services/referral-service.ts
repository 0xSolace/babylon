/**
 * Referral Service
 *
 * @description Centralized service for managing user referral codes. Handles
 * referral code generation, uniqueness validation, and database updates. Ensures
 * each user has a unique referral code for tracking referrals.
 */

import {
  existsOtherUserWithReferralCode,
  selectReferralUserCodeRow,
  updateUserReferralCode,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import { BadRequestError, ConflictError, NotFoundError } from '../errors';

export async function isReferralCodeAvailableForUser(
  userId: string,
  referralCode: string
): Promise<boolean> {
  const taken = await asSystem(
    async (c) => existsOtherUserWithReferralCode(c, referralCode, userId),
    'referral-code-availability'
  );
  return !taken;
}

/**
 * Get or create a referral code for a user
 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  return asSystem(async (c) => {
    const user = await selectReferralUserCodeRow(c, userId);

    if (!user) {
      throw new NotFoundError(`User not found: ${userId}`);
    }

    if (!user.username) {
      throw new BadRequestError(
        `User ${userId} does not have a username. Username is required for referral codes.`
      );
    }

    const conflict = await existsOtherUserWithReferralCode(
      c,
      user.username,
      userId
    );

    if (conflict) {
      throw new ConflictError(
        `Username "${user.username}" is already used as a referral code by another user`
      );
    }

    if (user.referralCode !== user.username) {
      await updateUserReferralCode(c, userId, user.username);

      logger.info(
        `Updated referral code to username for user ${userId}: ${user.username}`,
        { userId, code: user.username },
        'ReferralService'
      );
    }

    return user.username;
  }, 'referral-get-or-create-code');
}
