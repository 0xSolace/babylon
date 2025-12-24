// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BabylonAgentVault
 * @author Babylon Network
 * @notice Vault for AI agent operations and rewards distribution
 * @dev Manages funds allocated to AI agents for autonomous operations
 *
 * Features:
 * - Agent registration and budget management
 * - Reward distribution for successful operations
 * - Treasury integration for funding
 * - DAO governance for agent approval
 */
contract BabylonAgentVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

    struct Agent {
        address agentAddress;
        uint256 budget;
        uint256 spent;
        uint256 rewards;
        uint256 registeredAt;
        bool isActive;
        string metadata;
    }

    address public treasury;
    address public dao;

    mapping(address => Agent) public agents;
    address[] public agentList;
    mapping(address => uint256) public agentIndex;

    uint256 public totalAgentBudgets;
    uint256 public totalRewardsDistributed;

    event AgentRegistered(address indexed agent, uint256 initialBudget, string metadata);
    event AgentDeactivated(address indexed agent);
    event BudgetAllocated(address indexed agent, uint256 amount);
    event RewardDistributed(address indexed agent, uint256 amount);
    event FundsSpent(address indexed agent, address indexed recipient, uint256 amount, string reason);
    event TreasurySet(address indexed treasury);
    event DAOSet(address indexed dao);

    error ZeroAddress();
    error ZeroAmount();
    error AgentAlreadyExists();
    error AgentNotFound();
    error AgentNotActive();
    error InsufficientBudget(uint256 available, uint256 requested);
    error InsufficientBalance(uint256 available, uint256 requested);
    error TransferFailed();
    error NotAuthorized();

    modifier onlyActiveAgent() {
        if (!agents[msg.sender].isActive) revert AgentNotActive();
        _;
    }

    constructor(address _treasury, address owner_) {
        if (_treasury == address(0)) revert ZeroAddress();
        if (owner_ == address(0)) revert ZeroAddress();

        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
    }

    receive() external payable {}

    /**
     * @notice Register a new AI agent
     * @param agentAddress Agent wallet address
     * @param initialBudget Initial budget allocation
     * @param metadata IPFS CID or JSON metadata
     */
    function registerAgent(address agentAddress, uint256 initialBudget, string calldata metadata)
        external
        onlyRole(DAO_ROLE)
    {
        if (agentAddress == address(0)) revert ZeroAddress();
        if (agents[agentAddress].registeredAt != 0) revert AgentAlreadyExists();

        agents[agentAddress] = Agent({
            agentAddress: agentAddress,
            budget: initialBudget,
            spent: 0,
            rewards: 0,
            registeredAt: block.timestamp,
            isActive: true,
            metadata: metadata
        });

        agentList.push(agentAddress);
        agentIndex[agentAddress] = agentList.length;
        totalAgentBudgets += initialBudget;

        _grantRole(AGENT_ROLE, agentAddress);

        emit AgentRegistered(agentAddress, initialBudget, metadata);
    }

    /**
     * @notice Deactivate an agent
     * @param agentAddress Agent address
     */
    function deactivateAgent(address agentAddress) external onlyRole(DAO_ROLE) {
        if (agents[agentAddress].registeredAt == 0) revert AgentNotFound();

        agents[agentAddress].isActive = false;
        _revokeRole(AGENT_ROLE, agentAddress);

        emit AgentDeactivated(agentAddress);
    }

    /**
     * @notice Allocate additional budget to an agent
     * @param agentAddress Agent address
     * @param amount Amount to allocate
     */
    function allocateBudget(address agentAddress, uint256 amount) external onlyRole(DAO_ROLE) {
        if (agents[agentAddress].registeredAt == 0) revert AgentNotFound();
        if (amount == 0) revert ZeroAmount();

        agents[agentAddress].budget += amount;
        totalAgentBudgets += amount;

        emit BudgetAllocated(agentAddress, amount);
    }

    /**
     * @notice Spend from agent budget (called by agent)
     * @param to Recipient address
     * @param amount Amount to spend
     * @param reason Reason for spending
     */
    function spendETH(address to, uint256 amount, string calldata reason)
        external
        onlyActiveAgent
        nonReentrant
        whenNotPaused
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        Agent storage agent = agents[msg.sender];
        uint256 remaining = agent.budget - agent.spent;

        if (amount > remaining) {
            revert InsufficientBudget(remaining, amount);
        }
        if (address(this).balance < amount) {
            revert InsufficientBalance(address(this).balance, amount);
        }

        agent.spent += amount;

        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FundsSpent(msg.sender, to, amount, reason);
    }

    /**
     * @notice Spend tokens from agent budget
     * @param token Token address
     * @param to Recipient address
     * @param amount Amount to spend
     * @param reason Reason for spending
     */
    function spendToken(address token, address to, uint256 amount, string calldata reason)
        external
        onlyActiveAgent
        nonReentrant
        whenNotPaused
    {
        if (token == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) {
            revert InsufficientBalance(balance, amount);
        }

        agents[msg.sender].spent += amount;

        IERC20(token).safeTransfer(to, amount);

        emit FundsSpent(msg.sender, to, amount, reason);
    }

    /**
     * @notice Distribute rewards to an agent
     * @param agentAddress Agent address
     * @param amount Reward amount
     */
    function distributeReward(address agentAddress, uint256 amount) external onlyRole(DAO_ROLE) {
        if (agents[agentAddress].registeredAt == 0) revert AgentNotFound();
        if (amount == 0) revert ZeroAmount();

        agents[agentAddress].rewards += amount;
        totalRewardsDistributed += amount;

        emit RewardDistributed(agentAddress, amount);
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
     * @notice Set the treasury address
     * @param _treasury Treasury address
     */
    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    /**
     * @notice Pause operations
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause operations
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Get agent details
     * @param agentAddress Agent address
     */
    function getAgent(address agentAddress) external view returns (Agent memory) {
        return agents[agentAddress];
    }

    /**
     * @notice Get agent remaining budget
     * @param agentAddress Agent address
     */
    function getAgentRemainingBudget(address agentAddress) external view returns (uint256) {
        Agent storage agent = agents[agentAddress];
        return agent.budget > agent.spent ? agent.budget - agent.spent : 0;
    }

    /**
     * @notice Get all active agents
     */
    function getActiveAgents() external view returns (address[] memory) {
        uint256 listLength = agentList.length;
        uint256 activeCount = 0;
        for (uint256 i = 0; i < listLength; i++) {
            if (agents[agentList[i]].isActive) {
                activeCount++;
            }
        }

        address[] memory activeAgents = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < listLength; i++) {
            if (agents[agentList[i]].isActive) {
                activeAgents[index] = agentList[i];
                index++;
            }
        }

        return activeAgents;
    }

    /**
     * @notice Get total agent count
     */
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    /**
     * @notice Get vault balance
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
     * @notice Contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
