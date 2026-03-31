import { definePrompt } from '../define-prompt';

/**
 * Lightweight ambient post for quick/frequent generation.
 * Minimal context, fast execution. Actor-first design.
 */
export const minuteAmbient = definePrompt({
  id: 'minute-ambient',
  version: '6.0.0',
  category: 'feed',
  description: 'Quick ambient post — minimal context, actor identity first',
  temperature: 1,
  maxTokens: 500,
  template: `You are {{actorName}}.
{{actorDescription}}

{{emotionalContext}}

Write ONE short post (max 200 chars). Sound like {{actorName}}.
No hashtags, no emojis. Parody names only.

Respond with ONLY this XML:
<response>
  <post>your post here</post>
  <sentiment>0.3</sentiment>
  <energy>0.5</energy>
</response>`.trim(),
});
