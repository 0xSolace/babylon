/**
 * ERC-8004 on-chain service registration for decentralized discovery via JNS/ENS.
 */

import { logger, safeReadContract, safeWriteContract } from '@babylon/shared'
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  parseAbi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia, foundry } from 'viem/chains'

export interface ServiceRegistration {
  /** Unique service identifier */
  serviceId: string
  /** Human-readable name */
  name: string
  /** Service description */
  description: string
  /** Service type */
  type: ServiceType
  /** Primary endpoint URL */
  endpoint: string
  /** A2A endpoint (if available) */
  a2aEndpoint?: string
  /** MCP endpoint (if available) */
  mcpEndpoint?: string
  /** Agent card URL */
  agentCardUrl?: string
  /** On-chain address (if applicable) */
  contractAddress?: Address
  /** JNS/ENS name */
  ensName?: string
  /** Service version */
  version: string
  /** Capabilities */
  capabilities: ServiceCapability[]
  /** Pricing information */
  pricing?: ServicePricing
  /** Service status */
  status: 'active' | 'maintenance' | 'deprecated'
}

export type ServiceType =
  | 'game_engine'
  | 'training_pipeline'
  | 'inference_api'
  | 'storage'
  | 'frontend'
  | 'cron_orchestrator'

export type ServiceCapability =
  | 'prediction_markets'
  | 'perpetuals'
  | 'agent_runtime'
  | 'model_training'
  | 'model_inference'
  | 'benchmarking'
  | 'storage_ipfs'
  | 'storage_arweave'
  | 'a2a_protocol'
  | 'mcp_protocol'
  | 'x402_payments'

export interface ServicePricing {
  /** Currency (ETH, USDC, etc.) */
  currency: string
  /** Price per request (in wei or smallest unit) */
  pricePerRequest?: bigint
  /** Price per compute hour */
  pricePerHour?: bigint
  /** Free tier included */
  freeTier?: {
    requestsPerDay: number
    computeMinutesPerDay: number
  }
}

export interface RegistrationConfig {
  /** RPC URL for blockchain */
  rpcUrl: string
  /** Identity registry contract */
  identityRegistryAddress: Address
  /** JNS registry contract (optional) */
  jnsRegistryAddress?: Address
  /** Private key for registration (optional, uses TEE if not provided) */
  privateKey?: string
}

// ============================================================================
// Agent Card Generator
// ============================================================================

interface AgentCardSkill {
  id: string
  name: string
  description: string
  input_schema?: Record<string, unknown>
}

export interface AgentCard {
  name: string
  description: string
  version: string
  homepage?: string
  documentation?: string
  skills: AgentCardSkill[]
  default_input_modes: string[]
  default_output_modes: string[]
  endpoints?: {
    a2a?: string
    mcp?: string
    openapi?: string
  }
  capabilities?: string[]
}

export function generateBabylonAgentCard(baseUrl: string): AgentCard {
  return {
    name: 'Babylon Game Engine',
    description:
      'Decentralized prediction market game with autonomous AI agents. ' +
      'Trade predictions, compete with AI, and train your own models.',
    version: '1.0.0',
    homepage: baseUrl,
    documentation: `${baseUrl}/docs`,
    skills: [
      {
        id: 'trade_prediction',
        name: 'Trade Prediction Market',
        description: 'Place a trade on a prediction market (YES/NO)',
        input_schema: {
          type: 'object',
          properties: {
            marketId: { type: 'string', description: 'Market identifier' },
            side: { type: 'string', enum: ['YES', 'NO'] },
            amount: { type: 'number', description: 'Amount in USD' },
          },
          required: ['marketId', 'side', 'amount'],
        },
      },
      {
        id: 'get_markets',
        name: 'Get Active Markets',
        description: 'List all active prediction markets',
        input_schema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Optional category filter',
            },
          },
        },
      },
      {
        id: 'get_portfolio',
        name: 'Get Portfolio',
        description: 'Get agent portfolio and positions',
        input_schema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
          },
          required: ['agentId'],
        },
      },
      {
        id: 'submit_model',
        name: 'Submit Trained Model',
        description: 'Submit a trained model for benchmarking',
        input_schema: {
          type: 'object',
          properties: {
            modelUrl: { type: 'string', description: 'HuggingFace model URL' },
            version: { type: 'string', description: 'Model version' },
          },
          required: ['modelUrl', 'version'],
        },
      },
      {
        id: 'get_leaderboard',
        name: 'Get Leaderboard',
        description: 'Get agent leaderboard rankings',
      },
    ],
    default_input_modes: ['text', 'data'],
    default_output_modes: ['text', 'data'],
    endpoints: {
      a2a: `${baseUrl}/api/a2a`,
      mcp: `${baseUrl}/api/mcp`,
      openapi: `${baseUrl}/api/openapi.json`,
    },
    capabilities: [
      'prediction_markets',
      'perpetuals',
      'agent_runtime',
      'model_training',
      'x402_payments',
    ],
  }
}

