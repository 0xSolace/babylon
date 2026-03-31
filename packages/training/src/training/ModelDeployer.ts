/**
 * Model Deployer Service
 *
 * Deployment intent tracking for trained models.
 *
 * Actual runtime rollout is disabled until agent inference selects models from
 * deployed-model records rather than static runtime settings.
 */

import { logger } from '../utils/logger';

export interface DeploymentOptions {
  modelVersion: string;
  strategy: 'immediate' | 'gradual' | 'test';
  rolloutPercentage?: number; // For gradual deployment (default: 10%)
  testAgentIds?: string[]; // For test deployment
}

export interface DeploymentResult {
  success: boolean;
  agentsUpdated: number;
  deploymentId: string;
  error?: string;
}

const DEPLOYMENT_DISABLED_MESSAGE =
  'Trained model rollout is disabled until agent runtime model selection is wired to deployed model records.';

export class ModelDeployer {
  /**
   * Deployment is intentionally disabled until runtime model routing is real.
   */
  async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
    logger.warn('Rejected model deployment request', {
      version: options.modelVersion,
      strategy: options.strategy,
      reason: DEPLOYMENT_DISABLED_MESSAGE,
    });
    throw new Error(DEPLOYMENT_DISABLED_MESSAGE);
  }

  /**
   * Rollback is intentionally disabled until runtime model routing is real.
   */
  async rollback(
    currentVersion: string,
    targetVersion: string
  ): Promise<DeploymentResult> {
    logger.warn('Rejected model rollback request', {
      from: currentVersion,
      to: targetVersion,
      reason: DEPLOYMENT_DISABLED_MESSAGE,
    });
    throw new Error(DEPLOYMENT_DISABLED_MESSAGE);
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<{
    status: string;
    agentsUpdated: number;
    agentsFailed: number;
    performance: Record<string, number>;
  } | null> {
    logger.warn('Deployment status unavailable while rollout is disabled', {
      deploymentId,
      reason: DEPLOYMENT_DISABLED_MESSAGE,
    });
    return null;
  }
}

// Singleton
export const modelDeployer = new ModelDeployer();
