# Babylon Frontend Deployment Checklist

This document outlines the manual steps required to deploy the decentralized Babylon frontend.

## 💰 Estimated Costs

| Resource | Monthly Cost |
|----------|--------------|
| CloudFront (1M requests) | ~$1 |
| S3 (10GB storage) | ~$0.25 |
| S3 (logs, 5GB) | ~$0.15 |
| CloudWatch (dashboard + 2 alarms) | ~$3 |
| Route53 (hosted zone) | $0.50 |
| **Total** | **~$5/month** + data transfer |

## ⚠️ Assumptions

1. **AWS Region**: CloudFront metrics require us-east-1
2. **Domain**: You own `babylon.market` and can update nameservers
3. **SSL**: ACM certificates auto-renew (no action needed)
4. **IPFS**: Local or remote IPFS node for decentralized deployment
5. **JNS**: Contracts deployed to Base Sepolia (testnet) or Base (mainnet)

## ✅ Completed (Automated)

- [x] Static frontend build script (`bun run build:static`)
- [x] API URL rewriting for static deployments
- [x] Optional catch-all routes for client-side navigation
- [x] Deployment script with validation (`scripts/deploy-frontend.ts`)
- [x] Terraform infrastructure modules (Route53, ACM, CloudFront)

## 🔧 Manual Steps Required

### 1. AWS Infrastructure Setup

**Prerequisites:**
- AWS CLI installed and configured (`aws configure`)
- Appropriate IAM permissions for S3, CloudFront, Route53, ACM

**Steps:**

```bash
# Navigate to terraform environment
cd packages/deployment/terraform/environments/testnet

# Copy example vars and fill in values
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Initialize and apply
terraform init
terraform plan
terraform apply
```

**Resources created:**
- S3 bucket for static assets
- CloudFront distribution
- Route53 hosted zone (if creating new)
- ACM SSL certificate

### 2. S3 Bucket Creation (if not using Terraform)

```bash
# Create buckets
aws s3 mb s3://babylon-testnet-frontend --region us-east-1
aws s3 mb s3://babylon-mainnet-frontend --region us-east-1

# Enable static website hosting
aws s3 website s3://babylon-testnet-frontend --index-document index.html --error-document 404.html
```

### 3. JNS Contract Addresses

After deploying JNS contracts, set the following environment variables:

```bash
export JNS_REGISTRY_ADDRESS=0x...  # JNS Registry contract
export JNS_RESOLVER_ADDRESS=0x...  # JNS Resolver contract
export DEPLOYER_PRIVATE_KEY=0x...  # Key with permission to update contenthash
```

### 4. CloudFront Distribution ID

After creating CloudFront distribution, set:

```bash
export CF_DISTRIBUTION_ID_TESTNET=E1234567890
export CF_DISTRIBUTION_ID_MAINNET=E0987654321
```

### 5. IPFS Node

Ensure IPFS is running and accessible:

```bash
# Local IPFS
ipfs daemon

# Or use remote IPFS API
export IPFS_API_URL=https://ipfs.babylon.market:5001
```

## 🚀 Deployment Commands

### Dry Run (Validation Only)
```bash
bun run deploy:frontend:testnet -- --dry-run
```

### Deploy to Testnet
```bash
bun run build:static --env testnet
bun run deploy:frontend:testnet
```

### Deploy to Mainnet
```bash
bun run build:static --env mainnet
bun run deploy:frontend:mainnet
```

### Skip Specific Steps
```bash
# Skip AWS (IPFS + JNS only)
bun run deploy:frontend:testnet -- --skip-aws

# Skip IPFS (AWS only)
bun run deploy:frontend:testnet -- --skip-ipfs

# Skip JNS update
bun run deploy:frontend:testnet -- --skip-jns
```

## 📋 Post-Deployment Verification

1. **CloudFront**: Visit `https://testnet.babylon.market` and verify pages load
2. **IPFS**: Access `https://ipfs.babylon.market/ipfs/{CID}/` and verify content
3. **JNS**: Resolve `babylon.market` through JNS gateway and verify contenthash

## ⚠️ Known Limitations

1. **Dynamic OG Images**: Social sharing images require a server (not possible with static export)
2. **API Routes**: All API calls go to separate backend at `api.babylon.market`
3. **SSR**: No server-side rendering - all pages are static HTML + client JS

## 🚫 Out of Scope (Cannot Be Automated)

These items require manual action or external resources:

| Item | Reason | Action Required |
|------|--------|-----------------|
| AWS credentials | Security - cannot store in repo | `aws configure` locally |
| Domain transfer | Registrar-specific | Update NS at registrar |
| SNS email confirmation | AWS requires click | Check inbox after apply |
| Terraform state bucket | Chicken-egg problem | Create manually first |
| JNS contract deployment | Requires blockchain TX | Deploy via Hardhat |
| IPFS daemon | External service | Run `ipfs daemon` |

## 🔍 Troubleshooting

### "S3 bucket not accessible"
- Check AWS credentials: `aws sts get-caller-identity`
- Verify bucket exists: `aws s3 ls s3://babylon-testnet-frontend`

### "IPFS connection failed"
- Check IPFS daemon: `ipfs id`
- Verify API endpoint: `curl -X POST http://localhost:5001/api/v0/id`

### "JNS transaction failed"
- Verify deployer has ETH for gas
- Check resolver contract permissions
- Ensure private key is correct format (0x prefixed)

