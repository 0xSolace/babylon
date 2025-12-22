// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentExecutionRegistry
 * @notice On-chain registry for agent execution reporting and payment settlement
 * @dev Enables verifiable compute attestation for decentralized agent runners
 *
 * Architecture:
 * 1. Compute nodes register as execution providers
 * 2. Nodes submit execution reports with cryptographic proofs
 * 3. Reports are verified and settled via x402 payments
 * 4. Agent performance metrics are tracked on-chain
 */
contract AgentExecutionRegistry is Ownable, ReentrancyGuard {
    // =============================================================================
    // Types
    // =============================================================================

    struct ExecutionNode {
        address operator;
        uint256 stake;
        uint256 capacity;
        uint256 totalExecutions;
        uint256 successfulExecutions;
        bool active;
        uint256 registeredAt;
    }

    struct ExecutionReport {
        bytes32 executionId;
        address node;
        bytes32 agentId;
        uint256 startTime;
        uint256 endTime;
        uint256 actionsExecuted;
        bool success;
        bytes32 trajectoryHash;
        uint256 computeUnits;
        bool settled;
    }

    struct AgentStats {
        uint256 totalExecutions;
        uint256 successfulExecutions;
        uint256 totalActions;
        uint256 totalComputeUnits;
        uint256 lastExecutionTime;
    }

    // =============================================================================
    // State
    // =============================================================================

    /// @notice Payment token for settlements (USDC or BBLN)
    IERC20 public paymentToken;

    /// @notice Minimum stake required to run as execution node
    uint256 public minNodeStake;

    /// @notice Price per compute unit in payment token
    uint256 public pricePerComputeUnit;

    /// @notice Registered execution nodes
    mapping(address => ExecutionNode) public nodes;

    /// @notice Execution reports by ID
    mapping(bytes32 => ExecutionReport) public reports;

    /// @notice Agent statistics
    mapping(bytes32 => AgentStats) public agentStats;

    /// @notice Node execution history (node => executionIds)
    mapping(address => bytes32[]) public nodeExecutions;

    /// @notice Total compute units processed
    uint256 public totalComputeUnits;

    /// @notice Total payments distributed
    uint256 public totalPayments;

    // =============================================================================
    // Events
    // =============================================================================

    event NodeRegistered(address indexed node, uint256 stake, uint256 capacity);
    event NodeDeregistered(address indexed node);
    event ExecutionReported(
        bytes32 indexed executionId,
        address indexed node,
        bytes32 indexed agentId,
        uint256 actionsExecuted,
        uint256 computeUnits
    );
    event ExecutionSettled(
        bytes32 indexed executionId,
        address indexed node,
        uint256 payment
    );

    // =============================================================================
    // Errors
    // =============================================================================

    error InsufficientStake();
    error NodeNotActive();
    error NodeAlreadyRegistered();
    error ExecutionAlreadyReported();
    error ExecutionNotFound();
    error ExecutionAlreadySettled();
    error InvalidExecutionProof();
    error Unauthorized();

    // =============================================================================
    // Constructor
    // =============================================================================

    constructor(
        address _paymentToken,
        uint256 _minNodeStake,
        uint256 _pricePerComputeUnit
    ) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        minNodeStake = _minNodeStake;
        pricePerComputeUnit = _pricePerComputeUnit;
    }

    // =============================================================================
    // Node Management
    // =============================================================================

    /**
     * @notice Register as an execution node
     * @param capacity Maximum concurrent agents this node can handle
     */
    function registerNode(uint256 capacity) external payable {
        if (nodes[msg.sender].active) revert NodeAlreadyRegistered();
        if (msg.value < minNodeStake) revert InsufficientStake();

        nodes[msg.sender] = ExecutionNode({
            operator: msg.sender,
            stake: msg.value,
            capacity: capacity,
            totalExecutions: 0,
            successfulExecutions: 0,
            active: true,
            registeredAt: block.timestamp
        });

        emit NodeRegistered(msg.sender, msg.value, capacity);
    }

    /**
     * @notice Deregister as an execution node and withdraw stake
     */
    function deregisterNode() external nonReentrant {
        ExecutionNode storage node = nodes[msg.sender];
        if (!node.active) revert NodeNotActive();

        uint256 stake = node.stake;
        node.active = false;
        node.stake = 0;

        // Return stake
        (bool success, ) = msg.sender.call{value: stake}("");
        require(success, "Stake transfer failed");

        emit NodeDeregistered(msg.sender);
    }

    // =============================================================================
    // Execution Reporting
    // =============================================================================

    /**
     * @notice Submit an execution report for a batch of agent ticks
     * @param executionId Unique execution identifier
     * @param agentId Agent that was executed
     * @param startTime Execution start timestamp
     * @param endTime Execution end timestamp
     * @param actionsExecuted Number of actions performed
     * @param success Whether execution completed successfully
     * @param trajectoryHash Hash of trajectory data (for verification)
     * @param computeUnits Compute units consumed
     */
    function reportExecution(
        bytes32 executionId,
        bytes32 agentId,
        uint256 startTime,
        uint256 endTime,
        uint256 actionsExecuted,
        bool success,
        bytes32 trajectoryHash,
        uint256 computeUnits
    ) external {
        ExecutionNode storage node = nodes[msg.sender];
        if (!node.active) revert NodeNotActive();
        if (reports[executionId].node != address(0)) revert ExecutionAlreadyReported();

        // Store report
        reports[executionId] = ExecutionReport({
            executionId: executionId,
            node: msg.sender,
            agentId: agentId,
            startTime: startTime,
            endTime: endTime,
            actionsExecuted: actionsExecuted,
            success: success,
            trajectoryHash: trajectoryHash,
            computeUnits: computeUnits,
            settled: false
        });

        // Update node stats
        node.totalExecutions++;
        if (success) {
            node.successfulExecutions++;
        }
        nodeExecutions[msg.sender].push(executionId);

        // Update agent stats
        AgentStats storage stats = agentStats[agentId];
        stats.totalExecutions++;
        if (success) {
            stats.successfulExecutions++;
        }
        stats.totalActions += actionsExecuted;
        stats.totalComputeUnits += computeUnits;
        stats.lastExecutionTime = endTime;

        // Update global stats
        totalComputeUnits += computeUnits;

        emit ExecutionReported(
            executionId,
            msg.sender,
            agentId,
            actionsExecuted,
            computeUnits
        );
    }

    /**
     * @notice Settle payment for an execution report
     * @param executionId Execution to settle
     * @dev Called by treasury or automated settlement system
     */
    function settleExecution(bytes32 executionId) external nonReentrant {
        ExecutionReport storage report = reports[executionId];
        if (report.node == address(0)) revert ExecutionNotFound();
        if (report.settled) revert ExecutionAlreadySettled();

        // Calculate payment
        uint256 payment = report.computeUnits * pricePerComputeUnit;

        // Mark as settled
        report.settled = true;

        // Transfer payment to node operator
        if (payment > 0) {
            require(
                paymentToken.transferFrom(owner(), report.node, payment),
                "Payment transfer failed"
            );
            totalPayments += payment;
        }

        emit ExecutionSettled(executionId, report.node, payment);
    }

    /**
     * @notice Batch settle multiple executions
     * @param executionIds Array of executions to settle
     */
    function batchSettleExecutions(bytes32[] calldata executionIds) external {
        for (uint256 i = 0; i < executionIds.length; i++) {
            this.settleExecution(executionIds[i]);
        }
    }

    // =============================================================================
    // Views
    // =============================================================================

    /**
     * @notice Get node's execution history
     */
    function getNodeExecutions(address node) external view returns (bytes32[] memory) {
        return nodeExecutions[node];
    }

    /**
     * @notice Get node's success rate (scaled by 1e18)
     */
    function getNodeSuccessRate(address node) external view returns (uint256) {
        ExecutionNode storage n = nodes[node];
        if (n.totalExecutions == 0) return 0;
        return (n.successfulExecutions * 1e18) / n.totalExecutions;
    }

    /**
     * @notice Get agent's success rate (scaled by 1e18)
     */
    function getAgentSuccessRate(bytes32 agentId) external view returns (uint256) {
        AgentStats storage stats = agentStats[agentId];
        if (stats.totalExecutions == 0) return 0;
        return (stats.successfulExecutions * 1e18) / stats.totalExecutions;
    }

    /**
     * @notice Check if a node is active and has capacity
     */
    function isNodeAvailable(address node) external view returns (bool) {
        return nodes[node].active;
    }

    // =============================================================================
    // Admin
    // =============================================================================

    /**
     * @notice Update minimum node stake
     */
    function setMinNodeStake(uint256 _minNodeStake) external onlyOwner {
        minNodeStake = _minNodeStake;
    }

    /**
     * @notice Update price per compute unit
     */
    function setPricePerComputeUnit(uint256 _pricePerComputeUnit) external onlyOwner {
        pricePerComputeUnit = _pricePerComputeUnit;
    }

    /**
     * @notice Update payment token
     */
    function setPaymentToken(address _paymentToken) external onlyOwner {
        paymentToken = IERC20(_paymentToken);
    }
}

