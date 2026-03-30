// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../core/Diamond.sol";
import "../core/DiamondCutFacet.sol";
import "../core/LiquidityPoolFacet.sol";
import "../core/PerpetualMarketFacet.sol";
import "../core/ReferralSystemFacet.sol";
import "../core/PerpAdminFacet.sol";
import "../core/PerpCollateralFacet.sol";
import "../core/PerpOrderFacet.sol";
import "../core/PerpSettlementFacet.sol";
import "../core/PerpViewFacet.sol";
import "../libraries/LibDiamond.sol";
import "../interfaces/IDiamondLoupe.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";

/// @title UpgradeDiamond
/// @notice Upgrade script to add new facets to existing Diamond deployment
/// @dev Adds LiquidityPoolFacet, PerpetualMarketFacet, and ReferralSystemFacet
contract UpgradeDiamond is Script {
    // Existing Diamond address (from deployment)
    address public diamondAddress;

    // New facets to deploy
    LiquidityPoolFacet public liquidityPoolFacet;
    PerpetualMarketFacet public perpetualMarketFacet;
    ReferralSystemFacet public referralSystemFacet;
    PerpAdminFacet public perpAdminFacet;
    PerpCollateralFacet public perpCollateralFacet;
    PerpOrderFacet public perpOrderFacet;
    PerpSettlementFacet public perpSettlementFacet;
    PerpViewFacet public perpViewFacet;
    MockUSDC public mockUsdc;
    address public perpCollateralToken;

    // Deployer
    address public deployer;

    function run() external {
        // Get deployer from private key
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);

        // Get existing Diamond address from environment or use default
        diamondAddress = vm.envOr("DIAMOND_ADDRESS", address(0));
        require(diamondAddress != address(0), "DIAMOND_ADDRESS not set in environment");

        console.log("Upgrading Diamond with new facets...");
        console.log("Diamond Address:", diamondAddress);
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy new facets
        console.log("\n1. Deploying new facets...");
        liquidityPoolFacet = new LiquidityPoolFacet();
        console.log("LiquidityPoolFacet:", address(liquidityPoolFacet));

        perpetualMarketFacet = new PerpetualMarketFacet();
        console.log("PerpetualMarketFacet:", address(perpetualMarketFacet));

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

        // 2. Prepare facet cuts
        console.log("\n2. Preparing facet cuts...");
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](8);

        // 2a. LiquidityPoolFacet selectors
        bytes4[] memory liquiditySelectors = new bytes4[](14);
        liquiditySelectors[0] = LiquidityPoolFacet.createLiquidityPool.selector;
        liquiditySelectors[1] = LiquidityPoolFacet.addLiquidity.selector;
        liquiditySelectors[2] = LiquidityPoolFacet.removeLiquidity.selector;
        liquiditySelectors[3] = LiquidityPoolFacet.swap.selector;
        liquiditySelectors[4] = LiquidityPoolFacet.setPoolActive.selector;
        liquiditySelectors[5] = LiquidityPoolFacet.claimRewards.selector;
        liquiditySelectors[6] = LiquidityPoolFacet.getPool.selector;
        liquiditySelectors[7] = LiquidityPoolFacet.getLPPosition.selector;
        liquiditySelectors[8] = LiquidityPoolFacet.getReserves.selector;
        liquiditySelectors[9] = LiquidityPoolFacet.getSwapOutput.selector;
        liquiditySelectors[10] = LiquidityPoolFacet.getPriceImpact.selector;
        liquiditySelectors[11] = LiquidityPoolFacet.getUtilization.selector;
        liquiditySelectors[12] = LiquidityPoolFacet.getImpermanentLoss.selector;
        liquiditySelectors[13] = LiquidityPoolFacet.getPendingRewards.selector;

        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(liquidityPoolFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: liquiditySelectors
        });
        console.log("LiquidityPoolFacet: %d selectors", liquiditySelectors.length);

        // 2b. PerpetualMarketFacet selectors
        bytes4[] memory perpetualSelectors = new bytes4[](10);
        perpetualSelectors[0] = PerpetualMarketFacet.createPerpetualMarket.selector;
        perpetualSelectors[1] = PerpetualMarketFacet.openPosition.selector;
        perpetualSelectors[2] = PerpetualMarketFacet.closePosition.selector;
        perpetualSelectors[3] = PerpetualMarketFacet.liquidatePosition.selector;
        perpetualSelectors[4] = PerpetualMarketFacet.updateFundingRate.selector;
        perpetualSelectors[5] = PerpetualMarketFacet.getPerpetualMarket.selector;
        perpetualSelectors[6] = PerpetualMarketFacet.getPosition.selector;
        perpetualSelectors[7] = PerpetualMarketFacet.getLiquidationPrice.selector;
        perpetualSelectors[8] = PerpetualMarketFacet.getMarkPrice.selector;
        perpetualSelectors[9] = PerpetualMarketFacet.getFundingRate.selector;

        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(perpetualMarketFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpetualSelectors
        });
        console.log("PerpetualMarketFacet: %d selectors", perpetualSelectors.length);

        // 2c. ReferralSystemFacet selectors
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

        cuts[2] = IDiamondCut.FacetCut({
            facetAddress: address(referralSystemFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: referralSelectors
        });
        console.log("ReferralSystemFacet: %d selectors", referralSelectors.length);

        // 2d. PerpAdminFacet selectors
        bytes4[] memory perpAdminSelectors = new bytes4[](6);
        perpAdminSelectors[0] = PerpAdminFacet.initializePerpEngine.selector;
        perpAdminSelectors[1] = PerpAdminFacet.createPerpMarket.selector;
        perpAdminSelectors[2] = PerpAdminFacet.setPerpMarketStatus.selector;
        perpAdminSelectors[3] = PerpAdminFacet.setPerpOracleUpdater.selector;
        perpAdminSelectors[4] = PerpAdminFacet.setPerpFeeRecipient.selector;
        perpAdminSelectors[5] = PerpAdminFacet.setPerpProtocolFeeShare.selector;

        cuts[3] = IDiamondCut.FacetCut({
            facetAddress: address(perpAdminFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpAdminSelectors
        });
        console.log("PerpAdminFacet: %d selectors", perpAdminSelectors.length);

        // 2e. PerpCollateralFacet selectors
        bytes4[] memory perpCollateralSelectors = new bytes4[](7);
        perpCollateralSelectors[0] = PerpCollateralFacet.depositPerpCollateral.selector;
        perpCollateralSelectors[1] = PerpCollateralFacet.withdrawPerpCollateral.selector;
        perpCollateralSelectors[2] = PerpCollateralFacet.addPerpLiquidity.selector;
        perpCollateralSelectors[3] = PerpCollateralFacet.removePerpLiquidity.selector;
        perpCollateralSelectors[4] = PerpCollateralFacet.addPerpPositionCollateral.selector;
        perpCollateralSelectors[5] = PerpCollateralFacet.removePerpPositionCollateral.selector;
        perpCollateralSelectors[6] = PerpCollateralFacet.claimPerpProtocolFees.selector;

        cuts[4] = IDiamondCut.FacetCut({
            facetAddress: address(perpCollateralFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpCollateralSelectors
        });
        console.log("PerpCollateralFacet: %d selectors", perpCollateralSelectors.length);

        // 2f. PerpOrderFacet selectors
        bytes4[] memory perpOrderSelectors = new bytes4[](3);
        perpOrderSelectors[0] = PerpOrderFacet.placePerpMarketOrder.selector;
        perpOrderSelectors[1] = PerpOrderFacet.placePerpTriggerOrder.selector;
        perpOrderSelectors[2] = PerpOrderFacet.cancelPerpOrder.selector;

        cuts[5] = IDiamondCut.FacetCut({
            facetAddress: address(perpOrderFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpOrderSelectors
        });
        console.log("PerpOrderFacet: %d selectors", perpOrderSelectors.length);

        // 2g. PerpSettlementFacet selectors
        bytes4[] memory perpSettlementSelectors = new bytes4[](3);
        perpSettlementSelectors[0] = PerpSettlementFacet.publishPerpOracleVersions.selector;
        perpSettlementSelectors[1] = PerpSettlementFacet.executePerpOrder.selector;
        perpSettlementSelectors[2] = PerpSettlementFacet.liquidatePerpPosition.selector;

        cuts[6] = IDiamondCut.FacetCut({
            facetAddress: address(perpSettlementFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpSettlementSelectors
        });
        console.log("PerpSettlementFacet: %d selectors", perpSettlementSelectors.length);

        // 2h. PerpViewFacet selectors
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

        cuts[7] = IDiamondCut.FacetCut({
            facetAddress: address(perpViewFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: perpViewSelectors
        });
        console.log("PerpViewFacet: %d selectors", perpViewSelectors.length);

        // 3. Execute diamond cut
        console.log("\n3. Executing diamond cut...");
        IDiamondCut(diamondAddress).diamondCut(cuts, address(0), "");
        console.log("Diamond cut successful!");

        if (block.chainid == 84532 || block.chainid == 31337) {
            mockUsdc = new MockUSDC();
            mockUsdc.mint(deployer, 10_000_000 * 1e6);
            perpCollateralToken = address(mockUsdc);
            console.log("MockUSDC:", perpCollateralToken);
        } else {
            perpCollateralToken = vm.envAddress("PERP_COLLATERAL_TOKEN");
            console.log("Perp collateral token:", perpCollateralToken);
        }

        PerpAdminFacet(diamondAddress).initializePerpEngine(
            perpCollateralToken,
            deployer,
            deployer,
            2_000,
            2 hours
        );
        console.log("Perp engine initialized");

        vm.stopBroadcast();

        // 4. Verify upgrade
        console.log("\n4. Verifying upgrade...");
        IDiamondLoupe loupe = IDiamondLoupe(diamondAddress);
        address[] memory facetAddresses = loupe.facetAddresses();
        console.log("Total facets after upgrade:", facetAddresses.length);

        // Print all facets
        console.log("\nAll facets:");
        for (uint i = 0; i < facetAddresses.length; i++) {
            bytes4[] memory selectors = loupe.facetFunctionSelectors(facetAddresses[i]);
            console.log("  Facet %d: %s (%d functions)", i, facetAddresses[i], selectors.length);
        }

        // Print upgrade summary
        console.log("\n=== Upgrade Summary ===");
        console.log("Diamond:", diamondAddress);
        console.log("LiquidityPoolFacet:", address(liquidityPoolFacet));
        console.log("PerpetualMarketFacet:", address(perpetualMarketFacet));
        console.log("ReferralSystemFacet:", address(referralSystemFacet));
        console.log("PerpAdminFacet:", address(perpAdminFacet));
        console.log("PerpCollateralFacet:", address(perpCollateralFacet));
        console.log("PerpOrderFacet:", address(perpOrderFacet));
        console.log("PerpSettlementFacet:", address(perpSettlementFacet));
        console.log("PerpViewFacet:", address(perpViewFacet));
        console.log("\nUpgrade completed successfully!");
        console.log("The Diamond now has access to:");
        console.log("  - Liquidity pools with AMM pricing");
        console.log("  - Perpetual futures with funding rates");
        console.log("  - Multi-tier referral system");
        console.log("  - Oracle-versioned isolated-margin perps");
    }
}
