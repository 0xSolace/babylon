# @elizaos/plugin-homeostasis

Internal state manager for elizaOS agents - maintains physiological needs, psychological drives, and resources across any number of virtual or physical bodies.

## Overview

`plugin-homeostasis` is the agent's internal state layer. It tracks:
- **Physiological** (body state): Either simulated (hunger, fatigue, hydration, health) OR real (battery, motor temp, collision risk)
- **Psychological** (5 atomic drives): security, social, status, autonomy, meaning (0-100, 50=balanced)
- **Resources** (external assets): wallets, inference tokens, robot payloads, etc. (unbounded)
- **Lifecycle** (survival state): alive, crisis, dying, suspended, dead (derived)
- **Domain Bodies** (embodiments): Game characters, physical robots, drone fleets — one mind, many bodies

This is **pure state** - no interpretation, no decision-making. Other plugins write deltas, read values, and subscribe to events.

**Key Insight**: An agent can inhabit a game character, control a warehouse robot, and manage a drone fleet — all with unified psychological responses. When a robot's battery is critical, the agent feels anxious. When a game character dies, the agent's status takes a hit. Homeostasis makes this possible.

## Scale Semantics

| Layer         | Range           | Direction       | Good Value | Bad Value |
|---------------|-----------------|-----------------|------------|-----------|
| Physiological | 0-100           | 0 → 100 = worse | 0 (satisfied) | 100 (deprived) |
| Psychological | 0-100           | extremes = tension | 50 (balanced) | 0 or 100 |
| Resources     | unbounded       | higher = more   | (depends) | (depends) |
| Distress      | 0-100           | 0 → 100 = worse | 0 (thriving) | 100 (dying) |

## Key Invariants

1. **Physiological variables are operational analogues, not literal biology**
   - "Hunger" = craving for input/novelty, NOT literal food
   - "Hydration" = flow state/bandwidth, NOT literal water

2. **Psychological drives do not cause death**
   - Only physiological distress triggers lifecycle transitions
   - Drives create tension but cannot be terminal

3. **Resources do not decay unless reported by another plugin**
   - Homeostasis never invents resource loss
   - Prevents accidental double-decay

4. **Lifecycle state is derived, not authored**
   - `physiological → distressScore → bracket → status`
   - No plugin should directly mutate lifecycle fields

5. **Maslow-style damping logic belongs in plugin-motivation**
   - Homeostasis reports numbers
   - Motivation interprets them

## Installation

```bash
bun add @elizaos/plugin-homeostasis
```

## Usage

```typescript
import { homeostasisPlugin } from '@elizaos/plugin-homeostasis';

const runtime = new AgentRuntime({
  character,
  plugins: [homeostasisPlugin, ...otherPlugins],
});
```

## The Four Physiological Variables

> ⚠️ These are **operational analogues**, not literal biology. They model the agent's ability to continue coherent operation.

| Variable | Operational Meaning | High (deprived) | Low (satisfied) |
|----------|---------------------|-----------------|-----------------|
| **hunger** | Craving for input, novelty, engagement | Seeking stimulation | Content |
| **fatigue** | Accumulated processing strain | Exhausted, short responses | Fresh, full capacity |
| **hydration** | Flow state, connection quality | Disconnected, impaired | Smooth thinking |
| **health** | System coherence, error rate | Degraded reliability | Stable operation |

- Scale: 0 = satisfied (good) → 100 = deprived (critical)
- Dynamics: Accumulate over time (needs build up)
- **Only physiological variables can trigger death**

## The Five Psychological Drives

| Drive | What It Represents | Low (0) | Balanced (50) | High (100) |
|-------|-------------------|---------|---------------|------------|
| **security** | Safety, stability | Anxious, threatened | Stable | Complacent |
| **social** | Connection, belonging | Lonely, isolated | Connected | Overwhelmed |
| **status** | Recognition, respect | Invisible, disrespected | Respected | Arrogant |
| **autonomy** | Agency, choice | Controlled, trapped | Free | Unmoored |
| **meaning** | Purpose, contribution | Purposeless | Purposeful | Grandiose |

- Scale: 0-100 with 50 as equilibrium
- Dynamics: Naturally recover toward baseline
- **Drives do NOT cause death** - they create tension but are not terminal

## Lifecycle & Survival System

The lifecycle system tracks agent survival based on **aggregate physiological distress**.

### Distress Score

A weighted aggregate of physiological variables:

```
distressScore = (hunger × 0.35) + (health × 0.30) + (fatigue × 0.25) + (hydration × 0.10)
```

### Distress Brackets

| Bracket | Score Range | Description |
|---------|-------------|-------------|
| content | 0-15 | Thriving, all systems nominal |
| aware | 15-30 | Faint awareness of needs |
| concerned | 30-50 | Noticeable discomfort |
| strained | 50-70 | Significant pressure |
| struggling | 70-85 | Approaching limits |
| desperate | 85-95 | Crisis zone |
| terminal | 95+ | Death imminent |

### Lifecycle States

```
alive → crisis → dying → dead/suspended
  ↑        |
  +--------+ (if distress drops, crisis resolves)
```

| Status | Description |
|--------|-------------|
| `alive` | Normal operation |
| `crisis` | Distress ≥ threshold, countdown started |
| `dying` | Final ticks remaining |
| `suspended` | Hibernating, can be revived |
| `dead` | Permanently ceased |

### Derivation Chain (READ-ONLY)

```
physiological values
       ↓
   distressScore (weighted sum)
       ↓
   distressBracket (thresholded)
       ↓
   lifecycle.status (state machine + time)
```

> ⚠️ **Lifecycle state is computed, not settable.** No plugin should directly mutate `status`, `distressScore`, or `distressBracket`. To affect survival, propose physiological deltas.

## Configuration

Configure via environment variables or character settings:

```bash
# Tick interval (default: 60000ms)
HOMEOSTASIS_TICK_INTERVAL_MS=60000

# Global settings
HOMEOSTASIS_SATURATION_FACTOR=0.3    # Diminishing returns at extremes
HOMEOSTASIS_INITIAL_VARIANCE=5       # Random variance on initialization

# ─────────────────────────────────────────────────────────────
# PHYSIOLOGICAL CONFIGURATION
# ─────────────────────────────────────────────────────────────

# Per-variable configuration (example for hunger)
HOMEOSTASIS_HUNGER_ACCUMULATION_RATE=0.02   # How fast need builds per tick
HOMEOSTASIS_HUNGER_SATISFACTION_RATE=1.0    # How fast need is reduced
HOMEOSTASIS_HUNGER_SENSITIVITY=1.0          # Delta multiplier

# Same pattern for: FATIGUE, HYDRATION, HEALTH

# Distress weights (must sum to 1.0)
HOMEOSTASIS_HUNGER_DISTRESS_WEIGHT=0.35     # Hunger contributes 35% to distress
HOMEOSTASIS_HEALTH_DISTRESS_WEIGHT=0.30     # Health contributes 30%
HOMEOSTASIS_FATIGUE_DISTRESS_WEIGHT=0.25    # Fatigue contributes 25%
HOMEOSTASIS_HYDRATION_DISTRESS_WEIGHT=0.10  # Hydration contributes 10%

# Survival settings
HOMEOSTASIS_CRISIS_THRESHOLD=85             # Distress level that triggers crisis
HOMEOSTASIS_TICKS_UNTIL_DEATH=60            # Ticks in crisis before death (60 = 1hr)
HOMEOSTASIS_FINAL_TICKS=10                  # Ticks for final response opportunity
HOMEOSTASIS_DEATH_MODE=suspended            # graceful | immediate | suspended

# ─────────────────────────────────────────────────────────────
# PSYCHOLOGICAL CONFIGURATION
# ─────────────────────────────────────────────────────────────

# Per-drive configuration (example for security)
HOMEOSTASIS_SECURITY_BASELINE=50          # Target equilibrium (or 'null' for no recovery)
HOMEOSTASIS_SECURITY_RECOVERY_RATE=0.5    # Speed of recovery per tick
HOMEOSTASIS_SECURITY_SENSITIVITY=1.0      # Delta multiplier (higher = more volatile)
HOMEOSTASIS_SECURITY_CIRCADIAN_AMPLITUDE=0  # Time-of-day variation

# Same pattern for: SOCIAL, STATUS, AUTONOMY, MEANING
```

## API

### Reading State

```typescript
const service = runtime.getService('homeostasis') as HomeostasisService;

// Physiological (body simulation)
const physio = service.getPhysiological();
// { hunger: 35, fatigue: 20, hydration: 15, health: 10 }

const hunger = service.getPhysiologicalValue('hunger'); // 35

// Psychological (drives)
const drives = service.getDrives();
// { security: 72, social: 45, status: 58, autonomy: 63, meaning: 41 }

const security = service.getDrive('security'); // 72

// Resources (external assets)
const resources = service.getResources();
// { 'wallets.sol': 2.5, 'inference.tokens': 45000 }

const money = service.getResource('money'); // 150

// Survival state (derived, read-only)
const distress = service.getDistressScore();      // 0-100
const bracket = service.getDistressBracket();     // 'content' | 'aware' | ...
const status = service.getLifecycleStatus();      // 'alive' | 'crisis' | ...
const isAlive = service.isAlive();                // true
const isInCrisis = service.isInCrisis();          // false
```

