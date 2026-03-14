# @elizaos/plugin-neuro

A cognitive memory system for elizaOS agents. Enables agents to build mental models, track patterns, form hypotheses, and evaluate their own reasoning quality.

## Why This Plugin Exists

Traditional chatbots are stateless—they respond to each message in isolation. Real intelligence requires **persistent cognitive structures**:

- **Memory** that decays naturally over time (like human memory)
- **Pattern recognition** that builds trust incrementally
- **Hypothesis formation** that makes predictions and tests them
- **Self-evaluation** that improves reasoning quality

This plugin provides these capabilities through a **schema-driven architecture** that makes it easy to define new cognitive memory types without writing boilerplate.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Plugin Entry (index.ts)                      │
│  - Creates cognitive memories from schemas                          │
│  - Registers evaluators and providers with runtime                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cognitive Engine (cognitive.ts)                   │
│  - createCognitiveMemory(): Transforms schema → evaluator+provider  │
│  - Handles XML prompt generation, parsing, metadata extraction      │
│  - Manages routing (new vs update) and memory lifecycle             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Schema System (schema.ts)                      │
│  - defineSchema(): Type-safe schema definition                      │
│  - Field types: string, number, boolean, array, enum, timestamp, ref│
│  - Hooks: validate, beforeSave, afterSave, formatProvider, etc.     │
│  - Type inference: InferMetadata<Schema> generates TS types         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Schemas (schemas/*.ts)                      │
│  conversation, culture, pattern, understanding, task, verification, │
│  hypothesis, narrative, metacognition                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Dynamics (dynamics/*.ts)                        │
│  - Confidence: reinforcement, contradiction, diminishing returns    │
│  - Decay: half-life model, presets (ephemeral → permanent)          │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Why Schema-Driven?

We observed that all cognitive evaluators follow the same pattern:
1. Load existing memories of this type
2. Format them for the LLM
3. Ask LLM to analyze new message in context
4. Parse LLM response
5. Create or update memory

Rather than duplicate this ~200 lines per evaluator, we extracted it into a **schema-driven engine**. Now each cognitive type is ~30-50 lines of configuration.

**Before (conversation evaluator):** ~310 lines of TypeScript
**After (conversation schema):** ~50 lines of configuration

### Why Confidence Tracking?

Not all observations are equally reliable. A single data point shouldn't create strong beliefs. Confidence tracking provides:

- **Reinforcement**: Repeated observations increase confidence (with diminishing returns—going from 30→50 is easier than 80→95)
- **Contradiction**: Conflicting observations decrease confidence
- **Threshold filtering**: Low-confidence memories can be filtered from provider output

This mimics how human beliefs form and change.

### Why Decay?

Human memory fades. Without decay:
- Old, potentially outdated observations pollute context
- The agent can't "forget" things that are no longer relevant
- Memory grows unbounded

Decay uses a **half-life model**: after one half-life, memory "strength" is 50%. After two, 25%. This is configurable per memory type:
- `ephemeral`: 1 day (observations)
- `standard`: 7 days (typical memories)
- `persistent`: 30 days (important patterns)
- `core`: 1 year (fundamental beliefs)
- `permanent`: never decays

### Why Cross-Memory References?

Cognitive structures are interconnected. A narrative might synthesize insights from:
- Multiple conversations
- Several hypotheses
- Behavioral patterns

The `ref` field type enables these connections, allowing the agent to build a **knowledge graph** rather than isolated memory silos.

### Why Provider Priming?

Providers don't just supply information—they **prime** agent behavior. Examples:

```typescript
// Pattern provider primes trust-aware behavior
const priming = trust >= 70 
  ? 'HIGH trust - be open and helpful'
  : trust >= 40 
  ? 'MODERATE trust - proceed normally'
  : 'LOW trust - be cautious and verify';
```

```typescript
// Understanding provider primes ELI5 behavior
const priming = isNovice 
  ? 'Use simple terms and analogies.'
  : 'Can use technical language.';
```

This is more powerful than just showing data—it actively shapes how the agent responds.

## Memory Types

| Schema | Scope | Purpose |
|--------|-------|---------|
| `conversation` | room | Track conversation threads, topics, participants |
| `culture` | room | Detect terminology, tone, subcultures, norms |
| `pattern` | entity | Trust scoring, behavioral patterns per user |
| `understanding` | entity | Track user's knowledge level per topic (ELI5) |
| `task` | room | Track tasks, requests, action chains |
| `verification` | global | Hallucination detection, response verification |
| `hypothesis` | global | Agent predictions with lifecycle management |
| `narrative` | global | Synthesized stories from patterns/hypotheses |
| `metacognition` | global | Self-evaluation of evaluator quality |

## Usage

### Basic: Use Built-in Schemas

```typescript
import { neuroPlugin } from '@elizaos/plugin-neuro';

// Add to your agent's plugins
const agent = {
  plugins: [neuroPlugin],
};
```

### Advanced: Create Custom Cognitive Types

```typescript
import { defineSchema, createCognitiveMemory } from '@elizaos/plugin-neuro';

// Define your schema
const sentimentSchema = defineSchema({
  name: 'sentiment',
  table: 'sentiments',
  scope: 'entity',  // Track per-user
  
  fields: {
    overall: { 
      type: 'enum', 
      options: ['positive', 'neutral', 'negative'],
      description: 'Overall sentiment toward agent',
    },
    recentTrend: { 
      type: 'enum', 
      options: ['improving', 'stable', 'declining'],
      description: 'Recent trend direction',
    },
    triggers: { 
      type: 'array', 
      description: 'Topics that affect sentiment',
    },
  },
  
  prompts: {
    task: 'Analyze sentiment toward the agent. Track overall feeling and identify triggers.',
  },
  
  hooks: {
    // Only run after enough interaction
    validate: async (runtime, message) => {
      const messages = await runtime.getMemories({
        tableName: 'messages',
        entityId: message.entityId,
        count: 10,
      });
      return messages.length >= 5;
    },
  },
});

// Create evaluator + provider
const sentiment = createCognitiveMemory(sentimentSchema);

// Use in your plugin
export const myPlugin = {
  evaluators: [sentiment.evaluator],
  providers: [sentiment.provider],
};
```

## Testing

```bash
cd packages/plugin-neuro
bun test
```

## Events

The plugin emits events for integration with other systems (like homeostasis):

- `NEURO_TRUST_CHANGE` - Trust score changed significantly
- `NEURO_TASK_COMPLETED` - Task finished
- `NEURO_HALLUCINATION_DETECTED` - Response verification failed
- `NEURO_HYPOTHESIS_CONFIRMED` / `NEURO_HYPOTHESIS_REFUTED` - Prediction resolved
- `NEURO_PATTERN_DETECTED` - New behavioral pattern identified
- `NEURO_EVALUATOR_QUALITY` - Metacognition assessment

## Design Decisions

### Why XML for LLM prompts?

XML provides clear structure that LLMs follow reliably. JSON works but requires more escaping. Plain text is ambiguous. XML hits the sweet spot of:
- Clear field boundaries
- Easy to parse (even with regex fallback)
- LLMs trained on lots of XML

### Why not use the core memory system directly?

The core memory system is a **storage layer**. This plugin adds a **cognitive layer**:
- Schemas define what to store and how to interpret it
- The engine handles the evaluate→store→provide cycle
- Dynamics add temporal behavior (decay, confidence)

### Why hooks instead of inheritance?

We considered a class-based approach with method overrides. Problems:
- Verbose for simple customizations
- Hard to compose behaviors
- TypeScript generics get messy

Hooks are:
- Opt-in (only define what you need)
- Composable (schemas could share hooks)
- Easy to understand (just functions)

### Why functors initially, not pure config?

Some behaviors are hard to express as config:
- Complex validation logic
- Custom formatting
- Integration with external services

Functors (hooks) let us start simple and extract patterns into config as we see repetition. This follows the principle: **optimize for the specific case first, then generalize**.

## License

MIT

