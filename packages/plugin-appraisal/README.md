# @elizaos/plugin-appraisal

Situational appraisal registry for elizaOS agents.

## Overview

This plugin provides a typed registry for domain evaluator outputs. Domain evaluators (money, power, notoriety, etc.) publish appraisals, and motivation reads them via provider to inform priorities.

### Architecture

```
homeostasis (internal state) + appraisal (external situation) → motivation (priorities)
```

- **Homeostasis**: How the agent feels inside (hunger, fatigue, drives)
- **Appraisal**: What's happening outside (financial position, influence, reputation)
- **Motivation**: What to prioritize based on both

## Installation

```bash
npm install @elizaos/plugin-appraisal
```

## Usage

### Adding to Your Agent

```typescript
import { appraisalPlugin } from '@elizaos/plugin-appraisal';

const character = {
  name: 'MyAgent',
  plugins: [appraisalPlugin],
};
```

### Publishing Appraisals (for Evaluator Plugin Authors)

Domain evaluators publish appraisals when they assess situations:

```typescript
import { AppraisalService } from '@elizaos/plugin-appraisal';

// In your evaluator plugin
async function evaluateMoneyPosition(runtime: IAgentRuntime) {
  const appraisalService = runtime.getService('appraisal') as AppraisalService;

  // Analyze financial position...
  const assessment = analyzeFinances();

  // Publish appraisal
  appraisalService.publish({
    id: 'money',
    ts: Date.now(),
    confidence: 0.85,
    source: 'plugin-money',
    payload: {
      status: assessment.status,      // 'secure', 'cautious', 'critical'
      reserves: assessment.reserves,  // 'high', 'moderate', 'low'
      trend: assessment.trend,        // 'improving', 'stable', 'declining'
    },
  });
}
```

### Reading Appraisals

Appraisals are available via provider during `composeState()`:

```typescript
const state = await runtime.composeState(message, ['APPRAISALS']);
// state.data.providers.APPRAISALS contains:
// {
//   appraisals: { money: {...}, power: {...}, ... },
//   appraisalCount: 3,
//   appraisalIds: ['money', 'power', 'notoriety']
// }
```

Or directly via service:

```typescript
const appraisalService = runtime.getService('appraisal') as AppraisalService;

// Get specific appraisal
const money = appraisalService.get('money');

// Get all appraisals
const snapshot = appraisalService.getAll();

// Get registered domain ids
const domains = appraisalService.getIds();
```

## API Reference

### Appraisal Interface

```typescript
interface Appraisal<T = Record<string, unknown>> {
  /** Unique domain identifier (e.g., 'money', 'power', 'notoriety') */
  id: string;

  /** Timestamp when computed (ms) - used for ordering */
  ts: number;

  /** Confidence in this assessment (0-1) */
  confidence: number;

  /** Which plugin published this appraisal */
  source: string;

  /** Domain-specific data */
  payload: T;
}
```

### AppraisalService Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `publish(appraisal)` | `boolean` | Publish an appraisal. Returns `true` if accepted, `false` if rejected (older timestamp). |
| `get(id)` | `Appraisal \| null` | Get a specific appraisal by domain id. |
| `getAll()` | `Record<string, Appraisal>` | Get all current appraisals. |
| `getIds()` | `string[]` | Get all registered domain ids. |
| `clear(id)` | `boolean` | Remove an appraisal. Returns `true` if removed. |

### Events

| Event | Payload | When |
|-------|---------|------|
| `APPRAISAL_UPDATED` | `{ appraisalId, appraisal, previousAppraisal? }` | An appraisal is published or updated |
| `APPRAISAL_CLEARED` | `{ appraisalId, clearedAppraisal }` | An appraisal is explicitly cleared |

## Design Principles

### Latest Wins

When a new appraisal arrives for an existing domain:
- If `ts > existing.ts` → replace
- If `ts <= existing.ts` → reject (stale)

No accumulation, no merging. The most recent assessment wins.

### No Time-Based Expiry

Appraisals don't expire on a timer. Instead, the plugin uses **confidence decay** to signal increasing uncertainty over time.