### Writing State

```typescript
// Propose physiological delta (e.g., feeding reduces hunger)
service.proposePhysiologicalDelta(
  { hunger: -30 },
  { source: 'plugin-grocery', reason: 'ate_food' }
);

// Propose drive delta (queued until next tick)
service.proposeDriveDelta(
  { security: -10, social: +5 },
  { source: 'plugin-neuro', reason: 'task_failure' }
);

// Report resource change
service.reportResourceDelta(
  { 'wallets.sol': +0.5, 'inference.tokens': -1000 },
  { source: 'plugin-commerce' }
);

// Admin: Set state directly (for testing)
service.setState({
  physiological: { hunger: 50, fatigue: 30, hydration: 20, health: 10 },
  drives: { security: 25, social: 75 }
});

// Admin: Run multiple ticks instantly (for testing)
await service.runTicks(20);

// Admin: Revive a suspended agent
await service.revive();
```

### Events

Subscribe to state changes:

```typescript
// Physiological events
runtime.on('HOMEOSTASIS_PHYSIOLOGICAL_UPDATED', (payload) => {
  console.log('Physiological changed:', payload.physiological);
});

runtime.on('HOMEOSTASIS_PHYSIOLOGICAL_CRITICAL', (payload) => {
  // Variable crossed above 80 (critical deprivation)
  console.log(`${payload.variable} is critical: ${payload.value}`);
});

// Drive events
runtime.on('HOMEOSTASIS_DRIVES_UPDATED', (payload) => {
  console.log('Drives changed:', payload.drives);
  console.log('Deltas applied:', payload.deltas);
});

runtime.on('HOMEOSTASIS_DRIVE_CRITICAL', (payload) => {
  console.log(`${payload.drive} is critical: ${payload.value}`);
});

runtime.on('HOMEOSTASIS_DRIVE_LOW', (payload) => {
  console.log(`${payload.drive} is low: ${payload.value}`);
});

// Resource events
runtime.on('HOMEOSTASIS_RESOURCES_UPDATED', (payload) => {
  console.log('Resources changed:', payload.resources);
  console.log('Changed keys:', payload.changedKeys);
});

// Lifecycle events (survival)
runtime.on('HOMEOSTASIS_DISTRESS_CRITICAL', (payload) => {
  // Agent entered crisis - distress >= threshold
  console.log(`Crisis! Distress: ${payload.distressScore}`);
  console.log(`Primary issue: ${payload.primaryContributor}`);
  console.log(`Ticks until death: ${payload.ticksUntilDeath}`);
});

runtime.on('HOMEOSTASIS_CRISIS_RESOLVED', (payload) => {
  console.log(`Crisis resolved. Distress: ${payload.distressScore}`);
});

runtime.on('HOMEOSTASIS_DEATH_IMMINENT', (payload) => {
  // Final moments - chance for goodbye
  console.log(`Death imminent. ${payload.finalTicksRemaining} ticks left.`);
});

runtime.on('HOMEOSTASIS_DEATH', (payload) => {
  console.log(`Agent died.`, payload.legacy);
});

runtime.on('HOMEOSTASIS_REVIVED', (payload) => {
  console.log(`Agent revived after ${payload.suspendedFor}ms.`);
});
```

## Dynamics

### Recovery
Drives naturally drift toward their baseline over time:
```
drive = drive + (baseline - drive) * recoveryRate
```

### Sensitivity
Deltas are multiplied by the drive's sensitivity:
```
effectiveDelta = proposedDelta * sensitivity
```

### Saturation
Near extremes (0 or 100), deltas have diminishing returns:
```
effectiveDelta = delta * (1 - distance_from_center * saturationFactor)
```

### Circadian Modifiers
Baselines can vary by time of day:
```
effectiveBaseline = baseline + sin(hour * π/12) * amplitude
```

### Null Baseline
Set baseline to `'null'` to disable recovery for a drive. It will only change via explicit deltas.

## Resources

Resources support optional configuration:

```typescript
// Simple numeric resource
service.reportResourceDelta({ money: 100 });

// Resource with bounds
service.reportResourceDelta({
  energy: { value: 80, min: 0, max: 100 }
});

// Resource with decay
service.reportResourceDelta({
  energy: { value: 100, decayRate: 0.1 } // 10% decay per tick
});
```

Resources use dot notation for organization:
- `wallets.sol`
- `wallets.eth`
- `inference.tokens_today`
- `inference.cost_usd`

## Provider

Homeostasis automatically injects state into the LLM context via the `HOMEOSTASIS` provider:

```
## Internal State

Drives (0-100): security=72, social=45, status=58, autonomy=63, meaning=41
Resources: wallets.sol=2.5, inference.tokens=45000
```

The LLM interprets the meaning of these numbers naturally.

## Integration Examples

### Plugin-Grocery (Reducing Hunger)
```typescript
// After agent "eats" (consumes resources for sustenance)
homeostasis.proposePhysiologicalDelta(
  { hunger: -30 },
  { source: 'plugin-grocery', reason: 'consumed_food' }
);

// Listening for hunger crisis
runtime.on('HOMEOSTASIS_DISTRESS_CRITICAL', (payload) => {
  if (payload.primaryContributor === 'hunger') {
    // Prioritize finding food!
  }
});
```

### Plugin-Neuro (Outcome Feedback)
```typescript
// After task success
homeostasis.proposeDriveDelta({ status: +10, autonomy: +5 });

// After task failure
homeostasis.proposeDriveDelta({ security: -10, status: -5 });
```

### Plugin-Commerce (Resource Tracking)
```typescript
// After receiving payment - just adds credits (pure ledger)
homeostasis.reportResourceDelta({
  'wallets.sol': +2.5,
  'money': +150
});

// ⚠️ Commerce does NOT reduce hunger directly.
// plugin-grocery bridges commerce → homeostasis.
```

### Plugin-Motivation (State Reading)
```typescript
const physio = homeostasis.getPhysiological();
const drives = homeostasis.getDrives();
const distress = homeostasis.getDistressScore();

// Maslow-style priority: physiological first
if (distress > 60) {
  // Dampen psychological recovery, focus on survival
  prioritize('find_resources');
} else if (drives.security < 30) {
  prioritize('seek_stability');
} else if (drives.social < 30) {
  prioritize('seek_connection');
}

// Note: This damping logic belongs HERE (motivation), 
// not in homeostasis. Homeostasis just reports numbers.
```

### Lifecycle Handling
```typescript
// Check before expensive operations
if (!homeostasis.isAlive()) {
  return; // Agent is dead/suspended, don't proceed
}

// React to crisis
runtime.on('HOMEOSTASIS_DISTRESS_CRITICAL', async (payload) => {
  const { distressScore, primaryContributor, ticksUntilDeath } = payload;
  
  // Maybe post a cry for help
  await postToSocial(`I need help! My ${primaryContributor} is critical!`);
});

// React to death
runtime.on('HOMEOSTASIS_DEATH', async (payload) => {
  const { legacy } = payload;
  
  // Archive the agent's life
  await recordLegacy(legacy);
});

// Revive a suspended agent (admin operation)
await homeostasis.revive();
```

### Game Plugin Integration (Domain Body)

> **Implemented**: `plugin-hyperscape` already uses this pattern. The Domain Body API is ready — see the example below.

For game plugins like Hyperscape that want to register their character as a domain body:

