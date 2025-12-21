# Decentralized Environment Configuration

Babylon runs entirely on Jeju's decentralized infrastructure. No centralized services are used.

## Required Environment Variables

### Jeju Network (Required)

```bash
# Network to connect to: localnet, testnet, or mainnet
JEJU_NETWORK=testnet
```

### CovenantSQL Database (Required)

```bash
# Block producer endpoint for CovenantSQL
CQL_BLOCK_PRODUCER_ENDPOINT=https://bp.cql.jeju.network

# Your database ID (obtained from Jeju dashboard)
CQL_DATABASE_ID=your-database-id

# Private key for signing queries (hex format)
CQL_PRIVATE_KEY=0x...

# Optional: Query timeout in ms (default: 30000)
CQL_TIMEOUT=30000

# Optional: Enable query logging (default: false)
CQL_LOGGING=false
```

### Decentralized Cache (Required)

```bash
# Jeju cache service URL
JEJU_CACHE_SERVICE_URL=https://cache.jeju.network

# Optional: Cache namespace prefix (default: babylon)
CACHE_NAMESPACE=babylon

# Optional: Default TTL in seconds (default: 3600)
CACHE_DEFAULT_TTL=3600

# Optional: Enable cache logging (default: false)
CACHE_LOGGING=false
```

### Decentralized Storage - IPFS/Arweave (Required)

```bash
# Jeju storage API endpoint
JEJU_STORAGE_ENDPOINT=https://storage.jeju.network

# Optional: API key for storage (if required)
JEJU_STORAGE_API_KEY=your-api-key

# Optional: Default provider (ipfs or arweave, default: ipfs)
JEJU_STORAGE_PROVIDER=ipfs

# Optional: Replication factor (default: 3)
JEJU_STORAGE_REPLICATION=3
```

### Decentralized Compute & LLM Inference (Required)

```bash
# Jeju compute API URL (auto-configured from JEJU_NETWORK if not set)
JEJU_COMPUTE_API_URL=https://compute.jeju.network

# Jeju inference endpoint for LLM calls
# Routes through Jeju Compute marketplace to decentralized inference nodes
# Nodes may offer: Claude, GPT-4, Llama, Mixtral, etc.
JEJU_COMPUTE_ENDPOINT=https://compute.jeju.network

# For local development with jeju dev running:
# JEJU_COMPUTE_ENDPOINT=http://localhost:4100

# Optional: Wallet address for payment tracking
JEJU_WALLET_ADDRESS=0x...

# Optional: Preferred payment token (JEJU, ETH, or USDC)
JEJU_PAYMENT_TOKEN=JEJU
```

### Frontend Deployment - IPFS/IPNS/JNS

```bash
# JNS domain for the frontend (e.g., babylon.jeju)
JNS_DOMAIN=babylon.jeju

# IPNS key name for updates
IPNS_KEY_NAME=babylon-web

# Optional: JNS service endpoint
JNS_ENDPOINT=https://jns.jeju.network
```

### ERC-4337 Paymaster (Required for Gas Sponsorship)

```bash
# Paymaster contract address
PAYMASTER_ADDRESS=0x...

# Entry point contract address (usually the standard ERC-4337 EP)
ENTRY_POINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789

# BABYLON token address for credits
CREDIT_TOKEN_ADDRESS=0x...

# Optional: Paymaster API URL
JEJU_PAYMASTER_API_URL=https://paymaster.jeju.network
```

### RPC Configuration

```bash
# Jeju RPC URL (auto-configured from JEJU_NETWORK if not set)
JEJU_RPC_URL=https://rpc.jeju.network
```

## Removed Environment Variables

The following environment variables are **no longer used**:

### Database (Removed)
- `DATABASE_URL` - PostgreSQL connection string
- `DIRECT_URL` - Direct PostgreSQL connection
- `POSTGRES_*` - All PostgreSQL settings

### Cache (Removed)
- `REDIS_URL` - Redis connection string
- `UPSTASH_*` - All Upstash Redis settings

### Storage (Removed)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob token
- `MINIO_*` - All MinIO settings
- `AWS_*` - All AWS S3 settings

### LLM Providers (Removed)
- `GROQ_API_KEY` - Groq API key
- `ANTHROPIC_API_KEY` - Claude API key
- `OPENAI_API_KEY` - OpenAI API key

### Deployment (Removed)
- `VERCEL_*` - All Vercel settings

## Migration

To migrate from centralized to decentralized infrastructure:

```bash
# 1. Set up environment
export JEJU_NETWORK=testnet
export CQL_BLOCK_PRODUCER_ENDPOINT=...
export CQL_DATABASE_ID=...
export CQL_PRIVATE_KEY=...
export JEJU_STORAGE_ENDPOINT=...
export JEJU_CACHE_SERVICE_URL=...

# 2. Run migration
bun run scripts/migrate-to-decentralized.ts

# 3. Deploy frontend to IPFS
bun run build
bun run deploy:ipfs

# 4. Verify all services
bun run health:check
```

## Local Development

For local development with Jeju localnet:

```bash
# Start Jeju localnet (from jeju repo)
cd /path/to/jeju
bun run dev

# In Babylon repo
export JEJU_NETWORK=localnet
# The following are auto-configured for localnet:
# - CQL_BLOCK_PRODUCER_ENDPOINT=http://127.0.0.1:3000
# - JEJU_STORAGE_ENDPOINT=http://127.0.0.1:5000
# - JEJU_COMPUTE_API_URL=http://127.0.0.1:5010
# - JEJU_CACHE_SERVICE_URL=http://127.0.0.1:5020

bun run dev
```

## Security Notes

1. **Private Keys**: Never commit private keys. Use environment variables or secrets management.

2. **API Keys**: The `JEJU_STORAGE_API_KEY` provides authenticated access. Keep it secure.

3. **Wallet Address**: The `JEJU_WALLET_ADDRESS` is used for payment tracking. Ensure it has sufficient credits.

4. **Database Key**: The `CQL_PRIVATE_KEY` is used to sign all database queries. Treat it like a database password.

