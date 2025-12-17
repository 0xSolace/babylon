/**
 * MPC Network Client
 *
 * Client for interacting with the decentralized MPC network.
 * Handles threshold signing, key generation, and node discovery.
 */

export { createMPCClient, MPCClient, type MPCClientConfig } from './client';
export { ThresholdSigner } from './threshold-signer';
export type {
  KeyGenRequest,
  KeyGenResponse,
  SigningRequest,
  SigningResponse,
} from './types';
