// Babylon Contract ABIs
import BabylonDiamondJson from '../abis/BabylonDiamond.json'
import BabylonDiamondCutFacetJson from '../abis/BabylonDiamondCutFacet.json'
import BabylonDiamondLoupeFacetJson from '../abis/BabylonDiamondLoupeFacet.json'
import BabylonERC8004IdentityRegistryJson from '../abis/BabylonERC8004IdentityRegistry.json'
import BabylonERC8004ReputationSystemJson from '../abis/BabylonERC8004ReputationSystem.json'
import BabylonOracleFacetJson from '../abis/BabylonOracleFacet.json'
import BabylonPredictionMarketFacetJson from '../abis/BabylonPredictionMarketFacet.json'

export const BabylonDiamondAbi = BabylonDiamondJson.abi
export const BabylonDiamondCutFacetAbi = BabylonDiamondCutFacetJson.abi
export const BabylonDiamondLoupeFacetAbi = BabylonDiamondLoupeFacetJson.abi
export const BabylonERC8004IdentityRegistryAbi =
  BabylonERC8004IdentityRegistryJson.abi
export const BabylonERC8004ReputationSystemAbi =
  BabylonERC8004ReputationSystemJson.abi
export const BabylonOracleFacetAbi = BabylonOracleFacetJson.abi
export const BabylonPredictionMarketFacetAbi =
  BabylonPredictionMarketFacetJson.abi

// Alias exports for convenience
export const DIAMOND_ABI = BabylonDiamondAbi
export const DIAMOND_CUT_ABI = BabylonDiamondCutFacetAbi
export const DIAMOND_LOUPE_ABI = BabylonDiamondLoupeFacetAbi
export const ORACLE_ABI = BabylonOracleFacetAbi
export const PREDICTION_MARKET_ABI = BabylonPredictionMarketFacetAbi
export const IDENTITY_REGISTRY_ABI = BabylonERC8004IdentityRegistryAbi
export const REPUTATION_SYSTEM_ABI = BabylonERC8004ReputationSystemAbi
