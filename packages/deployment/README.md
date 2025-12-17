# Babylon Deployment Infrastructure

This package contains the infrastructure-as-code for deploying Babylon to a fully decentralized architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BABYLON INFRASTRUCTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────┐        ┌─────────────────┐       ┌─────────────────┐   │
│   │   CloudFront    │◄───────│    Route53      │───────│  ACM (SSL)      │   │
│   │   (CDN)         │        │  (DNS)          │       │  Certificate    │   │
│   └────────┬────────┘        └─────────────────┘       └─────────────────┘   │
│            │                                                                   │
│            │ Static Files                                                      │
│            ▼                                                                   │
│   ┌─────────────────┐        ┌─────────────────┐                              │
│   │   S3 Bucket     │        │  IPFS Gateway   │◄─── Decentralized Storage   │
│   │   (Frontend)    │        │  (Storage CDN)  │                              │
│   └─────────────────┘        └─────────────────┘                              │
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                          API Backend                                   │   │
│   │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐             │   │
│   │  │ Next.js API   │  │ CovenantQL    │  │ Decentralized │             │   │
│   │  │ Routes        │  │ Database      │  │ Cache         │             │   │
│   │  └───────────────┘  └───────────────┘  └───────────────┘             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
packages/deployment/
├── kubernetes/           # Kubernetes/Helm charts for backend
│   └── helm/
│       └── babylon-training/
├── terraform/            # AWS infrastructure as code
│   ├── backend.tf        # Terraform state backend (S3 + DynamoDB)
│   ├── modules/          # Reusable Terraform modules
│   │   ├── acm/          # SSL certificates
│   │   ├── cdn/          # CloudFront + S3
│   │   └── route53/      # DNS configuration
│   └── environments/     # Environment-specific configs
│       ├── testnet/
│       └── mainnet/
└── README.md
```

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0
3. **Domain** `babylon.market` registered
4. **IPFS Node** or access to IPFS API
5. **JNS Contracts** deployed on Base/Base Sepolia

## Quick Start

### 1. Initialize Terraform Backend

First, set up the Terraform state backend:

```bash
cd packages/deployment/terraform
terraform init
terraform apply  # Creates S3 bucket + DynamoDB for state
```

### 2. Deploy Infrastructure

For testnet:
```bash
cd packages/deployment/terraform/environments/testnet
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
terraform init
terraform plan
terraform apply
```

For mainnet:
```bash
cd packages/deployment/terraform/environments/mainnet
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
terraform init
terraform plan
terraform apply
```

### 3. Configure DNS

After terraform apply, you'll get nameserver outputs. Update your domain registrar:

```
Nameservers (example):
  - ns-1234.awsdns-12.org
  - ns-567.awsdns-34.com
  - ns-890.awsdns-56.net
  - ns-123.awsdns-78.co.uk
```

### 4. Deploy Frontend

From the Babylon root directory:

```bash
# Build static frontend
bun run build:static:mainnet

# Deploy to AWS + IPFS + JNS
bun run deploy:frontend:mainnet
```

## Environment Variables

### Required for Deployment

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION` | AWS region (default: us-west-2) |
| `DEPLOYER_PRIVATE_KEY` | Private key for JNS updates |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `IPFS_API_URL` | IPFS API endpoint | http://localhost:5001 |
| `RPC_URL` | Ethereum RPC URL | https://mainnet.base.org |
| `JNS_REGISTRY_ADDRESS` | JNS Registry contract | - |
| `JNS_RESOLVER_ADDRESS` | JNS Resolver contract | - |
| `CF_DISTRIBUTION_ID_TESTNET` | CloudFront ID for testnet | - |
| `CF_DISTRIBUTION_ID_MAINNET` | CloudFront ID for mainnet | - |

## Terraform Modules

### Route53

Creates hosted zone for `babylon.market`:
- DNS zone management
- NS records for domain registrar

### ACM

Creates SSL certificate in us-east-1 (required for CloudFront):
- Wildcard certificate (*.babylon.market)
- DNS validation via Route53

### CDN

Creates CloudFront distribution + S3:
- S3 bucket for static assets
- CloudFront with custom cache behaviors
- SPA fallback routing
- API proxy to backend
- IPFS content caching

## Deployment Commands

From Babylon root:

```bash
# Build
bun run build:static              # Local build
bun run build:static:testnet      # Testnet build
bun run build:static:mainnet      # Mainnet build

# Deploy
bun run deploy:frontend           # Full deploy (AWS + IPFS + JNS)
bun run deploy:frontend:testnet   # Build + deploy to testnet
bun run deploy:frontend:mainnet   # Build + deploy to mainnet
bun run deploy:aws                # AWS only (S3 + CloudFront)
bun run deploy:ipfs               # IPFS + JNS only

# Infrastructure
bun run infra:init                # Initialize terraform
bun run infra:plan:testnet        # Plan testnet changes
bun run infra:apply:testnet       # Apply testnet changes
bun run infra:plan:mainnet        # Plan mainnet changes
bun run infra:apply:mainnet       # Apply mainnet changes
```

## Decentralization

The architecture supports progressive decentralization:

1. **Frontend**: Deployed to both CloudFront (performance) and IPFS (censorship resistance)
2. **DNS**: JNS name resolves to IPFS content hash for fully decentralized access
3. **Backend**: Uses Jeju's decentralized services (CovenantQL, Cache, KMS)

Users can access Babylon via:
- `https://babylon.market` (CloudFront, fast)
- `https://babylon.jns.jeju.network` (JNS Gateway)
- Direct IPFS CID (fully decentralized)

## Security

- All traffic over HTTPS (TLS 1.2+)
- S3 buckets are private (CloudFront OAI)
- CloudFront uses custom headers for origin verification
- HSTS enabled with preload
- XSS protection headers
- Frame options for clickjacking protection

## Cost Optimization

- CloudFront PriceClass_100 for testnet (cheaper)
- CloudFront PriceClass_All for mainnet (global)
- S3 intelligent tiering for storage
- CloudFront caching reduces origin requests

## Monitoring

CloudFront metrics available in AWS CloudWatch:
- Request count
- Cache hit rate
- Error rate
- Latency

## Troubleshooting

### Certificate validation stuck

Wait up to 30 minutes for DNS propagation. Check Route53 for CNAME records.

### CloudFront 403 errors

Check S3 bucket policy allows CloudFront OAI access.

### IPFS upload fails

Verify IPFS node is running and accessible at IPFS_API_URL.

### JNS update fails

Ensure DEPLOYER_PRIVATE_KEY has funds on Base/Base Sepolia.

