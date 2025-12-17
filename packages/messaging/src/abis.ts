/**
 * Contract ABIs for messaging system
 */

export const KEY_REGISTRY_ABI = [
  {
    name: 'registerKeyBundle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'identityKey', type: 'bytes32' },
      { name: 'signedPreKey', type: 'bytes32' },
      { name: 'preKeySignature', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'getKeyBundle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: 'bundle',
        type: 'tuple',
        components: [
          { name: 'identityKey', type: 'bytes32' },
          { name: 'signedPreKey', type: 'bytes32' },
          { name: 'preKeySignature', type: 'bytes32' },
          { name: 'preKeyTimestamp', type: 'uint256' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'lastUpdated', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'hasActiveKeyBundle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: 'hasKey', type: 'bool' }],
  },
  {
    name: 'rotateSignedPreKey',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'newSignedPreKey', type: 'bytes32' },
      { name: 'newPreKeySignature', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'revokeKeyBundle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'KeyBundleRegistered',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'identityKey', type: 'bytes32', indexed: false },
      { name: 'signedPreKey', type: 'bytes32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const NODE_REGISTRY_ABI = [
  {
    name: 'registerNode',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'endpoint', type: 'string' },
      { name: 'region', type: 'string' },
      { name: 'stakeAmount', type: 'uint256' },
    ],
    outputs: [{ name: 'nodeId', type: 'bytes32' }],
  },
  {
    name: 'getActiveNodes',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32[]' }],
  },
  {
    name: 'getNode',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'nodeId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'nodeId', type: 'bytes32' },
          { name: 'operator', type: 'address' },
          { name: 'endpoint', type: 'string' },
          { name: 'region', type: 'string' },
          { name: 'stakedAmount', type: 'uint256' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'lastHeartbeat', type: 'uint256' },
          { name: 'messagesRelayed', type: 'uint256' },
          { name: 'feesEarned', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
          { name: 'isSlashed', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getRandomHealthyNode',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'region', type: 'string' }],
    outputs: [
      { name: 'nodeId', type: 'bytes32' },
      { name: 'endpoint', type: 'string' },
    ],
  },
  {
    name: 'isNodeHealthy',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'nodeId', type: 'bytes32' }],
    outputs: [{ name: 'healthy', type: 'bool' }],
  },
] as const;
