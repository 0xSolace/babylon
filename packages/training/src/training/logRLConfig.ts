/**
 * RL Configuration Logger
 *
 * Logs RL model configuration and availability on server startup.
 * Used for diagnostics and verification during deployment.
 */

import { isRLModelAvailable, logRLModelConfig } from './RLModelConfig'

/**
 * Log RL model configuration and verify setup
 *
 * Call this on server startup to display configuration details
 * and verify that the RL training system is properly configured.
 */
export async function logRLConfigOnStartup(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🚀 RL Training System Configuration')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Log RL configuration
  logRLModelConfig()

  // Check if RL models are available
  const available = isRLModelAvailable()

  if (available) {
    console.log('\n✅ RL Model system available')
  } else {
    console.log('\nℹ️  RL models not available - using base model')
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}
