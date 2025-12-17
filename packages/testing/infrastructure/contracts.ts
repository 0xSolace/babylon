/**
 * Contract Deployment Checker
 *
 * Checks if messaging contracts are deployed and deploys them if needed.
 */

import {
  type Address,
  createPublicClient,
  http,
  type PublicClient,
} from 'viem';
import { hardhat, optimismSepolia } from 'viem/chains';

// Contract addresses are stored in .env after deployment
const ENV_KEYS = {
  keyRegistry: 'KEY_REGISTRY_ADDRESS',
  messageNodeRegistry: 'MESSAGE_NODE_REGISTRY_ADDRESS',
};

interface ContractStatus {
  name: string;
  deployed: boolean;
  address?: Address;
  error?: string;
}

interface ContractsStatus {
  allDeployed: boolean;
  contracts: ContractStatus[];
  network: string;
  chainId: number;
}

export async function getChainConfig(
  network: 'localnet' | 'testnet' | 'mainnet'
) {
  const configs = {
    localnet: {
      chain: hardhat,
      rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? 'http://localhost:8545',
      deployerKey:
        process.env.DEPLOYER_PRIVATE_KEY ??
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    },
    testnet: {
      chain: optimismSepolia,
      rpcUrl: process.env.JEJU_TESTNET_RPC_URL ?? 'https://sepolia.optimism.io',
      deployerKey: process.env.DEPLOYER_PRIVATE_KEY,
    },
    mainnet: {
      chain: optimismSepolia, // TODO: Replace with actual Jeju mainnet
      rpcUrl: process.env.JEJU_MAINNET_RPC_URL ?? '',
      deployerKey: process.env.DEPLOYER_PRIVATE_KEY,
    },
  };

  return configs[network];
}

export async function checkContractDeployed(
  client: PublicClient,
  address: Address | undefined
): Promise<boolean> {
  if (!address) return false;

  const code = await client.getCode({ address }).catch(() => null);
  return code !== null && code !== '0x' && code.length > 2;
}

export async function checkMessagingContracts(
  network: 'localnet' | 'testnet' | 'mainnet' = 'localnet'
): Promise<ContractsStatus> {
  const config = await getChainConfig(network);

  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  // Check chain connection
  let chainId: number;
  try {
    chainId = await client.getChainId();
  } catch {
    return {
      allDeployed: false,
      contracts: [
        {
          name: 'KeyRegistry',
          deployed: false,
          error: 'Cannot connect to chain',
        },
        {
          name: 'MessageNodeRegistry',
          deployed: false,
          error: 'Cannot connect to chain',
        },
      ],
      network,
      chainId: 0,
    };
  }

  const keyRegistryAddress = process.env[ENV_KEYS.keyRegistry] as
    | Address
    | undefined;
  const messageNodeRegistryAddress = process.env[
    ENV_KEYS.messageNodeRegistry
  ] as Address | undefined;

  const contracts: ContractStatus[] = [
    {
      name: 'KeyRegistry',
      deployed: await checkContractDeployed(client, keyRegistryAddress),
      address: keyRegistryAddress,
    },
    {
      name: 'MessageNodeRegistry',
      deployed: await checkContractDeployed(client, messageNodeRegistryAddress),
      address: messageNodeRegistryAddress,
    },
  ];

  return {
    allDeployed: contracts.every((c) => c.deployed),
    contracts,
    network,
    chainId,
  };
}

export async function deployMessagingContracts(
  network: 'localnet' | 'testnet' | 'mainnet' = 'localnet'
): Promise<{ keyRegistry: Address; messageNodeRegistry: Address }> {
  const config = await getChainConfig(network);

  if (!config.deployerKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not set');
  }

  console.log(`[Contracts] Deploying to ${network}...`);

  // Import and deploy contracts using Foundry artifacts
  // This is a simplified version - actual deployment would use forge script
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const contractsDir = new URL('../../../contracts', import.meta.url).pathname;

  // Deploy using forge script
  const rpcFlag =
    network === 'localnet'
      ? '--rpc-url http://localhost:8545'
      : `--rpc-url ${config.rpcUrl}`;
  const broadcastFlag = '--broadcast';
  const privateKeyFlag = `--private-key ${config.deployerKey}`;

  console.log('[Contracts] Running forge deployment script...');

  const deployCmd = `cd ${contractsDir} && forge script script/DeployMessaging.s.sol ${rpcFlag} ${broadcastFlag} ${privateKeyFlag}`;

  const result = await execAsync(deployCmd);
  console.log(result.stdout);

  // Parse deployed addresses from output
  const keyRegistryMatch = result.stdout.match(
    /KeyRegistry deployed at: (0x[a-fA-F0-9]{40})/
  );
  const messageNodeRegistryMatch = result.stdout.match(
    /MessageNodeRegistry deployed at: (0x[a-fA-F0-9]{40})/
  );

  if (!keyRegistryMatch || !messageNodeRegistryMatch) {
    throw new Error('Failed to parse deployed contract addresses');
  }

  const addresses = {
    keyRegistry: keyRegistryMatch[1] as Address,
    messageNodeRegistry: messageNodeRegistryMatch[1] as Address,
  };

  console.log(`[Contracts] KeyRegistry: ${addresses.keyRegistry}`);
  console.log(
    `[Contracts] MessageNodeRegistry: ${addresses.messageNodeRegistry}`
  );

  return addresses;
}

export async function ensureContractsDeployed(
  network: 'localnet' | 'testnet' | 'mainnet' = 'localnet'
): Promise<{ keyRegistry: Address; messageNodeRegistry: Address }> {
  const status = await checkMessagingContracts(network);

  if (status.allDeployed) {
    console.log(`[Contracts] All contracts already deployed on ${network}`);
    return {
      keyRegistry: status.contracts.find((c) => c.name === 'KeyRegistry')!
        .address!,
      messageNodeRegistry: status.contracts.find(
        (c) => c.name === 'MessageNodeRegistry'
      )!.address!,
    };
  }

  console.log(`[Contracts] Missing contracts on ${network}, deploying...`);
  return deployMessagingContracts(network);
}

export function printContractStatus(status: ContractsStatus): void {
  console.log('\n' + '═'.repeat(60));
  console.log(
    `CONTRACT STATUS (${status.network}, chainId: ${status.chainId})`
  );
  console.log('═'.repeat(60));

  for (const contract of status.contracts) {
    const icon = contract.deployed ? '✅' : '❌';
    console.log(
      `${icon} ${contract.name.padEnd(25)} ${contract.deployed ? 'deployed' : 'not deployed'}`
    );
    if (contract.address) {
      console.log(`   └─ ${contract.address}`);
    }
    if (contract.error) {
      console.log(`   └─ Error: ${contract.error}`);
    }
  }

  console.log('═'.repeat(60) + '\n');
}

// CLI entry point
if (import.meta.main) {
  const network = (process.argv[2] ?? 'localnet') as
    | 'localnet'
    | 'testnet'
    | 'mainnet';

  const status = await checkMessagingContracts(network);
  printContractStatus(status);

  if (!status.allDeployed && process.argv.includes('--deploy')) {
    const addresses = await deployMessagingContracts(network);
    console.log('\nDeployed addresses:');
    console.log(`  KEY_REGISTRY_ADDRESS=${addresses.keyRegistry}`);
    console.log(
      `  MESSAGE_NODE_REGISTRY_ADDRESS=${addresses.messageNodeRegistry}`
    );
  }

  process.exit(status.allDeployed ? 0 : 1);
}
