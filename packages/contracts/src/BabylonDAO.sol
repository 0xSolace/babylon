// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BabylonDAO
 * @author Babylon Network
 * @notice Governance contract for Babylon with AI CEO integration
 * @dev Manages proposals, voting, and AI CEO delegation
 *
 * Features:
 * - Proposal creation and voting
 * - AI CEO delegation for autonomous decisions
 * - Treasury and vault integration
 * - Council-based governance
 */
contract BabylonDAO is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant COUNCIL_ROLE = keccak256("COUNCIL_ROLE");
    bytes32 public constant CEO_ROLE = keccak256("CEO_ROLE");

    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Executed
    }

    enum ProposalType {
        General,
        Funding,
        AgentApproval,
        ParameterChange,
        Emergency
    }

    struct Proposal {
        uint256 id;
        address proposer;
        ProposalType proposalType;
        string description;
        string metadataCID;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool canceled;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
    }

    struct GovernanceConfig {
        uint256 votingPeriod;
        uint256 votingDelay;
        uint256 proposalThreshold;
        uint256 quorumBps;
        bool aiCeoEnabled;
    }

    address public immutable treasury;
    address public immutable agentVault;
    address public aiCeo;

    GovernanceConfig public config;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) public votingPower;
    uint256 public proposalCount;

    uint256 public constant BPS_DENOMINATOR = 10000;

    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        ProposalType proposalType,
        string description,
        uint256 startTime,
        uint256 endTime
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCanceled(uint256 indexed id);
    event AICEODecision(uint256 indexed proposalId, bool approved, string rationale);
    event ConfigUpdated();
    event AICEOSet(address indexed aiCeo);

    error InvalidAddress();
    error InvalidProposal();
    error ProposalNotActive();
    error AlreadyVoted();
    error ProposalNotSucceeded();
    error ProposalAlreadyExecuted();
    error InsufficientVotingPower();
    error QuorumNotReached();
    error NotAICEO();
    error AICEODisabled();
    error ExecutionFailed();
    error InvalidTargets();

    constructor(address _treasury, address _agentVault, address _aiCeo) {
        if (_treasury == address(0)) revert InvalidAddress();
        if (_agentVault == address(0)) revert InvalidAddress();

        treasury = _treasury;
        agentVault = _agentVault;
        aiCeo = _aiCeo;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COUNCIL_ROLE, msg.sender);

        if (_aiCeo != address(0)) {
            _grantRole(CEO_ROLE, _aiCeo);
        }

        config = GovernanceConfig({
            votingPeriod: 3 days,
            votingDelay: 1 days,
            proposalThreshold: 0,
            quorumBps: 1000, // 10%
            aiCeoEnabled: true
        });
    }

    /**
     * @notice Create a new proposal
     * @param proposalType Type of proposal
     * @param description Description text
     * @param metadataCID IPFS CID for additional metadata
     * @param targets Target addresses for execution
     * @param values ETH values for each call
     * @param calldatas Calldata for each call
     */
    function createProposal(
        ProposalType proposalType,
        string calldata description,
        string calldata metadataCID,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas
    ) external onlyRole(COUNCIL_ROLE) whenNotPaused returns (uint256) {
        if (targets.length != values.length || targets.length != calldatas.length) {
            revert InvalidTargets();
        }

        uint256 proposalId = ++proposalCount;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            proposalType: proposalType,
            description: description,
            metadataCID: metadataCID,
            forVotes: 0,
            againstVotes: 0,
            startTime: block.timestamp + config.votingDelay,
            endTime: block.timestamp + config.votingDelay + config.votingPeriod,
            executed: false,
            canceled: false,
            targets: targets,
            values: values,
            calldatas: calldatas
        });

        emit ProposalCreated(
            proposalId,
            msg.sender,
            proposalType,
            description,
            block.timestamp + config.votingDelay,
            block.timestamp + config.votingDelay + config.votingPeriod
        );

        return proposalId;
    }

    /**
     * @notice Cast a vote on a proposal
     * @param proposalId Proposal ID
     * @param support True for yes, false for no
     */
    function castVote(uint256 proposalId, bool support) external whenNotPaused {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.id == 0) revert InvalidProposal();
        if (block.timestamp < proposal.startTime || block.timestamp > proposal.endTime) {
            revert ProposalNotActive();
        }
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        uint256 weight = _getVotingPower(msg.sender);
        if (weight == 0) revert InsufficientVotingPower();

        hasVoted[proposalId][msg.sender] = true;
        votingPower[proposalId][msg.sender] = weight;

        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice AI CEO approves or rejects a proposal
     * @param proposalId Proposal ID
     * @param approved Whether to approve
     * @param rationale Explanation of decision
     */
    function aiCeoDecision(uint256 proposalId, bool approved, string calldata rationale)
        external
        onlyRole(CEO_ROLE)
        whenNotPaused
    {
        if (!config.aiCeoEnabled) revert AICEODisabled();

        Proposal storage proposal = proposals[proposalId];
        if (proposal.id == 0) revert InvalidProposal();

        // AI CEO decision adds significant voting weight
        uint256 ceoWeight = 1000 ether; // CEO has significant influence

        if (approved) {
            proposal.forVotes += ceoWeight;
        } else {
            proposal.againstVotes += ceoWeight;
        }

        emit AICEODecision(proposalId, approved, rationale);
    }

    /**
     * @notice Execute a successful proposal
     * @param proposalId Proposal ID
     */
    function executeProposal(uint256 proposalId) external nonReentrant whenNotPaused {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.id == 0) revert InvalidProposal();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (block.timestamp <= proposal.endTime) revert ProposalNotActive();

        ProposalState state = getProposalState(proposalId);
        if (state != ProposalState.Succeeded) revert ProposalNotSucceeded();

        proposal.executed = true;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success,) = proposal.targets[i].call{value: proposal.values[i]}(proposal.calldatas[i]);
            if (!success) revert ExecutionFailed();
        }

        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Cancel a proposal (only proposer or admin)
     * @param proposalId Proposal ID
     */
    function cancelProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.id == 0) revert InvalidProposal();
        if (msg.sender != proposal.proposer && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert InvalidProposal();
        }
        if (proposal.executed || proposal.canceled) revert InvalidProposal();

        proposal.canceled = true;

        emit ProposalCanceled(proposalId);
    }

    /**
     * @notice Get the current state of a proposal
     * @param proposalId Proposal ID
     */
    function getProposalState(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.id == 0) return ProposalState.Pending;
        if (proposal.canceled) return ProposalState.Canceled;
        if (proposal.executed) return ProposalState.Executed;
        if (block.timestamp < proposal.startTime) return ProposalState.Pending;
        if (block.timestamp <= proposal.endTime) return ProposalState.Active;

        // Voting ended
        if (proposal.forVotes <= proposal.againstVotes) {
            return ProposalState.Defeated;
        }

        return ProposalState.Succeeded;
    }

    /**
     * @notice Set AI CEO address
     * @param _aiCeo New AI CEO address
     */
    function setAICEO(address _aiCeo) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (aiCeo != address(0)) {
            _revokeRole(CEO_ROLE, aiCeo);
        }
        aiCeo = _aiCeo;
        if (_aiCeo != address(0)) {
            _grantRole(CEO_ROLE, _aiCeo);
        }
        emit AICEOSet(_aiCeo);
    }

    /**
     * @notice Update governance configuration
     * @param _config New configuration
     */
    function setConfig(GovernanceConfig calldata _config) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config = _config;
        emit ConfigUpdated();
    }

    /**
     * @notice Add a council member
     * @param member Member address
     */
    function addCouncilMember(address member) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (member == address(0)) revert InvalidAddress();
        _grantRole(COUNCIL_ROLE, member);
    }

    /**
     * @notice Remove a council member
     * @param member Member address
     */
    function removeCouncilMember(address member) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(COUNCIL_ROLE, member);
    }

    /**
     * @notice Pause governance
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause governance
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Get proposal details
     * @param proposalId Proposal ID
     */
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    /**
     * @notice Get proposal votes
     * @param proposalId Proposal ID
     */
    function getProposalVotes(uint256 proposalId) external view returns (uint256 forVotes, uint256 againstVotes) {
        return (proposals[proposalId].forVotes, proposals[proposalId].againstVotes);
    }

    /**
     * @notice Check if address has voted
     * @param proposalId Proposal ID
     * @param voter Voter address
     */
    function hasAddressVoted(uint256 proposalId, address voter) external view returns (bool) {
        return hasVoted[proposalId][voter];
    }

    /**
     * @notice Get voting power for an address
     * @param account Account address
     */
    function _getVotingPower(address account) internal view returns (uint256) {
        // Council members have base voting power
        if (hasRole(COUNCIL_ROLE, account)) {
            return 1 ether;
        }
        return 0;
    }

    /**
     * @notice Contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