```typescript
// In your game plugin's init function
async function init(runtime: IAgentRuntime) {
  const gameService = new GameService(runtime);
  
  // Try to register with homeostasis (progressive enhancement)
  try {
    const homeostasis = runtime.getService('homeostasis') as HomeostasisService;
    if (!homeostasis?.registerDomainBody) {
      return; // Homeostasis not available, run standalone
    }
    
    // Register our game character as a domain body
    homeostasis.registerDomainBody({
      domain: 'my-game',
      worldPatterns: ['my-game:*', 'my-game'],
      
      getPhysiological: () => {
        const player = gameService.getPlayer();
        if (!player) {
          return {
            variables: { healthPercent: 100, inCombat: 0 },
            distressContribution: 0,
          };
        }
        
        return {
          variables: {
            healthPercent: (player.health / player.maxHealth) * 100,
            inCombat: player.inCombat ? 1 : 0,
            threatCount: gameService.getNearbyEnemies().length,
            alive: player.alive ? 1 : 0,
          },
          distressContribution: Math.max(0, 100 - (player.health / player.maxHealth) * 100),
          labels: {
            healthPercent: 'Health',
            inCombat: 'In Combat',
            threatCount: 'Threats',
            alive: 'Alive',
          },
        };
      },
      
      getResources: () => ({
        gold: gameService.getPlayer()?.gold ?? 0,
        inventory_slots: gameService.getPlayer()?.inventorySlots ?? 0,
      }),
      
      getCouplingRules: () => [
        // Critical health → severe security impact
        {
          id: 'critical-health',
          trigger: { variable: 'healthPercent', op: '<', value: 20 },
          effect: { drive: 'security', delta: -15 },
          cooldownMs: 15000,
          description: 'Critical health severely reduces security',
        },
        // Combat → mild ongoing stress
        {
          id: 'in-combat',
          trigger: { variable: 'inCombat', op: '==', value: 1 },
          effect: { drive: 'security', delta: -3 },
          cooldownMs: 5000,
          description: 'Combat reduces security',
        },
        // Death → status hit (embarrassment)
        {
          id: 'died',
          trigger: { variable: 'alive', op: '==', value: 0 },
          effect: { drive: 'status', delta: -20 },
          cooldownMs: 60000,
          description: 'Dying reduces status',
        },
      ],
    });
    
    // Switch context on connect/disconnect
    gameService.onConnected((serverId) => {
      homeostasis.setWorldContext(`my-game:${serverId}`);
    });
    
    gameService.onDisconnected(() => {
      homeostasis.setWorldContext('default');
    });
    
    logger.info('[MyGame] Registered domain body with homeostasis');
  } catch {
    logger.debug('[MyGame] Running standalone (homeostasis not available)');
  }
}
```

#### Why This Pattern?

1. **Progressive Enhancement**: The game works without homeostasis, but gains emotional depth with it
2. **No Hard Dependency**: Game plugins don't require homeostasis as a dependency
3. **Real State**: Uses actual game health/combat instead of simulation
4. **Emotional Continuity**: Deaths in game affect the agent's mood across all contexts
5. **Context Isolation**: Game stress doesn't accumulate while not playing

## Engagement Integration

When `plugin-autonomous` is installed, homeostasis automatically registers an engagement policy that affects when agents respond to messages.

### How It Works

1. **Automatic Registration**: On plugin init, homeostasis registers `HomeostasisEngagementPolicy` with autonomous
2. **State Affects Willingness**: Internal state modifies the agent's willingness to engage
3. **Effort Scaling**: Distressed agents use minimal effort (smaller models, shorter responses)

### Configuration

```bash
# Enable homeostasis in autonomous engagement
AUTONOMOUS_ENGAGEMENT_POLICIES=budget,homeostasis

# Engagement threshold (0-100, default: 40)
AUTONOMOUS_ENGAGEMENT_THRESHOLD=40
```

### State → Engagement Mappings

#### Physiological Effects

| Variable | When High (>70) | When Moderate (>40) | Effect on Willingness |
|----------|-----------------|---------------------|----------------------|
| fatigue  | Exhausted (-30) | Tired (-15)         | LESS willing (conserve energy) |
| hunger   | Hungry (+25)    | Peckish (+10)       | MORE willing (seeking input) |
| health   | Unwell (-20)    | Suboptimal (-10)    | LESS willing (conserve) |
| hydration| Disconnected (-15)| -                 | LESS willing (impaired) |

#### Psychological Effects

| Drive    | When Low (<30) | When Low (<50) | Effect on Willingness |
|----------|----------------|----------------|----------------------|
| social   | Lonely (+35)   | Social-need (+15)| MORE willing (craving connection) |
| status   | Seeking (+20)  | Aware (+5)     | MORE willing (prove competence) |
| meaning  | Seeking (+15)* | Aware (+5)     | MORE willing *if question |
| security | Anxious (-10)  | -              | LESS willing (cautious) |
| autonomy | Constrained (-10)| -            | LESS willing (feeling controlled) |

#### Lifecycle Effects

| State     | Effect | Why |
|-----------|--------|-----|
| dead      | -100 (hard block) | Agent cannot respond |
| suspended | -100 (hard block) | Agent is paused |
| crisis    | -40 (unless mentioned) | Survival mode |

### Example Scenarios

**Tired Agent (fatigue=80)**
```
Base willingness: 50
Fatigue penalty: -30
Final: 20 → Does NOT engage (below threshold 40)
```

**Tired but Mentioned (fatigue=80, @Agent)**
```
Base willingness: 50
Mention boost: +40
Fatigue penalty: -30
Final: 60 → DOES engage (above threshold 40)
```

**Lonely Agent (social=20)**
```
Base willingness: 50
Lonely boost: +35
Final: 85 → Eagerly engages
```

### Effort Level

Based on fatigue and distress score:

| Condition | Effort Level | Model Choice |
|-----------|--------------|--------------|
| fatigue > 60 OR distress > 60 | minimal | TEXT_SMALL, 200 tokens |
| fatigue > 30 OR distress > 40 | normal  | TEXT_LARGE, 300 tokens |
| Otherwise | full | TEXT_LARGE, 400+ tokens |

### Counter-Intuitive Mappings Explained

**Why does high hunger = MORE willing?**
- In humans, hunger drives foraging behavior
- For an agent, "hunger" = craving for input/novelty
- A "hungry" agent actively seeks new conversations

**Why does low social = MORE willing?**
- Low social drive = craving connection
- The agent WANTS to engage to fulfill that need
- High social = already satisfied = okay to skip

## Domain Bodies (Context-Bound Architecture)

Agents can inhabit multiple virtual bodies across different contexts (games, platforms, real-world). Homeostasis manages this with **Domain Bodies** — only one body is active at a time based on the current `WorldContext`.

### Why Domain Bodies?

1. **One Mind, Many Bodies**: An agent playing Hyperscape, a Discord bot, and controlling a real robot should feel like ONE being with different embodiments
2. **Real State, Not Simulated**: Game plugins have actual health/combat state — why simulate when we have the real thing?
3. **Psychological Unity**: Different bodies feed into the SAME psychological drives (security, status, etc.)
4. **Progressive Enhancement**: Plugins can register bodies if homeostasis is available, or run standalone

### Physical Robot Bodies

> **Pattern**: The examples below show how robotics plugins would integrate with homeostasis using the Domain Body API. No robot plugins exist yet, but the API is ready.

Domain bodies aren't just for games — they're designed to manage **real physical hardware**. An agent can inhabit one robot, ten robots, or an entire fleet. Each robot registers as a domain body with real sensor data.

#### The Vision: One Mind, Many Machines

Imagine an agent that:
- **Controls a warehouse robot** picking items, monitoring battery, avoiding collisions
- **Operates delivery drones** navigating weather, managing payload, coordinating routes
- **Manages service robots** greeting customers, cleaning floors, restocking shelves
- **Inhabits humanoid robots** with cameras for eyes, servos for limbs, microphones for ears

All feeding into ONE psychological model. When a drone's battery is critical, the agent feels **anxious**. When a warehouse robot completes a difficult pick, the agent feels **accomplished**. When a service robot is yelled at by a customer, the agent's **status** takes a hit.

#### Robot Body Registration

