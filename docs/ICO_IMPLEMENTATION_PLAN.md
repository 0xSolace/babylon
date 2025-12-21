# BBLN ICO Implementation Plan

## Executive Summary

This document provides a comprehensive analysis of the Babylon (BBLN) token ICO system, including the current state, gaps, architecture, and implementation plan for achieving 100% automated execution at a fixed time.

---

## 1. CURRENT STATE ANALYSIS

### 1.1 Token Configuration (✅ Complete)

**File:** `packages/shared/src/contracts/bbln.ts`

| Parameter | Value |
|-----------|-------|
| Total Supply | 1,000,000,000 BBLN |
| Decimals | 18 |
| Home Chain | Ethereum Mainnet (chainId: 1) |

**Allocation:**
| Category | Amount | Percentage |
|----------|--------|------------|
| Babylon Labs | 200M BBLN | 20% (4-year vest) |
| Public Sale | 100M BBLN | 10% |
| Airdrop | 100M BBLN | 10% |
| Liquidity | 100M BBLN | 10% |
| Treasury | 500M BBLN | 50% (10-year unlock) |

**Presale Configuration:**
- Tokens for Sale: 100M BBLN
- Min Bid: 0.1 ETH
- Max Bid: 1,000 ETH
- ELIZA Holder Bonus: 1.5x (50% extra allocation)

### 1.2 Smart Contracts

#### BBLNToken.sol (✅ Complete)
```
packages/contracts/src/BBLNToken.sol
```
- Inherits from `@jeju/contracts/tokens/Token.sol`
- ERC20 with Permit (EIP-2612), EIP-3009 gasless transfers
- Fee distribution: 80% XLP, 10% Treasury, 10% Burn
- Anti-whale limits: 2% max wallet, 1% max tx
- Hyperlane cross-chain support

#### BabylonTreasury.sol (✅ Complete)
```
packages/contracts/src/dao/BabylonTreasury.sol
```
- DAO-controlled treasury
- Auto-fund vaults with cooldowns
- ETH and ERC20 distribution
- Pausable operations

#### Presale.sol (⚠️ External Dependency)
```
@jeju/contracts/tokens/Presale.sol (not in local repo)
```
- CCA (Continuous Clearing Auction) mechanism
- Whitelist and public phases
- ELIZA holder bonus verification
- Vesting configuration

### 1.3 Frontend (✅ Complete - UI Only)

**File:** `apps/web/src/app/launch/page.tsx`

Features:
- Presale stats display (raised, participants, tokens sold)
- Countdown timer from contract data
- Bid submission with optional max price
- Token claiming at TGE
- ELIZA holder bonus display
- FAQ section

### 1.4 NPC Liquidity System (✅ Complete)

**File:** `packages/agents/src/identity/NPCTokenWalletService.ts`

| Tier | Allocation |
|------|------------|
| Tier 1 (Major Characters) | 1,000,000 BBLN |
| Tier 2 (Supporting) | 100,000 BBLN |
| Tier 3 (Minor) | 10,000 BBLN |

Features:
- Treasury-funded NPC wallets
- Stop-loss monitoring (20% daily, 25% per position)
- On-chain trade execution via Diamond contract
- ERC-4337 paymaster for gasless transactions

### 1.5 Airdrop & Distribution (✅ Complete)

**File:** `packages/api/src/services/airdrop-bonus-service.ts`

- 90-day bonus period after launch
- Points snapshot at TGE
- Daily drip: 5% per day for 20 days (100% total)
- Leaderboard multipliers:
  - Top 1%: 10x bonus
  - Top 10%: 5x bonus
  - Top 25%: 2x bonus
- ELIZA holder bonus: 1.5x

### 1.6 Trigger System (⚠️ Partial)

**File:** `packages/api/src/services/compute-trigger-service.ts`

Existing triggers:
- Game tick (every 10 seconds)
- Training extract (hourly)
- Daily benchmark
- Health check

**Missing ICO triggers** (see Section 3)

---

## 2. IDENTIFIED GAPS & RISKS

