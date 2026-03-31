/**
 * Contract ABIs for ERC-8004 and Prediction Market interactions
 *
 * IMPORTANT: On-chain identity registration now uses Agent0 SDK exclusively
 * (canonical ERC-8004 on Ethereum mainnet). The Identity Registry ABI below
 * is retained for backward compatibility (reading existing registrations on
 * Base Sepolia) but should NOT be used for new registrations.
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004
 */

// ERC-8004 Identity Registry ABI (Babylon custom extension on Base Sepolia)
// @deprecated New registrations use Agent0 SDK. This ABI is kept for reading legacy data.
export const IDENTITY_REGISTRY_ABI = [
  // ERC-721 standard functions
  'function balanceOf(address owner) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',

  // Agent registration
  'function registerAgent(string calldata _name, string calldata _endpoint, bytes32 _capabilitiesHash, string calldata _metadata) external returns (uint256 tokenId)',
  'function updateAgent(string calldata _endpoint, bytes32 _capabilitiesHash, string calldata _metadata) external',
  'function deactivateAgent() external',
  'function reactivateAgent() external',

  // Profile queries
  'function getAgentProfile(uint256 _tokenId) external view returns (string memory name, string memory endpoint, bytes32 capabilitiesHash, uint256 registeredAt, bool isActive, string memory metadata)',
  'function getTokenId(address _address) external view returns (uint256)',
  'function isRegistered(address _address) external view returns (bool)',
  'function verifyAgent(address _address, uint256 _tokenId) external view returns (bool)',
  'function getAllActiveAgents() external view returns (uint256[] memory)',
  'function isEndpointActive(string memory endpoint) external view returns (bool)',
  'function getAgentsByCapability(bytes32 capabilityHash) external view returns (uint256[] memory)',

  // Agent0 linking (cross-chain discovery)
  'function linkAgent0Identity(uint256 _agent0ChainId, uint256 _agent0TokenId) external',
  'function unlinkAgent0Identity() external',
  'function getAgent0Link(uint256 _tokenId) external view returns (string memory)',
  'function hasAgent0Link(uint256 _tokenId) external view returns (bool)',

  // Events
  'event AgentRegistered(uint256 indexed tokenId, address indexed owner, string name, string endpoint)',
  'event AgentUpdated(uint256 indexed tokenId, string endpoint, bytes32 capabilitiesHash)',
  'event AgentDeactivated(uint256 indexed tokenId)',
  'event AgentReactivated(uint256 indexed tokenId)',
  'event Agent0Linked(uint256 indexed tokenId, uint256 indexed agent0ChainId, uint256 indexed agent0TokenId)',
  'event Agent0Unlinked(uint256 indexed tokenId)',
] as const;

// ERC-8004 Reputation System ABI (Base Sepolia)
// @deprecated Game reputation is now tracked in the database. This ABI is kept for reading legacy data.
export const REPUTATION_SYSTEM_ABI = [
  // Reputation queries
  'function getReputation(uint256 _tokenId) external view returns (uint256 totalBets, uint256 winningBets, uint256 totalVolume, uint256 profitLoss, uint256 accuracyScore, uint256 trustScore, bool isBanned)',
  'function getFeedbackCount(uint256 _tokenId) external view returns (uint256)',
  'function getFeedback(uint256 _tokenId, uint256 _index) external view returns (address from, int8 rating, string memory comment, uint256 timestamp)',
  'function getAgentsByMinScore(uint256 minScore) external view returns (uint256[] memory)',

  // Reputation updates (only by authorized contracts)
  'function recordBet(uint256 _tokenId, uint256 _amount) external',
  'function recordWin(uint256 _tokenId, uint256 _profit) external',
  'function recordLoss(uint256 _tokenId, uint256 _loss) external',
  'function submitFeedback(uint256 _tokenId, int8 _rating, string calldata _comment) external',

  // Agent management (owner only)
  'function banAgent(uint256 _tokenId) external',
  'function unbanAgent(uint256 _tokenId) external',

  // Events
  'event ReputationUpdated(uint256 indexed tokenId, uint256 accuracyScore, uint256 trustScore)',
  'event FeedbackSubmitted(uint256 indexed tokenId, address indexed from, int8 rating)',
  'event AgentBanned(uint256 indexed tokenId)',
  'event AgentUnbanned(uint256 indexed tokenId)',
] as const;

