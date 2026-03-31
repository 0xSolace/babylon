// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../core/Diamond.sol";
import "../core/DiamondCutFacet.sol";
import "../core/DiamondLoupeFacet.sol";
import "../core/PerpAdminFacet.sol";
import "../core/PerpCollateralFacet.sol";
import "../core/PerpOrderFacet.sol";
import "../core/PerpSettlementFacet.sol";
import "../core/PerpViewFacet.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibPerpEngine.sol";
import "../src/tokens/MockUSDC.sol";

contract PerpEngineFacetTest is Test {
    Diamond internal diamond;
    DiamondCutFacet internal diamondCutFacet;
    DiamondLoupeFacet internal diamondLoupeFacet;
    PerpAdminFacet internal perpAdminFacet;
    PerpCollateralFacet internal perpCollateralFacet;
    PerpOrderFacet internal perpOrderFacet;
    PerpSettlementFacet internal perpSettlementFacet;
    PerpViewFacet internal perpViewFacet;
    MockUSDC internal usdc;

    address internal owner = address(this);
    address internal updater = makeAddr("updater");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal lp = makeAddr("lp");
    address internal liquidator = makeAddr("liquidator");
    address internal feeRecipient = makeAddr("feeRecipient");

    bytes32 internal marketId;

    function setUp() public {
        diamondCutFacet = new DiamondCutFacet();
        diamondLoupeFacet = new DiamondLoupeFacet();
        perpAdminFacet = new PerpAdminFacet();
        perpCollateralFacet = new PerpCollateralFacet();
        perpOrderFacet = new PerpOrderFacet();
        perpSettlementFacet = new PerpSettlementFacet();
        perpViewFacet = new PerpViewFacet();
        diamond = new Diamond(address(diamondCutFacet), address(diamondLoupeFacet));

        _addFacet(address(diamondLoupeFacet), _loupeSelectors());
        _addFacet(address(perpAdminFacet), _adminSelectors());
        _addFacet(address(perpCollateralFacet), _collateralSelectors());
        _addFacet(address(perpOrderFacet), _orderSelectors());
        _addFacet(address(perpSettlementFacet), _settlementSelectors());
        _addFacet(address(perpViewFacet), _viewSelectors());

        usdc = new MockUSDC();
        usdc.mint(alice, usdcAmount(100_000));
        usdc.mint(bob, usdcAmount(100_000));
        usdc.mint(lp, usdcAmount(2_000_000));
        usdc.mint(owner, usdcAmount(100_000));

        PerpAdminFacet(address(diamond)).initializePerpEngine(
            address(usdc),
            updater,
            feeRecipient,
            2_000,
            2 hours
        );

        marketId = PerpAdminFacet(address(diamond)).createPerpMarket(
            "BTC-PERP",
            usd(10_000_000),
            base(25),
            base(5_000),
            base(1),
            1_000,
            500,
            100,
            10,
            10,
            300,
            2_000,
            1_000
        );

        vm.startPrank(lp);
        usdc.approve(address(diamond), type(uint256).max);
        PerpCollateralFacet(address(diamond)).depositPerpCollateral(usdcAmount(1_500_000));
        PerpCollateralFacet(address(diamond)).addPerpLiquidity(marketId, usdcAmount(1_000_000));
        vm.stopPrank();

        vm.startPrank(alice);
        usdc.approve(address(diamond), type(uint256).max);
        PerpCollateralFacet(address(diamond)).depositPerpCollateral(usdcAmount(20_000));
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(diamond), type(uint256).max);
        PerpCollateralFacet(address(diamond)).depositPerpCollateral(usdcAmount(20_000));
        vm.stopPrank();

        uint64 initialTimestamp = 1_700_000_000;
        vm.warp(initialTimestamp);
        _publishPrice(1_000 * 1e8, initialTimestamp);
    }

    function testMarketOrderOpensLongOnNextOracleVersion() public {
        uint256 preview = PerpViewFacet(address(diamond)).previewPerpExecutionPrice(
            marketId,
            1_000 * 1e8,
            LibPerpEngine.Side.LONG,
            false,
            base(1)
        );

        vm.prank(alice);
        bytes32 orderId = PerpOrderFacet(address(diamond)).placePerpMarketOrder(
            marketId,
            LibPerpEngine.Side.LONG,
            false,
            base(1),
            usd(2_000),
            preview + 1,
            0
        );

        uint64 openExecutionTimestamp = 1_700_000_015;
        vm.warp(openExecutionTimestamp);
        _publishPrice(1_000 * 1e8, openExecutionTimestamp);
        PerpSettlementFacet(address(diamond)).executePerpOrder(orderId);

        (
            LibPerpEngine.Side side,
            uint256 size,
            uint256 collateral,
            uint256 entryPrice,
            int256 entryFunding
        ) = PerpViewFacet(address(diamond)).getPerpPosition(alice, marketId);

        uint256 expectedFee = preview * base(1) / 1e8 * 10 / 10_000;

        assertEq(uint8(side), uint8(LibPerpEngine.Side.LONG));
        assertEq(size, base(1));
        assertEq(collateral, usd(2_000) - expectedFee);
        assertEq(entryPrice, preview);
        assertEq(entryFunding, 0);
        assertEq(PerpViewFacet(address(diamond)).getPerpAccount(alice), usd(18_000));
    }

    function testTriggerOrderExecutesOnlyAfterCross() public {
        vm.prank(alice);
        bytes32 orderId = PerpOrderFacet(address(diamond)).placePerpTriggerOrder(
            marketId,
            LibPerpEngine.Side.LONG,
            false,
            base(1),
            usd(2_000),
            950 * 1e8,
            960 * 1e8,
            false,
            0
        );

        vm.expectRevert(LibPerpEngine.TriggerNotSatisfied.selector);
        PerpSettlementFacet(address(diamond)).executePerpOrder(orderId);

        uint64 triggerTimestamp = 1_700_000_015;
        vm.warp(triggerTimestamp);
        _publishPrice(945 * 1e8, triggerTimestamp);

        uint256 preview = PerpViewFacet(address(diamond)).previewPerpExecutionPrice(
            marketId,
            945 * 1e8,
            LibPerpEngine.Side.LONG,
            false,
            base(1)
        );

        PerpSettlementFacet(address(diamond)).executePerpOrder(orderId);

        (, uint256 size, uint256 collateral, uint256 entryPrice,) =
            PerpViewFacet(address(diamond)).getPerpPosition(alice, marketId);
        uint256 expectedFee = preview * base(1) / 1e8 * 10 / 10_000;
        assertEq(size, base(1));
        assertEq(collateral, usd(2_000) - expectedFee);
        assertEq(entryPrice, preview);
    }

    function testReduceOrderRealizesProfitAndUpdatesVault() public {
        vm.prank(alice);
        bytes32 openOrderId = PerpOrderFacet(address(diamond)).placePerpMarketOrder(
            marketId,
            LibPerpEngine.Side.LONG,
            false,
            base(1),
            usd(2_000),
            1_100 * 1e8,
            0
        );

        uint64 openExecutionTimestamp = 1_700_000_015;
        vm.warp(openExecutionTimestamp);
        _publishPrice(1_000 * 1e8, openExecutionTimestamp);
        PerpSettlementFacet(address(diamond)).executePerpOrder(openOrderId);

        uint256 cashBeforeClose = PerpViewFacet(address(diamond)).getPerpAccount(alice);
        (, , uint256 positionCollateral, uint256 entryPrice,) =
            PerpViewFacet(address(diamond)).getPerpPosition(alice, marketId);
        (, , uint256 vaultBefore) = PerpViewFacet(address(diamond)).getPerpVaultPosition(lp, marketId);

        vm.prank(alice);
        bytes32 closeOrderId = PerpOrderFacet(address(diamond)).placePerpMarketOrder(
            marketId,
            LibPerpEngine.Side.LONG,
            true,
            base(1),
            0,
            1_090 * 1e8,
            0
        );

        uint64 closeExecutionTimestamp = 1_700_000_030;
        vm.warp(closeExecutionTimestamp);
        _publishPrice(1_100 * 1e8, closeExecutionTimestamp);
        uint256 closePreview = PerpViewFacet(address(diamond)).previewPerpExecutionPrice(
            marketId,
            1_100 * 1e8,
            LibPerpEngine.Side.LONG,
            true,
            base(1)
        );
        (, , int256 cumulativeFunding) = PerpViewFacet(address(diamond)).getPerpOracleVersion(marketId, 3);
        PerpSettlementFacet(address(diamond)).executePerpOrder(closeOrderId);

        (, uint256 size,,,) = PerpViewFacet(address(diamond)).getPerpPosition(alice, marketId);
        assertEq(size, 0);
        int256 pricePnl = int256(base(1)) * (int256(closePreview) - int256(entryPrice)) / int256(1e8);
        int256 fundingPnl = -int256(base(1)) * cumulativeFunding / int256(1e8);
        int256 pnl = pricePnl + fundingPnl;
        uint256 closeFee = closePreview * base(1) / 1e8 * 10 / 10_000;
        uint256 expectedCash = cashBeforeClose + uint256(int256(positionCollateral) + pnl - int256(closeFee));
        assertEq(PerpViewFacet(address(diamond)).getPerpAccount(alice), expectedCash);
        (, , uint256 vaultAfter) = PerpViewFacet(address(diamond)).getPerpVaultPosition(lp, marketId);
        assertLt(vaultAfter, vaultBefore);
        assertGt(PerpViewFacet(address(diamond)).getPerpProtocolFees(marketId), 0);
    }

    function testFundingAccumulatorMovesAgainstSkewedLongs() public {
        vm.prank(alice);
        bytes32 openOrderId = PerpOrderFacet(address(diamond)).placePerpMarketOrder(
            marketId,
            LibPerpEngine.Side.LONG,
            false,
            base(2),
            usd(5_000),
            1_200 * 1e8,
            0
        );

        uint64 openExecutionTimestamp = 1_700_000_015;
        vm.warp(openExecutionTimestamp);
        _publishPrice(1_000 * 1e8, openExecutionTimestamp);
        PerpSettlementFacet(address(diamond)).executePerpOrder(openOrderId);

        uint64 fundingTimestamp = openExecutionTimestamp + 1 days;
        vm.warp(fundingTimestamp);
        _publishPrice(1_000 * 1e8, fundingTimestamp);

        (, , int256 cumulativeFunding) = PerpViewFacet(address(diamond)).getPerpOracleVersion(marketId, 3);
        assertGt(cumulativeFunding, 0);
    }

    function testLiquidationClosesUnderwaterLong() public {
        vm.prank(alice);
        bytes32 openOrderId = PerpOrderFacet(address(diamond)).placePerpMarketOrder(
            marketId,
            LibPerpEngine.Side.LONG,
            false,
            base(1),
            usd(150),
            1_200 * 1e8,
            0
        );

        uint64 openExecutionTimestamp = 1_700_000_015;
        vm.warp(openExecutionTimestamp);
        _publishPrice(1_000 * 1e8, openExecutionTimestamp);
        PerpSettlementFacet(address(diamond)).executePerpOrder(openOrderId);

        uint64 liquidationTimestamp = 1_700_000_030;
        vm.warp(liquidationTimestamp);
        _publishPrice(860 * 1e8, liquidationTimestamp);

        vm.prank(liquidator);
        PerpSettlementFacet(address(diamond)).liquidatePerpPosition(alice, marketId);

        (, uint256 size,,,) = PerpViewFacet(address(diamond)).getPerpPosition(alice, marketId);
        assertEq(size, 0);
        assertGt(PerpViewFacet(address(diamond)).getPerpAccount(liquidator), 0);
    }

    function testPositionCollateralCanBeAddedAndRemovedAgainstFreshOracle() public {
        vm.prank(alice);
        bytes32 openOrderId = PerpOrderFacet(address(diamond)).placePerpMarketOrder(
            marketId,
            LibPerpEngine.Side.LONG,
            false,
            base(1),
            usd(2_000),
            1_100 * 1e8,
            0
        );

        uint64 openExecutionTimestamp = 1_700_000_015;
        vm.warp(openExecutionTimestamp);
        _publishPrice(1_000 * 1e8, openExecutionTimestamp);
        PerpSettlementFacet(address(diamond)).executePerpOrder(openOrderId);

        (, , uint256 collateralBefore,,) = PerpViewFacet(address(diamond)).getPerpPosition(alice, marketId);

        vm.prank(alice);
        PerpCollateralFacet(address(diamond)).addPerpPositionCollateral(marketId, usdcAmount(500));

        vm.prank(alice);
        PerpCollateralFacet(address(diamond)).removePerpPositionCollateral(marketId, usdcAmount(250));

        (, , uint256 collateral,,) = PerpViewFacet(address(diamond)).getPerpPosition(alice, marketId);
        assertEq(collateral, collateralBefore + usd(250));
        assertEq(PerpViewFacet(address(diamond)).getPerpAccount(alice), usd(17_750));
    }

    function testViewFacetEnumeratesMarketsAndActiveOrders() public {
        bytes32[] memory marketIds = PerpViewFacet(address(diamond)).getPerpMarketIds();
        assertEq(marketIds.length, 1);
        assertEq(marketIds[0], marketId);

        vm.prank(alice);
        bytes32 orderId = PerpOrderFacet(address(diamond)).placePerpMarketOrder(
            marketId,
            LibPerpEngine.Side.LONG,
            false,
            base(1),
            usd(2_000),
            1_100 * 1e8,
            0
        );

        bytes32[] memory activeOrderIds = PerpViewFacet(address(diamond)).getPerpActiveOrderIds();
        assertEq(activeOrderIds.length, 1);
        assertEq(activeOrderIds[0], orderId);

        uint64 executeTimestamp = 1_700_000_015;
        vm.warp(executeTimestamp);
        _publishPrice(1_000 * 1e8, executeTimestamp);
        PerpSettlementFacet(address(diamond)).executePerpOrder(orderId);

        activeOrderIds = PerpViewFacet(address(diamond)).getPerpActiveOrderIds();
        assertEq(activeOrderIds.length, 0);
    }

    function _publishPrice(uint256 price, uint64 timestamp) internal {
        bytes32[] memory marketIds = new bytes32[](1);
        uint256[] memory prices = new uint256[](1);
        marketIds[0] = marketId;
        prices[0] = price;

        vm.prank(updater);
        PerpSettlementFacet(address(diamond)).publishPerpOracleVersions(marketIds, prices, timestamp);
    }

    function _addFacet(address facet, bytes4[] memory selectors) internal {
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: facet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: selectors
        });

        IDiamondCut(address(diamond)).diamondCut(cut, address(0), "");
    }

    function _loupeSelectors() internal pure returns (bytes4[] memory selectors) {
        selectors = new bytes4[](5);
        selectors[0] = DiamondLoupeFacet.facets.selector;
        selectors[1] = DiamondLoupeFacet.facetFunctionSelectors.selector;
        selectors[2] = DiamondLoupeFacet.facetAddresses.selector;
        selectors[3] = DiamondLoupeFacet.facetAddress.selector;
        selectors[4] = bytes4(keccak256("supportsInterface(bytes4)"));
    }

    function _adminSelectors() internal pure returns (bytes4[] memory selectors) {
        selectors = new bytes4[](6);
        selectors[0] = PerpAdminFacet.initializePerpEngine.selector;
        selectors[1] = PerpAdminFacet.createPerpMarket.selector;
        selectors[2] = PerpAdminFacet.setPerpMarketStatus.selector;
        selectors[3] = PerpAdminFacet.setPerpOracleUpdater.selector;
        selectors[4] = PerpAdminFacet.setPerpFeeRecipient.selector;
        selectors[5] = PerpAdminFacet.setPerpProtocolFeeShare.selector;
    }

    function _collateralSelectors() internal pure returns (bytes4[] memory selectors) {
        selectors = new bytes4[](7);
        selectors[0] = PerpCollateralFacet.depositPerpCollateral.selector;
        selectors[1] = PerpCollateralFacet.withdrawPerpCollateral.selector;
        selectors[2] = PerpCollateralFacet.addPerpLiquidity.selector;
        selectors[3] = PerpCollateralFacet.removePerpLiquidity.selector;
        selectors[4] = PerpCollateralFacet.addPerpPositionCollateral.selector;
        selectors[5] = PerpCollateralFacet.removePerpPositionCollateral.selector;
        selectors[6] = PerpCollateralFacet.claimPerpProtocolFees.selector;
    }

    function _orderSelectors() internal pure returns (bytes4[] memory selectors) {
        selectors = new bytes4[](3);
        selectors[0] = PerpOrderFacet.placePerpMarketOrder.selector;
        selectors[1] = PerpOrderFacet.placePerpTriggerOrder.selector;
        selectors[2] = PerpOrderFacet.cancelPerpOrder.selector;
    }

    function _settlementSelectors() internal pure returns (bytes4[] memory selectors) {
        selectors = new bytes4[](3);
        selectors[0] = PerpSettlementFacet.publishPerpOracleVersions.selector;
        selectors[1] = PerpSettlementFacet.executePerpOrder.selector;
        selectors[2] = PerpSettlementFacet.liquidatePerpPosition.selector;
    }

    function _viewSelectors() internal pure returns (bytes4[] memory selectors) {
        selectors = new bytes4[](11);
        selectors[0] = PerpViewFacet.getPerpEngineConfig.selector;
        selectors[1] = PerpViewFacet.getPerpAccount.selector;
        selectors[2] = PerpViewFacet.getPerpMarketIds.selector;
        selectors[3] = PerpViewFacet.getPerpMarket.selector;
        selectors[4] = PerpViewFacet.getPerpOracleVersion.selector;
        selectors[5] = PerpViewFacet.getPerpPosition.selector;
        selectors[6] = PerpViewFacet.getPerpOrder.selector;
        selectors[7] = PerpViewFacet.getPerpActiveOrderIds.selector;
        selectors[8] = PerpViewFacet.getPerpVaultPosition.selector;
        selectors[9] = PerpViewFacet.getPerpProtocolFees.selector;
        selectors[10] = PerpViewFacet.previewPerpExecutionPrice.selector;
    }

    function usdcAmount(uint256 whole) internal pure returns (uint256) {
        return whole * 1e6;
    }

    function usd(uint256 whole) internal pure returns (uint256) {
        return whole * 1e18;
    }

    function base(uint256 whole) internal pure returns (uint256) {
        return whole * 1e18;
    }
}
