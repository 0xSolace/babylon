import { parseAbi, parseAbiItem } from 'viem';

export const BABYLON_PREDICTION_AMM_ROUTER_ABI = parseAbi([
  'function createMarket(string marketId,string question,string resolutionSource,uint256 resolveAt,bool isDynamic,uint256 initialLiquidity) returns (bytes32 marketKey,address marketAddress)',
  'function linkMarketToSession(bytes32 marketKey,bytes32 sessionId)',
  'function setMarketCancelled(bytes32 marketKey,bool cancelled)',
  'function buyShares(bytes32 marketKey,uint8 outcome,uint256 collateralIn,uint256 minSharesOut) returns (uint256 sharesOut)',
  'function sellShares(bytes32 marketKey,uint8 outcome,uint256 sharesIn,uint256 minSharesOut) returns (uint256 sharesOut)',
  'function claimAll(bytes32 marketKey) returns (uint256 payout)',
  'function settleFromOracle(bytes32 marketKey)',
  'function getMarketAddress(bytes32 marketKey) view returns (address)',
  'event PredictionMarketCreated(bytes32 indexed marketKey,address indexed marketAddress,string marketId,string question,string resolutionSource,uint256 resolveAt,uint256 initialLiquidity)',
  'event PredictionMarketLinked(bytes32 indexed marketKey,bytes32 indexed sessionId)',
  'event PredictionSharesBought(bytes32 indexed marketKey,address indexed buyer,uint8 indexed outcome,uint256 collateralIn,uint256 sharesOut)',
  'event PredictionSharesSwapped(bytes32 indexed marketKey,address indexed trader,uint8 indexed outcomeIn,uint8 outcomeOut,uint256 sharesIn,uint256 sharesOut)',
  'event PredictionClaimed(bytes32 indexed marketKey,address indexed trader,uint256 yesShares,uint256 noShares,uint256 payout)',
  'event PredictionMarketSettled(bytes32 indexed marketKey,uint8 indexed outcome,bool cancelled)',
]);

export const PREDICTION_SHARES_BOUGHT_EVENT = parseAbiItem(
  'event PredictionSharesBought(bytes32 indexed marketKey,address indexed buyer,uint8 indexed outcome,uint256 collateralIn,uint256 sharesOut)'
);

export const PREDICTION_SHARES_SWAPPED_EVENT = parseAbiItem(
  'event PredictionSharesSwapped(bytes32 indexed marketKey,address indexed trader,uint8 indexed outcomeIn,uint8 outcomeOut,uint256 sharesIn,uint256 sharesOut)'
);

export const PREDICTION_CLAIMED_EVENT = parseAbiItem(
  'event PredictionClaimed(bytes32 indexed marketKey,address indexed trader,uint256 yesShares,uint256 noShares,uint256 payout)'
);

export const PREDICTION_MARKET_SETTLED_EVENT = parseAbiItem(
  'event PredictionMarketSettled(bytes32 indexed marketKey,uint8 indexed outcome,bool cancelled)'
);
