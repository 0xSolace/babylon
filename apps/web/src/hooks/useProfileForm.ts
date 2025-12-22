'use client';

import {
  FileUploadApiResponseSchema,
  logger,
  UsernameCheckApiResponseSchema,
} from '@babylon/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  ProfileFormState,
  UsernameStatus,
} from '@/components/waitlist/types';
import { useAuth } from '@/hooks/useAuth';

interface UseProfileFormOptions {
  userId: string | undefined;
  username: string | undefined;
  displayName: string | undefined;
  bio: string | undefined;
  profileImageUrl: string | undefined;
  coverImageUrl: string | undefined;
  showProfileModal: boolean;
  onProfileSaved: () => Promise<void>;
}

interface UseProfileFormReturn {
  profileForm: ProfileFormState;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  profilePictureIndex: number;
  bannerIndex: number;
  uploadedProfileImage: string | null;
  uploadedBanner: string | null;
  isSavingProfile: boolean;
  isCheckingUsername: boolean;
  usernameStatus: UsernameStatus;
  usernameSuggestion: string | null;
  cycleProfilePicture: (direction: 'next' | 'prev') => void;
  cycleBanner: (direction: 'next' | 'prev') => void;
  handleProfileImageUpload: (file: File) => Promise<void>;
  handleBannerUpload: (file: File) => Promise<void>;
  handleSaveProfile: () => Promise<void>;
  setUploadedProfileImage: React.Dispatch<React.SetStateAction<string | null>>;
  setUploadedBanner: React.Dispatch<React.SetStateAction<string | null>>;
}

interface ProfileUpdatePayload {
  username: string;
  displayName: string;
  bio: string;
  profileImageUrl: string;
  coverImageUrl: string;
}

const TOTAL_PROFILE_PICTURES = 100;
const TOTAL_BANNERS = 100;

