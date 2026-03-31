import type { PackManifest } from '@babylon/shared';
import { correlations } from './correlations';

/**
 * The 30 Under 30: House of Cards pack manifest.
 *
 * 30 fictional scammer CEOs competing in prediction markets while their
 * companies slowly collapse, their lies unravel, and their feuds escalate.
 */
export const manifest: PackManifest = {
  id: 'corporate-30-under-30',
  name: '30 Under 30: House of Cards',
  description:
    "Silicon Valley's most promising young founders are all secretly terrible people. Fake metrics, Ponzi schemes, SEC investigations, and unhinged Twitter beefs.",
  version: '1.0.0',
  tone: 'satirical',
  premise:
    '30 fictional tech founders compete in prediction markets while their companies slowly collapse, their lies unravel, and their feuds escalate.',

  actorIds: [
    'chad-sterling',
    'priya-kapoor',
    'brock-whitfield',
    'luna-reyes',
    'jasper-thorne',
    'zara-okonkwo',
    'max-chen',
    'sienna-blake',
    'duke-morrison',
    'mika-tanaka',
    'rio-vasquez',
    'elle-fontaine',
    'viktor-koval',
    'harper-reid',
    'axel-frost',
    'destiny-washington',
    'rex-calloway',
    'nova-sinclair',
    'kai-zhang',
    'juno-park',
    'colt-baker',
    'iris-chen',
    'marco-deluca',
    'serena-wright',
    'felix-nguyen',
    'talia-morgan',
    'dante-russo',
    'aria-kim',
    'wolf-henderson',
    'quinn-taylor',
  ],

  organizationIds: [
    'sterling-ventures',
    'neuraspark',
    'omnichain',
    'verdana-health',
    'aphelion-capital',
    'kibali-mining-tech',
    'velocity-labs',
    'lumen-ai',
    'titan-defense-tech',
    'sakura-robotics',
    'casablock',
    'maison-protocol',
    'meridian-systems',
    'bloom-therapeutics',
    'polar-capital',
    'eduverse',
    'apex-dynamics',
    'aether-energy',
    'dragonpay',
    'stellar-commerce',
    'ironclad-security',
    'verdant-ai',
    'olympus-media',
    'catalyst-bio',
    'nimbus-cloud',
    'prism-analytics',
    'forge-capital',
    'harmonyos',
    'atlas-logistics',
    'zenith-labs',
  ],

  rivalries: [
    // Fund managers with opposing philosophies
    ['chad-sterling', 'axel-frost'],
    // Competing AI founders
    ['priya-kapoor', 'sienna-blake'],
    // Cybersecurity rivals
    ['viktor-koval', 'colt-baker'],
    // Ethics vs profit in sustainability
    ['iris-chen', 'zara-okonkwo'],
    // Philosophy bros
    ['jasper-thorne', 'destiny-washington'],
    // Competing biotech/health founders
    ['serena-wright', 'luna-reyes'],
    // Data/media manipulation rivals
    ['talia-morgan', 'marco-deluca'],
    // Finance world feuds
    ['kai-zhang', 'dante-russo'],
    // Robotics vs logistics (automation debate)
    ['mika-tanaka', 'wolf-henderson'],
    // Crypto delusionals
    ['brock-whitfield', 'rio-vasquez'],
    // Clean energy vs mining
    ['nova-sinclair', 'zara-okonkwo'],
    // Growth hacker vs ethical AI
    ['juno-park', 'iris-chen'],
  ],

  orgPriorities: {
    major: [
      'sterling-ventures',
      'neuraspark',
      'aphelion-capital',
      'sakura-robotics',
      'dragonpay',
      'stellar-commerce',
      'catalyst-bio',
      'meridian-systems',
      'prism-analytics',
      'polar-capital',
    ],
    secondary: [
      'aether-energy',
      'lumen-ai',
      'kibali-mining-tech',
      'atlas-logistics',
      'harmonyos',
      'nimbus-cloud',
    ],
    media: ['olympus-media'],
  },

  correlations,

  capitalAllocation: {
    tierAmounts: {
      S_TIER: 300000,
      A_TIER: 100000,
      B_TIER: 40000,
    },
    roleMultipliers: {
      ceo: 1.5,
      founder: 1.3,
    },
    domainMultipliers: {
      finance: 1.5,
      crypto: 1.2,
      tech: 1.0,
    },
  },
};
