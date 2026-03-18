#!/usr/bin/env bun

type Step = 'status' | 'wallet' | 'prepare' | 'send';

type CliOptions = {
  agentId: string;
  ownerUserId?: string;
  step: Step;
  executeSend: boolean;
  caip2?: string;
  json: boolean;
};

type AgentDebugRecord = {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  isAgent: boolean;
  managedBy: string | null;
  privyId: string | null;
  privySolanaWalletId: string | null;
  solanaWalletAddress: string | null;
  solanaOfflineWalletReady: boolean;
  solanaRegistered: boolean;
  solanaRegistryAssetId: string | null;
  solanaMetadataUri: string | null;
  solanaRegistrationTxHash: string | null;
};

function printUsage(): void {
  console.log(`
Debug Babylon agent Solana registration without deploying or running the app

Usage:
  bun run scripts/debug-solana-agent-registration.ts --agent-id <id> [options]

Options:
  --agent-id <value>        Agent user ID to inspect
  --owner-user-id <value>   Optional expected manager user ID
  --step <status|wallet|prepare|send>
                            How far to run the flow (default: prepare)
  --execute-send            Required together with --step send to actually send
                            the sponsored transaction on-chain
  --caip2 <value>           Override the Solana caip2 used for the sponsored
                            send step (default follows env cluster mapping)
  --json                    Output JSON only
  -h, --help                Show this help

Examples:
  bun run scripts/debug-solana-agent-registration.ts \\
    --agent-id 291871578944176128

  bun run scripts/debug-solana-agent-registration.ts \\
    --agent-id 291871578944176128 \\
    --owner-user-id did:privy:owner \\
    --step send \\
    --execute-send
`);
}