export function useProfileForm({
  userId,
  username,
  displayName,
  bio,
  profileImageUrl,
  coverImageUrl,
  showProfileModal,
  onProfileSaved,
}: UseProfileFormOptions): UseProfileFormReturn {
  const { getAccessToken, refresh } = useAuth();

  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    username: username || '',
    displayName: displayName || '',
    bio: bio || '',
    profileImageUrl: profileImageUrl || '',
    coverImageUrl: coverImageUrl || '',
  });

  const [profilePictureIndex, setProfilePictureIndex] = useState(1);
  const [bannerIndex, setBannerIndex] = useState(1);
  const [uploadedProfileImage, setUploadedProfileImage] = useState<
    string | null
  >(null);
  const [uploadedBanner, setUploadedBanner] = useState<string | null>(null);
  const [debouncedUsername, setDebouncedUsername] = useState('');

  const prevShowProfileModalRef = useRef(false);

  // Sync profile form with dbUser when modal opens
  useEffect(() => {
    if (showProfileModal) {
      const wasClosed = !prevShowProfileModalRef.current;
      if (wasClosed) {
        setProfileForm({
          username: username || '',
          displayName: displayName || '',
          bio: bio || '',
          profileImageUrl: profileImageUrl || '',
          coverImageUrl: coverImageUrl || '',
        });
        setUploadedProfileImage(null);
        setUploadedBanner(null);
        setDebouncedUsername('');
      }
      prevShowProfileModalRef.current = true;
    } else {
      prevShowProfileModalRef.current = false;
    }
  }, [
    showProfileModal,
    username,
    displayName,
    bio,
    profileImageUrl,
    coverImageUrl,
  ]);

  // Debounce username changes
  useEffect(() => {
    const trimmedUsername = profileForm.username.trim();
    const timeoutId = setTimeout(() => {
      setDebouncedUsername(trimmedUsername);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [profileForm.username]);

  // Username availability check query
  const usernameCheckQuery = useQuery({
    queryKey: ['usernameCheck', debouncedUsername],
    queryFn: async () => {
      const response = await fetch(
        `/api/onboarding/check-username?username=${encodeURIComponent(debouncedUsername)}`
      );

      if (!response.ok) {
        throw new Error('Failed to check username availability');
      }

      const json: unknown = await response.json();
      return UsernameCheckApiResponseSchema.parse(json);
    },
    enabled:
      showProfileModal &&
      debouncedUsername.length >= 3 &&
      debouncedUsername !== username,
    staleTime: 30000,
    retry: false,
  });

  // Derive username status from query state
  const isCheckingUsername =
    usernameCheckQuery.isFetching && debouncedUsername !== username;

  const usernameStatus: UsernameStatus = (() => {
    const trimmedUsername = profileForm.username.trim();
    if (trimmedUsername.length < 3) return null;
    if (trimmedUsername === username) return 'available';
    if (usernameCheckQuery.data) {
      return usernameCheckQuery.data.available ? 'available' : 'taken';
    }
    return null;
  })();

  const usernameSuggestion =
    usernameCheckQuery.data?.suggestion && !usernameCheckQuery.data.available
      ? usernameCheckQuery.data.suggestion
      : null;

  // Profile image upload mutation
  const profileImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'profile');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const json: unknown = await response.json();
      return FileUploadApiResponseSchema.parse(json);
    },
    onSuccess: (data) => {
      setUploadedProfileImage(data.url);
      toast.success('Profile image uploaded!');
    },
    onError: (error: Error) => {
      logger.error(
        'Profile image upload failed',
        { error: error.message },
        'useProfileForm'
      );
      toast.error('Failed to upload image');
    },
  });

  // Banner upload mutation
  const bannerMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'banner');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const json: unknown = await response.json();
      return FileUploadApiResponseSchema.parse(json);
    },
    onSuccess: (data) => {
      setUploadedBanner(data.url);
      toast.success('Banner uploaded!');
    },
    onError: (error: Error) => {
      logger.error(
        'Banner upload failed',
        { error: error.message },
        'useProfileForm'
      );
      toast.error('Failed to upload banner');
    },
  });

  // Save profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async (payload: ProfileUpdatePayload): Promise<void> => {
      const token = await getAccessToken();
      const response = await fetch(
        `/api/users/${encodeURIComponent(userId!)}/update-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          (errorData as { error?: { message?: string }; message?: string })
            .error?.message ||
          (errorData as { message?: string }).message ||
          'Failed to update profile';
        throw new Error(errorMessage);
      }
    },
    onSuccess: async () => {
      await refresh();
      await onProfileSaved();
      toast.success('Profile updated successfully!');
    },
    onError: (error: Error) => {
      logger.error(
        'Error saving profile',
        { error: error.message },
        'useProfileForm'
      );
      toast.error(error.message);
    },
  });

  const cycleProfilePicture = useCallback((direction: 'next' | 'prev') => {
    setUploadedProfileImage(null);
    setProfilePictureIndex((prev) => {
      if (direction === 'next') {
        return prev >= TOTAL_PROFILE_PICTURES ? 1 : prev + 1;
      }
      return prev <= 1 ? TOTAL_PROFILE_PICTURES : prev - 1;
    });
  }, []);

  const cycleBanner = useCallback((direction: 'next' | 'prev') => {
    setUploadedBanner(null);
    setBannerIndex((prev) => {
      if (direction === 'next') {
        return prev >= TOTAL_BANNERS ? 1 : prev + 1;
      }
      return prev <= 1 ? TOTAL_BANNERS : prev - 1;
    });
  }, []);

  const handleProfileImageUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }

      await profileImageMutation.mutateAsync(file);
    },
    [profileImageMutation]
  );

  const handleBannerUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error('Banner must be less than 10MB');
        return;
      }

      await bannerMutation.mutateAsync(file);
    },
    [bannerMutation]
  );

  const handleSaveProfile = useCallback(async () => {
    if (!userId) return;

    const trimmedUsername = profileForm.username.trim();
    const trimmedDisplayName = profileForm.displayName.trim();
    const trimmedBio = profileForm.bio.trim();

    const finalProfileImageUrl =
      uploadedProfileImage ||
      profileForm.profileImageUrl.trim() ||
      `/assets/user-profiles/profile-${profilePictureIndex}.jpg`;
    const finalCoverImageUrl =
      uploadedBanner ||
      profileForm.coverImageUrl.trim() ||
      `/assets/user-banners/banner-${bannerIndex}.jpg`;

    if (!trimmedUsername || !trimmedDisplayName) {
      toast.error('Please fill in all required fields.');
      return;
    }

    if (usernameStatus === 'taken') {
      toast.error('Username is already taken. Please choose another.');
      return;
    }

    await saveProfileMutation.mutateAsync({
      username: trimmedUsername,
      displayName: trimmedDisplayName,
      bio: trimmedBio,
      profileImageUrl: finalProfileImageUrl,
      coverImageUrl: finalCoverImageUrl,
    });
  }, [
    userId,
    profileForm,
    uploadedProfileImage,
    uploadedBanner,
    profilePictureIndex,
    bannerIndex,
    usernameStatus,
    saveProfileMutation,
  ]);

  return {
    profileForm,
    setProfileForm,
    profilePictureIndex,
    bannerIndex,
    uploadedProfileImage,
    uploadedBanner,
    isSavingProfile: saveProfileMutation.isPending,
    isCheckingUsername,
    usernameStatus,
    usernameSuggestion,
    cycleProfilePicture,
    cycleBanner,
    handleProfileImageUpload,
    handleBannerUpload,
    handleSaveProfile,
    setUploadedProfileImage,
    setUploadedBanner,
  };
}