## Appraisal Refresh and Confidence Decay

The plugin includes an automatic refresh system that maintains appraisal quality:

### How It Works

1. A background task runs every 5 minutes (configurable)
2. Checks all appraisals for staleness (>15 minutes old by default)
3. Applies confidence decay to stale appraisals (10% per check)
4. Emits events when appraisals need refresh

### Configuration

```typescript
// In character settings or .env
settings: {
  // How often to check for stale appraisals (ms)
  APPRAISAL_REFRESH_INTERVAL: 300000, // 5 minutes (default)

  // Age before appraisal is considered stale (ms)
  APPRAISAL_STALENESS_THRESHOLD: 900000, // 15 minutes (default)

  // Confidence reduction per check (0-1)
  APPRAISAL_CONFIDENCE_DECAY_RATE: 0.1, // 10% (default)
}
```

### Events

Domain evaluators can listen for refresh requests:

```typescript
// In your evaluator plugin
runtime.registerEvent('appraisal:refresh_needed', async (payload) => {
  if (payload.appraisalId === 'money') {
    // Re-evaluate money situation
    await evaluateMoneyPosition(runtime);
  }
});

runtime.registerEvent('appraisal:confidence_decayed', (payload) => {
  console.log(`${payload.appraisalId} confidence: ${payload.previousConfidence} → ${payload.newConfidence}`);
});
```

### Why Confidence Decay?

Rather than hard expiry (appraisals disappear), confidence decay provides:

- **Graceful degradation**: Old data is still available but marked as uncertain
- **Evaluator autonomy**: Evaluators decide when to re-assess based on confidence
- **Transparency**: The agent knows its data is stale (low confidence)
- **Flexibility**: Different domains can have different refresh needs

### Plumbing, Not Intelligence

This plugin is a registry. It does NOT:
- Interpret appraisals (that's motivation's job)
- Prioritize or rank domains
- Execute actions
- Call LLMs

Evaluators own meaning; motivation owns arbitration.

## Evaluator Configuration

Characters can selectively enable/disable evaluators:

```typescript
// In character settings
settings: {
  // Option 1: Whitelist - only enable specific evaluators
  APPRAISAL_ENABLED_EVALUATORS: 'money,relationships',

  // Option 2: Blacklist - disable specific evaluators
  APPRAISAL_DISABLED_EVALUATORS: 'power,notoriety',

  // Option 3: Disable all appraisal evaluators
  APPRAISAL_EVALUATORS_ENABLED: 'false',
}
```

### Using Configuration in Evaluators

```typescript
import { isEvaluatorEnabled } from '@elizaos/plugin-appraisal';

// In your evaluator
async function evaluateMoneyPosition(runtime: IAgentRuntime) {
  // Check if this evaluator is enabled for this character
  if (!isEvaluatorEnabled(runtime, 'money')) {
    return; // Skip evaluation
  }

  // Proceed with evaluation...
}
```

## Writing an Evaluator Plugin

Example structure for a domain evaluator:

```typescript
// packages/plugin-money/src/plugin.ts
import type { Plugin } from '@elizaos/core';
import { AppraisalService } from '@elizaos/plugin-appraisal';

export const moneyPlugin: Plugin = {
  name: 'money',
  description: 'Financial position evaluator',
  dependencies: ['@elizaos/plugin-appraisal'],

  init: async (config, runtime) => {
    // Subscribe to relevant events or set up evaluation triggers
  },

  evaluators: [
    {
      name: 'money-evaluator',
      description: 'Evaluates financial position',
      handler: async (runtime, message) => {
        const appraisalService = runtime.getService('appraisal') as AppraisalService;

        // Your domain-specific analysis...
        const assessment = await analyzeFinancialPosition(runtime);

        // Publish appraisal
        appraisalService.publish({
          id: 'money',
          ts: Date.now(),
          confidence: assessment.confidence,
          source: 'plugin-money',
          payload: assessment.data,
        });
      },
    },
  ],
};
```

## Testing

```bash
cd packages/plugin-appraisal
bun test
```

## License

MIT