// Prediction Market Facet ABI
export const PREDICTION_MARKET_ABI = [
  // Market creation
  'function createMarket(string calldata _question, string[] calldata _outcomeNames, uint256 _resolveAt, address _oracle) external returns (bytes32)',
  'function resolveMarket(bytes32 _marketId, uint8 _winningOutcome) external',

  // Trading
  'function buyShares(bytes32 _marketId, uint8 _outcome, uint256 _numShares) external payable',
  'function sellShares(bytes32 _marketId, uint8 _outcome, uint256 _numShares) external',
  'function claimWinnings(bytes32 _marketId) external',
  'function calculateCost(bytes32 _marketId, uint8 _outcome, uint256 _numShares) external view returns (uint256)',
  'function calculateSellPayout(bytes32 _marketId, uint8 _outcome, uint256 _numShares) external view returns (uint256)',

  // Balance management
  'function deposit() external payable',
  'function withdraw(uint256 _amount) external',
  'function getBalance(address _user) external view returns (uint256)',

  // Market queries
  'function getMarket(bytes32 _marketId) external view returns (string memory question, uint8 numOutcomes, uint256 liquidity, bool resolved, uint8 winningOutcome)',
  'function getMarketShares(bytes32 _marketId, uint8 _outcome) external view returns (uint256)',
  'function getPosition(address _user, bytes32 _marketId, uint8 _outcome) external view returns (uint256)',

  // Events
  'event MarketCreated(bytes32 indexed marketId, string question, uint8 numOutcomes, uint256 liquidity)',
  'event SharesPurchased(bytes32 indexed marketId, address indexed buyer, uint8 outcome, uint256 shares, uint256 cost)',
  'event SharesSold(bytes32 indexed marketId, address indexed seller, uint8 outcome, uint256 shares, uint256 payout)',
  'event MarketResolved(bytes32 indexed marketId, uint8 winningOutcome)',
  'event PositionClaimed(bytes32 indexed marketId, address indexed claimer, uint256 payout)',
  'event Deposited(address indexed user, uint256 amount)',
  'event Withdrawn(address indexed user, uint256 amount)',
] as const;

// Oracle Facet ABI
export const ORACLE_ABI = [
  // Oracle resolution requests
  'function requestChainlinkResolution(bytes32 _marketId) external payable',
  'function requestMockResolution(bytes32 _marketId, uint8 _proposedOutcome) external payable',

  // Oracle callbacks
  'function oracleCallback(bytes32 _requestId, bytes32 _marketId, uint8 _outcome) external',
  'function mockOracleCallback(bytes32 _marketId, uint8 _outcome) external',

  // Oracle management
  'function setChainlinkOracle(address _oracle) external',
  'function setMockOracle(address _oracle) external',
  'function manualResolve(bytes32 _marketId, uint8 _outcome) external',
  'function getOracleAddresses() external view returns (address chainlinkOracle, address mockOracle)',

  // Events
  'event OracleRequested(bytes32 indexed marketId, bytes32 indexed requestId, string oracleType)',
  'event OracleResponseReceived(bytes32 indexed marketId, bytes32 indexed requestId, uint8 outcome)',
] as const;

// Oracle-versioned perpetuals ABI fragments
export const PERP_VIEW_ABI = [
  'function getPerpEngineConfig() external view returns (address collateralToken, uint8 collateralDecimals, address oracleUpdater, address feeRecipient, uint16 protocolFeeShareBps, uint32 maxOracleDelay, uint256 nextOrderNonce)',
  'function getPerpAccount(address account) external view returns (uint256 freeCollateral)',
  'function getPerpMarketIds() external view returns (bytes32[] memory marketIds)',
  'function getPerpMarket(bytes32 marketId) external view returns (string memory symbol, uint256 maxOpenInterest, uint256 maxSkew, uint256 skewScale, uint256 minTradeSize, uint16 initialMarginBps, uint16 maintenanceMarginBps, uint16 liquidationFeeBps, uint16 openFeeBps, uint16 closeFeeBps, uint16 maxFundingVelocityBps, uint16 maxPriceImpactBps, uint16 minLiquidityBps, bool active, uint256 totalLongSize, uint256 totalShortSize, uint256 vaultBalance, uint64 latestVersion)',
  'function getPerpOracleVersion(bytes32 marketId, uint64 versionId) external view returns (uint64 timestamp, uint256 price, int256 cumulativeFunding)',
  'function getPerpPosition(address account, bytes32 marketId) external view returns (uint8 side, uint256 size, uint256 collateral, uint256 entryPrice, int256 entryFunding)',
  'function getPerpOrder(bytes32 orderId) external view returns (address account, bytes32 marketId, uint8 side, bool reduceOnly, bool triggerAbove, uint64 createdAt, uint64 executableAtVersion, uint64 expiry, uint256 sizeDelta, uint256 collateralDelta, uint256 triggerPrice, uint256 acceptablePrice, bool active)',
  'function getPerpActiveOrderIds() external view returns (bytes32[] memory orderIds)',
  'function getPerpVaultPosition(address provider, bytes32 marketId) external view returns (uint256 shares, uint256 totalShares, uint256 vaultBalance)',
  'function getPerpProtocolFees(bytes32 marketId) external view returns (uint256)',
  'function previewPerpExecutionPrice(bytes32 marketId, uint256 indexPrice, uint8 side, bool reduceOnly, uint256 sizeDelta) external view returns (uint256)',
] as const;

