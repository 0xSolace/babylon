/**
 * Infrastructure Health Checker
 *
 * Checks and reports the status of all Jeju services required for Babylon tests.
 * All services are managed by Jeju CLI - no Docker Compose fallback.
 *
 * Run: cd /path/to/jeju && bun run dev
 */

export interface ServiceStatus {
  name: string
  running: boolean
  healthy: boolean
  endpoint?: string
  error?: string
}

export interface InfrastructureStatus {
  healthy: boolean
  services: ServiceStatus[]
  missingServices: string[]
  timestamp: number
}

// Port configuration - uses env vars with fallback defaults
const PORTS = {
  POSTGRES: parseInt(process.env.POSTGRES_PORT ?? '5433', 10),
  REDIS: parseInt(process.env.REDIS_PORT ?? '6380', 10),
  L1_RPC: parseInt(process.env.L1_RPC_PORT ?? '6545', 10),
  GATEWAY: parseInt(process.env.GATEWAY_PORT ?? '4030', 10),
  CACHE: parseInt(process.env.CACHE_PORT ?? '4015', 10),
  STORAGE: parseInt(process.env.STORAGE_PORT ?? '5004', 10),
  OAUTH3: parseInt(process.env.OAUTH3_PORT ?? '5011', 10),
  KMS: parseInt(process.env.KMS_PORT ?? '5012', 10),
  MESSAGING: parseInt(process.env.MESSAGING_PORT ?? '3200', 10),
  CQL: parseInt(process.env.CQL_PORT ?? '4661', 10),
}

// Jeju-managed services
const JEJU_SERVICES = {
  // Core services (managed by Jeju)
  postgres: {
    healthEndpoint: null,
    port: PORTS.POSTGRES,
    required: true,
    description: 'PostgreSQL database',
  },
  redis: {
    healthEndpoint: null,
    port: PORTS.REDIS,
    required: true,
    description: 'Redis cache',
  },
  hardhat: {
    healthEndpoint: `http://localhost:${PORTS.L1_RPC}`,
    port: 8545,
    required: true,
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_chainId',
      params: [],
      id: 1,
    }),
    description: 'Local Ethereum node',
  },
  // Jeju decentralized services
  gateway: {
    healthEndpoint: `http://localhost:${PORTS.GATEWAY}/health`,
    port: PORTS.GATEWAY,
    required: true,
    description: 'Jeju API Gateway',
  },
  cache: {
    healthEndpoint: `http://localhost:${PORTS.CACHE}/health`,
    port: PORTS.CACHE,
    required: true,
    description: 'Jeju Cache',
  },
  storage: {
    healthEndpoint: `http://localhost:${PORTS.STORAGE}/api/v0/id`,
    port: PORTS.STORAGE,
    required: false,
    description: 'Jeju Storage (IPFS)',
  },
  oauth3: {
    healthEndpoint: `http://localhost:${PORTS.OAUTH3}/health`,
    port: PORTS.OAUTH3,
    required: false,
    description: 'Jeju OAuth3 Provider',
  },
  kms: {
    healthEndpoint: `http://localhost:${PORTS.KMS}/health`,
    port: PORTS.KMS,
    required: false,
    description: 'Jeju Key Management Service',
  },
  messaging: {
    healthEndpoint: `http://localhost:${PORTS.MESSAGING}/health`,
    port: PORTS.MESSAGING,
    required: false,
    description: 'Jeju Messaging Relay',
  },
  cql: {
    healthEndpoint: `http://localhost:${PORTS.CQL}/v1/health`,
    port: PORTS.CQL,
    required: false,
    description: 'Jeju CQL (CovenantSQL)',
  },
} as const

import { $ } from 'bun'

type ServiceName = keyof typeof JEJU_SERVICES

async function checkPortOpen(port: number): Promise<boolean> {
  const result = await $`lsof -i:${port}`.quiet().nothrow()
  return result.exitCode === 0
}

async function checkHttpHealth(
  endpoint: string,
  method = 'GET',
  body?: string,
): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000)

  const init: RequestInit = {
    method,
    signal: controller.signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body,
  }

  const response = await fetch(endpoint, init).catch(() => null)
  clearTimeout(timeoutId)

  return response?.ok ?? false
}

