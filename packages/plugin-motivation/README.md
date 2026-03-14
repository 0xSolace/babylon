# @elizaos/plugin-motivation

**Motivation interpreter for elizaOS agents** — transforms raw drives and resources into prioritized needs, constraints, and opportunities.

## Why This Plugin Exists

elizaOS agents have internal state (via `plugin-homeostasis`) that tracks drives like security, social needs, and status. They may also have external situational awareness (via `plugin-appraisal`) that tracks things like financial position, power dynamics, and reputation.

But raw numbers don't tell a story. An agent with `security: 25` and `money: strained` doesn't know what that *means* or what to do about it.

**plugin-motivation bridges this gap.** It interprets both internal and external state into actionable orientation:

- "What matters most right now?" → **Priorities**
- "What limits acceptable action?" → **Constraints**  
- "What possibilities exist?" → **Opportunities**

Think of it as the agent's motivational compass — it doesn't decide what to do (that's `plugin-autonomous`), but it provides the context for making good decisions.

### Internal + External = Contextual Motivation

```
Internal state (how I feel)    +    External state (what's happening)
      ↓                                        ↓
  homeostasis                              appraisals
      ↓                                        ↓
  "I want recognition"              "But money is tight"
      ↓                                        ↓
             → financial_constraint pattern
             → "manage resources carefully" constraint
```

This creates *contextual* motivation: "I want recognition, but I need to find low-cost ways to get it."

## Architecture Philosophy

### Why Pattern Recognition, Not Algorithms?

Early designs used mathematical formulas to calculate motivation intensity. We abandoned this because:

1. **Models are better at nuance** — An LLM with good context can reason about motivation more naturally than any formula we'd write
2. **Formulas are brittle** — Edge cases multiply; thresholds need constant tuning
3. **Patterns are interpretable** — "survival_mode triggered by critical hunger" is debuggable; `intensity = 0.73 * (1 - x/100)` is not

Instead, we use **pattern recognition**: identify meaningful state combinations, then let frames filter and prioritize them.

### Why Frames?

Different agents (or the same agent in different contexts) should interpret the same state differently:

- A **security-focused** agent sees `social: 30` as "nice to have later"
- A **community-focused** agent sees the same value as "urgent need"

Frames are interpretation lenses, not replacement algorithms. They:
- **Filter** what patterns surface (Maslow suppresses growth needs when foundation is shaky)
- **Reorder** patterns by the frame's worldview
- **Color** the narrative with frame-specific language

The frame doesn't compute new values — it shapes what the LLM sees.

### Why Buckets, Not Continuous Values?

Homeostasis gives us `security: 37`. We convert to `security: 'low'`.

**Why lose precision?**

1. **Humans think in categories** — "I'm hungry" not "My hunger is 67.3%"
2. **Thresholds are fuzzy** — Is 38 meaningfully different from 37? Buckets acknowledge this
3. **LLMs work with language** — "low security" is more useful context than "security: 37"

We bucket into: `critical | low | balanced | satisfied | abundant`

## Core Concepts

### The Interpretation Pipeline

```
Homeostasis State    +    Appraisals (optional)
(drives, physiological,    (money, power, notoriety, etc.)
    resources)
        ↓                         ↓
   Internal Signals         Situational Signals
        ↓                         ↓
              → Combined Signal State
                       ↓
   Internal Patterns + Situational Patterns
                       ↓
              Frame Filter (worldview)
                       ↓
   Output (priorities, constraints, opportunities, narrative)
```

**Why two signal types?**
- Internal signals come from homeostasis (how the agent feels)
- Situational signals come from appraisals (what's happening externally)

Both feed into pattern detection, creating integrated motivation.

### Patterns

Patterns are named states that emerge from signal combinations:

| Pattern | Triggers When | Why It Matters |
|---------|--------------|----------------|
| `survival_mode` | Any physiological critical | Body needs dominate everything |
| `foundation_shaky` | Security critical/low | Can't build on unstable ground |
| `seeking_connection` | Social low + security balanced | Safe enough to reach out |
| `recognition_hungry` | Status low + social balanced | Have belonging, want esteem |
| `freedom_constrained` | Autonomy low | Agency is blocked |
| `purpose_seeking` | Meaning low + foundation stable | Ready for self-actualization |
| `stable_foundation` | Security + physiological satisfied | Growth is possible |
| `socially_resourced` | Social satisfied/abundant | Have relational capital |

**Why these patterns?** They're inspired by Maslow's hierarchy but aren't a strict implementation. Each represents a *meaningful motivational state* that should influence behavior.

### Situational Patterns (from appraisals)

When `plugin-appraisal` is loaded, additional patterns become available:

#### Universal Patterns (work with any domain)

| Pattern | Triggers When | Why It Matters |
|---------|--------------|----------------|
| `external_pressure` | Any domain strained/critical | Something external is constraining |
| `external_tailwind` | Any domain favorable + foundation stable | External conditions enable bold action |

#### Specific Patterns (known domains with richer logic)

| Pattern | Triggers When | Why It Matters |
|---------|--------------|----------------|
| `financial_constraint` | Money strained + growth drive active | Can't afford risk-taking |
| `influence_position` | Power favorable + foundation stable | Position of strength to leverage |
| `visibility_exposure` | Notoriety strained + social/status drive | Reputation requires management |

**Why both universal and specific?**
- **Universal patterns** catch any external constraint/opportunity, even from domains we don't know about
- **Specific patterns** provide richer interpretation for common domains (money, power, notoriety)

When a specific pattern fires, it *suppresses* the universal pattern for that domain to avoid redundancy.

### Frames

| Frame | Worldview | Effect |
|-------|-----------|--------|
| **Maslow** | Hierarchical needs | Lower needs suppress higher until satisfied |
| **Power** | Control and influence | Status/autonomy patterns surface first |
| **Notoriety** | Reputation and visibility | Social/status patterns surface first |
| **Survival** | Emergency mode | Only immediate survival matters |

**Why frame auto-selection?** The Survival frame auto-activates when physiological stress is critical. You can't think about meaning when you're starving. Other frames are selected by configuration or default to Maslow.

## Installation

```bash
# From monorepo root
bun install
```

## Usage

### Basic Setup

```typescript
import { motivationPlugin } from '@elizaos/plugin-motivation';
import { homeostasisPlugin } from '@elizaos/plugin-homeostasis';

const runtime = new AgentRuntime({
  character,
  plugins: [
    homeostasisPlugin,  // Required: provides raw state
    motivationPlugin,   // Interprets state into motivation
    // ... other plugins
  ],
});
```

### Reading Motivation State

```typescript
import type { MotivationService } from '@elizaos/plugin-motivation';

// Get the service
const motivation = runtime.getService('motivation') as MotivationService;

// Get complete state
const state = motivation.getState();
// {
//   priorities: [{ need: 'restore_security', intensity: 0.8, drivers: ['security'] }],
//   constraints: [{ type: 'risk_averse', because: 'security_unstable', guidance: '...' }],
//   opportunities: [{ type: 'growth_available', because: 'foundation_solid', potential: 0.7 }],
//   dominantFrame: 'maslow',
//   narrative: 'My foundation needs attention...',
//   timestamp: 1703123456789
// }

// Get just what you need
const priorities = motivation.getPriorities();
const narrative = motivation.getNarrative();
const frame = motivation.getDominantFrame();
```

### Overriding Frames

```typescript
// Force power frame for this agent
motivation.setFrameOverride('power');

// Return to automatic frame selection
motivation.setFrameOverride(null);
```

### Listening to Events

```typescript
// When motivation changes
runtime.on('MOTIVATION_UPDATED', (payload) => {
  console.log('New state:', payload.state);
});

// When priorities shift
runtime.on('MOTIVATION_PRIORITIES_CHANGED', (payload) => {
  console.log('Priorities changed:', payload.priorities);
});

// When frame shifts (e.g., entering survival mode)
runtime.on('MOTIVATION_FRAME_SHIFTED', (payload) => {
  console.log(`Frame: ${payload.previousFrame} → ${payload.newFrame}`);
});

// When a new constraint activates
runtime.on('MOTIVATION_CONSTRAINT_ACTIVATED', (payload) => {
  console.log('New constraint:', payload.constraint);
});

// When a goal candidate is generated
runtime.on('MOTIVATION_GOAL_CANDIDATE', (payload) => {
  console.log('Goal candidate:', payload.candidate.name);
  console.log('Relevance:', payload.candidate.relevance);
  // plugin-autonomous handles this automatically
});
```

## Configuration

Set via environment variables or runtime settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `MOTIVATION_DEFAULT_FRAME` | `maslow` | Default interpretation frame |
| `MOTIVATION_SURVIVAL_THRESHOLD` | `75` | Physiological level to auto-activate survival frame |
| `MOTIVATION_UPDATE_THROTTLE_MS` | `1000` | Minimum ms between recalculations |

## How It Integrates

### With plugin-homeostasis

**We read, they own.** Homeostasis owns the raw state (drives, physiological, resources). We subscribe to their events and interpret what they emit. We never modify homeostasis state.

### With plugin-appraisal (optional)

**We read, they evaluate.** If plugin-appraisal is loaded, we read situational appraisals to understand external context. We never modify appraisals — that's the evaluator plugins' job.

```typescript
// Motivation gracefully handles missing appraisal plugin
const appraisalService = runtime.getService('appraisal');
if (appraisalService) {
  // Incorporate situational awareness
  const appraisals = appraisalService.getAll();
  // Filter by confidence, convert to signals
} else {
  // Works fine without it — just no situational patterns
}
```

**Why optional?** Not all agents need situational awareness. An agent in a simple environment might only need internal motivation. By making appraisals optional, motivation works at multiple capability levels.

**Confidence filtering:** We only incorporate appraisals with confidence > 0.3. Low-confidence appraisals add noise without signal. If an evaluator isn't sure, we treat it as neutral.

### With plugin-autonomous

**We advise, they decide.** We output priorities, constraints, and opportunities. Autonomous (or other decision-making plugins) uses this context to choose actions. We don't execute anything.

**Integration points:**

1. **Motivation state adapter**: `getMotivationState()` provides a format optimized for autonomous's planning
2. **Goal candidate events**: We emit `MOTIVATION_GOAL_CANDIDATE`, autonomous listens and creates goals
3. **Motivation hints**: We push hints to the autonomous message service for relevance scoring

```typescript
// Autonomous uses motivation for planning context
const motivationService = runtime.getService('motivation');
const motivationState = motivationService.getMotivationState();
// Returns: { priorities, constraints, opportunities, disposition }

// Autonomous listens for goal candidates
// (This happens automatically in plugin-autonomous)
runtime.on('MOTIVATION_GOAL_CANDIDATE', async (payload) => {
  if (payload.candidate.relevance >= 0.7) {
    await goalService.createGoal(...);
  }
});
```

### With plugin-goals

**We suggest, they persist.** We generate goal candidates based on priorities and opportunities. Plugin-autonomous evaluates these candidates and creates goals via plugin-goals. We never create goals directly — that would mix interpretation with action.

**Why this separation?**
- Motivation says "security matters right now" (interpretation)
- Autonomous decides "yes, let's make that a goal" (decision)
- Goals tracks "restore security" as an active objective (persistence)

The `getMotivationState()` adapter method is specifically designed for this integration — it formats our internal state into the structure that autonomous and goals expect.

### With the LLM

**We inject context.** The `motivationProvider` formats our state into the LLM prompt:

```markdown
## Motivation

**Frame**: maslow - Hierarchical needs

**Priorities**:
- restore security (80%) [security]
- manage resources carefully (65%) [money, status]
- seek connection (50%) [social]

**Constraints**:
- risk_averse: Avoid high-variance actions until stability returns
- budget_conscious: Avoid resource-intensive actions; preserve financial runway

**Opportunities**:
- growth available (70% potential)

**Current Orientation**:
My foundation needs attention. Security feels unstable, pulling focus from higher pursuits.
External circumstances weigh on my foundation. Until the situation stabilizes, higher pursuits must wait.
```

**Note the situational context:** The "manage resources carefully" priority and "budget_conscious" constraint come from the `financial_constraint` pattern, which fired because money is strained and the agent has an active status drive.

This gives the LLM complete context: both internal state and external circumstances.

## Design Decisions

### Why Not Own Drives?

Separation of concerns. Homeostasis is the "body" — it knows what the state *is*. Motivation is the "interpreter" — it knows what the state *means*. Mixing these creates coupling and confusion about where to make changes.

### Why Not Execute Actions?

Single responsibility. We're an interpreter, not an executor. If we started executing, we'd need to know about available actions, handle failures, coordinate with other plugins — scope creep that belongs elsewhere.

### Why Events, Not Direct Calls?

Decoupling. Plugins that care about motivation changes subscribe to events. They don't need to know when or why we recalculate. This also allows multiple consumers without us knowing about them.

### Why Local Type Definitions?

The `homeostasis-types.ts` and `appraisal-types.ts` files define types locally rather than importing from their source packages. This is because:

1. The source packages may not have built type declarations
2. We only need a subset of their types
3. This documents exactly what interface we depend on
4. It maintains soft dependencies — we can still build and run if the source package isn't available

**For appraisals specifically:** We define the minimal interface we need (`get`, `getAll`, `getIds`) and the `Appraisal` type. This ensures we can work with any evaluator plugin that publishes appraisals, without coupling to implementation details.

### Why Domain-Agnostic Appraisal Conversion?

We don't hardcode knowledge about specific appraisal domains (money, power, etc.). Instead, we:

1. Check common payload fields (`status`, `level`, `state`, `condition`)
2. Map keywords to signals using `IndicatorMap`
3. Default to "stable" for unknown values

This means motivation automatically works with evaluator plugins that don't exist yet, as long as they use standard terminology like `{ status: 'cautious' }` or `{ level: 'high' }`.

### Why Universal + Specific Patterns?

We have both:
- **Universal patterns** (`external_pressure`, `external_tailwind`) that work with any domain
- **Specific patterns** (`financial_constraint`, `influence_position`, `visibility_exposure`) for known domains

**Why both?**
- Universal patterns ensure we handle unknown domains (plugin-relationships, plugin-trust, plugin-health, etc.)
- Specific patterns provide richer interpretation by combining external + internal state (e.g., "money strained AND status drive active")

When a specific pattern fires, it suppresses the universal pattern for that domain. This prevents redundancy (we don't want both "external_pressure: money" AND "financial_constraint" to fire simultaneously).

## File Structure

```
src/
├── index.ts                 # Public exports
├── plugin.ts                # Plugin definition
├── types.ts                 # Type definitions
├── constants.ts             # Events, thresholds, defaults
├── homeostasis-types.ts     # Local homeostasis interface types
├── appraisal-types.ts       # Local appraisal interface types (for situational awareness)
│
├── signals/                 # State → Categorical buckets
│   └── index.ts             # driveToSignal, stateToSignals, etc.
│
├── patterns/                # Pattern recognition
│   ├── definitions.ts       # Pattern definitions (8 patterns)
│   └── index.ts
│
├── frames/                  # Interpretation lenses
│   ├── types.ts             # Frame interface
│   ├── maslow.ts            # Hierarchical needs frame
│   ├── power.ts             # Control/influence frame
│   ├── notoriety.ts         # Reputation frame
│   ├── survival.ts          # Emergency mode frame
│   └── index.ts             # Frame registry
│
├── output/                  # Pattern → Output mapping
│   ├── priorities.ts        # Pattern → MotivationPriority
│   ├── constraints.ts       # Pattern → MotivationConstraint
│   ├── opportunities.ts     # Pattern → MotivationOpportunity
│   └── index.ts
│
├── narrative/               # Narrative generation
│   └── generator.ts         # Frame-colored narratives
│
├── services/
│   └── motivation-service.ts  # Main service
│
├── providers/
│   └── motivation-provider.ts # LLM context injection
│
└── __tests__/
    └── motivation.test.ts   # 29 tests
```

## Testing

```bash
cd packages/plugin-motivation
bun test
```

Tests cover:
- Signal conversion (10 tests)
- Pattern detection (6 tests)
- Frame filtering (6 tests)
- Output generation (7 tests)

## Goal Candidate Generation

When motivation identifies urgent priorities or valuable opportunities, it generates **goal candidates** — suggestions that can become actual goals.

### Why Goal Candidates, Not Direct Goals?

```text
Motivation (interpreter) → emits candidates → Autonomous (decision-maker) → creates goals
```

**Separation of concerns:**
- Motivation interprets "what matters" — it shouldn't decide "what to do"
- Autonomous decides "what to do" — it's the action selector
- Goals persist "what to pursue" — managed by plugin-goals

**This flow means:**
1. Motivation generates candidates based on priorities/opportunities
2. It emits `MOTIVATION_GOAL_CANDIDATE` events
3. Plugin-autonomous listens, evaluates relevance (≥0.7 threshold)
4. If relevant, autonomous creates a goal via plugin-goals

### Candidate Sources

| Source | When Generated | Goal Type |
|--------|---------------|-----------|
| **Priority** | Intensity ≥ 0.4 | `objective` (low), `milestone` (med), `action` (high) |
| **Opportunity** | Potential ≥ 0.5 | `action` |
| **Constraint** | Optional flag enabled | `objective` |

### Using Goal Candidates

```typescript
import { generateGoalCandidates, convertPriorityToGoal } from '@elizaos/plugin-motivation';

// Generate candidates from current state
const candidates = generateGoalCandidates(motivationState, {
  minIntensity: 0.5,       // Only urgent priorities
  maxCandidates: 3,        // Limit output
  includeOpportunities: true,
});

// Convert a specific priority to goal creation params
const goalParams = convertPriorityToGoal(priority, agentId);
await goalService.createGoal(goalParams);
```

### Exported Utilities

| Function | Purpose |
|----------|---------|
| `generateGoalCandidates(state, options?)` | Generate candidates from motivation state |
| `convertPriorityToGoal(priority, agentId)` | Convert priority to goal params |
| `convertOpportunityToGoal(opportunity, agentId)` | Convert opportunity to goal params |
| `suggestGoalUpdate(goalMetadata, state)` | Suggest updates for existing goals |

## Future Work

### V1 Enhancements (Completed)
- [x] Appraisal integration (situational awareness from plugin-appraisal)
- [x] Situational patterns (financial_constraint, influence_position, visibility_exposure)
- [x] Goal candidate generation
- [x] Integration with plugin-goals for goal suggestions
- [x] Event emission for goal candidates (MOTIVATION_GOAL_CANDIDATE)

### V2 Enhancements
- [ ] Learning from outcomes (which priorities led to good results)
- [ ] Character-specific frame customization
- [ ] Trust/relationship integration for social pattern nuance
- [ ] Temporal patterns (chronic needs, anticipated needs)
- [ ] Additional evaluator domains (health, creativity, time/margin)

### Future Appraisal Domains
The current specific patterns handle money, power, and notoriety. Future evaluator plugins could add:
- `plugin-relationships`: Trust, connection quality → affects social patterns
- `plugin-health`: Physical wellbeing context → affects physiological patterns
- `plugin-creativity`: Creative state → affects meaning/purpose patterns
- `plugin-time`: Margin/pressure → affects urgency calculations

These would automatically work with universal patterns. Specific patterns can be added if richer interpretation is needed.

## License

MIT

