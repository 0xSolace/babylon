# Plugin Neuro Architecture

This document explains the architectural decisions and patterns used in the cognitive memory system.

## Design Philosophy

### Why Schema-Driven?

Traditional approaches to building cognitive capabilities involve writing custom code for each type:

```typescript
// OLD WAY: 250 lines per cognitive type
class ConversationEvaluator implements Evaluator {
  async handler(runtime, message) {
    const existing = await runtime.getMemories({ tableName: 'conversations' });
    const csv = this.formatCsv(existing);  // 30 lines
    const prompt = this.buildPrompt(csv, message);  // 50 lines
    const response = await runtime.useModel(ModelType.TEXT_LARGE, { prompt });
    const parsed = this.parseResponse(response);  // 40 lines
    await this.saveMemory(runtime, parsed);  // 30 lines
  }
  // ... 100 more lines of helpers
}
```

We noticed that 80% of this code is identical across cognitive types. The only differences:
- What fields to track
- What to ask the LLM
- How to format output

The schema-driven approach extracts the common pattern:

```typescript
// NEW WAY: 30 lines per cognitive type
const conversationSchema = defineSchema({
  name: 'conversation',
  table: 'conversations',
  scope: 'room',
  fields: {
    title: { type: 'string', description: 'Thread title' },
    topics: { type: 'array', description: 'Topics discussed' },
  },
  prompts: {
    task: 'Parse messages into conversation threads',
  },
});

const conversation = createCognitiveMemory(conversationSchema);
```

**Benefits:**
- Less code to maintain
- Consistent behavior across types
- Easy to add new cognitive capabilities
- Types are generated automatically

### Why Hooks (Functors)?

Some behaviors can't be expressed as pure config:

```typescript
// Complex validation: only run if 10+ messages exist
validate: async (runtime, message) => {
  const messages = await runtime.getMemories({...});
  return messages.length >= 10;
},

// Custom formatting with priming
formatProvider: (memories, message) => {
  const trust = memories[0]?.metadata.trustScore;
  const priming = trust >= 70 ? 'HIGH trust - be helpful' : 'LOW trust - be cautious';
  return `Trust: ${trust}\nNote: ${priming}`;
},
```

**Design Principle:** Start with functors (flexible), extract to config as patterns emerge.

We could later add:
```typescript
validate: { minMessages: 10 },  // Config instead of function
```

But we'd need to see the pattern repeat before building the abstraction.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Message Arrives                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Evaluators Run (for each schema)                      │
│                                                                          │
│  1. validate() - Should this evaluator run?                             │
│  2. Query existing memories (filtered by scope)                         │
│  3. Format context (CSV for LLM)                                        │
│  4. Build prompt (task + context + schema)                              │
│  5. Call LLM                                                            │
│  6. Parse XML response                                                  │
│  7. Extract metadata (using field definitions)                          │
│  8. beforeSave() hook                                                   │
│  9. Save memory                                                         │
│ 10. afterSave() hook (events, side effects)                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Response Generation                              │
│                                                                          │
│  Providers inject cognitive context:                                    │
│  - "# Conversations: topic1, topic2..."                                 │
│  - "# Trust: HIGH (be helpful)"                                         │
│  - "# Understanding: user is NOVICE at crypto"                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Memory Scopes

Cognitive memories are scoped to control what context is relevant:

| Scope | Filter By | Use Case |
|-------|-----------|----------|
| `room` | roomId | Conversations in this channel |
| `entity` | entityId | Trust for this specific user |
| `global` | (none) | Agent-wide hypotheses |

**Why Three Scopes?**

Different cognitive structures have different natural boundaries:
- Conversations are room-specific (what we talked about *here*)
- Trust is entity-specific (what I think of *this person*)
- Hypotheses are global (my predictions about *the world*)

Using wrong scope causes problems:
- Room-scoped trust → "I don't trust you" resets when you change channels
- Global conversations → Every room sees every conversation