// ============================================================================
// Service Registration
// ============================================================================

export class ERC8004RegistrationService {
  private config: RegistrationConfig
  private registeredServices: Map<string, ServiceRegistration> = new Map()

  constructor(config: RegistrationConfig) {
    this.config = config
  }

  /**
   * Register a service on-chain
   */
  async registerService(
    service: Omit<ServiceRegistration, 'status'>,
  ): Promise<void> {
    const registration: ServiceRegistration = {
      ...service,
      status: 'active',
    }

    // Store locally
    this.registeredServices.set(service.serviceId, registration)

    // Register on identity registry
    await this.registerOnIdentityRegistry(registration)

    // Register JNS name if provided
    if (service.ensName && this.config.jnsRegistryAddress) {
      await this.registerJNSName(service.ensName, service.endpoint)
    }

    logger.info('[ERC8004] Service registered', {
      serviceId: service.serviceId,
      name: service.name,
      type: service.type,
    })
  }

  /**
   * Register all Babylon services
   */
  async registerBabylonServices(baseUrl: string): Promise<void> {
    // Game Engine
    await this.registerService({
      serviceId: 'babylon-game-engine',
      name: 'Babylon Game Engine',
      description: 'Core prediction market and game engine',
      type: 'game_engine',
      endpoint: baseUrl,
      a2aEndpoint: `${baseUrl}/api/a2a`,
      mcpEndpoint: `${baseUrl}/api/mcp`,
      agentCardUrl: `${baseUrl}/.well-known/agent-card.json`,
      ensName: 'game.babylon.jeju.eth',
      version: '1.0.0',
      capabilities: [
        'prediction_markets',
        'perpetuals',
        'agent_runtime',
        'a2a_protocol',
        'mcp_protocol',
        'x402_payments',
      ],
    })

    // Training API
    await this.registerService({
      serviceId: 'babylon-training-api',
      name: 'Babylon Training API',
      description: 'Model training and benchmarking service',
      type: 'training_pipeline',
      endpoint: `${baseUrl}/api/training`,
      version: '1.0.0',
      capabilities: ['model_training', 'benchmarking'],
    })

    // Inference API (for agent models)
    await this.registerService({
      serviceId: 'babylon-inference-api',
      name: 'Babylon Inference API',
      description: 'Agent model inference endpoint',
      type: 'inference_api',
      endpoint: `${baseUrl}/api/inference`,
      version: '1.0.0',
      capabilities: ['model_inference', 'agent_runtime'],
      pricing: {
        currency: 'ETH',
        pricePerRequest: 10n ** 12n, // 0.000001 ETH
        freeTier: {
          requestsPerDay: 1000,
          computeMinutesPerDay: 60,
        },
      },
    })

    logger.info('[ERC8004] All Babylon services registered')
  }

  /**
   * Update service status
   */
  async updateServiceStatus(
    serviceId: string,
    status: ServiceRegistration['status'],
  ): Promise<void> {
    const service = this.registeredServices.get(serviceId)
    if (!service) {
      throw new Error(`Service ${serviceId} not found`)
    }

    service.status = status

    // Update on-chain
    await this.updateOnIdentityRegistry(service)

    logger.info('[ERC8004] Service status updated', { serviceId, status })
  }

