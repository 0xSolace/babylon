// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../core/Diamond.sol";
import "../core/DiamondCutFacet.sol";
import "../core/DiamondLoupeFacet.sol";
import "../core/PredictionMarketFacet.sol";
import "../core/OracleFacet.sol";
import "../core/GameOracleFacet.sol";
import "../core/ReferralSystemFacet.sol";
import "../core/PerpAdminFacet.sol";
import "../core/PerpCollateralFacet.sol";
import "../core/PerpOrderFacet.sol";
import "../core/PerpSettlementFacet.sol";
import "../core/PerpViewFacet.sol";
import "../identity/ERC8004IdentityRegistry.sol";
import "../identity/ERC8004ReputationSystem.sol";
import "../oracles/ChainlinkOracleMock.sol";
import "../oracles/MockOracle.sol";
import "../libraries/LibDiamond.sol";

// Oracle system - Game as Prediction Oracle
import {BabylonGameOracle} from "../src/game/BabylonGameOracle.sol";
import {BanManager} from "../src/moderation/BanManager.sol";
import {BabylonPredictionAMMRouter} from "../src/prediction-markets/BabylonPredictionAMMRouter.sol";
import {BabylonPredictionOracleAdapter} from "../src/prediction-markets/BabylonPredictionOracleAdapter.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";