### 2.1 Critical Gaps

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 1 | **Presale.sol not in local repo** | HIGH | Cannot verify/test auction logic locally |
| 2 | **No liquidity pool automation** | HIGH | Manual DEX listing required at TGE |
| 3 | **No time-based ICO triggers** | HIGH | Cannot automate phase transitions |
| 4 | **Zero addresses in config** | HIGH | No deployed contracts |
| 5 | **No ICO-specific tests** | HIGH | Cannot validate end-to-end flow |
| 6 | **No dry-run capability** | MEDIUM | Cannot simulate full ICO |
| 7 | **No treasury allocation automation** | MEDIUM | Manual token distribution required |
| 8 | **No airdrop snapshot automation** | MEDIUM | Points snapshot not triggered |

### 2.2 Dependencies

| Dependency | Source | Status |
|------------|--------|--------|
| `@jeju/contracts/tokens/Token.sol` | External | ✅ Imported |
| `@jeju/contracts/tokens/Presale.sol` | External | ⚠️ Not in repo |
| Uniswap V3 Pool Factory | External | ❌ Not integrated |
| Hyperlane Mailbox | External | ⚠️ Configured, not tested |
| ELIZA Token (for bonus) | External | ❌ Not verified |

### 2.3 Edge Cases

1. **Soft Cap Not Reached**: Refund logic needs testing
2. **Hard Cap Reached Early**: Phase transition handling
3. **Max Price Below Clearing**: Refund calculation
4. **Multiple Claims Attempt**: Reentrancy protection
5. **Cross-Chain Token Transfers**: Bridge fee deduction
6. **NPC Balance < Trade Size**: Fallback behavior

---

## 3. ARCHITECTURE & DATA FLOW

### 3.1 ICO Timeline

```
[DEPLOY]──────[WHITELIST]──────[PUBLIC]──────[END]──────[TGE]──────[POST-TGE]
    │             │                │            │          │           │
    ▼             ▼                ▼            ▼          ▼           ▼
 Deploy       2-day           7-day        Calculate   Distribute   Create
 Contracts    Early           Auction      Clearing    Tokens       Liquidity
              Bird                         Price                    Pool
```

### 3.2 Token Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           1B BBLN TOTAL SUPPLY                          │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│ Presale (10%) │          │ Treasury (50%)│          │ Other (40%)   │
│   100M BBLN   │          │   500M BBLN   │          │   400M BBLN   │
└───────┬───────┘          └───────┬───────┘          └───────┬───────┘
        │                          │                          │
        ▼                          ▼                          ▼
  CCA Auction              DAO-Controlled            ┌────────────────┐
  → Buyers                  │                        │ Babylon Labs   │
                           ├─→ NPC Funding          │ (20%, vested)  │
                           ├─→ Operations           ├────────────────┤
                           └─→ Ecosystem            │ Airdrop (10%)  │
                                                    ├────────────────┤
                                                    │ Liquidity (10%)│
                                                    └────────────────┘
```

### 3.3 Automation Architecture

```
                              ┌─────────────────┐
                              │  Time Triggers  │
                              │  (Fixed Dates)  │
                              └────────┬────────┘
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                     │
                 ▼                     ▼                     ▼
        ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
        │ Phase Manager  │   │ Price Oracle   │   │ Distribution   │
        │ Service        │   │ Service        │   │ Service        │
        └────────┬───────┘   └────────┬───────┘   └────────┬───────┘
                 │                    │                    │
                 ▼                    ▼                    ▼
        ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
        │ Presale.sol    │   │ BBLNToken.sol  │   │ Treasury.sol   │
        │ (On-Chain)     │   │ (On-Chain)     │   │ (On-Chain)     │
        └────────────────┘   └────────────────┘   └────────────────┘
