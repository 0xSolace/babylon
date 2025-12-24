/**
 * ABI for the Jeju GameOracle contract
 * From packages/contracts/src/games/GameOracle.sol
 *
 * This is the generic game oracle from Jeju Network that Babylon uses.
 */
export const GameOracleABI = [
  {
    inputs: [
      { internalType: 'address', name: '_gameServer', type: 'address' },
      { internalType: 'address', name: '_owner', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'AlreadyFinalized',
    type: 'error',
  },
  {
    inputs: [],
    name: 'CommitmentAlreadyExists',
    type: 'error',
  },
  {
    inputs: [],
    name: 'CommitmentMismatch',
    type: 'error',
  },
  {
    inputs: [],
    name: 'GameNotFound',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidQuestionId',
    type: 'error',
  },
  {
    inputs: [],
    name: 'OnlyGameServer',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'string', name: 'questionId', type: 'string' }],
    name: 'QuestionAlreadyCommitted',
    type: 'error',
  },
  {
    inputs: [],
    name: 'SessionAlreadyExists',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'sessionId', type: 'bytes32' }],
    name: 'SessionNotFound',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'sessionId',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'questionId',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'questionNumber',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'question',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'commitment',
        type: 'bytes32',
      },
    ],
    name: 'GameCommitted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'sessionId',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'questionId',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'bool',
        name: 'outcome',
        type: 'bool',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'winnersCount',
        type: 'uint256',
      },
    ],
    name: 'GameRevealed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'oldServer',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newServer',
        type: 'address',
      },
    ],
    name: 'GameServerUpdated',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'string', name: 'questionId', type: 'string' },
      { internalType: 'uint256', name: 'questionNumber', type: 'uint256' },
      { internalType: 'string', name: 'question', type: 'string' },
      { internalType: 'bytes32', name: 'commitment', type: 'bytes32' },
      { internalType: 'string', name: 'category', type: 'string' },
    ],
    name: 'commitGame',
    outputs: [{ internalType: 'bytes32', name: 'sessionId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'sessionId', type: 'bytes32' },
      { internalType: 'bool', name: 'outcome', type: 'bool' },
      { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
      { internalType: 'bytes', name: 'teeQuote', type: 'bytes' },
      { internalType: 'address[]', name: 'winners', type: 'address[]' },
      { internalType: 'uint256', name: 'totalPayout', type: 'uint256' },
    ],
    name: 'revealGame',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string[]', name: 'questionIds', type: 'string[]' },
      { internalType: 'uint256[]', name: 'questionNumbers', type: 'uint256[]' },
      { internalType: 'string[]', name: 'questions', type: 'string[]' },
      { internalType: 'bytes32[]', name: 'gameCommitments', type: 'bytes32[]' },
      { internalType: 'string[]', name: 'categories', type: 'string[]' },
    ],
    name: 'batchCommitGames',
    outputs: [
      { internalType: 'bytes32[]', name: 'sessionIds', type: 'bytes32[]' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32[]', name: 'sessionIds', type: 'bytes32[]' },
      { internalType: 'bool[]', name: 'outcomes', type: 'bool[]' },
      { internalType: 'bytes32[]', name: 'salts', type: 'bytes32[]' },
      { internalType: 'bytes[]', name: 'teeQuotes', type: 'bytes[]' },
      {
        internalType: 'address[][]',
        name: 'winnersArrays',
        type: 'address[][]',
      },
      { internalType: 'uint256[]', name: 'totalPayouts', type: 'uint256[]' },
    ],
    name: 'batchRevealGames',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'sessionId', type: 'bytes32' }],
    name: 'getCompleteGameInfo',
    outputs: [
      {
        components: [
          { internalType: 'string', name: 'questionId', type: 'string' },
          { internalType: 'uint256', name: 'questionNumber', type: 'uint256' },
          { internalType: 'string', name: 'category', type: 'string' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'address', name: 'creator', type: 'address' },
        ],
        internalType: 'struct GameOracle.GameMetadata',
        name: 'metadata',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'bytes32', name: 'sessionId', type: 'bytes32' },
          { internalType: 'string', name: 'question', type: 'string' },
          { internalType: 'bool', name: 'outcome', type: 'bool' },
          { internalType: 'bytes32', name: 'commitment', type: 'bytes32' },
          { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
          { internalType: 'uint256', name: 'startTime', type: 'uint256' },
          { internalType: 'uint256', name: 'endTime', type: 'uint256' },
          { internalType: 'bytes', name: 'teeQuote', type: 'bytes' },
          { internalType: 'uint256', name: 'totalPayout', type: 'uint256' },
          { internalType: 'bool', name: 'finalized', type: 'bool' },
        ],
        internalType: 'struct GameOracle.GameOutcome',
        name: 'game',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getStatistics',
    outputs: [
      { internalType: 'uint256', name: 'committed', type: 'uint256' },
      { internalType: 'uint256', name: 'revealed', type: 'uint256' },
      { internalType: 'uint256', name: 'pending', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'version',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'sessionId', type: 'bytes32' }],
    name: 'getOutcome',
    outputs: [
      { internalType: 'bool', name: 'outcome', type: 'bool' },
      { internalType: 'bool', name: 'finalized', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'sessionId', type: 'bytes32' },
      { internalType: 'address', name: 'player', type: 'address' },
    ],
    name: 'isWinner',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'commitment', type: 'bytes32' }],
    name: 'verifyCommitment',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'sessionId', type: 'bytes32' }],
    name: 'getWinners',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'questionId', type: 'string' }],
    name: 'getSessionIdByQuestionId',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'sessionId', type: 'bytes32' }],
    name: 'getQuestionIdBySessionId',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const
