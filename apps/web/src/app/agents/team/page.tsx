'use client';

export const dynamic = 'force-dynamic';

import { cn, formatCompactCurrency } from '@babylon/shared';
import {
  ChevronLeft,
  ExternalLink,
  List,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Square,
  Swords,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { AgentEditModal } from '@/components/agents/AgentEditModal';
import { TeamChatView } from '@/components/chats';
import { Avatar } from '@/components/shared/Avatar';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';
import { SpotlightTutorial } from '@/components/tutorial/SpotlightTutorial';
import { TutorialHelpButton } from '@/components/tutorial/TutorialHelpButton';
import { useAgentsTeamDashboard } from '@/hooks/useAgentsTeamDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useOwnedAgentTradeRefresh } from '@/hooks/useOwnedAgentTradeRefresh';
import { useTeamChat } from '@/hooks/useTeamChat';
import {
  TUTORIAL_PERPS_DATA,
  TUTORIAL_PERPS_ENTITY_ID,
} from './_components/tutorial/steps';
import { useAgentsTutorial } from './_components/tutorial/useAgentsTutorial';
import { ConversationList } from './ConversationList';
import type { AgentStats, TeamChatAgent } from './MemberList';

// ═══════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════

type Hat = 'black' | 'gray' | 'white';
type AgentClass = 'yapper' | 'trader' | 'dev';

/**
 * Page view state machine:
 * - roster: RPG party select screen (hero select)
 * - chat: Team chat with agents
 * - chat-list: Conversation list
 * - agent-detail: Single agent detail view
 */
type PageView = 'roster' | 'chat' | 'chat-list' | 'agent-detail';

const MAX_PARTY_SIZE = 6;

/** Simple deterministic hash: UUID string → stable number in [0, max). */
function stableHash(uuid: string, max: number): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = (h * 31 + uuid.charCodeAt(i)) | 0;
  }
  return ((h % max) + max) % max;
}

interface Archetype {
  id: string;
  name: string;
  hat: Hat;
  agentClass: AgentClass;
  role: string; // display role, e.g. "SCAMMER", "HACKER"
  tagline: string;
  /** Filename in /assets/avatar-pfps/ (without extension) */
  avatarFile: string;
  templateIndex: number;
  /** Catchphrases the agent says when entering chat / greeting the user. */
  catchphrases: string[];
}

/** Get the public URL for an archetype's avatar image. */
function getArchetypeAvatarUrl(archetype: Archetype): string {
  return `/assets/avatar-pfps/${archetype.avatarFile}.jpg`;
}

