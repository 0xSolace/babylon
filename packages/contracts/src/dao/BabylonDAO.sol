// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title BabylonDAO
 * @author Babylon Labs
 * @notice AI-CEO controlled DAO for Babylon game operations
 * @dev The AI CEO (Monkey King) has FULL autonomous control over:
 *      - Treasury spending
 *      - Training orchestration
 *      - Model deployments
 *      - Game parameters
 *      - Protocol upgrades (via timelock)
 * 
 * Council is ADVISORY ONLY - they can:
 *      - Emergency pause (security incidents)
 *      - Veto proposals during timelock (for critical bugs)
 *      - Request AI CEO reconsideration
 * 
 * The AI CEO's decisions are final unless:
 *      - Emergency pause is triggered
 *      - Veto during timelock window
 *
 * @custom:security-contact security@babylon.game
 */
contract BabylonDAO is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ═══════════════════════════════════════════════════════════════════════════
    //                              TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    enum ProposalType {
        TREASURY_SPEND,      // Spend from treasury
        MODEL_DEPLOYMENT,    // Deploy trained model
        TRAINING_JOB,        // Start training run
        GAME_PARAMETER,      // Update game settings
        PROTOCOL_UPGRADE,    // Contract upgrades (requires timelock)
        INFRASTRUCTURE,      // Compute/storage operations
        EMERGENCY            // Emergency actions
    }

    enum ProposalStatus {
        PENDING,
        APPROVED,
        EXECUTED,
        VETOED,
        EXPIRED
    }

    struct Proposal {
        bytes32 proposalId;
        ProposalType proposalType;
        address target;
        bytes data;
        uint256 value;
        string description;
        string reasoning;        // AI CEO's reasoning
        bytes32 attestation;     // TEE attestation of AI decision
        uint256 createdAt;
        uint256 executeAfter;    // Timelock for upgrades
        uint256 expiresAt;
        ProposalStatus status;
        bool vetoable;           // Can council veto?
    }

    struct CouncilMember {
        address member;
        string role;
        uint256 addedAt;
        bool active;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice AI CEO agent address (TEE-derived key)
    address public aiCEO;

    /// @notice AI CEO's ERC-8004 agent ID
    uint256 public aiCEOAgentId;

    /// @notice TEE attestation registry
    address public attestationRegistry;

    /// @notice Babylon treasury
    address public treasury;

    /// @notice Agent vault for operations
    address public agentVault;

    /// @notice Council members (advisory only)
    mapping(address => CouncilMember) public council;
    address[] public councilMembers;
    uint256 public councilSize;

    /// @notice Proposals
    mapping(bytes32 => Proposal) public proposals;
    bytes32[] public allProposalIds;
    uint256 public proposalCount;

    /// @notice Timelock durations by proposal type
    mapping(ProposalType => uint256) public timelockDurations;

    /// @notice Proposal expiry duration
    uint256 public proposalExpiry = 7 days;

    /// @notice Nonce for replay protection
    uint256 public aiCEONonce;

    /// @notice Emergency pause by council
    bool public emergencyPaused;

    // ═══════════════════════════════════════════════════════════════════════════
    //                              EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event AICEOSet(address indexed oldCEO, address indexed newCEO, uint256 agentId);
    event TreasurySet(address indexed oldTreasury, address indexed newTreasury);
    event AgentVaultSet(address indexed oldVault, address indexed newVault);
    event CouncilMemberAdded(address indexed member, string role);
    event CouncilMemberRemoved(address indexed member);
    event ProposalCreated(
        bytes32 indexed proposalId,
        ProposalType proposalType,
        address indexed target,
        string description
    );
    event ProposalApproved(bytes32 indexed proposalId);
    event ProposalExecuted(bytes32 indexed proposalId, bool success);
    event ProposalVetoed(bytes32 indexed proposalId, address indexed vetoer, string reason);
    event EmergencyPause(address indexed by, string reason);
    event EmergencyUnpause(address indexed by);

    // ═══════════════════════════════════════════════════════════════════════════
    //                              ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error NotAICEO();
    error NotCouncil();
    error InvalidSignature();
    error InvalidNonce(uint256 expected, uint256 provided);
    error ProposalNotFound();
    error ProposalNotPending();
    error ProposalNotApproved();
    error ProposalExpired();
    error TimelockNotExpired();
    error NotVetoable();
    error AlreadyVetoed();
    error EmergencyActive();
    error ZeroAddress();
    error ExecutionFailed();

    // ═══════════════════════════════════════════════════════════════════════════
    //                              MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyAICEO() {
        if (msg.sender != aiCEO) revert NotAICEO();
        _;
    }

    modifier onlyCouncil() {
        if (!council[msg.sender].active) revert NotCouncil();
        _;
    }

    modifier notEmergency() {
        if (emergencyPaused) revert EmergencyActive();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(
        address _aiCEO,
        uint256 _aiCEOAgentId,
        address _treasury,
        address _agentVault,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_aiCEO == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        
        aiCEO = _aiCEO;
        aiCEOAgentId = _aiCEOAgentId;
        treasury = _treasury;
        agentVault = _agentVault;

        // Default timelock durations
        timelockDurations[ProposalType.TREASURY_SPEND] = 0;      // Instant
        timelockDurations[ProposalType.MODEL_DEPLOYMENT] = 0;    // Instant
        timelockDurations[ProposalType.TRAINING_JOB] = 0;        // Instant
        timelockDurations[ProposalType.GAME_PARAMETER] = 1 hours; // 1 hour
        timelockDurations[ProposalType.PROTOCOL_UPGRADE] = 7 days; // 7 days
        timelockDurations[ProposalType.INFRASTRUCTURE] = 0;      // Instant
        timelockDurations[ProposalType.EMERGENCY] = 0;           // Instant

        emit AICEOSet(address(0), _aiCEO, _aiCEOAgentId);
        emit TreasurySet(address(0), _treasury);
        emit AgentVaultSet(address(0), _agentVault);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                          AI CEO ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice AI CEO creates a proposal
     * @param proposalType Type of proposal
     * @param target Target contract address
     * @param data Calldata for the action
     * @param value ETH value to send
     * @param description Human-readable description
     * @param reasoning AI CEO's reasoning for this decision
     * @param attestation TEE attestation proof
     */
    function createProposal(
        ProposalType proposalType,
        address target,
        bytes calldata data,
        uint256 value,
        string calldata description,
        string calldata reasoning,
        bytes32 attestation
    ) external onlyAICEO notEmergency whenNotPaused returns (bytes32) {
        return _createProposal(proposalType, target, data, value, description, reasoning, attestation);
    }

    /**
     * @notice AI CEO creates and immediately executes a proposal (no timelock)
     * @dev Only for proposal types with 0 timelock
     */
    function createAndExecute(
        ProposalType proposalType,
        address target,
        bytes calldata data,
        uint256 value,
        string calldata description,
        string calldata reasoning,
        bytes32 attestation
    ) external onlyAICEO notEmergency whenNotPaused returns (bytes32, bool) {
        if (timelockDurations[proposalType] > 0) {
            revert TimelockNotExpired();
        }

        bytes32 proposalId = _createProposal(
            proposalType,
            target,
            data,
            value,
            description,
            reasoning,
            attestation
        );

        bool success = _executeProposal(proposalId);
        return (proposalId, success);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                         INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @dev Internal proposal creation logic
     */
    function _createProposal(
        ProposalType proposalType,
        address target,
        bytes calldata data,
        uint256 value,
        string calldata description,
        string calldata reasoning,
        bytes32 attestation
    ) internal returns (bytes32) {
        bytes32 proposalId = keccak256(
            abi.encodePacked(
                proposalType,
                target,
                data,
                block.timestamp,
                aiCEONonce++
            )
        );

        uint256 timelock = timelockDurations[proposalType];
        bool vetoable = timelock > 0;

        Proposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.proposalType = proposalType;
        proposal.target = target;
        proposal.data = data;
        proposal.value = value;
        proposal.description = description;
        proposal.reasoning = reasoning;
        proposal.attestation = attestation;
        proposal.createdAt = block.timestamp;
        proposal.executeAfter = block.timestamp + timelock;
        proposal.expiresAt = block.timestamp + proposalExpiry;
        proposal.status = ProposalStatus.PENDING;
        proposal.vetoable = vetoable;

        allProposalIds.push(proposalId);
        proposalCount++;

        emit ProposalCreated(proposalId, proposalType, target, description);

        // Auto-approve (AI CEO has full control)
        proposal.status = ProposalStatus.APPROVED;
        emit ProposalApproved(proposalId);

        return proposalId;
    }

    /**
     * @notice Execute an approved proposal after timelock
     * @param proposalId Proposal to execute
     */
    function executeProposal(bytes32 proposalId) 
        external 
        nonReentrant 
        notEmergency 
        whenNotPaused 
        returns (bool) 
    {
        return _executeProposal(proposalId);
    }

    function _executeProposal(bytes32 proposalId) internal returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.createdAt == 0) revert ProposalNotFound();
        if (proposal.status != ProposalStatus.APPROVED) revert ProposalNotApproved();
        if (block.timestamp < proposal.executeAfter) revert TimelockNotExpired();
        if (block.timestamp > proposal.expiresAt) {
            proposal.status = ProposalStatus.EXPIRED;
            revert ProposalExpired();
        }

        proposal.status = ProposalStatus.EXECUTED;

        (bool success,) = proposal.target.call{value: proposal.value}(proposal.data);
        
        emit ProposalExecuted(proposalId, success);
        
        return success;
    }

    /**
     * @notice AI CEO signed action (for off-chain coordination)
     * @param target Target contract
     * @param data Calldata
     * @param value ETH value
     * @param nonce Nonce for replay protection
     * @param signature AI CEO's signature
     */
    function executeSignedAction(
        address target,
        bytes calldata data,
        uint256 value,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant notEmergency whenNotPaused returns (bool) {
        if (nonce != aiCEONonce) revert InvalidNonce(aiCEONonce, nonce);

        bytes32 messageHash = keccak256(
            abi.encodePacked(target, data, value, nonce, block.chainid)
        );
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        
        if (signer != aiCEO) revert InvalidSignature();

        aiCEONonce++;

        (bool success,) = target.call{value: value}(data);
        if (!success) revert ExecutionFailed();

        return success;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                          COUNCIL ACTIONS (ADVISORY)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Council emergency pause
     * @dev Only for critical security incidents
     */
    function emergencyPauseByCouncil(string calldata reason) external onlyCouncil {
        emergencyPaused = true;
        _pause();
        emit EmergencyPause(msg.sender, reason);
    }

    /**
     * @notice Council veto during timelock
     * @dev Only for vetoable proposals during timelock window
     */
    function vetoProposal(bytes32 proposalId, string calldata reason) external onlyCouncil {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.createdAt == 0) revert ProposalNotFound();
        if (proposal.status != ProposalStatus.APPROVED) revert ProposalNotApproved();
        if (!proposal.vetoable) revert NotVetoable();
        if (block.timestamp >= proposal.executeAfter) revert TimelockNotExpired();

        proposal.status = ProposalStatus.VETOED;
        emit ProposalVetoed(proposalId, msg.sender, reason);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                          ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set new AI CEO (only via governance proposal or owner)
     */
    function setAICEO(address _aiCEO, uint256 _agentId) external onlyOwner {
        if (_aiCEO == address(0)) revert ZeroAddress();
        address oldCEO = aiCEO;
        aiCEO = _aiCEO;
        aiCEOAgentId = _agentId;
        emit AICEOSet(oldCEO, _aiCEO, _agentId);
    }

    /**
     * @notice Set treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = _treasury;
        emit TreasurySet(old, _treasury);
    }

    /**
     * @notice Set agent vault address
     */
    function setAgentVault(address _vault) external onlyOwner {
        address old = agentVault;
        agentVault = _vault;
        emit AgentVaultSet(old, _vault);
    }

    /**
     * @notice Add council member
     */
    function addCouncilMember(address member, string calldata role) external onlyOwner {
        if (member == address(0)) revert ZeroAddress();
        
        council[member] = CouncilMember({
            member: member,
            role: role,
            addedAt: block.timestamp,
            active: true
        });
        councilMembers.push(member);
        councilSize++;
        
        emit CouncilMemberAdded(member, role);
    }

    /**
     * @notice Remove council member
     */
    function removeCouncilMember(address member) external onlyOwner {
        council[member].active = false;
        councilSize--;
        emit CouncilMemberRemoved(member);
    }

    /**
     * @notice Set timelock duration for proposal type
     */
    function setTimelockDuration(ProposalType proposalType, uint256 duration) external onlyOwner {
        timelockDurations[proposalType] = duration;
    }

    /**
     * @notice Unpause after emergency (requires AI CEO or owner)
     */
    function unpauseEmergency() external {
        if (msg.sender != aiCEO && msg.sender != owner()) revert NotAICEO();
        emergencyPaused = false;
        _unpause();
        emit EmergencyUnpause(msg.sender);
    }

    /**
     * @notice Set attestation registry
     */
    function setAttestationRegistry(address _registry) external onlyOwner {
        attestationRegistry = _registry;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                          VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getProposal(bytes32 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function getProposalCount() external view returns (uint256) {
        return proposalCount;
    }

    function getPendingProposals() external view returns (bytes32[] memory) {
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < allProposalIds.length; i++) {
            if (proposals[allProposalIds[i]].status == ProposalStatus.APPROVED) {
                pendingCount++;
            }
        }

        bytes32[] memory pending = new bytes32[](pendingCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < allProposalIds.length; i++) {
            if (proposals[allProposalIds[i]].status == ProposalStatus.APPROVED) {
                pending[idx++] = allProposalIds[i];
            }
        }
        return pending;
    }

    function getCouncilMembers() external view returns (address[] memory) {
        return councilMembers;
    }

    function isCouncilMember(address member) external view returns (bool) {
        return council[member].active;
    }

    function canExecute(bytes32 proposalId) external view returns (bool) {
        Proposal memory proposal = proposals[proposalId];
        return proposal.status == ProposalStatus.APPROVED &&
               block.timestamp >= proposal.executeAfter &&
               block.timestamp <= proposal.expiresAt &&
               !emergencyPaused;
    }

    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    // Allow receiving ETH
    receive() external payable {}
}