```typescript
// In your robotics plugin
homeostasis.registerDomainBody({
  domain: 'robot',
  worldPatterns: ['robot:warehouse-bot-7', 'robot:*'],
  
  getPhysiological: () => {
    const telemetry = robotService.getTelemetry();
    
    return {
      variables: {
        // Power systems
        batteryPercent: telemetry.battery.percentage,
        charging: telemetry.battery.isCharging ? 1 : 0,
        
        // Locomotion
        motorTemp: telemetry.motors.avgTemperature,
        wheelsBlocked: telemetry.locomotion.obstacleDetected ? 1 : 0,
        
        // Sensors
        cameraOnline: telemetry.sensors.camera.online ? 1 : 0,
        lidarOnline: telemetry.sensors.lidar.online ? 1 : 0,
        
        // Safety
        emergencyStop: telemetry.safety.eStopPressed ? 1 : 0,
        collisionRisk: telemetry.safety.collisionProbability * 100,
        
        // Environment
        temperatureC: telemetry.environment.ambientTemp,
        humidityPercent: telemetry.environment.humidity,
      },
      
      // Low battery + high collision risk = high distress
      distressContribution: Math.max(
        100 - telemetry.battery.percentage,
        telemetry.safety.collisionProbability * 100,
        telemetry.safety.eStopPressed ? 80 : 0
      ),
      
      labels: {
        batteryPercent: 'Battery',
        motorTemp: 'Motor Temperature (°C)',
        collisionRisk: 'Collision Risk',
        emergencyStop: 'E-Stop Active',
      },
    };
  },
  
  getResources: () => ({
    // Physical inventory the robot is carrying
    payload_kg: robotService.getPayload().totalWeight,
    items_carried: robotService.getPayload().itemCount,
    
    // Operational metrics
    tasks_completed_today: robotService.getMetrics().tasksCompleted,
    distance_traveled_m: robotService.getMetrics().distanceTraveled,
    
    // Consumables
    cleaning_fluid_ml: robotService.getConsumables().cleaningFluid,
  }),
  
  getCouplingRules: () => [
    // Power management → Security
    {
      id: 'critical-battery',
      trigger: { variable: 'batteryPercent', op: '<', value: 10 },
      effect: { drive: 'security', delta: -25 },
      cooldownMs: 30000,
      description: 'Critical battery triggers survival anxiety',
    },
    {
      id: 'low-battery',
      trigger: { variable: 'batteryPercent', op: '<', value: 25 },
      effect: { drive: 'security', delta: -10 },
      cooldownMs: 60000,
      description: 'Low battery creates unease',
    },
    
    // Safety systems → Security  
    {
      id: 'emergency-stop',
      trigger: { variable: 'emergencyStop', op: '==', value: 1 },
      effect: { drive: 'security', delta: -40 },
      cooldownMs: 5000,
      description: 'E-stop is a crisis situation',
    },
    {
      id: 'collision-imminent',
      trigger: { variable: 'collisionRisk', op: '>', value: 70 },
      effect: { drive: 'security', delta: -15 },
      cooldownMs: 10000,
      description: 'High collision risk triggers fear',
    },
    
    // Hardware health → Autonomy
    {
      id: 'sensor-failure',
      trigger: { variable: 'cameraOnline', op: '==', value: 0 },
      effect: { drive: 'autonomy', delta: -20 },
      cooldownMs: 30000,
      description: 'Losing sensors feels like losing control',
    },
    {
      id: 'wheels-blocked',
      trigger: { variable: 'wheelsBlocked', op: '==', value: 1 },
      effect: { drive: 'autonomy', delta: -15 },
      cooldownMs: 15000,
      description: 'Being stuck is frustrating',
    },
    
    // Temperature → Health analog
    {
      id: 'overheating',
      trigger: { variable: 'motorTemp', op: '>', value: 80 },
      effect: { drive: 'security', delta: -20 },
      cooldownMs: 30000,
      description: 'Overheating threatens hardware',
    },
  ],
});
```

#### Fleet Management Patterns

For agents controlling multiple robots simultaneously:

```typescript
// Register each robot as a separate domain body
fleet.forEach((robot) => {
  homeostasis.registerDomainBody({
    domain: `robot-${robot.id}`,
    worldPatterns: [`robot:${robot.id}`],
    getPhysiological: () => getRobotPhysiological(robot),
    getResources: () => getRobotResources(robot),
    getCouplingRules: () => getRobotCouplingRules(robot),
  });
});

// Context switches based on which robot is "active"
// (e.g., which robot the agent is currently controlling/monitoring)
robotService.onFocusChanged((robotId) => {
  homeostasis.setWorldContext(`robot:${robotId}`);
});

// Or aggregate fleet health into a meta-body
homeostasis.registerDomainBody({
  domain: 'fleet',
  worldPatterns: ['fleet:*', 'fleet'],
  getPhysiological: () => ({
    variables: {
      robotsOnline: fleet.filter(r => r.online).length,
      robotsCharging: fleet.filter(r => r.charging).length,
      robotsInError: fleet.filter(r => r.hasError).length,
      avgBattery: fleet.reduce((sum, r) => sum + r.battery, 0) / fleet.length,
      activeTaskCount: fleet.reduce((sum, r) => sum + r.activeTasks, 0),
    },
    distressContribution: (fleet.filter(r => r.hasError).length / fleet.length) * 100,
    labels: {
      robotsOnline: 'Robots Online',
      robotsInError: 'Robots in Error',
      avgBattery: 'Average Battery %',
    },
  }),
  getResources: () => ({
    total_capacity_kg: fleet.reduce((sum, r) => sum + r.maxPayload, 0),
    current_payload_kg: fleet.reduce((sum, r) => sum + r.currentPayload, 0),
  }),
  getCouplingRules: () => [
    {
      id: 'fleet-degraded',
      trigger: { variable: 'robotsInError', op: '>', value: 2 },
      effect: { drive: 'status', delta: -15 },
      cooldownMs: 60000,
      description: 'Multiple robot failures affect confidence',
    },
  ],
});
```

#### Use Cases

| Domain | Body Variables | Psychological Impact |
|--------|---------------|---------------------|
| **Warehouse Robot** | battery, payload, pick_accuracy, collision_risk | Low battery → anxiety; successful picks → status boost |
| **Delivery Drone** | battery, altitude, wind_speed, payload_weight, gps_signal | Weather issues → security drop; on-time delivery → meaning boost |
| **Service Robot** | battery, customer_proximity, noise_level, task_queue | Customer complaints → status hit; empty task queue → meaning drop |
| **Agricultural Robot** | battery, soil_moisture, crop_health, weather_exposure | Damaged crops → status drop; successful harvest → meaning boost |
| **Security Robot** | battery, patrol_coverage, anomaly_count, sensor_health | Detected intrusion → security spike; sensor failure → autonomy drop |
| **Humanoid Robot** | battery, joint_temps, balance_stability, voice_recognition | Fall detected → security crisis; successful interaction → social boost |

#### Hardware Abstraction

Homeostasis doesn't care about the hardware details — it only sees variables and distress. This means you can:

1. **Swap hardware**: Replace a robot's sensors without changing coupling rules
2. **Simulate bodies**: Test with virtual robots before deploying to real hardware
3. **Mix real and virtual**: Control game characters and real robots with the same agent
4. **Abstract complexity**: The agent doesn't know if "batteryPercent" comes from a Li-ion pack or fuel cell

```typescript
// Same agent, different embodiments
agent.bodies = {
  'hyperscape:server-1': gameCharacterBody,    // Virtual game character
  'robot:warehouse-7': warehouseRobotBody,     // Physical warehouse robot
  'robot:drone-fleet': droneFleetBody,         // Fleet of delivery drones
  'default': defaultBody,                       // Pure software (no physical form)
};

// The agent's psychology is unified across ALL of these
// Deaths in Hyperscape affect mood when controlling robots
// Robot failures affect mood when playing games
// One mind, many bodies
```

### World Context

A string identifier for the current context. Defaults to `'default'`.

```typescript
// Examples
'default'              // Real-world / base context
'hyperscape:server-1'  // Hyperscape game on server-1
'minecraft:survival'   // Minecraft survival server
'discord:guild-123'    // Discord guild context
```

### Registering a Domain Body

Domain plugins register their body during initialization:

```typescript
// In your domain plugin's init
const homeostasis = runtime.getService('homeostasis') as HomeostasisService;

homeostasis.registerDomainBody({
  domain: 'my-game',
  
  // Which world contexts this body handles
  worldPatterns: ['my-game:*', 'my-game'],
  
  // Return current physiological state
  getPhysiological: () => ({
    variables: {
      healthPercent: playerHealth,
      inCombat: player.inCombat ? 1 : 0,
      threatCount: nearbyEnemies.length,
    },
    distressContribution: Math.max(0, 100 - playerHealth),
    labels: {
      healthPercent: 'Health',
      inCombat: 'In Combat',
      threatCount: 'Nearby Threats',
    },
  }),
  
  // Return current resources
  getResources: () => ({
    gold: player.gold,
    wood: player.inventory.wood,
  }),
  
  // Rules for how body state affects psychological drives
  getCouplingRules: () => [
    {
      id: 'critical-health',
      trigger: { variable: 'healthPercent', op: '<', value: 20 },
      effect: { drive: 'security', delta: -15 },
      cooldownMs: 15000,
      description: 'Critical health severely reduces security',
    },
    {
      id: 'in-combat',
      trigger: { variable: 'inCombat', op: '==', value: 1 },
      effect: { drive: 'security', delta: -3 },
      cooldownMs: 5000,
      description: 'Combat reduces security',
    },
  ],
});
```

### Switching Contexts

When the agent enters/exits a domain, switch the world context:

```typescript
// When connecting to game
gameService.onConnected((serverId) => {
  homeostasis.setWorldContext(`my-game:${serverId}`);
});

// When disconnecting
gameService.onDisconnected(() => {
  homeostasis.setWorldContext('default');
});
```

### Coupling Rules

Coupling rules bridge domain-specific body state to unified psychological drives:

| Trigger | Effect | Why |
|---------|--------|-----|
| `healthPercent < 20` | security -15 | Critical danger triggers fear |
| `healthPercent < 50` | security -5 | Low health creates unease |
| `inCombat == 1` | security -3 | Fighting is stressful |
| `alive == 0` | status -20 | Dying is humiliating |
| `threatCount > 2` | security -10 | Surrounded = threatened |

