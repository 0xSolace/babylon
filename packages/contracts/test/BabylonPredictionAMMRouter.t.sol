// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {BabylonPredictionAMMRouter} from "../src/prediction-markets/BabylonPredictionAMMRouter.sol";
import {BabylonPredictionOracleAdapter} from "../src/prediction-markets/BabylonPredictionOracleAdapter.sol";
import {BabylonGameOracle} from "../src/game/BabylonGameOracle.sol";
import {LvrMarket} from "../src/prediction-markets/hyperbet/LvrMarket.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BabylonPredictionAMMRouterTest is Test {
    BabylonPredictionAMMRouter internal router;
    BabylonPredictionOracleAdapter internal adapter;
    BabylonGameOracle internal oracle;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal gameServer = address(0xCAFE);
    address internal trader = address(0xD00D);

    string internal constant MARKET_ID = "prediction-market-1";
    string internal constant QUESTION = "Will Babylon ship Hyperbet PM-AMM integration?";
    bytes32 internal constant SALT = keccak256("prediction-salt");

    function setUp() public {
        usdc = new MockUSDC();
        oracle = new BabylonGameOracle(gameServer);
        adapter = new BabylonPredictionOracleAdapter(address(oracle), admin);

        vm.prank(admin);
        router = new BabylonPredictionAMMRouter(address(usdc), address(adapter), treasury, 50, admin);

        vm.prank(admin);
        adapter.transferOwnership(address(router));

        usdc.mint(admin, 1_000_000e6);
        usdc.mint(trader, 100_000e6);

        vm.prank(admin);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(trader);
        usdc.approve(address(router), type(uint256).max);
    }

    function testCreateBuySettleAndClaim() public {
        uint256 resolveAt = block.timestamp + 7 days;

        vm.prank(admin);
        (bytes32 marketKey, address marketAddress) = router.createMarket(
            MARKET_ID,
            QUESTION,
            "babylon-game",
            resolveAt,
            true,
            10_000e6
        );

        assertTrue(marketAddress != address(0), "market should deploy");

        LvrMarket market = LvrMarket(marketAddress);

        uint256 preview = market.previewBuy(true, 1_000e6);
        assertGt(preview, 0, "buy preview should be positive");

        vm.prank(trader);
        uint256 sharesOut = router.buyShares(marketKey, 1, 1_000e6, 0);
        assertEq(sharesOut, preview, "buy quote should match execution");

        (uint256 yesBalance, uint256 noBalance) = _getUserPosition(market, trader);
        assertGt(yesBalance, 0, "trader should hold YES shares");
        assertEq(noBalance, 0, "trader should not hold NO shares after YES buy");

        bool outcome = true;
        bytes32 commitment = keccak256(abi.encode(outcome, SALT));

        vm.prank(gameServer);
        bytes32 sessionId = oracle.commitBabylonGame(
            MARKET_ID,
            1,
            QUESTION,
            commitment,
            "general"
        );

        vm.prank(admin);
        router.linkMarketToSession(marketKey, sessionId);

        vm.prank(gameServer);
        oracle.revealBabylonGame(sessionId, outcome, SALT, "", new address[](0), 0);

        vm.warp(resolveAt + 1);
        router.settleFromOracle(marketKey);

        uint256 beforeClaim = usdc.balanceOf(trader);
        vm.prank(trader);
        uint256 payout = router.claimAll(marketKey);
        uint256 afterClaim = usdc.balanceOf(trader);

        assertGt(payout, 0, "claim payout should be positive");
        assertEq(afterClaim - beforeClaim, payout, "claim payout should match balance delta");

        (yesBalance, noBalance) = _getUserPosition(market, trader);
        assertEq(yesBalance, 0, "YES shares should be burned after claim");
        assertEq(noBalance, 0, "NO shares should remain zero");
    }

    function testSellSharesSwapsOutcomeWithoutApproval() public {
        uint256 resolveAt = block.timestamp + 7 days;

        vm.prank(admin);
        (bytes32 marketKey, address marketAddress) = router.createMarket(
            MARKET_ID,
            QUESTION,
            "babylon-game",
            resolveAt,
            false,
            10_000e6
        );
        LvrMarket market = LvrMarket(marketAddress);

        vm.prank(trader);
        uint256 yesBought = router.buyShares(marketKey, 1, 1_000e6, 0);
        assertGt(yesBought, 0, "buy should mint YES shares");

        (uint256 beforeYes, uint256 beforeNo) = _getUserPosition(market, trader);
        assertEq(beforeNo, 0, "trader should start with no NO shares");

        vm.prank(trader);
        uint256 noReceived = router.sellShares(marketKey, 1, beforeYes / 2, 0);

        assertGt(noReceived, 0, "sell should return opposite-side shares");

        (uint256 afterYes, uint256 afterNo) = _getUserPosition(market, trader);
        assertLt(afterYes, beforeYes, "YES shares should decrease after swap");
        assertGt(afterNo, 0, "NO shares should increase after swap");
    }

    function _getUserPosition(LvrMarket market, address user) internal view returns (uint256 yesBalance, uint256 noBalance) {
        yesBalance = IERC20(market.getToken(true)).balanceOf(user);
        noBalance = IERC20(market.getToken(false)).balanceOf(user);
    }
}
