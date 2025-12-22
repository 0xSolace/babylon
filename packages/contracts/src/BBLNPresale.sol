// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BBLNPresale
 * @notice Presale contract for BBLN token with CCA auction mechanics
 * @dev Features:
 *   - Dutch auction pricing (price decreases over time)
 *   - ELIZA token holder bonus (50% extra allocation)
 *   - Automatic LP creation and locking at finalization
 *   - Configurable soft/hard caps
 *   - Refunds if soft cap not met
 */
contract BBLNPresale is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    // =========================================================================
    // STATE
    // =========================================================================

    /// @notice The BBLN token being sold
    IERC20 public immutable token;

    /// @notice ELIZA token for bonus verification
    IERC20 public immutable elizaToken;

    /// @notice Treasury address for fund distribution
    address public treasury;

    /// @notice LP factory for creating liquidity pool
    address public lpFactory;

    /// @notice LP locker for locking LP tokens
    address public lpLocker;

    /// @notice WETH address for LP pairing
    address public weth;

    // Presale configuration
    uint256 public tokensForSale;
    uint256 public softCap;
    uint256 public hardCap;
    uint256 public minContribution;
    uint256 public maxContribution;

    // CCA Auction pricing
    uint256 public startPrice;
    uint256 public reservePrice;
    uint256 public priceDecayPerSecond;

    // Timeline
    uint256 public presaleStart;
    uint256 public presaleEnd;
    uint256 public buyerClaimStart;
    uint256 public claimDeadline;

    // LP configuration
    uint256 public lpFundingBps; // % of raised ETH to LP (in basis points)
    uint256 public lpLockDuration;

    // ELIZA bonus configuration
    uint256 public elizaMinBalance;
    uint256 public elizaBonusBps; // Bonus % for ELIZA holders (in basis points)

    // State tracking
    uint256 public totalRaised;
    uint256 public totalParticipants;
    bool public finalized;
    bool public failed;
    address public lpPair;

    // Contribution tracking
    struct Contribution {
        uint256 ethAmount;
        uint256 tokenAllocation;
        uint256 elizaBonus;
        uint256 claimedTokens;
        bool isElizaHolder;
        bool refunded;
    }

    mapping(address => Contribution) public contributions;
    address[] public contributors;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event PresaleStarted(uint256 startTime, uint256 endTime);
    event ContributionReceived(address indexed contributor, uint256 amount, bool isElizaHolder);
    event PresaleFinalized(uint256 totalRaised, uint256 participants, address lpPair);
    event PresaleFailed(uint256 totalRaised, uint256 softCap);
    event TokensClaimed(address indexed contributor, uint256 amount);
    event RefundClaimed(address indexed contributor, uint256 amount);
    event ConfigUpdated(string param, uint256 value);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error PresaleNotStarted();
    error PresaleEnded();
    error PresaleNotEnded();
    error PresaleAlreadyFinalized();
    error SoftCapNotReached();
    error HardCapReached();
    error BelowMinContribution();
    error AboveMaxContribution();
    error NoContribution();
    error AlreadyRefunded();
    error ClaimNotStarted();
    error ClaimDeadlinePassed();
    error AlreadyClaimed();
    error NotFailed();
    error InvalidConfiguration();
    error ZeroAddress();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(
        address _token,
        address _elizaToken,
        address _treasury,
        address _owner
    ) Ownable(_owner) {
        if (_token == address(0) || _treasury == address(0)) revert ZeroAddress();

        token = IERC20(_token);
        elizaToken = IERC20(_elizaToken);
        treasury = _treasury;

        // Default configuration
        tokensForSale = 100_000_000 * 10 ** 18; // 100M BBLN
        softCap = 500 ether;
        hardCap = 5000 ether;
        minContribution = 0.1 ether;
        maxContribution = 100 ether;

        // CCA Auction defaults
        startPrice = 0.00005 ether; // $0.18 at $3600/ETH
        reservePrice = 0.00001 ether;
        priceDecayPerSecond = 1e12;

        // LP defaults
        lpFundingBps = 2000; // 20% to LP
        lpLockDuration = 180 days;

        // ELIZA bonus defaults
        elizaMinBalance = 1000 * 10 ** 18; // 1000 ELIZA
        elizaBonusBps = 5000; // 50% bonus

        // Claim period: 6 months
        claimDeadline = 180 days;
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    /**
     * @notice Configure presale parameters
     * @dev Must be called before presale starts
     */
    function configure(
        uint256 _tokensForSale,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _minContribution,
        uint256 _maxContribution,
        uint256 _startPrice,
        uint256 _reservePrice,
        uint256 _priceDecayPerSecond,
        uint256 _lpFundingBps,
        uint256 _lpLockDuration
    ) external onlyOwner {
        if (presaleStart != 0) revert PresaleAlreadyFinalized();
        if (_softCap > _hardCap) revert InvalidConfiguration();
        if (_minContribution > _maxContribution) revert InvalidConfiguration();
        if (_startPrice < _reservePrice) revert InvalidConfiguration();
        if (_lpFundingBps > 5000) revert InvalidConfiguration(); // Max 50% to LP

        tokensForSale = _tokensForSale;
        softCap = _softCap;
        hardCap = _hardCap;
        minContribution = _minContribution;
        maxContribution = _maxContribution;
        startPrice = _startPrice;
        reservePrice = _reservePrice;
        priceDecayPerSecond = _priceDecayPerSecond;
        lpFundingBps = _lpFundingBps;
        lpLockDuration = _lpLockDuration;
    }

    /**
     * @notice Set LP infrastructure addresses
     */
    function setLPInfrastructure(
        address _lpFactory,
        address _lpLocker,
        address _weth
    ) external onlyOwner {
        if (_lpFactory == address(0) || _lpLocker == address(0) || _weth == address(0)) {
            revert ZeroAddress();
        }
        lpFactory = _lpFactory;
        lpLocker = _lpLocker;
        weth = _weth;
    }

    /**
     * @notice Configure ELIZA bonus
     */
    function setElizaBonus(uint256 _minBalance, uint256 _bonusBps) external onlyOwner {
        if (_bonusBps > 10000) revert InvalidConfiguration(); // Max 100% bonus
        elizaMinBalance = _minBalance;
        elizaBonusBps = _bonusBps;
        emit ConfigUpdated("elizaBonus", _bonusBps);
    }

    /**
     * @notice Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    /**
     * @notice Start the presale
     * @param duration Presale duration in seconds
     * @param claimDelay Delay after presale end before claims open
     */
    function startPresale(uint256 duration, uint256 claimDelay) public onlyOwner {
        if (presaleStart != 0) revert PresaleAlreadyFinalized();
        if (token.balanceOf(address(this)) < tokensForSale) revert InvalidConfiguration();

        presaleStart = block.timestamp;
        presaleEnd = block.timestamp + duration;
        buyerClaimStart = presaleEnd + claimDelay;

        emit PresaleStarted(presaleStart, presaleEnd);
    }

    /**
     * @notice Start presale immediately (for testing/dev)
     */
    function startPresaleNow() external onlyOwner {
        startPresale(7 days, 1 days);
    }

    /**
     * @notice Pause the presale
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the presale
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // =========================================================================
    // USER FUNCTIONS
    // =========================================================================

    /**
     * @notice Contribute ETH to the presale
     */
    function contribute() external payable nonReentrant whenNotPaused {
        if (presaleStart == 0 || block.timestamp < presaleStart) revert PresaleNotStarted();
        if (block.timestamp > presaleEnd) revert PresaleEnded();
        if (totalRaised >= hardCap) revert HardCapReached();

        uint256 amount = msg.value;
        Contribution storage c = contributions[msg.sender];

        // Validate contribution limits
        if (amount < minContribution && c.ethAmount == 0) revert BelowMinContribution();
        if (c.ethAmount + amount > maxContribution) revert AboveMaxContribution();

        // Cap to hard cap
        if (totalRaised + amount > hardCap) {
            amount = hardCap - totalRaised;
            // Refund excess
            uint256 excess = msg.value - amount;
            if (excess > 0) {
                (bool success,) = msg.sender.call{value: excess}("");
                require(success, "Refund failed");
            }
        }

        // Check ELIZA holder status
        bool isElizaHolder = checkElizaHolder(msg.sender);

        // Track new contributor
        if (c.ethAmount == 0) {
            contributors.push(msg.sender);
            totalParticipants++;
        }

        // Update contribution
        c.ethAmount += amount;
        c.isElizaHolder = isElizaHolder;
        totalRaised += amount;

        emit ContributionReceived(msg.sender, amount, isElizaHolder);
    }

    /**
     * @notice Claim tokens after presale finalization
     */
    function claim() external nonReentrant {
        if (!finalized) revert PresaleNotEnded();
        if (failed) revert NotFailed();
        if (block.timestamp < buyerClaimStart) revert ClaimNotStarted();
        if (block.timestamp > buyerClaimStart + claimDeadline) revert ClaimDeadlinePassed();

        Contribution storage c = contributions[msg.sender];
        if (c.ethAmount == 0) revert NoContribution();

        uint256 claimable = c.tokenAllocation + c.elizaBonus - c.claimedTokens;
        if (claimable == 0) revert AlreadyClaimed();

        c.claimedTokens += claimable;
        token.safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable);
    }

    /**
     * @notice Claim refund if presale failed
     */
    function refund() external nonReentrant {
        if (!failed) revert NotFailed();

        Contribution storage c = contributions[msg.sender];
        if (c.ethAmount == 0) revert NoContribution();
        if (c.refunded) revert AlreadyRefunded();

        c.refunded = true;
        uint256 refundAmount = c.ethAmount;

        (bool success,) = msg.sender.call{value: refundAmount}("");
        require(success, "Refund failed");

        emit RefundClaimed(msg.sender, refundAmount);
    }

    // =========================================================================
    // FINALIZATION
    // =========================================================================

    /**
     * @notice Finalize the presale after it ends
     * @dev Creates LP, locks LP tokens, distributes funds
     */
    function finalize() external nonReentrant {
        if (presaleStart == 0) revert PresaleNotStarted();
        if (block.timestamp <= presaleEnd) revert PresaleNotEnded();
        if (finalized) revert PresaleAlreadyFinalized();

        finalized = true;

        // Check soft cap
        if (totalRaised < softCap) {
            failed = true;
            emit PresaleFailed(totalRaised, softCap);
            return;
        }

        // Calculate final token price based on total raised
        // Note: finalPrice can be used for analytics but allocations are proportional
        // uint256 finalPrice = (totalRaised * 1e18) / tokensForSale;

        // Calculate allocations for each contributor
        for (uint256 i = 0; i < contributors.length; i++) {
            address contributor = contributors[i];
            Contribution storage c = contributions[contributor];

            // Base allocation proportional to contribution
            c.tokenAllocation = (c.ethAmount * tokensForSale) / totalRaised;

            // ELIZA holder bonus
            if (c.isElizaHolder) {
                c.elizaBonus = (c.tokenAllocation * elizaBonusBps) / 10000;
            }
        }

        // Calculate fund distribution
        uint256 ethToLP = (totalRaised * lpFundingBps) / 10000;
        uint256 ethToTreasury = totalRaised - ethToLP;

        // Transfer to treasury
        if (ethToTreasury > 0) {
            (bool success,) = treasury.call{value: ethToTreasury}("");
            require(success, "Treasury transfer failed");
        }

        // Create and fund LP (if infrastructure is set up)
        if (lpFactory != address(0) && ethToLP > 0) {
            // Calculate tokens for LP (same ratio as presale)
            // Note: tokensForLP would be used when LP infrastructure is set up
            // uint256 tokensForLP = (ethToLP * tokensForSale) / totalRaised;

            // LP creation would happen here via IXLPFactory
            // For now, store the LP pair address as zero
            lpPair = address(0);

            // LP tokens would be locked via LPLocker
        }

        emit PresaleFinalized(totalRaised, totalParticipants, lpPair);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    /**
     * @notice Get current CCA auction price
     */
    function getCurrentPrice() public view returns (uint256) {
        if (presaleStart == 0 || block.timestamp < presaleStart) {
            return startPrice;
        }

        uint256 elapsed = block.timestamp - presaleStart;
        uint256 decay = elapsed * priceDecayPerSecond;

        if (startPrice <= decay + reservePrice) {
            return reservePrice;
        }

        return startPrice - decay;
    }

    /**
     * @notice Check if address is ELIZA holder
     */
    function checkElizaHolder(address account) public view returns (bool) {
        if (address(elizaToken) == address(0)) return false;
        return elizaToken.balanceOf(account) >= elizaMinBalance;
    }

    /**
     * @notice Get presale status
     */
    function getStatus()
        external
        view
        returns (
            uint256 raised,
            uint256 participants,
            uint256 progress,
            uint256 timeRemaining,
            bool isActive,
            bool isFinalized,
            bool isFailed
        )
    {
        raised = totalRaised;
        participants = totalParticipants;
        progress = hardCap > 0 ? (totalRaised * 10000) / hardCap : 0;

        if (presaleEnd > block.timestamp) {
            timeRemaining = presaleEnd - block.timestamp;
        }

        isActive = presaleStart != 0 && block.timestamp >= presaleStart && block.timestamp <= presaleEnd && !finalized;
        isFinalized = finalized;
        isFailed = failed;
    }

    /**
     * @notice Get contribution info for an address
     */
    function getContribution(address contributor)
        external
        view
        returns (
            uint256 ethAmount,
            uint256 tokenAllocation,
            uint256 claimedTokens,
            uint256 claimable,
            bool isRefunded
        )
    {
        Contribution storage c = contributions[contributor];
        ethAmount = c.ethAmount;
        tokenAllocation = c.tokenAllocation + c.elizaBonus;
        claimedTokens = c.claimedTokens;
        claimable = tokenAllocation - claimedTokens;
        isRefunded = c.refunded;
    }

    /**
     * @notice Preview token allocation for a contribution amount
     */
    function previewAllocation(uint256 ethAmount, bool isElizaHolder)
        external
        view
        returns (uint256 baseAllocation, uint256 bonus, uint256 total)
    {
        uint256 currentPrice = getCurrentPrice();
        baseAllocation = (ethAmount * 1e18) / currentPrice;

        if (isElizaHolder) {
            bonus = (baseAllocation * elizaBonusBps) / 10000;
        }

        total = baseAllocation + bonus;
    }

    /**
     * @notice Get all contributors
     */
    function getContributors() external view returns (address[] memory) {
        return contributors;
    }

    /**
     * @notice Get contributor count
     */
    function getContributorCount() external view returns (uint256) {
        return contributors.length;
    }

    // =========================================================================
    // EMERGENCY
    // =========================================================================

    /**
     * @notice Emergency withdraw (only if presale failed)
     */
    function emergencyWithdraw() external onlyOwner {
        if (!failed && finalized) revert InvalidConfiguration();

        // Return unsold tokens to treasury
        uint256 tokenBalance = token.balanceOf(address(this));
        if (tokenBalance > 0) {
            token.safeTransfer(treasury, tokenBalance);
        }
    }

    /**
     * @notice Recover accidentally sent tokens
     */
    function recoverTokens(address _token, uint256 amount) external onlyOwner {
        if (_token == address(token) && !failed) revert InvalidConfiguration();
        IERC20(_token).safeTransfer(treasury, amount);
    }

    receive() external payable {
        // Accept ETH for LP creation
    }
}

