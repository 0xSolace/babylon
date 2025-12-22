'use client';

import { logger, signInWithFarcaster } from '@babylon/shared';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface UseSocialVerificationOptions {
  authenticated: boolean;
  userId: string | undefined;
  hasFarcaster: boolean | undefined;
  hasTwitter: boolean | undefined;
  hasDiscord: boolean | undefined;
  pointsAwardedForFarcasterFollow: boolean | undefined;
  pointsAwardedForTwitterFollow: boolean | undefined;
  pointsAwardedForDiscordJoin: boolean | undefined;
  onPointsAwarded: () => Promise<void>;
}

// Response types for API endpoints
interface LinkFarcasterResponse {
  success: boolean;
  pointsAwarded: number;
  error?: string;
}

interface VerifyFollowResponse {
  verified: boolean;
  message?: string;
  points?: {
    awarded: number;
  };
}

interface FarcasterSignInResult {
  message: string;
  signature: string;
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  state: string;
}

interface UseSocialVerificationReturn {
  // Farcaster
  hasFarcasterFollow: boolean;
  isVerifyingFollow: boolean;
  showVerifyFollowButton: boolean;
  handleFarcasterOAuth: () => Promise<void>;
  handleFarcasterFollow: () => void;
  handleVerifyFollow: () => Promise<void>;
  // Twitter
  hasTwitterFollow: boolean;
  isVerifyingTwitterFollow: boolean;
  showVerifyTwitterFollowButton: boolean;
  handleTwitterOAuth: () => void;
  handleTwitterFollow: () => void;
  handleVerifyTwitterFollow: () => Promise<void>;
  // Discord
  hasDiscordJoin: boolean;
  isVerifyingDiscordJoin: boolean;
  showVerifyDiscordJoinButton: boolean;
  handleDiscordOAuth: () => void;
  handleDiscordJoin: () => void;
  handleVerifyDiscordJoin: () => Promise<void>;
}