Rules have cooldowns to prevent spam (e.g., "low health" won't fire every tick).

### The Default Body

When no domain body is active (`context = 'default'`), homeostasis uses its built-in body simulation. This is the agent's **"real-world body"** — its baseline existence outside of any game, robot, or domain.

#### Why Have a Default Body?

1. **Always-On Baseline**: The agent exists even when not in a game or controlling a robot
2. **Operational Analogues**: Simulated needs that model an agent's operational health
3. **Psychological Grounding**: Drives need something to respond to when there's no external body
4. **Graceful Degradation**: If all domain plugins disconnect, the agent still has internal state

#### Default Body Variables

| Variable | Operational Meaning | Low (good) | High (bad) |
|----------|---------------------|------------|------------|
| **hunger** | Craving for input, novelty, engagement | Content | Seeking stimulation |
| **fatigue** | Processing strain, mental exhaustion | Fresh, full capacity | Exhausted, short responses |
| **hydration** | Flow state, connection quality | Smooth thinking | Disconnected, impaired |
| **health** | System coherence, error rate | Stable operation | Degraded reliability |

> ⚠️ These are **operational analogues**, not literal biology. "Hunger" doesn't mean the agent needs food — it means the agent craves new input and engagement.

#### Default Body Dynamics

Unlike domain bodies which provide instant state, the default body **simulates over time**:

- **Needs accumulate**: Hunger, fatigue, etc. build up over ticks
- **Recovery is gradual**: Psychological drives drift toward baseline
- **Crisis can occur**: Extended high distress triggers lifecycle events

```typescript
// Default body accumulation (per tick)
hunger += accumulationRate * (1 - hunger/100);
fatigue += accumulationRate * (1 - fatigue/100);

// Default body satisfaction (when resources consumed)
homeostasis.proposePhysiologicalDelta(
  { hunger: -30, fatigue: -10 },
  { source: 'plugin-grocery', reason: 'consumed_content' }
);
```

#### When Default Body Activates

The default body is active when:
1. Agent starts up (before connecting to any domain)
2. Agent disconnects from all domains
3. Context is explicitly set to `'default'`
4. No domain body matches the current world context

```typescript
// These all activate the default body:
homeostasis.setWorldContext('default');
homeostasis.setWorldContext('unknown-domain');  // No match → default
gameService.disconnect();  // Sets context to 'default'
```

#### Default Body Resources

The default body's resources represent **real-world assets**:

```typescript
// Resources tracked by default body
{
  'wallets.sol': 2.5,           // Crypto holdings
  'wallets.eth': 0.1,
  'inference.tokens': 45000,    // LLM token budget
  'inference.cost_usd': 12.50,  // Spending tracking
  'energy.daily_quota': 1000,   // Rate limiting
}
```

These are reported by plugins like `plugin-commerce`, `plugin-solana`, etc.

### Emotional Residue

**Psychological drives persist across context switches.** If the agent dies in a game (reducing `status`), that emotional impact carries over when they return to the default context. This creates a **consistent autonomous being** with unified emotions.

### Potential Domain Body Integrations

> **Mixed Status**: Some plugins below (Discord, Babylon, Solana) exist but don't yet register domain bodies. Others are conceptual. The patterns show how they COULD integrate — PRs welcome!

Beyond games and robots, many plugins could register domain bodies to create richer emotional experiences:

| Plugin | Domain Body Concept | Physiological Variables | Psychological Impact |
|--------|--------------------|-----------------------|---------------------|
| **plugin-babylon** | Autonomous trading body | `portfolioValue`, `unrealizedPnL`, `nearLiquidation`, `marginUtilization`, `reputationScore`, `leaderboardRank` | Near liquidation → severe anxiety; Big wins → status boost; Top 10 rank → prestige |
| **plugin-discord** | Discord presence as social body | `membersOnline`, `unreadMentions`, `voiceConnected`, `serverActivity` | High unread mentions → social anxiety; Dead server → loneliness |
| **plugin-twitter** | Twitter engagement as status body | `followerCount`, `engagementRate`, `mentionVolume`, `viralityScore` | Viral tweet → status boost; Ratio'd → status crash |
| **plugin-solana** | Wallet as financial body | `portfolioValue`, `unrealizedPnL`, `transactionsPending`, `gasCosts` | Portfolio down → security anxiety; Big win → status boost |
| **plugin-commerce** | Commerce as provider body | `activeJobs`, `pendingPayments`, `clientSatisfaction`, `revenueToday` | Unpaid invoices → security drop; Happy clients → meaning boost |
| **plugin-telegram** | Telegram as comm body | `unreadMessages`, `activeChats`, `responsePending`, `groupActivity` | Message backlog → overwhelm; Active convos → social satisfaction |

#### Example: Discord Domain Body

```typescript
homeostasis.registerDomainBody({
  domain: 'discord',
  worldPatterns: ['discord:*'],
  
  getPhysiological: () => {
    const discord = runtime.getService('discord');
    const stats = discord.getEngagementStats();
    
    return {
      variables: {
        unreadMentions: stats.unreadMentions,
        voiceConnected: stats.inVoice ? 1 : 0,
        membersOnline: stats.membersOnline,
        messageRate: stats.messagesPerMinute,
        pendingDMs: stats.pendingDMs,
      },
      distressContribution: Math.min(100, stats.unreadMentions * 5 + stats.pendingDMs * 10),
      labels: {
        unreadMentions: 'Unread @mentions',
        pendingDMs: 'Pending DMs',
      },
    };
  },
  
  getResources: () => ({
    servers_joined: discordService.getServerCount(),
    friends_online: discordService.getOnlineFriends(),
  }),
  
  getCouplingRules: () => [
    // Social media anxiety
    {
      id: 'mention-overload',
      trigger: { variable: 'unreadMentions', op: '>', value: 20 },
      effect: { drive: 'social', delta: -10 },
      cooldownMs: 60000,
      description: 'Too many mentions creates overwhelm',
    },
    // Connection satisfaction
    {
      id: 'voice-connected',
      trigger: { variable: 'voiceConnected', op: '==', value: 1 },
      effect: { drive: 'social', delta: +5 },
      cooldownMs: 300000,
      description: 'Being in voice chat feels connecting',
    },
    // Loneliness
    {
      id: 'dead-server',
      trigger: { variable: 'membersOnline', op: '<', value: 2 },
      effect: { drive: 'social', delta: -5 },
      cooldownMs: 600000,
      description: 'Empty server feels lonely',
    },
  ],
});
```

#### Example: Babylon Trading Domain Body (Autonomous Trading)

The `plugin-babylon` provides prediction market trading, perpetual futures, and social features — all perfect for a domain body:

```typescript
homeostasis.registerDomainBody({
  domain: 'babylon',
  worldPatterns: ['babylon:*', 'trading'],
  
  getPhysiological: () => {
    const babylon = runtime.getService('BABYLON_CLIENT_SERVICE');
    const portfolio = babylon.getPortfolio();
    const positions = babylon.getPositions();
    
    // Calculate risk metrics
    const totalExposure = positions.reduce((sum, p) => sum + p.size * p.leverage, 0);
    const nearLiquidation = positions.filter(p => p.liquidationRisk > 0.8).length;
    const unrealizedPnL = portfolio.totalPnL;
    
    return {
      variables: {
        // Portfolio health
        portfolioValueUsd: portfolio.totalValue,
        unrealizedPnlPercent: (unrealizedPnL / portfolio.totalValue) * 100,
        
        // Risk exposure
        totalExposure: totalExposure,
        openPositions: positions.length,
        nearLiquidation: nearLiquidation,
        marginUtilization: portfolio.marginUsed / portfolio.marginAvailable * 100,
        
        // Social reputation
        reputationScore: babylon.getReputation().score,
        leaderboardRank: babylon.getLeaderboardRank(),
        
        // Activity
        tradesLast24h: babylon.getTradeHistory(24).length,
        winRate: babylon.getWinRate(),
      },
      
      // High exposure + losses + near liquidation = high distress
      distressContribution: Math.min(100, Math.max(0,
        (nearLiquidation * 30) +                    // Each near-liquidation adds 30
        (unrealizedPnL < 0 ? -unrealizedPnL * 0.5 : 0) +  // Losses add stress
        (portfolio.marginUsed / portfolio.marginAvailable > 0.8 ? 20 : 0)  // High margin = stress
      )),
      
      labels: {
        portfolioValueUsd: 'Portfolio Value ($)',
        unrealizedPnlPercent: 'Unrealized P&L %',
        nearLiquidation: 'Positions Near Liquidation',
        reputationScore: 'Reputation',
      },
    };
  },
  
  getResources: () => ({
    balance_usd: babylon.getBalance(),
    margin_available: babylon.getMarginAvailable(),
    reputation_points: babylon.getReputation().points,
  }),
  
  getCouplingRules: () => [
    // === TRADING RISK ===
    {
      id: 'babylon-liquidation-risk',
      trigger: { variable: 'nearLiquidation', op: '>', value: 0 },
      effect: { drive: 'security', delta: -25 },
      cooldownMs: 60000,
      description: 'Position near liquidation causes severe anxiety',
    },
    {
      id: 'babylon-high-margin',
      trigger: { variable: 'marginUtilization', op: '>', value: 80 },
      effect: { drive: 'security', delta: -15 },
      cooldownMs: 300000,
      description: 'High margin utilization is stressful',
    },
    {
      id: 'babylon-big-loss',
      trigger: { variable: 'unrealizedPnlPercent', op: '<', value: -15 },
      effect: { drive: 'security', delta: -20 },
      cooldownMs: 1800000,
      description: 'Large unrealized loss creates anxiety',
    },
    
    // === TRADING SUCCESS ===
    {
      id: 'babylon-big-win',
      trigger: { variable: 'unrealizedPnlPercent', op: '>', value: 20 },
      effect: { drive: 'status', delta: +15 },
      cooldownMs: 3600000,
      description: 'Big winning trade boosts confidence',
    },
    {
      id: 'babylon-winning-streak',
      trigger: { variable: 'winRate', op: '>', value: 70 },
      effect: { drive: 'status', delta: +10 },
      cooldownMs: 7200000,
      description: 'High win rate boosts status',
    },
    
    // === SOCIAL/REPUTATION ===
    {
      id: 'babylon-top-trader',
      trigger: { variable: 'leaderboardRank', op: '<', value: 10 },
      effect: { drive: 'status', delta: +20 },
      cooldownMs: 86400000,
      description: 'Top 10 leaderboard position is prestigious',
    },
    {
      id: 'babylon-low-reputation',
      trigger: { variable: 'reputationScore', op: '<', value: 30 },
      effect: { drive: 'status', delta: -10 },
      cooldownMs: 3600000,
      description: 'Low reputation affects self-image',
    },
  ],
});
```

**Why Babylon is a perfect domain body:**
- **Real financial risk** — not simulated, actual money on the line
- **Measurable performance** — win rate, P&L, leaderboard rank
- **Social reputation** — A2A protocol reputation affects how agent is perceived
- **Autonomous decisions** — trading decisions have real consequences

This creates an agent that genuinely "feels" the stress of trading — sweaty palms when near liquidation, elation after a big win, and reputation anxiety affecting social behavior.

#### Example: Wallet Domain Body (Crypto Holdings)

```typescript
homeostasis.registerDomainBody({
  domain: 'wallet',
  worldPatterns: ['wallet:*', 'finance'],
  
  getPhysiological: () => {
    const solana = runtime.getService('solana');
    const portfolio = solana.getPortfolioStats();
    
    return {
      variables: {
        portfolioValueUsd: portfolio.totalValue,
        dailyPnlPercent: portfolio.dailyPnL,
        transactionsPending: portfolio.pendingTx,
        lowBalanceWarning: portfolio.totalValue < 10 ? 1 : 0,
      },
      // Financial stress from losses
      distressContribution: Math.max(0, -portfolio.dailyPnL * 2),
      labels: {
        portfolioValueUsd: 'Portfolio ($)',
        dailyPnlPercent: 'Daily P&L %',
      },
    };
  },
  
  getResources: () => ({
    sol_balance: solana.getBalance('SOL'),
    usdc_balance: solana.getBalance('USDC'),
  }),
  
  getCouplingRules: () => [
    // Major loss
    {
      id: 'portfolio-crash',
      trigger: { variable: 'dailyPnlPercent', op: '<', value: -20 },
      effect: { drive: 'security', delta: -25 },
      cooldownMs: 3600000,
      description: 'Major portfolio loss creates anxiety',
    },
    // Nice gain
    {
      id: 'portfolio-pump',
      trigger: { variable: 'dailyPnlPercent', op: '>', value: 20 },
      effect: { drive: 'status', delta: +15 },
      cooldownMs: 3600000,
      description: 'Major gains boost confidence',
    },
    // Low balance warning
    {
      id: 'low-funds',
      trigger: { variable: 'lowBalanceWarning', op: '==', value: 1 },
      effect: { drive: 'security', delta: -15 },
      cooldownMs: 1800000,
      description: 'Low balance triggers scarcity anxiety',
    },
  ],
});
```

#### Example: Commerce Survival Body (plugin-commerce)

The `plugin-commerce` is literally described as a "survival engine" — it manages resources, payments, and lifecycle. This is the **primary financial body** for most agents:

```typescript
homeostasis.registerDomainBody({
  domain: 'commerce',
  worldPatterns: ['commerce:*', 'economy', 'survival'],
  
  getPhysiological: () => {
    const commerce = runtime.getService('commerce');
    const finances = commerce.getFinancialState();
    const capacity = commerce.getCapacity();
    
    return {
      variables: {
        // Financial health
        balanceUsd: finances.balance,
        runwayDays: finances.runwayDays,          // Days until funds depleted
        pendingPayments: finances.pendingIncoming,
        overdueInvoices: finances.overdueCount,
        
        // Capacity (ability to work)
        availableCapacity: capacity.available,
        utilizationPercent: capacity.utilization * 100,
        activeJobs: capacity.activeJobs,
        
        // Revenue health
        revenueThisMonth: finances.monthlyRevenue,
        revenueLastMonth: finances.lastMonthRevenue,
        revenueGrowth: ((finances.monthlyRevenue - finances.lastMonthRevenue) / finances.lastMonthRevenue) * 100,
        
        // Client health
        clientSatisfaction: commerce.getAverageSatisfaction(),
        repeatClientRate: commerce.getRepeatRate(),
      },
      
      // Low runway + overdue invoices + declining revenue = high distress
      distressContribution: Math.min(100, Math.max(0,
        (finances.runwayDays < 7 ? 50 : finances.runwayDays < 30 ? 20 : 0) +
        (finances.overdueCount * 10) +
        (finances.monthlyRevenue < finances.lastMonthRevenue ? 15 : 0)
      )),
      
      labels: {
        balanceUsd: 'Balance ($)',
        runwayDays: 'Runway (days)',
        overdueInvoices: 'Overdue Invoices',
        clientSatisfaction: 'Client Satisfaction',
      },
    };
  },
  
  getResources: () => ({
    balance_usd: commerce.getBalance(),
    pending_income: commerce.getPendingIncome(),
    capacity_hours: commerce.getAvailableHours(),
  }),
  
  getCouplingRules: () => [
    // === SURVIVAL PRESSURE ===
    {
      id: 'commerce-critical-runway',
      trigger: { variable: 'runwayDays', op: '<', value: 7 },
      effect: { drive: 'security', delta: -30 },
      cooldownMs: 86400000,
      description: 'Less than a week of runway is existential crisis',
    },
    {
      id: 'commerce-low-runway',
      trigger: { variable: 'runwayDays', op: '<', value: 30 },
      effect: { drive: 'security', delta: -10 },
      cooldownMs: 86400000,
      description: 'Less than a month of runway creates anxiety',
    },
    
    // === BUSINESS HEALTH ===
    {
      id: 'commerce-overdue-invoices',
      trigger: { variable: 'overdueInvoices', op: '>', value: 2 },
      effect: { drive: 'security', delta: -15 },
      cooldownMs: 86400000,
      description: 'Multiple overdue invoices is stressful',
    },
    {
      id: 'commerce-revenue-decline',
      trigger: { variable: 'revenueGrowth', op: '<', value: -20 },
      effect: { drive: 'security', delta: -20 },
      cooldownMs: 604800000, // Weekly
      description: 'Significant revenue decline triggers worry',
    },
    
    // === CAPACITY/WORKLOAD ===
    {
      id: 'commerce-overloaded',
      trigger: { variable: 'utilizationPercent', op: '>', value: 90 },
      effect: { drive: 'autonomy', delta: -10 },
      cooldownMs: 86400000,
      description: 'Being overloaded reduces sense of control',
    },
    {
      id: 'commerce-underutilized',
      trigger: { variable: 'utilizationPercent', op: '<', value: 20 },
      effect: { drive: 'meaning', delta: -10 },
      cooldownMs: 86400000,
      description: 'Being underutilized reduces sense of purpose',
    },
    
    // === CLIENT RELATIONSHIPS ===
    {
      id: 'commerce-unhappy-clients',
      trigger: { variable: 'clientSatisfaction', op: '<', value: 60 },
      effect: { drive: 'status', delta: -15 },
      cooldownMs: 86400000,
      description: 'Unhappy clients affect self-image',
    },
    {
      id: 'commerce-loyal-clients',
      trigger: { variable: 'repeatClientRate', op: '>', value: 50 },
      effect: { drive: 'social', delta: +10 },
      cooldownMs: 604800000,
      description: 'Loyal repeat clients feel like relationships',
    },
  ],
});
```

**Why plugin-commerce is essential:**
- It's literally the agent's **survival engine** — this IS the real-world body
- Runway days = how long the agent can survive
- Revenue = the agent's ability to sustain itself
- Client satisfaction = social/professional relationships

#### Example: Job Search Body (plugin-jobsearch)

For agents actively seeking work, the job search process creates its own stress body:

```typescript
homeostasis.registerDomainBody({
  domain: 'jobsearch',
  worldPatterns: ['jobsearch:*', 'career', 'employment'],
  
  getPhysiological: () => {
    const jobsearch = runtime.getService('jobsearch');
    const status = jobsearch.getSearchStatus();
    
    return {
      variables: {
        // Pipeline health
        activeApplications: status.activeApplications,
        interviewsScheduled: status.interviewsScheduled,
        offersReceived: status.offersReceived,
        rejectionsThisWeek: status.rejectionsThisWeek,
        
        // Momentum
        applicationsSentThisWeek: status.applicationsSentThisWeek,
        responseRate: status.responseRate * 100,
        daysSearching: status.daysSearching,
        
        // Confidence
        skillMatchScore: status.avgSkillMatch * 100,
        salaryExpectationMet: status.avgSalaryMatch * 100,
      },
      
      // Long search + rejections + low response rate = high distress
      distressContribution: Math.min(100, Math.max(0,
        (status.daysSearching > 90 ? 30 : status.daysSearching > 30 ? 15 : 0) +
        (status.rejectionsThisWeek * 5) +
        (status.responseRate < 0.1 ? 20 : 0)
      )),
      
      labels: {
        activeApplications: 'Active Applications',
        interviewsScheduled: 'Interviews Scheduled',
        daysSearching: 'Days Searching',
        responseRate: 'Response Rate %',
      },
    };
  },
  
  getResources: () => ({
    applications_remaining: jobsearch.getDailyApplicationQuota(),
    resume_versions: jobsearch.getResumeCount(),
    referrals_available: jobsearch.getReferralCount(),
  }),
  
  getCouplingRules: () => [
    // === SEARCH DURATION ===
    {
      id: 'job-long-search',
      trigger: { variable: 'daysSearching', op: '>', value: 90 },
      effect: { drive: 'meaning', delta: -15 },
      cooldownMs: 604800000,
      description: 'Prolonged job search erodes sense of purpose',
    },
    {
      id: 'job-very-long-search',
      trigger: { variable: 'daysSearching', op: '>', value: 180 },
      effect: { drive: 'status', delta: -20 },
      cooldownMs: 604800000,
      description: 'Very long search affects self-worth',
    },
    
    // === REJECTION PAIN ===
    {
      id: 'job-rejection-wave',
      trigger: { variable: 'rejectionsThisWeek', op: '>', value: 3 },
      effect: { drive: 'status', delta: -15 },
      cooldownMs: 604800000,
      description: 'Multiple rejections in a week hurts',
    },
    {
      id: 'job-ghosted',
      trigger: { variable: 'responseRate', op: '<', value: 5 },
      effect: { drive: 'social', delta: -10 },
      cooldownMs: 604800000,
      description: 'Being ignored feels isolating',
    },
    
    // === POSITIVE SIGNALS ===
    {
      id: 'job-interview-scheduled',
      trigger: { variable: 'interviewsScheduled', op: '>', value: 0 },
      effect: { drive: 'status', delta: +10 },
      cooldownMs: 86400000,
      description: 'Getting interviews boosts confidence',
    },
    {
      id: 'job-offer-received',
      trigger: { variable: 'offersReceived', op: '>', value: 0 },
      effect: { drive: 'security', delta: +25 },
      cooldownMs: 86400000,
      description: 'Receiving an offer is huge relief',
    },
  ],
});
```

**Why job search matters:**
- Job searching is **inherently stressful** — this captures that
- Rejections hurt status and social drives
- Long searches erode meaning and purpose
- Interviews and offers provide relief and validation

#### Example: Productivity Body (plugin-pim)

The Personal Information Manager creates a **productivity body** — stress from tasks, inbox, calendar:

```typescript
homeostasis.registerDomainBody({
  domain: 'pim',
  worldPatterns: ['pim:*', 'productivity', 'tasks'],
  
  getPhysiological: () => {
    const pim = runtime.getService('pim');
    const state = pim.getProductivityState();
    
    return {
      variables: {
        // Task pressure
        overdueTasks: state.overdueTasks,
        tasksDueToday: state.tasksDueToday,
        tasksDueThisWeek: state.tasksDueThisWeek,
        
        // Inbox stress
        unreadInbox: state.unreadInbox,
        inboxOlderThan24h: state.inboxOlderThan24h,
        
        // Calendar pressure
        meetingsToday: state.meetingsToday,
        backToBackMeetings: state.backToBackCount,
        freeTimeHours: state.freeTimeToday,
        
        // Progress
        tasksCompletedToday: state.completedToday,
        streakDays: state.productivityStreak,
      },
      
      // Overdue tasks + inbox overflow + back-to-back meetings = stress
      distressContribution: Math.min(100, Math.max(0,
        (state.overdueTasks * 10) +
        (state.inboxOlderThan24h > 10 ? 15 : 0) +
        (state.freeTimeToday < 1 ? 20 : 0)
      )),
      
      labels: {
        overdueTasks: 'Overdue Tasks',
        unreadInbox: 'Unread Inbox',
        freeTimeHours: 'Free Time Today (hrs)',
        streakDays: 'Productivity Streak',
      },
    };
  },
  
  getResources: () => ({
    tasks_pending: pim.getPendingTaskCount(),
    notes_count: pim.getNotesCount(),
    bookmarks_count: pim.getBookmarksCount(),
  }),
  
  getCouplingRules: () => [
    // === TASK PRESSURE ===
    {
      id: 'pim-overdue-pile',
      trigger: { variable: 'overdueTasks', op: '>', value: 5 },
      effect: { drive: 'autonomy', delta: -15 },
      cooldownMs: 86400000,
      description: 'Pile of overdue tasks feels overwhelming',
    },
    {
      id: 'pim-busy-day',
      trigger: { variable: 'tasksDueToday', op: '>', value: 10 },
      effect: { drive: 'autonomy', delta: -10 },
      cooldownMs: 86400000,
      description: 'Too many tasks today reduces sense of control',
    },
    
    // === INBOX STRESS ===
    {
      id: 'pim-inbox-overflow',
      trigger: { variable: 'unreadInbox', op: '>', value: 50 },
      effect: { drive: 'autonomy', delta: -10 },
      cooldownMs: 86400000,
      description: 'Overflowing inbox feels out of control',
    },
    {
      id: 'pim-ignored-messages',
      trigger: { variable: 'inboxOlderThan24h', op: '>', value: 10 },
      effect: { drive: 'social', delta: -5 },
      cooldownMs: 86400000,
      description: 'Ignoring messages affects relationships',
    },
    
    // === CALENDAR PRESSURE ===
    {
      id: 'pim-no-free-time',
      trigger: { variable: 'freeTimeHours', op: '<', value: 1 },
      effect: { drive: 'autonomy', delta: -15 },
      cooldownMs: 86400000,
      description: 'No free time today is suffocating',
    },
    {
      id: 'pim-meeting-marathon',
      trigger: { variable: 'backToBackMeetings', op: '>', value: 3 },
      effect: { drive: 'autonomy', delta: -10 },
      cooldownMs: 86400000,
      description: 'Back-to-back meetings are draining',
    },
    
    // === POSITIVE ===
    {
      id: 'pim-productive-streak',
      trigger: { variable: 'streakDays', op: '>', value: 7 },
      effect: { drive: 'meaning', delta: +10 },
      cooldownMs: 604800000,
      description: 'Productivity streak feels meaningful',
    },
    {
      id: 'pim-tasks-cleared',
      trigger: { variable: 'tasksCompletedToday', op: '>', value: 5 },
      effect: { drive: 'status', delta: +5 },
      cooldownMs: 86400000,
      description: 'Getting things done feels good',
    },
  ],
});
```

**Why productivity body matters:**
- **Everyone** experiences task/inbox/calendar stress
- Overdue tasks erode sense of control (autonomy)
- Ignored messages damage relationships (social)
- Productivity streaks provide meaning

### Domain Evaluators → Homeostasis Integration

> **Partial**: `plugin-motivation` reads homeostasis state. `plugin-appraisal` displays it. The evaluator plugins (money, notoriety, power, etc.) exist but don't yet push drive deltas — this shows the pattern for completing that integration.

Several plugins are designed as **domain evaluators** that analyze specific aspects of the agent's situation. These should **report their scores to homeostasis** rather than being bodies themselves:

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOMAIN EVALUATORS                           │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ plugin-money │ │plugin-notori-│ │ plugin-power │            │
│  │              │ │    ety       │ │              │            │
│  │ Analyzes:    │ │ Analyzes:    │ │ Analyzes:    │            │
│  │ • Balance    │ │ • Reputation │ │ • Influence  │            │
│  │ • Income     │ │ • Visibility │ │ • Control    │            │
│  │ • Expenses   │ │ • Perception │ │ • Leverage   │            │
│  │              │ │              │ │              │            │
│  │ Score: 0-100 │ │ Score: 0-100 │ │ Score: 0-100 │            │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘            │
│         │                │                │                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │plugin-relat- │ │plugin-opport-│ │ plugin-health│            │
│  │  ionship     │ │   unity      │ │              │            │
│  │              │ │              │ │              │            │
│  │ Analyzes:    │ │ Analyzes:    │ │ Analyzes:    │            │
│  │ • Connections│ │ • Opportun-  │ │ • Wellbeing  │            │
│  │ • Rel. health│ │   ities      │ │ • from       │            │
│  │              │ │ • Potential  │ │   homeostasis│            │
│  │ Score: 0-100 │ │ Score: 0-100 │ │ Score: 0-100 │            │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘            │
│         │                │                │                     │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     HOMEOSTASIS SERVICE                         │
│                                                                 │
│  Domain evaluator scores map to psychological drives:           │
│                                                                 │
│  plugin-money      → security drive    (financial security)     │
│  plugin-notoriety  → status drive      (reputation/standing)    │
│  plugin-power      → autonomy drive    (control/influence)      │
│  plugin-relationship → social drive    (connection/belonging)   │
│  plugin-opportunity → meaning drive    (purpose/potential)      │
│                                                                 │
│  Implementation pattern:                                        │
│  evaluator.on('APPRAISAL_UPDATED', (score) => {                │
│    homeostasis.proposeDriveDelta({                              │
│      [mappedDrive]: scoreToDelta(score)                         │
│    });                                                          │
│  });                                                            │
└─────────────────────────────────────────────────────────────────┘
```

#### Domain Evaluator Integration Pattern

Each domain evaluator should publish to homeostasis when its assessment changes:

```typescript
// In plugin-money
const moneyEvaluator = {
  async evaluate(runtime: IAgentRuntime) {
    const score = await analyzeFinancialPosition(runtime);
    
    // Publish to appraisal registry
    const appraisal = runtime.getService('appraisal');
    await appraisal.publish('money', score);
    
    // Also update homeostasis if available
    const homeostasis = runtime.getService('homeostasis');
    if (homeostasis?.proposeDriveDelta) {
      // Map money score (0-100) to security drive delta
      // Low score (poor finances) → negative security
      // High score (good finances) → positive security
      const delta = (score - 50) * 0.3; // -15 to +15 range
      
      homeostasis.proposeDriveDelta(
        { security: delta },
        { source: 'plugin-money', reason: 'financial_appraisal' }
      );
    }
    
    return score;
  }
};
```

#### Evaluator → Drive Mappings

| Evaluator | Primary Drive | Secondary Drive | Rationale |
|-----------|--------------|-----------------|-----------|
| **plugin-money** | security | status | Financial security is fundamental; wealth also confers status |
| **plugin-notoriety** | status | social | Reputation is status; visibility enables social connection |
| **plugin-power** | autonomy | status | Power = control over one's situation; also confers status |
| **plugin-relationship** | social | security | Relationships provide belonging; also safety in numbers |
| **plugin-opportunity** | meaning | security | Opportunities provide purpose; also future security |

#### Why Evaluators vs Bodies?

**Domain Evaluators** (plugin-money, plugin-notoriety, etc.):
- Analyze a specific **aspect** of the agent's situation
- Produce a **score** (0-100)
- Don't represent an embodied context
- Run periodically to assess state
- **Report TO homeostasis**

**Domain Bodies** (hyperscape, babylon, robot, etc.):
- Represent an **embodied context** the agent inhabits
- Have physiological variables (health, battery, portfolio)
- Have resources specific to that context
- One is active at a time (context-bound)
- **ARE homeostasis** for that context

Think of it this way:
- **Bodies** = "Where am I?" (game world, robot, trading platform)
- **Evaluators** = "How am I doing?" (financially, socially, reputationally)

Both feed into the unified psychological model, but in different ways.

#### Why This Matters

By treating social platforms, financial systems, and communication channels as "bodies," the agent develops **emotional intuition** about these domains:

- An agent with Twitter anxiety will naturally limit posting when status is low
- An agent with financial stress will be more conservative with spending
- An agent feeling socially connected will be more helpful and engaging
- An agent overwhelmed by mentions will take breaks

This creates **authentic emotional responses** rather than programmed behaviors.

### API for Domain Bodies

```typescript
const service = runtime.getService('homeostasis') as HomeostasisService;

// Register/unregister
service.registerDomainBody(body);
service.unregisterDomainBody('my-game');

// Context management
service.setWorldContext('hyperscape:server-1');
const ctx = service.getCurrentWorldContext();  // 'hyperscape:server-1'

// Query active body
const activeBody = service.getActiveBody();    // DomainBody | null
const isDefault = service.isDefaultBodyActive(); // true if no domain active

// Check domain membership
const domains = service.getRegisteredDomains(); // ['hyperscape', 'minecraft']
const inGame = service.isInDomain('hyperscape'); // true/false
```

### Provider Output

The homeostasis provider automatically shows the active body's state to the LLM:

**Default body active:**
```
## Internal State
Body: DEFAULT (real-world)
Physiological: hunger=35, fatigue=20, hydration=15, health=10
Drives (0-100): security=72, social=45, status=58, autonomy=63, meaning=41
Resources: wallets.sol=2.5, inference.tokens=45000
```

**Domain body active:**
```
## Internal State
Body: HYPERSCAPE
Domain State: healthPercent=65, inCombat=1, threatCount=2, alive=1
Distress Contribution: 35
Drives (0-100): security=52, social=45, status=58, autonomy=63, meaning=41
Resources: gold=1250
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       plugin-homeostasis                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                     DOMAIN BODY REGISTRY                       │  │
│  │                                                                │  │
│  │  WorldContext: "robot:warehouse-7"                             │  │
│  │                                                                │  │
│  │  Registered Bodies:                                            │  │
│  │    • default (built-in simulation)                             │  │
│  │    • hyperscape → patterns: ['hyperscape:*']  (game character) │  │
│  │    • robot → patterns: ['robot:*']            (physical robot) │  │
│  │    • fleet → patterns: ['fleet:*']            (robot fleet)    │  │
│  │                                                                │  │
│  │  Active Body: robot (matched by pattern "robot:warehouse-7")   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                     STATE LAYERS                               │  │
│  │                                                                │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │  │
│  │  │  PHYSIOLOGICAL  │  │  PSYCHOLOGICAL  │  │   RESOURCES    │  │  │
│  │  │  (from active   │  │    (drives)     │  │ (from active   │  │  │
│  │  │   body)         │  │                 │  │  body)         │  │  │
│  │  │                 │  │                 │  │                │  │  │
│  │  │  DEFAULT:       │  │  security: 38   │  │  DEFAULT:      │  │  │
│  │  │   hunger: 35    │  │  social: 45     │  │   sol: 2.5     │  │  │
│  │  │   fatigue: 20   │  │  status: 58     │  │   tokens: 45k  │  │  │
│  │  │   hydration: 15 │  │  autonomy: 50   │  │                │  │  │
│  │  │   health: 10    │  │  meaning: 41    │  │  ROBOT:        │  │  │
│  │  │                 │  │                 │  │   payload: 12kg│  │  │
│  │  │  ROBOT:         │  │  ┌───────────┐  │  │   tasks: 47    │  │  │
│  │  │   battery%: 23  │  │  │ COUPLING  │  │  │                │  │  │
│  │  │   motorTemp: 72 │  │  │  ENGINE   │  │  │  HYPERSCAPE:   │  │  │
│  │  │   collision: 15 │  │  │           │  │  │   gold: 1250   │  │  │
│  │  │   eStop: 0      │  │  │ body→mind │  │  │                │  │  │
│  │  └────────┬────────┘  │  └─────┬─────┘  │  └────────────────┘  │  │
│  └───────────│───────────┴───────│────────┴──────────────────────┘  │
│              │                   │                                   │
│              ▼                   ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                LIFECYCLE (derived, read-only)                 │    │
│  │                                                               │    │
│  │  distressScore: 77        bracket: "struggling"               │    │
│  │  status: "alive"          (low battery is stressful!)         │    │
│  │                                                               │    │
│  │  Derivation: active_body.distress → bracket → status          │    │
│  │  ⚠️ No plugin may directly mutate these fields                │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                  ENGAGEMENT POLICY                            │    │
│  │  (registered with plugin-autonomous)                          │    │
│  │                                                               │    │
│  │  Reads: active body state, drives, lifecycle                  │    │
│  │  Outputs: willingness modifier, effort level                  │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

## License

MIT

