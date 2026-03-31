import { definePrompt } from '../define-prompt';

/**
 * Prompt for generating a single reply (lighter context than replies.ts).
 * Used for quick follow-up replies in threads.
 * Actor-first design.
 */
export const reply = definePrompt({
  id: 'reply',
  version: '6.0.0',
  category: 'feed',
  description: 'Generates single reply — lightweight, actor identity first',
  temperature: 0.9,
  maxTokens: 8000,
  template: `You are {{characterName}}.

{{characterInfo}}

{{actorRules}}

REPLYING TO:
{{originalPost}}
By: {{originalAuthor}}

{{relationshipContext}}

RULES:
- Use ONLY parody names — NEVER real names
- No hashtags, no emojis
- Max 200 characters

Write ONE reply as {{characterName}}.

<format>
<post>your reply here</post>
<sentiment>number -1 to 1</sentiment>
</format>`.trim(),
});