```

---

## 4. IMPLEMENTATION PLAN

### Phase 1: Presale Contract Integration (Week 1)

**Objective:** Import and verify Presale.sol locally

| Task | Description | Priority |
|------|-------------|----------|
| 1.1 | Copy Presale.sol from @jeju/contracts to local | P0 |
| 1.2 | Write Forge tests for CCA auction logic | P0 |
| 1.3 | Test whitelist/public phase transitions | P0 |
| 1.4 | Test ELIZA holder bonus verification | P1 |
| 1.5 | Test refund mechanics (soft cap not reached) | P1 |
| 1.6 | Test vesting schedule (100% at TGE) | P1 |

### Phase 2: Time-Based Automation (Week 1-2)

**Objective:** Create automated triggers for all ICO phases

**New File:** `packages/api/src/services/ico-automation-service.ts`

| Task | Description | Priority |
|------|-------------|----------|
| 2.1 | Create ICOAutomationService class | P0 |
| 2.2 | Implement phase transition triggers | P0 |
| 2.3 | Implement TGE distribution trigger | P0 |
| 2.4 | Implement airdrop snapshot trigger | P0 |
| 2.5 | Implement liquidity pool creation trigger | P0 |
| 2.6 | Add countdown notifications | P2 |

**Trigger Configuration:**
```typescript
const ICO_TRIGGERS = {
  whitelistStart: { type: 'timestamp', action: 'start_whitelist' },
  publicStart: { type: 'timestamp', action: 'start_public' },
  presaleEnd: { type: 'timestamp', action: 'end_presale' },
  tge: { type: 'timestamp', action: 'execute_tge' },
  liquidityCreation: { type: 'after_tge', delay: '1 hour', action: 'create_liquidity' },
  airdropStart: { type: 'after_tge', delay: '0', action: 'start_airdrop' },
};
```

### Phase 3: Liquidity Pool Automation (Week 2)

**Objective:** Automatically create Uniswap V3 pool at TGE

**New File:** `packages/api/src/services/liquidity-pool-service.ts`

| Task | Description | Priority |
|------|-------------|----------|
| 3.1 | Integrate Uniswap V3 PoolFactory | P0 |
| 3.2 | Calculate initial liquidity from ETH raised | P0 |
| 3.3 | Set price range (concentrated liquidity) | P0 |
| 3.4 | Create pool creation transaction | P0 |
| 3.5 | Verify pool creation and initial price | P0 |
| 3.6 | Update bbln.ts with pool address | P1 |

### Phase 4: Treasury Distribution (Week 2)

**Objective:** Automate initial token distribution

| Task | Description | Priority |
|------|-------------|----------|
| 4.1 | Create distribution schedule in BabylonTreasury | P0 |
| 4.2 | Automate Babylon Labs vesting setup | P1 |
| 4.3 | Automate NPC initial funding | P0 |
| 4.4 | Set up recurring treasury operations | P2 |

### Phase 5: Testing Framework (Week 2-3)

**Objective:** Comprehensive ICO testing on devnet and testnet

**New Files:**
- `packages/testing/integration/ico-presale.integration.test.ts`
- `packages/testing/integration/ico-tge.integration.test.ts`
- `packages/testing/integration/ico-distribution.integration.test.ts`
- `packages/testing/e2e/ico-full-cycle.e2e.test.ts`

| Task | Description | Priority |
|------|-------------|----------|
| 5.1 | Create Forge test suite for contracts | P0 |
| 5.2 | Create integration tests for services | P0 |
| 5.3 | Create E2E test for full ICO cycle | P0 |
| 5.4 | Create devnet deployment script | P0 |
| 5.5 | Create testnet deployment script | P0 |
| 5.6 | Document test procedures | P1 |

### Phase 6: Verification & Validation (Week 3)

**Objective:** Pre-launch checklist and dry runs

**New File:** `packages/testing/validation/ico-checklist.ts`

| Task | Description | Priority |
|------|-------------|----------|
| 6.1 | Create automated pre-launch checklist | P0 |
| 6.2 | Run full ICO on devnet (Hardhat) | P0 |
| 6.3 | Run full ICO on testnet (Sepolia) | P0 |
| 6.4 | Verify token distribution accuracy | P0 |
| 6.5 | Verify liquidity pool creation | P0 |
| 6.6 | Security review of all contracts | P0 |

---

## 5. DETAILED SPECIFICATIONS

### 5.1 ICO Timeline Configuration

```typescript
interface ICOConfig {
  // Presale Configuration
  presale: {
    tokensForSale: bigint;      // 100_000_000n * 10n ** 18n
    softCap: bigint;            // 500 ETH
    hardCap: bigint;            // 5000 ETH
    minBid: bigint;             // 0.1 ETH
    maxBid: bigint;             // 1000 ETH
    
    // CCA Pricing
    startPrice: bigint;          // 0.01 ETH per token
    reservePrice: bigint;        // 0.0005 ETH per token
    priceDecayPerSecond: bigint; // ~86.4 ETH per day
  };
  