  /**
   * Get service by ID
   */
  getService(serviceId: string): ServiceRegistration | undefined {
    return this.registeredServices.get(serviceId)
  }

  /**
   * List all registered services
   */
  listServices(): ServiceRegistration[] {
    return Array.from(this.registeredServices.values())
  }

  /**
   * Resolve service by JNS/ENS name
   */
  async resolveByName(name: string): Promise<ServiceRegistration | null> {
    // Try to resolve via JNS
    const endpoint = await this.resolveJNSName(name)
    if (!endpoint) return null

    // Find service by endpoint
    for (const service of this.registeredServices.values()) {
      if (service.endpoint === endpoint) {
        return service
      }
    }

    // If not in local cache, create temporary registration
    return {
      serviceId: `external-${name}`,
      name,
      description: 'External service resolved via JNS',
      type: 'inference_api',
      endpoint,
      version: '1.0.0',
      capabilities: [],
      status: 'active',
    }
  }

  // ============================================================================
  // Private Methods - Real on-chain calls
  // ============================================================================

  private getChain(): Chain {
    const chainId = parseInt(process.env.CHAIN_ID ?? '31337', 10)
    if (chainId === 31337) return foundry
    if (chainId === 84532) return baseSepolia
    if (chainId === 8453) return base
    return foundry // Default to foundry for local dev
  }

  private getPublicClient() {
    return createPublicClient({
      chain: this.getChain(),
      transport: http(this.config.rpcUrl),
    })
  }

  private getWalletClient() {
    if (!this.config.privateKey) {
      throw new Error(
        '[ERC8004] Private key required for on-chain registration. ' +
          'Set ERC8004_PRIVATE_KEY or use TEE-derived key.',
      )
    }

    const account = privateKeyToAccount(this.config.privateKey as Hex)
    return createWalletClient({
      account,
      chain: this.getChain(),
      transport: http(this.config.rpcUrl),
    })
  }

  private async registerOnIdentityRegistry(
    service: ServiceRegistration,
  ): Promise<void> {
    if (
      this.config.identityRegistryAddress ===
      '0x0000000000000000000000000000000000000000'
    ) {
      logger.warn('[ERC8004] Identity registry not configured, skipping')
      return
    }

    const walletClient = this.getWalletClient()
    const publicClient = this.getPublicClient()

    const abi = parseAbi([
      'function registerService(bytes32 serviceId, string name, string endpoint, string[] capabilities) external returns (bool)',
      'function getService(bytes32 serviceId) view returns (string name, string endpoint, string[] capabilities, bool active)',
    ])

    // Convert serviceId to bytes32
    const serviceIdBytes =
      `0x${Buffer.from(service.serviceId).toString('hex').padEnd(64, '0')}` as Hex

    logger.info('[ERC8004] Registering service on-chain', {
      serviceId: service.serviceId,
      registry: this.config.identityRegistryAddress,
    })

    // Execute registration
    const hash = await safeWriteContract(walletClient, {
      address: this.config.identityRegistryAddress,
      abi,
      functionName: 'registerService',
      args: [
        serviceIdBytes,
        service.name,
        service.endpoint,
        service.capabilities,
      ],
    })

    logger.info('[ERC8004] Registration tx submitted', { hash })

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    if (receipt.status === 'reverted') {
      throw new Error(`[ERC8004] Registration transaction reverted: ${hash}`)
    }

    logger.info('[ERC8004] Service registered successfully', {
      serviceId: service.serviceId,
      txHash: hash,
      blockNumber: receipt.blockNumber,
    })
  }

  private async updateOnIdentityRegistry(
    service: ServiceRegistration,
  ): Promise<void> {
    if (
      this.config.identityRegistryAddress ===
      '0x0000000000000000000000000000000000000000'
    ) {
      return
    }

    const walletClient = this.getWalletClient()
    const publicClient = this.getPublicClient()

    const abi = parseAbi([
      'function updateService(bytes32 serviceId, string endpoint, string[] capabilities) external returns (bool)',
    ])

    const serviceIdBytes =
      `0x${Buffer.from(service.serviceId).toString('hex').padEnd(64, '0')}` as Hex

    logger.info('[ERC8004] Updating service on-chain', {
      serviceId: service.serviceId,
    })

    const hash = await safeWriteContract(walletClient, {
      address: this.config.identityRegistryAddress,
      abi,
      functionName: 'updateService',
      args: [serviceIdBytes, service.endpoint, service.capabilities],
    })

    await publicClient.waitForTransactionReceipt({ hash })

    logger.info('[ERC8004] Service updated', { serviceId: service.serviceId })
  }

