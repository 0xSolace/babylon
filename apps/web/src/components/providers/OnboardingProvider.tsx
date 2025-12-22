'use client';

import { useJejuAuth } from '@babylon/auth/client';
import type { OnboardingProfilePayload } from '@babylon/shared';
import {
  CHAIN,
  getWalletErrorMessage,
  logger,
  POINTS,
  WALLET_ERROR_MESSAGES,
} from '@babylon/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type ImportedProfileData,
  OnboardingModal,
} from '@/components/onboarding/OnboardingModal';
import { useAuth } from '@/hooks/useAuth';
import { useRegisterAgentTx } from '@/hooks/useRegisterAgentTx';
import { apiFetch } from '@/utils/api-fetch';

/**
 * Check if we're on a local network where smart wallets aren't supported.
 * Smart wallets (ERC-4337) require bundler infrastructure that only exists
 * on supported chains like Base/Base Sepolia, not on local Hardhat networks.
 */
const isLocalNetwork = CHAIN.id === 31337;

import type { JsonValue } from '@babylon/shared';
import { type User as StoreUser, useAuthStore } from '@/stores/authStore';

import { clearReferralCode, getReferralCode } from './ReferralCaptureProvider';

/**
 * Onboarding stage type for multi-step onboarding flow.
 */
type OnboardingStage = 'PROFILE' | 'ONCHAIN' | 'COMPLETED';

/**
 * Onboarding provider component for managing user onboarding flow.
 *
 * Manages the complete onboarding process including profile creation,
 * on-chain registration, and social account linking. Handles modal display,
 * form submission, error handling, and progress tracking. Integrates with
 * OAuth3 authentication and smart wallet registration.
 *
 * Features:
 * - Multi-stage onboarding (PROFILE, ONCHAIN, COMPLETED)
 * - Profile creation form
 * - On-chain agent registration
 * - Social account import (Farcaster, Twitter)
 * - Referral code handling
 * - Modal display management
 * - Error handling and retry logic
 *
 * @param props - OnboardingProvider component props
 * @returns Onboarding provider element
 */