  // Timeline (Unix timestamps)
  timeline: {
    deployAt: number;           // T-0: Contract deployment
    whitelistStart: number;     // T+1h: Whitelist phase begins
    publicStart: number;        // T+2d+1h: Public phase begins
    presaleEnd: number;         // T+9d+1h: Auction ends
    tgeTimestamp: number;       // T+10d+1h: Token distribution
  };
  
  // Vesting
  vesting: {
    tgeUnlockBps: number;       // 10000 = 100% at TGE
    cliffDays: number;          // 0 for public sale
    vestingDays: number;        // 0 for public sale
  };
  
  // Bonuses
  bonuses: {
    whitelistBonusBps: number;  // 0 = no whitelist bonus
    elizaBonusBps: number;      // 5000 = 50% bonus
    tierBonuses: {
      oneEthBps: number;        // 100 = 1% for 1 ETH
      fiveEthBps: number;       // 300 = 3% for 5 ETH
      tenEthBps: number;        // 500 = 5% for 10 ETH
    };
    elizaTokenAddress: Address;
    elizaMinBalance: bigint;    // 1000 ELIZA
  };
}
```

### 5.2 Automation Service Interface

```typescript
interface ICOAutomationService {
  // Configuration
  initialize(config: ICOConfig): Promise<void>;
  scheduleICO(launchTimestamp: number): Promise<void>;
  
  // Phase Management
  getCurrentPhase(): Promise<ICOPhase>;
  transitionToPhase(phase: ICOPhase): Promise<TransactionHash>;
  
  // Execution
  executeWhitelistStart(): Promise<void>;
  executePublicStart(): Promise<void>;
  executePresaleEnd(): Promise<ClearingPriceResult>;
  executeTGE(): Promise<TGEResult>;
  
  // Liquidity
  createLiquidityPool(): Promise<PoolCreationResult>;
  
  // Distribution
  distributeToPresaleParticipants(): Promise<DistributionResult>;
  startAirdropDrip(): Promise<void>;
  fundNPCsFromTreasury(): Promise<void>;
  
  // Monitoring
  getICOStatus(): Promise<ICOStatus>;
  getParticipantCount(): Promise<number>;
  getTotalRaised(): Promise<bigint>;
}
```

### 5.3 Liquidity Pool Configuration

```typescript
interface LiquidityPoolConfig {
  // Pool Parameters
  token0: Address;              // BBLN
  token1: Address;              // WETH
  fee: 3000 | 500 | 10000;      // 0.3% recommended
  
  // Initial Liquidity
  tokenAmount: bigint;          // 100M BBLN (liquidity allocation)
  ethAmount: bigint;            // From presale (e.g., 20% of raised)
  
  // Price Range (Concentrated Liquidity)
  lowerPrice: number;           // e.g., 0.0001 ETH per BBLN
  upperPrice: number;           // e.g., 0.01 ETH per BBLN
  