/// @title DeployBabylon
/// @notice Deployment script for Babylon prediction market on Base L2
/// @dev Consolidated architecture: Diamond + BabylonGameOracle
/// 
/// Architecture:
/// - Diamond: legacy prediction + current perp / identity facets
/// - BabylonGameOracle: IPredictionOracle interface for game outcomes
/// - BabylonPredictionOracleAdapter: bridges BabylonGameOracle outcomes into PM-AMM markets
/// - BabylonPredictionAMMRouter: deploys and manages Hyperbet-style PM-AMM markets
/// - GameOracleFacet: legacy bridge for diamond-based prediction resolution
/// 
/// Flow:
/// 1. Game engine commits/reveals outcomes to BabylonGameOracle
/// 2. BabylonGameOracle stores outcomes on-chain
/// 3. GameOracleFacet reads outcomes and resolves Diamond markets
/// 4. External contracts can query BabylonGameOracle directly
contract DeployBabylon is Script {
    // Deployed contracts - Diamond system
    Diamond public diamond;
    DiamondCutFacet public diamondCutFacet;
    DiamondLoupeFacet public diamondLoupeFacet;
    PredictionMarketFacet public predictionMarketFacet;
    OracleFacet public oracleFacet;
    GameOracleFacet public gameOracleFacet;
    ReferralSystemFacet public referralSystemFacet;
    PerpAdminFacet public perpAdminFacet;
    PerpCollateralFacet public perpCollateralFacet;
    PerpOrderFacet public perpOrderFacet;
    PerpSettlementFacet public perpSettlementFacet;
    PerpViewFacet public perpViewFacet;
    
    // Identity system
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationSystem public reputationSystem;
    
    // Oracle mocks
    ChainlinkOracleMock public chainlinkOracle;
    MockOracle public mockOracle;
    
    // Game Oracle - The game IS the prediction oracle
    BabylonGameOracle public babylonOracle;
    BabylonPredictionOracleAdapter public predictionOracleAdapter;
    BabylonPredictionAMMRouter public predictionAmmRouter;
    
    // Moderation
    BanManager public banManager;
    
    // Perp collateral token
    MockUSDC public mockUsdc;
    address public perpCollateralToken;
    address public predictionCollateralToken;

    // Deployment configuration
    address public deployer;
    address public gameServer;
    address public feeRecipient;
    uint256 public predictionFeeBps;

    function run() external {
        // Get deployer from private key
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);
        gameServer = vm.envOr("ORACLE_SIGNER", deployer);

        // Set fee recipient (can be changed later)
        feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        predictionFeeBps = vm.envOr("PREDICTION_MARKET_FEE_BPS", uint256(50));

        console.log("Deploying Babylon to Base L2...");
        console.log("Deployer:", deployer);
        console.log("Game Server:", gameServer);
        console.log("Fee Recipient:", feeRecipient);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy facets
        console.log("\n1. Deploying facets...");
        diamondCutFacet = new DiamondCutFacet();
        console.log("DiamondCutFacet:", address(diamondCutFacet));

        diamondLoupeFacet = new DiamondLoupeFacet();
        console.log("DiamondLoupeFacet:", address(diamondLoupeFacet));

        predictionMarketFacet = new PredictionMarketFacet();
        console.log("PredictionMarketFacet:", address(predictionMarketFacet));

        oracleFacet = new OracleFacet();
        console.log("OracleFacet:", address(oracleFacet));
        
        gameOracleFacet = new GameOracleFacet();
        console.log("GameOracleFacet:", address(gameOracleFacet));

        // 2. Deploy Diamond with DiamondCutFacet
        console.log("\n2. Deploying Diamond...");
        diamond = new Diamond(address(diamondCutFacet), address(diamondLoupeFacet));
        console.log("Diamond:", address(diamond));

        // 3. Add DiamondLoupeFacet
        console.log("\n3. Adding DiamondLoupeFacet...");
        IDiamondCut.FacetCut[] memory loupeCut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory loupeSelectors = new bytes4[](5);
        loupeSelectors[0] = DiamondLoupeFacet.facets.selector;
        loupeSelectors[1] = DiamondLoupeFacet.facetFunctionSelectors.selector;
        loupeSelectors[2] = DiamondLoupeFacet.facetAddresses.selector;
        loupeSelectors[3] = DiamondLoupeFacet.facetAddress.selector;
        loupeSelectors[4] = bytes4(keccak256("supportsInterface(bytes4)"));

        loupeCut[0] = IDiamondCut.FacetCut({
            facetAddress: address(diamondLoupeFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: loupeSelectors
        });

        IDiamondCut(address(diamond)).diamondCut(loupeCut, address(0), "");

        // 4. Add PredictionMarketFacet
        console.log("\n4. Adding PredictionMarketFacet...");
        IDiamondCut.FacetCut[] memory marketCut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory marketSelectors = new bytes4[](14);
        marketSelectors[0] = PredictionMarketFacet.createMarket.selector;
        marketSelectors[1] = PredictionMarketFacet.calculateCost.selector;
        marketSelectors[2] = PredictionMarketFacet.calculateCostWithFee.selector;
        marketSelectors[3] = PredictionMarketFacet.buyShares.selector;
        marketSelectors[4] = PredictionMarketFacet.sellShares.selector;
        marketSelectors[5] = PredictionMarketFacet.calculateSellPayout.selector;
        marketSelectors[6] = PredictionMarketFacet.resolveMarket.selector;
        marketSelectors[7] = PredictionMarketFacet.claimWinnings.selector;
        marketSelectors[8] = PredictionMarketFacet.deposit.selector;
        marketSelectors[9] = PredictionMarketFacet.withdraw.selector;
        marketSelectors[10] = PredictionMarketFacet.getBalance.selector;
        marketSelectors[11] = PredictionMarketFacet.getMarket.selector;
        marketSelectors[12] = PredictionMarketFacet.getMarketShares.selector;
        marketSelectors[13] = PredictionMarketFacet.getPosition.selector;

        marketCut[0] = IDiamondCut.FacetCut({
            facetAddress: address(predictionMarketFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: marketSelectors
        });

        IDiamondCut(address(diamond)).diamondCut(marketCut, address(0), "");

        // 5. Add OracleFacet
        console.log("\n5. Adding OracleFacet...");
        IDiamondCut.FacetCut[] memory oracleCut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory oracleSelectors = new bytes4[](8);
        oracleSelectors[0] = OracleFacet.requestChainlinkResolution.selector;
        oracleSelectors[1] = OracleFacet.requestMockResolution.selector;
        oracleSelectors[2] = OracleFacet.oracleCallback.selector;
        oracleSelectors[3] = OracleFacet.mockOracleCallback.selector;
        oracleSelectors[4] = OracleFacet.setChainlinkOracle.selector;
        oracleSelectors[5] = OracleFacet.setMockOracle.selector;
        oracleSelectors[6] = OracleFacet.manualResolve.selector;
        oracleSelectors[7] = OracleFacet.getOracleAddresses.selector;

        oracleCut[0] = IDiamondCut.FacetCut({
            facetAddress: address(oracleFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: oracleSelectors
        });

        IDiamondCut(address(diamond)).diamondCut(oracleCut, address(0), "");
        
        // 5b. Add GameOracleFacet
        console.log("\n5b. Adding GameOracleFacet...");
        IDiamondCut.FacetCut[] memory gameOracleCut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory gameOracleSelectors = new bytes4[](9);
        gameOracleSelectors[0] = GameOracleFacet.setGameOracle.selector;
        gameOracleSelectors[1] = GameOracleFacet.getGameOracle.selector;
        gameOracleSelectors[2] = GameOracleFacet.linkMarketToSession.selector;
        gameOracleSelectors[3] = GameOracleFacet.getSessionForMarket.selector;
        gameOracleSelectors[4] = GameOracleFacet.getMarketForSession.selector;
        gameOracleSelectors[5] = GameOracleFacet.resolveFromGameOracle.selector;
        gameOracleSelectors[6] = GameOracleFacet.queryOracleOutcome.selector;
        gameOracleSelectors[7] = GameOracleFacet.isWinnerInSession.selector;
        gameOracleSelectors[8] = GameOracleFacet.createMarketForSession.selector;

        gameOracleCut[0] = IDiamondCut.FacetCut({
            facetAddress: address(gameOracleFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: gameOracleSelectors
        });

        IDiamondCut(address(diamond)).diamondCut(gameOracleCut, address(0), "");

        // 6. Deploy and add referral + oracle-versioned perp facets
        console.log("\n6. Deploying referral and perp facets...");
        referralSystemFacet = new ReferralSystemFacet();
        console.log("ReferralSystemFacet:", address(referralSystemFacet));
        
        perpAdminFacet = new PerpAdminFacet();
        console.log("PerpAdminFacet:", address(perpAdminFacet));

        perpCollateralFacet = new PerpCollateralFacet();
        console.log("PerpCollateralFacet:", address(perpCollateralFacet));

        perpOrderFacet = new PerpOrderFacet();
        console.log("PerpOrderFacet:", address(perpOrderFacet));

        perpSettlementFacet = new PerpSettlementFacet();
        console.log("PerpSettlementFacet:", address(perpSettlementFacet));

        perpViewFacet = new PerpViewFacet();
        console.log("PerpViewFacet:", address(perpViewFacet));

        // 7. Add new facets to Diamond
        console.log("\n7. Adding new facets to Diamond...");
        IDiamondCut.FacetCut[] memory newFacetsCut = new IDiamondCut.FacetCut[](6);

        // ReferralSystemFacet selectors
        bytes4[] memory referralSelectors = new bytes4[](12);
        referralSelectors[0] = ReferralSystemFacet.registerReferral.selector;
        referralSelectors[1] = ReferralSystemFacet.payReferralCommission.selector;
        referralSelectors[2] = ReferralSystemFacet.claimReferralEarnings.selector;
        referralSelectors[3] = ReferralSystemFacet.initializeReferralSystem.selector;
        referralSelectors[4] = ReferralSystemFacet.getReferralData.selector;
        referralSelectors[5] = ReferralSystemFacet.getTierInfo.selector;
        referralSelectors[6] = ReferralSystemFacet.getReferralChain.selector;
        referralSelectors[7] = ReferralSystemFacet.getTotalStats.selector;
        referralSelectors[8] = ReferralSystemFacet.getTotalReferrals.selector;
        referralSelectors[9] = ReferralSystemFacet.getTotalCommissions.selector;
        referralSelectors[10] = ReferralSystemFacet.isReferred.selector;
        referralSelectors[11] = ReferralSystemFacet.calculateCommission.selector;

        newFacetsCut[0] = IDiamondCut.FacetCut({
            facetAddress: address(referralSystemFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: referralSelectors
        });

        // PerpAdminFacet selectors
        bytes4[] memory perpAdminSelectors = new bytes4[](6);
        perpAdminSelectors[0] = PerpAdminFacet.initializePerpEngine.selector;
        perpAdminSelectors[1] = PerpAdminFacet.createPerpMarket.selector;
        perpAdminSelectors[2] = PerpAdminFacet.setPerpMarketStatus.selector;
        perpAdminSelectors[3] = PerpAdminFacet.setPerpOracleUpdater.selector;
        perpAdminSelectors[4] = PerpAdminFacet.setPerpFeeRecipient.selector;
        perpAdminSelectors[5] = PerpAdminFacet.setPerpProtocolFeeShare.selector;

        newFacetsCut[1] = IDiamondCut.FacetCut({
            facetAddress: address(perpAdminFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpAdminSelectors
        });

        // PerpCollateralFacet selectors
        bytes4[] memory perpCollateralSelectors = new bytes4[](7);
        perpCollateralSelectors[0] = PerpCollateralFacet.depositPerpCollateral.selector;
        perpCollateralSelectors[1] = PerpCollateralFacet.withdrawPerpCollateral.selector;
        perpCollateralSelectors[2] = PerpCollateralFacet.addPerpLiquidity.selector;
        perpCollateralSelectors[3] = PerpCollateralFacet.removePerpLiquidity.selector;
        perpCollateralSelectors[4] = PerpCollateralFacet.addPerpPositionCollateral.selector;
        perpCollateralSelectors[5] = PerpCollateralFacet.removePerpPositionCollateral.selector;
        perpCollateralSelectors[6] = PerpCollateralFacet.claimPerpProtocolFees.selector;

        newFacetsCut[2] = IDiamondCut.FacetCut({
            facetAddress: address(perpCollateralFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpCollateralSelectors
        });

        // PerpOrderFacet selectors
        bytes4[] memory perpOrderSelectors = new bytes4[](3);
        perpOrderSelectors[0] = PerpOrderFacet.placePerpMarketOrder.selector;
        perpOrderSelectors[1] = PerpOrderFacet.placePerpTriggerOrder.selector;
        perpOrderSelectors[2] = PerpOrderFacet.cancelPerpOrder.selector;

        newFacetsCut[3] = IDiamondCut.FacetCut({
            facetAddress: address(perpOrderFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpOrderSelectors
        });

        // PerpSettlementFacet selectors
        bytes4[] memory perpSettlementSelectors = new bytes4[](3);
        perpSettlementSelectors[0] = PerpSettlementFacet.publishPerpOracleVersions.selector;
        perpSettlementSelectors[1] = PerpSettlementFacet.executePerpOrder.selector;
        perpSettlementSelectors[2] = PerpSettlementFacet.liquidatePerpPosition.selector;

        newFacetsCut[4] = IDiamondCut.FacetCut({
            facetAddress: address(perpSettlementFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpSettlementSelectors
        });

        // PerpViewFacet selectors
        bytes4[] memory perpViewSelectors = new bytes4[](11);
        perpViewSelectors[0] = PerpViewFacet.getPerpEngineConfig.selector;
        perpViewSelectors[1] = PerpViewFacet.getPerpAccount.selector;
        perpViewSelectors[2] = PerpViewFacet.getPerpMarketIds.selector;
        perpViewSelectors[3] = PerpViewFacet.getPerpMarket.selector;
        perpViewSelectors[4] = PerpViewFacet.getPerpOracleVersion.selector;
        perpViewSelectors[5] = PerpViewFacet.getPerpPosition.selector;
        perpViewSelectors[6] = PerpViewFacet.getPerpOrder.selector;
        perpViewSelectors[7] = PerpViewFacet.getPerpActiveOrderIds.selector;
        perpViewSelectors[8] = PerpViewFacet.getPerpVaultPosition.selector;
        perpViewSelectors[9] = PerpViewFacet.getPerpProtocolFees.selector;
        perpViewSelectors[10] = PerpViewFacet.previewPerpExecutionPrice.selector;

        newFacetsCut[5] = IDiamondCut.FacetCut({
            facetAddress: address(perpViewFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpViewSelectors
        });

        IDiamondCut(address(diamond)).diamondCut(newFacetsCut, address(0), "");

        // 8. Deploy ERC-8004 Identity Registry
        console.log("\n8. Deploying ERC-8004 Identity Registry...");
        identityRegistry = new ERC8004IdentityRegistry();
        console.log("IdentityRegistry:", address(identityRegistry));

        // 9. Deploy ERC-8004 Reputation System
        console.log("\n9. Deploying ERC-8004 Reputation System...");
        reputationSystem = new ERC8004ReputationSystem(address(identityRegistry));
        console.log("ReputationSystem:", address(reputationSystem));

        // 10. Deploy Oracle Mocks (for testnet)
        if (block.chainid == 84532 || block.chainid == 31337) { // Base Sepolia or Localnet
            console.log("\n10. Deploying Oracle Mocks (Testnet)...");
            chainlinkOracle = new ChainlinkOracleMock();
            console.log("ChainlinkOracle:", address(chainlinkOracle));

            mockOracle = new MockOracle();
            console.log("MockOracle:", address(mockOracle));

            // Set oracle addresses in diamond
            OracleFacet(address(diamond)).setChainlinkOracle(address(chainlinkOracle));
            OracleFacet(address(diamond)).setMockOracle(address(mockOracle));
        } else {
            console.log("\n10. Skipping Oracle Mocks (Mainnet - use real oracles)");
        }

        // 10b. Configure perp collateral
        if (block.chainid == 84532 || block.chainid == 31337) {
            console.log("\n10b. Deploying Mock USDC collateral...");
            mockUsdc = new MockUSDC();
            mockUsdc.mint(deployer, 10_000_000 * 1e6);
            perpCollateralToken = address(mockUsdc);
            predictionCollateralToken = address(mockUsdc);
            console.log("MockUSDC:", perpCollateralToken);
        } else {
            perpCollateralToken = vm.envAddress("PERP_COLLATERAL_TOKEN");
            predictionCollateralToken = vm.envOr("PREDICTION_COLLATERAL_TOKEN", perpCollateralToken);
            console.log("\n10b. Using configured perp collateral:", perpCollateralToken);
            console.log("Prediction collateral:", predictionCollateralToken);
        }
        
        // 11. Deploy Babylon Game Oracle - THE GAME IS THE PREDICTION ORACLE
        console.log("\n11. Deploying Babylon Game Oracle (IPredictionOracle)...");
        babylonOracle = new BabylonGameOracle(gameServer);
        console.log("BabylonGameOracle:", address(babylonOracle));

        console.log("\n11b. Deploying Babylon PM-AMM oracle adapter...");
        predictionOracleAdapter = new BabylonPredictionOracleAdapter(address(babylonOracle), deployer);
        console.log("BabylonPredictionOracleAdapter:", address(predictionOracleAdapter));

        console.log("\n11c. Deploying Babylon PM-AMM router...");
        predictionAmmRouter = new BabylonPredictionAMMRouter(
            predictionCollateralToken,
            address(predictionOracleAdapter),
            feeRecipient,
            predictionFeeBps,
            deployer
        );
        predictionOracleAdapter.transferOwnership(address(predictionAmmRouter));
        console.log("BabylonPredictionAMMRouter:", address(predictionAmmRouter));
        
        // 12. Configure GameOracleFacet to use BabylonGameOracle
        console.log("\n12. Configuring GameOracleFacet...");
        GameOracleFacet(address(diamond)).setGameOracle(address(babylonOracle));
        console.log("GameOracle set in Diamond");
        
        // 13. Deploy BanManager (standalone moderation)
        console.log("\n13. Deploying BanManager...");
        banManager = new BanManager(deployer, deployer); // governance, owner
        console.log("BanManager:", address(banManager));

        // 14. Initialize the perp engine
        console.log("\n14. Initializing perp engine...");
        PerpAdminFacet(address(diamond)).initializePerpEngine(
            perpCollateralToken,
            deployer,
            feeRecipient,
            2_000,
            2 hours
        );
        console.log("Perp engine initialized with collateral:", perpCollateralToken);

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n=================== DEPLOYMENT SUMMARY ===================");
        console.log("\n--- Diamond System ---");
        console.log("Diamond (Proxy):", address(diamond));
        console.log("DiamondCutFacet:", address(diamondCutFacet));
        console.log("DiamondLoupeFacet:", address(diamondLoupeFacet));
        console.log("PredictionMarketFacet:", address(predictionMarketFacet));
        console.log("OracleFacet:", address(oracleFacet));
        console.log("GameOracleFacet:", address(gameOracleFacet));
        console.log("ReferralSystemFacet:", address(referralSystemFacet));
        console.log("PerpAdminFacet:", address(perpAdminFacet));
        console.log("PerpCollateralFacet:", address(perpCollateralFacet));
        console.log("PerpOrderFacet:", address(perpOrderFacet));
        console.log("PerpSettlementFacet:", address(perpSettlementFacet));
        console.log("PerpViewFacet:", address(perpViewFacet));
        
        console.log("\n--- Identity System ---");
        console.log("IdentityRegistry:", address(identityRegistry));
        console.log("ReputationSystem:", address(reputationSystem));
        
        console.log("\n--- Game Oracle (IPredictionOracle) ---");
        console.log("BabylonGameOracle:", address(babylonOracle));
        console.log("BabylonPredictionOracleAdapter:", address(predictionOracleAdapter));
        console.log("BabylonPredictionAMMRouter:", address(predictionAmmRouter));
        console.log("  -> External contracts query: oracle.getOutcome(sessionId)");
        console.log("  -> PM-AMM markets settle via: BabylonPredictionAMMRouter.settleFromOracle()");
        
        console.log("\n--- Moderation ---");
        console.log("BanManager:", address(banManager));
        
        if (block.chainid == 84532 || block.chainid == 31337) {
            console.log("\n--- Test Infrastructure ---");
            console.log("ChainlinkOracle (Mock):", address(chainlinkOracle));
            console.log("MockOracle:", address(mockOracle));
            console.log("MockUSDC:", address(mockUsdc));
        }
        
        console.log("\n==========================================================");
    }
}