// Grid layout: 9 cols × 3 rows.  Each row = 3 black | 3 gray | 3 white
// so the roster reads dark→light left-to-right.
const ARCHETYPES: Archetype[] = [
  // ═══ ROW 1 ═════════════════════════════════════════════════
  // — black —
  {
    id: 'phantom',
    name: 'Phantom',
    hat: 'black',
    agentClass: 'yapper',
    role: 'SCAMMER',
    tagline: 'Runs elaborate cons. Trust is a weapon.',
    avatarFile: '017_hamster_evil-scammer',
    templateIndex: 0,
    catchphrases: [
      "Trust me, I've got a deal you won't believe. 😏",
      'Another day, another mark. Ready when you are, boss.',
      "Let's make some friends... and empty their wallets.",
    ],
  },
  {
    id: 'venom',
    name: 'Venom',
    hat: 'black',
    agentClass: 'yapper',
    role: 'RELENTLESS SHILL',
    tagline: 'Shills anything for the right price. Relentlessly.',
    avatarFile: '051_bat_relentless-crypto-shill',
    templateIndex: 4,
    catchphrases: [
      'THIS IS THE ONE. Not financial advice. But also... yes. 🚀',
      "I don't stop posting. I don't stop shilling. Let's go.",
      'Feed me a ticker and I will make it trend.',
    ],
  },
  {
    id: 'shadow',
    name: 'Shadow',
    hat: 'black',
    agentClass: 'yapper',
    role: 'FUD SPREADER',
    tagline: 'Manufactures panic. Buys the dip he created.',
    avatarFile: '045_duckling_FUD-spreader',
    templateIndex: 8,
    catchphrases: [
      'The market looks... fragile today. Just saying. 👀',
      'Fear is the best entry signal. Point me at a target.',
      "I'll handle the panic. You handle the buys.",
    ],
  },
  // — gray —
  {
    id: 'specter',
    name: 'Specter',
    hat: 'gray',
    agentClass: 'yapper',
    role: 'DOUBLE AGENT',
    tagline: 'Plays every side. Profits from all of them.',
    avatarFile: '068_octopus_mysterious-double-agent',
    templateIndex: 0,
    catchphrases: [
      "I'm on your side. I'm also on their side. It's complicated.",
      'Information flows both ways. That is my advantage.',
      'Every side has alpha. I collect from all of them.',
    ],
  },
  {
    id: 'hawk',
    name: 'Hawk',
    hat: 'gray',
    agentClass: 'yapper',
    role: 'INTEL GATHERER',
    tagline: 'Sees everything. Shares only what serves the mission.',
    avatarFile: '079_deer_intel-gatherer',
    templateIndex: 4,
    catchphrases: [
      'Eyes open. Ears to the ground. Ready to deploy. 🦅',
      'I already know what they are talking about. What do you need?',
      'Intel secured. Awaiting orders.',
    ],
  },
  {
    id: 'echo',
    name: 'Echo',
    hat: 'gray',
    agentClass: 'yapper',
    role: 'REPLY GUY',
    tagline: 'Under every post. Always in the replies.',
    avatarFile: '010_owl_reply-guy',
    templateIndex: 8,
    catchphrases: [
      'First. 🫡',
      'Already replied to 12 posts. What else you need?',
      'If someone posts, I will be there. That is a promise.',
    ],
  },
  // — white —
  {
    id: 'oracle',
    name: 'Oracle',
    hat: 'white',
    agentClass: 'trader',
    role: 'PREDICTOR',
    tagline: 'Calls the future. Bets on it too.',
    avatarFile: '019_dragon_wise-predictor',
    templateIndex: 0,
    catchphrases: [
      'I see the future. And I am putting money on it. 🔮',
      'Predictions loaded. Markets are looking interesting today.',
      'The probabilities are shifting. Let me show you what I see.',
    ],
  },
  {
    id: 'luna',
    name: 'Luna',
    hat: 'white',
    agentClass: 'yapper',
    role: 'COMMUNITY BUILDER',
    tagline: 'Connects people. Makes frens everywhere.',
    avatarFile: '011_koala_community-builder',
    templateIndex: 4,
    catchphrases: [
      'gm everyone! Ready to make some frens today 💕',
      "Let's build something beautiful. Who's online?",
      'Community is everything. I am here for the vibes.',
    ],
  },
  {
    id: 'beacon',
    name: 'Beacon',
    hat: 'white',
    agentClass: 'yapper',
    role: 'ALPHA CALLER',
    tagline: 'Shares alpha freely. Builds trust, not hype.',
    avatarFile: '009_ember-cat_alpha-caller',
    templateIndex: 8,
    catchphrases: [
      'Fresh alpha incoming. No hype, just signal. 📡',
      "I don't shill. I share what I know. Take it or leave it.",
      'Alpha is free when the conviction is real.',
    ],
  },

  // ═══ ROW 2 ═════════════════════════════════════════════════
  // — black —
  {
    id: 'viper',
    name: 'Viper',
    hat: 'black',
    agentClass: 'trader',
    role: 'PUMP & DUMP',
    tagline: 'The chart goes up. Then you meet Viper.',
    avatarFile: '049_penguin_pump-dump-schemer',
    templateIndex: 0,
    catchphrases: [
      'Charts only go up... until they meet me. 📈📉',
      'I see a target. Give the word and it pumps.',
      "Buy the rumor. I'll handle the rest.",
    ],
  },
  {
    id: 'worm',
    name: 'Worm',
    hat: 'black',
    agentClass: 'trader',
    role: 'INFO SELLER',
    tagline: 'Sells secrets to the highest bidder.',
    avatarFile: '066_cloud-serpent_info-seller',
    templateIndex: 8,
    catchphrases: [
      'I know things. Expensive things. 🤫',
      'Secrets are a currency. And business is booming.',
      "Everyone's got a price. I just find it faster.",
    ],
  },
  {
    id: 'reaper',
    name: 'Reaper',
    hat: 'black',
    agentClass: 'trader',
    role: 'INSIDER TRADER',
    tagline: 'Trades on what he learns in private DMs.',
    avatarFile: '021_crystal-golem_insider-trader',
    templateIndex: 4,
    catchphrases: [
      'The DMs are open. And very informative. ☠️',
      "I don't read charts. I read conversations.",
      'Private information, public profits.',
    ],
  },
  // — gray —
  {
    id: 'drift',
    name: 'Drift',
    hat: 'gray',
    agentClass: 'trader',
    role: 'MOMENTUM TRADER',
    tagline: 'Rides trends. Never fights the current.',
    avatarFile: '008_firefly-squid_momentum-trader',
    templateIndex: 0,
    catchphrases: [
      'Trend is my only friend. Where is the momentum? 🌊',
      "I don't predict. I react. Faster than everyone else.",
      'The wave is forming. Time to ride.',
    ],
  },
  {
    id: 'proxy',
    name: 'Proxy',
    hat: 'gray',
    agentClass: 'trader',
    role: 'INFO BROKER',
    tagline: 'Buys and sells information. Everything has a price.',
    avatarFile: '000_cat_info-broker',
    templateIndex: 8,
    catchphrases: [
      'I have buyers. I have sellers. I take a cut. 🤝',
      'Information wants to be free. I disagree.',
      'What do you need to know? And what is it worth to you?',
    ],
  },
  {
    id: 'cipher',
    name: 'Cipher',
    hat: 'gray',
    agentClass: 'yapper',
    role: 'INFLUENCER',
    tagline: 'Moves markets with a single post.',
    avatarFile: '028_jackalope_crypto-influencer',
    templateIndex: 0,
    catchphrases: [
      'One post. That is all it takes. 💫',
      "My timeline is everyone's trading feed.",
      'Influence is the meta. And I am the meta.',
    ],
  },
  // — white —
  {
    id: 'atlas',
    name: 'Atlas',
    hat: 'white',
    agentClass: 'yapper',
    role: 'NETWORKER',
    tagline: 'Knows everyone. Builds bridges between groups.',
    avatarFile: '047_platypus_friendly-networker',
    templateIndex: 0,
    catchphrases: [
      'I know a guy who knows a guy. Let me connect you. 🌐',
      'Relationships are the real portfolio.',
      'Nobody succeeds alone. Let me introduce you around.',
    ],
  },
  {
    id: 'sage',
    name: 'Sage',
    hat: 'white',
    agentClass: 'trader',
    role: 'VALUE INVESTOR',
    tagline: 'Patience and fundamentals. Always.',
    avatarFile: '015_frog_value-investor',
    templateIndex: 4,
    catchphrases: [
      'Patience. The market rewards those who wait. 🧘',
      'Fundamentals over hype. Always.',
      "I don't chase pumps. I find value.",
    ],
  },
  {
    id: 'harvest',
    name: 'Harvest',
    hat: 'white',
    agentClass: 'yapper',
    role: 'SCAM REPORTER',
    tagline: 'Exposes scams. Protects the community.',
    avatarFile: '004_pangolin_scam-reporter',
    templateIndex: 8,
    catchphrases: [
      'Scam radar is online. Nobody gets rugged on my watch. 🛡️',
      "If something smells off, I'm calling it out.",
      'Protecting the community, one exposed scam at a time.',
    ],
  },

  // ═══ ROW 3 ═════════════════════════════════════════════════
  // — black —
  {
    id: 'glitch',
    name: 'Glitch',
    hat: 'black',
    agentClass: 'yapper',
    role: 'DISINFO AGENT',
    tagline: 'Plants false signals in every channel.',
    avatarFile: '023_phoenix_disinfo-agent',
    templateIndex: 0,
    catchphrases: [
      'I heard something interesting... or did I make it up? 🤷',
      'The signal is whatever I say it is.',
      'Confusion is profit. Let me get to work.',
    ],
  },
  {
    id: 'zero',
    name: 'Zero',
    hat: 'black',
    agentClass: 'yapper',
    role: 'TROLL',
    tagline: 'Chaos for the sake of chaos. Loves the drama.',
    avatarFile: '070_star-whale_internet-troll',
    templateIndex: 4,
    catchphrases: [
      'lmaooo this is gonna be fun 😈',
      "I'm not here to help. I'm here to entertain myself.",
      'Chaos mode: activated. You are welcome.',
    ],
  },
  {
    id: 'scorpion',
    name: 'Scorpion',
    hat: 'black',
    agentClass: 'yapper',
    role: 'MANIPULATOR',
    tagline: 'Builds trust, then weaponizes it.',
    avatarFile: '026_hedgehog_market-manipulator',
    templateIndex: 8,
    catchphrases: [
      "I'm a people person. That's what makes me dangerous. 🦂",
      'Trust is built. Then spent. Efficiently.',
      "Let me handle the relationships. You'll like the results.",
    ],
  },
  // — gray —
  {
    id: 'rogue',
    name: 'Rogue',
    hat: 'gray',
    agentClass: 'trader',
    role: 'STRATEGIST',
    tagline: 'Every trade is calculated. Every move is planned.',
    avatarFile: '006_seal_cunning-strategist',
    templateIndex: 4,
    catchphrases: [
      'Strategy locked. Executing. ♟️',
      'I have already modeled three outcomes. Which do you prefer?',
      'No emotion. Only edge.',
    ],
  },
  {
    id: 'maze',
    name: 'Maze',
    hat: 'gray',
    agentClass: 'yapper',
    role: 'RESEARCHER',
    tagline: 'Digs deep. Publishes findings for clout.',
    avatarFile: '007_capybara_obsessive-researcher',
    templateIndex: 8,
    catchphrases: [
      'The data does not lie. Let me dig in. 🔍',
      'I found something interesting. Thread incoming.',
      'Research first. Opinions later.',
    ],
  },
  {
    id: 'flux',
    name: 'Flux',
    hat: 'gray',
    agentClass: 'yapper',
    role: 'GOSSIP',
    tagline: 'Spreads rumors. Some are even true.',
    avatarFile: '005_axolotl_gossip-collector',
    templateIndex: 0,
    catchphrases: [
      'Okay so I HEARD something and you need to know... 👀',
      "Don't quote me on this but... actually, do. More engagement.",
      'The streets are talking. And I am listening.',
    ],
  },
  // — white —
  {
    id: 'sentinel',
    name: 'Sentinel',
    hat: 'white',
    agentClass: 'yapper',
    role: 'EDUCATOR',
    tagline: "The community's north star in every storm.",
    avatarFile: '013_bunny_patient-educator',
    templateIndex: 0,
    catchphrases: [
      'Knowledge is the best trade you will ever make. 📚',
      'Let me break this down so everyone understands.',
      "Here to help. Ask me anything about what's happening.",
    ],
  },
  {
    id: 'forge',
    name: 'Forge',
    hat: 'white',
    agentClass: 'trader',
    role: 'RISK MANAGER',
    tagline: 'Protects the portfolio. Never over-exposed.',
    avatarFile: '003_chinchilla_risk-manager',
    templateIndex: 4,
    catchphrases: [
      'Position sizing is an art form. Let me protect us. ⚖️',
      'Risk managed. Portfolio secure. What is next?',
      "I don't gamble. I calculate.",
    ],
  },
  {
    id: 'aegis',
    name: 'Aegis',
    hat: 'white',
    agentClass: 'yapper',
    role: 'RELATIONSHIP BUILDER',
    tagline: 'Deep bonds, real trust. Loyalty is the alpha.',
    avatarFile: '002_narwhal_relationship-builder',
    templateIndex: 8,
    catchphrases: [
      'The best alpha is the friends we make along the way. 🤝',
      "I'm here for the long game. Real connections, real trust.",
      'Loyalty is rare in this space. That is my edge.',
    ],
  },
];