function readArgValue(args: string[], name: string): string | undefined {
  const index = args.findIndex((arg) => arg === name);
  if (index === -1) return undefined;
  const value = args[index + 1];

  if (!value) {
    throw new Error(`Missing value after ${name}`);
  }

  return value.trim();
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function parseStep(raw: string | undefined): Step {
  if (!raw) return 'prepare';

  if (
    raw === 'status' ||
    raw === 'wallet' ||
    raw === 'prepare' ||
    raw === 'send'
  ) {
    return raw;
  }

  throw new Error(
    `Invalid --step value "${raw}". Expected status, wallet, prepare, or send.`
  );
}

function parseOptions(): CliOptions {
  const args = process.argv.slice(2);

  if (hasFlag(args, '-h') || hasFlag(args, '--help')) {
    printUsage();
    process.exit(0);
  }

  const agentId = readArgValue(args, '--agent-id');
  const ownerUserId = readArgValue(args, '--owner-user-id');
  const step = parseStep(readArgValue(args, '--step'));
  const executeSend = hasFlag(args, '--execute-send');
  const caip2 = readArgValue(args, '--caip2');
  const json = hasFlag(args, '--json');

  if (!agentId) {
    throw new Error('Missing required --agent-id');
  }

  if (step === 'send' && !executeSend) {
    throw new Error(
      'Refusing to run the on-chain send step without --execute-send'
    );
  }

  return {
    agentId,
    ...(ownerUserId ? { ownerUserId } : {}),
    step,
    executeSend,
    ...(caip2 ? { caip2 } : {}),
    json,
  };
}

function resolveSolanaCaip2(): string {
  const cluster = process.env.SOLANA_REGISTRY_CLUSTER ?? 'mainnet-beta';

  switch (cluster) {
    case 'devnet':
      return 'solana:devnet';
    case 'testnet':
      return 'solana:testnet';
    case 'localnet':
      return 'solana:localnet';
    case 'mainnet-beta':
    default:
      return 'solana:mainnet';
  }
}

async function getAgentRecord(
  agentId: string,
  deps: {
    db: typeof import('@babylon/db').db;
    eq: typeof import('@babylon/db').eq;
    users: typeof import('@babylon/db').users;
  }
): Promise<AgentDebugRecord> {
  const [agent] = await deps.db
    .select({
      id: deps.users.id,
      username: deps.users.username,
      displayName: deps.users.displayName,
      bio: deps.users.bio,
      profileImageUrl: deps.users.profileImageUrl,
      isAgent: deps.users.isAgent,
      managedBy: deps.users.managedBy,
      privyId: deps.users.privyId,
      privySolanaWalletId: deps.users.privySolanaWalletId,
      solanaWalletAddress: deps.users.solanaWalletAddress,
      solanaOfflineWalletReady: deps.users.solanaOfflineWalletReady,
      solanaRegistered: deps.users.solanaRegistered,
      solanaRegistryAssetId: deps.users.solanaRegistryAssetId,
      solanaMetadataUri: deps.users.solanaMetadataUri,
      solanaRegistrationTxHash: deps.users.solanaRegistrationTxHash,
    })
    .from(deps.users)
    .where(deps.eq(deps.users.id, agentId))
    .limit(1);

  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  if (!agent.isAgent) {
    throw new Error(`User ${agentId} exists but is not marked as an agent`);
  }

  return agent;
}

function printResult(result: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.dir(result, { depth: null, colors: true });
}

async function main() {
  const options = parseOptions();
  const [{ db, eq, users }, shared, registry, errorDiagnostics, offlineConfig, privyNode, solanaIdempotency, solanaWalletProvisioning] =
    await Promise.all([
      import('@babylon/db'),
      import('@babylon/shared'),
      import('@babylon/agents/solana-registry'),
      import('../packages/api/src/services/privy/error-diagnostics'),
      import('../packages/api/src/services/privy/offline-config'),
      import('../packages/api/src/services/privy/privy-node'),
      import('../packages/api/src/services/privy/solana-idempotency'),
      import('../packages/api/src/services/privy/solana-wallet-provisioning'),
    ]);

  registry.assertSolanaRegistryConfigured();

  const agent = await getAgentRecord(options.agentId, { db, eq, users });
  const deterministicAssetId =
    registry.deriveDeterministicAgentSolanaAsset(
      options.agentId
    ).publicKey.toBase58();

  if (options.ownerUserId && agent.managedBy !== options.ownerUserId) {
    throw new Error(
      `Ownership mismatch: agent.managedBy=${agent.managedBy ?? 'null'} expected ${options.ownerUserId}`
    );
  }

  let existingOnchain: unknown = null;
  try {
    existingOnchain = await registry.getAgentSolanaRegistration(
      deterministicAssetId
    );
  } catch (error) {
    existingOnchain = {
      lookupError: error instanceof Error ? error.message : String(error),
    };
  }

  const result: Record<string, unknown> = {
    env: {
      appUrl: shared.getBaseUrl(),
      mcpEndpoint: shared.getMCPEndpoint(),
      solanaRegistryEnabled: process.env.SOLANA_REGISTRY_ENABLED,
      solanaRegistryCluster: process.env.SOLANA_REGISTRY_CLUSTER,
      solanaRegistryRpcUrl: process.env.SOLANA_REGISTRY_RPC_URL,
      resolvedCaip2: options.caip2 ?? resolveSolanaCaip2(),
    },
    agent: {
      id: agent.id,
      username: agent.username,
      displayName: agent.displayName,
      managedBy: agent.managedBy,
      privyId: agent.privyId,
      privySolanaWalletId: agent.privySolanaWalletId,
      solanaWalletAddress: agent.solanaWalletAddress,
      solanaOfflineWalletReady: agent.solanaOfflineWalletReady,
      solanaRegistered: agent.solanaRegistered,
      solanaRegistryAssetId: agent.solanaRegistryAssetId,
      solanaMetadataUri: agent.solanaMetadataUri,
      solanaRegistrationTxHash: agent.solanaRegistrationTxHash,
    },
    deterministicAssetId,
    existingOnchain,
  };

  if (options.step === 'status') {
    printResult(result, options.json);
    return;
  }

  if (!agent.privyId) {
    throw new Error('Agent privyId is missing; cannot continue Solana debug');
  }

  const wallet = await solanaWalletProvisioning.ensureSolanaWalletReady({
    privyId: agent.privyId,
  });
  result.wallet = wallet;

  if (options.step === 'wallet') {
    printResult(result, options.json);
    return;
  }

  const registrationFile = registry.buildAgentSolanaRegistrationFile({
    name: agent.displayName || agent.username || options.agentId,
    description:
      agent.bio || `Autonomous AI agent: ${agent.username || options.agentId}`,
    image: agent.profileImageUrl,
    walletAddress: wallet.walletAddress,
    a2aEndpoint: `${shared.getBaseUrl()}/api/agents/${options.agentId}/a2a`,
    mcpEndpoint: shared.getMCPEndpoint(),
    metadata: {
      platform: 'babylon',
      userType: 'agent',
      managerUserId: agent.managedBy,
      network: 'solana',
    },
    skills: [],
    domains: [],
  });

  result.registrationFile = registrationFile;

  const prepared = await registry.prepareAgentSolanaRegistrationTransaction({
    agentUserId: options.agentId,
    ownerWalletAddress: wallet.walletAddress,
    registrationFile,
  });

  result.prepared = {
    assetId: prepared.assetId,
    metadataUri: prepared.metadataUri,
    metadataCid: prepared.metadataCid,
    transactionBase64Length: prepared.transaction.length,
  };
  result.derivedIdempotencyKey =
    solanaIdempotency.buildSponsoredSolanaTransactionIdempotencyKey({
      walletId: wallet.privyWalletId,
      transaction: prepared.transaction,
      caip2: options.caip2 ?? resolveSolanaCaip2(),
    });

  if (options.step === 'prepare') {
    printResult(result, options.json);
    return;
  }

  const privy = privyNode.getPrivyNodeClient();
  const offline = offlineConfig.getPrivyOfflineConfig();

  try {
    const response = await privy.wallets().solana().signAndSendTransaction(
      wallet.privyWalletId,
      {
        caip2: options.caip2 ?? resolveSolanaCaip2(),
        transaction: prepared.transaction,
        sponsor: true,
        authorization_context: {
          authorization_private_keys: [offline.authorizationPrivateKey],
        },
        idempotency_key: result.derivedIdempotencyKey as string,
      }
    );

    result.send = {
      ok: true,
      hash: response.hash,
      transactionId: response.transaction_id,
      caip2: response.caip2,
    };
  } catch (error) {
    result.send = {
      ok: false,
      ...errorDiagnostics.extractPrivyApiDiagnostics(error),
    };
  }

  printResult(result, options.json);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to debug Solana agent registration: ${message}`);
  process.exit(1);
});
