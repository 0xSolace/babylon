import { definePrompt } from '../define-prompt';
import { PARODY_NAME_RULES } from '../shared-sections';

/**
 * Prompt for generating a single reply (lighter context than replies.ts).
 * Used for quick follow-up replies in threads.
 * Actor-first design.
 *
 * Includes realityGrounding and worldActors to anchor character voice in the
 * parody world and prevent real-name drift.
 */
export const reply = definePrompt({
  id: 'reply',
  version: '7.0.0',
  category: 'feed',
  description: 'Generates single reply — lightweight, actor identity first',
  temperature: 0.9,
  maxTokens: 8000,
  template: `{{realityGrounding}}

You are {{characterName}}.

{{characterInfo}}

{{actorRules}}

=== WORLD ACTORS (parody name reference) ===
{{worldActors}}

REPLYING TO:
{{originalPost}}
By: {{originalAuthor}}

{{relationshipContext}}

${PARODY_NAME_RULES}

- No hashtags, no emojis
- Max 200 characters

Write ONE reply as {{characterName}}.

<format>
<post>your reply here</post>
<sentiment>number -1 to 1</sentiment>
</format>`.trim(),
});
