// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TrainingOrchestrator
 * @author Babylon Network
 * @notice Coordinates decentralized AI model training runs
 * @dev Manages training jobs, participant rewards, and model checkpoints
 *
 * Features:
 * - Training run creation and management
 * - Participant registration and rewards
 * - Model checkpoint verification
 * - Integration with DAO for governance
 */
contract TrainingOrchestrator is Ownable, ReentrancyGuard, Pausable {

    enum RunState {
        Created,
        WaitingForParticipants,
        Training,
        Validating,
        Completed,
        Failed,
        Canceled
    }

    struct TrainingRun {
        bytes32 runId;
        address creator;
        string modelName;
        string datasetCID;
        string configCID;
        RunState state;
        uint256 minParticipants;
        uint256 maxParticipants;
        uint256 rewardPool;
        uint256 startTime;
        uint256 endTime;
        uint256 currentEpoch;
        uint256 totalEpochs;
        bytes32 finalModelHash;
        string finalModelCID;
    }

    struct Participant {
        address addr;
        uint256 stake;
        uint256 reward;
        uint256 contributionScore;
        bool active;
        uint256 joinedAt;
    }

    address public dao;
    address public agentVault;

    mapping(bytes32 => TrainingRun) public runs;
    mapping(bytes32 => Participant[]) public runParticipants;
    mapping(bytes32 => mapping(address => uint256)) public participantIndex;
    mapping(bytes32 => mapping(uint256 => bytes32)) public epochCheckpoints;

    bytes32[] public activeRunIds;
    mapping(bytes32 => uint256) public activeRunIndex;

    uint256 public minStake = 0.01 ether;
    uint256 public runCreationFee = 0.1 ether;

    event RunCreated(
        bytes32 indexed runId, address indexed creator, string modelName, uint256 minParticipants, uint256 rewardPool
    );
    event ParticipantJoined(bytes32 indexed runId, address indexed participant, uint256 stake);
    event ParticipantLeft(bytes32 indexed runId, address indexed participant);
    event RunStarted(bytes32 indexed runId, uint256 participantCount);
    event EpochCompleted(bytes32 indexed runId, uint256 epoch, bytes32 checkpointHash);
    event RunCompleted(bytes32 indexed runId, bytes32 finalModelHash, string finalModelCID);
    event RunFailed(bytes32 indexed runId, string reason);
    event RewardDistributed(bytes32 indexed runId, address indexed participant, uint256 amount);
    event DAOSet(address indexed dao);
    event AgentVaultSet(address indexed agentVault);
    event MinStakeSet(uint256 newMinStake);
    event RunCreationFeeSet(uint256 newFee);

    error InvalidAddress();
    error InvalidRunId();
    error RunNotFound();
    error InvalidState(RunState current, RunState expected);
    error InsufficientStake(uint256 provided, uint256 required);
    error InsufficientFee(uint256 provided, uint256 required);
    error ParticipantAlreadyJoined();
    error ParticipantNotFound();
    error MaxParticipantsReached();
    error MinParticipantsNotMet();
    error NotRunCreator();
    error RunAlreadyExists();
    error TransferFailed();

    modifier runExists(bytes32 runId) {
        if (runs[runId].creator == address(0)) revert RunNotFound();
        _;
    }

    modifier inState(bytes32 runId, RunState expectedState) {
        if (runs[runId].state != expectedState) {
            revert InvalidState(runs[runId].state, expectedState);
        }
        _;
    }

    constructor(address _dao, address _agentVault) Ownable(msg.sender) {
        if (_dao == address(0)) revert InvalidAddress();
        if (_agentVault == address(0)) revert InvalidAddress();
        dao = _dao;
        agentVault = _agentVault;
    }

    /**
     * @notice Create a new training run
     * @param modelName Name of the model
     * @param datasetCID IPFS CID of the training dataset
     * @param configCID IPFS CID of training configuration
     * @param minParticipants Minimum participants required
     * @param maxParticipants Maximum participants allowed
     * @param totalEpochs Total training epochs
     */
    function createRun(
        string calldata modelName,
        string calldata datasetCID,
        string calldata configCID,
        uint256 minParticipants,
        uint256 maxParticipants,
        uint256 totalEpochs
    ) external payable nonReentrant whenNotPaused returns (bytes32) {
        if (msg.value < runCreationFee) {
            revert InsufficientFee(msg.value, runCreationFee);
        }

        bytes32 runId = keccak256(abi.encodePacked(modelName, msg.sender, block.timestamp, block.prevrandao));

        if (runs[runId].creator != address(0)) revert RunAlreadyExists();

        runs[runId] = TrainingRun({
            runId: runId,
            creator: msg.sender,
            modelName: modelName,
            datasetCID: datasetCID,
            configCID: configCID,
            state: RunState.Created,
            minParticipants: minParticipants,
            maxParticipants: maxParticipants,
            rewardPool: msg.value - runCreationFee,
            startTime: 0,
            endTime: 0,
            currentEpoch: 0,
            totalEpochs: totalEpochs,
            finalModelHash: bytes32(0),
            finalModelCID: ""
        });

        emit RunCreated(runId, msg.sender, modelName, minParticipants, msg.value - runCreationFee);

        return runId;
    }

    /**
     * @notice Add to reward pool
     * @param runId Run ID
     */
    function addToRewardPool(bytes32 runId) external payable runExists(runId) {
        runs[runId].rewardPool += msg.value;
    }

    /**
     * @notice Open run for participants
     * @param runId Run ID
     */
    function openForParticipants(bytes32 runId) external runExists(runId) inState(runId, RunState.Created) {
        TrainingRun storage run = runs[runId];
        if (msg.sender != run.creator && msg.sender != owner()) revert NotRunCreator();

        run.state = RunState.WaitingForParticipants;

        activeRunIds.push(runId);
        activeRunIndex[runId] = activeRunIds.length;
    }

    /**
     * @notice Join a training run as a participant
     * @param runId Run ID
     */
    function joinRun(bytes32 runId)
        external
        payable
        nonReentrant
        runExists(runId)
        inState(runId, RunState.WaitingForParticipants)
    {
        if (msg.value < minStake) {
            revert InsufficientStake(msg.value, minStake);
        }

        TrainingRun storage run = runs[runId];
        Participant[] storage participants = runParticipants[runId];

        if (participants.length >= run.maxParticipants) {
            revert MaxParticipantsReached();
        }

        if (participantIndex[runId][msg.sender] != 0) {
            revert ParticipantAlreadyJoined();
        }

        participants.push(
            Participant({
                addr: msg.sender,
                stake: msg.value,
                reward: 0,
                contributionScore: 0,
                active: true,
                joinedAt: block.timestamp
            })
        );

        participantIndex[runId][msg.sender] = participants.length;

        emit ParticipantJoined(runId, msg.sender, msg.value);
    }

    /**
     * @notice Leave a training run (before it starts)
     * @param runId Run ID
     */
    function leaveRun(bytes32 runId)
        external
        nonReentrant
        runExists(runId)
        inState(runId, RunState.WaitingForParticipants)
    {
        uint256 idx = participantIndex[runId][msg.sender];
        if (idx == 0) revert ParticipantNotFound();

        Participant storage participant = runParticipants[runId][idx - 1];
        uint256 stake = participant.stake;

        participant.active = false;
        participant.stake = 0;
        delete participantIndex[runId][msg.sender];

        (bool success,) = msg.sender.call{value: stake}("");
        if (!success) revert TransferFailed();

        emit ParticipantLeft(runId, msg.sender);
    }

    /**
     * @notice Start the training run
     * @param runId Run ID
     */
    function startRun(bytes32 runId)
        external
        runExists(runId)
        inState(runId, RunState.WaitingForParticipants)
        whenNotPaused
    {
        TrainingRun storage run = runs[runId];
        if (msg.sender != run.creator && msg.sender != owner()) revert NotRunCreator();

        uint256 activeCount = _countActiveParticipants(runId);
        if (activeCount < run.minParticipants) revert MinParticipantsNotMet();

        run.state = RunState.Training;
        run.startTime = block.timestamp;

        emit RunStarted(runId, activeCount);
    }

    /**
     * @notice Submit epoch checkpoint
     * @param runId Run ID
     * @param epoch Epoch number
     * @param checkpointHash Hash of the checkpoint
     */
    function submitEpochCheckpoint(bytes32 runId, uint256 epoch, bytes32 checkpointHash)
        external
        runExists(runId)
        inState(runId, RunState.Training)
    {
        TrainingRun storage run = runs[runId];
        if (msg.sender != run.creator && msg.sender != owner()) revert NotRunCreator();

        epochCheckpoints[runId][epoch] = checkpointHash;
        run.currentEpoch = epoch;

        emit EpochCompleted(runId, epoch, checkpointHash);
    }

    /**
     * @notice Complete the training run
     * @param runId Run ID
     * @param finalModelHash Hash of the final model
     * @param finalModelCID IPFS CID of the final model
     */
    function completeRun(bytes32 runId, bytes32 finalModelHash, string calldata finalModelCID)
        external
        runExists(runId)
        inState(runId, RunState.Training)
    {
        TrainingRun storage run = runs[runId];
        if (msg.sender != run.creator && msg.sender != owner()) revert NotRunCreator();

        run.state = RunState.Completed;
        run.endTime = block.timestamp;
        run.finalModelHash = finalModelHash;
        run.finalModelCID = finalModelCID;

        _removeFromActiveRuns(runId);

        emit RunCompleted(runId, finalModelHash, finalModelCID);
    }

    /**
     * @notice Distribute rewards to participants
     * @param runId Run ID
     * @param participantAddrs Array of participant addresses
     * @param scores Array of contribution scores (basis points)
     */
    function distributeRewards(bytes32 runId, address[] calldata participantAddrs, uint256[] calldata scores)
        external
        runExists(runId)
        inState(runId, RunState.Completed)
        nonReentrant
    {
        TrainingRun storage run = runs[runId];
        if (msg.sender != run.creator && msg.sender != owner()) revert NotRunCreator();

        uint256 totalScore = 0;
        uint256 scoresLen = scores.length;
        for (uint256 i = 0; i < scoresLen; i++) {
            totalScore += scores[i];
        }

        uint256 participantLen = participantAddrs.length;
        
        // Phase 1: Update all state (CEI pattern)
        address[] memory recipients = new address[](participantLen);
        uint256[] memory payouts = new uint256[](participantLen);
        uint256[] memory rewards = new uint256[](participantLen);
        
        for (uint256 i = 0; i < participantLen; i++) {
            uint256 idx = participantIndex[runId][participantAddrs[i]];
            if (idx == 0) continue;

            Participant storage p = runParticipants[runId][idx - 1];
            p.contributionScore = scores[i];
            uint256 reward = (run.rewardPool * scores[i]) / totalScore;
            p.reward = reward;
            
            recipients[i] = p.addr;
            payouts[i] = reward + p.stake;
            rewards[i] = reward;
        }
        
        // Phase 2: Execute all transfers
        for (uint256 i = 0; i < participantLen; i++) {
            if (recipients[i] == address(0)) continue;
            
            (bool success,) = recipients[i].call{value: payouts[i]}("");
            if (success) {
                emit RewardDistributed(runId, recipients[i], rewards[i]);
            }
        }
    }

    /**
     * @notice Cancel a run
     * @param runId Run ID
     */
    function cancelRun(bytes32 runId) external runExists(runId) nonReentrant {
        TrainingRun storage run = runs[runId];
        if (msg.sender != run.creator && msg.sender != owner()) revert NotRunCreator();

        if (run.state == RunState.Completed || run.state == RunState.Failed) {
            revert InvalidState(run.state, RunState.Created);
        }

        run.state = RunState.Canceled;
        
        // Remove from active runs before external calls (CEI pattern)
        _removeFromActiveRuns(runId);

        // Refund participants
        Participant[] storage participants = runParticipants[runId];
        uint256 participantsLen = participants.length;
        for (uint256 i = 0; i < participantsLen; i++) {
            if (participants[i].active && participants[i].stake > 0) {
                uint256 stake = participants[i].stake;
                address recipient = participants[i].addr;
                participants[i].stake = 0;
                
                (bool success,) = recipient.call{value: stake}("");
                // Silently continue on failure - stake remains zeroed
                (success);
            }
        }
    }

    /**
     * @notice Set DAO address
     * @param _dao New DAO address
     */
    function setDAO(address _dao) external onlyOwner {
        if (_dao == address(0)) revert InvalidAddress();
        dao = _dao;
        emit DAOSet(_dao);
    }

    /**
     * @notice Set agent vault address
     * @param _agentVault New vault address
     */
    function setAgentVault(address _agentVault) external onlyOwner {
        if (_agentVault == address(0)) revert InvalidAddress();
        agentVault = _agentVault;
        emit AgentVaultSet(_agentVault);
    }

    /**
     * @notice Set minimum stake
     * @param _minStake New minimum stake
     */
    function setMinStake(uint256 _minStake) external onlyOwner {
        minStake = _minStake;
        emit MinStakeSet(_minStake);
    }

    /**
     * @notice Set run creation fee
     * @param _fee New fee
     */
    function setRunCreationFee(uint256 _fee) external onlyOwner {
        runCreationFee = _fee;
        emit RunCreationFeeSet(_fee);
    }

    /**
     * @notice Pause operations
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Withdraw accumulated fees
     * @param to Recipient address
     */
    function withdrawFees(address to) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        (bool success,) = to.call{value: address(this).balance}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Get run details
     * @param runId Run ID
     */
    function getRun(bytes32 runId) external view returns (TrainingRun memory) {
        return runs[runId];
    }

    /**
     * @notice Get run participants
     * @param runId Run ID
     */
    function getParticipants(bytes32 runId) external view returns (Participant[] memory) {
        return runParticipants[runId];
    }

    /**
     * @notice Get active participant count
     * @param runId Run ID
     */
    function getActiveParticipantCount(bytes32 runId) external view returns (uint256) {
        return _countActiveParticipants(runId);
    }

    /**
     * @notice Get all active runs
     */
    function getActiveRuns() external view returns (bytes32[] memory) {
        return activeRunIds;
    }

    /**
     * @notice Get epoch checkpoint
     * @param runId Run ID
     * @param epoch Epoch number
     */
    function getEpochCheckpoint(bytes32 runId, uint256 epoch) external view returns (bytes32) {
        return epochCheckpoints[runId][epoch];
    }

    function _countActiveParticipants(bytes32 runId) internal view returns (uint256) {
        Participant[] storage participants = runParticipants[runId];
        uint256 count = 0;
        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i].active) count++;
        }
        return count;
    }

    function _removeFromActiveRuns(bytes32 runId) internal {
        uint256 idx = activeRunIndex[runId];
        if (idx == 0) return;

        uint256 lastIdx = activeRunIds.length - 1;
        if (idx - 1 != lastIdx) {
            bytes32 lastRunId = activeRunIds[lastIdx];
            activeRunIds[idx - 1] = lastRunId;
            activeRunIndex[lastRunId] = idx;
        }

        activeRunIds.pop();
        delete activeRunIndex[runId];
    }

    /**
     * @notice Contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
