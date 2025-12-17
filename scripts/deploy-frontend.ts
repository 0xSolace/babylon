#!/usr/bin/env bun
/**
 * Deploy Babylon Frontend to AWS CloudFront + IPFS + JNS
 *
 * This script deploys the static frontend to:
 * 1. AWS S3 + CloudFront for web2 performance (babylon.market)
 * 2. IPFS for decentralized storage
 * 3. JNS for decentralized name resolution
 *
 * Usage:
 *   bun run scripts/deploy-frontend.ts [--env testnet|mainnet] [--skip-aws] [--skip-ipfs]
 *
 * Requirements:
 *   - AWS CLI configured with appropriate credentials
 *   - IPFS node running or IPFS_API_URL configured
 *   - JNS_REGISTRY_ADDRESS and JNS_RESOLVER_ADDRESS configured
 *   - DEPLOYER_PRIVATE_KEY for JNS updates
 */

import { spawn } from 'bun';
import { existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  type Hex,
  http,
  keccak256,
  toBytes,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

interface DeployConfig {
  environment: 'testnet' | 'mainnet';
  domain: string;
  s3Bucket: string;
  cloudfrontDistributionId: string;
  ipfsApiUrl: string;
  rpcUrl: string;
  jnsRegistryAddress: Address;
  jnsResolverAddress: Address;
}

interface DeployResult {
  s3Uploaded: boolean;
  cloudfrontInvalidated: boolean;
  ipfsCid: string | null;
  jnsUpdated: boolean;
  urls: {
    cloudfront: string;
    ipfs: string | null;
    jns: string | null;
  };
}

const CONFIGS: Record<string, DeployConfig> = {
  testnet: {
    environment: 'testnet',
    domain: 'testnet.babylon.market',
    s3Bucket: 'babylon-testnet-frontend',
    cloudfrontDistributionId: process.env.CF_DISTRIBUTION_ID_TESTNET ?? '',
    ipfsApiUrl: process.env.IPFS_API_URL ?? 'http://localhost:5001',
    rpcUrl: process.env.RPC_URL ?? 'https://sepolia.base.org',
    jnsRegistryAddress: (process.env.JNS_REGISTRY_ADDRESS ??
      '0x0000000000000000000000000000000000000000') as Address,
    jnsResolverAddress: (process.env.JNS_RESOLVER_ADDRESS ??
      '0x0000000000000000000000000000000000000000') as Address,
  },
  mainnet: {
    environment: 'mainnet',
    domain: 'babylon.market',
    s3Bucket: 'babylon-mainnet-frontend',
    cloudfrontDistributionId: process.env.CF_DISTRIBUTION_ID_MAINNET ?? '',
    ipfsApiUrl: process.env.IPFS_API_URL ?? 'http://localhost:5001',
    rpcUrl: process.env.RPC_URL ?? 'https://mainnet.base.org',
    jnsRegistryAddress: (process.env.JNS_REGISTRY_ADDRESS ??
      '0x0000000000000000000000000000000000000000') as Address,
    jnsResolverAddress: (process.env.JNS_RESOLVER_ADDRESS ??
      '0x0000000000000000000000000000000000000000') as Address,
  },
};

const JNS_RESOLVER_ABI = [
  {
    name: 'setContenthash',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'hash', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

function namehash(name: string): Hex {
  let node =
    '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;
  if (!name) return node;

  const labels = name.split('.');
  for (let i = labels.length - 1; i >= 0; i--) {
    const label = labels[i];
    if (!label) continue;
    const labelHash = keccak256(toBytes(label));
    node = keccak256(toBytes(node + labelHash.slice(2))) as Hex;
  }

  return node;
}

function encodeIpfsCid(cid: string): Hex {
  // IPFS contenthash format: 0xe3 (ipfs namespace) + CID bytes
  const cidBytes = Buffer.from(cid);
  const prefix = Buffer.from([0xe3, 0x01, 0x01, 0x70, 0x12, 0x20]);
  return ('0x' + Buffer.concat([prefix, cidBytes]).toString('hex')) as Hex;
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      files.push(relative(baseDir, fullPath));
    }
  }
  return files;
}

async function deployToAws(
  buildDir: string,
  config: DeployConfig
): Promise<{ uploaded: boolean; invalidated: boolean }> {
  console.log('☁️  Deploying to AWS S3...');

  // Sync to S3
  const syncProc = spawn(
    ['aws', 's3', 'sync', buildDir, `s3://${config.s3Bucket}`, '--delete'],
    {
      stdout: 'inherit',
      stderr: 'inherit',
    }
  );

  const syncExit = await syncProc.exited;
  if (syncExit !== 0) {
    console.error('❌ S3 sync failed');
    return { uploaded: false, invalidated: false };
  }

  console.log('✅ S3 upload complete');

  // Set cache headers for immutable content
  console.log('📝 Setting cache headers...');

  // Long cache for hashed assets
  await spawn(
    [
      'aws',
      's3',
      'cp',
      `s3://${config.s3Bucket}/_next/static/`,
      `s3://${config.s3Bucket}/_next/static/`,
      '--recursive',
      '--metadata-directive',
      'REPLACE',
      '--cache-control',
      'public, max-age=31536000, immutable',
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  ).exited;

  // Short cache for HTML
  await spawn(
    [
      'aws',
      's3',
      'cp',
      `s3://${config.s3Bucket}/index.html`,
      `s3://${config.s3Bucket}/index.html`,
      '--metadata-directive',
      'REPLACE',
      '--cache-control',
      'public, max-age=0, must-revalidate',
      '--content-type',
      'text/html',
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  ).exited;

  // Invalidate CloudFront cache
  if (config.cloudfrontDistributionId) {
    console.log('🔄 Invalidating CloudFront cache...');

    const invalidateProc = spawn(
      [
        'aws',
        'cloudfront',
        'create-invalidation',
        '--distribution-id',
        config.cloudfrontDistributionId,
        '--paths',
        '/*',
      ],
      {
        stdout: 'inherit',
        stderr: 'inherit',
      }
    );

    const invalidateExit = await invalidateProc.exited;
    if (invalidateExit !== 0) {
      console.warn('⚠️  CloudFront invalidation failed');
      return { uploaded: true, invalidated: false };
    }

    console.log('✅ CloudFront cache invalidated');
    return { uploaded: true, invalidated: true };
  }

  return { uploaded: true, invalidated: false };
}

class DeploymentError extends Error {
  constructor(
    message: string,
    public readonly phase: string
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}

async function deployToIpfs(
  buildDir: string,
  config: DeployConfig
): Promise<string> {
  console.log('📦 Uploading to IPFS...');

  const files = getAllFiles(buildDir);
  if (files.length === 0) {
    throw new DeploymentError('No files found in build directory', 'ipfs');
  }
  console.log(`   Found ${files.length} files`);

  const formData = new FormData();

  for (const filePath of files) {
    const fullPath = join(buildDir, filePath);
    const file = Bun.file(fullPath);
    const blob = await file.arrayBuffer();
    formData.append('file', new Blob([blob]), filePath);
  }

  let response: Response;
  try {
    response = await fetch(
      `${config.ipfsApiUrl}/api/v0/add?wrap-with-directory=true&pin=true`,
      {
        method: 'POST',
        body: formData,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new DeploymentError(
      `IPFS connection failed: ${message}. Is IPFS running at ${config.ipfsApiUrl}?`,
      'ipfs'
    );
  }

  if (!response.ok) {
    throw new DeploymentError(
      `IPFS upload failed: ${response.status} ${response.statusText}`,
      'ipfs'
    );
  }

  const text = await response.text();
  const lines = text.trim().split('\n');
  if (lines.length === 0) {
    throw new DeploymentError('IPFS returned empty response', 'ipfs');
  }

  const lastLine = JSON.parse(lines[lines.length - 1]) as { Hash?: string };
  if (!lastLine.Hash) {
    throw new DeploymentError('IPFS response missing Hash field', 'ipfs');
  }

  console.log(`✅ Uploaded to IPFS: ${lastLine.Hash}`);
  return lastLine.Hash;
}

interface JnsConfig {
  privateKey: Hex;
  resolverAddress: Address;
}

function validateJnsConfig(config: DeployConfig): JnsConfig | null {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
  if (!privateKey) {
    console.log('ℹ️  DEPLOYER_PRIVATE_KEY not set - JNS update will be skipped');
    return null;
  }

  if (
    config.jnsResolverAddress === '0x0000000000000000000000000000000000000000'
  ) {
    console.log('ℹ️  JNS resolver not configured - JNS update will be skipped');
    return null;
  }

  return { privateKey, resolverAddress: config.jnsResolverAddress };
}

async function updateJns(
  cid: string,
  config: DeployConfig,
  jnsConfig: JnsConfig
): Promise<void> {
  console.log('🔗 Updating JNS contenthash...');

  const chain = config.environment === 'mainnet' ? base : baseSepolia;
  const account = privateKeyToAccount(jnsConfig.privateKey);

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  });

  const node = namehash(config.domain);
  const contenthash = encodeIpfsCid(cid);

  console.log(`   Domain: ${config.domain}`);
  console.log(`   Node: ${node.slice(0, 18)}...`);
  console.log(`   CID: ${cid}`);

  const data = encodeFunctionData({
    abi: JNS_RESOLVER_ABI,
    functionName: 'setContenthash',
    args: [node, contenthash],
  });

  let hash: Hex;
  try {
    // Type assertion needed due to viem v2.41+ strict kzg requirement for blob txs
    const txParams = { account, chain, to: jnsConfig.resolverAddress, data };
    hash = await walletClient.sendTransaction(txParams as never);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new DeploymentError(`JNS transaction failed: ${message}`, 'jns');
  }

  console.log(`   Transaction: ${hash}`);

  try {
    await publicClient.waitForTransactionReceipt({ hash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new DeploymentError(
      `JNS transaction confirmation failed: ${message}`,
      'jns'
    );
  }

  console.log('✅ JNS updated');
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

async function validatePrerequisites(
  config: DeployConfig,
  options: { skipAws: boolean; skipIpfs: boolean; skipJns: boolean }
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check AWS CLI if deploying to AWS
  if (!options.skipAws) {
    const awsCheck = spawn(['aws', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const awsExit = await awsCheck.exited;
    if (awsExit !== 0) {
      errors.push('AWS CLI not installed or not in PATH');
    }

    // Check S3 bucket access
    const bucketCheck = spawn(
      ['aws', 's3', 'ls', `s3://${config.s3Bucket}`, '--max-items', '1'],
      { stdout: 'pipe', stderr: 'pipe' }
    );
    const bucketExit = await bucketCheck.exited;
    if (bucketExit !== 0) {
      errors.push(
        `S3 bucket '${config.s3Bucket}' not accessible. Create it or check credentials.`
      );
    }

    if (!config.cloudfrontDistributionId) {
      warnings.push(
        "CF_DISTRIBUTION_ID not set - CloudFront cache won't be invalidated"
      );
    }
  }

  // Check IPFS if deploying to IPFS
  if (!options.skipIpfs) {
    try {
      const ipfsCheck = await fetch(`${config.ipfsApiUrl}/api/v0/id`, {
        method: 'POST',
      });
      if (!ipfsCheck.ok) {
        errors.push(`IPFS node not responding at ${config.ipfsApiUrl}`);
      }
    } catch {
      errors.push(
        `Cannot connect to IPFS at ${config.ipfsApiUrl}. Is IPFS daemon running?`
      );
    }
  }

  // Check JNS config if updating JNS
  if (!options.skipJns && !options.skipIpfs) {
    const jnsConfig = validateJnsConfig(config);
    if (!jnsConfig) {
      warnings.push('JNS update will be skipped (missing configuration)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const envArg = args.find((a) => a.startsWith('--env='))?.split('=')[1];
  const envIndex = args.indexOf('--env');
  const envValue = envIndex !== -1 ? args[envIndex + 1] : undefined;
  const targetEnv = (envArg ?? envValue ?? 'mainnet') as 'testnet' | 'mainnet';

  const skipAws = args.includes('--skip-aws');
  const skipIpfs = args.includes('--skip-ipfs');
  const skipJns = args.includes('--skip-jns');
  const dryRun = args.includes('--dry-run');

  const config = CONFIGS[targetEnv];
  if (!config) {
    console.error(`Unknown environment: ${targetEnv}`);
    console.error('Valid environments: testnet, mainnet');
    process.exit(1);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║              🏛️  BABYLON FRONTEND DEPLOYMENT                                  ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Environment:  ${config.environment.padEnd(56)}║
║  Domain:       ${config.domain.padEnd(56)}║
║  S3 Bucket:    ${config.s3Bucket.padEnd(56)}║
║  Mode:         ${(dryRun ? 'DRY RUN (validation only)' : 'DEPLOY').padEnd(56)}║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);

  const babylonRoot = process.cwd();
  const buildDir = join(babylonRoot, 'apps/web/out');

  // Check build exists
  if (!existsSync(buildDir)) {
    console.error('❌ Static build not found at apps/web/out');
    console.error('   Run: bun run build:static --env ' + targetEnv);
    process.exit(1);
  }

  // Validate prerequisites
  console.log('🔍 Validating prerequisites...');
  const validation = await validatePrerequisites(config, {
    skipAws,
    skipIpfs,
    skipJns,
  });

  for (const warning of validation.warnings) {
    console.log(`⚠️  ${warning}`);
  }

  if (!validation.valid) {
    console.error('\n❌ Validation failed:');
    for (const error of validation.errors) {
      console.error(`   • ${error}`);
    }
    process.exit(1);
  }

  console.log('✅ Prerequisites validated\n');

  if (dryRun) {
    console.log('✅ Dry run complete - all prerequisites satisfied');
    console.log('   Run without --dry-run to deploy');
    process.exit(0);
  }

  const result: DeployResult = {
    s3Uploaded: false,
    cloudfrontInvalidated: false,
    ipfsCid: null,
    jnsUpdated: false,
    urls: {
      cloudfront: `https://${config.domain}`,
      ipfs: null,
      jns: null,
    },
  };

  // Deploy to AWS
  if (!skipAws) {
    const awsResult = await deployToAws(buildDir, config);
    result.s3Uploaded = awsResult.uploaded;
    result.cloudfrontInvalidated = awsResult.invalidated;
    if (!awsResult.uploaded) {
      throw new DeploymentError('AWS S3 upload failed', 'aws');
    }
  } else {
    console.log('⏭️  Skipping AWS deployment');
  }

  // Deploy to IPFS
  if (!skipIpfs) {
    const cid = await deployToIpfs(buildDir, config);
    result.ipfsCid = cid;
    result.urls.ipfs = `https://ipfs.${config.domain}/ipfs/${cid}`;
  } else {
    console.log('⏭️  Skipping IPFS deployment');
  }

  // Update JNS
  const jnsConfig = validateJnsConfig(config);
  if (!skipJns && result.ipfsCid && jnsConfig) {
    await updateJns(result.ipfsCid, config, jnsConfig);
    result.jnsUpdated = true;
    result.urls.jns = `https://${config.domain}`;
  } else if (!result.ipfsCid && !skipJns) {
    console.log('⏭️  Skipping JNS update (no IPFS CID)');
  } else if (!jnsConfig && !skipJns) {
    console.log('⏭️  Skipping JNS update (not configured)');
  }

  // Save deployment info
  const deployInfo = {
    ...result,
    timestamp: new Date().toISOString(),
    environment: config.environment,
    domain: config.domain,
  };
  writeFileSync(
    join(babylonRoot, 'deployment-result.json'),
    JSON.stringify(deployInfo, null, 2)
  );

  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║  ✅ DEPLOYMENT COMPLETE                                                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  AWS S3:       ${(result.s3Uploaded ? '✅ Uploaded' : '❌ Failed').padEnd(56)}║
║  CloudFront:   ${(result.cloudfrontInvalidated ? '✅ Invalidated' : '⏭️  Skipped').padEnd(56)}║
║  IPFS CID:     ${(result.ipfsCid ?? '⏭️  Skipped').slice(0, 56).padEnd(56)}║
║  JNS:          ${(result.jnsUpdated ? '✅ Updated' : '⏭️  Skipped').padEnd(56)}║
║                                                                               ║
║  URLs:                                                                        ║
║    CloudFront: ${result.urls.cloudfront.padEnd(56)}║
${result.urls.ipfs ? `║    IPFS:       ${result.urls.ipfs.slice(0, 56).padEnd(56)}║\n` : ''}${result.urls.jns ? `║    JNS:        ${result.urls.jns.padEnd(56)}║\n` : ''}║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);
}

main().catch((err) => {
  if (err instanceof DeploymentError) {
    console.error(`\n❌ Deployment failed during ${err.phase}: ${err.message}`);
  } else {
    console.error(
      '\n❌ Deployment failed:',
      err instanceof Error ? err.message : err
    );
  }
  process.exit(1);
});
