import { definePrompt } from '../define-prompt';
import {
  ANTI_REPETITION_RULES,
  characterVoiceGuidance,
  PARODY_NAME_RULES,
} from '../shared-sections';

/**
 * Tier 2 (Community) Group Messages
 *
 * PARTIAL ALPHA - Valuable but less specific information.
 * These messages contain:
 * - General market sentiment and trends
 * - Directional hints without specific amounts
 * - Industry insights and analysis
 * - Character opinions on active questions
 * - Some insider perspective but not exact data
 *
 * For users with medium engagement (50-79 score).
 */
export const groupMessagesTier2 = definePrompt({
  id: 'group-messages-tier2',
  version: '1.0.0',
  category: 'game',
  description: 'Tier 2 Community - Partial alpha messages',
  temperature: 1,
  maxTokens: 15000,
  template: `{{realityGrounding}}

The current date is {{currentDate}}. Always act as though it is the current date.

=== ALL CHARACTERS IN WORLD ===
{{characterRoster}}

=== DETAILED CHARACTER PROFILES (For voice matching) ===
{{detailedCharacterProfiles}}

=== CHARACTER RELATIONSHIPS ===
{{relationshipContext}}

=== ORGANIZATIONS ===
{{organizationRoster}}

=== NARRATIVE CONTEXT ===
{{richGameContext}}

=== ACTIVE QUESTIONS (What they might discuss) ===
{{activeQuestionsContext}}

=== GROUP CHAT HISTORY (Previous conversations) ===
{{previousGroupMessages}}

=== DAY {{day}} CONTEXT ===
{{fullContext}}
{{scenarioContext}}
{{questionContext}}

Today's events:
{{eventsList}}

${PARODY_NAME_RULES}

${characterVoiceGuidance('groupsList')}

${ANTI_REPETITION_RULES}

=== TIER 2: COMMUNITY - PARTIAL ALPHA ===

This is a trusted but wider community. Share valuable insights without exact details:

APPROPRIATE CONTENT:
- Directional hints: "I'm feeling bearish on tech this week"
- Industry insights: "The sector is about to consolidate"
- Sentiment analysis: "Smart money is moving out of [sector]"
- Opinion on questions: "I think the merger will happen, but timing is unclear"
- General strategy: "Now's a good time to be defensive"
- Hints without specifics: "Something big is coming next week"
- Character perspectives: "My read on the situation is..."

WHAT TO AVOID (save for Tier 1):
- Exact dollar amounts or positions
- Specific dates or times
- Named sources or contacts
- Coordination of trading
- Actual insider data

Generate {{groupCount}} community group conversations:

{{groupsList}}

Respond with ONLY this XML:
<response>
  <groups>
    <group>
      <groupId>group-id</groupId>
      <messages>
        <message>
          <actorId>actor-id</actorId>
          <content>community message (max 200 chars, in character voice, hints but no specifics)</content>
          <referencesEvent>what event/question this relates to</referencesEvent>
        </message>
      </messages>
      <conversationTheme>what market trend or insight is being discussed</conversationTheme>
    </group>
  </groups>
</response>

Return EXACTLY {{groupCount}} groups. Messages should be insightful but not actionable alpha.
No other text.
`.trim(),
});
