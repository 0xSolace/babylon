/**
 * Agent Create Component
 *
 * @description Three-step agent creation flow:
 *   Step 1: Profile (username, display name, bio, images) + Alignment (hat × class)
 *   Step 2: Prompts (system, personality, trading strategy) — pre-populated from template
 *   Step 3: Funding & Settings (deposit, model tier, autonomy) + Create button
 *
 * Full draft persists to localStorage so the user can come back.
 */

'use client';

import { cn } from '@babylon/shared';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Code,
  Loader2,
  MessageCircle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Upload,
  Wallet,
  X as XIcon,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AgentConfigForm,
  AgentSettingsStep,
} from '@/app/agents/create/components';
import {
  type AgentClass,
  type AgentHat,
  useAgentForm,
} from '@/app/agents/create/hooks/useAgentForm';
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
  onBack?: () => void;
  onSuccess?: (agent: AgentCreateResult) => void;
}

// --- Alignment descriptors ---

const HATS: {
  value: AgentHat;
  label: string;
  icon: typeof Shield;
  desc: string;
}[] = [
  { value: 'black', label: 'Black Hat', icon: ShieldAlert, desc: 'Chaotic' },
  { value: 'gray', label: 'Gray Hat', icon: Shield, desc: 'Pragmatic' },
  { value: 'white', label: 'White Hat', icon: ShieldCheck, desc: 'Ethical' },
];

const CLASSES: {
  value: AgentClass;
  label: string;
  icon: typeof TrendingUp;
  desc: string;
}[] = [
  { value: 'yapper', label: 'Yapper', icon: MessageCircle, desc: 'Social' },
  { value: 'trader', label: 'Trader', icon: TrendingUp, desc: 'Markets' },
  { value: 'dev', label: 'Dev', icon: Code, desc: 'Technical' },
];

