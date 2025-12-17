/**
 * Secrets Module Exports
 *
 * All secrets managed via Jeju KMS.
 * NO FALLBACKS - Environment variables are only for bootstrapping.
 */

export {
  type DecryptRequest,
  type EncryptRequest,
  type EncryptResult,
  getKMSClient,
  getSecretValue,
  initializeKMS,
  KMSClient,
  type KMSConfig,
  type PolicyCondition,
  resetKMSClient,
  type Secret,
  type SecretPolicy,
  type SignRequest,
  type SignResult,
  setSecretValue,
} from './kms-client';
