# Babylon Integration Validation Checklist

This document outlines the validation questions that ensure Babylon is correctly integrated with all services.

## Quick Start

```bash
# Run all tests with infrastructure auto-start
bun run test

# Run with testnet validation
bun run test:testnet

# Just run validation suite
bun run test:validate

# Check infrastructure health
bun run infra:check

# Start missing services
bun run infra:start
```

## Validation Categories

### Category 1: Local Development

| Question | Validated By | Required |
|----------|--------------|----------|
| Can the local Jeju chain (Hardhat) be reached? | `infra:check` | ✅ |
| Is PostgreSQL running and accessible? | `infra:check` | ✅ |
| Is Redis running and accessible? | `infra:check` | ✅ |
| Are NPCs seeded in the database? | Integration tests | ✅ |

### Category 2: Contract Integration

| Question | Validated By | Required |
|----------|--------------|----------|
| Is KeyRegistry contract deployed? | `contracts:check` | ⚠️ For messaging |
| Is MessageNodeRegistry contract deployed? | `contracts:check` | ⚠️ For messaging |
| Can users register encryption keys on-chain? | E2E tests | ⚠️ For messaging |

### Category 3: CovenantSQL Integration

| Question | Validated By | Required |
|----------|--------------|----------|
| Is CQL Block Producer healthy? | `infra:check` | ⚠️ For messaging |
| Can messages be written and read from CQL? | E2E tests | ⚠️ For messaging |
| Are all 3 CQL nodes in consensus? | Health check | ⚠️ For messaging |

### Category 4: KMS Integration

| Question | Validated By | Required |
|----------|--------------|----------|
| Is Jeju KMS service healthy? | `infra:check` | ⚠️ For messaging |
| Can X25519 encryption keys be generated? | E2E tests | ⚠️ For messaging |
| Can Ed25519 signing keys be generated and used? | E2E tests | ⚠️ For messaging |

### Category 5: Messaging Relay

| Question | Validated By | Required |
|----------|--------------|----------|
| Is Messaging Relay service healthy? | `infra:check` | ⚠️ For messaging |
| Can messages be sent through the relay? | E2E tests | ⚠️ For messaging |
| Can messages be acknowledged? | E2E tests | ⚠️ For messaging |

### Category 6: Testnet Deployment

| Question | Validated By | Required |
|----------|--------------|----------|
| Can connect to Jeju testnet? | `test:testnet` | ⚠️ For testnet |
| Are messaging contracts deployed on testnet? | `test:testnet` | ⚠️ For testnet |
| Is testnet CQL cluster healthy? | `test:testnet` | ⚠️ For testnet |
| Are Terraform resources provisioned? | Manual / AWS console | ⚠️ For testnet |

## Test Commands

### Unit Tests
```bash
bun run test:unit
```
- No infrastructure required
- Tests business logic in isolation

### Integration Tests
```bash
bun run test:integration
```
- Requires: PostgreSQL, Redis, Hardhat
- Auto-starts services if not running
- Tests API endpoints, database operations

### E2E Tests
```bash
bun run test:e2e
```
- Requires: All core + messaging services
- Tests full user flows
- Uses Playwright for browser automation
- Uses Synpress for wallet tests

### Testnet Tests
```bash
bun run test:testnet
```
- Requires: Testnet infrastructure deployed
- Validates Terraform, contracts, services on AWS
- Uses real blockchain, not local Hardhat

## Infrastructure Commands

### Check All Services
```bash
bun run infra:check
```
Outputs status of:
- PostgreSQL (localhost:5433)
- Redis (localhost:6380)
- Hardhat (localhost:8545)
- CQL (localhost:8546)
- KMS (localhost:3300)
- Relay (localhost:3200)

### Start Messaging Services
```bash
bun run infra:messaging
```
Starts Docker containers:
- `babylon-cql-bp1`, `babylon-cql-bp2`, `babylon-cql-bp3`
- `babylon-jeju-kms`
- `babylon-messaging-relay`

### Stop Messaging Services
```bash
bun run infra:messaging:stop
```

### Check Contracts
```bash
bun run contracts:check
```
Checks if messaging contracts are deployed on the current network.

### Deploy Messaging Contracts
```bash
bun run contracts:deploy:messaging
```
Deploys KeyRegistry and MessageNodeRegistry to local Hardhat.

## Testnet Setup

1. **Deploy Terraform infrastructure:**
   ```bash
   cd packages/deployment/terraform/environments/testnet
   terraform init
   terraform plan
   terraform apply
   ```

2. **Deploy contracts to testnet:**
   ```bash
   bun run deploy:testnet
   ```

3. **Set testnet environment variables:**
   ```bash
   # .env
   TESTNET_KEY_REGISTRY_ADDRESS=0x...
   TESTNET_MESSAGE_NODE_REGISTRY_ADDRESS=0x...
   TESTNET_CQL_ENDPOINT=https://cql.testnet.jeju.io
   TESTNET_KMS_ENDPOINT=https://kms.testnet.jeju.io
   TESTNET_RELAY_ENDPOINT=https://relay.testnet.jeju.io
   ```

4. **Run testnet validation:**
   ```bash
   bun run test:testnet
   ```

## CI/CD Integration

The test runner (`scripts/test-runner.ts`) handles:
1. Infrastructure health check
2. Auto-start missing services
3. Contract deployment if needed
4. Sequential test execution
5. Summary report

For CI, use:
```bash
bun run test:ci
```
This uses mocked services for deterministic results.

## Troubleshooting

### Services won't start
```bash
# Check Docker is running
docker info

# Check for port conflicts
lsof -i :5433 -i :6380 -i :8545

# Clean restart
docker-compose down -v
docker-compose up -d
```

### Contracts not deploying
```bash
# Ensure Hardhat is running
bun run hardhat

# Check deployer has funds (localnet)
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","latest"],"id":1}'
```

### Tests failing
```bash
# Run with verbose output
bun run scripts/test-runner.ts --verbose

# Run specific test file
bun test packages/testing/integration/specific.test.ts

# Check service logs
docker-compose logs -f babylon-cql-bp1
```