export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    authenticated,
    user,
    needsOnboarding,
    needsOnchain,
    loadingProfile,
    refresh,
    logout,
  } = useAuth();

  // Get linked social accounts and auth token from OAuth3
  const { linkedAccounts, getAccessToken } = useJejuAuth();

  const { setUser, setNeedsOnboarding, setNeedsOnchain } = useAuthStore();
  const { registerAgent, smartWalletAddress, smartWalletReady } =
    useRegisterAgentTx();

  const [stage, setStage] = useState<OnboardingStage>('PROFILE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedProfile, setSubmittedProfile] =
    useState<OnboardingProfilePayload | null>(null);
  const [userDismissed, setUserDismissed] = useState(false);
  const [importedProfileData, setImportedProfileData] =
    useState<ImportedProfileData | null>(null);
  const [_hasProgressedPastSocialImport, setHasProgressedPastSocialImport] =
    useState(false);
  const [pendingOnchainSubmission, setPendingOnchainSubmission] =
    useState<OnboardingProfilePayload | null>(null);
  const [onchainReferralCode, setOnchainReferralCode] = useState<string | null>(
    null
  );

  // Delay modal display to prevent flickering
  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Wait for app to stabilize before showing modal
  useEffect(() => {
    if (!authenticated || loadingProfile) {
      setIsReadyToShow(false);
      setHasInitialized(false);
      return;
    }

    // If already initialized and conditions change, show immediately
    if (hasInitialized) {
      setIsReadyToShow(true);
      return;
    }

    // First time: wait 2-3 seconds for app to load
    const delay = Math.random() * 1000 + 2000; // 2-3 seconds
    const timer = setTimeout(() => {
      setIsReadyToShow(true);
      setHasInitialized(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [authenticated, loadingProfile, hasInitialized]);

  // If needsOnboarding is manually set to true, show modal immediately
  useEffect(() => {
    if (needsOnboarding && authenticated && !loadingProfile) {
      setIsReadyToShow(true);
      setHasInitialized(true);
      setUserDismissed(false); // Reset dismissed state when explicitly requesting onboarding
    }
  }, [needsOnboarding, authenticated, loadingProfile]);

  const shouldShowModal = useMemo(() => {
    // Check if dev mode is enabled via URL parameter
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isDevMode = params.get('dev') === 'true';
      const isProduction = window.location.hostname === 'babylon.market';
      const isHomePage = window.location.pathname === '/';
      const isWaitlistFlow = params.get('waitlist') === 'true';

      // Hide onboarding modal on production (babylon.market) on home page unless ?dev=true
      // BUT allow it if user is in waitlist flow (coming from waitlist signup)
      if (isProduction && isHomePage && !isDevMode && !isWaitlistFlow) {
        return false;
      }
    }

    // Don't show until ready (prevents flickering)
    if (!isReadyToShow) {
      return false;
    }

    if (!authenticated || loadingProfile) {
      return false;
    }

    // User explicitly dismissed the modal
    if (userDismissed) {
      return false;
    }

    // Don't show modal if user is already fully registered (defensive check)
    if (user?.onChainRegistered && user?.nftTokenId && user?.profileComplete) {
      return false;
    }

    // Don't keep showing modal after completion
    if (stage === 'COMPLETED') {
      return true; // Show briefly to show success message, but allow closing
    }

    return Boolean(
      needsOnboarding ||
        needsOnchain ||
        stage === 'ONCHAIN' ||
        stage === 'PROFILE'
    );
  }, [
    isReadyToShow,
    authenticated,
    loadingProfile,
    needsOnboarding,
    needsOnchain,
    stage,
    user,
    userDismissed,
  ]);

  useEffect(() => {
    if (!authenticated) {
      setStage('PROFILE');
      setSubmittedProfile(null);
      setError(null);
      setUserDismissed(false); // Reset dismissed state on logout
      setImportedProfileData(null);
      setHasProgressedPastSocialImport(false);
      setPendingOnchainSubmission(null);
      setOnchainReferralCode(null);
      return;
    }

    if (loadingProfile) {
      return;
    }

    if (needsOnboarding) {
      // Start directly at profile setup
      setStage('PROFILE');
      return;
    }

    if (needsOnchain) {
      if (!submittedProfile && user) {
        setSubmittedProfile({
          username: user.username ?? `user_${user.id.slice(0, 8)}`,
          displayName: user.displayName ?? user.username ?? 'New User',
          bio: user.bio,
          profileImageUrl: user.profileImageUrl,
          coverImageUrl: user.coverImageUrl,
        });
      }
      setStage((prev) => (prev === 'COMPLETED' ? prev : 'ONCHAIN'));
      return;
    }

    if (stage !== 'COMPLETED') {
      setStage('PROFILE');
      setSubmittedProfile(null);
      setError(null);
      setImportedProfileData(null);
      setHasProgressedPastSocialImport(false);
    }
  }, [
    authenticated,
    loadingProfile,
    needsOnboarding,
    needsOnchain,
    user,
    submittedProfile,
    stage,
  ]);

  // Automatically extract social profile data from linked accounts when authenticating
  useEffect(() => {
    if (!authenticated || !needsOnboarding) return;
    if (importedProfileData) return; // Already have imported data
    if (loadingProfile) return; // Wait for profile to load

    // Check for Farcaster account in linked accounts
    const farcasterAccount = linkedAccounts.find((a) => a.type === 'farcaster');
    if (farcasterAccount) {
      const profileData: ImportedProfileData = {
        platform: 'farcaster',
        username: farcasterAccount.identifier || 'farcaster_user',
        displayName: farcasterAccount.identifier || 'Farcaster User',
        bio: undefined,
        profileImageUrl: null,
        farcasterFid: farcasterAccount.identifier,
      };

      logger.info(
        'Auto-imported Farcaster profile from OAuth3 - will award points on signup',
        {
          username: profileData.username,
          displayName: profileData.displayName,
          fid: farcasterAccount.identifier,
          rewardEligible: true,
          expectedPoints: POINTS.FARCASTER_LINK,
        },
        'OnboardingProvider'
      );

      setImportedProfileData(profileData);
      setHasProgressedPastSocialImport(true);
      return;
    }

    // Check for Twitter account in linked accounts
    const twitterAccount = linkedAccounts.find((a) => a.type === 'twitter');
    if (twitterAccount) {
      const profileData: ImportedProfileData = {
        platform: 'twitter',
        username: twitterAccount.identifier || 'twitter_user',
        displayName: twitterAccount.identifier || 'Twitter User',
        bio: undefined,
        profileImageUrl: null,
        twitterId: twitterAccount.identifier,
      };

      logger.info(
        'Auto-imported Twitter profile from OAuth3 - will award points on signup',
        {
          username: profileData.username,
          displayName: profileData.displayName,
          twitterId: profileData.twitterId,
          rewardEligible: true,
          expectedPoints: POINTS.TWITTER_LINK,
        },
        'OnboardingProvider'
      );

      setImportedProfileData(profileData);
      setHasProgressedPastSocialImport(true);
      return;
    }

    // For wallet-only logins, don't set imported data - let the generated profile flow handle it
    logger.info(
      'User authenticated with wallet only - will use generated profile',
      undefined,
      'OnboardingProvider'
    );
  }, [
    authenticated,
    linkedAccounts,
    needsOnboarding,
    importedProfileData,
    loadingProfile,
  ]);

  // Listen for social import callbacks from URL parameters (for manual social linking)
  useEffect(() => {
    if (typeof window === 'undefined' || !authenticated) return;

    const params = new URLSearchParams(window.location.search);
    const socialImport = params.get('social_import');
    const dataParam = params.get('data');

    if (socialImport && dataParam) {
      const profileData = JSON.parse(
        decodeURIComponent(dataParam)
      ) as ImportedProfileData;
      logger.info(
        'Social profile data received from URL',
        { platform: socialImport },
        'OnboardingProvider'
      );

      setImportedProfileData(profileData);
      setHasProgressedPastSocialImport(true);
      setStage('PROFILE');

      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('social_import');
      newUrl.searchParams.delete('data');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [authenticated]);

  const submitOnchain = useCallback(
    async (profile: OnboardingProfilePayload, referralCode: string | null) => {
      // Defensive check: skip if user is already fully registered
      if (
        user?.onChainRegistered &&
        user?.nftTokenId &&
        user?.profileComplete
      ) {
        logger.info(
          'User already fully registered, skipping onchain submission',
          { userId: user.id, nftTokenId: user.nftTokenId },
          'OnboardingProvider'
        );
        setNeedsOnboarding(false);
        setNeedsOnchain(false);
        setStage('COMPLETED');
        return;
      }

      const body = {
        walletAddress: smartWalletAddress || null,
        referralCode: referralCode || null,
      };

      const callEndpoint = async (payload: Record<string, string | null>) => {
        const response = await apiFetch('/api/users/onboarding/onchain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
          const rawError = data?.error;
          const message =
            (typeof rawError === 'string'
              ? rawError
              : typeof rawError?.message === 'string'
                ? rawError.message
                : null) ??
            `Failed to complete on-chain onboarding (status ${response.status})`;
          throw new Error(message);
        }
        return data as {
          onchain: Record<string, JsonValue>;
          user: StoreUser | null;
        };
      };

      const applyResponse = (data: {
        onchain: Record<string, JsonValue>;
        user: StoreUser | null;
      }) => {
        if (data.user) {
          setUser({
            id: data.user.id,
            walletAddress: data.user.walletAddress,
            displayName: data.user.displayName ?? user?.displayName,
            email: user?.email,
            username: data.user.username,
            bio: data.user.bio,
            profileImageUrl: data.user.profileImageUrl,
            coverImageUrl: data.user.coverImageUrl,
            profileComplete: data.user.profileComplete ?? true,
            reputationPoints:
              data.user.reputationPoints ?? user?.reputationPoints,
            hasFarcaster: data.user.hasFarcaster ?? user?.hasFarcaster,
            hasTwitter: data.user.hasTwitter ?? user?.hasTwitter,
            farcasterUsername:
              data.user.farcasterUsername ?? user?.farcasterUsername,
            twitterUsername: data.user.twitterUsername ?? user?.twitterUsername,
            nftTokenId: data.user.nftTokenId,
            createdAt: data.user.createdAt ?? user?.createdAt,
            onChainRegistered:
              data.user.onChainRegistered ?? user?.onChainRegistered,
          });
        }
        setNeedsOnboarding(false);
        setNeedsOnchain(false);
        setStage('COMPLETED');
        void refresh().catch(() => undefined);
      };

      const completeWithClient = async () => {
        // On local networks (Hardhat), smart wallets (ERC-4337) don't work because
        // there's no bundler infrastructure. Fall back to backend-signed transactions.
        if (isLocalNetwork) {
          logger.info(
            'Local network detected - using backend-signed registration (no bundler available)',
            { chainId: CHAIN.id },
            'OnboardingProvider'
          );
          const data = await callEndpoint(body);
          applyResponse(data);
          return;
        }

        if (!smartWalletReady || !smartWalletAddress) {
          throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
        }

        logger.info(
          'Attempting client-signed on-chain registration',
          { address: smartWalletAddress },
          'OnboardingProvider'
        );

        // Check if wallet is already registered before submitting transaction
        // If already registered, the server will handle syncing the state
        const registrationResult = await registerAgent(profile).catch(
          (txError: Error) => {
            const errorMessage = txError.message.toLowerCase();
            // If the error is "already registered", don't throw - let the server handle it
            if (errorMessage.includes('already registered')) {
              logger.info(
                'Wallet already registered on-chain, syncing with server',
                { address: smartWalletAddress },
                'OnboardingProvider'
              );
              return 'already-registered';
            }
            // For other errors, re-throw
            throw txError;
          }
        );

        if (registrationResult === 'already-registered') {
          // Call the endpoint without a txHash - server will detect existing registration
          const data = await callEndpoint(body);
          applyResponse(data);
          return;
        }

        const txHash = registrationResult as string;
        logger.info(
          'Client-submitted on-chain registration transaction',
          { txHash },
          'OnboardingProvider'
        );

        const data = await callEndpoint({
          ...body,
          txHash,
        });
        applyResponse(data);
      };

      const response = await completeWithClient().catch((rawError: Error) => {
        // Use wallet-aware error message
        const userFriendlyMessage = getWalletErrorMessage(rawError);
        setError(userFriendlyMessage);
        logger.error(
          'Failed to complete on-chain onboarding',
          { error: rawError.message },
          'OnboardingProvider'
        );
        return null;
      });

      if (!response) return;
    },
    [
      smartWalletReady,
      refresh,
      registerAgent,
      setNeedsOnboarding,
      setNeedsOnchain,
      setUser,
      smartWalletAddress,
      user,
    ]
  );

  useEffect(() => {
    // On local networks, we use backend signing so smart wallet isn't required
    const walletReady =
      isLocalNetwork || (smartWalletReady && smartWalletAddress);

    if (
      stage !== 'ONCHAIN' ||
      !pendingOnchainSubmission ||
      !walletReady ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    void submitOnchain(pendingOnchainSubmission, onchainReferralCode).finally(
      () => {
        setPendingOnchainSubmission(null);
        setIsSubmitting(false);
      }
    );
  }, [
    stage,
    pendingOnchainSubmission,
    smartWalletReady,
    smartWalletAddress,
    isSubmitting,
    submitOnchain,
    onchainReferralCode,
  ]);

  const handleProfileSubmit = useCallback(
    async (payload: OnboardingProfilePayload) => {
      setIsSubmitting(true);
      setError(null);

      const referralCode = getReferralCode();

      // Get OAuth3 access token for signup
      const accessToken = await getAccessToken();
      logger.info(
        'OAuth3 token state during signup',
        {
          present: Boolean(accessToken),
          tokenPreview: accessToken ? `${accessToken.slice(0, 12)}...` : null,
        },
        'OnboardingProvider'
      );

      const response = await apiFetch('/api/users/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          referralCode: referralCode || undefined,
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
        setUser({
          id: data.user.id,
          walletAddress: data.user.walletAddress ?? smartWalletAddress,
          displayName: data.user.displayName ?? payload.displayName,
          email: user?.email,
          username: data.user.username ?? payload.username,
          bio: data.user.bio ?? payload.bio,
          profileImageUrl: data.user.profileImageUrl ?? payload.profileImageUrl,
          coverImageUrl: data.user.coverImageUrl ?? payload.coverImageUrl,
          profileComplete: data.user.profileComplete ?? true,
          reputationPoints:
            data.user.reputationPoints ?? user?.reputationPoints,
          hasFarcaster: data.user.hasFarcaster ?? user?.hasFarcaster,
          hasTwitter: data.user.hasTwitter ?? user?.hasTwitter,
          farcasterUsername:
            data.user.farcasterUsername ?? user?.farcasterUsername,
          twitterUsername: data.user.twitterUsername ?? user?.twitterUsername,
          nftTokenId: data.user.nftTokenId,
          createdAt: data.user.createdAt ?? user?.createdAt,
          onChainRegistered:
            data.user.onChainRegistered ?? user?.onChainRegistered,
        });
      }
      setNeedsOnboarding(false);
      setNeedsOnchain(true);

      clearReferralCode();
      setSubmittedProfile(payload);
      setOnchainReferralCode(referralCode || null);
      setPendingOnchainSubmission({ ...payload });
      setStage('ONCHAIN');
      setIsSubmitting(false);
    },
    [
      user,
      setUser,
      setNeedsOnboarding,
      setNeedsOnchain,
      getAccessToken,
      smartWalletAddress,
    ]
  );

  const handleRetryOnchain = useCallback(async () => {
    if (!submittedProfile) return;
    setError(null);

    setOnchainReferralCode((prev) => prev ?? getReferralCode());
    setPendingOnchainSubmission({ ...submittedProfile });
  }, [submittedProfile]);

  const handleSkipOnchain = useCallback(() => {
    logger.info(
      'User skipped onchain registration',
      { userId: user?.id },
      'OnboardingProvider'
    );
    setNeedsOnchain(false);
    setUserDismissed(true);
    setStage('PROFILE');
    setSubmittedProfile(null);
    setError(null);
    setImportedProfileData(null);
    setPendingOnchainSubmission(null);
    setOnchainReferralCode(null);
  }, [user, setNeedsOnchain]);

  const handleClose = useCallback(() => {
    logger.info(
      'User closed onboarding modal',
      {
        stage,
        needsOnboarding,
        needsOnchain,
        userRegistered: user?.onChainRegistered,
      },
      'OnboardingProvider'
    );

    setUserDismissed(true);
    setStage('PROFILE');
    setSubmittedProfile(null);
    setError(null);
    setImportedProfileData(null);
    setHasProgressedPastSocialImport(false);
    setPendingOnchainSubmission(null);
    setOnchainReferralCode(null);

    // Clear onboarding flags so modal doesn't keep reappearing
    setNeedsOnboarding(false);
    setNeedsOnchain(false);
  }, [
    stage,
    needsOnboarding,
    needsOnchain,
    user,
    setNeedsOnboarding,
    setNeedsOnchain,
  ]);

  return (
    <>
      {children}
      {shouldShowModal && (
        <OnboardingModal
          isOpen
          stage={stage}
          isSubmitting={isSubmitting}
          error={error}
          isWalletReady={Boolean(smartWalletReady && smartWalletAddress)}
          onSubmitProfile={handleProfileSubmit}
          onRetryOnchain={handleRetryOnchain}
          onSkipOnchain={handleSkipOnchain}
          onClose={handleClose}
          onLogout={logout}
          user={user}
          importedData={importedProfileData}
          initialEmail={user?.email || null}
        />
      )}
    </>
  );
}
