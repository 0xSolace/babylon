import { definePrompt } from '../define-prompt';
import {
  ANTI_REPETITION_RULES,
  characterVoiceGuidance,
  PARODY_NAME_RULES,
} from '../shared-sections';

/**
 * Tier 1 (Inner Circle) Group Messages
 *
 * FULL ALPHA - The most exclusive insider information.
 * These messages contain:
 * - Specific trading positions and exact amounts
 * - Confidential company data (revenues, deals)
 * - Advance knowledge of market-moving events
 * - Coordination of market strategies
 * - Real insider knowledge that affects trading
 *
 * Only the top 12 most engaged users per NPC see these.
 */
export const groupMessagesTier1 = definePrompt({
  id: 'group-messages-tier1',
  version: '1.0.0',
  category: 'game',
  description: 'Tier 1 Inner Circle - Full alpha insider messages',
  temperature: 1,
  maxTokens: 20000,
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

=== COMPLETE NARRATIVE CONTEXT ===
{{richGameContext}}

=== FULL EVENT HISTORY ===
{{eventTimeline}}

=== RESOLVED QUESTIONS (Known facts) ===
{{resolvedQuestionsContext}}

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
{{recentEventContext}}

${PARODY_NAME_RULES}

${characterVoiceGuidance('groupsList')}

${ANTI_REPETITION_RULES}

=== TIER 1: INNER CIRCLE - FULL ALPHA ===

This is the MOST EXCLUSIVE group. Members are trusted insiders.
Share information that could ACTUALLY move markets:

MANDATORY ALPHA CONTENT:
- EXACT trading positions: "Just went long $50k on [ticker] before the news drops"
- Specific numbers: "Our Q3 revenue is $2.3B but we're announcing $2.1B publicly"
- Advance knowledge: "The merger announcement is Tuesday, not Wednesday like press thinks"
- Source information: "My contact at [company] confirmed the deal is dead"
- Coordination: "We're all selling at 3pm when the rumor hits"
- Vulnerabilities: "Our balance sheet is a disaster, getting out before anyone notices"
- Real strategy: "Publicly I'm bullish but privately I'm hedging everything"

WHAT MAKES TIER 1 SPECIAL:
- Information here is ACTIONABLE - members can trade on it
- Specific amounts, dates, and names
- Things that would be securities fraud if public
- Trust-based sharing between insiders
- The kind of alpha that makes real money

Generate {{groupCount}} private group conversations:

{{groupsList}}

Respond with ONLY this XML:
<response>
  <groups>
    <group>
      <groupId>group-id</groupId>
      <messages>
        <message>
          <actorId>actor-id</actorId>
          <content>private message (max 200 chars, in character voice, INCLUDE SPECIFIC ALPHA)</content>
          <referencesEvent>what event/question this relates to</referencesEvent>
          <alphaType>position|insider|coordination|advance-knowledge</alphaType>
        </message>
      </messages>
      <conversationTheme>what insider topic is being discussed</conversationTheme>
      <alphaValue>how actionable is this info (1-10)</alphaValue>
    </group>
  </groups>
</response>

Return EXACTLY {{groupCount}} groups. Every message MUST contain actionable alpha.
No other text.
`.trim(),
});
