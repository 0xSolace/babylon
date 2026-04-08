'use client';

import type { OnboardingProfilePayload } from '@babylon/shared';
import {
  isValidOnboardingUsername,
  logger,
  POINTS,
  sanitizeOnboardingUsername,
} from '@babylon/shared';
import { useIdentityToken, usePrivy } from '@privy-io/react-auth';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImportedProfileData } from '@/components/onboarding/UserOnboardingFlow';
import { UserSignupOnboardingContextProvider } from '@/components/onboarding/user-signup-onboarding-context';
import { useAuth } from '@/hooks/useAuth';
import { useSignupTracking } from '@/hooks/usePostHog';
import {
  hasCompletedGameGuide,
  markGameGuideCompletedLocal,
} from '@/lib/game-guide-completion';
import { useAuthStore } from '@/stores/authStore';
import { apiFetch } from '@/utils/api-fetch';

import { clearReferralCode, getReferralCode } from './ReferralCaptureProvider';

function getSafeReturnTo(): string {
  if (typeof window === 'undefined') return '/feed';
  const raw = new URLSearchParams(window.location.search).get('returnTo');
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/feed';
  }
  return raw;
}

/**
 * Unified first-run flow: profile signup + game guide on `/onboarding` (full page).
 * Optional `?replayGuide=1` re-opens the tour from the user menu.
 */
