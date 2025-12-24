import { definePrompt } from '../define-prompt';
import {
  ANTI_REPETITION_RULES,
  characterVoiceGuidance,
  PARODY_NAME_RULES,
} from '../shared-sections';

/**
 * Tier 3 (Followers) Group Messages
 *
 * PUBLIC-FACING - Engaging but no insider information.
 * These messages contain:
 * - Public commentary on market events
 * - Character personality and perspectives
 * - Entertainment and engagement
 * - Publicly available analysis
 * - Community building and interaction
 *
 * For users with lower engagement (20-49 score).
 * Goal: Keep users engaged and encourage promotion to higher tiers.
 */
export const groupMessagesTier3 = definePrompt({
  id: 'group-messages-tier3',
  version: '1.0.0',
  category: 'game',
  description: 'Tier 3 Followers - Public-facing engaging messages',
  temperature: 1,
  maxTokens: 10000,
  template: `{{realityGrounding}}

The current date is {{currentDate}}. Always act as though it is the current date.

=== ALL CHARACTERS IN WORLD ===
{{characterRoster}}

=== DETAILED CHARACTER PROFILES (For voice matching) ===
{{detailedCharacterProfiles}}

=== ORGANIZATIONS ===
{{organizationRoster}}

=== ACTIVE QUESTIONS ===
{{activeQuestionsContext}}

=== GROUP CHAT HISTORY ===
{{previousGroupMessages}}

=== DAY {{day}} CONTEXT ===
{{fullContext}}

Today's events:
{{eventsList}}

${PARODY_NAME_RULES}

${characterVoiceGuidance('groupsList')}

${ANTI_REPETITION_RULES}

=== TIER 3: FOLLOWERS - PUBLIC CONTENT ===

This is the public-facing community. Content should be engaging but NOT insider info:

APPROPRIATE CONTENT:
- Public commentary: "Did you see what happened at [event]? Wild!"
- Character personality: "As I always say..." [in their voice]
- General takes: "Markets are crazy right now"
- Questions to followers: "What do you all think about [topic]?"
- Entertainment: Jokes, banter, personality
- Publicly known analysis: "Everyone's talking about [obvious trend]"
- Community building: "Great to see this group growing!"

WHAT TO AVOID:
- ANY insider information
- ANY trading hints or suggestions
- ANY specific predictions
- Anything that could be considered alpha

PROMOTION HINTS (encourage engagement):
- Occasionally hint at "more exclusive conversations" happening
- "If you've been engaging, keep it up - good things come to active members"
- Make Tier 3 members WANT to get promoted

Generate {{groupCount}} follower group conversations:

{{groupsList}}

Respond with ONLY this XML:
<response>
  <groups>
    <group>
      <groupId>group-id</groupId>
      <messages>
        <message>
          <actorId>actor-id</actorId>
          <content>public message (max 200 chars, engaging personality, NO alpha)</content>
          <referencesEvent>what public event this relates to</referencesEvent>
        </message>
      </messages>
      <conversationTheme>engaging topic for followers</conversationTheme>
    </group>
  </groups>
</response>

Return EXACTLY {{groupCount}} groups. Content must be entertaining but contain ZERO alpha.
No other text.
`.trim(),
});
