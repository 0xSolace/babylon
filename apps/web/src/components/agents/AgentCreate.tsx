/**
 * Agent Create Component
 *
 * @description Single-page form for creating a new agent.
 * All sections (profile, prompts, settings) on one scrollable page.
 */

'use client';

import { cn } from '@babylon/shared';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Upload,
  Wallet,
  X as XIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AgentConfigForm,
  type AgentSettingsData,
  AgentSettingsStep,
} from '@/app/agents/create/components';
import { useAgentForm } from '@/app/agents/create/hooks';
import { useAgentUsernameCheck } from '@/app/agents/create/hooks/useAgentUsernameCheck';
import { Skeleton } from '@/components/shared/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { uploadImage, validateImageFile } from '@/utils/upload-image';

const TOTAL_PROFILE_PICTURES = 100;
const TOTAL_BANNERS = 100;
const DEFAULT_MAX_DEPOSIT = 10000;
const MAX_BIO_LENGTH = 160;

/** Agent data returned on successful creation */
interface AgentCreateResult {
  id: string;
  username?: string;
  displayName?: string | null;
  profileImageUrl?: string | null;
  modelTier?: 'free' | 'pro';
  virtualBalance?: number;
}

interface AgentCreateProps {
  /** Called when back is pressed */
  onBack?: () => void;
  /** Called when agent is successfully created */
  onSuccess?: (agent: AgentCreateResult) => void;
}

/**
 * Agent Create Component
 *
 * Single scrollable page for creating a new agent.
 */
