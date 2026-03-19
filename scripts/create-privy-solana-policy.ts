import { PrivyClient } from '@privy-io/node';

type CliOptions = {
  appId: string;
  appSecret: string;
  namePrefix?: string;
  policyId?: string;
  authorizationPrivateKey?: string;
  ownerId?: string;
  allowSignTransaction: boolean;
  json: boolean;
};

function printUsage(): void {
  console.log(`
Create or update a Privy Solana policy for Babylon agent registrations

Usage:
  bun run scripts/create-privy-solana-policy.ts [options]

Options:
  --app-id <value>             Privy app ID (fallback: PRIVY_APP_ID or NEXT_PUBLIC_PRIVY_APP_ID)
  --app-secret <value>         Privy app secret (fallback: PRIVY_APP_SECRET)
  --name-prefix <value>        Prefix for the created policy name
                               (default: babylon-solana-registration)
  --policy-id <value>          Update an existing policy instead of creating one
  --authorization-key <value>  Authorization private key used to update a policy
                               (fallback: PRIVY_AUTHORIZATION_PRIVATE_KEY)
  --owner-id <value>           Optional key quorum owner ID
                               (fallback: PRIVY_OFFLINE_SIGNER_ID)
  --sign-and-send-only         Only allow signAndSendTransaction
  --json                       Output machine-readable JSON only
  -h, --help                   Show this help

What this does:
  - A Solana-only Privy policy
  - Default scope: ALLOW signAndSendTransaction and signTransaction,
    default-deny everything else

Recommended next step:
  - Set PRIVY_SOLANA_OFFLINE_POLICY_ID to the returned policy ID
`);
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

function timestampTag(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseOptions(): CliOptions {
  const args = process.argv.slice(2);

  if (hasFlag(args, '-h') || hasFlag(args, '--help')) {
    printUsage();
    process.exit(0);
  }

  const appId =
    readArgValue(args, '--app-id') ??
    readEnv('PRIVY_APP_ID') ??
    readEnv('NEXT_PUBLIC_PRIVY_APP_ID');
  const appSecret =
    readArgValue(args, '--app-secret') ?? readEnv('PRIVY_APP_SECRET');
  const namePrefix = readArgValue(args, '--name-prefix');
  const policyId = readArgValue(args, '--policy-id');
  const authorizationPrivateKey =
    readArgValue(args, '--authorization-key') ??
    readEnv('PRIVY_AUTHORIZATION_PRIVATE_KEY');
  const ownerId =
    readArgValue(args, '--owner-id') ?? readEnv('PRIVY_OFFLINE_SIGNER_ID');
  const allowSignTransaction = !hasFlag(args, '--sign-and-send-only');
  const json = hasFlag(args, '--json');

  const missing: string[] = [];
  if (!appId) missing.push('app ID (--app-id or PRIVY_APP_ID)');
  if (!appSecret) {
    missing.push('app secret (--app-secret or PRIVY_APP_SECRET)');
  }
  if (policyId && !authorizationPrivateKey) {
    missing.push(
      'authorization key (--authorization-key or PRIVY_AUTHORIZATION_PRIVATE_KEY) required for --policy-id updates'
    );
  }

  if (missing.length > 0) {
    throw new Error(`Missing required inputs: ${missing.join(', ')}`);
  }

  return {
    appId: appId!,
    appSecret: appSecret!,
    ...(namePrefix ? { namePrefix } : {}),
    ...(policyId ? { policyId } : {}),
    ...(authorizationPrivateKey ? { authorizationPrivateKey } : {}),
    ...(ownerId ? { ownerId } : {}),
    allowSignTransaction,
    json,
  };
}

async function main() {
  const options = parseOptions();
  const privy = new PrivyClient({
    appId: options.appId,
    appSecret: options.appSecret,
  });

  const alwaysAllowCondition = {
    field: 'current_unix_timestamp' as const,
    field_source: 'system' as const,
    operator: 'gte' as const,
    value: '0',
  };

  const rules: Array<{
    name: string;
    method: 'signAndSendTransaction' | 'signTransaction';
    conditions: [typeof alwaysAllowCondition];
    action: 'ALLOW';
  }> = [
    {
      name: 'Allow Solana send tx',
      method: 'signAndSendTransaction',
      conditions: [alwaysAllowCondition],
      action: 'ALLOW',
    },
  ];

  if (options.allowSignTransaction) {
    rules.push({
      name: 'Allow Solana sign tx',
      method: 'signTransaction',
      conditions: [alwaysAllowCondition],
      action: 'ALLOW',
    });
  }

  const policy = options.policyId
    ? await privy.policies().update(options.policyId, {
        ...(options.namePrefix
          ? { name: `${options.namePrefix}-${timestampTag()}`.slice(0, 49) }
          : {}),
        ...(options.ownerId ? { owner_id: options.ownerId } : {}),
        rules,
        authorization_context: {
          authorization_private_keys: [options.authorizationPrivateKey!],
        },
      })
    : await privy.policies().create({
        version: '1.0',
        name: `${options.namePrefix ?? 'babylon-solana-registration'}-${timestampTag()}`.slice(
          0,
          49
        ),
        chain_type: 'solana',
        ...(options.ownerId ? { owner_id: options.ownerId } : {}),
        rules,
      });

  const result = {
    action: options.policyId ? 'updated' : 'created',
    appId: options.appId,
    policyId: policy.id,
    chainType: policy.chain_type,
    ownerId: policy.owner_id,
    methods: rules.map((rule) => rule.method),
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Privy Solana policy ${result.action} successfully.\n`);
  console.log(`Policy ID: ${result.policyId}`);
  console.log(`Chain type: ${result.chainType}`);
  console.log(`Methods: ${result.methods.join(', ')}`);
  console.log(`Owner ID: ${result.ownerId ?? 'none'}\n`);
  console.log('Set this env var in the target environment:\n');
  console.log(`PRIVY_SOLANA_OFFLINE_POLICY_ID=${result.policyId}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to create Privy Solana policy: ${message}`);
  process.exit(1);
});
