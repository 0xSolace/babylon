import {
  type AgentTemplateApiResponse,
  AgentTemplateApiResponseSchema,
  AgentTemplateIndexApiResponseSchema,
  GenerateFieldApiResponseSchema,
} from '@babylon/shared'

// Local alias for the template type
type AgentTemplate = AgentTemplateApiResponse

import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'

const STORAGE_KEY = 'babylon_agent_draft'

/**
 * Name component pools for generating unique agent names
 * Total combinations: 76 prefixes × 41 suffixes × 9000 numbers = 28,044,000+
 */
const NAME_PREFIXES = [
  // Greek letters
  'Alpha',
  'Beta',
  'Gamma',
  'Delta',
  'Epsilon',
  'Zeta',
  'Eta',
  'Theta',
  'Iota',
  'Kappa',
  'Lambda',
  'Mu',
  'Nu',
  'Xi',
  'Omicron',
  'Pi',
  'Rho',
  'Sigma',
  'Tau',
  'Upsilon',
  'Phi',
  'Chi',
  'Psi',
  'Omega',
  // Tech/Cyber
  'Quantum',
  'Neo',
  'Cyber',
  'Nexus',
  'Apex',
  'Vertex',
  'Pulse',
  'Flux',
  'Vector',
  'Helix',
  'Prism',
  'Matrix',
  'Cipher',
  'Binary',
  'Neural',
  // Nature/Elements
  'Nova',
  'Solar',
  'Lunar',
  'Stellar',
  'Cosmic',
  'Astral',
  'Phoenix',
  'Storm',
  'Thunder',
  'Frost',
  'Ember',
  'Shadow',
  'Dawn',
  'Dusk',
  // Power/Status
  'Iron',
  'Steel',
  'Titan',
  'Atlas',
  'Orion',
  'Vortex',
  'Blaze',
  'Spark',
  'Echo',
  'Phantom',
  'Specter',
  'Raven',
  'Falcon',
  'Hawk',
  'Eagle',
  // Abstract
  'Zen',
  'Aura',
  'Axiom',
  'Lumen',
  'Photon',
  'Quark',
  'Volt',
  'Arc',
]

const NAME_SUFFIXES = [
  // Role-based
  'Trader',
  'Agent',
  'Bot',
  'AI',
  'Mind',
  'Brain',
  'Sage',
  'Oracle',
  // Technical
  'Core',
  'Node',
  'Edge',
  'Prime',
  'Pro',
  'Max',
  'Ultra',
  'Plus',
  'X',
  'Zero',
  'One',
  'Protocol',
  'System',
  'Engine',
  'Logic',
  // Abstract
  'Flow',
  'Wave',
  'Sync',
  'Link',
  'Net',
  'Hub',
  'Lab',
  'Works',
  'Force',
  'Drive',
  'Pulse',
  'Signal',
  'Stream',
  'Grid',
  'Mesh',
]