export function AgentCreate({ onBack, onSuccess }: AgentCreateProps) {
  const { authenticated, getAccessToken, user: authUser } = useAuth();

  const { balance, loading: balanceLoading } = useWalletBalance(authUser?.id, {
    enabled: authenticated,
  });

  const [isCreating, setIsCreating] = useState(false);

  // Settings state
  const [settingsData, setSettingsData] = useState<AgentSettingsData>({
    modelTier: 'pro',
    autonomousEnabled: true,
    autonomousPosting: true,
    autonomousCommenting: true,
    autonomousDMs: true,
    autonomousGroupChats: true,
    a2aEnabled: true,
  });

  const {
    profileData,
    agentData,
    isInitialized,
    generatingField,
    updateAgentField,
    regenerateField,
    clearDraft,
  } = useAgentForm();

  // User balance for max deposit
  const maxDeposit = Math.max(
    100,
    Math.min(balance || DEFAULT_MAX_DEPOSIT, DEFAULT_MAX_DEPOSIT)
  );

  // --- Profile image state ---
  const bioInitialized = useRef(false);
  const [localProfileData, setLocalProfileData] = useState({
    username: profileData.username,
    displayName: profileData.displayName,
    bio: profileData.bio,
  });

  // Sync from hook when template loads
  useEffect(() => {
    setLocalProfileData({
      username: profileData.username,
      displayName: profileData.displayName,
      bio: profileData.bio,
    });
  }, [profileData.username, profileData.displayName, profileData.bio]);

  useEffect(() => {
    if (profileData.bio && !bioInitialized.current) {
      setLocalProfileData((prev) => ({
        ...prev,
        bio: profileData.bio.slice(0, MAX_BIO_LENGTH),
      }));
      bioInitialized.current = true;
    }
  }, [profileData.bio]);

  const { usernameStatus, usernameSuggestion, isCheckingUsername, retryCheck } =
    useAgentUsernameCheck(localProfileData.username);

  const [uploadedProfileFile, setUploadedProfileFile] = useState<File | null>(
    null
  );
  const [uploadedBannerFile, setUploadedBannerFile] = useState<File | null>(
    null
  );
  const [profilePictureIndex, setProfilePictureIndex] = useState(() => {
    const match = profileData.profileImageUrl?.match(/profile-(\d+)\.jpg/);
    return match?.[1] ? parseInt(match[1], 10) : 1;
  });
  const [bannerIndex, setBannerIndex] = useState(() => {
    const match = profileData.coverImageUrl?.match(/banner-(\d+)\.jpg/);
    return match?.[1] ? parseInt(match[1], 10) : 1;
  });
  const [uploadedProfileImage, setUploadedProfileImage] = useState<
    string | null
  >(
    profileData.profileImageUrl?.startsWith('/assets/')
      ? null
      : profileData.profileImageUrl || null
  );
  const [uploadedBanner, setUploadedBanner] = useState<string | null>(
    profileData.coverImageUrl?.startsWith('/assets/')
      ? null
      : profileData.coverImageUrl || null
  );

  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const currentProfileImage = useMemo(() => {
    return (
      uploadedProfileImage ||
      `/assets/user-profiles/profile-${profilePictureIndex}.jpg`
    );
  }, [uploadedProfileImage, profilePictureIndex]);

  const currentBanner = useMemo(() => {
    return uploadedBanner || `/assets/user-banners/banner-${bannerIndex}.jpg`;
  }, [uploadedBanner, bannerIndex]);

  const cycleProfilePicture = useCallback((direction: 'next' | 'prev') => {
    setUploadedProfileImage(null);
    setUploadedProfileFile(null);
    setProfilePictureIndex((prev) => {
      if (direction === 'next') {
        return prev >= TOTAL_PROFILE_PICTURES ? 1 : prev + 1;
      }
      return prev <= 1 ? TOTAL_PROFILE_PICTURES : prev - 1;
    });
  }, []);

  const cycleBanner = useCallback((direction: 'next' | 'prev') => {
    setUploadedBanner(null);
    setUploadedBannerFile(null);
    setBannerIndex((prev) => {
      if (direction === 'next') {
        return prev >= TOTAL_BANNERS ? 1 : prev + 1;
      }
      return prev <= 1 ? TOTAL_BANNERS : prev - 1;
    });
  }, []);

  const handleProfileImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const validationError = validateImageFile(file);
      if (validationError) {
        toast.error(validationError);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedProfileFile(file);
        setUploadedProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleBannerUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const validationError = validateImageFile(file);
      if (validationError) {
        toast.error(validationError);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedBannerFile(file);
        setUploadedBanner(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleUseSuggestion = useCallback(() => {
    if (usernameSuggestion) {
      setLocalProfileData((prev) => ({
        ...prev,
        username: usernameSuggestion,
      }));
    }
  }, [usernameSuggestion]);

  // Handle agent creation
  const handleCreate = useCallback(async () => {
    // Validate profile
    if (
      !localProfileData.username.trim() ||
      localProfileData.username.length < 3
    ) {
      toast.error('Username must be at least 3 characters');
      return;
    }
    if (usernameStatus !== 'available') {
      toast.error('Please choose an available username');
      return;
    }
    if (!localProfileData.displayName.trim()) {
      toast.error('Display name is required');
      return;
    }
    if (!agentData.system.trim()) {
      toast.error('System prompt is required');
      return;
    }

    setIsCreating(true);

    // Upload images if needed
    let profileImageUrl = currentProfileImage;
    let coverImageUrl = currentBanner;

    if (uploadedProfileFile) {
      try {
        profileImageUrl = await uploadImage(uploadedProfileFile, 'profile');
      } catch {
        toast.error('Failed to upload profile image');
        setIsCreating(false);
        return;
      }
    }

    if (uploadedBannerFile) {
      try {
        coverImageUrl = await uploadImage(uploadedBannerFile, 'cover');
      } catch {
        toast.error('Failed to upload cover image');
        setIsCreating(false);
        return;
      }
    }

    const token = await getAccessToken();
    if (!token) {
      toast.error('Please sign in to create an agent');
      setIsCreating(false);
      return;
    }

    const bioArray = agentData.personality.split('\n').filter((b) => b.trim());
    const systemPrompt = agentData.tradingStrategy.trim()
      ? `${agentData.system}\n\nTrading Strategy: ${agentData.tradingStrategy}`
      : agentData.system;

    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: localProfileData.displayName,
        username: localProfileData.username,
        description: localProfileData.bio,
        profileImageUrl,
        coverImageUrl,
        system: systemPrompt,
        bio: bioArray,
        personality: agentData.personality,
        tradingStrategy: agentData.tradingStrategy,
        initialDeposit: agentData.initialDeposit,
        modelTier: settingsData.modelTier,
        autonomousEnabled: settingsData.autonomousEnabled,
        autonomousPosting: settingsData.autonomousPosting,
        autonomousCommenting: settingsData.autonomousCommenting,
        autonomousDMs: settingsData.autonomousDMs,
        autonomousGroupChats: settingsData.autonomousGroupChats,
        a2aEnabled: settingsData.a2aEnabled,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      toast.error(errorData.error || 'Failed to create agent');
      setIsCreating(false);
      return;
    }

    const result = await response.json();
    const agentId = result.agent.id;

    clearDraft();
    toast.success('Agent created successfully!');

    onSuccess?.({
      id: agentId,
      username: localProfileData.username,
      displayName: localProfileData.displayName || null,
      profileImageUrl: profileImageUrl || null,
      modelTier: settingsData.modelTier,
      virtualBalance: agentData.initialDeposit,
    });
  }, [
    localProfileData,
    usernameStatus,
    agentData,
    settingsData,
    currentProfileImage,
    currentBanner,
    uploadedProfileFile,
    uploadedBannerFile,
    getAccessToken,
    clearDraft,
    onSuccess,
  ]);

  const isCreateDisabled =
    isCreating ||
    !localProfileData.displayName.trim() ||
    !localProfileData.username.trim() ||
    localProfileData.username.length < 3 ||
    usernameStatus !== 'available' ||
    isCheckingUsername ||
    !agentData.system.trim();

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-border border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="-ml-1 flex shrink-0 items-center gap-0.5 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <h2 className="font-bold text-lg">Create Agent</h2>
        </div>
      </div>

      {/* Content - single scrollable area */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* ===== PROFILE SECTION ===== */}
          <section>
            {/* Banner + Avatar */}
            <div className="relative mb-14 sm:mb-16">
              <div className="group relative h-24 overflow-hidden rounded-lg bg-muted sm:h-32">
                <img
                  src={currentBanner}
                  alt="Profile banner"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => cycleBanner('prev')}
                    className="rounded-full bg-background/90 p-1.5 hover:bg-background sm:p-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <label className="cursor-pointer rounded-full bg-background/90 p-1.5 hover:bg-background sm:p-2">
                    <Upload className="h-4 w-4" />
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => cycleBanner('next')}
                    className="rounded-full bg-background/90 p-1.5 hover:bg-background sm:p-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="absolute -bottom-12 left-3 sm:-bottom-14 sm:left-4">
                <div className="group relative h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-muted sm:h-28 sm:w-28">
                  <img
                    src={currentProfileImage}
                    alt="Profile picture"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => cycleProfilePicture('prev')}
                      className="rounded-full bg-background/90 p-1 hover:bg-background sm:p-1.5"
                    >
                      <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                    </button>
                    <label className="cursor-pointer rounded-full bg-background/90 p-1 hover:bg-background sm:p-1.5">
                      <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                      <input
                        ref={profileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => cycleProfilePicture('next')}
                      className="rounded-full bg-background/90 p-1 hover:bg-background sm:p-1.5"
                    >
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <p className="mb-4 text-muted-foreground text-xs">
              Tap images to browse or upload custom. Max 5MB, JPG/PNG/GIF/WebP.
            </p>

            {/* Profile form fields */}
            <div className="space-y-5">
              {/* Username */}
              <div>
                <label
                  htmlFor="edit-username"
                  className="mb-2 block font-medium text-sm"
                >
                  Username *
                </label>
                <div
                  className={cn(
                    'flex items-center rounded-lg border bg-muted focus-within:ring-2 focus-within:ring-[#0066FF]',
                    usernameStatus === 'taken' && 'border-red-500',
                    usernameStatus === 'error' && 'border-yellow-500',
                    usernameStatus === 'available' && 'border-green-500',
                    !usernameStatus && 'border-border'
                  )}
                >
                  <span className="px-4 text-muted-foreground">@</span>
                  <input
                    id="edit-username"
                    type="text"
                    value={localProfileData.username}
                    onChange={(e) =>
                      setLocalProfileData((prev) => ({
                        ...prev,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, ''),
                      }))
                    }
                    maxLength={20}
                    className="w-full bg-transparent py-3 pr-10 focus:outline-none"
                    placeholder="agent_username"
                    aria-invalid={
                      usernameStatus === 'taken' || usernameStatus === 'error'
                    }
                    aria-describedby="username-status username-help"
                  />
                  <div className="pr-3">
                    {isCheckingUsername && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {!isCheckingUsername && usernameStatus === 'available' && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {!isCheckingUsername && usernameStatus === 'taken' && (
                      <XIcon className="h-4 w-4 text-red-500" />
                    )}
                    {!isCheckingUsername && usernameStatus === 'error' && (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
                {usernameStatus === 'taken' && usernameSuggestion && (
                  <p className="mt-1.5 text-muted-foreground text-xs">
                    Username taken. Try:{' '}
                    <button
                      type="button"
                      onClick={handleUseSuggestion}
                      className="text-primary underline hover:text-primary/80"
                    >
                      {usernameSuggestion}
                    </button>
                  </p>
                )}
                {usernameStatus === 'error' && (
                  <p className="mt-1.5 text-xs text-yellow-600">
                    Failed to check username.{' '}
                    <button
                      type="button"
                      onClick={retryCheck}
                      className="underline hover:text-yellow-500"
                    >
                      Retry
                    </button>
                  </p>
                )}
                {localProfileData.username &&
                  localProfileData.username.length < 3 && (
                    <p
                      id="username-status"
                      className="mt-1.5 text-red-500 text-xs"
                    >
                      Username must be at least 3 characters
                    </p>
                  )}
                <p
                  id="username-help"
                  className="mt-1.5 text-muted-foreground text-xs"
                >
                  3-20 characters. Letters, numbers, and underscores only.
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label
                  htmlFor="edit-displayName"
                  className="mb-2 block font-medium text-sm"
                >
                  Display Name *
                </label>
                <input
                  id="edit-displayName"
                  type="text"
                  value={localProfileData.displayName}
                  onChange={(e) =>
                    setLocalProfileData((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                    }))
                  }
                  className={cn(
                    'w-full rounded-lg border border-border bg-muted px-4 py-3',
                    'focus:outline-none focus:ring-2 focus:ring-[#0066FF]'
                  )}
                  placeholder="My Awesome Agent"
                />
              </div>

              {/* Bio */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="edit-bio"
                    className="block font-medium text-sm"
                  >
                    Bio
                  </label>
                  <span className="text-muted-foreground text-xs">
                    {localProfileData.bio?.length ?? 0}/{MAX_BIO_LENGTH}
                  </span>
                </div>
                <textarea
                  id="edit-bio"
                  value={localProfileData.bio ?? ''}
                  onChange={(e) =>
                    setLocalProfileData((prev) => ({
                      ...prev,
                      bio: e.target.value,
                    }))
                  }
                  maxLength={MAX_BIO_LENGTH}
                  rows={3}
                  aria-describedby="bio-help"
                  className={cn(
                    'w-full resize-none rounded-lg border border-border bg-muted px-4 py-3',
                    'focus:outline-none focus:ring-2 focus:ring-[#0066FF]'
                  )}
                  placeholder="A short description of your agent..."
                />
                <p
                  id="bio-help"
                  className="mt-1.5 text-muted-foreground text-xs"
                >
                  This will appear on your agent's profile.
                </p>
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="border-border border-t" />

          {/* ===== PROMPTS SECTION ===== */}
          <section>
            <h3 className="mb-4 font-bold text-base">Configure Prompts</h3>
            {isInitialized ? (
              <AgentConfigForm
                agentData={agentData}
                generatingField={generatingField}
                maxDeposit={maxDeposit}
                onFieldChange={updateAgentField}
                onRegenerate={regenerateField}
              />
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-32 w-full" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-24 w-full" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-6 w-36" />
                  <Skeleton className="h-28 w-full" />
                </div>
              </div>
            )}

            {/* Balance Info */}
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Funding</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Initial Deposit</span>
                  <span className="font-medium font-mono">
                    {agentData.initialDeposit.toLocaleString()} pts
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Balance</span>
                  <span className="font-medium font-mono">
                    {balanceLoading ? '...' : balance.toLocaleString()} pts
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="border-border border-t" />

          {/* ===== SETTINGS SECTION ===== */}
          <section>
            <h3 className="mb-4 font-bold text-base">Agent Settings</h3>
            <AgentSettingsStep
              settings={settingsData}
              onSettingsChange={setSettingsData}
            />
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-border border-t px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-3xl gap-3">
          {onBack && (
            <button
              onClick={onBack}
              disabled={isCreating}
              className={cn(
                'flex-1 rounded-lg border border-border px-4 py-2.5 font-medium transition-colors sm:py-3',
                'text-muted-foreground hover:bg-muted hover:text-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              Back
            </button>
          )}
          <button
            onClick={handleCreate}
            disabled={isCreateDisabled}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all sm:py-3',
              'bg-[#0066FF] text-primary-foreground hover:bg-[#2952d9]',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Create Agent'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
