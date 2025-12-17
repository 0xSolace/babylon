// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BabylonRevenue
 * @author Babylon Labs
 * @notice Revenue splitter with threshold-based automated buybacks
 * @dev Distributes trading fees:
 *      - 30% → BBLN buyback (held in treasury)
 *      - 20% → ELIZA buyback (sent to Eliza Foundation)
 *      - 50% → Treasury (ETH for operations)
 *
 * Controlled by BabylonDAO (AI CEO). The DAO has full authority over:
 *      - Configuration (thresholds, slippage, addresses)
 *      - Pause/unpause operations
 *      - Emergency actions
 *
 * Integrates with Jeju governance infrastructure:
 *      - Uses Jeju native DEX (XLP) for swaps
 *      - Follows Jeju timelock patterns for upgrades
 *      - Reports to Jeju registry for discoverability
 *
 * Threshold-based execution: Buybacks only execute when accumulated fees
 * exceed the configured threshold (e.g., 1 ETH).
 *
 * @custom:security-contact security@babylon.game
 */
contract BabylonRevenue is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    //                              CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Basis points for BBLN buyback (30%)
    uint256 public constant BBLN_BUYBACK_BPS = 3000;

    /// @notice Basis points for ELIZA buyback (20%)
    uint256 public constant ELIZA_BUYBACK_BPS = 2000;

    /// @notice Basis points for treasury (50%)
    uint256 public constant TREASURY_BPS = 5000;

    /// @notice Total basis points (100%)
    uint256 public constant TOTAL_BPS = 10000;

    /// @notice Maximum slippage tolerance (5%)
    uint256 public constant MAX_SLIPPAGE_BPS = 500;

    // ═══════════════════════════════════════════════════════════════════════════
    //                              STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice BabylonDAO address (AI CEO governance)
    address public dao;

    /// @notice BBLN token address
    address public bblnToken;

    /// @notice ELIZA token address
    address public elizaToken;

    /// @notice Treasury address (receives BBLN and ETH)
    address public treasury;

    /// @notice Eliza Foundation address (receives ELIZA)
    address public elizaFoundation;

    /// @notice Jeju DEX router address (XLPRouter)
    address public dexRouter;

    /// @notice WETH address for swap paths
    address public weth;

    /// @notice Minimum ETH threshold to trigger buyback
    uint256 public buybackThreshold;

    /// @notice Current slippage tolerance in basis points
    uint256 public slippageBps;

    /// @notice Accumulated fees awaiting distribution
    uint256 public accumulatedFees;

    /// @notice Total ETH ever received
    uint256 public totalFeesReceived;

    /// @notice Total BBLN bought back
    uint256 public totalBBLNBought;

    /// @notice Total ELIZA bought back
    uint256 public totalELIZABought;

    /// @notice Total ETH sent to treasury
    uint256 public totalTreasuryETH;

    /// @notice Total buyback executions
    uint256 public totalBuybacks;

    // ═══════════════════════════════════════════════════════════════════════════
    //                              EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event FeesReceived(address indexed from, uint256 amount, uint256 newTotal);
    event BuybackExecuted(
        uint256 indexed buybackId,
        uint256 ethUsed,
        uint256 bblnBought,
        uint256 elizaBought,
        uint256 treasuryEth
    );
    event BBLNBuyback(uint256 ethSpent, uint256 bblnReceived, uint256 price);
    event ELIZABuyback(uint256 ethSpent, uint256 elizaReceived, uint256 price);
    event TreasuryTransfer(uint256 amount);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
    event AddressesUpdated(
        address treasury,
        address elizaFoundation,
        address dexRouter
    );
    event DAOUpdated(address indexed oldDAO, address indexed newDAO);

    // ═══════════════════════════════════════════════════════════════════════════
    //                              ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error ZeroAddress();
    error ZeroAmount();
    error BelowThreshold();
    error SlippageTooHigh();
    error SwapFailed();
    error TransferFailed();
    error InvalidSlippage();
    error NotDAO();

    // ═══════════════════════════════════════════════════════════════════════════
    //                              MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Restricts function to DAO or owner (for initial setup)
     * @dev Once DAO is set, only DAO can call. Owner is fallback for emergencies.
     */
    modifier onlyDAOOrOwner() {
        if (dao != address(0)) {
            if (msg.sender != dao) revert NotDAO();
        } else {
            if (msg.sender != owner()) revert NotDAO();
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(
        address _dao,
        address _bblnToken,
        address _elizaToken,
        address _treasury,
        address _elizaFoundation,
        address _dexRouter,
        address _weth,
        uint256 _buybackThreshold,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_bblnToken == address(0)) revert ZeroAddress();
        if (_elizaToken == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        if (_elizaFoundation == address(0)) revert ZeroAddress();
        if (_dexRouter == address(0)) revert ZeroAddress();
        if (_weth == address(0)) revert ZeroAddress();

        dao = _dao; // Can be address(0) initially, set later
        bblnToken = _bblnToken;
        elizaToken = _elizaToken;
        treasury = _treasury;
        elizaFoundation = _elizaFoundation;
        dexRouter = _dexRouter;
        weth = _weth;
        buybackThreshold = _buybackThreshold;
        slippageBps = 100; // 1% default slippage
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              RECEIVE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Receive ETH from trading fees
     * @dev Automatically triggers buyback if threshold is met
     */
    receive() external payable {
        accumulatedFees += msg.value;
        totalFeesReceived += msg.value;

        emit FeesReceived(msg.sender, msg.value, accumulatedFees);

        // Auto-execute buyback if threshold met and not paused
        if (accumulatedFees >= buybackThreshold && !paused()) {
            _executeBuyback();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              BUYBACK EXECUTION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Manually trigger buyback
     * @dev Can be called by anyone if threshold is met
     */
    function executeBuyback() external nonReentrant whenNotPaused {
        if (accumulatedFees < buybackThreshold) revert BelowThreshold();
        _executeBuyback();
    }

    /**
     * @notice Force execute buyback regardless of threshold (DAO only)
     * @dev Used for cleanup or special circumstances
     */
    function forceExecuteBuyback() external nonReentrant onlyDAOOrOwner {
        if (accumulatedFees == 0) revert ZeroAmount();
        _executeBuyback();
    }

    /**
     * @notice Internal buyback execution
     */
    function _executeBuyback() internal {
        uint256 totalEth = accumulatedFees;
        accumulatedFees = 0;

        // Calculate splits
        uint256 bblnEth = (totalEth * BBLN_BUYBACK_BPS) / TOTAL_BPS;
        uint256 elizaEth = (totalEth * ELIZA_BUYBACK_BPS) / TOTAL_BPS;
        uint256 treasuryEth = totalEth - bblnEth - elizaEth;

        uint256 bblnBought = 0;
        uint256 elizaBought = 0;

        // Execute BBLN buyback
        if (bblnEth > 0) {
            bblnBought = _swapETHForToken(bblnToken, bblnEth, treasury);
            totalBBLNBought += bblnBought;
        }

        // Execute ELIZA buyback
        if (elizaEth > 0) {
            elizaBought = _swapETHForToken(elizaToken, elizaEth, elizaFoundation);
            totalELIZABought += elizaBought;
        }

        // Transfer ETH to treasury
        if (treasuryEth > 0) {
            (bool success, ) = treasury.call{value: treasuryEth}("");
            if (!success) revert TransferFailed();
            totalTreasuryETH += treasuryEth;
            emit TreasuryTransfer(treasuryEth);
        }

        totalBuybacks++;

        emit BuybackExecuted(
            totalBuybacks,
            totalEth,
            bblnBought,
            elizaBought,
            treasuryEth
        );
    }

    /**
     * @notice Swap ETH for token via Jeju DEX
     * @param token Token to buy
     * @param ethAmount ETH to spend
     * @param recipient Address to receive tokens
     * @return amountOut Tokens received
     */
    function _swapETHForToken(
        address token,
        uint256 ethAmount,
        address recipient
    ) internal returns (uint256 amountOut) {
        // Get expected output from DEX
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = token;

        // Get amounts out for slippage calculation
        uint256[] memory amounts = IJejuRouter(dexRouter).getAmountsOut(
            ethAmount,
            path
        );
        uint256 expectedOut = amounts[1];
        uint256 minOut = (expectedOut * (TOTAL_BPS - slippageBps)) / TOTAL_BPS;

        // Execute swap via Jeju DEX
        uint256[] memory swapAmounts = IJejuRouter(dexRouter)
            .swapExactETHForTokens{value: ethAmount}(
            minOut,
            path,
            recipient,
            block.timestamp + 300 // 5 minute deadline
        );

        amountOut = swapAmounts[1];

        // Calculate effective price (wei per token)
        uint256 price = (ethAmount * 1e18) / amountOut;

        if (token == bblnToken) {
            emit BBLNBuyback(ethAmount, amountOut, price);
        } else {
            emit ELIZABuyback(ethAmount, amountOut, price);
        }

        return amountOut;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              DAO GOVERNANCE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set the DAO address (one-time setup or via owner)
     * @param _dao New DAO address
     */
    function setDAO(address _dao) external onlyOwner {
        if (_dao == address(0)) revert ZeroAddress();
        address oldDAO = dao;
        dao = _dao;
        emit DAOUpdated(oldDAO, _dao);
    }

    /**
     * @notice Update buyback threshold (DAO controlled)
     */
    function setThreshold(uint256 _threshold) external onlyDAOOrOwner {
        if (_threshold == 0) revert ZeroAmount();
        uint256 old = buybackThreshold;
        buybackThreshold = _threshold;
        emit ThresholdUpdated(old, _threshold);
    }

    /**
     * @notice Update slippage tolerance (DAO controlled)
     */
    function setSlippage(uint256 _slippageBps) external onlyDAOOrOwner {
        if (_slippageBps > MAX_SLIPPAGE_BPS) revert InvalidSlippage();
        uint256 old = slippageBps;
        slippageBps = _slippageBps;
        emit SlippageUpdated(old, _slippageBps);
    }

    /**
     * @notice Update treasury address (DAO controlled)
     */
    function setTreasury(address _treasury) external onlyDAOOrOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit AddressesUpdated(treasury, elizaFoundation, dexRouter);
    }

    /**
     * @notice Update Eliza Foundation address (DAO controlled)
     */
    function setElizaFoundation(address _elizaFoundation) external onlyDAOOrOwner {
        if (_elizaFoundation == address(0)) revert ZeroAddress();
        elizaFoundation = _elizaFoundation;
        emit AddressesUpdated(treasury, elizaFoundation, dexRouter);
    }

    /**
     * @notice Update DEX router address (DAO controlled)
     */
    function setDexRouter(address _dexRouter) external onlyDAOOrOwner {
        if (_dexRouter == address(0)) revert ZeroAddress();
        dexRouter = _dexRouter;
        emit AddressesUpdated(treasury, elizaFoundation, dexRouter);
    }

    /**
     * @notice Update token addresses (DAO controlled, emergency only)
     */
    function setTokenAddresses(
        address _bblnToken,
        address _elizaToken
    ) external onlyDAOOrOwner {
        if (_bblnToken == address(0)) revert ZeroAddress();
        if (_elizaToken == address(0)) revert ZeroAddress();
        bblnToken = _bblnToken;
        elizaToken = _elizaToken;
    }

    /**
     * @notice Pause buybacks (DAO controlled)
     */
    function pause() external onlyDAOOrOwner {
        _pause();
    }

    /**
     * @notice Unpause buybacks (DAO controlled)
     */
    function unpause() external onlyDAOOrOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw (DAO controlled)
     * @dev Only use in emergencies, bypasses normal distribution
     */
    function emergencyWithdraw(address to) external onlyDAOOrOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = address(this).balance;
        if (balance == 0) revert ZeroAmount();

        accumulatedFees = 0;
        (bool success, ) = to.call{value: balance}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Rescue stuck tokens (DAO controlled)
     */
    function rescueTokens(address token, address to) external onlyDAOOrOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(to, balance);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Check if buyback can be executed
     */
    function canExecuteBuyback() external view returns (bool) {
        return accumulatedFees >= buybackThreshold && !paused();
    }

    /**
     * @notice Get current distribution preview
     */
    function getDistributionPreview()
        external
        view
        returns (
            uint256 total,
            uint256 bblnAllocation,
            uint256 elizaAllocation,
            uint256 treasuryAllocation
        )
    {
        total = accumulatedFees;
        bblnAllocation = (total * BBLN_BUYBACK_BPS) / TOTAL_BPS;
        elizaAllocation = (total * ELIZA_BUYBACK_BPS) / TOTAL_BPS;
        treasuryAllocation = total - bblnAllocation - elizaAllocation;
    }

    /**
     * @notice Get contract stats
     */
    function getStats()
        external
        view
        returns (
            uint256 _accumulatedFees,
            uint256 _buybackThreshold,
            uint256 _totalFeesReceived,
            uint256 _totalBBLNBought,
            uint256 _totalELIZABought,
            uint256 _totalTreasuryETH,
            uint256 _totalBuybacks
        )
    {
        return (
            accumulatedFees,
            buybackThreshold,
            totalFeesReceived,
            totalBBLNBought,
            totalELIZABought,
            totalTreasuryETH,
            totalBuybacks
        );
    }

    /**
     * @notice Get governance info
     */
    function getGovernanceInfo()
        external
        view
        returns (
            address _dao,
            address _treasury,
            address _elizaFoundation,
            address _dexRouter,
            bool _paused
        )
    {
        return (dao, treasury, elizaFoundation, dexRouter, paused());
    }

    /**
     * @notice Get contract version
     */
    function version() external pure returns (string memory) {
        return "1.1.0";
    }
}

/**
 * @title IJejuRouter
 * @notice Minimal interface for Jeju DEX router (XLPRouter)
 */
interface IJejuRouter {
    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
}
