// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BabylonAgentVault
 * @author Babylon Labs
 * @notice Operations vault for Babylon AI CEO and services
 * @dev Manages funding for:
 *      - Training jobs (TEE GPU compute)
 *      - Inference costs
 *      - Storage pinning
 *      - Trigger execution
 *      - Keepalive auto-funding
 *
 * The AI CEO (BabylonDAO) is the primary spender.
 * Approved services can also spend within limits.
 *
 * @custom:security-contact security@babylon.game
 */
contract BabylonAgentVault is Ownable, ReentrancyGuard, Pausable {
    // ═══════════════════════════════════════════════════════════════════════════
    //                              TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    enum SpendCategory {
        TRAINING,
        INFERENCE,
        STORAGE,
        TRIGGER,
        KEEPALIVE,
        INFRASTRUCTURE,
        OTHER
    }

    struct SpendRecord {
        address spender;
        address recipient;
        uint256 amount;
        SpendCategory category;
        string reason;
        bytes32 jobId;       // Associated job/task ID
        uint256 timestamp;
    }

    struct SpenderConfig {
        bool approved;
        uint256 spendLimit;        // Per-transaction limit
        uint256 dailyLimit;        // Daily spending limit
        uint256 spentToday;        // Today's spending
        uint256 lastResetDay;      // Day number for reset
        uint256 totalSpent;        // Lifetime total
        SpendCategory[] categories; // Allowed categories
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice BabylonDAO contract (primary controller)
    address public dao;

    /// @notice AI CEO address (direct spend access)
    address public aiCEO;

    /// @notice Total balance
    uint256 public balance;

    /// @notice Reserved balance (committed to jobs)
    uint256 public reservedBalance;

    /// @notice Minimum balance to maintain for keepalive
    uint256 public minBalance = 0.1 ether;

    /// @notice Auto-fund threshold (triggers top-up from treasury)
    uint256 public autoFundThreshold = 0.5 ether;

    /// @notice Auto-fund amount
    uint256 public autoFundAmount = 1 ether;

    /// @notice Treasury address for auto-funding
    address public treasury;

    /// @notice Approved spenders configuration
    mapping(address => SpenderConfig) public spenders;
    address[] public spenderList;

    /// @notice Spend history
    SpendRecord[] private _spendHistory;

    /// @notice Category totals
    mapping(SpendCategory => uint256) public categoryTotals;

    /// @notice Active job reservations
    mapping(bytes32 => uint256) public jobReservations;

    /// @notice Total deposits
    uint256 public totalDeposits;

    /// @notice Total spent
    uint256 public totalSpent;

    // ═══════════════════════════════════════════════════════════════════════════
    //                              EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event Deposit(address indexed from, uint256 amount, uint256 newBalance);
    event Spent(
        address indexed spender,
        address indexed recipient,
        uint256 amount,
        SpendCategory category,
        string reason,
        bytes32 jobId
    );
    event Reserved(bytes32 indexed jobId, uint256 amount);
    event ReservationReleased(bytes32 indexed jobId, uint256 amount, bool spent);
    event SpenderApproved(address indexed spender, uint256 spendLimit, uint256 dailyLimit);
    event SpenderRevoked(address indexed spender);
    event AutoFunded(uint256 amount, address indexed from);
    event DAOSet(address indexed oldDAO, address indexed newDAO);
    event AICEOSet(address indexed oldCEO, address indexed newCEO);
    event TreasurySet(address indexed oldTreasury, address indexed newTreasury);

    // ═══════════════════════════════════════════════════════════════════════════
    //                              ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error NotAuthorized();
    error NotDAO();
    error NotApprovedSpender();
    error InsufficientBalance(uint256 available, uint256 required);
    error SpendLimitExceeded(uint256 limit, uint256 amount);
    error DailyLimitExceeded(uint256 limit, uint256 spent, uint256 amount);
    error CategoryNotAllowed(SpendCategory category);
    error ReservationNotFound(bytes32 jobId);
    error ZeroAddress();
    error ZeroAmount();
    error TransferFailed();

    // ═══════════════════════════════════════════════════════════════════════════
    //                              MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyDAO() {
        if (msg.sender != dao) revert NotDAO();
        _;
    }

    modifier onlyAuthorized() {
        if (msg.sender != dao && msg.sender != aiCEO && msg.sender != owner()) {
            revert NotAuthorized();
        }
        _;
    }

    modifier onlyApprovedSpender() {
        if (msg.sender != dao && msg.sender != aiCEO && !spenders[msg.sender].approved) {
            revert NotApprovedSpender();
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(
        address _dao,
        address _aiCEO,
        address _treasury,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_dao == address(0)) revert ZeroAddress();
        
        dao = _dao;
        aiCEO = _aiCEO;
        treasury = _treasury;

        emit DAOSet(address(0), _dao);
        emit AICEOSet(address(0), _aiCEO);
        emit TreasurySet(address(0), _treasury);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              DEPOSITS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Deposit ETH into the vault
     */
    function deposit() external payable whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();
        
        balance += msg.value;
        totalDeposits += msg.value;
        
        emit Deposit(msg.sender, msg.value, balance);
    }

    /**
     * @notice Receive ETH directly
     */
    receive() external payable {
        balance += msg.value;
        totalDeposits += msg.value;
        emit Deposit(msg.sender, msg.value, balance);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              SPENDING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Spend from vault (DAO/AI CEO - unlimited)
     */
    function spend(
        address recipient,
        uint256 amount,
        SpendCategory category,
        string calldata reason,
        bytes32 jobId
    ) external nonReentrant onlyAuthorized whenNotPaused returns (bool) {
        return _spend(recipient, amount, category, reason, jobId);
    }

    /**
     * @notice Spend from vault (approved spenders - with limits)
     */
    function spendWithLimits(
        address recipient,
        uint256 amount,
        SpendCategory category,
        string calldata reason,
        bytes32 jobId
    ) external nonReentrant onlyApprovedSpender whenNotPaused returns (bool) {
        SpenderConfig storage config = spenders[msg.sender];
        
        // Check spend limit
        if (amount > config.spendLimit) {
            revert SpendLimitExceeded(config.spendLimit, amount);
        }

        // Check and update daily limit
        uint256 today = block.timestamp / 1 days;
        if (today != config.lastResetDay) {
            config.spentToday = 0;
            config.lastResetDay = today;
        }
        
        if (config.spentToday + amount > config.dailyLimit) {
            revert DailyLimitExceeded(config.dailyLimit, config.spentToday, amount);
        }

        // Check category
        bool categoryAllowed = config.categories.length == 0; // Empty = all allowed
        for (uint256 i = 0; i < config.categories.length && !categoryAllowed; i++) {
            if (config.categories[i] == category) {
                categoryAllowed = true;
            }
        }
        if (!categoryAllowed) {
            revert CategoryNotAllowed(category);
        }

        config.spentToday += amount;
        config.totalSpent += amount;

        return _spend(recipient, amount, category, reason, jobId);
    }

    function _spend(
        address recipient,
        uint256 amount,
        SpendCategory category,
        string calldata reason,
        bytes32 jobId
    ) internal returns (bool) {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 available = balance - reservedBalance;
        if (available < amount) {
            revert InsufficientBalance(available, amount);
        }

        balance -= amount;
        totalSpent += amount;
        categoryTotals[category] += amount;

        _spendHistory.push(SpendRecord({
            spender: msg.sender,
            recipient: recipient,
            amount: amount,
            category: category,
            reason: reason,
            jobId: jobId,
            timestamp: block.timestamp
        }));

        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Spent(msg.sender, recipient, amount, category, reason, jobId);

        // Check if auto-fund needed
        _checkAutoFund();

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              RESERVATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Reserve balance for a job
     */
    function reserve(bytes32 jobId, uint256 amount) external onlyAuthorized {
        if (amount == 0) revert ZeroAmount();
        
        uint256 available = balance - reservedBalance;
        if (available < amount) {
            revert InsufficientBalance(available, amount);
        }

        jobReservations[jobId] += amount;
        reservedBalance += amount;

        emit Reserved(jobId, amount);
    }

    /**
     * @notice Release reservation (spend or refund)
     */
    function releaseReservation(
        bytes32 jobId,
        address recipient,
        uint256 amountToSpend,
        SpendCategory category,
        string calldata reason
    ) external nonReentrant onlyAuthorized {
        uint256 reserved = jobReservations[jobId];
        if (reserved == 0) revert ReservationNotFound(jobId);

        jobReservations[jobId] = 0;
        reservedBalance -= reserved;

        if (amountToSpend > 0 && amountToSpend <= reserved) {
            // Spend portion
            balance -= amountToSpend;
            totalSpent += amountToSpend;
            categoryTotals[category] += amountToSpend;

            (bool success,) = recipient.call{value: amountToSpend}("");
            if (!success) revert TransferFailed();

            emit Spent(msg.sender, recipient, amountToSpend, category, reason, jobId);
        }

        uint256 refunded = reserved - amountToSpend;
        emit ReservationReleased(jobId, reserved, amountToSpend > 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              AUTO-FUND
    // ═══════════════════════════════════════════════════════════════════════════

    function _checkAutoFund() internal {
        if (treasury == address(0)) return;
        if (balance >= autoFundThreshold) return;

        // Request auto-fund from treasury
        // This is a pull mechanism - treasury needs to approve this vault
        (bool success,) = treasury.call(
            abi.encodeWithSignature(
                "autoFundVault(address,uint256)",
                address(this),
                autoFundAmount
            )
        );

        if (success) {
            emit AutoFunded(autoFundAmount, treasury);
        }
    }

    /**
     * @notice Manual trigger auto-fund check
     */
    function triggerAutoFund() external onlyAuthorized {
        _checkAutoFund();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              SPENDER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Approve a spender with limits
     */
    function approveSpender(
        address spender,
        uint256 spendLimit,
        uint256 dailyLimit,
        SpendCategory[] calldata categories
    ) external onlyAuthorized {
        if (spender == address(0)) revert ZeroAddress();

        SpenderConfig storage config = spenders[spender];
        
        if (!config.approved) {
            spenderList.push(spender);
        }

        config.approved = true;
        config.spendLimit = spendLimit;
        config.dailyLimit = dailyLimit;
        config.categories = categories;

        emit SpenderApproved(spender, spendLimit, dailyLimit);
    }

    /**
     * @notice Revoke spender approval
     */
    function revokeSpender(address spender) external onlyAuthorized {
        spenders[spender].approved = false;
        emit SpenderRevoked(spender);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              ADMIN
    // ═══════════════════════════════════════════════════════════════════════════

    function setDAO(address _dao) external onlyOwner {
        if (_dao == address(0)) revert ZeroAddress();
        address old = dao;
        dao = _dao;
        emit DAOSet(old, _dao);
    }

    function setAICEO(address _aiCEO) external onlyOwner {
        address old = aiCEO;
        aiCEO = _aiCEO;
        emit AICEOSet(old, _aiCEO);
    }

    function setTreasury(address _treasury) external onlyOwner {
        address old = treasury;
        treasury = _treasury;
        emit TreasurySet(old, _treasury);
    }

    function setMinBalance(uint256 _minBalance) external onlyAuthorized {
        minBalance = _minBalance;
    }

    function setAutoFundConfig(uint256 threshold, uint256 amount) external onlyAuthorized {
        autoFundThreshold = threshold;
        autoFundAmount = amount;
    }

    function pause() external onlyAuthorized {
        _pause();
    }

    function unpause() external onlyAuthorized {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getAvailableBalance() external view returns (uint256) {
        return balance - reservedBalance;
    }

    function getSpendHistory(uint256 limit) external view returns (SpendRecord[] memory) {
        uint256 start = _spendHistory.length > limit ? _spendHistory.length - limit : 0;
        uint256 count = _spendHistory.length - start;

        SpendRecord[] memory history = new SpendRecord[](count);
        for (uint256 i = 0; i < count; i++) {
            history[i] = _spendHistory[start + i];
        }
        return history;
    }

    function getSpenderConfig(address spender) external view returns (SpenderConfig memory) {
        return spenders[spender];
    }

    function getSpenderList() external view returns (address[] memory) {
        return spenderList;
    }

    function getCategoryTotal(SpendCategory category) external view returns (uint256) {
        return categoryTotals[category];
    }

    function getStats() external view returns (
        uint256 _balance,
        uint256 _reserved,
        uint256 _available,
        uint256 _totalDeposits,
        uint256 _totalSpent
    ) {
        return (
            balance,
            reservedBalance,
            balance - reservedBalance,
            totalDeposits,
            totalSpent
        );
    }

    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}


