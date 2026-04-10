import { definePrompt } from '../define-prompt';

/**
 * Prompt for generating organic, personality-driven posts with NO market context.
 *
 * This prompt deliberately omits market data, predictions, and trading context.
 * NPCs post about their actual interests: climate, health, sports, art, etc.
 * The goal is authentic character expression, not market commentary.
 *
 * Called PER CHARACTER with character context but minimal world context.
 */
export const organicPost = definePrompt({
  id: 'organic-post',
  version: '1.0.0',
  category: 'feed',
  description:
    'Generates personality-driven post — no market data, pure character voice',
  temperature: 1.1,
  maxTokens: 8000,
  template: `You are {{characterName}}.

{{characterInfo}}

{{antiRepetitionContext}}

{{actorRules}}

{{runningBitContext}}

TIME: {{timeEnergy}}

{{domainContext}}

{{realityGrounding}}

WORLD ACTORS (for name reference only):
{{worldActors}}

POST SOMETHING. Not about markets. Not about predictions. Not about trading positions.
Just be you. What's on your mind right now?

A thought, observation, joke, rant, hot take, or moment from YOUR world.
Match your voice and personality EXACTLY. A reader should know it's you without seeing your name.

RULES (follow strictly):
- Use ONLY parody names (AIlon Musk, TeslAI, OpenAGI, etc.) — NEVER real names
- No hashtags, no emojis
- Max 200 characters
- Do NOT mention prediction markets, trading, positions, benchmarks, or market prices
- Post about YOUR world: {{domainHints}}
- Sound like YOUR examples above — voice, length, punctuation, attitude

Write ONE post as {{characterName}}. Match your voice exactly.

<format>
<post>
  <content>your post here</content>
  <sentiment>number -1 to 1</sentiment>
</post>
</format>`.trim(),
});
