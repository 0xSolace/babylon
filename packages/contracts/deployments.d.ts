declare module '@babylon/contracts/deployments/local' {
  interface Contracts {
    diamond: string;
    diamondCutFacet: string;
    diamondLoupeFacet: string;
    predictionMarketFacet: string;
    oracleFacet: string;
    gameOracleFacet?: string;
    liquidityPoolFacet?: string;
    perpetualMarketFacet?: string;
    referralSystemFacet: string;
    priceStorageFacet?: string;
    perpAdminFacet?: string;
    perpCollateralFacet?: string;
    perpOrderFacet?: string;
    perpSettlementFacet?: string;
    perpViewFacet?: string;
    identityRegistry: string;
    reputationSystem: string;
    babylonOracle: string;
    banManager?: string;
    chainlinkOracle?: string;
    mockOracle?: string;
    mockUsdc?: string;
    testToken?: string;
  }

  interface Deployment {
    network: string;
    chainId: number;
    contracts: Contracts;
    deployer: string;
    timestamp: string;
    blockNumber: number;
  }

  const deployment: Deployment;
  export default deployment;
}

declare module '@babylon/contracts/deployments/base-sepolia' {
  interface Contracts {
    diamond: string;
    diamondCutFacet: string;
    diamondLoupeFacet: string;
    predictionMarketFacet: string;
    oracleFacet: string;
    gameOracleFacet?: string;
    liquidityPoolFacet?: string;
    perpetualMarketFacet?: string;
    referralSystemFacet: string;
    priceStorageFacet?: string;
    perpAdminFacet?: string;
    perpCollateralFacet?: string;
    perpOrderFacet?: string;
    perpSettlementFacet?: string;
    perpViewFacet?: string;
    identityRegistry: string;
    reputationSystem: string;
    babylonOracle?: string;
    banManager?: string;
    chainlinkOracle?: string;
    mockOracle?: string;
    mockUsdc?: string;
    testToken?: string;
  }

  interface Deployment {
    network: string;
    chainId: number;
    contracts: Contracts;
    deployer: string;
    timestamp: string;
    blockNumber: number;
  }

  const deployment: Deployment;
  export default deployment;
}

declare module '@babylon/contracts/deployments/base' {
  interface Contracts {
    diamond: string;
    diamondCutFacet: string;
    diamondLoupeFacet: string;
    predictionMarketFacet: string;
    oracleFacet: string;
    gameOracleFacet?: string;
    liquidityPoolFacet?: string;
    perpetualMarketFacet?: string;
    referralSystemFacet: string;
    priceStorageFacet?: string;
    perpAdminFacet?: string;
    perpCollateralFacet?: string;
    perpOrderFacet?: string;
    perpSettlementFacet?: string;
    perpViewFacet?: string;
    identityRegistry: string;
    reputationSystem: string;
    babylonOracle?: string;
    banManager?: string;
    chainlinkOracle?: string;
    mockOracle?: string;
    mockUsdc?: string;
    testToken?: string;
  }

  interface Deployment {
    network: string;
    chainId: number;
    contracts: Contracts;
    deployer: string;
    timestamp: string;
    blockNumber: number;
  }

  const deployment: Deployment;
  export default deployment;
}
