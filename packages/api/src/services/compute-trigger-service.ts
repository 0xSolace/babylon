/**
 * Decentralized trigger execution via Jeju compute marketplace.
 * Supports cron, webhook, and event triggers.
 */

import { logger } from '@babylon/shared';
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  parseAbi,
  stringToHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia, foundry } from 'viem/chains';

export type TriggerType = 'cron' | 'webhook' | 'event';

export interface ComputeTriggerConfig {
  /** Compute marketplace RPC endpoint */
  computeRpcUrl: string;
  /** Trigger registry contract address */
  triggerRegistryAddress: string;
  /** Service identity (ERC-8004) */
  serviceIdentityAddress?: string;
  /** Private key for signing (optional, uses TEE if not provided) */
  privateKey?: string;
}

export interface TriggerDefinition {
  id: string;
  name: string;
  type: TriggerType;
  /** Cron expression for scheduled triggers */
  cronExpression?: string;
  /** Webhook path for HTTP triggers */
  webhookPath?: string;
  /** Event types for event-driven triggers */
  eventTypes?: string[];
  /** Action to execute */
  action: TriggerAction;
  /** Whether trigger is active */
  active: boolean;
}

export interface TriggerAction {
  type:
    | 'game_tick'
    | 'training_job'
    | 'benchmark'
    | 'model_deploy'
    | 'health_check'
    | 'custom';
  /** Endpoint to call */
  endpoint?: string;
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT';
  /** Request payload template */
  payload?: Record<string, unknown>;
  /** Timeout in seconds */
  timeout?: number;
}

export interface TriggerExecution {
  id: string;
  triggerId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: Date;
  finishedAt?: Date;
  output?: Record<string, unknown>;
  error?: string;
  /** Compute node that executed the trigger */
  executorAddress?: string;
}

// ============================================================================
// Compute Trigger Service
// ============================================================================

export class ComputeTriggerService {
  private config: ComputeTriggerConfig;
  private registeredTriggers: Map<string, TriggerDefinition> = new Map();
  private executionHistory: TriggerExecution[] = [];
  private cronJobs: Map<string, NodeJS.Timer> = new Map();

  constructor(config: ComputeTriggerConfig) {
    this.config = config;
  }

  /**
   * Initialize service and load existing triggers
   */
  async initialize(): Promise<void> {
    logger.info('[ComputeTrigger] Initializing service', {
      registryAddress: this.config.triggerRegistryAddress,
    });

    // Load triggers from on-chain registry if available
    await this.loadOnChainTriggers();

    // Start local cron executor
    this.startCronExecutor();

    logger.info('[ComputeTrigger] Service initialized', {
      triggerCount: this.registeredTriggers.size,
    });
  }

