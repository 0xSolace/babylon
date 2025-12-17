/**
 * Integration Validation Checklist
 *
 * Comprehensive validation of Babylon's integration with all services.
 * Each validation question is a test that can pass or fail.
 */

import { db } from '@babylon/db';
import { type Address, createPublicClient, http } from 'viem';
import { hardhat, optimismSepolia } from 'viem/chains';

export interface ValidationResult {
  category: string;
  question: string;
  passed: boolean;
  details?: string;
  error?: string;
  duration: number;
}

export interface ValidationReport {
  timestamp: number;
  network: 'localnet' | 'testnet';
  totalQuestions: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
}

type ValidatorFn = () => Promise<{ passed: boolean; details?: string }>;

interface ValidationQuestion {
  category: string;
  question: string;
  validator: ValidatorFn;
}

// ============================================================
// CATEGORY 1: Local Development
// ============================================================

const localDevValidations: ValidationQuestion[] = [
  {
    category: 'Local Development',
    question: 'Can the local Jeju chain (Hardhat) be reached?',
    validator: async () => {
      const response = await fetch('http://localhost:8545', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
      });
      const data = (await response.json()) as { result?: string };
      return {
        passed: response.ok && data.result === '0x7a69', // 31337 in hex
        details: `Chain ID: ${data.result}`,
      };
    },
  },
  {
    category: 'Local Development',
    question: 'Is PostgreSQL running and accessible?',
    validator: async () => {
      const result = await db.$queryRaw`SELECT 1 as check`;
      return {
        passed: Array.isArray(result) && result.length > 0,
        details: 'Database query successful',
      };
    },
  },
  {
    category: 'Local Development',
    question: 'Is decentralized cache running and accessible?',
    validator: async () => {
      const { isCacheServiceReachable } = await import('@babylon/api/cache');
      const reachable = await isCacheServiceReachable();
      return {
        passed: reachable,
        details: reachable
          ? 'Jeju Cache service accessible'
          : 'Cache service not reachable - ensure JEJU_CACHE_SERVICE_URL is set',
      };
    },
  },
  {
    category: 'Local Development',
    question: 'Are NPCs seeded in the database?',
    validator: async () => {
      const npcs = await db.actor.findMany({
        where: { type: 'NPC' },
        select: { id: true, name: true },
      });
      return {
        passed: npcs.length > 0,
        details: `Found ${npcs.length} NPCs`,
      };
    },
  },
];

// ============================================================
// CATEGORY 2: Contract Integration
// ============================================================

const contractValidations: ValidationQuestion[] = [
  {
    category: 'Contract Integration',
    question: 'Is KeyRegistry contract deployed?',
    validator: async () => {
      const address = process.env.KEY_REGISTRY_ADDRESS as Address | undefined;
      if (!address) {
        return { passed: false, details: 'KEY_REGISTRY_ADDRESS not set' };
      }

      const client = createPublicClient({
        chain: hardhat,
        transport: http(
          process.env.NEXT_PUBLIC_RPC_URL ?? 'http://localhost:8545'
        ),
      });

      const code = await client.getCode({ address });
      return {
        passed: code !== undefined && code !== '0x' && code.length > 2,
        details: `Address: ${address}`,
      };
    },
  },
  {
    category: 'Contract Integration',
    question: 'Is MessageNodeRegistry contract deployed?',
    validator: async () => {
      const address = process.env.MESSAGE_NODE_REGISTRY_ADDRESS as
        | Address
        | undefined;
      if (!address) {
        return {
          passed: false,
          details: 'MESSAGE_NODE_REGISTRY_ADDRESS not set',
        };
      }

      const client = createPublicClient({
        chain: hardhat,
        transport: http(
          process.env.NEXT_PUBLIC_RPC_URL ?? 'http://localhost:8545'
        ),
      });

      const code = await client.getCode({ address });
      return {
        passed: code !== undefined && code !== '0x' && code.length > 2,
        details: `Address: ${address}`,
      };
    },
  },
];

// ============================================================
// CATEGORY 3: CovenantSQL Integration
// ============================================================

