import { logger } from '@babylon/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { generateAgentName } from '@/utils/nameGenerator';

const STORAGE_KEY = 'babylon_agent_draft_v2';
const TOTAL_PROFILE_PICTURES = 100;

// --- Alignment types ---

export type AgentHat = 'black' | 'gray' | 'white';
export type AgentClass = 'yapper' | 'trader' | 'dev';

// --- Form data types ---

export interface ProfileFormData {
  username: string;
  displayName: string;
  bio: string;
  profileImageUrl: string;
  coverImageUrl: string;
}

export interface AgentFormData {
  system: string;
  personality: string;
  tradingStrategy: string;
  initialDeposit: number;
}

export interface SettingsFormData {
  modelTier: 'free' | 'pro';
  autonomousEnabled: boolean;
  autonomousPosting: boolean;
  autonomousCommenting: boolean;
  autonomousDMs: boolean;
  autonomousGroupChats: boolean;
  a2aEnabled: boolean;
}

// --- Draft persistence ---

interface SavedDraft {
  profileData: ProfileFormData;
  agentData: AgentFormData;
  settingsData: SettingsFormData;
  hat: AgentHat;
  agentClass: AgentClass;
  step: number;
}

// --- Template types ---

interface TemplateEntry {
  system: string;
  personality: string;
  tradingStrategy: string;
  description: string;
}

interface TemplateFile {
  templates: TemplateEntry[];
}

// --- Defaults ---

const DEFAULT_SETTINGS: SettingsFormData = {
  modelTier: 'pro',
  autonomousEnabled: true,
  autonomousPosting: true,
  autonomousCommenting: true,
  autonomousDMs: true,
  autonomousGroupChats: true,
  a2aEnabled: true,
};

function readDraft(): SavedDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved) as SavedDraft;
  } catch {
    return null;
  }
}

/**
 * Hook for managing agent creation form state.
 *
 * Features:
 * - Alignment-based template loading (hat × class matrix)
 * - Pre-generated templates loaded from static JSON
 * - Full draft persistence to localStorage
 * - AI-powered "Generate New" field generation
 */
