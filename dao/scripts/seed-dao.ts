#!/usr/bin/env bun

/**
 * Babylon DAO Seeding Script
 *
 * Seeds the Babylon DAO with:
 * 1. Packages from jeju-manifest.json
 * 2. Repos from jeju-manifest.json
 * 3. Initial funding weights from CEO
 * 4. Sample proposals for testing
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia, localhost } from 'viem/chains';

// ============ Types ============

interface DAOManifest {
  name: string;
  displayName: string;
  packages: {
    seeded: Array<{
      name: string;
      description: string;
      registry: string;
      fundingWeight: number;
    }>;
  };
  repos: {
    seeded: Array<{
      name: string;
      url: string;
      description: string;
      fundingWeight: number;
    }>;
  };
}

interface Deployment {
  daoId: string;
  contracts: {
    daoRegistry: Address;
    daoFunding: Address;
  };
}

// ============ ABIs ============

const DAORegistryABI = [
  {
    type: 'function',
    name: 'linkPackage',
    inputs: [
      { name: 'daoId', type: 'bytes32' },
      { name: 'packageId', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'linkRepo',
    inputs: [
      { name: 'daoId', type: 'bytes32' },
      { name: 'repoId', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const DAOFundingABI = [
  {
    type: 'function',
    name: 'proposeProject',
    inputs: [
      { name: 'daoId', type: 'bytes32' },
      { name: 'projectType', type: 'uint8' },
      { name: 'registryId', type: 'bytes32' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'primaryRecipient', type: 'address' },
      { name: 'additionalRecipients', type: 'address[]' },
      { name: 'recipientShares', type: 'uint256[]' },
    ],
    outputs: [{ name: 'projectId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptProject',
    inputs: [{ name: 'projectId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setCEOWeight',
    inputs: [
      { name: 'projectId', type: 'bytes32' },
      { name: 'weight', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'ProjectProposed',
    inputs: [
      { name: 'projectId', type: 'bytes32', indexed: true },
      { name: 'daoId', type: 'bytes32', indexed: true },
      { name: 'projectType', type: 'uint8', indexed: false },
      { name: 'proposer', type: 'address', indexed: false },
    ],
  },
] as const;

const PackageRegistryABI = [
  {
    type: 'function',
    name: 'registerPackage',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'cid', type: 'string' },
      { name: 'version', type: 'string' },
    ],
    outputs: [{ name: 'packageId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPackageByName',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'packageId', type: 'bytes32' },
          { name: 'name', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const;

const RepoRegistryABI = [
  {
    type: 'function',
    name: 'registerRepository',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'url', type: 'string' },
    ],
    outputs: [{ name: 'repoId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getRepoByName',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'repoId', type: 'bytes32' },
          { name: 'name', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const;

// ============ Configuration ============

function getChainConfig(network: string) {
  switch (network) {
    case 'mainnet':
      return {
        chain: base,
        rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
      };
    case 'testnet':
      return {
        chain: baseSepolia,
        rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
      };
    default:
      return {
        chain: localhost,
        rpcUrl: process.env.LOCAL_RPC_URL ?? 'http://localhost:8545',
      };
  }
}

async function loadManifest(): Promise<DAOManifest> {
  const manifestPath = join(__dirname, '..', 'jeju-manifest.json');
  const content = await readFile(manifestPath, 'utf-8');
  return JSON.parse(content) as DAOManifest;
}

async function loadDeployment(network: string): Promise<Deployment> {
  const deploymentPath = join(
    __dirname,
    '..',
    'deployments',
    `${network}.json`
  );
  const content = await readFile(deploymentPath, 'utf-8');
  return JSON.parse(content) as Deployment;
}

async function loadJejuDeployment(
  network: string
): Promise<Record<string, Address>> {
  const deploymentPath = join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'config',
    'deployments',
    `${network}.json`
  );
  const content = await readFile(deploymentPath, 'utf-8').catch(() => '{}');
  return JSON.parse(content) as Record<string, Address>;
}

// ============ Seeding Functions ============

async function seedBabylonDAO(network: string): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Seeding Babylon DAO on ${network}`);
  console.log(`${'='.repeat(60)}\n`);

  const manifest = await loadManifest();
  const deployment = await loadDeployment(network);
  const jejuDeployment = await loadJejuDeployment(network);
  const chainConfig = getChainConfig(network);

  const privateKey = process.env.DEPLOYER_KEY ?? process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEPLOYER_KEY or PRIVATE_KEY required');
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  const daoId = deployment.daoId as `0x${string}`;
  const daoRegistryAddress = deployment.contracts.daoRegistry;
  const daoFundingAddress = deployment.contracts.daoFunding;
  const packageRegistryAddress = jejuDeployment.PackageRegistry as Address;
  const repoRegistryAddress = jejuDeployment.RepoRegistry as Address;

  console.log(`DAO ID: ${daoId}`);
  console.log(`Seeder: ${account.address}\n`);

  // Seed packages
  console.log('1. Seeding packages...');
  const packageIds: string[] = [];

  for (const pkg of manifest.packages.seeded) {
    console.log(`\n  Processing: ${pkg.name}`);

    // Generate a deterministic package ID
    const packageId = keccak256(toBytes(`babylon:package:${pkg.name}`));
    packageIds.push(packageId);

    // Register package in PackageRegistry if available
    if (packageRegistryAddress) {
      try {
        const registerHash = await walletClient.writeContract({
          address: packageRegistryAddress,
          abi: PackageRegistryABI,
          functionName: 'registerPackage',
          args: [pkg.name, pkg.description, '', '1.0.0'],
        });
        await publicClient.waitForTransactionReceipt({ hash: registerHash });
        console.log(`    Registered in PackageRegistry`);
      } catch {
        console.log(`    Package may already exist, continuing...`);
      }
    }

    // Link to DAO
    try {
      const linkHash = await walletClient.writeContract({
        address: daoRegistryAddress,
        abi: DAORegistryABI,
        functionName: 'linkPackage',
        args: [daoId, packageId],
      });
      await publicClient.waitForTransactionReceipt({ hash: linkHash });
      console.log(`    Linked to Babylon DAO`);
    } catch {
      console.log(`    Link may already exist, continuing...`);
    }

    // Create funding project
    try {
      const proposeHash = await walletClient.writeContract({
        address: daoFundingAddress,
        abi: DAOFundingABI,
        functionName: 'proposeProject',
        args: [
          daoId,
          0,
          packageId,
          pkg.name,
          pkg.description,
          account.address,
          [],
          [],
        ],
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: proposeHash,
      });

      // Get project ID from logs
      const projectId = receipt.logs[0]?.topics?.[1] ?? packageId;

      // Auto-accept (as admin)
      const acceptHash = await walletClient.writeContract({
        address: daoFundingAddress,
        abi: DAOFundingABI,
        functionName: 'acceptProject',
        args: [projectId],
      });
      await publicClient.waitForTransactionReceipt({ hash: acceptHash });
      console.log(`    Created funding project`);

      // Set CEO weight
      const weightHash = await walletClient.writeContract({
        address: daoFundingAddress,
        abi: DAOFundingABI,
        functionName: 'setCEOWeight',
        args: [projectId, BigInt(pkg.fundingWeight)],
      });
      await publicClient.waitForTransactionReceipt({ hash: weightHash });
      console.log(`    Set CEO weight: ${pkg.fundingWeight / 100}%`);
    } catch {
      console.log(`    Funding project may exist, continuing...`);
    }
  }

  // Seed repos
  console.log('\n2. Seeding repositories...');
  const repoIds: string[] = [];

  for (const repo of manifest.repos.seeded) {
    console.log(`\n  Processing: ${repo.name}`);

    const repoId = keccak256(toBytes(`babylon:repo:${repo.name}`));
    repoIds.push(repoId);

    // Register repo in RepoRegistry if available
    if (repoRegistryAddress) {
      try {
        const registerHash = await walletClient.writeContract({
          address: repoRegistryAddress,
          abi: RepoRegistryABI,
          functionName: 'registerRepository',
          args: [repo.name, repo.description, repo.url],
        });
        await publicClient.waitForTransactionReceipt({ hash: registerHash });
        console.log(`    Registered in RepoRegistry`);
      } catch {
        console.log(`    Repo may already exist, continuing...`);
      }
    }

    // Link to DAO
    try {
      const linkHash = await walletClient.writeContract({
        address: daoRegistryAddress,
        abi: DAORegistryABI,
        functionName: 'linkRepo',
        args: [daoId, repoId],
      });
      await publicClient.waitForTransactionReceipt({ hash: linkHash });
      console.log(`    Linked to Babylon DAO`);
    } catch {
      console.log(`    Link may already exist, continuing...`);
    }

    // Create funding project
    try {
      const proposeHash = await walletClient.writeContract({
        address: daoFundingAddress,
        abi: DAOFundingABI,
        functionName: 'proposeProject',
        args: [
          daoId,
          1,
          repoId,
          repo.name,
          repo.description,
          account.address,
          [],
          [],
        ],
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: proposeHash,
      });

      const projectId = receipt.logs[0]?.topics?.[1] ?? repoId;

      const acceptHash = await walletClient.writeContract({
        address: daoFundingAddress,
        abi: DAOFundingABI,
        functionName: 'acceptProject',
        args: [projectId],
      });
      await publicClient.waitForTransactionReceipt({ hash: acceptHash });
      console.log(`    Created funding project`);

      const weightHash = await walletClient.writeContract({
        address: daoFundingAddress,
        abi: DAOFundingABI,
        functionName: 'setCEOWeight',
        args: [projectId, BigInt(repo.fundingWeight)],
      });
      await publicClient.waitForTransactionReceipt({ hash: weightHash });
      console.log(`    Set CEO weight: ${repo.fundingWeight / 100}%`);
    } catch {
      console.log(`    Funding project may exist, continuing...`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Babylon DAO Seeding Complete');
  console.log(`${'='.repeat(60)}`);
  console.log(`\nPackages linked: ${packageIds.length}`);
  console.log(`Repos linked: ${repoIds.length}`);
  console.log(
    `\nThe Monkey King\'s treasury is now connected to the ecosystem.`
  );
  console.log('Deep funding is ready to support Babylon development.');
}

// ============ CLI Entry ============

const network = process.argv[2] ?? 'localnet';

seedBabylonDAO(network)
  .then(() => {
    console.log('\nSeeding complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nSeeding failed:', error.message);
    process.exit(1);
  });
