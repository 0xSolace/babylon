import { and, db, eq, follows, referrals } from '@babylon/db';
import type { JsonValue, PointsReason, StringRecord } from '@babylon/shared';
import { generateSnowflakeId, logger, POINTS } from '@babylon/shared';
import { notifyNewAccount } from './notification-service';
import { PointsService } from './points-service';
import { getOrCreateReferralCode } from './referral-service';

type OnboardingServices = {
  notifyNewAccount: (userId: string) => Promise<void>;
  pointsService: {
    awardReferralSignup: (
      referrerId: string,
      referredUserId: string
    ) => Promise<{
      success: boolean;
      pointsAwarded: number;
      error?: string;
    }>;
    awardPoints: (
      userId: string,
      amount: number,
      reason: PointsReason,
      metadata?: StringRecord<JsonValue>
    ) => Promise<{
      success: boolean;
      pointsAwarded: number;
      newTotal: number;
    }>;
  };
  getOrCreateReferralCode: (userId: string) => Promise<string>;
};

let onboardingServicesInstance: OnboardingServices | null = null;
let onboardingServicesFallbackLogged = false;

export function setOnboardingServices(services: OnboardingServices): void {
  onboardingServicesInstance = services;
}

export function getOnboardingServices(): OnboardingServices {
  if (onboardingServicesInstance) {
    return onboardingServicesInstance;
  }

  if (!onboardingServicesFallbackLogged) {
    logger.warn(
      'OnboardingServices not explicitly initialized, using default service bindings',
      undefined,
      'OnboardingOnchain'
    );
    onboardingServicesFallbackLogged = true;
  }

  const fallback: OnboardingServices = {
    notifyNewAccount,
    pointsService: {
      awardReferralSignup: PointsService.awardReferralSignup,
      awardPoints: PointsService.awardPoints,
    },
    getOrCreateReferralCode,
  };
  onboardingServicesInstance = fallback;

  return fallback;
}

export async function finalizeSuccessfulOnchainOnboarding({
  userId,
  referrerId,
  referralCode,
}: {
  userId: string;
  referrerId?: string | null;
  referralCode?: string | null;
}): Promise<void> {
  const services = getOnboardingServices();
  await services.getOrCreateReferralCode(userId);
  await services.notifyNewAccount(userId);

  if (!referrerId) {
    return;
  }

  const referralResult = await services.pointsService.awardReferralSignup(
    referrerId,
    userId
  );

  if (referralResult.success) {
    const refereeBonus = await services.pointsService.awardPoints(
      userId,
      POINTS.REFERRAL_BONUS,
      'referral_bonus',
      { referrerId }
    );

    if (referralCode) {
      const [existingReferral] = await db
        .select({ id: referrals.id })
        .from(referrals)
        .where(
          and(
            eq(referrals.referralCode, referralCode),
            eq(referrals.referredUserId, userId)
          )
        )
        .limit(1);

      if (existingReferral) {
        await db
          .update(referrals)
          .set({ status: 'completed', completedAt: new Date() })
          .where(eq(referrals.id, existingReferral.id));
      } else {
        await db.insert(referrals).values({
          id: await generateSnowflakeId(),
          referrerId,
          referralCode,
          referredUserId: userId,
          status: 'completed',
          completedAt: new Date(),
          createdAt: new Date(),
        });
      }
    }

    const [existingFollow] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(eq(follows.followerId, userId), eq(follows.followingId, referrerId))
      )
      .limit(1);

    if (!existingFollow) {
      await db.insert(follows).values({
        id: await generateSnowflakeId(),
        followerId: userId,
        followingId: referrerId,
        createdAt: new Date(),
      });
    }

    logger.info(
      'Referral processed successfully',
      {
        referrerId,
        referredUserId: userId,
        referrerPoints: referralResult.pointsAwarded,
        refereeBonus: refereeBonus.pointsAwarded,
      },
      'OnboardingOnchain'
    );
    return;
  }

  if (referralCode) {
    const [existingRejectedReferral] = await db
      .select({ id: referrals.id })
      .from(referrals)
      .where(
        and(
          eq(referrals.referralCode, referralCode),
          eq(referrals.referredUserId, userId)
        )
      )
      .limit(1);

    if (existingRejectedReferral) {
      await db
        .update(referrals)
        .set({ status: 'rejected' })
        .where(eq(referrals.id, existingRejectedReferral.id));
    } else {
      await db.insert(referrals).values({
        id: await generateSnowflakeId(),
        referrerId,
        referralCode,
        referredUserId: userId,
        status: 'rejected',
        createdAt: new Date(),
      });
    }
  }

  logger.warn(
    'Referral blocked during registration',
    { referrerId, referredUserId: userId, error: referralResult.error },
    'OnboardingOnchain'
  );
}