  /**
   * Register a new trigger
   */
  async registerTrigger(
    trigger: Omit<TriggerDefinition, 'id'>
  ): Promise<string> {
    const id = `trigger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const definition: TriggerDefinition = {
      ...trigger,
      id,
      active: trigger.active ?? true,
    };

    this.registeredTriggers.set(id, definition);

    // Register on-chain if marketplace is available
    await this.registerOnChain(definition);

    // Start cron job if applicable
    if (
      definition.type === 'cron' &&
      definition.cronExpression &&
      definition.active
    ) {
      this.scheduleCronJob(definition);
    }

    logger.info('[ComputeTrigger] Trigger registered', {
      id,
      name: trigger.name,
      type: trigger.type,
    });

    return id;
  }

  /**
   * Execute a trigger
   */
  async executeTrigger(
    triggerId: string,
    input?: Record<string, unknown>
  ): Promise<TriggerExecution> {
    const trigger = this.registeredTriggers.get(triggerId);
    if (!trigger) {
      throw new Error(`Trigger ${triggerId} not found`);
    }

    if (!trigger.active) {
      throw new Error(`Trigger ${triggerId} is not active`);
    }

    const execution: TriggerExecution = {
      id: `exec-${Date.now()}`,
      triggerId,
      status: 'running',
      startedAt: new Date(),
    };

    this.executionHistory.push(execution);

    try {
      const result = await this.performAction(trigger.action, input);

      execution.status = 'success';
      execution.finishedAt = new Date();
      execution.output = result;

      logger.info('[ComputeTrigger] Trigger executed successfully', {
        triggerId,
        executionId: execution.id,
      });
    } catch (error) {
      execution.status = 'failed';
      execution.finishedAt = new Date();
      execution.error =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('[ComputeTrigger] Trigger execution failed', {
        triggerId,
        executionId: execution.id,
        error: execution.error,
      });
    }

    return execution;
  }

  /**
   * Handle webhook trigger
   */
  async handleWebhook(
    path: string,
    payload: Record<string, unknown>
  ): Promise<TriggerExecution | null> {
    // Find trigger by webhook path
    for (const trigger of this.registeredTriggers.values()) {
      if (
        trigger.type === 'webhook' &&
        trigger.webhookPath === path &&
        trigger.active
      ) {
        return this.executeTrigger(trigger.id, payload);
      }
    }

    logger.warn('[ComputeTrigger] No trigger found for webhook path', { path });
    return null;
  }

  /**
   * Emit event trigger
   */
  async emitEvent(
    eventType: string,
    data: Record<string, unknown>
  ): Promise<TriggerExecution[]> {
    const executions: TriggerExecution[] = [];

    for (const trigger of this.registeredTriggers.values()) {
      if (
        trigger.type === 'event' &&
        trigger.eventTypes?.includes(eventType) &&
        trigger.active
      ) {
        const execution = await this.executeTrigger(trigger.id, {
          eventType,
          ...data,
        });
        executions.push(execution);
      }
    }

    return executions;
  }

  /**
   * Update trigger status
   */
  async updateTrigger(
    triggerId: string,
    updates: Partial<
      Pick<TriggerDefinition, 'active' | 'cronExpression' | 'action'>
    >
  ): Promise<void> {
    const trigger = this.registeredTriggers.get(triggerId);
    if (!trigger) {
      throw new Error(`Trigger ${triggerId} not found`);
    }

    // Update local
    Object.assign(trigger, updates);

    // Update cron job if needed
    if (trigger.type === 'cron') {
      this.clearCronJob(triggerId);
      if (trigger.active && trigger.cronExpression) {
        this.scheduleCronJob(trigger);
      }
    }

    // Update on-chain
    await this.updateOnChain(trigger);
  }

  /**
   * Delete trigger
   */
  async deleteTrigger(triggerId: string): Promise<void> {
    this.clearCronJob(triggerId);
    this.registeredTriggers.delete(triggerId);

    // Delete from on-chain registry
    await this.deleteOnChain(triggerId);
  }

  /**
   * Get trigger by ID
   */
  getTrigger(triggerId: string): TriggerDefinition | undefined {
    return this.registeredTriggers.get(triggerId);
  }

  /**
   * List all triggers
   */
  listTriggers(): TriggerDefinition[] {
    return Array.from(this.registeredTriggers.values());
  }

  /**
   * Get execution history
   */
  getExecutionHistory(triggerId?: string, limit = 50): TriggerExecution[] {
    let history = this.executionHistory;

    if (triggerId) {
      history = history.filter((e) => e.triggerId === triggerId);
    }

    return history.slice(-limit);
  }

  // ============================================================================
  // Babylon-Specific Triggers
  // ============================================================================

  /**
   * Register default Babylon triggers
   */
  async registerBabylonTriggers(): Promise<void> {
    // Game tick - runs every 10 seconds
    await this.registerTrigger({
      name: 'game-tick',
      type: 'cron',
      cronExpression: '*/10 * * * * *',
      action: {
        type: 'game_tick',
        endpoint: '/api/cron/game-tick',
        method: 'POST',
        timeout: 30,
      },
      active: true,
    });

    // Hourly training data extraction
    await this.registerTrigger({
      name: 'training-extract',
      type: 'cron',
      cronExpression: '0 * * * *',
      action: {
        type: 'training_job',
        endpoint: '/api/training/extract',
        method: 'POST',
        payload: { type: 'trajectories' },
        timeout: 300,
      },
      active: true,
    });

    // Daily benchmarking
    await this.registerTrigger({
      name: 'daily-benchmark',
      type: 'cron',
      cronExpression: '0 0 * * *',
      action: {
        type: 'benchmark',
        endpoint: '/api/training/benchmark',
        method: 'POST',
        timeout: 3600,
      },
      active: true,
    });

    // Model deployment webhook
    await this.registerTrigger({
      name: 'model-deploy-webhook',
      type: 'webhook',
      webhookPath: '/api/triggers/model-deploy',
      action: {
        type: 'model_deploy',
        endpoint: '/api/training/deploy',
        method: 'POST',
        timeout: 120,
      },
      active: true,
    });

    // Health check event
    await this.registerTrigger({
      name: 'health-check',
      type: 'cron',
      cronExpression: '*/30 * * * * *',
      action: {
        type: 'health_check',
        endpoint: '/api/health',
        method: 'GET',
        timeout: 10,
      },
      active: true,
    });

    // Model update event trigger
    await this.registerTrigger({
      name: 'model-updated',
      type: 'event',
      eventTypes: ['model:deployed', 'model:benchmarked'],
      action: {
        type: 'custom',
        endpoint: '/api/agents/refresh',
        method: 'POST',
        timeout: 60,
      },
      active: true,
    });

    logger.info('[ComputeTrigger] Babylon triggers registered');
  }

  // ============================================================================
  // Private Methods - Real on-chain integration
  // ============================================================================

  private getChain(): Chain {
    const chainId = parseInt(process.env.CHAIN_ID ?? '31337', 10);
    if (chainId === 31337) return foundry;
    if (chainId === 84532) return baseSepolia;
    if (chainId === 8453) return base;
    return foundry;
  }

  private getPublicClient() {
    return createPublicClient({
      chain: this.getChain(),
      transport: http(this.config.computeRpcUrl),
    });
  }

  private getWalletClient() {
    if (!this.config.privateKey) {
      throw new Error(
        '[ComputeTrigger] Private key required for on-chain registration'
      );
    }

    const account = privateKeyToAccount(this.config.privateKey as Hex);
    return createWalletClient({
      account,
      chain: this.getChain(),
      transport: http(this.config.computeRpcUrl),
    });
  }

  private async loadOnChainTriggers(): Promise<void> {
    if (
      !this.config.triggerRegistryAddress ||
      this.config.triggerRegistryAddress ===
        '0x0000000000000000000000000000000000000000'
    ) {
      logger.debug('[ComputeTrigger] No trigger registry configured');
      return;
    }

    const account = this.config.privateKey
      ? privateKeyToAccount(this.config.privateKey as Hex)
      : null;

    if (!account) {
      logger.debug(
        '[ComputeTrigger] No account configured, skipping on-chain load'
      );
      return;
    }

    const publicClient = this.getPublicClient();

    const abi = parseAbi([
      'function getTriggersByOwner(address owner) view returns ((bytes32 id, uint8 triggerType, string cronExpression, string webhookPath, bytes actionData, bool active)[])',
    ]);

    const triggers = await publicClient.readContract({
      address: this.config.triggerRegistryAddress as Address,
      abi,
      functionName: 'getTriggersByOwner',
      args: [account.address],
    });

    logger.info('[ComputeTrigger] Loaded on-chain triggers', {
      count: triggers.length,
    });

    // Parse and register each trigger
    for (const onchainTrigger of triggers) {
      const trigger = this.parseOnChainTrigger(onchainTrigger);
      if (trigger) {
        this.registeredTriggers.set(trigger.id, trigger);
      }
    }
  }

  private parseOnChainTrigger(onchainTrigger: {
    id: Hex;
    triggerType: number;
    cronExpression: string;
    webhookPath: string;
    actionData: Hex;
    active: boolean;
  }): TriggerDefinition | null {
    const typeMap: Record<number, TriggerType> = {
      0: 'cron',
      1: 'webhook',
      2: 'event',
    };

    const type = typeMap[onchainTrigger.triggerType];
    if (!type) return null;

    return {
      id: onchainTrigger.id,
      name: `on-chain-${onchainTrigger.id.slice(0, 10)}`,
      type,
      cronExpression: onchainTrigger.cronExpression || undefined,
      webhookPath: onchainTrigger.webhookPath || undefined,
      action: {
        type: 'custom',
        payload: { data: onchainTrigger.actionData },
      },
      active: onchainTrigger.active,
    };
  }

  private async registerOnChain(trigger: TriggerDefinition): Promise<void> {
    if (
      !this.config.triggerRegistryAddress ||
      this.config.triggerRegistryAddress ===
        '0x0000000000000000000000000000000000000000'
    ) {
      logger.debug(
        '[ComputeTrigger] No registry configured, skipping on-chain'
      );
      return;
    }

    const walletClient = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const abi = parseAbi([
      'function registerTrigger(bytes32 id, uint8 triggerType, string cronExpression, string webhookPath, bytes actionData) external returns (bool)',
    ]);

    const triggerTypeMap: Record<TriggerType, number> = {
      cron: 0,
      webhook: 1,
      event: 2,
    };

    const triggerId = stringToHex(trigger.id, { size: 32 });
    const actionData = stringToHex(JSON.stringify(trigger.action), {
      size: 256,
    });

    logger.info('[ComputeTrigger] Registering trigger on-chain', {
      id: trigger.id,
      type: trigger.type,
    });

    const hash = await walletClient.writeContract({
      address: this.config.triggerRegistryAddress as Address,
      abi,
      functionName: 'registerTrigger',
      args: [
        triggerId,
        triggerTypeMap[trigger.type],
        trigger.cronExpression ?? '',
        trigger.webhookPath ?? '',
        actionData,
      ],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    logger.info('[ComputeTrigger] Trigger registered on-chain', {
      id: trigger.id,
      txHash: hash,
    });
  }

  private async updateOnChain(trigger: TriggerDefinition): Promise<void> {
    if (
      !this.config.triggerRegistryAddress ||
      this.config.triggerRegistryAddress ===
        '0x0000000000000000000000000000000000000000'
    ) {
      return;
    }

    const walletClient = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const abi = parseAbi([
      'function updateTrigger(bytes32 id, string cronExpression, string webhookPath, bytes actionData, bool active) external returns (bool)',
    ]);

    const triggerId = stringToHex(trigger.id, { size: 32 });
    const actionData = stringToHex(JSON.stringify(trigger.action), {
      size: 256,
    });

    logger.info('[ComputeTrigger] Updating trigger on-chain', {
      id: trigger.id,
    });

    const hash = await walletClient.writeContract({
      address: this.config.triggerRegistryAddress as Address,
      abi,
      functionName: 'updateTrigger',
      args: [
        triggerId,
        trigger.cronExpression ?? '',
        trigger.webhookPath ?? '',
        actionData,
        trigger.active,
      ],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    logger.info('[ComputeTrigger] Trigger updated on-chain', {
      id: trigger.id,
    });
  }

  private async deleteOnChain(triggerId: string): Promise<void> {
    if (
      !this.config.triggerRegistryAddress ||
      this.config.triggerRegistryAddress ===
        '0x0000000000000000000000000000000000000000'
    ) {
      return;
    }

    const walletClient = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const abi = parseAbi([
      'function deleteTrigger(bytes32 id) external returns (bool)',
    ]);

    const triggerIdBytes = stringToHex(triggerId, { size: 32 });

    logger.info('[ComputeTrigger] Deleting trigger on-chain', {
      id: triggerId,
    });

    const hash = await walletClient.writeContract({
      address: this.config.triggerRegistryAddress as Address,
      abi,
      functionName: 'deleteTrigger',
      args: [triggerIdBytes],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    logger.info('[ComputeTrigger] Trigger deleted on-chain', {
      id: triggerId,
    });
  }

  private startCronExecutor(): void {
    // Initialize cron jobs for all active cron triggers
    for (const trigger of this.registeredTriggers.values()) {
      if (trigger.type === 'cron' && trigger.cronExpression && trigger.active) {
        this.scheduleCronJob(trigger);
      }
    }
  }

  private scheduleCronJob(trigger: TriggerDefinition): void {
    if (!trigger.cronExpression) return;

    // Parse cron expression and schedule
    // Using setInterval for simplicity - in production use node-cron or similar
    const interval = this.parseCronInterval(trigger.cronExpression);

    const job = setInterval(async () => {
      await this.executeTrigger(trigger.id);
    }, interval);

    this.cronJobs.set(trigger.id, job);

    logger.debug('[ComputeTrigger] Cron job scheduled', {
      triggerId: trigger.id,
      interval,
    });
  }

  private clearCronJob(triggerId: string): void {
    const job = this.cronJobs.get(triggerId);
    if (job) {
      clearInterval(job);
      this.cronJobs.delete(triggerId);
    }
  }

  private parseCronInterval(expression: string): number {
    // Simplified cron parsing - returns interval in ms
    // Format: */N - every N units
    const parts = expression.split(' ');

    // Handle */N format for first position (seconds/minutes)
    const first = parts[0];
    if (first?.startsWith('*/')) {
      const n = parseInt(first.slice(2), 10);
      // Assuming first position is seconds
      return n * 1000;
    }

    // Default to 60 seconds
    return 60000;
  }

  private async performAction(
    action: TriggerAction,
    input?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const { endpoint, method = 'POST', payload, timeout = 30 } = action;

    if (!endpoint) {
      throw new Error('Action endpoint is required');
    }

    // Determine base URL from environment or use relative
    const baseUrl =
      process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Trigger-Source': 'compute-marketplace',
        'X-Cron-Secret': process.env.CRON_SECRET ?? '',
      },
      body:
        method !== 'GET' ? JSON.stringify({ ...payload, ...input }) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const errorMessage =
        typeof data.error === 'string' ? data.error : response.statusText;
      throw new Error(`HTTP ${response.status}: ${errorMessage}`);
    }

    return data;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    // Clear all cron jobs
    for (const [triggerId] of this.cronJobs) {
      this.clearCronJob(triggerId);
    }

    logger.info('[ComputeTrigger] Service shutdown complete');
  }
}

// ============================================================================
// Factory
// ============================================================================

let triggerService: ComputeTriggerService | null = null;

export function getComputeTriggerService(): ComputeTriggerService {
  if (!triggerService) {
    triggerService = new ComputeTriggerService({
      computeRpcUrl:
        process.env.COMPUTE_RPC_URL ??
        process.env.JEJU_RPC_URL ??
        'http://localhost:9545',
      triggerRegistryAddress: process.env.TRIGGER_REGISTRY_ADDRESS ?? '0x0',
      serviceIdentityAddress: process.env.SERVICE_IDENTITY_ADDRESS,
    });
  }
  return triggerService;
}

export async function initializeComputeTriggers(): Promise<void> {
  const service = getComputeTriggerService();
  await service.initialize();
  await service.registerBabylonTriggers();
}