const generateAgentName = (): string => {
  const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]
  const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]
  const number = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}${suffix}-${number}`
}

export interface ProfileFormData {
  username: string
  displayName: string
  bio: string
  profileImageUrl: string
  coverImageUrl: string
}

export interface AgentFormData {
  system: string
  personality: string
  tradingStrategy: string
  initialDeposit: number
}

interface UseAgentFormResult {
  profileData: ProfileFormData
  agentData: AgentFormData
  isInitialized: boolean
  generatingField: string | null
  updateProfileField: (field: keyof ProfileFormData, value: string) => void
  updateAgentField: (field: keyof AgentFormData, value: string | number) => void
  setProfileData: React.Dispatch<React.SetStateAction<ProfileFormData>>
  regenerateField: (field: string) => Promise<void>
  clearDraft: () => void
}

const TOTAL_PROFILE_PICTURES = 100

/** Request payload for POST /api/agents/generate-field */
interface GenerateFieldRequest {
  fieldName: string
  currentValue: string | number
  context: {
    name: string
    description: string
    system: string
    personality: string
    tradingStrategy: string
  }
}

/**
 * Check if saved draft exists in localStorage
 */
function getSavedDraft(): {
  profileData?: ProfileFormData
  agentData?: AgentFormData
} | null {
  if (typeof window === 'undefined') return null
  const savedData = localStorage.getItem(STORAGE_KEY)
  if (!savedData) return null
  return JSON.parse(savedData) as {
    profileData?: ProfileFormData
    agentData?: AgentFormData
  }
}

/**
 * Check if the saved draft has valid profile data
 */
function hasValidSavedDraft(): boolean {
  const draft = getSavedDraft()
  return Boolean(
    draft?.profileData?.displayName && draft?.profileData?.username,
  )
}

/**
 * Process a template with a generated agent name
 */
function processTemplateData(template: AgentTemplate): {
  profileData: ProfileFormData
  agentData: AgentFormData
} {
  const agentName = generateAgentName()

  // Process template with agent name
  const processedTemplate = {
    ...template,
    name: template.name.replace('{{agentName}}', agentName),
    system: template.system.replace(/{{agentName}}/g, agentName),
    personality: template.personality.replace(/{{agentName}}/g, agentName),
    tradingStrategy: template.tradingStrategy.replace(
      /{{agentName}}/g,
      agentName,
    ),
  }

  // Random images
  const randomPfp = Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1
  const randomBanner = Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1

  return {
    profileData: {
      username: agentName.toLowerCase().replace(/\s+/g, ''),
      displayName: processedTemplate.name,
      bio: processedTemplate.description,
      profileImageUrl: `/assets/user-profiles/profile-${randomPfp}.jpg`,
      coverImageUrl: `/assets/user-banners/banner-${randomBanner}.jpg`,
    },
    agentData: {
      system: processedTemplate.system,
      personality: processedTemplate.bio ?? '',
      tradingStrategy: processedTemplate.tradingStrategy,
      initialDeposit: 100,
    },
  }
}

/**
 * Fetch random template and process it
 */
async function fetchRandomTemplate(): Promise<{
  profileData: ProfileFormData
  agentData: AgentFormData
}> {
  const indexResponse = await fetch('/api/agent-templates')
  if (!indexResponse.ok) {
    throw new Error('Failed to load template index')
  }

  const indexJson = await indexResponse.json()
  const index = AgentTemplateIndexApiResponseSchema.parse(indexJson)
  if (!index.templates || index.templates.length === 0) {
    throw new Error('No templates available')
  }

  const randomTemplateId =
    index.templates[Math.floor(Math.random() * index.templates.length)]
  const templateResponse = await fetch(
    `/api/agent-templates/${randomTemplateId}`,
  )

  if (!templateResponse.ok) {
    throw new Error('Failed to load template')
  }

  const templateJson = await templateResponse.json()
  const template = AgentTemplateApiResponseSchema.parse(
    templateJson,
  ) as AgentTemplate
  return processTemplateData(template)
}

/**
 * Hook for managing agent creation form state
 *
 * Features:
 * - Auto-loads random template on init (via react-query)
 * - Persists draft to localStorage
 * - AI-powered field regeneration (via react-query mutation)
 * - Profile and agent config state management
 */
export function useAgentForm(): UseAgentFormResult {
  const { getAccessToken } = useAuth()

  const [profileData, setProfileData] = useState<ProfileFormData>({
    username: '',
    displayName: '',
    bio: '',
    profileImageUrl: '',
    coverImageUrl: '',
  })

  const [agentData, setAgentData] = useState<AgentFormData>({
    system: '',
    personality: '',
    tradingStrategy: '',
    initialDeposit: 100,
  })

  const [isInitialized, setIsInitialized] = useState(false)

  // Check for saved draft and load it if valid
  useEffect(() => {
    const draft = getSavedDraft()
    if (draft?.profileData?.displayName && draft?.profileData?.username) {
      setProfileData(draft.profileData)
      if (draft.agentData?.system) {
        setAgentData(draft.agentData)
      }
      setIsInitialized(true)
    }
  }, [])

  // Query for loading random template (only when no valid saved draft)
  const templateQuery = useQuery({
    queryKey: ['agent-template', 'random'],
    queryFn: fetchRandomTemplate,
    enabled: !hasValidSavedDraft(),
    staleTime: Infinity, // Don't refetch once loaded
    retry: false,
  })

  // Apply template data when query succeeds
  useEffect(() => {
    if (templateQuery.data && !isInitialized) {
      setProfileData(templateQuery.data.profileData)
      setAgentData(templateQuery.data.agentData)
      setIsInitialized(true)
    }
  }, [templateQuery.data, isInitialized])

  // Handle query error - still mark as initialized so form is usable
  useEffect(() => {
    if (templateQuery.isError && !isInitialized) {
      console.error('Failed to load template:', templateQuery.error)
      setIsInitialized(true)
    }
  }, [templateQuery.isError, templateQuery.error, isInitialized])

  // Auto-save to localStorage
  useEffect(() => {
    if (!isInitialized) return
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profileData, agentData }),
    )
  }, [profileData, agentData, isInitialized])

  const updateProfileField = useCallback(
    (field: keyof ProfileFormData, value: string) => {
      setProfileData((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  const updateAgentField = useCallback(
    (field: keyof AgentFormData, value: string | number) => {
      setAgentData((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  // Mutation for regenerating fields via AI
  const regenerateFieldMutation = useMutation({
    mutationFn: async ({
      fieldName,
      token,
      request,
    }: {
      fieldName: string
      token: string
      request: GenerateFieldRequest
    }): Promise<{ fieldName: string; value: string }> => {
      const response = await fetch('/api/agents/generate-field', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorData: { error?: string } = await response
          .json()
          .catch(() => ({}))
        throw new Error(errorData.error ?? 'Failed to generate field')
      }

      const resultJson = await response.json()
      const result = GenerateFieldApiResponseSchema.parse(resultJson)
      const strippedValue = result.value
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim()

      return { fieldName, value: strippedValue }
    },
    onSuccess: ({ fieldName, value }) => {
      if (fieldName === 'personality') {
        const personalityLines = value
          .split('|')
          .map((s: string) => s.trim())
          .filter((s: string) => s)
        updateAgentField('personality', personalityLines.join('\n'))
      } else {
        updateAgentField(
          fieldName as keyof AgentFormData,
          value.replace(/\n\n+/g, '\n'),
        )
      }
      toast.success(`Regenerated ${fieldName}!`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Wrapper function to maintain the same interface
  const regenerateField = useCallback(
    async (field: string) => {
      const token = await getAccessToken()
      if (!token) {
        toast.error('Authentication required')
        return
      }

      regenerateFieldMutation.mutate({
        fieldName: field,
        token,
        request: {
          fieldName: field,
          currentValue: agentData[field as keyof AgentFormData],
          context: {
            name: profileData.displayName,
            description: profileData.bio,
            system: agentData.system,
            personality: agentData.personality,
            tradingStrategy: agentData.tradingStrategy,
          },
        },
      })
    },
    [agentData, profileData, getAccessToken, regenerateFieldMutation],
  )

  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Compute generatingField from mutation state
  const generatingField = regenerateFieldMutation.isPending
    ? (regenerateFieldMutation.variables?.fieldName ?? null)
    : null

  return {
    profileData,
    agentData,
    isInitialized,
    generatingField,
    updateProfileField,
    updateAgentField,
    setProfileData,
    regenerateField,
    clearDraft,
  }
}
