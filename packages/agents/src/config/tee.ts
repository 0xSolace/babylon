/**
 * TEE Configuration Helper
 *
 * Centralized TEE (Trusted Execution Environment) configuration for the Babylon agents package.
 * Enforces TEE requirements in production and provides consistent configuration across services.
 *
 * Production Requirements:
 * - TEE_MODE must be set to a valid provider (phala, intel-sgx, intel-tdx, amd-sev)
 * - Simulated mode is NOT allowed in production
 * - All sensitive operations require attestation
 */

export type TEEProvider =
  | 'phala'
  | 'intel-sgx'
  | 'intel-tdx'
  | 'amd-sev'
  | 'simulated'

export interface TEEConfig {
  /** Whether TEE is required for this environment */
  required: boolean
  /** TEE provider type */
  type: TEEProvider
  /** Whether attestation is required for sensitive operations */
  attestationRequired: boolean
  /** Whether this is a production environment */
  isProduction: boolean
  /** Provider-specific endpoints */
  endpoints: {
    phala?: string
    attestation?: string
  }
}

/**
 * Check if current environment is production
 */
export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Get TEE configuration based on environment
 */
export function getTEEConfig(): TEEConfig {
  const isProduction = isProductionEnvironment()
  const teeMode = process.env.TEE_MODE || process.env.TEE_TYPE

  // Determine TEE type
  let type: TEEProvider
  if (teeMode) {
    type = teeMode as TEEProvider
  } else if (isProduction) {
    type = 'phala' // Default to Phala in production
  } else {
    type = 'simulated'
  }

  return {
    required: isProduction,
    type,
    attestationRequired: isProduction,
    isProduction,
    endpoints: {
      phala: process.env.PHALA_ENDPOINT || process.env.TEE_ENDPOINT,
      attestation: process.env.TEE_ATTESTATION_ENDPOINT,
    },
  }
}

/**
 * Enforce TEE requirement for an operation in production
 *
 * @param operation - Name of the operation being performed
 * @throws Error if TEE is required but not available in production
 */
export function requireTEE(operation: string): void {
  const config = getTEEConfig()

  if (config.required && config.type === 'simulated') {
    throw new Error(
      `[TEE] ${operation} requires TEE in production mode. ` +
        `Set TEE_MODE to a valid provider (phala, intel-sgx, intel-tdx, amd-sev).`,
    )
  }
}

/**
 * Enforce TEE attestation requirement for an operation in production
 *
 * @param operation - Name of the operation being performed
 * @param attestation - Attestation data to verify
 * @throws Error if attestation is required but not provided in production
 */
export function requireTEEAttestation(
  operation: string,
  attestation: string | undefined | null,
): void {
  const config = getTEEConfig()

  if (config.attestationRequired && !attestation) {
    throw new Error(
      `[TEE] ${operation} requires attestation in production mode. ` +
        `Ensure TEE attestation is provided for this operation.`,
    )
  }
}

/**
 * Check if TEE is available (either real or simulated)
 */
export function isTEEAvailable(): boolean {
  const config = getTEEConfig()
  return config.type !== 'simulated' || !config.isProduction
}

/**
 * Get inference options with TEE enforcement
 */
export function getInferenceOptions(): {
  requireTEE: boolean
  teeType: TEEProvider
  attestation: boolean
} {
  const config = getTEEConfig()
  return {
    requireTEE: config.required,
    teeType: config.type,
    attestation: config.attestationRequired,
  }
}

/**
 * Validate TEE configuration for production readiness
 *
 * @throws Error if configuration is invalid for production
 */
export function validateTEEConfig(): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const config = getTEEConfig()
  const errors: string[] = []
  const warnings: string[] = []

  if (config.isProduction) {
    if (config.type === 'simulated') {
      errors.push('Simulated TEE mode is not allowed in production')
    }

    if (!config.endpoints.phala && config.type === 'phala') {
      errors.push('PHALA_ENDPOINT is required when TEE_MODE is phala')
    }

    if (!process.env.TEE_ATTESTATION_REQUIRED) {
      warnings.push(
        'TEE_ATTESTATION_REQUIRED not set - defaulting to true in production',
      )
    }
  } else {
    if (config.type === 'simulated') {
      warnings.push('Using simulated TEE mode - not suitable for production')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
