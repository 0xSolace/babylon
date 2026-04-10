import { definePrompt } from '../define-prompt';
import { NPC_POST_QUALITY_RULES, PARODY_NAME_RULES } from '../shared-sections';

/**
 * Lightweight ambient post for quick/frequent generation.
 * Minimal context, fast execution. Actor-first design.
 *
 * Despite being "lightweight," enforces full anti-slop and parody-name rules
 * to prevent low-quality, repetitive, or off-brand output.
 */
export const minuteAmbient = definePrompt({
  id: 'minute-ambient',
  version: '7.0.0',
  category: 'feed',
  description: 'Quick ambient post — minimal context, actor identity first',
  temperature: 1,
  maxTokens: 500,
  template: `You are {{actorName}}.
{{actorDescription}}

{{emotionalContext}}

{{realityGrounding}}

{{antiRepetitionContext}}

${PARODY_NAME_RULES}

${NPC_POST_QUALITY_RULES}

Write ONE short post (max 200 chars). Sound like {{actorName}}.
No hashtags, no emojis.

Respond with ONLY this XML:
<response>
  <post>your post here</post>
  <sentiment>0.3</sentiment>
  <energy>0.5</energy>
</response>`.trim(),
});