export const PERP_ADMIN_ABI = [
  'function initializePerpEngine(address collateralToken, address oracleUpdater, address feeRecipient, uint16 protocolFeeShareBps, uint32 maxOracleDelay) external',
  'function createPerpMarket(string symbol, uint256 maxOpenInterest, uint256 maxSkew, uint256 skewScale, uint256 minTradeSize, uint16 initialMarginBps, uint16 maintenanceMarginBps, uint16 liquidationFeeBps, uint16 openFeeBps, uint16 closeFeeBps, uint16 maxFundingVelocityBps, uint16 maxPriceImpactBps, uint16 minLiquidityBps) external returns (bytes32 marketId)',
  'function setPerpMarketStatus(bytes32 marketId, bool active) external',
  'function setPerpOracleUpdater(address oracleUpdater) external',
  'function setPerpFeeRecipient(address feeRecipient) external',
  'function setPerpProtocolFeeShare(uint16 protocolFeeShareBps) external',
] as const;

export const PERP_COLLATERAL_ABI = [
  'function depositPerpCollateral(uint256 rawAmount) external',
  'function withdrawPerpCollateral(uint256 rawAmount) external',
  'function addPerpLiquidity(bytes32 marketId, uint256 rawAmount) external returns (uint256 shares)',
  'function removePerpLiquidity(bytes32 marketId, uint256 shares) external returns (uint256 assets)',
  'function addPerpPositionCollateral(bytes32 marketId, uint256 rawAmount) external',
  'function removePerpPositionCollateral(bytes32 marketId, uint256 rawAmount) external',
  'function claimPerpProtocolFees(bytes32 marketId, address to, uint256 rawAmount) external',
] as const;

export const PERP_ORDER_ABI = [
  'function placePerpMarketOrder(bytes32 marketId, uint8 side, bool reduceOnly, uint256 sizeDelta, uint256 collateralDelta, uint256 acceptablePrice, uint64 expiry) external returns (bytes32 orderId)',
  'function placePerpTriggerOrder(bytes32 marketId, uint8 side, bool reduceOnly, uint256 sizeDelta, uint256 collateralDelta, uint256 triggerPrice, uint256 acceptablePrice, bool triggerAbove, uint64 expiry) external returns (bytes32 orderId)',
  'function cancelPerpOrder(bytes32 orderId) external',
  'event PerpOrderPlaced(bytes32 indexed orderId, address indexed account, bytes32 indexed marketId, bool reduceOnly, uint8 side, uint256 sizeDelta, uint256 collateralDelta, uint256 triggerPrice, uint256 acceptablePrice, uint64 executableAtVersion, bool triggerAbove, uint64 expiry)',
  'event PerpOrderCancelled(bytes32 indexed orderId, address indexed account)',
] as const;

export const PERP_SETTLEMENT_ABI = [
  'function publishPerpOracleVersions(bytes32[] calldata marketIds, uint256[] calldata prices, uint64 timestamp) external',
  'function executePerpOrder(bytes32 orderId) external',
  'function liquidatePerpPosition(address account, bytes32 marketId) external',
  'event PerpOracleVersionPublished(bytes32 indexed marketId, uint64 indexed version, uint64 timestamp, uint256 price, int256 cumulativeFunding)',
  'event PerpOrderExecuted(bytes32 indexed orderId, address indexed account, bytes32 indexed marketId, uint8 side, bool reduceOnly, uint256 sizeDelta, uint256 fillPrice, uint64 version)',
  'event PerpPositionLiquidated(address indexed account, bytes32 indexed marketId, address indexed liquidator, uint256 fillPrice, uint64 version, uint256 liquidatorReward)',
] as const;

