// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {BBLNToken} from "../src/BBLNToken.sol";
import {BBLNPresale} from "../src/BBLNPresale.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BBLNPresaleTest
 * @notice Comprehensive tests for BBLNPresale contract
 */
contract BBLNPresaleTest is Test {
    BBLNToken public token;
    BBLNPresale public presale;
    IERC20 public mockEliza;

    address public owner;
    address public treasury;
    address public user1;
    address public user2;
    address public elizaHolder;

    uint256 public constant TOKENS_FOR_SALE = 100_000_000 * 10 ** 18;
    uint256 public constant SOFT_CAP = 50 ether;
    uint256 public constant HARD_CAP = 500 ether;
    uint256 public constant MIN_CONTRIBUTION = 0.1 ether;
    uint256 public constant MAX_CONTRIBUTION = 100 ether;

    function setUp() public {
        owner = address(this);
        treasury = makeAddr("treasury");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        elizaHolder = makeAddr("elizaHolder");

        // Deploy mock ELIZA token
        mockEliza = IERC20(deployMockERC20("ELIZA", "ELIZA"));

        // Deploy BBLN token
        token = new BBLNToken(owner);

        // Deploy presale
        presale = new BBLNPresale(
            address(token),
            address(mockEliza),
            treasury,
            owner
        );

        // Configure presale
        presale.configure(
            TOKENS_FOR_SALE,
            SOFT_CAP,
            HARD_CAP,
            MIN_CONTRIBUTION,
            MAX_CONTRIBUTION,
            0.00005 ether, // startPrice
            0.00001 ether, // reservePrice
            1e12, // priceDecay
            2000, // 20% to LP
            180 days // lock duration
        );

        // Transfer tokens to presale
        token.transfer(address(presale), TOKENS_FOR_SALE);

        // Give users some ETH
        vm.deal(user1, 1000 ether);
        vm.deal(user2, 1000 ether);
        vm.deal(elizaHolder, 1000 ether);

        // Give ELIZA to holder
        deal(address(mockEliza), elizaHolder, 2000 * 10 ** 18);
    }

    function deployMockERC20(string memory name, string memory symbol) internal returns (address) {
        // Deploy a simple mock ERC20
        return address(new MockERC20(name, symbol));
    }

    // =========================================================================
    // CONFIGURATION TESTS
    // =========================================================================

    function test_InitialConfiguration() public view {
        assertEq(address(presale.token()), address(token));
        assertEq(presale.treasury(), treasury);
        assertEq(presale.tokensForSale(), TOKENS_FOR_SALE);
        assertEq(presale.softCap(), SOFT_CAP);
        assertEq(presale.hardCap(), HARD_CAP);
    }

    function test_CannotConfigureAfterStart() public {
        presale.startPresaleNow();

        vm.expectRevert(BBLNPresale.PresaleAlreadyFinalized.selector);
        presale.configure(
            TOKENS_FOR_SALE, SOFT_CAP, HARD_CAP,
            MIN_CONTRIBUTION, MAX_CONTRIBUTION,
            0.00005 ether, 0.00001 ether, 1e12,
            2000, 180 days
        );
    }

    // =========================================================================
    // PRESALE START TESTS
    // =========================================================================

    function test_StartPresale() public {
        presale.startPresaleNow();

        assertGt(presale.presaleStart(), 0);
        assertGt(presale.presaleEnd(), presale.presaleStart());
    }

    function test_CannotStartTwice() public {
        presale.startPresaleNow();

        vm.expectRevert(BBLNPresale.PresaleAlreadyFinalized.selector);
        presale.startPresaleNow();
    }

    // =========================================================================
    // CONTRIBUTION TESTS
    // =========================================================================

    function test_Contribute() public {
        presale.startPresaleNow();

        vm.prank(user1);
        presale.contribute{value: 1 ether}();

        (uint256 ethAmount,,,,) = presale.getContribution(user1);
        assertEq(ethAmount, 1 ether);
        assertEq(presale.totalRaised(), 1 ether);
        assertEq(presale.totalParticipants(), 1);
    }

    function test_ContributeMultiple() public {
        presale.startPresaleNow();

        vm.prank(user1);
        presale.contribute{value: 1 ether}();

        vm.prank(user1);
        presale.contribute{value: 2 ether}();

        (uint256 ethAmount,,,,) = presale.getContribution(user1);
        assertEq(ethAmount, 3 ether);
        assertEq(presale.totalParticipants(), 1);
    }

    function test_CannotContributeBeforeStart() public {
        vm.prank(user1);
        vm.expectRevert(BBLNPresale.PresaleNotStarted.selector);
        presale.contribute{value: 1 ether}();
    }

    function test_CannotContributeBelowMin() public {
        presale.startPresaleNow();

        vm.prank(user1);
        vm.expectRevert(BBLNPresale.BelowMinContribution.selector);
        presale.contribute{value: 0.05 ether}();
    }

    function test_CannotContributeAboveMax() public {
        presale.startPresaleNow();

        vm.prank(user1);
        vm.expectRevert(BBLNPresale.AboveMaxContribution.selector);
        presale.contribute{value: 150 ether}();
    }

    function test_ContributionCappedToHardCap() public {
        // Reduce hard cap for testing - softCap must be <= hardCap
        presale.configure(
            TOKENS_FOR_SALE, 5 ether, 10 ether, // softCap = 5 ETH, hardCap = 10 ETH
            MIN_CONTRIBUTION, 10 ether, // max contribution = 10 ETH
            0.00005 ether, 0.00001 ether, 1e12,
            2000, 180 days
        );

        presale.startPresaleNow();

        // First contribution
        vm.prank(user1);
        presale.contribute{value: 8 ether}();

        // Second contribution should be capped
        uint256 balanceBefore = user2.balance;
        vm.prank(user2);
        presale.contribute{value: 5 ether}();

        // User2 should have been refunded the excess
        assertEq(presale.totalRaised(), 10 ether);
        assertGt(user2.balance, balanceBefore - 5 ether);
    }

    // =========================================================================
    // ELIZA HOLDER TESTS
    // =========================================================================

    function test_ElizaHolderDetection() public view {
        assertTrue(presale.checkElizaHolder(elizaHolder));
        assertFalse(presale.checkElizaHolder(user1));
    }

    function test_ElizaHolderBonus() public {
        presale.startPresaleNow();

        vm.prank(elizaHolder);
        presale.contribute{value: 1 ether}();

        (uint256 ethAmount,,,,) = presale.getContribution(elizaHolder);
        assertEq(ethAmount, 1 ether);
        // ELIZA holder status is tracked internally
    }

    // =========================================================================
    // FINALIZATION TESTS
    // =========================================================================

    function test_CannotFinalizeBeforeEnd() public {
        presale.startPresaleNow();

        vm.prank(user1);
        presale.contribute{value: 60 ether}();

        vm.expectRevert(BBLNPresale.PresaleNotEnded.selector);
        presale.finalize();
    }

    function test_FinalizeSuccess() public {
        presale.startPresaleNow();

        // Contribute enough to meet soft cap
        vm.prank(user1);
        presale.contribute{value: 60 ether}();

        // Fast forward past presale end
        vm.warp(block.timestamp + 8 days);

        // Finalize
        presale.finalize();

        assertTrue(presale.finalized());
        assertFalse(presale.failed());
    }

    function test_FinalizeFail_SoftCapNotReached() public {
        presale.startPresaleNow();

        // Contribute below soft cap (soft cap is 50 ETH)
        vm.prank(user1);
        presale.contribute{value: 10 ether}();

        // Fast forward past presale end
        vm.warp(block.timestamp + 8 days);

        // Finalize
        presale.finalize();

        assertTrue(presale.finalized());
        assertTrue(presale.failed());
    }

    // =========================================================================
    // CLAIM TESTS
    // =========================================================================

    function test_ClaimTokens() public {
        presale.startPresaleNow();

        vm.prank(user1);
        presale.contribute{value: 60 ether}();

        vm.warp(block.timestamp + 8 days);
        presale.finalize();

        // Fast forward to claim start
        vm.warp(block.timestamp + 2 days);

        uint256 balanceBefore = token.balanceOf(user1);

        vm.prank(user1);
        presale.claim();

        assertGt(token.balanceOf(user1), balanceBefore);
    }

    function test_CannotClaimBeforeClaimStart() public {
        presale.startPresaleNow();

        vm.prank(user1);
        presale.contribute{value: 60 ether}();

        // Warp past presale end (7 days) but before claim start (8 days)
        vm.warp(block.timestamp + 7 days + 1);
        presale.finalize();

        // Try to claim immediately after finalization (before claim start)
        vm.prank(user1);
        vm.expectRevert(BBLNPresale.ClaimNotStarted.selector);
        presale.claim();
    }

    function test_CannotClaimIfFailed() public {
        presale.startPresaleNow();

        // Contribute below soft cap (50 ETH) so presale fails
        vm.prank(user1);
        presale.contribute{value: 10 ether}();

        vm.warp(block.timestamp + 8 days);
        presale.finalize();

        assertTrue(presale.failed());

        vm.warp(block.timestamp + 2 days);

        vm.prank(user1);
        vm.expectRevert(BBLNPresale.NotFailed.selector);
        presale.claim();
    }

    // =========================================================================
    // REFUND TESTS
    // =========================================================================

    function test_RefundIfFailed() public {
        presale.startPresaleNow();

        // Contribute below soft cap (50 ETH) so presale fails
        vm.prank(user1);
        presale.contribute{value: 10 ether}();

        vm.warp(block.timestamp + 8 days);
        presale.finalize();

        assertTrue(presale.failed());

        uint256 balanceBefore = user1.balance;

        vm.prank(user1);
        presale.refund();

        assertEq(user1.balance, balanceBefore + 10 ether);
    }

    function test_CannotRefundIfSuccess() public {
        presale.startPresaleNow();

        vm.prank(user1);
        presale.contribute{value: 60 ether}();

        vm.warp(block.timestamp + 8 days);
        presale.finalize();

        assertFalse(presale.failed());

        vm.prank(user1);
        vm.expectRevert(BBLNPresale.NotFailed.selector);
        presale.refund();
    }

    function test_CannotRefundTwice() public {
        presale.startPresaleNow();

        // Contribute below soft cap (50 ETH) so presale fails
        vm.prank(user1);
        presale.contribute{value: 10 ether}();

        vm.warp(block.timestamp + 8 days);
        presale.finalize();

        assertTrue(presale.failed());

        vm.prank(user1);
        presale.refund();

        vm.prank(user1);
        vm.expectRevert(BBLNPresale.AlreadyRefunded.selector);
        presale.refund();
    }

    // =========================================================================
    // VIEW FUNCTION TESTS
    // =========================================================================

    function test_GetStatus() public {
        presale.startPresaleNow();

        vm.prank(user1);
        presale.contribute{value: 1 ether}();

        (
            uint256 raised,
            uint256 participants,
            uint256 progress,
            uint256 timeRemaining,
            bool isActive,
            bool isFinalized,
            bool isFailed
        ) = presale.getStatus();

        assertEq(raised, 1 ether);
        assertEq(participants, 1);
        assertGt(progress, 0);
        assertGt(timeRemaining, 0);
        assertTrue(isActive);
        assertFalse(isFinalized);
        assertFalse(isFailed);
    }

    function test_GetCurrentPrice() public {
        presale.startPresaleNow();

        uint256 priceAtStart = presale.getCurrentPrice();
        assertEq(priceAtStart, 0.00005 ether);

        // Price should decrease over time
        vm.warp(block.timestamp + 1 days);
        uint256 priceAfterOneDay = presale.getCurrentPrice();
        assertLt(priceAfterOneDay, priceAtStart);
    }

    function test_PreviewAllocation() public view {
        (uint256 baseAllocation, uint256 bonus, uint256 total) = 
            presale.previewAllocation(1 ether, false);

        assertGt(baseAllocation, 0);
        assertEq(bonus, 0);
        assertEq(total, baseAllocation);

        // With ELIZA bonus
        (uint256 baseWithBonus, uint256 elizaBonus, uint256 totalWithBonus) = 
            presale.previewAllocation(1 ether, true);

        assertEq(baseWithBonus, baseAllocation);
        assertGt(elizaBonus, 0);
        assertEq(totalWithBonus, baseWithBonus + elizaBonus);
    }

    // =========================================================================
    // ADMIN FUNCTION TESTS
    // =========================================================================

    function test_SetTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        presale.setTreasury(newTreasury);
        assertEq(presale.treasury(), newTreasury);
    }

    function test_SetElizaBonus() public {
        presale.setElizaBonus(500 * 10 ** 18, 7500);
        assertEq(presale.elizaMinBalance(), 500 * 10 ** 18);
        assertEq(presale.elizaBonusBps(), 7500);
    }

    function test_Pause() public {
        presale.startPresaleNow();
        presale.pause();

        vm.prank(user1);
        vm.expectRevert();
        presale.contribute{value: 1 ether}();
    }

    function test_Unpause() public {
        presale.startPresaleNow();
        presale.pause();
        presale.unpause();

        vm.prank(user1);
        presale.contribute{value: 1 ether}();

        assertEq(presale.totalRaised(), 1 ether);
    }
}

/**
 * @title MockERC20
 * @notice Simple mock ERC20 for testing
 */
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
    }
}