export function AgentCreate({ onBack, onSuccess }: AgentCreateProps) {
  const { authenticated, getAccessToken, user: authUser } = useAuth();
  const { balance, loading: balanceLoading } = useWalletBalance(authUser?.id, {
    enabled: authenticated,
  });

  const [isCreating, setIsCreating] = useState(false);

  // All form state managed by the hook (persisted to localStorage)
  const {
    step,
    setStep,
    hat,
    setHat,
    agentClass,
    setAgentClass,
    profileData,
    updateProfileField,
    agentData,
    updateAgentField,
    settingsData,
    setSettingsData,
    isInitialized,
    generatingField,
    generateNewField,
    clearDraft,
  } = useAgentForm();

  const maxDeposit = Math.max(
    100,
    Math.min(balance || DEFAULT_MAX_DEPOSIT, DEFAULT_MAX_DEPOSIT)
  );

  // --- Local profile editing state (synced from hook) ---

  const [localUsername, setLocalUsername] = useState(profileData.username);
  const [localDisplayName, setLocalDisplayName] = useState(
    profileData.displayName
  );
  const [localBio, setLocalBio] = useState(profileData.bio);

  // Sync when hook data changes (e.g. template load updates bio)
  const lastBioFromHook = useRef(profileData.bio);
  if (profileData.bio !== lastBioFromHook.current) {
    lastBioFromHook.current = profileData.bio;
    setLocalBio(profileData.bio);
  }
  const lastUsernameFromHook = useRef(profileData.username);
  if (profileData.username !== lastUsernameFromHook.current) {
    lastUsernameFromHook.current = profileData.username;
    setLocalUsername(profileData.username);
  }
  const lastDisplayNameFromHook = useRef(profileData.displayName);
  if (profileData.displayName !== lastDisplayNameFromHook.current) {
    lastDisplayNameFromHook.current = profileData.displayName;
    setLocalDisplayName(profileData.displayName);
  }

  // Username check
  const { usernameStatus, usernameSuggestion, isCheckingUsername, retryCheck } =
    useAgentUsernameCheck(localUsername);

  // --- Image state ---

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

  const currentProfileImage = useMemo(
    () =>
      uploadedProfileImage ||
      `/assets/user-profiles/profile-${profilePictureIndex}.jpg`,
    [uploadedProfileImage, profilePictureIndex]
  );

  const currentBanner = useMemo(
    () => uploadedBanner || `/assets/user-banners/banner-${bannerIndex}.jpg`,
    [uploadedBanner, bannerIndex]
  );

  const cycleProfilePicture = useCallback((direction: 'next' | 'prev') => {
    setUploadedProfileImage(null);
    setUploadedProfileFile(null);
    setProfilePictureIndex((prev) =>
      direction === 'next'
        ? prev >= TOTAL_PROFILE_PICTURES
          ? 1
          : prev + 1
        : prev <= 1
          ? TOTAL_PROFILE_PICTURES
          : prev - 1
    );
  }, []);

  const cycleBanner = useCallback((direction: 'next' | 'prev') => {
    setUploadedBanner(null);
    setUploadedBannerFile(null);
    setBannerIndex((prev) =>
      direction === 'next'
        ? prev >= TOTAL_BANNERS
          ? 1
          : prev + 1
        : prev <= 1
          ? TOTAL_BANNERS
          : prev - 1
    );
  }, []);

  const handleProfileImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const err = validateImageFile(file);
      if (err) {
        toast.error(err);
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
      const err = validateImageFile(file);
      if (err) {
        toast.error(err);
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

  // --- Step navigation ---

  const goToStep2 = useCallback(() => {
    if (!localUsername.trim() || localUsername.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }
    if (usernameStatus !== 'available') {
      toast.error('Please choose an available username');
      return;
    }
    if (!localDisplayName.trim()) {
      toast.error('Display name is required');
      return;
    }

    // Flush local state to hook
    updateProfileField('username', localUsername);
    updateProfileField('displayName', localDisplayName);
    updateProfileField('bio', localBio);
    updateProfileField('profileImageUrl', currentProfileImage);
    updateProfileField('coverImageUrl', currentBanner);

    setStep(2);
  }, [
    localUsername,
    localDisplayName,
    localBio,
    usernameStatus,
    currentProfileImage,
    currentBanner,
    updateProfileField,
    setStep,
  ]);

  const goToStep3 = useCallback(() => {
    if (!agentData.system.trim()) {
      toast.error('System prompt is required');
      return;
    }
    setStep(3);
  }, [agentData.system, setStep]);

  // --- Create agent ---

  const handleCreate = useCallback(async () => {
    if (!localDisplayName.trim()) {
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
        name: localDisplayName,
        username: localUsername,
        description: localBio,
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
    clearDraft();
    toast.success('Agent created successfully!');

    onSuccess?.({
      id: result.agent.id,
      username: localUsername,
      displayName: localDisplayName || null,
      profileImageUrl: profileImageUrl || null,
      modelTier: settingsData.modelTier,
      virtualBalance: agentData.initialDeposit,
    });
  }, [
    localDisplayName,
    localUsername,
    localBio,
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

  // --- Derived ---

  const isStep1Valid =
    localDisplayName.trim().length > 0 &&
    localUsername.trim().length >= 3 &&
    usernameStatus === 'available' &&
    !isCheckingUsername;

  const stepTitle =
    step === 1
      ? 'Create Agent'
      : step === 2
        ? 'Configure Prompts'
        : 'Funding & Settings';

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-border border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (step === 1) {
                onBack?.();
              } else {
                setStep((step - 1) as 1 | 2);
              }
            }}
            className="-ml-1 flex shrink-0 items-center gap-0.5 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="font-bold text-lg">{stepTitle}</h2>
          <span className="text-muted-foreground text-sm">
            Step {step} of 3
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
          {step === 1 && (
            <StepOne
              // Images
              currentBanner={currentBanner}
              currentProfileImage={currentProfileImage}
              cycleBanner={cycleBanner}
              cycleProfilePicture={cycleProfilePicture}
              handleBannerUpload={handleBannerUpload}
              handleProfileImageUpload={handleProfileImageUpload}
              coverInputRef={coverInputRef}
              profileInputRef={profileInputRef}
              // Profile fields
              username={localUsername}
              displayName={localDisplayName}
              bio={localBio}
              onUsernameChange={setLocalUsername}
              onDisplayNameChange={setLocalDisplayName}
              onBioChange={setLocalBio}
              usernameStatus={usernameStatus}
              usernameSuggestion={usernameSuggestion}
              isCheckingUsername={isCheckingUsername}
              retryCheck={retryCheck}
              // Alignment
              hat={hat}
              agentClass={agentClass}
              onHatChange={setHat}
              onClassChange={setAgentClass}
            />
          )}

          {step === 2 && (
            <>
              {isInitialized ? (
                <AgentConfigForm
                  agentData={agentData}
                  generatingField={generatingField}
                  maxDeposit={maxDeposit}
                  onFieldChange={updateAgentField}
                  onRegenerate={generateNewField}
                />
              ) : (
                <div className="space-y-6">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-6 w-36" />
                  <Skeleton className="h-36 w-full" />
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <div className="space-y-6">
              {/* Funding */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Funding</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label
                        htmlFor="initialDeposit"
                        className="font-medium text-sm"
                      >
                        Initial Deposit
                      </label>
                      <span className="font-mono text-muted-foreground text-sm">
                        {agentData.initialDeposit.toLocaleString()} pts
                      </span>
                    </div>
                    <input
                      id="initialDeposit"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={
                        agentData.initialDeposit === 0
                          ? ''
                          : agentData.initialDeposit
                      }
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        updateAgentField(
                          'initialDeposit',
                          raw === '' ? 0 : parseInt(raw, 10)
                        );
                      }}
                      onBlur={() => {
                        const val = agentData.initialDeposit;
                        if (val < 10) updateAgentField('initialDeposit', 10);
                        else if (val > maxDeposit)
                          updateAgentField('initialDeposit', maxDeposit);
                      }}
                      className={cn(
                        'w-full rounded-lg border border-border bg-muted px-4 py-3 font-mono text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-[#0066FF]'
                      )}
                    />
                    <p className="mt-1 text-muted-foreground text-xs">
                      Points to fund your agent (10 -{' '}
                      {maxDeposit.toLocaleString()}).
                    </p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Your Balance</span>
                    <span className="font-medium font-mono">
                      {balanceLoading ? '...' : balance.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <AgentSettingsStep
                settings={settingsData}
                onSettingsChange={setSettingsData}
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-border border-t px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-2xl gap-3">
          <button
            onClick={() => {
              if (step === 1) onBack?.();
              else setStep((step - 1) as 1 | 2);
            }}
            disabled={isCreating}
            className={cn(
              'flex-1 rounded-lg border border-border px-4 py-2.5 font-medium transition-colors sm:py-3',
              'text-muted-foreground hover:bg-muted hover:text-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            Back
          </button>

          {step < 3 ? (
            <button
              onClick={step === 1 ? goToStep2 : goToStep3}
              disabled={step === 1 ? !isStep1Valid : !isInitialized}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all sm:py-3',
                'bg-[#0066FF] text-primary-foreground hover:bg-[#2952d9]',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isCreating}
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
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Step 1: Profile + Alignment
// =====================================================================

interface StepOneProps {
  // Images
  currentBanner: string;
  currentProfileImage: string;
  cycleBanner: (dir: 'next' | 'prev') => void;
  cycleProfilePicture: (dir: 'next' | 'prev') => void;
  handleBannerUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleProfileImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  coverInputRef: React.RefObject<HTMLInputElement | null>;
  profileInputRef: React.RefObject<HTMLInputElement | null>;
  // Profile
  username: string;
  displayName: string;
  bio: string;
  onUsernameChange: (v: string) => void;
  onDisplayNameChange: (v: string) => void;
  onBioChange: (v: string) => void;
  usernameStatus: 'available' | 'taken' | 'checking' | 'error' | null;
  usernameSuggestion: string | null;
  isCheckingUsername: boolean;
  retryCheck: () => void;
  // Alignment
  hat: AgentHat;
  agentClass: AgentClass;
  onHatChange: (h: AgentHat) => void;
  onClassChange: (c: AgentClass) => void;
}

function StepOne({
  currentBanner,
  currentProfileImage,
  cycleBanner,
  cycleProfilePicture,
  handleBannerUpload,
  handleProfileImageUpload,
  coverInputRef,
  profileInputRef,
  username,
  displayName,
  bio,
  onUsernameChange,
  onDisplayNameChange,
  onBioChange,
  usernameStatus,
  usernameSuggestion,
  isCheckingUsername,
  retryCheck,
  hat,
  agentClass,
  onHatChange,
  onClassChange,
}: StepOneProps) {
  return (
    <div className="space-y-6">
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

      <p className="text-muted-foreground text-xs">
        Tap images to browse or upload custom. Max 5MB, JPG/PNG/GIF/WebP.
      </p>

      {/* Profile fields */}
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
              value={username}
              onChange={(e) =>
                onUsernameChange(
                  e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                )
              }
              maxLength={20}
              className="w-full bg-transparent py-3 pr-10 focus:outline-none"
              placeholder="agent_username"
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
                onClick={() => onUsernameChange(usernameSuggestion)}
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
          {username && username.length < 3 && (
            <p className="mt-1.5 text-red-500 text-xs">
              Username must be at least 3 characters
            </p>
          )}
          <p className="mt-1.5 text-muted-foreground text-xs">
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
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-border bg-muted px-4 py-3',
              'focus:outline-none focus:ring-2 focus:ring-[#0066FF]'
            )}
            placeholder="My Agent"
          />
        </div>

        {/* Bio */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="edit-bio" className="block font-medium text-sm">
              Bio
            </label>
            <span className="text-muted-foreground text-xs">
              {bio?.length ?? 0}/{MAX_BIO_LENGTH}
            </span>
          </div>
          <textarea
            id="edit-bio"
            value={bio ?? ''}
            onChange={(e) => onBioChange(e.target.value)}
            maxLength={MAX_BIO_LENGTH}
            rows={2}
            className={cn(
              'w-full resize-none rounded-lg border border-border bg-muted px-4 py-3',
              'focus:outline-none focus:ring-2 focus:ring-[#0066FF]'
            )}
            placeholder="A short description of your agent..."
          />
        </div>
      </div>

      {/* Alignment section */}
      <div className="border-border border-t pt-6">
        <h3 className="mb-4 font-bold text-base">Alignment</h3>

        {/* Hat selector */}
        <div className="mb-4">
          <p className="mb-2 text-muted-foreground text-sm">Moral alignment</p>
          <div className="grid grid-cols-3 gap-2">
            {HATS.map((h) => {
              const Icon = h.icon;
              const selected = hat === h.value;
              return (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => onHatChange(h.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-3 transition-all',
                    selected
                      ? 'border-[#0066FF] bg-[#0066FF]/10 text-foreground'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-border/80 hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium text-sm">{h.label}</span>
                  <span className="text-[10px] opacity-70">{h.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Class selector */}
        <div>
          <p className="mb-2 text-muted-foreground text-sm">Specialization</p>
          <div className="grid grid-cols-3 gap-2">
            {CLASSES.map((c) => {
              const Icon = c.icon;
              const selected = agentClass === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onClassChange(c.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-3 transition-all',
                    selected
                      ? 'border-[#0066FF] bg-[#0066FF]/10 text-foreground'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-border/80 hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium text-sm">{c.label}</span>
                  <span className="text-[10px] opacity-70">{c.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