export async function checkService(name: ServiceName): Promise<ServiceStatus> {
  const config = JEJU_SERVICES[name]
  const status: ServiceStatus = { name, running: false, healthy: false }

  // Check port first
  const portOpen = await checkPortOpen(config.port)
  if (!portOpen) {
    status.error = `Port ${config.port} not open`
    return status
  }

  status.running = true

  // Check HTTP health endpoint if applicable
  if (config.healthEndpoint) {
    const httpHealthy = await checkHttpHealth(
      config.healthEndpoint,
      'method' in config && config.method ? config.method : 'GET',
      'body' in config ? config.body : undefined,
    )
    status.healthy = httpHealthy
    status.endpoint = config.healthEndpoint
    if (!httpHealthy) {
      status.error = `Health check failed: ${config.healthEndpoint}`
    }
  } else {
    // No health endpoint, just port check is enough
    status.healthy = true
  }

  return status
}

export async function checkCoreServices(): Promise<InfrastructureStatus> {
  const coreServices: ServiceName[] = ['postgres', 'redis', 'hardhat']
  const results = await Promise.all(coreServices.map(checkService))

  const missingServices = results
    .filter((s) => !s.running || !s.healthy)
    .map((s) => s.name)

  return {
    healthy: missingServices.length === 0,
    services: results,
    missingServices,
    timestamp: Date.now(),
  }
}

export async function checkJejuServices(): Promise<InfrastructureStatus> {
  const jejuServices: ServiceName[] = [
    'gateway',
    'cache',
    'storage',
    'oauth3',
    'kms',
    'messaging',
    'cql',
  ]
  const results = await Promise.all(jejuServices.map(checkService))

  // Only consider required services for health status
  const missingRequired = results
    .filter((s, i) => {
      const serviceName = jejuServices[i]
      if (!serviceName) return false
      const config = JEJU_SERVICES[serviceName]
      return config.required && (!s.running || !s.healthy)
    })
    .map((s) => s.name)

  const missingOptional = results
    .filter((s, i) => {
      const serviceName = jejuServices[i]
      if (!serviceName) return false
      const config = JEJU_SERVICES[serviceName]
      return !config.required && (!s.running || !s.healthy)
    })
    .map((s) => s.name)

  return {
    healthy: missingRequired.length === 0,
    services: results,
    missingServices: [...missingRequired, ...missingOptional],
    timestamp: Date.now(),
  }
}

// Type-safe helper to get service names from JEJU_SERVICES
const SERVICE_NAMES = Object.keys(
  JEJU_SERVICES,
) as (keyof typeof JEJU_SERVICES)[]

function getServiceNames(): ServiceName[] {
  return SERVICE_NAMES
}

export async function checkAllServices(): Promise<InfrastructureStatus> {
  const allServices = getServiceNames()
  const results = await Promise.all(allServices.map(checkService))

  // Only required services affect health status
  const missingRequired = results
    .filter((s, i) => {
      const serviceName = allServices[i]
      if (!serviceName) return false
      const config = JEJU_SERVICES[serviceName]
      return config.required && (!s.running || !s.healthy)
    })
    .map((s) => s.name)

  return {
    healthy: missingRequired.length === 0,
    services: results,
    missingServices: missingRequired,
    timestamp: Date.now(),
  }
}

export async function isJejuRunning(): Promise<boolean> {
  // Check if Jeju gateway is running (primary indicator)
  const response = await fetch(`http://localhost:${PORTS.GATEWAY}/health`, {
    signal: AbortSignal.timeout(2000),
  }).catch(() => null)

  return response?.ok ?? false
}

export function printStatus(status: InfrastructureStatus): void {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('JEJU INFRASTRUCTURE STATUS')
  console.log('═'.repeat(60))

  for (const service of status.services) {
    const icon =
      service.running && service.healthy ? '✅' : service.running ? '⚠️' : '❌'
    const healthText = service.healthy
      ? 'healthy'
      : service.running
        ? 'unhealthy'
        : 'not running'
    console.log(
      `${icon} ${service.name.padEnd(15)} ${healthText.padEnd(12)} ${service.endpoint ?? ''}`,
    )
    if (service.error) {
      console.log(`   └─ ${service.error}`)
    }
  }

  console.log('═'.repeat(60))

  if (status.healthy) {
    console.log('✅ All required services operational')
  } else {
    console.log(`❌ Missing services: ${status.missingServices.join(', ')}`)
    console.log('')
    console.log('To start all services, run:')
    console.log('  cd /path/to/jeju && bun run dev')
  }
  console.log('')
}

// CLI entry point
if (import.meta.main) {
  const status = await checkAllServices()
  printStatus(status)
  process.exit(status.healthy ? 0 : 1)
}