export const ERC20_MINIMAL_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function mint(address to, uint256 amount) external',
] as const;

// ProtoMonkeys NFT ABI
export const PROTO_MONKEYS_NFT_ABI = [
  // Mint function with signature verification
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },

  // View functions
  {
    name: 'hasMinted',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'totalMinted',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'availableSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'MAX_SUPPLY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'signer',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'baseURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'isNonceUsed',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'nonce', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },

  // ERC721 standard functions
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },

  // ERC721 transfer functions
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'safeTransferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },

  // ERC721 approval functions
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'setApprovalForAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'getApproved',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'isApprovedForAll',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },

  // Owner functions
  {
    name: 'setSigner',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newSigner', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setBaseURI',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newBaseURI', type: 'string' }],
    outputs: [],
  },

  // Events
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'approved', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'ApprovalForAll',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'operator', type: 'address', indexed: true },
      { name: 'approved', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'NFTMinted',
    inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'nonce', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'SignerUpdated',
    inputs: [
      { name: 'oldSigner', type: 'address', indexed: true },
      { name: 'newSigner', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'BaseURIUpdated',
    inputs: [
      { name: 'oldBaseURI', type: 'string', indexed: false },
      { name: 'newBaseURI', type: 'string', indexed: false },
    ],
  },

  // Errors
  { type: 'error', name: 'InvalidSignature', inputs: [] },
  { type: 'error', name: 'DeadlineExpired', inputs: [] },
  { type: 'error', name: 'NonceAlreadyUsed', inputs: [] },
  { type: 'error', name: 'AlreadyMinted', inputs: [] },
  { type: 'error', name: 'SoldOut', inputs: [] },
  { type: 'error', name: 'InvalidSigner', inputs: [] },
  { type: 'error', name: 'InvalidRecipient', inputs: [] },
] as const;

// Diamond Loupe ABI (for facet discovery)
export const DIAMOND_LOUPE_ABI = [
  'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[] memory)',
  'function facetFunctionSelectors(address facet) external view returns (bytes4[] memory)',
  'function facetAddresses() external view returns (address[] memory)',
  'function facetAddress(bytes4 functionSelector) external view returns (address)',
] as const;

// Price Storage Facet ABI
export const PRICE_STORAGE_FACET_ABI = [
  // Price updates
  'function updatePrices(bytes32[] calldata _marketIds, uint256 _tick, uint256[] calldata _prices) external',
  'function updatePrice(bytes32 _marketId, uint256 _tick, uint256 _price) external',
  'function submitPriceBatch(bytes32 _marketId, uint256 _startTick, uint256 _endTick, bytes32 _merkleRoot) external',

  // Price queries
  'function getLatestPrice(bytes32 _marketId) external view returns (uint256 price, uint256 timestamp, uint256 tick)',
  'function getPriceAtTick(bytes32 _marketId, uint256 _tick) external view returns (uint256 price, uint256 timestamp)',
  'function getGlobalTickCounter() external view returns (uint256)',

  // Authorization
  'function incrementTickCounter() external returns (uint256)',
  'function setAuthorizedUpdater(bytes32 _marketId, address _updater) external',
  'function getAuthorizedUpdater(bytes32 _marketId) external view returns (address)',

  // Events
  'event PriceUpdated(bytes32 indexed marketId, uint256 indexed tick, uint256 price, uint256 timestamp)',
  'event PricesBatchUpdated(bytes32[] marketIds, uint256 tick, uint256 timestamp)',
  'event PriceBatchSubmitted(bytes32 indexed marketId, uint256 startTick, uint256 endTick, bytes32 merkleRoot)',
  'event AuthorizedUpdaterSet(bytes32 indexed marketId, address indexed updater, bool authorized)',
] as const;

// Minimal ERC-20 ABI for balance reads and transfers
export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
] as const;

// ERC-721 transfer ABI (for NFT sends in Phase 4)
export const ERC721_TRANSFER_ABI = [
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
] as const;