const cqlValidations: ValidationQuestion[] = [
  {
    category: 'CovenantSQL Integration',
    question: 'Is CQL Block Producer healthy?',
    validator: async () => {
      const endpoint =
        process.env.CQL_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:8546';
      const response = await fetch(`${endpoint}/v1/health`);
      return {
        passed: response.ok,
        details: `Endpoint: ${endpoint}`,
      };
    },
  },
  {
    category: 'CovenantSQL Integration',
    question: 'Can messages be written and read from CQL?',
    validator: async () => {
      const endpoint =
        process.env.CQL_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:8546';
      const testId = `test-${Date.now()}`;

      // Write test message
      const writeResponse = await fetch(`${endpoint}/v1/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: process.env.CQL_DATABASE_ID ?? 'babylon-messaging',
          query: `INSERT INTO messages (id, content, created_at) VALUES ('${testId}', 'validation-test', ${Date.now()})`,
        }),
      });

      if (!writeResponse.ok) {
        return { passed: false, details: 'Failed to write test message' };
      }

      // Read test message
      const readResponse = await fetch(`${endpoint}/v1/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: process.env.CQL_DATABASE_ID ?? 'babylon-messaging',
          query: `SELECT * FROM messages WHERE id = '${testId}'`,
        }),
      });

      if (!readResponse.ok) {
        return { passed: false, details: 'Failed to read test message' };
      }

      const data = (await readResponse.json()) as { rows?: unknown[] };

      // Cleanup
      await fetch(`${endpoint}/v1/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: process.env.CQL_DATABASE_ID ?? 'babylon-messaging',
          query: `DELETE FROM messages WHERE id = '${testId}'`,
        }),
      });

      return {
        passed: data.rows && data.rows.length > 0,
        details: 'Write/read cycle successful',
      };
    },
  },
];

// ============================================================
// CATEGORY 4: KMS Integration
// ============================================================

const kmsValidations: ValidationQuestion[] = [
  {
    category: 'KMS Integration',
    question: 'Is Jeju KMS service healthy?',
    validator: async () => {
      const endpoint = process.env.KMS_ENDPOINT ?? 'http://localhost:3300';
      const response = await fetch(`${endpoint}/health`);
      const data = (await response.json()) as { status?: string };
      return {
        passed: response.ok && data.status === 'healthy',
        details: `Endpoint: ${endpoint}`,
      };
    },
  },
  {
    category: 'KMS Integration',
    question: 'Can encryption keys be generated?',
    validator: async () => {
      const endpoint = process.env.KMS_ENDPOINT ?? 'http://localhost:3300';
      const response = await fetch(`${endpoint}/keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'encryption',
          curve: 'x25519',
          owner: '0x0000000000000000000000000000000000000000',
        }),
      });

      const data = (await response.json()) as {
        publicKey?: string;
        metadata?: { id?: string };
      };
      return {
        passed:
          response.ok && Boolean(data.publicKey) && Boolean(data.metadata?.id),
        details: `Key ID: ${data.metadata?.id}`,
      };
    },
  },
  {
    category: 'KMS Integration',
    question: 'Can signing keys be generated and used?',
    validator: async () => {
      const endpoint = process.env.KMS_ENDPOINT ?? 'http://localhost:3300';

      // Generate key
      const genResponse = await fetch(`${endpoint}/keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'signing',
          curve: 'ed25519',
          owner: '0x0000000000000000000000000000000000000000',
        }),
      });

      const genData = (await genResponse.json()) as {
        metadata?: { id?: string };
      };
      if (!genResponse.ok || !genData.metadata?.id) {
        return { passed: false, details: 'Failed to generate signing key' };
      }

      // Sign test message
      const signResponse = await fetch(`${endpoint}/keys/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: genData.metadata.id,
          message: '0x' + Buffer.from('test message').toString('hex'),
        }),
      });

      const signData = (await signResponse.json()) as { signature?: string };
      return {
        passed: signResponse.ok && Boolean(signData.signature),
        details: `Signed with key ${genData.metadata.id}`,
      };
    },
  },
];

// ============================================================
// CATEGORY 5: Messaging Relay
// ============================================================

