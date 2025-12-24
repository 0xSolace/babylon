// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BabylonTreasury
 * @author Babylon Network
 * @notice Treasury contract for Babylon DAO funds management
 * @dev Manages ETH and ERC20 tokens with role-based access control
 *
 * Features:
 * - Multi-sig style access control via roles
 * - Daily withdrawal limits
 * - Approved vault management
 * - DAO integration for governance
 */
contract BabylonTreasury is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

    address public dao;
    uint256 public dailyWithdrawalLimit;
    uint256 public withdrawnToday;
    uint256 public lastWithdrawalDay;

    mapping(address => bool) public approvedVaults;
    mapping(address => uint256) public tokenBalances;

    event FundsDeposited(address indexed from, address indexed token, uint256 amount);
    event FundsWithdrawn(address indexed to, address indexed token, uint256 amount);
    event VaultApproved(address indexed vault, bool approved);
    event DAOSet(address indexed dao);
    event DailyLimitSet(uint256 newLimit);

    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBalance(uint256 available, uint256 requested);
    error ExceedsDailyLimit(uint256 limit, uint256 requested);
    error VaultNotApproved();
    error TransferFailed();

    constructor(address owner_) {
        if (owner_ == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(OPERATOR_ROLE, owner_);

        dailyWithdrawalLimit = 100 ether;
    }

    receive() external payable {
        emit FundsDeposited(msg.sender, address(0), msg.value);
    }

    /**
     * @notice Deposit ETH
     */
    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();
        emit FundsDeposited(msg.sender, address(0), msg.value);
    }

    /**
     * @notice Deposit ERC20 tokens
     * @param token Token address
     * @param amount Amount to deposit
     */
    function depositToken(address token, uint256 amount) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        tokenBalances[token] += amount;

        emit FundsDeposited(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw ETH (operators only)
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function withdrawETH(uint256 amount, address to) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (address(this).balance < amount) {
            revert InsufficientBalance(address(this).balance, amount);
        }

        _enforceWithdrawalLimit(amount);

        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FundsWithdrawn(to, address(0), amount);
    }

    /**
     * @notice Withdraw ERC20 tokens (operators only)
     * @param token Token address
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function withdrawToken(address token, uint256 amount, address to)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) {
            revert InsufficientBalance(balance, amount);
        }

        IERC20(token).safeTransfer(to, amount);

        emit FundsWithdrawn(to, token, amount);
    }

    /**
     * @notice Transfer funds to an approved vault
     * @param vault Vault address
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to transfer
     */
    function transferToVault(address vault, address token, uint256 amount)
        external
        onlyRole(DAO_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (!approvedVaults[vault]) revert VaultNotApproved();
        if (amount == 0) revert ZeroAmount();

        if (token == address(0)) {
            if (address(this).balance < amount) {
                revert InsufficientBalance(address(this).balance, amount);
            }
            (bool success,) = vault.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance < amount) {
                revert InsufficientBalance(balance, amount);
            }
            IERC20(token).safeTransfer(vault, amount);
        }

        emit FundsWithdrawn(vault, token, amount);
    }

    /**
     * @notice Set the DAO address
     * @param _dao DAO address
     */
    function setDAO(address _dao) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_dao == address(0)) revert ZeroAddress();
        dao = _dao;
        _grantRole(DAO_ROLE, _dao);
        emit DAOSet(_dao);
    }

    /**
     * @notice Approve or disapprove a vault
     * @param vault Vault address
     */
    function approveVault(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (vault == address(0)) revert ZeroAddress();
        approvedVaults[vault] = true;
        emit VaultApproved(vault, true);
    }

    /**
     * @notice Revoke vault approval
     * @param vault Vault address
     */
    function revokeVault(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        approvedVaults[vault] = false;
        emit VaultApproved(vault, false);
    }

    /**
     * @notice Set daily withdrawal limit
     * @param limit New limit in wei
     */
    function setDailyLimit(uint256 limit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dailyWithdrawalLimit = limit;
        emit DailyLimitSet(limit);
    }

    /**
     * @notice Pause withdrawals
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause withdrawals
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Get ETH balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get token balance
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice Get withdrawal info for today
     */
    function getWithdrawalInfo() external view returns (uint256 limit, uint256 used, uint256 remaining) {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 usedToday = currentDay > lastWithdrawalDay ? 0 : withdrawnToday;
        uint256 remainingToday = dailyWithdrawalLimit > usedToday ? dailyWithdrawalLimit - usedToday : 0;

        return (dailyWithdrawalLimit, usedToday, remainingToday);
    }

    function _enforceWithdrawalLimit(uint256 amount) internal {
        uint256 currentDay = block.timestamp / 1 days;

        if (currentDay > lastWithdrawalDay) {
            withdrawnToday = 0;
            lastWithdrawalDay = currentDay;
        }

        uint256 remaining = dailyWithdrawalLimit > withdrawnToday ? dailyWithdrawalLimit - withdrawnToday : 0;

        if (amount > remaining) {
            revert ExceedsDailyLimit(dailyWithdrawalLimit, amount);
        }

        withdrawnToday += amount;
    }

    /**
     * @notice Contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
