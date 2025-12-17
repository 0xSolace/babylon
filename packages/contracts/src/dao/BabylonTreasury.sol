// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BabylonTreasury
 * @author Babylon Labs
 * @notice Protocol treasury for Babylon game
 * @dev Holds:
 *      - Protocol fees from game
 *      - BBLN token reserves
 *      - ETH for operations
 *
 * Controlled by BabylonDAO (AI CEO)
 *
 * @custom:security-contact security@babylon.game
 */
contract BabylonTreasury is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    //                              STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice BabylonDAO
    address public dao;

    /// @notice BBLN token
    address public bblnToken;

    /// @notice Agent vaults that can request auto-funding
    mapping(address => bool) public approvedVaults;

    /// @notice Auto-fund limits per vault
    mapping(address => uint256) public vaultAutoFundLimit;

    /// @notice Auto-fund cooldown per vault
    mapping(address => uint256) public vaultLastAutoFund;

    /// @notice Auto-fund cooldown duration
    uint256 public autoFundCooldown = 1 hours;

    /// @notice Total ETH distributed
    uint256 public totalETHDistributed;

    /// @notice Total BBLN distributed
    uint256 public totalBBLNDistributed;

    // ═══════════════════════════════════════════════════════════════════════════
    //                              EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event ETHReceived(address indexed from, uint256 amount);
    event ETHDistributed(address indexed to, uint256 amount, string reason);
    event TokenDistributed(address indexed token, address indexed to, uint256 amount, string reason);
    event VaultApproved(address indexed vault, uint256 autoFundLimit);
    event VaultRevoked(address indexed vault);
    event AutoFundExecuted(address indexed vault, uint256 amount);
    event DAOSet(address indexed oldDAO, address indexed newDAO);

    // ═══════════════════════════════════════════════════════════════════════════
    //                              ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error NotDAO();
    error NotApprovedVault();
    error AutoFundCooldown();
    error AutoFundLimitExceeded();
    error InsufficientBalance();
    error ZeroAddress();
    error ZeroAmount();
    error TransferFailed();

    // ═══════════════════════════════════════════════════════════════════════════
    //                              MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyDAO() {
        if (msg.sender != dao && msg.sender != owner()) revert NotDAO();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(
        address _dao,
        address _bblnToken,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_dao == address(0)) revert ZeroAddress();
        
        dao = _dao;
        bblnToken = _bblnToken;

        emit DAOSet(address(0), _dao);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              RECEIVE
    // ═══════════════════════════════════════════════════════════════════════════

    receive() external payable {
        emit ETHReceived(msg.sender, msg.value);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              DISTRIBUTION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Distribute ETH
     */
    function distributeETH(
        address to,
        uint256 amount,
        string calldata reason
    ) external nonReentrant onlyDAO whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (address(this).balance < amount) revert InsufficientBalance();

        totalETHDistributed += amount;

        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit ETHDistributed(to, amount, reason);
    }

    /**
     * @notice Distribute ERC20 tokens
     */
    function distributeToken(
        address token,
        address to,
        uint256 amount,
        string calldata reason
    ) external nonReentrant onlyDAO whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(to, amount);

        if (token == bblnToken) {
            totalBBLNDistributed += amount;
        }

        emit TokenDistributed(token, to, amount, reason);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              AUTO-FUND
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Auto-fund a vault (called by vault)
     */
    function autoFundVault(address vault, uint256 amount) external nonReentrant {
        if (!approvedVaults[vault]) revert NotApprovedVault();
        if (msg.sender != vault) revert NotApprovedVault();
        if (block.timestamp < vaultLastAutoFund[vault] + autoFundCooldown) {
            revert AutoFundCooldown();
        }
        if (amount > vaultAutoFundLimit[vault]) revert AutoFundLimitExceeded();
        if (address(this).balance < amount) revert InsufficientBalance();

        vaultLastAutoFund[vault] = block.timestamp;
        totalETHDistributed += amount;

        (bool success,) = vault.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit AutoFundExecuted(vault, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              VAULT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Approve a vault for auto-funding
     */
    function approveVault(address vault, uint256 autoFundLimit) external onlyDAO {
        if (vault == address(0)) revert ZeroAddress();
        
        approvedVaults[vault] = true;
        vaultAutoFundLimit[vault] = autoFundLimit;

        emit VaultApproved(vault, autoFundLimit);
    }

    /**
     * @notice Revoke vault approval
     */
    function revokeVault(address vault) external onlyDAO {
        approvedVaults[vault] = false;
        emit VaultRevoked(vault);
    }

    /**
     * @notice Update vault auto-fund limit
     */
    function setVaultAutoFundLimit(address vault, uint256 limit) external onlyDAO {
        vaultAutoFundLimit[vault] = limit;
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

    function setBBLNToken(address _token) external onlyOwner {
        bblnToken = _token;
    }

    function setAutoFundCooldown(uint256 _cooldown) external onlyDAO {
        autoFundCooldown = _cooldown;
    }

    function pause() external onlyDAO {
        _pause();
    }

    function unpause() external onlyDAO {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getBBLNBalance() external view returns (uint256) {
        if (bblnToken == address(0)) return 0;
        return IERC20(bblnToken).balanceOf(address(this));
    }

    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function canAutoFund(address vault) external view returns (bool) {
        if (!approvedVaults[vault]) return false;
        if (block.timestamp < vaultLastAutoFund[vault] + autoFundCooldown) return false;
        return true;
    }

    function getStats() external view returns (
        uint256 ethBalance,
        uint256 bblnBalance,
        uint256 ethDistributed,
        uint256 bblnDistributed
    ) {
        return (
            address(this).balance,
            bblnToken != address(0) ? IERC20(bblnToken).balanceOf(address(this)) : 0,
            totalETHDistributed,
            totalBBLNDistributed
        );
    }

    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}