export function useSocialVerification({
  authenticated,
  userId,
  hasFarcaster,
  hasTwitter,
  hasDiscord,
  pointsAwardedForFarcasterFollow,
  pointsAwardedForTwitterFollow,
  pointsAwardedForDiscordJoin,
  onPointsAwarded,
}: UseSocialVerificationOptions): UseSocialVerificationReturn {
  const { getAccessToken, refresh } = useAuth();

  // UI state for showing verify buttons
  const [showVerifyFollowButton, setShowVerifyFollowButton] = useState(false);
  const [showVerifyTwitterFollowButton, setShowVerifyTwitterFollowButton] =
    useState(false);
  const [showVerifyDiscordJoinButton, setShowVerifyDiscordJoinButton] =
    useState(false);

  // Track verified status locally (derived from mutations or props)
  const [hasFarcasterFollow, setHasFarcasterFollow] = useState(false);
  const [hasTwitterFollow, setHasTwitterFollow] = useState(false);
  const [hasDiscordJoin, setHasDiscordJoin] = useState(false);

  // Sync props to local state on mount/prop changes
  useEffect(() => {
    if (!authenticated || !userId) return;

    if (pointsAwardedForFarcasterFollow) {
      setHasFarcasterFollow(true);
    }

    if (pointsAwardedForTwitterFollow) {
      setHasTwitterFollow(true);
    }

    if (pointsAwardedForDiscordJoin) {
      setHasDiscordJoin(true);
    }
  }, [
    authenticated,
    userId,
    pointsAwardedForFarcasterFollow,
    pointsAwardedForTwitterFollow,
    pointsAwardedForDiscordJoin,
  ]);

  // Mutation: Link Farcaster account
  const linkFarcasterMutation = useMutation({
    mutationFn: async (result: FarcasterSignInResult) => {
      const token = await getAccessToken();
      const response = await fetch(
        `/api/users/${encodeURIComponent(userId!)}/link-farcaster`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: result.message,
            signature: result.signature,
            fid: result.fid,
            username: result.username,
            displayName: result.displayName,
            pfpUrl: result.pfpUrl,
            state: result.state,
          }),
        }
      );

      const data = (await response.json()) as LinkFarcasterResponse;

      if (!response.ok) {
        const errorMessage = data.error || 'Failed to link Farcaster account';
        if (response.status === 409) {
          throw new Error(
            errorMessage.includes('already linked')
              ? errorMessage
              : 'This Farcaster account is already linked to another user'
          );
        }
        throw new Error(errorMessage);
      }

      return data;
    },
    onSuccess: async (data) => {
      await refresh();
      await onPointsAwarded();

      if (data.pointsAwarded > 0) {
        toast.success(
          `Farcaster linked! +${data.pointsAwarded} points awarded`
        );
      } else {
        toast.success('Farcaster account linked successfully!');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation: Verify Farcaster follow
  const verifyFarcasterFollowMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const response = await fetch(
        `/api/users/${encodeURIComponent(userId!)}/verify-farcaster-follow`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const data = (await response.json()) as VerifyFollowResponse;

      if (!response.ok || !data.verified) {
        throw new Error(
          data.message ||
            'Could not verify follow. Please make sure you followed @playbabylon on Farcaster.'
        );
      }

      return data;
    },
    onSuccess: async (data) => {
      setHasFarcasterFollow(true);
      setShowVerifyFollowButton(false);
      await onPointsAwarded();

      if (data.points?.awarded && data.points.awarded > 0) {
        toast.success(
          `Follow verified! +${data.points.awarded} points awarded`
        );
      } else {
        toast.success(
          'Follow verified! You already received points for this action.'
        );
      }
    },
    onError: (error: Error) => {
      logger.error(
        'Error verifying Farcaster follow',
        { error: error.message, userId },
        'useSocialVerification'
      );
      toast.error(error.message);
    },
  });

  // Mutation: Verify Twitter follow
  const verifyTwitterFollowMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const response = await fetch(
        `/api/users/${encodeURIComponent(userId!)}/verify-twitter-follow`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const data = (await response.json()) as VerifyFollowResponse;

      if (!response.ok || !data.verified) {
        throw new Error(
          data.message || 'Could not claim reward. Please try again.'
        );
      }

      return data;
    },
    onSuccess: async (data) => {
      setHasTwitterFollow(true);
      setShowVerifyTwitterFollowButton(false);
      await onPointsAwarded();

      if (data.points?.awarded && data.points.awarded > 0) {
        toast.success(
          `Thank you for following! +${data.points.awarded} points awarded`
        );
      } else {
        toast.success('You already received points for this action.');
      }
    },
    onError: (error: Error) => {
      logger.error(
        'Error claiming Twitter follow reward',
        { error: error.message, userId },
        'useSocialVerification'
      );
      toast.error(error.message);
    },
  });

  // Mutation: Verify Discord join
  const verifyDiscordJoinMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const response = await fetch(
        `/api/users/${encodeURIComponent(userId!)}/verify-discord-join`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const data = (await response.json()) as VerifyFollowResponse;

      if (!response.ok || !data.verified) {
        throw new Error(
          data.message ||
            'Could not verify membership. Please make sure you joined the Babylon Discord server.'
        );
      }

      return data;
    },
    onSuccess: async (data) => {
      setHasDiscordJoin(true);
      setShowVerifyDiscordJoinButton(false);
      await onPointsAwarded();

      if (data.points?.awarded && data.points.awarded > 0) {
        toast.success(
          `Discord membership verified! +${data.points.awarded} points awarded`
        );
      } else {
        toast.success(
          'Membership verified! You already received points for this action.'
        );
      }
    },
    onError: (error: Error) => {
      logger.error(
        'Error verifying Discord join',
        { error: error.message, userId },
        'useSocialVerification'
      );
      toast.error(error.message);
    },
  });

  // OAuth handlers
  const handleTwitterOAuth = useCallback(() => {
    if (!userId) {
      toast.error('Please complete your profile first');
      logger.warn(
        'Twitter OAuth attempted without user ID',
        {},
        'useSocialVerification'
      );
      return;
    }

    sessionStorage.setItem('oauth_return_url', window.location.pathname);
    window.location.href = '/api/auth/twitter/initiate';
  }, [userId]);

  const handleDiscordOAuth = useCallback(() => {
    if (!userId) {
      toast.error('Please complete your profile first');
      logger.warn(
        'Discord OAuth attempted without user ID',
        {},
        'useSocialVerification'
      );
      return;
    }

    sessionStorage.setItem('oauth_return_url', window.location.pathname);
    window.location.href = '/api/auth/discord/initiate';
  }, [userId]);

  const handleFarcasterOAuth = useCallback(async () => {
    if (!userId) {
      toast.error('Please complete your profile first');
      logger.warn(
        'Farcaster OAuth attempted without user ID',
        {},
        'useSocialVerification'
      );
      return;
    }

    try {
      const result = await signInWithFarcaster({
        userId,
        onStatusUpdate: (status) => {
          logger.debug(
            'Farcaster auth status',
            { status },
            'useSocialVerification'
          );
        },
      });

      await linkFarcasterMutation.mutateAsync(result as FarcasterSignInResult);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage === 'Authentication cancelled') {
        logger.info(
          'Farcaster auth cancelled by user',
          { userId },
          'useSocialVerification'
        );
        return;
      }

      if (errorMessage.includes('popup')) {
        toast.error('Please allow popups to connect Farcaster');
        logger.warn(
          'Farcaster popup blocked',
          { userId },
          'useSocialVerification'
        );
        return;
      }

      logger.error(
        'Error during Farcaster authentication',
        { error: errorMessage, userId },
        'useSocialVerification'
      );
      toast.error('Failed to connect Farcaster. Please try again.');
    }
  }, [userId, linkFarcasterMutation]);

  // Farcaster follow handlers
  const handleFarcasterFollow = useCallback(() => {
    if (!userId) {
      toast.error('Please complete your profile first');
      logger.warn(
        'Farcaster follow link clicked without user ID',
        {},
        'useSocialVerification'
      );
      return;
    }

    if (!hasFarcaster) {
      toast.error('Please link your Farcaster account first');
      return;
    }

    window.open('https://warpcast.com/playbabylon', '_blank');
    setShowVerifyFollowButton(true);
    toast.success('After following, click the "Verify Follow" button below!');
  }, [userId, hasFarcaster]);

  const handleVerifyFollow = useCallback(async () => {
    if (!userId) return;
    await verifyFarcasterFollowMutation.mutateAsync();
  }, [userId, verifyFarcasterFollowMutation]);

  // Twitter follow handlers
  const handleTwitterFollow = useCallback(() => {
    if (!userId) {
      toast.error('Please complete your profile first');
      logger.warn(
        'Twitter follow link clicked without user ID',
        {},
        'useSocialVerification'
      );
      return;
    }

    if (!hasTwitter) {
      toast.error('Please link your Twitter account first');
      return;
    }

    window.open(
      'https://x.com/intent/follow?screen_name=PlayBabylon',
      '_blank'
    );
    setShowVerifyTwitterFollowButton(true);
    toast.success('After following, click the "Claim Reward" button below!');
  }, [userId, hasTwitter]);

  const handleVerifyTwitterFollow = useCallback(async () => {
    if (!userId) return;
    await verifyTwitterFollowMutation.mutateAsync();
  }, [userId, verifyTwitterFollowMutation]);

  // Discord join handlers
  const handleDiscordJoin = useCallback(() => {
    if (!userId) {
      toast.error('Please complete your profile first');
      logger.warn(
        'Discord join link clicked without user ID',
        {},
        'useSocialVerification'
      );
      return;
    }

    if (!hasDiscord) {
      toast.error('Please link your Discord account first');
      return;
    }

    const discordInviteUrl =
      process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ||
      'https://discord.gg/4DYsFgyp';
    window.open(discordInviteUrl, '_blank');
    setShowVerifyDiscordJoinButton(true);
    toast.success('After joining, click the "Verify Join" button below!');
  }, [userId, hasDiscord]);

  const handleVerifyDiscordJoin = useCallback(async () => {
    if (!userId) return;
    await verifyDiscordJoinMutation.mutateAsync();
  }, [userId, verifyDiscordJoinMutation]);

  return {
    // Farcaster
    hasFarcasterFollow,
    isVerifyingFollow: verifyFarcasterFollowMutation.isPending,
    showVerifyFollowButton,
    handleFarcasterOAuth,
    handleFarcasterFollow,
    handleVerifyFollow,
    // Twitter
    hasTwitterFollow,
    isVerifyingTwitterFollow: verifyTwitterFollowMutation.isPending,
    showVerifyTwitterFollowButton,
    handleTwitterOAuth,
    handleTwitterFollow,
    handleVerifyTwitterFollow,
    // Discord
    hasDiscordJoin,
    isVerifyingDiscordJoin: verifyDiscordJoinMutation.isPending,
    showVerifyDiscordJoinButton,
    handleDiscordOAuth,
    handleDiscordJoin,
    handleVerifyDiscordJoin,
  };
}