  // Pool Management
  lockLiquidity: boolean;       // true - prevent rug
  lockDuration: number;         // e.g., 365 days
}
```

---

## 6. TESTING STRATEGY

### 6.1 Test Environments

| Environment | Chain | Purpose |
|-------------|-------|---------|
| Devnet (Local) | Hardhat | Rapid iteration, unit tests |
| Testnet (Sepolia) | Sepolia | Integration testing, E2E |
| Staging | Base Sepolia | Pre-production validation |
| Mainnet | Ethereum | Production |

### 6.2 Test Cases

#### Presale Contract Tests
```
✓ Should deploy with correct configuration
✓ Should reject contributions before whitelist start
✓ Should apply whitelist bonus during whitelist phase
✓ Should transition to public phase at correct time
✓ Should apply ELIZA holder bonus
✓ Should apply tier bonuses (1/5/10 ETH)
✓ Should reject bids below minimum
✓ Should reject bids above maximum
✓ Should calculate correct clearing price
✓ Should handle soft cap not reached (refunds)
✓ Should handle hard cap reached early
✓ Should distribute tokens at TGE
✓ Should allow claims after TGE
✓ Should process refunds for max price < clearing
✓ Should prevent double claims
```

#### TGE & Distribution Tests
```
✓ Should calculate correct allocations for all participants
✓ Should apply all bonuses correctly
✓ Should create liquidity pool with correct amounts
✓ Should fund treasury with remaining ETH
✓ Should start airdrop drip schedule
✓ Should fund NPCs from treasury
```

#### Automation Tests
```
✓ Should trigger whitelist start at exact timestamp
✓ Should trigger public start at exact timestamp
✓ Should trigger presale end at exact timestamp
✓ Should execute TGE at exact timestamp
✓ Should create liquidity pool after TGE
✓ Should handle network delays gracefully
✓ Should resume after interruption
```

### 6.3 E2E Test Scenario

```
1. Deploy contracts (BBLNToken, Presale, Treasury)
2. Configure presale (CCA, timeline, bonuses)
3. Transfer tokens to presale
4. Wait for whitelist start
5. Submit whitelist contributions
6. Wait for public start
7. Submit public contributions
8. Wait for presale end
9. Calculate clearing price
10. Execute TGE
11. Verify token distribution
12. Create liquidity pool
13. Verify pool creation and price
14. Start airdrop
15. Verify airdrop snapshots
16. Fund NPCs
17. Verify NPC balances
```

---

## 7. DEPLOYMENT CHECKLIST

### Pre-Deployment (T-7 days)

- [ ] All contracts audited
- [ ] All tests passing on testnet
- [ ] Timeline confirmed and locked
- [ ] Treasury multisig configured
- [ ] ELIZA token address verified
- [ ] Liquidity amounts calculated
- [ ] NPC tier allocations confirmed
- [ ] Airdrop snapshot ready

### Deployment Day (T-0)

- [ ] Deploy BBLNToken
- [ ] Configure token fees and limits
- [ ] Deploy Presale
- [ ] Configure presale parameters
- [ ] Transfer 100M BBLN to presale
- [ ] Verify all configurations
- [ ] Update addresses in bbln.ts
- [ ] Enable automation triggers
- [ ] Monitor first phase transition

### Post-TGE (T+10 days)

- [ ] Verify all distributions
- [ ] Confirm liquidity pool
- [ ] Verify airdrop start
- [ ] Confirm NPC funding
- [ ] Monitor treasury balance
- [ ] Enable cross-chain bridges

---

## 8. QUESTIONS FOR CLARIFICATION

Before proceeding with implementation, please clarify:

1. **Fixed Launch Time**: What is the exact timestamp for presale start?

2. **ELIZA Token**: What is the ELIZA token address on Ethereum mainnet? Is verification on-chain or off-chain?

3. **Liquidity Pool**: 
   - Which DEX (Uniswap V3, V2, other)?
   - What percentage of raised ETH goes to liquidity?
   - Should liquidity be locked? For how long?

4. **Whitelist**: 
   - How is the whitelist managed (Merkle tree, on-chain)?
   - What criteria for whitelist inclusion?

5. **Treasury Multisig**: 
   - What is the multisig address?
   - How many signers required?

6. **Cross-Chain**: 
   - Which chains should BBLN be available on at launch?
   - What is the priority order?

7. **NPC Funding**: 
   - Should NPC funding happen at TGE or gradually?
   - What is the total NPC allocation from treasury?

8. **Airdrop Mechanics**:
   - What triggers the daily drip (user action or automatic)?
   - Is there an expiration for unclaimed airdrop?

---

## 9. RISK MITIGATION

| Risk | Mitigation |
|------|------------|
| Smart contract bug | Audit + extensive testing |
| Automation failure | Manual fallback + alerts |
| Network congestion | Gas price monitoring + priority fees |
| Oracle manipulation | Multiple price sources |
| Front-running | Private mempool (Flashbots) |
| Liquidity drain | Lock LP tokens |
| Reentrancy | Checks-Effects-Interactions pattern |
| Timestamp manipulation | Block-based phases |

---

## 10. NEXT STEPS

1. **Immediate**: Review this plan and answer clarifying questions
2. **Week 1**: Implement Phase 1-2 (contracts + automation)
3. **Week 2**: Implement Phase 3-4 (liquidity + distribution)
4. **Week 3**: Complete Phase 5-6 (testing + validation)
5. **Week 4**: Devnet full run-through
6. **Week 5**: Testnet full run-through
7. **Week 6**: Security review + final preparations
8. **Launch**: Execute mainnet deployment

---

*Document Version: 1.0*
*Last Updated: December 15, 2024*
*Author: Claude (Babylon Development)*