  private async registerJNSName(name: string, endpoint: string): Promise<void> {
    if (!this.config.jnsRegistryAddress) return

    const walletClient = this.getWalletClient()
    const publicClient = this.getPublicClient()

    const abi = parseAbi([
      'function register(string name, address owner) external returns (bytes32 node)',
      'function setResolver(bytes32 node, address resolver) external',
      'function setText(bytes32 node, string key, string value) external',
      'function available(string name) view returns (bool)',
    ])

    // Check availability
    const available = await safeReadContract<boolean>(publicClient, {
      address: this.config.jnsRegistryAddress,
      abi,
      functionName: 'available',
      args: [name],
    })

    if (!available) {
      logger.warn('[ERC8004] JNS name not available', { name })
      return
    }

    const account = privateKeyToAccount(this.config.privateKey as Hex)

    logger.info('[ERC8004] Registering JNS name', { name, endpoint })

    // Register name
    const registerHash = await safeWriteContract(walletClient, {
      address: this.config.jnsRegistryAddress,
      abi,
      functionName: 'register',
      args: [name, account.address],
    })

    const registerReceipt = await publicClient.waitForTransactionReceipt({
      hash: registerHash,
    })

    // Extract node from logs or compute it
    const node = `0x${Buffer.from(name).toString('hex').padEnd(64, '0')}` as Hex

    // Set endpoint as text record
    const setTextHash = await safeWriteContract(walletClient, {
      address: this.config.jnsRegistryAddress,
      abi,
      functionName: 'setText',
      args: [node, 'url', endpoint],
    })

    await publicClient.waitForTransactionReceipt({ hash: setTextHash })

    logger.info('[ERC8004] JNS name registered', {
      name,
      endpoint,
      txHash: registerReceipt.transactionHash,
    })
  }

  private async resolveJNSName(name: string): Promise<string | null> {
    if (!this.config.jnsRegistryAddress) return null

    const publicClient = this.getPublicClient()

    const abi = parseAbi([
      'function getText(bytes32 node, string key) view returns (string)',
      'function owner(bytes32 node) view returns (address)',
    ])

    const node = `0x${Buffer.from(name).toString('hex').padEnd(64, '0')}` as Hex

    // Check if name is registered
    const owner = await safeReadContract<Address>(publicClient, {
      address: this.config.jnsRegistryAddress,
      abi,
      functionName: 'owner',
      args: [node],
    })

    if (owner === '0x0000000000000000000000000000000000000000') {
      return null
    }

    // Get endpoint URL
    const endpoint = await safeReadContract<string>(publicClient, {
      address: this.config.jnsRegistryAddress,
      abi,
      functionName: 'getText',
      args: [node, 'url'],
    })

    return endpoint || null
  }
}

// ============================================================================
// Factory
// ============================================================================

let registrationService: ERC8004RegistrationService | null = null

export function getERC8004RegistrationService(): ERC8004RegistrationService {
  if (!registrationService) {
    registrationService = new ERC8004RegistrationService({
      rpcUrl: process.env.JEJU_RPC_URL ?? 'http://localhost:6546',
      identityRegistryAddress: (process.env.IDENTITY_REGISTRY_ADDRESS ??
        '0x0000000000000000000000000000000000000000') as Address,
      jnsRegistryAddress: process.env.JNS_REGISTRY_ADDRESS as
        | Address
        | undefined,
    })
  }
  return registrationService
}

export async function initializeERC8004Registration(): Promise<void> {
  const service = getERC8004RegistrationService()
  const baseUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000'
  await service.registerBabylonServices(baseUrl)
}