const relayValidations: ValidationQuestion[] = [
  {
    category: 'Messaging Relay',
    question: 'Is Messaging Relay service healthy?',
    validator: async () => {
      const endpoint = process.env.RELAY_ENDPOINT ?? 'http://localhost:3200';
      const response = await fetch(`${endpoint}/health`);
      const data = (await response.json()) as { status?: string };
      return {
        passed: response.ok && data.status === 'healthy',
        details: `Endpoint: ${endpoint}`,
      };
    },
  },
  {
    category: 'Messaging Relay',
    question: 'Can messages be sent through the relay?',
    validator: async () => {
      const endpoint = process.env.RELAY_ENDPOINT ?? 'http://localhost:3200';
      const response = await fetch(`${endpoint}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: '0x0000000000000000000000000000000000000001',
          recipient: '0x0000000000000000000000000000000000000002',
          encryptedContent: Buffer.from('test-validation-message').toString(
            'base64'
          ),
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        messageId?: string;
      };
      return {
        passed: response.ok && data.success === true && Boolean(data.messageId),
        details: `Message ID: ${data.messageId}`,
      };
    },
  },
];

// ============================================================
// CATEGORY 6: Testnet (only run with --testnet flag)
// ============================================================

const testnetValidations: ValidationQuestion[] = [
  {
    category: 'Testnet Deployment',
    question: 'Can connect to Jeju testnet?',
    validator: async () => {
      const rpcUrl =
        process.env.JEJU_TESTNET_RPC_URL ?? 'https://sepolia.optimism.io';
      const client = createPublicClient({
        chain: optimismSepolia,
        transport: http(rpcUrl),
      });

      const chainId = await client.getChainId();
      return {
        passed: chainId === optimismSepolia.id,
        details: `Chain ID: ${chainId}`,
      };
    },
  },
  {
    category: 'Testnet Deployment',
    question: 'Are messaging contracts deployed on testnet?',
    validator: async () => {
      const keyRegistryAddress = process.env.TESTNET_KEY_REGISTRY_ADDRESS as
        | Address
        | undefined;
      const messageNodeRegistryAddress = process.env
        .TESTNET_MESSAGE_NODE_REGISTRY_ADDRESS as Address | undefined;

      if (!keyRegistryAddress || !messageNodeRegistryAddress) {
        return { passed: false, details: 'Testnet contract addresses not set' };
      }

      const client = createPublicClient({
        chain: optimismSepolia,
        transport: http(
          process.env.JEJU_TESTNET_RPC_URL ?? 'https://sepolia.optimism.io'
        ),
      });

      const keyRegistryCode = await client.getCode({
        address: keyRegistryAddress,
      });
      const messageNodeCode = await client.getCode({
        address: messageNodeRegistryAddress,
      });

      const keyRegistryDeployed =
        keyRegistryCode !== undefined && keyRegistryCode !== '0x';
      const messageNodeDeployed =
        messageNodeCode !== undefined && messageNodeCode !== '0x';

      return {
        passed: keyRegistryDeployed && messageNodeDeployed,
        details: `KeyRegistry: ${keyRegistryDeployed}, MessageNodeRegistry: ${messageNodeDeployed}`,
      };
    },
  },
  {
    category: 'Testnet Deployment',
    question: 'Is testnet CQL cluster healthy?',
    validator: async () => {
      const endpoint = process.env.TESTNET_CQL_ENDPOINT;
      if (!endpoint) {
        return { passed: false, details: 'TESTNET_CQL_ENDPOINT not set' };
      }

      const response = await fetch(`${endpoint}/v1/health`);
      return {
        passed: response.ok,
        details: `Endpoint: ${endpoint}`,
      };
    },
  },
];

// ============================================================
// Validation Runner
// ============================================================

async function runValidation(
  question: ValidationQuestion
): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    const result = await question.validator();
    return {
      category: question.category,
      question: question.question,
      passed: result.passed,
      details: result.details,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      category: question.category,
      question: question.question,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

export async function runValidationSuite(
  options: { includeTestnet?: boolean } = {}
): Promise<ValidationReport> {
  const questions = [
    ...localDevValidations,
    ...contractValidations,
    ...cqlValidations,
    ...kmsValidations,
    ...relayValidations,
  ];

  if (options.includeTestnet) {
    questions.push(...testnetValidations);
  }

  const results: ValidationResult[] = [];

  for (const question of questions) {
    console.log(`  Checking: ${question.question}`);
    const result = await runValidation(question);
    results.push(result);

    const icon = result.passed ? '✅' : '❌';
    console.log(
      `  ${icon} ${result.passed ? 'PASS' : 'FAIL'}${result.details ? ` - ${result.details}` : ''}${result.error ? ` - Error: ${result.error}` : ''}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    timestamp: Date.now(),
    network: options.includeTestnet ? 'testnet' : 'localnet',
    totalQuestions: results.length,
    passed,
    failed,
    results,
  };
}

export function printValidationReport(report: ValidationReport): void {
  console.log('\n' + '═'.repeat(70));
  console.log('BABYLON INTEGRATION VALIDATION REPORT');
  console.log('═'.repeat(70));
  console.log(`Network: ${report.network}`);
  console.log(`Timestamp: ${new Date(report.timestamp).toISOString()}`);
  console.log(
    `Results: ${report.passed}/${report.totalQuestions} passed (${report.failed} failed)`
  );
  console.log('');

  // Group by category
  const categories = new Map<string, ValidationResult[]>();
  for (const result of report.results) {
    if (!categories.has(result.category)) {
      categories.set(result.category, []);
    }
    categories.get(result.category)!.push(result);
  }

  for (const [category, results] of categories) {
    const categoryPassed = results.filter((r) => r.passed).length;
    console.log(`\n${category} (${categoryPassed}/${results.length})`);
    console.log('─'.repeat(70));

    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.question}`);
      if (result.details) {
        console.log(`   └─ ${result.details}`);
      }
      if (result.error) {
        console.log(`   └─ Error: ${result.error}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(70));

  if (report.failed === 0) {
    console.log('✅ ALL VALIDATIONS PASSED');
  } else {
    console.log(`❌ ${report.failed} VALIDATION(S) FAILED`);
  }

  console.log('═'.repeat(70) + '\n');
}

// CLI entry point
if (import.meta.main) {
  const includeTestnet = process.argv.includes('--testnet');

  console.log('\nRunning Babylon Integration Validation...\n');

  const report = await runValidationSuite({ includeTestnet });
  printValidationReport(report);

  process.exit(report.failed === 0 ? 0 : 1);
}
