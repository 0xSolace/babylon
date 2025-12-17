/**
 * Infrastructure Health Checker
 *
 * Checks and reports the status of all Jeju services required for Babylon tests.
 * All services are managed by Jeju CLI - no Docker Compose fallback.
 *
 * Run: cd /path/to/jeju && bun run dev
 */

export interface ServiceStatus {
  name: string;
  running: boolean;
  healthy: boolean;
  endpoint?: string;
  error?: string;
}

export interface InfrastructureStatus {
  healthy: boolean;
  services: ServiceStatus[];
  missingServices: string[];
  timestamp: number;
}

// Jeju-managed services
const JEJU_SERVICES = {
  // Core services (managed by Jeju)
  postgres: {
    healthEndpoint: null,
    port: 5433,
    required: true,
    description: 'PostgreSQL database',
  },
  redis: {
    healthEndpoint: null,
    port: 6380,
    required: true,
    description: 'Redis cache',
  },
  hardhat: {
    healthEndpoint: 'http://localhost:8545',
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
    healthEndpoint: 'http://localhost:4300/health',
    port: 4300,
    required: true,
    description: 'Jeju API Gateway',
  },
  cache: {
    healthEndpoint: 'http://localhost:4015/health',
    port: 4015,
    required: true,
    description: 'Jeju Cache',
  },
  storage: {
    healthEndpoint: 'http://localhost:5004/api/v0/id',
    port: 5004,
    required: false,
    description: 'Jeju Storage (IPFS)',
  },
  oauth3: {
    healthEndpoint: 'http://localhost:5011/health',
    port: 5011,
    required: false,
    description: 'Jeju OAuth3 Provider',
  },
  kms: {
    healthEndpoint: 'http://localhost:5012/health',
    port: 5012,
    required: false,
    description: 'Jeju Key Management Service',
  },
  messaging: {
    healthEndpoint: 'http://localhost:3200/health',
    port: 3200,
    required: false,
    description: 'Jeju Messaging Relay',
  },
  cql: {
    healthEndpoint: 'http://localhost:8546/v1/health',
    port: 8546,
    required: false,
    description: 'Jeju CQL (CovenantSQL)',
  },
} as const;

type ServiceName = keyof typeof JEJU_SERVICES;

async function checkPortOpen(port: number): Promise<boolean> {
  const { $ } = await import('bun');
  const result = await $`lsof -i:${port}`.quiet().nothrow();
  return result.exitCode === 0;
}

async function checkHttpHealth(
  endpoint: string,
  method = 'GET',
  body?: string
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  const init: RequestInit = {
    method,
    signal: controller.signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body,
  };

  const response = await fetch(endpoint, init).catch(() => null);
  clearTimeout(timeoutId);

  return response?.ok ?? false;
}

export async function checkService(name: ServiceName): Promise<ServiceStatus> {
  const config = JEJU_SERVICES[name];
  const status: ServiceStatus = { name, running: false, healthy: false };

  // Check port first
  const portOpen = await checkPortOpen(config.port);
  if (!portOpen) {
    status.error = `Port ${config.port} not open`;
    return status;
  }

  status.running = true;

  // Check HTTP health endpoint if applicable
  if (config.healthEndpoint) {
    const httpHealthy = await checkHttpHealth(
      config.healthEndpoint,
      'method' in config && config.method ? config.method : 'GET',
      'body' in config ? config.body : undefined
    );
    status.healthy = httpHealthy;
    status.endpoint = config.healthEndpoint;
    if (!httpHealthy) {
      status.error = `Health check failed: ${config.healthEndpoint}`;
    }
  } else {
    // No health endpoint, just port check is enough
    status.healthy = true;
  }

  return status;
}

export async function checkCoreServices(): Promise<InfrastructureStatus> {
  const coreServices: ServiceName[] = ['postgres', 'redis', 'hardhat'];
  const results = await Promise.all(coreServices.map(checkService));

  const missingServices = results
    .filter((s) => !s.running || !s.healthy)
    .map((s) => s.name);

  return {
    healthy: missingServices.length === 0,
    services: results,
    missingServices,
    timestamp: Date.now(),
  };
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
  ];
  const results = await Promise.all(jejuServices.map(checkService));

  // Only consider required services for health status
  const missingRequired = results
    .filter((s, i) => {
      const serviceName = jejuServices[i];
      if (!serviceName) return false;
      const config = JEJU_SERVICES[serviceName];
      return config.required && (!s.running || !s.healthy);
    })
    .map((s) => s.name);

  const missingOptional = results
    .filter((s, i) => {
      const serviceName = jejuServices[i];
      if (!serviceName) return false;
      const config = JEJU_SERVICES[serviceName];
      return !config.required && (!s.running || !s.healthy);
    })
    .map((s) => s.name);

  return {
    healthy: missingRequired.length === 0,
    services: results,
    missingServices: [...missingRequired, ...missingOptional],
    timestamp: Date.now(),
  };
}

export async function checkAllServices(): Promise<InfrastructureStatus> {
  const allServices: ServiceName[] = Object.keys(
    JEJU_SERVICES
  ) as ServiceName[];
  const results = await Promise.all(allServices.map(checkService));

  // Only required services affect health status
  const missingRequired = results
    .filter((s, i) => {
      const serviceName = allServices[i];
      if (!serviceName) return false;
      const config = JEJU_SERVICES[serviceName];
      return config.required && (!s.running || !s.healthy);
    })
    .map((s) => s.name);

  return {
    healthy: missingRequired.length === 0,
    services: results,
    missingServices: missingRequired,
    timestamp: Date.now(),
  };
}

export async function isJejuRunning(): Promise<boolean> {
  // Check if Jeju gateway is running (primary indicator)
  const response = await fetch('http://localhost:4300/health', {
    signal: AbortSignal.timeout(2000),
  }).catch(() => null);

  return response?.ok ?? false;
}

export function printStatus(status: InfrastructureStatus): void {
  console.log('\n' + '═'.repeat(60));
  console.log('JEJU INFRASTRUCTURE STATUS');
  console.log('═'.repeat(60));

  for (const service of status.services) {
    const icon =
      service.running && service.healthy ? '✅' : service.running ? '⚠️' : '❌';
    const healthText = service.healthy
      ? 'healthy'
      : service.running
        ? 'unhealthy'
        : 'not running';
    console.log(
      `${icon} ${service.name.padEnd(15)} ${healthText.padEnd(12)} ${service.endpoint ?? ''}`
    );
    if (service.error) {
      console.log(`   └─ ${service.error}`);
    }
  }

  console.log('═'.repeat(60));

  if (status.healthy) {
    console.log('✅ All required services operational');
  } else {
    console.log(`❌ Missing services: ${status.missingServices.join(', ')}`);
    console.log('');
    console.log('To start all services, run:');
    console.log('  cd /path/to/jeju && bun run dev');
  }
  console.log('');
}

// CLI entry point
if (import.meta.main) {
  const status = await checkAllServices();
  printStatus(status);
  process.exit(status.healthy ? 0 : 1);
}