## Temporal Dynamics

### Confidence

Not all observations are equally reliable. Confidence tracking enables:

```
Observation 1: "User likes coffee"     → 50% confidence
Observation 2: "User orders coffee"    → 62% confidence (reinforced)
Observation 3: "User drinks tea"       → 37% confidence (contradicted!)
```

**Key Design Decisions:**

1. **Asymmetric Updates:** Contradictions hurt more than reinforcements help.
   - Reinforcement: +15 points (with diminishing returns)
   - Contradiction: -25 points (flat penalty)
   - Why: Trust is hard to gain, easy to lose.

2. **Diminishing Returns:** High confidence is hard to achieve.
   - At 30% confidence: +15 → +10.5 actual gain
   - At 80% confidence: +15 → +3.0 actual gain
   - Why: Prevents overconfidence from small samples.

3. **Minimum Floor:** Confidence never goes to zero (default: 10%).
   - Why: Even contradicted memories have signal value.

### Decay

Memories fade over time using half-life model:

```
value = initial * 0.5^(age / halfLife)
```

**Why Half-Life?**

- Intuitive: "After one week, memory is half as strong"
- Smooth: No sudden cliffs ("delete after 7 days")
- Configurable: Different types decay differently

**Presets:**

| Preset | Half-Life | Use Case |
|--------|-----------|----------|
| ephemeral | 1 day | Transient observations |
| standard | 7 days | Normal memories |
| persistent | 30 days | Important patterns |
| core | 1 year | Identity, fundamental beliefs |
| permanent | ∞ | System data |

## Provider Priming

Providers don't just supply information—they **prime** agent behavior.

```typescript
// Just information (not great)
"Trust score: 73/100"

// Priming (better)
"Trust: HIGH (73/100)
Note: This user has consistently helpful interactions. Be open and collaborative."
```

**Why This Matters:**

LLMs respond to framing. "73/100" is abstract. "HIGH trust - be collaborative" directly influences the response tone. This is the difference between passive context and active guidance.

## Event System

The cognitive system generates insights that other systems might want:

```typescript
// When trust drops significantly
NEURO_EVENTS.TRUST_CHANGE → { oldScore: 75, newScore: 35, reason: '...' }

// When hallucination detected
NEURO_EVENTS.HALLUCINATION_DETECTED → { confidence: 85, discrepancies: [...] }
```

**Why Events?**

Loose coupling. The neuro plugin doesn't need to know about:
- Homeostasis (might adjust drives based on trust)
- Analytics (might track learning over time)
- UI (might show notifications)

Each consumer subscribes to events they care about.

## File Structure

```
src/
├── index.ts          # Plugin entry, schema instantiation
├── schema.ts         # Type definitions for schemas
├── cognitive.ts      # Engine that generates evaluators/providers
├── utils.ts          # XML parsing, node extraction
├── metadata.ts       # Legacy metadata types (backwards compat)
├── events.ts         # Event types and helpers
├── dynamics/
│   ├── confidence.ts # Confidence tracking math
│   └── decay.ts      # Memory decay math
└── schemas/
    ├── conversation.ts
    ├── culture.ts
    ├── pattern.ts
    ├── understanding.ts
    ├── task.ts
    ├── verification.ts
    ├── hypothesis.ts
    ├── narrative.ts
    └── metacognition.ts
```

## Future Directions

### Near Term
- [ ] Add salience scoring (which memories are most relevant right now?)
- [ ] Implement cross-memory graph queries
- [ ] Connect events to homeostasis plugin

### Medium Term
- [ ] Move more hook patterns to declarative config
- [ ] Add memory consolidation (merge similar memories)
- [ ] Implement contradiction detection between memory types

### Long Term
- [ ] Self-modifying schemas (agent improves own cognitive structure)
- [ ] Multi-agent memory sharing
- [ ] Explainable cognition ("why do you think X?")

