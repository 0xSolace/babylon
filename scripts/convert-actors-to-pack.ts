/**
 * Convert ActorData and Organization records from @babylon/engine
 * into PackActor / PackOrganization JSON files for pack-default.
 *
 * Usage:  bun run scripts/convert-actors-to-pack.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { actors } from '../packages/engine/src/data/actors';
import { organizations } from '../packages/engine/src/data/organizations';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const PACK_ROOT = resolve(__dirname, '../packages/pack-default/src');
const ACTORS_DIR = resolve(PACK_ROOT, 'actors');
const ORGS_DIR = resolve(PACK_ROOT, 'organizations');

mkdirSync(ACTORS_DIR, { recursive: true });
mkdirSync(ORGS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMMON_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'at',
  'by',
  'from',
  'as',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'out',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'because',
  'if',
  'while',
  'about',
  'up',
  'its',
  'it',
  'he',
  'she',
  'they',
  'them',
  'his',
  'her',
  'their',
  'this',
  'that',
  'these',
  'those',
  'who',
  'whom',
  'which',
  'what',
]);

function extractAdjectives(personality: string | undefined): string[] {
  if (!personality) return [];
  return personality
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z-]/g, ''))
    .filter((w) => w.length > 2 && !COMMON_WORDS.has(w));
}

type TemperatureKeyword = readonly [readonly string[], number];

const TEMPERATURE_MAP: TemperatureKeyword[] = [
  [['chaotic', 'erratic', 'wild', 'unhinged', 'manic'], 0.95],
  [
    ['provocative', 'controversial', 'aggressive', 'narcissist', 'showman'],
    0.9,
  ],
  [['eccentric', 'quirky', 'unique', 'visionary'], 0.85],
  [['analytical', 'data', 'technical', 'academic'], 0.7],
  [['corporate', 'professional', 'measured', 'executive'], 0.6],
];

function mapTemperature(personality: string | undefined): number {
  if (!personality) return 0.8;
  const lower = personality.toLowerCase();
  for (const [keywords, temp] of TEMPERATURE_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return temp;
  }
  return 0.8;
}

// ---------------------------------------------------------------------------
// Convert actors
// ---------------------------------------------------------------------------

let actorCount = 0;

for (const actor of actors) {
  const description = actor.description ?? '';
  const pfpDescription = actor.pfpDescription ?? '';
  const personality = actor.personality ?? '';
  const name = actor.name;

  const system = [
    description,
    '',
    `Physical appearance: ${pfpDescription}`,
    '',
    'You participate in prediction markets, social interactions, and autonomous trading.',
    'You maintain your personality while engaging with users and other agents.',
  ].join('\n');

  const packActor = {
    id: actor.id,
    name: actor.name,
    realName: actor.realName,
    username: actor.username,
    originalFirstName: actor.originalFirstName,
    originalLastName: actor.originalLastName,
    originalHandle: actor.originalHandle,
    firstName: actor.firstName,
    lastName: actor.lastName,

    // Core character fields
    system,
    bio: [description, `Physical: ${pfpDescription}`],
    lore: [description],
    topics: actor.domain ?? [],
    adjectives: extractAdjectives(actor.personality),
    style: {
      all: [
        `Stay in character as ${name}`,
        `Maintain ${personality} personality`,
      ],
      chat: [
        'Respond in character',
        `Use natural conversational tone matching ${personality}`,
      ],
      post: [actor.postStyle ?? ''],
    },
    messageExamples: [] as string[],
    postExamples: actor.postExample ?? [],

    // Settings
    settings: {
      temperature: mapTemperature(actor.personality),
      maxTokens: 1100,
      model: undefined,
    },

    // Babylon-specific
    babylon: {
      alignment: 'neutral' as const,
      team: 'gray' as const,
      scamProfile: 'wary' as const,
      competence: 'mid' as const,
      tradingStyle: 'balanced' as const,
      socialStyle: personality,
      autonomy: {
        trading: true,
        posting: true,
        commenting: true,
        dms: true,
        groups: true,
      },
      datasetTags: [
        `tier:${actor.tier ?? 'C_TIER'}`,
        ...(actor.domain ?? []).map((d: string) => `domain:${d}`),
        `personality:${personality}`,
      ],
    },

    // Carry-through fields
    description,
    profileDescription: actor.profileDescription,
    pfpDescription: actor.pfpDescription,
    profileBanner: actor.profileBanner,
    domain: actor.domain,
    ignoreTopics: actor.ignoreTopics,
    engagementThreshold: actor.engagementThreshold,
    personality: actor.personality,
    tier: actor.tier,
    hasPool: actor.hasPool,
    affiliations: actor.affiliations,
    postStyle: actor.postStyle,
    voice: actor.voice,
    postExample: actor.postExample,
  };

  const filePath = resolve(ACTORS_DIR, `${actor.id}.json`);
  writeFileSync(filePath, JSON.stringify(packActor, null, 2) + '\n');
  actorCount++;
}

// ---------------------------------------------------------------------------
// Convert organizations
// ---------------------------------------------------------------------------

let orgCount = 0;

for (const org of organizations) {
  const packOrg = {
    id: org.id,
    name: org.name,
    ticker: org.ticker,
    description: org.description,
    profileDescription: org.profileDescription,
    type: org.type,
    canBeInvolved: org.canBeInvolved,
    postStyle: org.postStyle,
    postExample: org.postExample,
    initialPrice: org.initialPrice,
    pfpDescription: org.pfpDescription,
    bannerDescription: org.bannerDescription,
    originalName: org.originalName,
    originalHandle: org.originalHandle,
    username: org.username,
  };

  const filePath = resolve(ORGS_DIR, `${org.id}.json`);
  writeFileSync(filePath, JSON.stringify(packOrg, null, 2) + '\n');
  orgCount++;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`Wrote ${actorCount} actor files to ${ACTORS_DIR}`);
console.log(`Wrote ${orgCount} organization files to ${ORGS_DIR}`);
console.log(`Total: ${actorCount + orgCount} files`);