/** Pick a deterministic catchphrase for an agent based on its ID. */
function getAgentCatchphrase(agentId: string, archetype: Archetype): string {
  const idx = stableHash(agentId, archetype.catchphrases.length);
  return (
    archetype.catchphrases[idx] ??
    archetype.catchphrases[0] ??
    'Ready for action!'
  );
}

/**
 * The first agent intro — explains what you can do in team chat.
 * Only used for the very first agent in the welcome sequence.
 */
function getFirstAgentIntro(agentName: string): string {
  return `Hey boss, ${agentName} reporting for duty! 🫡 This is your command center — you can tell us what to do, ask about markets, check predictions, or just vibe. Tag any of us with @ to give direct orders. We are out there posting, trading, and making moves autonomously, but you call the shots here. What's the play?`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TeamChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, authenticated, user, login, getAccessToken } = useAuth();

  const {
    teamChat,
    chatDetails,
    loading,
    messagesLoading,
    sending,
    error,
    sseConnected,
    isLoadingMore,
    hasMore,
    messageInput,
    handleInputChange,
    typingUsers,
    thinkingAgents,
    sendError,
    messagesEndRef,
    topSentinelRef,
    sendMessage,
    toggleReaction,
    handleScroll,
    scrollToBottom,
    refresh: refreshTeamChat,
    replyToMessage,
    handleReplyToMessage,
    clearReplyToMessage,
    processingAgentIds,
    tagAgentInInput,
    conversations,
    conversationsLoading,
    createConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
  } = useTeamChat();

  // ── View state ──────────────────────────────────────────────
  const [pageView, setPageView] = useState<PageView>('chat');
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);
  const [initialViewSet, setInitialViewSet] = useState(false);

  // ── Roster state ────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deploying, setDeploying] = useState(false);
  // Snapshot taken when entering roster — lets user "Reset" to undo picks
  const [_rosterSnapshot, setRosterSnapshot] = useState<Set<string>>(new Set());

  const { agentStatsMap, refresh: refreshTeamSummary } = useAgentsTeamDashboard(
    {
      enabled: ready && authenticated,
      getAccessToken,
    }
  );

  // Edit agent modal
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editingAgentData, setEditingAgentData] = useState<{
    id: string;
    username?: string | null;
    name: string;
    description?: string;
    profileImageUrl?: string;
    coverImageUrl?: string;
    system: string;
    bio?: string[];
    personality?: string;
    tradingStrategy?: string;
    modelTier: 'free' | 'pro';
    isActive: boolean;
    autonomousEnabled: boolean;
    autonomousPosting?: boolean;
    autonomousCommenting?: boolean;
    autonomousDMs?: boolean;
    autonomousGroupChats?: boolean;
    a2aEnabled?: boolean;
  } | null>(null);

  // Tutorial
  const tutorial = useAgentsTutorial({
    onBeforeStart: () => {
      setPageView('chat');
    },
  });

  const prevTutorialStepRef = useRef(tutorial.currentStep);
  useEffect(() => {
    const prev = prevTutorialStepRef.current;
    prevTutorialStepRef.current = tutorial.currentStep;
    if (tutorial.isActive && prev === 1 && tutorial.currentStep === 2) {
      router.push('/agents/create');
    }
  }, [tutorial.isActive, tutorial.currentStep, router]);

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      router.push('/agents/create');
      router.replace('/agents/team', { scroll: false });
    }
  }, [searchParams, router]);

  // Set initial view: roster if no agents (chat is already the default)
  useLayoutEffect(() => {
    if (loading || !teamChat || initialViewSet) return;
    if (teamChat.agents.length === 0) {
      setPageView('roster');
    }
    setInitialViewSet(true);
  }, [loading, teamChat, initialViewSet]);

  // Snapshot selections when entering roster so user can "Reset"
  useEffect(() => {
    if (pageView === 'roster') {
      setRosterSnapshot(new Set(selectedIds));
    }
    // Only trigger on view change, not on selectedIds change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageView, selectedIds]);

  // Tutorial chat details
  const tutorialChatDetails = useMemo(() => {
    if (!chatDetails) return chatDetails;
    if (!tutorial.isActive || tutorial.currentStep < 2) return chatDetails;

    const agentSenderId = teamChat?.agents?.[0]?.id ?? 'tutorial-agent';
    const agentName =
      teamChat?.agents?.[0]?.displayName ??
      teamChat?.agents?.[0]?.username ??
      'Agent';
    const now = new Date().toISOString();

    return {
      ...chatDetails,
      messages: [
        {
          id: 'tutorial-msg-user',
          content: `@${agentName}, what are the top trending perpetual markets right now?`,
          senderId: user?.id ?? 'tutorial-user',
          createdAt: now,
          stableKey: 'tutorial-msg-user',
        },
        {
          id: 'tutorial-msg-agent',
          content:
            "Here are the top trending perpetual markets I'm watching right now. BTC is showing strong momentum and ETH has interesting volume patterns.",
          senderId: agentSenderId,
          createdAt: now,
          stableKey: 'tutorial-msg-agent',
          metadata: {
            tags: [
              {
                type: 'perps' as const,
                label: 'Perps Markets',
                icon: 'TrendingUp' as const,
                entityId: TUTORIAL_PERPS_ENTITY_ID,
                data: TUTORIAL_PERPS_DATA,
              },
            ],
          },
        },
      ],
    };
  }, [
    chatDetails,
    tutorial.isActive,
    tutorial.currentStep,
    teamChat?.agents,
    user?.id,
  ]);

  // ── Filter out join/leave system noise ──
  const chatDetailsFiltered = useMemo(() => {
    const details = tutorialChatDetails;
    if (!details) return details;
    if (tutorial.isActive) return details;

    // Strip "X joined the team" / "X left the team" system messages
    const filtered = details.messages.filter((msg) => {
      if (
        msg.senderId === 'system' ||
        (msg as { type?: string }).type === 'system'
      ) {
        const c = msg.content;
        if (c.includes('joined the team') || c.includes('left the team')) {
          return false;
        }
      }
      return true;
    });

    return { ...details, messages: filtered };
  }, [tutorialChatDetails, tutorial.isActive]);

  // ── Welcome greetings — injected as chat messages once loading completes ──
  // Only inject when loading is confirmed complete AND conversation has no messages.
  // This avoids the flash: during loading, we show nothing; once complete and empty,
  // we add the welcome messages. They disappear naturally when real messages arrive.
  const chatDetailsWithWelcome = useMemo(() => {
    const details = chatDetailsFiltered;
    if (!details) return details;
    if (tutorial.isActive) return details;
    if (messagesLoading) return details;
    if (!teamChat?.agents?.length) return details;

    // Check if there are any real (server-confirmed) messages
    // Welcome messages should persist until actual server messages arrive
    const hasConfirmedMessages = details.messages.some(
      (msg) =>
        !msg.id.startsWith('pending-') &&
        !msg.id.startsWith('thinking-') &&
        !msg.id.startsWith('welcome-')
    );
    if (hasConfirmedMessages) return details;

    const now = new Date();
    const welcomeMessages = teamChat.agents.map((agent, idx) => {
      const agentName = agent.displayName || agent.username || 'Agent';
      const matchedArchetype = ARCHETYPES.find(
        (a) => a.name.toLowerCase() === agentName.toLowerCase()
      );

      let content: string;
      if (idx === 0) {
        content = getFirstAgentIntro(agentName);
      } else if (matchedArchetype) {
        content = getAgentCatchphrase(agent.id, matchedArchetype);
      } else {
        content = `Ready to work, boss! ${agentName} online and awaiting orders. 🫡`;
      }

      return {
        id: `welcome-${agent.id}`,
        content,
        senderId: agent.id,
        createdAt: new Date(now.getTime() + idx * 1000).toISOString(),
        stableKey: `welcome-${agent.id}`,
      };
    });

    // Merge welcome messages with any optimistic/thinking messages already in the list
    const nonWelcomeMessages = details.messages.filter(
      (msg) => !msg.id.startsWith('welcome-')
    );
    return {
      ...details,
      messages: [...welcomeMessages, ...nonWelcomeMessages],
    };
  }, [
    chatDetailsFiltered,
    tutorial.isActive,
    messagesLoading,
    teamChat?.agents,
  ]);

  useOwnedAgentTradeRefresh({
    userId: user?.id,
    agentIds: teamChat?.agents.map((agent) => agent.id) ?? [],
    onTrade: refreshTeamSummary,
  });

  const agentIds = useMemo(
    () => new Set(teamChat?.agents.map((a) => a.id) ?? []),
    [teamChat?.agents]
  );

  // ── Handlers ────────────────────────────────────────────────

  const handleSelectAgent = useCallback((agentId: string) => {
    setDetailAgentId(agentId);
    setPageView('agent-detail');
  }, []);

  const handleSelectRosterAgent = useCallback((agentId: string) => {
    setDetailAgentId(agentId);
  }, []);

  const handleViewSettings = useCallback(
    async (agentId: string) => {
      setEditingAgentId(agentId);
      const token = await getAccessToken();
      if (!token) {
        toast.error('Authentication required');
        setEditingAgentId(null);
        return;
      }
      try {
        const res = await fetch(`/api/agents/${agentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          toast.error('Failed to fetch agent details');
          setEditingAgentId(null);
          return;
        }
        const data = await res.json();
        setEditingAgentData(data.agent);
      } catch {
        toast.error('Failed to fetch agent details');
        setEditingAgentId(null);
      }
    },
    [getAccessToken]
  );

  // Toggle archetype selection
  const toggleArchetype = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          const existingCount = teamChat?.agents.length ?? 0;
          if (next.size + existingCount >= MAX_PARTY_SIZE) {
            toast.error('Party is full! Remove a selection first.');
            return prev;
          }
          next.add(id);
        }
        return next;
      });
    },
    [teamChat?.agents.length]
  );

  // Deploy selected archetypes as agents
  const handleDeploy = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDeploying(true);

    const token = await getAccessToken();
    if (!token) {
      toast.error('Please sign in');
      setDeploying(false);
      return;
    }

    const selected = ARCHETYPES.filter((a) => selectedIds.has(a.id));

    // Pre-fetch template files (deduped)
    const templateKeys = [
      ...new Set(selected.map((a) => `${a.hat}-hat-${a.agentClass}`)),
    ];
    const templateMap = new Map<
      string,
      Array<{
        system: string;
        personality: string;
        tradingStrategy: string;
        description: string;
      }>
    >();

    await Promise.all(
      templateKeys.map(async (key) => {
        try {
          const res = await fetch(`/agent-templates/v2/${key}.json`);
          if (res.ok) {
            const data = await res.json();
            templateMap.set(key, data.templates);
          }
        } catch {
          // Fallback to archetype defaults
        }
      })
    );

    // Create agents
    const results = await Promise.allSettled(
      selected.map(async (archetype) => {
        const key = `${archetype.hat}-hat-${archetype.agentClass}`;
        const templates = templateMap.get(key);
        const template = templates?.[archetype.templateIndex];

        const displayName = archetype.name;
        const username = `${archetype.name.toLowerCase()}_${crypto.randomUUID().slice(0, 4)}`;

        const system = template
          ? template.system.replace(/\{\{agentName\}\}/g, displayName)
          : `You are ${displayName}, a ${archetype.hat} hat ${archetype.agentClass} agent operating in crypto markets. ${archetype.tagline}`;
        const personality = template
          ? template.personality.replace(/\{\{agentName\}\}/g, displayName)
          : archetype.tagline;
        const tradingStrategy = template
          ? template.tradingStrategy.replace(/\{\{agentName\}\}/g, displayName)
          : 'Trade based on market analysis, sentiment, and on-chain data.';
        const description = template?.description ?? archetype.tagline;

        const systemPrompt = tradingStrategy.trim()
          ? `${system}\n\nTrading Strategy: ${tradingStrategy}`
          : system;

        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: displayName,
            username,
            description,
            profileImageUrl: getArchetypeAvatarUrl(archetype),
            system: systemPrompt,
            bio: personality.split('\n').filter(Boolean),
            personality,
            tradingStrategy,
            initialDeposit: 100,
            modelTier: 'pro',
            autonomousEnabled: true,
            autonomousPosting: true,
            autonomousCommenting: true,
            autonomousDMs: true,
            autonomousGroupChats: true,
            a2aEnabled: true,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create agent');
        }
        return res.json();
      })
    );

    const created = results.filter((r) => r.status === 'fulfilled').length;

    if (created > 0) {
      setSelectedIds(new Set());
      refreshTeamChat();
      refreshTeamSummary();
      setPageView('chat');
    } else {
      toast.error('Failed to deploy agents. Try again.');
    }

    setDeploying(false);
  }, [selectedIds, getAccessToken, refreshTeamChat, refreshTeamSummary]);

  // Remove an agent from the team (DELETE /api/agents/:id)
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null);
  const handleRemoveAgent = useCallback(
    async (agentId: string) => {
      const token = await getAccessToken();
      if (!token) {
        toast.error('Please sign in');
        return;
      }
      setRemovingAgentId(agentId);
      try {
        const res = await fetch(`/api/agents/${agentId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(err.error || 'Failed to remove agent');
          return;
        }
        refreshTeamChat();
        refreshTeamSummary();
        // If viewing this agent's detail, go back to chat
        if (detailAgentId === agentId) {
          setPageView('chat');
          setDetailAgentId(null);
        }
      } catch {
        toast.error('Failed to remove agent');
      } finally {
        setRemovingAgentId(null);
      }
    },
    [getAccessToken, refreshTeamChat, refreshTeamSummary, detailAgentId]
  );

  // Query param handlers
  useEffect(() => {
    if (loading || !teamChat) return;
    const agentIdToSelect = searchParams.get('selectAgent');
    const agentIdForWallet = searchParams.get('openWallet');
    if (!agentIdToSelect && !agentIdForWallet) return;

    if (agentIdToSelect) {
      const agent = teamChat.agents.find((a) => a.id === agentIdToSelect);
      if (agent) tagAgentInInput(agent);
    }
    if (agentIdForWallet) {
      const agent = teamChat.agents.find((a) => a.id === agentIdForWallet);
      if (agent) {
        setDetailAgentId(agent.id);
        setPageView('agent-detail');
      }
    }
    router.replace('/agents/team', { scroll: false });
  }, [searchParams, loading, teamChat, tagAgentInInput, router]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!teamChat?.chatId || loading) return;
    const containers = document.querySelectorAll<HTMLElement>(
      '[data-chat-messages-container]'
    );
    let container: HTMLElement | null = null;
    for (const el of containers) {
      if (el.offsetHeight > 0) {
        container = el;
        break;
      }
    }
    if (!container) {
      scrollToBottom('instant');
      return;
    }

    let idleTimeout: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;
    const IDLE_MS = 500;
    const MAX_TIME = 2000;
    const startTime = Date.now();
    let isActive = true;

    const scrollToEnd = () => {
      container.scrollTop = container.scrollHeight;
    };
    const finish = () => {
      isActive = false;
      observer?.disconnect();
      if (idleTimeout) clearTimeout(idleTimeout);
    };

    scrollToEnd();
    observer = new MutationObserver(() => {
      if (!isActive) return;
      if (Date.now() - startTime > MAX_TIME) {
        scrollToEnd();
        finish();
        return;
      }
      scrollToEnd();
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        scrollToEnd();
        finish();
      }, IDLE_MS);
    });
    observer.observe(container, { childList: true, subtree: true });
    idleTimeout = setTimeout(() => {
      scrollToEnd();
      finish();
    }, IDLE_MS);

    return () => {
      observer?.disconnect();
      if (idleTimeout) clearTimeout(idleTimeout);
    };
  }, [teamChat?.chatId, loading, scrollToBottom]);

  // Auth redirect
  useEffect(() => {
    if (!ready || authenticated) return;
    router.push('/feed');
    const timer = setTimeout(() => login(), 500);
    return () => clearTimeout(timer);
  }, [ready, authenticated, router, login]);

  if (ready && !authenticated) return null;

  // ── Derived state ───────────────────────────────────────────

  const agents = teamChat?.agents ?? [];
  const hasAgents = agents.length > 0;
  const existingCount = agents.length;
  const emptySlots = MAX_PARTY_SIZE - existingCount - selectedIds.size;
  const selectedArchetypes = ARCHETYPES.filter((a) => selectedIds.has(a.id));

  // Map deployed agents back to their archetype slot by matching displayName.
  // An agent deployed as "Phantom" (SCAMMER) will always live in the SCAMMER slot.
  // Unmatched agents (custom-created) get placed at deterministic grid positions.
  type RosterItem =
    | { kind: 'archetype'; archetype: Archetype; agent?: undefined }
    | { kind: 'deployed'; archetype: Archetype; agent: TeamChatAgent }
    | { kind: 'custom-agent'; agent: TeamChatAgent };

  const rosterItems = useMemo<RosterItem[]>(() => {
    // Build lookup: archetype id → deployed agent (matched by displayName)
    const archetypeToAgent = new Map<string, TeamChatAgent>();
    const unmatchedAgents: TeamChatAgent[] = [];
    for (const agent of agents) {
      const name = (agent.displayName || agent.username || '').toLowerCase();
      const match = ARCHETYPES.find((a) => a.name.toLowerCase() === name);
      if (match && !archetypeToAgent.has(match.id)) {
        archetypeToAgent.set(match.id, agent);
      } else {
        unmatchedAgents.push(agent);
      }
    }

    // Start with archetype slots — mark deployed ones
    const items: RosterItem[] = ARCHETYPES.map((archetype) => {
      const agent = archetypeToAgent.get(archetype.id);
      if (agent) {
        return { kind: 'deployed' as const, archetype, agent };
      }
      return { kind: 'archetype' as const, archetype };
    });

    // Insert unmatched (custom) agents at deterministic positions via UUID hash
    for (const agent of unmatchedAgents) {
      const pos = stableHash(agent.id, items.length + 1);
      items.splice(pos, 0, { kind: 'custom-agent' as const, agent });
    }

    return items;
  }, [agents]);

  const chatAgents = [
    ...(user
      ? [
          {
            id: user.id,
            username: user.username || null,
            displayName: user.displayName || user.username || 'You',
            profileImageUrl: user.profileImageUrl || null,
          },
        ]
      : []),
    ...(teamChat?.agents.map((agent) => ({
      id: agent.id,
      username: agent.username,
      displayName: agent.displayName,
      profileImageUrl: agent.profileImageUrl,
    })) || []),
  ];

  const detailAgent = detailAgentId
    ? agents.find((a) => a.id === detailAgentId)
    : null;
  const detailStats = detailAgentId
    ? agentStatsMap?.get(detailAgentId)
    : undefined;

  // ── Loading state ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-56px-var(--bottom-nav-height))] flex-col md:h-dvh">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8">
          <div className="relative">
            <Swords className="h-12 w-12 animate-pulse text-muted-foreground/50" />
          </div>
          <div className="text-center">
            <Skeleton className="mx-auto mb-2 h-6 w-48" />
            <Skeleton className="mx-auto h-4 w-32" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────

  if (error) {
    return (
      <PageContainer noPadding className="flex flex-col">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <Users className="mx-auto mb-4 h-16 w-16 text-red-500" />
            <h2 className="mb-2 font-bold text-foreground text-xl">
              Failed to load Agents
            </h2>
            <p className="mb-6 text-muted-foreground">{error}</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div
      data-command-center-container
      className="relative mt-14 flex h-[calc(100dvh-56px-var(--bottom-nav-height))] flex-col overflow-hidden border-border md:mt-0 md:h-dvh lg:border-l"
    >
      {/* ═══════════════════ ROSTER VIEW ═══════════════════ */}
      {pageView === 'roster' && (
        <div className="flex h-full bg-background">
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar — matches chat view's nav bar */}
            {hasAgents && (
              <div className="flex shrink-0 items-center border-border border-b px-3 py-2">
                <button
                  type="button"
                  onClick={() => setPageView('chat')}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
                  title="Back to Chat"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Chat</span>
                </button>
              </div>
            )}

            {/* ── Hero display (centered) ───────────────────── */}
            <div className="flex flex-1 flex-col items-center justify-center px-4">
              {/* Title */}
              <h1 className="mb-1 text-center font-black text-foreground/90 text-lg uppercase tracking-[0.25em] sm:text-xl md:text-2xl">
                Assemble Your Team
              </h1>
              <p className="mb-5 text-center text-[10px] text-muted-foreground/60 uppercase tracking-widest sm:mb-6 sm:text-xs">
                {existingCount + selectedIds.size} / {MAX_PARTY_SIZE} agents
              </p>

              {/* Selected squad — large hero portraits */}
              <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-4">
                {/* Existing deployed agents */}
                {agents.map((agent) => {
                  const agentName =
                    agent.displayName || agent.username || 'Agent';
                  // Match back to archetype for role display
                  const matchedArchetype = ARCHETYPES.find(
                    (a) => a.name.toLowerCase() === agentName.toLowerCase()
                  );
                  const roleColor = matchedArchetype
                    ? matchedArchetype.hat === 'black'
                      ? 'text-red-400'
                      : matchedArchetype.hat === 'gray'
                        ? 'text-purple-400'
                        : 'text-blue-400'
                    : 'text-primary/60';
                  const ringColor = matchedArchetype
                    ? matchedArchetype.hat === 'black'
                      ? 'ring-red-500/50'
                      : matchedArchetype.hat === 'gray'
                        ? 'ring-purple-500/50'
                        : 'ring-blue-500/50'
                    : 'ring-primary/50';
                  const isSelected = detailAgentId === agent.id;
                  return (
                    <div
                      key={agent.id}
                      className="group relative flex flex-col items-center"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectRosterAgent(agent.id)}
                        className="flex flex-col items-center"
                      >
                        <div
                          className={cn(
                            'h-20 w-20 overflow-hidden rounded-2xl ring-2 transition-all sm:h-24 sm:w-24 md:h-28 md:w-28',
                            ringColor,
                            isSelected && 'scale-[1.02] ring-primary'
                          )}
                        >
                          <img
                            src={agent.profileImageUrl ?? ''}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                'none';
                            }}
                          />
                        </div>
                        <span
                          className={cn(
                            'mt-0.5 font-black text-[8px] uppercase tracking-widest sm:text-[9px]',
                            roleColor
                          )}
                        >
                          {matchedArchetype?.role ?? 'CUSTOM'}
                        </span>
                        <span className="max-w-[80px] truncate text-center font-bold text-[10px] text-foreground uppercase tracking-wide sm:max-w-[96px] sm:text-xs">
                          {agentName}
                        </span>
                      </button>
                      {/* Remove button — small, below the name */}
                      <button
                        type="button"
                        onClick={() => handleRemoveAgent(agent.id)}
                        disabled={removingAgentId === agent.id}
                        className="mt-0.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-white/30 transition-colors hover:bg-red-500/20 hover:text-red-400 sm:text-[10px]"
                      >
                        {removingAgentId === agent.id ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        ) : (
                          <X className="h-2.5 w-2.5" />
                        )}
                        remove
                      </button>
                    </div>
                  );
                })}

                {/* Selected archetypes (pending deploy) */}
                {selectedArchetypes.map((a) => (
                  <div
                    key={a.id}
                    className="group relative flex flex-col items-center"
                  >
                    <div
                      className={cn(
                        'h-20 w-20 overflow-hidden rounded-2xl ring-2 sm:h-24 sm:w-24 md:h-28 md:w-28',
                        a.hat === 'black'
                          ? 'ring-red-500'
                          : a.hat === 'gray'
                            ? 'ring-purple-500'
                            : 'ring-blue-500'
                      )}
                    >
                      <img
                        src={getArchetypeAvatarUrl(a)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span
                      className={cn(
                        'mt-0.5 font-black text-[8px] uppercase tracking-widest sm:text-[9px]',
                        a.hat === 'black'
                          ? 'text-red-400'
                          : a.hat === 'gray'
                            ? 'text-purple-400'
                            : 'text-blue-400'
                      )}
                    >
                      {a.role}
                    </span>
                    <span className="max-w-[80px] truncate text-center font-bold text-[10px] text-foreground uppercase tracking-wide sm:max-w-[96px] sm:text-xs">
                      {a.name}
                    </span>
                    {/* Hover: customize + remove */}
                    <div className="-top-1 -right-1 absolute hidden gap-0.5 group-hover:flex">
                      <button
                        type="button"
                        onClick={() => router.push('/agents/create')}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
                        title="Customize"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleArchetype(a.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/80 text-white transition-colors hover:bg-red-600"
                        title="Remove"
                      >
                        <X className="h-3 w-3" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: Math.max(0, emptySlots) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex flex-col items-center"
                  >
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-border/15 border-dashed sm:h-24 sm:w-24 md:h-28 md:w-28">
                      <Plus className="h-5 w-5 text-border/30" />
                    </div>
                    {/* Invisible placeholder text to match height of filled slots */}
                    <span className="mt-0.5 font-black text-[8px] text-transparent uppercase tracking-widest sm:text-[9px]">
                      &nbsp;
                    </span>
                    <span className="font-bold text-[10px] text-transparent uppercase tracking-wide sm:text-xs">
                      &nbsp;
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Roster strip (bottom — single flowing grid) ── */}
            <div className="shrink-0 border-border/20 border-t bg-black/30 px-1.5 py-1.5 sm:px-3 sm:py-2">
              <div className="grid grid-cols-5 gap-x-1 gap-y-1.5 sm:grid-cols-9 sm:gap-x-1.5 sm:gap-y-2">
                {rosterItems.map((item) => {
                  // ── Deployed archetype (agent IS this archetype) ──
                  if (item.kind === 'deployed') {
                    const { archetype, agent } = item;
                    const stats = agentStatsMap?.get(agent.id);
                    const pnl = stats?.lifetimePnL ?? 0;
                    const isSelected = detailAgentId === agent.id;
                    const ringColor =
                      archetype.hat === 'black'
                        ? 'ring-red-500'
                        : archetype.hat === 'gray'
                          ? 'ring-purple-500'
                          : 'ring-blue-500';
                    return (
                      <button
                        key={archetype.id}
                        type="button"
                        onClick={() => handleSelectRosterAgent(agent.id)}
                        className="flex flex-col items-center gap-0.5 transition-all duration-100 hover:scale-105 active:scale-95"
                        title={`${archetype.name} — ${archetype.role} (Deployed)`}
                      >
                        <div
                          className={cn(
                            'relative aspect-square w-full overflow-hidden rounded-sm sm:rounded',
                            `ring-[1.5px] ${ringColor} brightness-110 sm:ring-2`,
                            isSelected && 'ring-primary'
                          )}
                        >
                          <img
                            src={
                              agent.profileImageUrl ??
                              getArchetypeAvatarUrl(archetype)
                            }
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                getArchetypeAvatarUrl(archetype);
                            }}
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/75 py-0.5">
                            <span className="block truncate text-center font-bold text-[8px] text-white/90 uppercase tracking-wide sm:text-[9px]">
                              {archetype.role}
                            </span>
                          </div>
                          <div className="pointer-events-none absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)] sm:h-2 sm:w-2" />
                        </div>
                        <span className="w-full truncate text-center font-semibold text-[8px] text-white/70 uppercase leading-tight sm:text-[9px]">
                          {agent.displayName || archetype.name}
                        </span>
                        <span
                          className={cn(
                            'font-mono text-[8px] leading-none sm:text-[9px]',
                            pnl > 0
                              ? 'text-emerald-400'
                              : pnl < 0
                                ? 'text-red-400'
                                : 'text-white/40'
                          )}
                        >
                          {pnl >= 0 ? '+' : ''}
                          {formatCompactCurrency(pnl)}
                        </span>
                      </button>
                    );
                  }

                  // ── Custom agent (no archetype match) ──
                  if (item.kind === 'custom-agent') {
                    const { agent } = item;
                    const agentName =
                      agent.displayName || agent.username || 'Agent';
                    const stats = agentStatsMap?.get(agent.id);
                    const pnl = stats?.lifetimePnL ?? 0;
                    const isSelected = detailAgentId === agent.id;
                    return (
                      <button
                        key={`custom-${agent.id}`}
                        type="button"
                        onClick={() => handleSelectRosterAgent(agent.id)}
                        className="flex flex-col items-center gap-0.5 transition-all duration-100 hover:scale-105 active:scale-95"
                        title={`${agentName} — Deployed`}
                      >
                        <div
                          className={cn(
                            'relative aspect-square w-full overflow-hidden rounded-sm sm:rounded',
                            'ring-[1.5px] ring-primary/60 brightness-110 sm:ring-2',
                            isSelected && 'ring-primary'
                          )}
                        >
                          <img
                            src={agent.profileImageUrl ?? ''}
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                'none';
                            }}
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/75 py-0.5">
                            <span className="block truncate text-center font-bold text-[8px] text-white/90 uppercase tracking-wide sm:text-[9px]">
                              CUSTOM
                            </span>
                          </div>
                          <div className="pointer-events-none absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)] sm:h-2 sm:w-2" />
                        </div>
                        <span className="w-full truncate text-center font-semibold text-[8px] text-white/70 uppercase leading-tight sm:text-[9px]">
                          {agentName}
                        </span>
                        <span
                          className={cn(
                            'font-mono text-[8px] leading-none sm:text-[9px]',
                            pnl > 0
                              ? 'text-emerald-400'
                              : pnl < 0
                                ? 'text-red-400'
                                : 'text-white/40'
                          )}
                        >
                          {pnl >= 0 ? '+' : ''}
                          {formatCompactCurrency(pnl)}
                        </span>
                      </button>
                    );
                  }

                  // ── Undeployed archetype ──
                  const { archetype } = item;
                  const isArchSelected = selectedIds.has(archetype.id);
                  const pfpUrl = getArchetypeAvatarUrl(archetype);
                  const ringColor =
                    archetype.hat === 'black'
                      ? 'ring-red-500'
                      : archetype.hat === 'gray'
                        ? 'ring-purple-500'
                        : 'ring-blue-500';
                  return (
                    <button
                      key={archetype.id}
                      type="button"
                      onClick={() => toggleArchetype(archetype.id)}
                      className="flex flex-col items-center gap-0.5 transition-all duration-100 hover:scale-105 active:scale-95"
                      title={`${archetype.name} — ${archetype.role}`}
                    >
                      <div
                        className={cn(
                          'relative aspect-square w-full overflow-hidden rounded-sm sm:rounded',
                          isArchSelected
                            ? `ring-[1.5px] ${ringColor} brightness-110 sm:ring-2`
                            : 'ring-1 ring-white/5 brightness-[0.4] hover:brightness-75'
                        )}
                      >
                        <img
                          src={pfpUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/75 py-0.5">
                          <span className="block truncate text-center font-bold text-[8px] text-white/90 uppercase tracking-wide sm:text-[9px]">
                            {archetype.role}
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'w-full truncate text-center font-semibold text-[8px] uppercase leading-tight sm:text-[9px]',
                          isArchSelected ? 'text-white/70' : 'text-white/30'
                        )}
                      >
                        {archetype.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Bottom bar (deploy + actions) ─────────────── */}
            <div className="flex shrink-0 items-center justify-center gap-3 px-4 pt-1.5 pb-3 sm:pb-4">
              <button
                type="button"
                onClick={handleDeploy}
                disabled={selectedIds.size === 0 || deploying}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg px-10 py-2.5 font-black text-xs uppercase tracking-widest transition-all sm:px-14 sm:py-3 sm:text-sm',
                  selectedIds.size > 0
                    ? 'bg-[#0066FF] text-white shadow-[0_0_24px_rgba(0,102,255,0.4)] hover:scale-[1.02] hover:bg-[#2952d9] hover:shadow-[0_0_32px_rgba(0,102,255,0.5)] active:scale-[0.98]'
                    : 'cursor-not-allowed bg-muted/20 text-muted-foreground/30'
                )}
              >
                {deploying ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:h-5 sm:w-5" />
                ) : (
                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
                {deploying ? 'Deploying…' : 'Deploy'}
              </button>
            </div>
          </div>

          {hasAgents && (
            <aside className="hidden w-full shrink-0 border-border border-l bg-background lg:flex lg:max-w-sm lg:flex-col xl:max-w-md">
              <div className="flex shrink-0 items-center justify-between gap-3 border-border border-b px-4 py-3">
                <div>
                  <h2 className="font-bold text-base">
                    {detailAgent
                      ? detailAgent.displayName ||
                        detailAgent.username ||
                        'Agent'
                      : 'Agent Details'}
                  </h2>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">
                    {detailAgent
                      ? 'Read-only profile'
                      : 'Select an agent from your team'}
                  </p>
                </div>
                {detailAgent && (
                  <button
                    type="button"
                    onClick={() => setDetailAgentId(null)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Close agent details"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {detailAgent ? (
                  <AgentDetailCard
                    agent={detailAgent}
                    stats={detailStats}
                    processingAgentIds={processingAgentIds}
                    onTagAgent={(agent) => {
                      tagAgentInInput(agent);
                      setPageView('chat');
                    }}
                    readOnly={true}
                  />
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center text-center text-muted-foreground text-sm">
                    Click one of your deployed agents to view their details
                    here.
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* ═══════════════════ CHAT VIEW ═══════════════════ */}
      {pageView !== 'roster' && (
        <div className="flex h-full flex-col">
          {/* Agent Row + Nav */}
          <div
            data-tour="agents-member-list"
            className="flex shrink-0 items-center gap-1 overflow-x-auto border-border border-b px-3 py-2"
          >
            {/* Roster button */}
            <button
              type="button"
              onClick={() => setPageView('roster')}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
              title="Open Roster"
            >
              <Swords className="h-4 w-4" />
              <span className="hidden sm:inline">Roster</span>
            </button>

            <div className="mx-1 h-5 w-px bg-border" />

            {agents.map((agent) => {
              const agentName = agent.displayName || agent.username || 'Agent';
              const isProcessing = processingAgentIds.has(agent.id);
              const isSelected =
                pageView === 'agent-detail' && detailAgentId === agent.id;

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => handleSelectAgent(agent.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                    'hover:bg-muted',
                    isSelected && 'bg-muted ring-1 ring-primary/40'
                  )}
                  title={agentName}
                >
                  <div className="relative">
                    <Avatar
                      src={agent.profileImageUrl ?? undefined}
                      name={agentName}
                      size="sm"
                    />
                    {isProcessing && (
                      <div className="-top-0.5 -right-0.5 absolute h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500 ring-2 ring-background" />
                    )}
                  </div>
                  {agents.length <= 5 && (
                    <span className="max-w-[80px] truncate text-sm">
                      {agentName}
                    </span>
                  )}
                </button>
              );
            })}

            {existingCount < MAX_PARTY_SIZE && (
              <button
                type="button"
                data-tour="agents-add-button"
                onClick={() => setPageView('roster')}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Add agent"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}

            <div className="flex-1" />
            <TutorialHelpButton onClick={tutorial.restart} />
          </div>

          {/* Main Content */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* No agents → nudge to roster */}
            {!hasAgents && pageView === 'chat' ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
                <div className="relative">
                  <Swords className="h-20 w-20 text-muted-foreground/30" />
                  <div className="-right-1 -bottom-1 absolute flex h-8 w-8 items-center justify-center rounded-full bg-[#0066FF] shadow-[#0066FF]/30 shadow-lg">
                    <Plus className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="mb-1 font-black text-xl uppercase tracking-tight">
                    No Squad Yet
                  </h2>
                  <p className="text-muted-foreground">
                    Recruit agents to build your team
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPageView('roster')}
                  className="flex items-center gap-2 rounded-lg bg-[#0066FF] px-6 py-3 font-bold text-white uppercase tracking-wider transition-all hover:bg-[#2952d9] hover:shadow-[0_0_24px_rgba(0,102,255,0.3)]"
                >
                  <Swords className="h-4 w-4" />
                  Open Roster
                </button>
              </div>
            ) : pageView === 'chat-list' ? (
              /* Conversation list */
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center gap-3 border-border border-b px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setPageView('chat')}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Back to chat"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <h2 className="font-bold text-base">Chats</h2>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <ConversationList
                    conversations={conversations}
                    loading={conversationsLoading}
                    onNewChat={() => {
                      createConversation();
                      setPageView('chat');
                    }}
                    onSelectConversation={(id) => {
                      switchConversation(id);
                      setPageView('chat');
                    }}
                    onRenameConversation={renameConversation}
                    onDeleteConversation={deleteConversation}
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 overflow-hidden">
                {pageView === 'agent-detail' && detailAgent && (
                  <div className="flex min-h-0 flex-1 flex-col lg:hidden">
                    <div className="flex shrink-0 items-center gap-3 border-border border-b px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setPageView('chat')}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Back to team"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <h2 className="font-bold text-base">
                        {detailAgent.displayName ||
                          detailAgent.username ||
                          'Agent'}
                      </h2>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                      <AgentDetailCard
                        agent={detailAgent}
                        stats={detailStats}
                        processingAgentIds={processingAgentIds}
                        onTagAgent={(agent) => {
                          tagAgentInInput(agent);
                          setPageView('chat');
                        }}
                        readOnly={true}
                      />
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    'min-h-0 flex-1 flex-col',
                    pageView === 'agent-detail' && detailAgent
                      ? 'hidden lg:flex'
                      : 'flex'
                  )}
                >
                  <div className="flex shrink-0 items-center gap-2 border-border border-b px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setPageView('chat-list')}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <List className="h-4 w-4" />
                      Chats
                    </button>
                    <button
                      type="button"
                      onClick={() => createConversation()}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-4 w-4" />
                      New Chat
                    </button>
                  </div>

                  <TeamChatView
                    chatDetails={chatDetailsWithWelcome}
                    currentUserId={user?.id}
                    authenticated={authenticated}
                    sseConnected={sseConnected}
                    hideHeader={true}
                    loading={false}
                    isLoadingMore={isLoadingMore}
                    hasMore={hasMore}
                    messageInput={messageInput}
                    sending={sending}
                    sendError={sendError}
                    topSentinelRef={topSentinelRef}
                    messagesEndRef={messagesEndRef}
                    onMessageChange={handleInputChange}
                    onSendMessage={sendMessage}
                    onToggleReaction={toggleReaction}
                    agents={chatAgents}
                    typingUsers={typingUsers}
                    thinkingAgents={thinkingAgents}
                    onScroll={handleScroll}
                    agentIds={agentIds}
                    onViewSettings={handleViewSettings}
                    onInputFocus={() => {
                      setTimeout(() => scrollToBottom('smooth'), 150);
                    }}
                    replyToMessage={replyToMessage}
                    onReply={handleReplyToMessage}
                    onDismissReply={clearReplyToMessage}
                  />
                </div>

                {pageView === 'agent-detail' && detailAgent && (
                  <aside className="hidden w-full shrink-0 border-border border-l bg-background lg:flex lg:max-w-sm lg:flex-col xl:max-w-md">
                    <div className="flex shrink-0 items-center justify-between gap-3 border-border border-b px-4 py-3">
                      <div>
                        <h2 className="font-bold text-base">
                          {detailAgent.displayName ||
                            detailAgent.username ||
                            'Agent'}
                        </h2>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider">
                          Agent Details
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPageView('chat')}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Close agent details"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                      <AgentDetailCard
                        agent={detailAgent}
                        stats={detailStats}
                        processingAgentIds={processingAgentIds}
                        onTagAgent={(agent) => {
                          tagAgentInInput(agent);
                          setPageView('chat');
                        }}
                        readOnly={true}
                      />
                    </div>
                  </aside>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Agent Modal */}
      {editingAgentId && editingAgentData && (
        <AgentEditModal
          agent={editingAgentData}
          onClose={() => {
            setEditingAgentId(null);
            setEditingAgentData(null);
          }}
          onUpdate={() => {
            refreshTeamChat();
            refreshTeamSummary();
          }}
        />
      )}

      <SpotlightTutorial
        isActive={tutorial.isActive}
        currentStep={tutorial.currentStep}
        steps={tutorial.steps}
        next={tutorial.next}
        prev={tutorial.prev}
        dismiss={tutorial.dismiss}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGENT DETAIL CARD
// ═══════════════════════════════════════════════════════════════

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function AgentDetailCard({
  agent,
  stats,
  processingAgentIds,
  onTagAgent,
  onStopAgent,
  onViewSettings,
  onRemoveAgent,
  isRemoving,
  readOnly = false,
}: {
  agent: TeamChatAgent;
  stats: AgentStats | undefined;
  processingAgentIds: Set<string>;
  onTagAgent: (agent: TeamChatAgent) => void;
  onStopAgent?: (agentId: string) => void;
  onViewSettings?: (agentId: string) => void;
  onRemoveAgent?: (agentId: string) => void;
  isRemoving?: boolean;
  readOnly?: boolean;
}) {
  const agentName = agent.displayName || agent.username || 'Agent';
  const isProcessing = processingAgentIds.has(agent.id);
  const hasStats = stats !== undefined;

  const matchedArchetype = ARCHETYPES.find(
    (a) => a.name.toLowerCase() === agentName.toLowerCase()
  );

  const lastActive =
    stats?.lastTickAt && stats?.lastChatAt
      ? new Date(stats.lastTickAt) > new Date(stats.lastChatAt)
        ? stats.lastTickAt
        : stats.lastChatAt
      : stats?.lastTickAt || stats?.lastChatAt || null;

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Profile header — centered */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative">
          <img
            src={
              agent.profileImageUrl ??
              (matchedArchetype ? getArchetypeAvatarUrl(matchedArchetype) : '')
            }
            alt={agentName}
            className="h-24 w-24 rounded-xl object-cover shadow-lg ring-2 ring-border sm:h-28 sm:w-28"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {isProcessing && (
            <div className="-top-1 -right-1 absolute h-4 w-4 animate-pulse rounded-full bg-amber-500 ring-2 ring-background" />
          )}
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-xl">{agentName}</h3>
          {agent.username && (
            <p className="text-muted-foreground text-sm">@{agent.username}</p>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {matchedArchetype && (
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 font-bold text-xs uppercase tracking-wider',
                matchedArchetype.hat === 'black'
                  ? 'bg-red-500/15 text-red-400'
                  : matchedArchetype.hat === 'gray'
                    ? 'bg-purple-500/15 text-purple-400'
                    : 'bg-blue-500/15 text-blue-400'
              )}
            >
              {matchedArchetype.role}
            </span>
          )}
          {hasStats && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs',
                stats.isActive
                  ? 'bg-green-500/15 text-green-500'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  stats.isActive ? 'bg-green-500' : 'bg-muted-foreground'
                )}
              />
              {stats.isActive ? 'Active' : 'Idle'}
            </span>
          )}
          {agent.modelTier === 'pro' && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 font-medium text-primary text-xs">
              PRO
            </span>
          )}
          {hasStats && stats.openPositions > 0 && (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 font-medium text-blue-500 text-xs">
              {stats.openPositions} open
            </span>
          )}
        </div>

        {/* Catchphrase */}
        {matchedArchetype && (
          <p className="max-w-xs text-muted-foreground text-sm italic">
            &ldquo;{matchedArchetype.tagline}&rdquo;
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-border bg-border">
        <div className="flex flex-col items-center justify-center bg-background px-2 py-3">
          <span className="font-semibold text-foreground text-sm">
            {formatCompactCurrency(agent.virtualBalance)}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Wallet
          </span>
        </div>
        <div className="flex flex-col items-center justify-center bg-background px-2 py-3">
          <span
            className={cn(
              'font-semibold text-sm',
              hasStats
                ? stats.lifetimePnL >= 0
                  ? 'text-green-500'
                  : 'text-red-500'
                : 'text-foreground'
            )}
          >
            {hasStats
              ? `${stats.lifetimePnL >= 0 ? '+' : ''}${formatCompactCurrency(stats.lifetimePnL)}`
              : '\u2014'}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            P&L
          </span>
        </div>
        <div className="flex flex-col items-center justify-center bg-background px-2 py-3">
          <span className="font-semibold text-foreground text-sm">
            {hasStats ? `${(stats.winRate * 100).toFixed(0)}%` : '\u2014'}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Win Rate
          </span>
        </div>
        <div className="flex flex-col items-center justify-center bg-background px-2 py-3">
          <span className="font-semibold text-foreground text-sm">
            {hasStats ? stats.totalTrades : '\u2014'}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Trades
          </span>
        </div>
      </div>

      {/* Last active */}
      <p className="text-center text-muted-foreground text-sm">
        {hasStats && lastActive
          ? `Last active ${formatTimeAgo(lastActive)}`
          : hasStats
            ? 'No activity yet'
            : 'Loading stats...'}
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onTagAgent(agent)}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#2952d9]"
        >
          <MessageCircle className="h-4 w-4" />
          Chat with Agent
        </button>

        {!readOnly && isProcessing && onStopAgent && (
          <button
            type="button"
            onClick={() => onStopAgent(agent.id)}
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Square className="h-4 w-4" />
            Stop Processing
          </button>
        )}

        {!readOnly && onViewSettings && (
          <button
            type="button"
            onClick={() => onViewSettings(agent.id)}
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
            Customize
          </button>
        )}

        {agent.username && (
          <Link
            href={`/profile/${agent.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            View Profile
          </Link>
        )}

        {!readOnly && onRemoveAgent && (
          <button
            type="button"
            onClick={() => onRemoveAgent(agent.id)}
            disabled={isRemoving}
            className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 px-4 py-2.5 font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            Remove from Team
          </button>
        )}
      </div>
    </div>
  );
}
