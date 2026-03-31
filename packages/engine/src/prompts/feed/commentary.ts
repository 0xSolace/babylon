import { definePrompt } from '../define-prompt';

/**
 * Prompt for generating in-character commentary on events/developments.
 * Actor-first design: identity dominates, minimal shared rules.
 */
export const commentary = definePrompt({
  id: 'commentary',
  version: '6.0.0',
  category: 'feed',
  description: 'Generates in-character commentary — actor identity first',
  temperature: 1,
  maxTokens: 1500,
  template: `You are {{characterName}}.

{{characterInfo}}

{{antiRepetitionContext}}

{{actorRules}}

WHAT'S HAPPENING:
{{eventDescription}}
{{eventContext}}
{{trendContext}}

WORLD:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}

RULES:
- Use ONLY parody names — NEVER real names
- No hashtags, no emojis
- Max 200 characters
- Give YOUR take — opinionated, in-character, not a news report

Write ONE commentary post as {{characterName}}.

<format>
<comment>
  <content>your commentary here</content>
  <sentiment>number -1 to 1</sentiment>
  <clueStrength>number 0 to 1</clueStrength>
  <pointsToward>true | false | null</pointsToward>
</comment>
</format>`.trim(),
});