export function useAgentForm() {
  const { getAccessToken } = useAuth();

  // Restore draft on mount (stable, runs once)
  const [restoredDraft] = useState<SavedDraft | null>(readDraft);

  // Step
  const [step, setStep] = useState(restoredDraft?.step ?? 1);

  // Alignment
  const [hat, setHat] = useState<AgentHat>(restoredDraft?.hat ?? 'gray');
  const [agentClass, setAgentClass] = useState<AgentClass>(
    restoredDraft?.agentClass ?? 'trader'
  );

  // Profile
  const [initialName] = useState(() =>
    restoredDraft
      ? {
          username: restoredDraft.profileData.username,
          displayName: restoredDraft.profileData.displayName,
        }
      : generateAgentName()
  );

  const [profileData, setProfileData] = useState<ProfileFormData>(() => {
    if (restoredDraft) return restoredDraft.profileData;
    const randomPfp = Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1;
    const randomBanner = Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1;
    return {
      username: initialName.username,
      displayName: initialName.displayName,
      bio: '',
      profileImageUrl: `/assets/user-profiles/profile-${randomPfp}.jpg`,
      coverImageUrl: `/assets/user-banners/banner-${randomBanner}.jpg`,
    };
  });

  // Agent config
  const [agentData, setAgentData] = useState<AgentFormData>(
    restoredDraft?.agentData ?? {
      system: '',
      personality: '',
      tradingStrategy: '',
      initialDeposit: 100,
    }
  );

  // Settings
  const [settingsData, setSettingsData] = useState<SettingsFormData>(
    restoredDraft?.settingsData ?? DEFAULT_SETTINGS
  );

  // Loading state
  const [isInitialized, setIsInitialized] = useState(!!restoredDraft);
  const [generatingField, setGeneratingField] = useState<string | null>(null);

  // Track alignment changes to know when to reload templates
  const skipInitialLoadRef = useRef(!!restoredDraft);
  const currentAlignmentRef = useRef({ hat, agentClass });

  // Load template when alignment changes (or on first mount without draft)
  useEffect(() => {
    // On mount with a draft, skip the first load
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      // Still track current alignment for change detection
      currentAlignmentRef.current = { hat, agentClass };
      return;
    }

    currentAlignmentRef.current = { hat, agentClass };

    const loadTemplate = async () => {
      try {
        const res = await fetch(
          `/agent-templates/v2/${hat}-hat-${agentClass}.json`
        );
        if (!res.ok) {
          logger.error(
            'Failed to load template file',
            { hat, agentClass, status: res.status },
            'useAgentForm'
          );
          setIsInitialized(true);
          return;
        }

        const data = (await res.json()) as TemplateFile;
        if (!data.templates?.length) {
          setIsInitialized(true);
          return;
        }

        const template =
          data.templates[Math.floor(Math.random() * data.templates.length)]!;
        const name = profileData.displayName || initialName.displayName;

        setAgentData((prev) => ({
          system: template.system.replace(/\{\{agentName\}\}/g, name),
          personality: template.personality.replace(/\{\{agentName\}\}/g, name),
          tradingStrategy: template.tradingStrategy.replace(
            /\{\{agentName\}\}/g,
            name
          ),
          initialDeposit: prev.initialDeposit,
        }));

        if (template.description) {
          setProfileData((prev) => ({
            ...prev,
            bio: template.description
              .replace(/\{\{agentName\}\}/g, name)
              .slice(0, 160),
          }));
        }

        setIsInitialized(true);
      } catch (err) {
        logger.error('Failed to load template', { error: err }, 'useAgentForm');
        setIsInitialized(true);
      }
    };

    void loadTemplate();
    // intentionally excluding profileData/initialName to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hat, agentClass]);

  // Persist draft to localStorage on changes
  useEffect(() => {
    if (!isInitialized) return;
    const draft: SavedDraft = {
      profileData,
      agentData,
      settingsData,
      hat,
      agentClass,
      step,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [
    profileData,
    agentData,
    settingsData,
    hat,
    agentClass,
    step,
    isInitialized,
  ]);

  // --- Update helpers ---

  const updateProfileField = useCallback(
    (field: keyof ProfileFormData, value: string) => {
      setProfileData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const updateAgentField = useCallback(
    (field: keyof AgentFormData, value: string | number) => {
      setAgentData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  /**
   * Generate a completely new value for a field using AI.
   * Uses all other field context to produce something fresh (not enhancement).
   */
  const generateNewField = useCallback(
    async (field: string) => {
      setGeneratingField(field);

      const token = await getAccessToken();
      if (!token) {
        toast.error('Authentication required');
        setGeneratingField(null);
        return;
      }

      const response = await fetch('/api/agents/generate-field', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fieldName: field,
          // Pass empty currentValue so the API generates fresh rather than enhancing
          currentValue: '',
          context: {
            name: profileData.displayName,
            description: profileData.bio,
            hat,
            agentClass,
            system: field === 'system' ? '' : agentData.system,
            personality: field === 'personality' ? '' : agentData.personality,
            tradingStrategy:
              field === 'tradingStrategy' ? '' : agentData.tradingStrategy,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to generate field');
        setGeneratingField(null);
        return;
      }

      const result = await response.json();
      const value = (result.value as string).trim();

      if (field === 'personality') {
        const lines = value
          .split('|')
          .map((s: string) => s.trim())
          .filter((s: string) => s);
        updateAgentField('personality', lines.join('\n'));
      } else {
        updateAgentField(
          field as keyof AgentFormData,
          value.replace(/\n\n+/g, '\n')
        );
      }

      toast.success(`Generated new ${field}!`);
      setGeneratingField(null);
    },
    [agentData, profileData, hat, agentClass, getAccessToken, updateAgentField]
  );

  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    // Step
    step,
    setStep,
    // Alignment
    hat,
    setHat,
    agentClass,
    setAgentClass,
    // Profile
    profileData,
    updateProfileField,
    // Agent config
    agentData,
    updateAgentField,
    // Settings
    settingsData,
    setSettingsData,
    // State
    isInitialized,
    generatingField,
    hasDraft: !!restoredDraft,
    // Actions
    generateNewField,
    clearDraft,
  };
}
