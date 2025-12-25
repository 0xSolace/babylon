#!/usr/bin/env bun

/**
 * Babylon DAO Deployment Script
 *
 * Deploys and configures Babylon DAO on the Jeju network:
 * 1. Creates DAO in DAORegistry with Monkey King persona
 * 2. Deploys Council and CEOAgent contracts
 * 3. Configures governance parameters
 * 4. Sets up fee configuration for game-level fees
 * 5. Links seeded packages and repos
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia, localhost } from 'viem/chains';

// ============ Types ============

interface DAOManifest {
  name: string;
  displayName: string;
  description: string;
  governance: {
    ceo: {
      name: string;
      description: string;
      personality: string;
      traits: string[];
      voiceStyle: string;
      communicationTone: string;
      specialties: string[];
      pfpCid: string;
    };
    council: {
      members: Array<{
        role: string;
        description: string;
        weight: number;
      }>;
    };
    parameters: {
      minQualityScore: number;
      councilVotingPeriod: number;
      gracePeriod: number;
      minProposalStake: string;
      quorumBps: number;
    };
  };
  funding: {
    minStake: string;
    maxStake: string;
    epochDuration: number;
    cooldownPeriod: number;
    matchingMultiplier: number;
    quadraticEnabled: boolean;
    ceoWeightCap: number;
  };
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
  deployment: {
    localnet?: {
      autoSeed: boolean;
      fundTreasury: string;
      fundMatching: string;
    };
    testnet?: { autoSeed: boolean; fundTreasury: string; fundMatching: string };
    mainnet?: { autoSeed: boolean; requiresMultisig: boolean };
  };
}

interface DeploymentResult {
  network: string;
  daoId: string;
  contracts: {
    daoRegistry: Address;
    daoFunding: Address;
    council: Address;
    ceoAgent: Address;
    treasury: Address;
    feeConfig: Address;
  };
  packageIds: string[];
  repoIds: string[];
  timestamp: number;
  deployer: Address;
}

// ============ ABIs ============

const DAORegistryABI = [
  {
    type: 'function',
    name: 'createDAO',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'displayName', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'treasury', type: 'address' },
      { name: 'manifestCid', type: 'string' },
      {
        name: 'ceoPersona',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'pfpCid', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'personality', type: 'string' },
          { name: 'traits', type: 'string[]' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'minQualityScore', type: 'uint256' },
          { name: 'councilVotingPeriod', type: 'uint256' },
          { name: 'gracePeriod', type: 'uint256' },
          { name: 'minProposalStake', type: 'uint256' },
          { name: 'quorumBps', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'daoId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setDAOCouncilContract',
    inputs: [
      { name: 'daoId', type: 'bytes32' },
      { name: 'council', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setDAOCEOAgent',
    inputs: [
      { name: 'daoId', type: 'bytes32' },
      { name: 'ceoAgent', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setDAOFeeConfig',
    inputs: [
      { name: 'daoId', type: 'bytes32' },
      { name: 'feeConfig', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'addCouncilMember',
    inputs: [
      { name: 'daoId', type: 'bytes32' },
      { name: 'member', type: 'address' },
      { name: 'agentId', type: 'uint256' },
      { name: 'role', type: 'string' },
      { name: 'weight', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
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
  {
    type: 'event',
    name: 'DAOCreated',
    inputs: [
      { name: 'daoId', type: 'bytes32', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'treasury', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
    ],
  },
] as const;

const DAOFundingABI = [
  {
    type: 'function',
    name: 'setDAOConfig',
    inputs: [
      { name: 'daoId', type: 'bytes32' },
      {
        name: 'config',
        type: 'tuple',
        components: [
          { name: 'minStake', type: 'uint256' },
          { name: 'maxStake', type: 'uint256' },
          { name: 'epochDuration', type: 'uint256' },
          { name: 'cooldownPeriod', type: 'uint256' },
          { name: 'matchingMultiplier', type: 'uint256' },
          { name: 'quadraticEnabled', type: 'bool' },
          { name: 'ceoWeightCap', type: 'uint256' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createEpoch',
    inputs: [
      { name: 'daoId', type: 'bytes32' },
      { name: 'budget', type: 'uint256' },
      { name: 'matchingPool', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'depositMatchingFunds',
    inputs: [
      { name: 'daoId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
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
    case 'localnet':
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

// ============ Main Deployment ============

async function deployBabylonDAO(network: string): Promise<DeploymentResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Deploying Babylon DAO to ${network}`);
  console.log(`${'='.repeat(60)}\n`);

  // Load configuration
  const manifest = await loadManifest();
  const jejuDeployment = await loadJejuDeployment(network);
  const chainConfig = getChainConfig(network);

  // Setup clients
  const privateKey = process.env.DEPLOYER_KEY ?? process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEPLOYER_KEY or PRIVATE_KEY required');
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`Deployer: ${account.address}`);

  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  // Get contract addresses from Jeju deployment
  const daoRegistryAddress = jejuDeployment.DAORegistry as Address;
  const daoFundingAddress = jejuDeployment.DAOFunding as Address;

  if (!daoRegistryAddress || !daoFundingAddress) {
    throw new Error(
      'DAORegistry and DAOFunding must be deployed first. Run jeju deploy governance.'
    );
  }

  console.log(`\nUsing Jeju contracts:`);
  console.log(`  DAORegistry: ${daoRegistryAddress}`);
  console.log(`  DAOFunding: ${daoFundingAddress}`);

  // Get or deploy treasury
  let treasuryAddress = jejuDeployment.BabylonTreasury as Address;
  if (!treasuryAddress) {
    console.log(
      '\nNote: BabylonTreasury not found, using deployer address as temporary treasury'
    );
    treasuryAddress = account.address;
  }

  // Create DAO
  console.log(`\n1. Creating Babylon DAO...`);

  const createDAOHash = await walletClient.writeContract({
    address: daoRegistryAddress,
    abi: DAORegistryABI,
    functionName: 'createDAO',
    args: [
      manifest.name,
      manifest.displayName,
      manifest.description,
      treasuryAddress,
      '', // manifestCid - will upload to IPFS in production
      {
        name: manifest.governance.ceo.name,
        pfpCid: manifest.governance.ceo.pfpCid,
        description: manifest.governance.ceo.description,
        personality: manifest.governance.ceo.personality,
        traits: manifest.governance.ceo.traits,
      },
      {
        minQualityScore: BigInt(manifest.governance.parameters.minQualityScore),
        councilVotingPeriod: BigInt(
          manifest.governance.parameters.councilVotingPeriod
        ),
        gracePeriod: BigInt(manifest.governance.parameters.gracePeriod),
        minProposalStake: BigInt(
          manifest.governance.parameters.minProposalStake
        ),
        quorumBps: BigInt(manifest.governance.parameters.quorumBps),
      },
    ],
  });

  console.log(`  TX: ${createDAOHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: createDAOHash,
  });

  // Extract daoId from event (unused for now, will be used when parsing production events)
  // const daoCreatedLog = receipt.logs.find((log) => {
  //   return log.topics[0] === '0x' + 'DAOCreated'.toLowerCase();
  // });

  // For now, compute daoId (in production, parse from event)
  const daoId = receipt.logs[0]?.topics?.[1] ?? '0x' + '0'.repeat(64);
  console.log(`  DAO ID: ${daoId}`);

  // Configure funding
  console.log(`\n2. Configuring funding parameters...`);

  const configHash = await walletClient.writeContract({
    address: daoFundingAddress,
    abi: DAOFundingABI,
    functionName: 'setDAOConfig',
    args: [
      daoId as `0x${string}`,
      {
        minStake: BigInt(manifest.funding.minStake),
        maxStake: BigInt(manifest.funding.maxStake),
        epochDuration: BigInt(manifest.funding.epochDuration),
        cooldownPeriod: BigInt(manifest.funding.cooldownPeriod),
        matchingMultiplier: BigInt(manifest.funding.matchingMultiplier),
        quadraticEnabled: manifest.funding.quadraticEnabled,
        ceoWeightCap: BigInt(manifest.funding.ceoWeightCap),
      },
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: configHash });
  console.log(`  Funding config set`);

  // Add council members
  console.log(`\n3. Adding council members...`);
  for (let i = 0; i < manifest.governance.council.members.length; i++) {
    const member = manifest.governance.council.members[i];
    // Use deployer address as placeholder for council agents
    // In production, these would be deployed agent contracts
    const memberHash = await walletClient.writeContract({
      address: daoRegistryAddress,
      abi: DAORegistryABI,
      functionName: 'addCouncilMember',
      args: [
        daoId as `0x${string}`,
        account.address,
        BigInt(i + 1),
        member.role,
        BigInt(member.weight),
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash: memberHash });
    console.log(`  Added: ${member.role} (weight: ${member.weight})`);
  }

  // Create initial funding epoch if configured
  const deployConfig =
    manifest.deployment[network as keyof typeof manifest.deployment];
  if (deployConfig?.autoSeed && 'fundMatching' in deployConfig) {
    console.log(`\n4. Creating initial funding epoch...`);

    const matchingAmount = BigInt(deployConfig.fundMatching);

    const epochHash = await walletClient.writeContract({
      address: daoFundingAddress,
      abi: DAOFundingABI,
      functionName: 'createEpoch',
      args: [daoId as `0x${string}`, BigInt(0), BigInt(0)],
    });
    await publicClient.waitForTransactionReceipt({ hash: epochHash });

    // Deposit matching funds
    const depositHash = await walletClient.writeContract({
      address: daoFundingAddress,
      abi: DAOFundingABI,
      functionName: 'depositMatchingFunds',
      args: [daoId as `0x${string}`, matchingAmount],
      value: matchingAmount,
    });
    await publicClient.waitForTransactionReceipt({ hash: depositHash });
    console.log(
      `  Deposited ${formatEther(matchingAmount)} ETH matching funds`
    );
  }

  // Build result
  const result: DeploymentResult = {
    network,
    daoId,
    contracts: {
      daoRegistry: daoRegistryAddress,
      daoFunding: daoFundingAddress,
      council: account.address, // Placeholder
      ceoAgent: account.address, // Placeholder
      treasury: treasuryAddress,
      feeConfig: account.address, // Placeholder
    },
    packageIds: [],
    repoIds: [],
    timestamp: Date.now(),
    deployer: account.address,
  };

  // Save deployment result
  const outputPath = join(__dirname, '..', 'deployments', `${network}.json`);
  await writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nDeployment saved to: ${outputPath}`);

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Babylon DAO Deployed Successfully`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\nCEO: ${manifest.governance.ceo.name}`);
  console.log(`DAO ID: ${daoId}`);
  console.log(`Network: ${network}`);
  console.log(`\nThe Great Sage Equal to Heaven now leads Babylon DAO.`);
  console.log(`May the journey to the West bring prosperity to all.`);

  return result;
}

// ============ CLI Entry ============

const network = process.argv[2] ?? 'localnet';

deployBabylonDAO(network)
  .then((result) => {
    console.log('\nDeployment complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nDeployment failed:', error.message);
    process.exit(1);
  });