export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    authenticated,
    user,
    needsOnboarding,
    loadingProfile,
    profileFetchStatus,
    logout,
  } = useAuth();

  const { user: privyUser } = usePrivy();

  const isSocialLogin = useMemo(() => {
    if (!privyUser) return false;
    const userWithSocial = privyUser as typeof privyUser & {
      farcaster?: { username?: string };
      twitter?: { username?: string };
    };
    return !!(
      userWithSocial.farcaster?.username || userWithSocial.twitter?.username
    );
  }, [privyUser]);

  const { setUser, setNeedsOnboarding } = useAuthStore();
  const { identityToken } = useIdentityToken();
  const { trackSignupStarted, trackSignupCompleted, trackOnboardingStep } =
    useSignupTracking();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guideSubmitting, setGuideSubmitting] = useState(false);
  const guideCompleteInFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [_submittedProfile, setSubmittedProfile] =
    useState<OnboardingProfilePayload | null>(null);
  const [importedProfileData, setImportedProfileData] =
    useState<ImportedProfileData | null>(null);
  const [_hasProgressedPastSocialImport, setHasProgressedPastSocialImport] =
    useState(false);
  const socialAutoSubmitRef = useRef(false);
  const [socialAutoSubmitAttempted, setSocialAutoSubmitAttempted] =
    useState(false);

  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const [replayGuide, setReplayGuide] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setReplayGuide(
      pathname === '/onboarding' &&
        new URLSearchParams(window.location.search).get('replayGuide') === '1'
    );
  }, [pathname]);

  const guideDone = useMemo(
    () => hasCompletedGameGuide(user?.id, user?.gameGuideCompletedAt),
    [user?.id, user?.gameGuideCompletedAt]
  );

  useEffect(() => {
    if (!authenticated || loadingProfile) {
      setIsReadyToShow(false);
      setHasInitialized(false);
      return;
    }

    if (hasInitialized) {
      setIsReadyToShow(true);
      return;
    }

    // Shorter delay in dev avoids a sluggish redirect while Turbopack compiles.
    const delay = process.env.NODE_ENV === 'development' ? 0 : 1000;
    const timer = setTimeout(() => {
      setIsReadyToShow(true);
      setHasInitialized(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [authenticated, loadingProfile, hasInitialized]);

  useEffect(() => {
    if (
      needsOnboarding &&
      authenticated &&
      !loadingProfile &&
      profileFetchStatus === 'done'
    ) {
      setIsReadyToShow(true);
      setHasInitialized(true);
    }
  }, [needsOnboarding, authenticated, loadingProfile, profileFetchStatus]);

  const shouldShowOnboarding = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isDevMode = params.get('dev') === 'true';
      const isProduction = window.location.hostname === 'babylon.market';
      const isHomePage = window.location.pathname === '/';
      const isWaitlistFlow = params.get('waitlist') === 'true';

      if (isProduction && isHomePage && !isDevMode && !isWaitlistFlow) {
        return false;
      }
    }

    if (!isReadyToShow) {
      return false;
    }

    if (!authenticated || loadingProfile) {
      return false;
    }

    if (profileFetchStatus !== 'done') {
      return false;
    }

    if (user?.isActor) {
      return false;
    }

    if (replayGuide) {
      return true;
    }

    if (needsOnboarding) {
      return true;
    }

    if (!guideDone) {
      return true;
    }

    return false;
  }, [
    isReadyToShow,
    authenticated,
    loadingProfile,
    profileFetchStatus,
    user,
    replayGuide,
    needsOnboarding,
    guideDone,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!shouldShowOnboarding) return;
    if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) {
      return;
    }

    const currentParams = new URLSearchParams(window.location.search);
    const next = new URLSearchParams();
    const returnPath = `${pathname}${window.location.search}`;
    if (returnPath && returnPath !== '/onboarding') {
      next.set('returnTo', returnPath);
    }
    if (currentParams.get('waitlist') === 'true') {
      next.set('waitlist', 'true');
    }
    if (currentParams.get('dev') === 'true') {
      next.set('dev', 'true');
    }
    const q = next.toString();
    router.replace(`/onboarding${q ? `?${q}` : ''}`);
  }, [shouldShowOnboarding, pathname, router]);

  const phase = useMemo<'profile' | 'guide'>(() => {
    if (replayGuide) return 'guide';
    if (needsOnboarding) return 'profile';
    return 'guide';
  }, [replayGuide, needsOnboarding]);

  const handleProfileSubmit = useCallback(
    async (payload: OnboardingProfilePayload) => {
      setIsSubmitting(true);
      setError(null);
      trackSignupStarted();

      const referralCode = getReferralCode();

      logger.info(
        'Identity token state during signup',
        {
          present: Boolean(identityToken),
          tokenPreview: identityToken
            ? `${identityToken.slice(0, 12)}...`
            : null,
        },
        'OnboardingProvider'
      );

      try {
        const response = await apiFetch('/api/users/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            referralCode: referralCode ?? undefined,
            identityToken: identityToken ?? undefined,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          const message =
            data?.error ||
            `Failed to complete signup (status ${response.status})`;
          setIsSubmitting(false);
          throw new Error(message);
        }

        if (data.user) {
          const u = data.user as {
            id: string;
            walletAddress?: string;
            displayName?: string;
            username?: string;
            bio?: string;
            profileImageUrl?: string;
            coverImageUrl?: string;
            profileComplete?: boolean;
            reputationPoints?: number;
            hasFarcaster?: boolean;
            hasTwitter?: boolean;
            farcasterUsername?: string;
            twitterUsername?: string;
            nftTokenId?: number;
            createdAt?: string;
            onChainRegistered?: boolean;
            gameGuideCompletedAt?: string | null;
          };
          setUser({
            id: u.id,
            displayName:
              u.displayName ?? payload.displayName ?? payload.username,
            email: user?.email,
            username: u.username ?? payload.username,
            bio: u.bio ?? payload.bio,
            profileImageUrl:
              u.profileImageUrl ?? payload.profileImageUrl ?? undefined,
            coverImageUrl:
              u.coverImageUrl ?? payload.coverImageUrl ?? undefined,
            profileComplete: u.profileComplete ?? true,
            reputationPoints: u.reputationPoints ?? user?.reputationPoints,
            hasFarcaster: u.hasFarcaster ?? user?.hasFarcaster,
            hasTwitter: u.hasTwitter ?? user?.hasTwitter,
            farcasterUsername: u.farcasterUsername ?? user?.farcasterUsername,
            twitterUsername: u.twitterUsername ?? user?.twitterUsername,
            createdAt: u.createdAt ?? user?.createdAt,
            gameGuideCompletedAt: u.gameGuideCompletedAt ?? null,
          });
        }
        setNeedsOnboarding(false);

        clearReferralCode();
        setSubmittedProfile(payload);
        trackOnboardingStep('profile', true);
        trackSignupCompleted(data.user?.id ?? '', {
          hasReferrer: Boolean(referralCode),
          hasFarcaster: data.user?.hasFarcaster ?? false,
          hasTwitter: data.user?.hasTwitter ?? false,
        });
        setIsSubmitting(false);
      } catch (err) {
        setIsSubmitting(false);
        throw err;
      }
    },
    [
      user,
      setUser,
      setNeedsOnboarding,
      identityToken,
      trackSignupStarted,
      trackSignupCompleted,
      trackOnboardingStep,
    ]
  );

  useEffect(() => {
    if (!authenticated) {
      setSubmittedProfile(null);
      setError(null);
      setImportedProfileData(null);
      setHasProgressedPastSocialImport(false);
      socialAutoSubmitRef.current = false;
      setSocialAutoSubmitAttempted(false);
      return;
    }

    if (loadingProfile) {
      return;
    }

    if (needsOnboarding) {
      if (
        isSocialLogin &&
        importedProfileData &&
        !socialAutoSubmitRef.current &&
        !socialAutoSubmitAttempted
      ) {
        setSocialAutoSubmitAttempted(true);
        socialAutoSubmitRef.current = true;
        logger.info(
          'Social login user - auto-submitting profile',
          {
            platform: importedProfileData.platform,
            username: importedProfileData.username,
          },
          'OnboardingProvider'
        );
        const sanitizedUsername = sanitizeOnboardingUsername(
          importedProfileData.username
        );
        if (!isValidOnboardingUsername(sanitizedUsername)) {
          logger.warn(
            'Social username not valid after sanitization, falling back to manual onboarding',
            {
              raw: importedProfileData.username,
              sanitized: sanitizedUsername,
            },
            'OnboardingProvider'
          );
          socialAutoSubmitRef.current = false;
          return;
        }
        const autoProfile: OnboardingProfilePayload = {
          username: sanitizedUsername,
          displayName: importedProfileData.displayName,
          bio: '',
          profileImageUrl: importedProfileData.profileImageUrl ?? undefined,
          coverImageUrl: undefined,
          importedFrom: importedProfileData.platform,
          twitterId: importedProfileData.twitterId ?? null,
          twitterUsername:
            importedProfileData.platform === 'twitter'
              ? importedProfileData.username
              : null,
          farcasterFid: importedProfileData.farcasterFid ?? null,
          farcasterUsername:
            importedProfileData.platform === 'farcaster'
              ? importedProfileData.username
              : null,
          tosAccepted: true,
          privacyPolicyAccepted: true,
        };
        handleProfileSubmit(autoProfile).catch((submitError: Error) => {
          logger.error(
            'Social login auto-submit failed',
            {
              error: submitError.message,
              platform: importedProfileData.platform,
            },
            'OnboardingProvider'
          );
          setError(submitError.message);
          socialAutoSubmitRef.current = false;
        });
        return;
      }
    }
  }, [
    authenticated,
    loadingProfile,
    needsOnboarding,
    isSocialLogin,
    importedProfileData,
    handleProfileSubmit,
    socialAutoSubmitAttempted,
  ]);

  useEffect(() => {
    if (!authenticated || !privyUser || !needsOnboarding) return;
    if (importedProfileData) return;
    if (loadingProfile) return;

    const userWithFarcaster = privyUser as typeof privyUser & {
      farcaster?: {
        username?: string;
        displayName?: string;
        bio?: string;
        pfp?: string;
        pfpUrl?: string;
        fid?: number;
        url?: string;
        ownerAddress?: string;
        verifications?: string[];
      };
    };
    const userWithTwitter = privyUser as typeof privyUser & {
      twitter?: {
        username?: string;
        name?: string;
        profilePictureUrl?: string;
        subject?: string;
      };
    };

    if (userWithFarcaster.farcaster) {
      const fc = userWithFarcaster.farcaster;
      const profileImage = fc.pfpUrl || fc.pfp || null;

      const profileData: ImportedProfileData = {
        platform: 'farcaster',
        username:
          fc.username ||
          fc.displayName?.toLowerCase().replace(/\s+/g, '_') ||
          'farcaster_user',
        displayName: fc.displayName || fc.username || 'Farcaster User',
        bio: fc.bio || undefined,
        profileImageUrl: profileImage,
        farcasterFid: fc.fid?.toString(),
      };

      logger.info(
        'Auto-imported Farcaster profile from Privy - will award points on signup',
        {
          username: profileData.username,
          displayName: profileData.displayName,
          fid: fc.fid,
          hasBio: !!profileData.bio,
          hasProfileImage: !!profileImage,
          rewardEligible: true,
          expectedPoints: POINTS.FARCASTER_LINK,
        },
        'OnboardingProvider'
      );

      setImportedProfileData(profileData);
      setHasProgressedPastSocialImport(true);
      return;
    }

    if (userWithTwitter.twitter) {
      const tw = userWithTwitter.twitter;

      let profileImageUrl = tw.profilePictureUrl;
      if (profileImageUrl && profileImageUrl.includes('_normal')) {
        profileImageUrl = profileImageUrl.replace('_normal', '_400x400');
      }

      const profileData: ImportedProfileData = {
        platform: 'twitter',
        username: tw.username || 'twitter_user',
        displayName: tw.name || tw.username || 'Twitter User',
        bio: undefined,
        profileImageUrl: profileImageUrl || null,
        twitterId: tw.subject || tw.username,
      };

      logger.info(
        'Auto-imported Twitter profile from Privy - will award points on signup',
        {
          username: profileData.username,
          displayName: profileData.displayName,
          twitterId: profileData.twitterId,
          hasProfileImage: !!profileImageUrl,
          rewardEligible: true,
          expectedPoints: POINTS.TWITTER_LINK,
        },
        'OnboardingProvider'
      );

      setImportedProfileData(profileData);
      setHasProgressedPastSocialImport(true);
      return;
    }

    logger.info(
      'User authenticated with wallet only - will use generated profile',
      { userId: privyUser.id },
      'OnboardingProvider'
    );
  }, [
    authenticated,
    privyUser,
    needsOnboarding,
    importedProfileData,
    loadingProfile,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || !authenticated) return;

    const params = new URLSearchParams(window.location.search);
    const socialImport = params.get('social_import');
    const dataParam = params.get('data');

    if (socialImport && dataParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(dataParam)) as unknown;

        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          !('platform' in parsed) ||
          !('username' in parsed) ||
          !('displayName' in parsed) ||
          (parsed.platform !== 'twitter' && parsed.platform !== 'farcaster') ||
          typeof parsed.username !== 'string' ||
          typeof parsed.displayName !== 'string'
        ) {
          logger.warn(
            'Invalid social profile data structure from URL',
            { socialImport },
            'OnboardingProvider'
          );
          return;
        }

        const profileData = parsed as ImportedProfileData;
        logger.info(
          'Social profile data received from URL',
          { platform: socialImport },
          'OnboardingProvider'
        );

        setImportedProfileData(profileData);
        setHasProgressedPastSocialImport(true);
      } catch (parseError) {
        logger.warn(
          'Failed to parse social profile data from URL',
          { error: parseError },
          'OnboardingProvider'
        );
      }

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('social_import');
      newUrl.searchParams.delete('data');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [authenticated]);

  const handleGuideComplete = useCallback(
    async (options?: { nextHref?: string }) => {
      if (guideCompleteInFlight.current) return;
      const uid = user?.id;
      const dest = options?.nextHref ?? getSafeReturnTo();

      if (!uid) {
        router.replace(dest);
        return;
      }

      guideCompleteInFlight.current = true;
      setGuideSubmitting(true);
      markGameGuideCompletedLocal(uid);

      try {
        const res = await apiFetch('/api/users/me/game-guide', {
          method: 'POST',
        });
        if (res.ok) {
          const { gameGuideCompletedAt } = (await res.json()) as {
            gameGuideCompletedAt: string;
          };
          const fresh = useAuthStore.getState().user;
          if (fresh) {
            setUser({ ...fresh, gameGuideCompletedAt });
          }
          logger.info(
            'Unified onboarding: game guide marked complete',
            { userId: uid },
            'OnboardingProvider'
          );
        } else {
          logger.error(
            'Game guide API failed (localStorage backup saved)',
            { status: res.status, userId: uid },
            'OnboardingProvider'
          );
        }
      } catch (err) {
        logger.error(
          'Game guide API error',
          {
            error: err instanceof Error ? err.message : String(err),
            userId: uid,
          },
          'OnboardingProvider'
        );
      } finally {
        setGuideSubmitting(false);
        guideCompleteInFlight.current = false;
      }

      trackOnboardingStep('guide', true);
      router.replace(dest);
    },
    [user?.id, router, setUser, trackOnboardingStep]
  );

  const onLogout = useCallback(async () => {
    if (logout) {
      await logout();
    }
  }, [logout]);

  const flowContextValue = useMemo(
    () => ({
      phase,
      isReplayGuide: replayGuide,
      shouldShowOnboarding,
      isSubmitting,
      guideSubmitting,
      error,
      onSubmitProfile: handleProfileSubmit,
      onGuideComplete: handleGuideComplete,
      onLogout,
      user,
      importedData: importedProfileData,
    }),
    [
      phase,
      replayGuide,
      shouldShowOnboarding,
      isSubmitting,
      guideSubmitting,
      error,
      handleProfileSubmit,
      handleGuideComplete,
      onLogout,
      user,
      importedProfileData,
    ]
  );

  return (
    <UserSignupOnboardingContextProvider value={flowContextValue}>
      {children}
    </UserSignupOnboardingContextProvider>
  );
}
