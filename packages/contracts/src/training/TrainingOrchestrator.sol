// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TrainingOrchestrator
 * @author Babylon Labs
 * @notice Coordinates decentralized RL training pipeline
 * @dev Manages the full training lifecycle:
 *      1. Data collection (encrypted trajectories)
 *      2. Data preparation (TEE CPU)
 *      3. LLM judging (TEE GPU)
 *      4. Training (TEE GPU)
 *      5. Model deployment
 *
 * Training runs are triggered:
 *      - Weekly (minimum interval)
 *      - When trajectory count exceeds threshold
 *      - Manual trigger by AI CEO
 *
 * Only ONE training run at a time.
 *
 * @custom:security-contact security@babylon.game
 */
contract TrainingOrchestrator is Ownable, ReentrancyGuard, Pausable {
    // ═══════════════════════════════════════════════════════════════════════════
    //                              TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    enum TrainingStatus {
        PENDING,
        DATA_PREP,
        JUDGING,
        TRAINING,
        BENCHMARKING,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    struct TrainingJob {
        bytes32 jobId;
        string archetype;           // Agent archetype being trained
        bytes32 datasetCid;         // Encrypted dataset on IPFS
        uint256 trajectoryCount;    // Number of trajectories
        bytes32 baseModelCid;       // Base model weights CID
        bytes32 configHash;         // Training config hash
        
        // TEE Workers
        address dataPrepWorker;     // TEE CPU worker
        address judgeWorker;        // TEE GPU judge worker
        address trainingWorker;     // TEE GPU training worker
        
        // Attestations
        bytes32 dataPrepAttestation;
        bytes32 judgeAttestation;
        bytes32 trainingAttestation;
        
        // Results
        bytes32 preparedDataCid;    // Prepared dataset CID
        bytes32 scoredDataCid;      // Judged/scored data CID
        bytes32 outputModelCid;     // Resulting model CID
        uint256 benchmarkScore;     // Benchmark result (basis points)
        uint256 previousBenchmark;  // Previous model's benchmark
        
        // Metadata
        address submitter;
        uint256 createdAt;
        uint256 startedAt;
        uint256 completedAt;
        TrainingStatus status;
        string failureReason;
        
        // Cost tracking
        uint256 estimatedCost;
        uint256 actualCost;
    }

    struct TrainingConfig {
        uint256 minIntervalSeconds;     // Minimum time between training runs
        uint256 trajectoryThreshold;    // Trigger training when exceeded
        uint256 maxTrajectories;        // Max trajectories per run
        uint256 minBenchmarkImprovement; // Min improvement required (basis points)
        uint256 maxJobDuration;         // Max time for a job
        uint256 benchmarkSamples;       // Number of simulation samples
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice BabylonDAO
    address public dao;

    /// @notice AI CEO
    address public aiCEO;

    /// @notice Agent vault for costs
    address public agentVault;

    /// @notice Model registry
    address public modelRegistry;

    /// @notice Storage service endpoint
    string public storageEndpoint;

    /// @notice Training configuration
    TrainingConfig public config;

    /// @notice Current active job (only one at a time)
    bytes32 public activeJob;

    /// @notice All training jobs
    mapping(bytes32 => TrainingJob) public jobs;
    bytes32[] public allJobIds;

    /// @notice Jobs by archetype
    mapping(string => bytes32[]) public archetypeJobs;

    /// @notice Last training timestamp by archetype
    mapping(string => uint256) public lastTrainingTime;

    /// @notice Current trajectory count by archetype
    mapping(string => uint256) public pendingTrajectories;

    /// @notice Authorized TEE workers
    mapping(address => bool) public authorizedWorkers;

    /// @notice Total jobs
    uint256 public totalJobs;

    /// @notice Total completed jobs
    uint256 public completedJobs;

    /// @notice Total training cost
    uint256 public totalTrainingCost;

    // ═══════════════════════════════════════════════════════════════════════════
    //                              EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event TrainingJobCreated(
        bytes32 indexed jobId,
        string archetype,
        uint256 trajectoryCount,
        address indexed submitter
    );
    event TrainingJobStarted(bytes32 indexed jobId, TrainingStatus phase);
    event TrainingPhaseCompleted(
        bytes32 indexed jobId,
        TrainingStatus phase,
        bytes32 outputCid,
        bytes32 attestation
    );
    event TrainingJobCompleted(
        bytes32 indexed jobId,
        bytes32 outputModelCid,
        uint256 benchmarkScore,
        uint256 improvement
    );
    event TrainingJobFailed(bytes32 indexed jobId, string reason);
    event TrainingJobCancelled(bytes32 indexed jobId, string reason);
    event WorkerAuthorized(address indexed worker, bool authorized);
    event TrajectoriesRecorded(string archetype, uint256 count, uint256 total);
    event ConfigUpdated();

    // ═══════════════════════════════════════════════════════════════════════════
    //                              ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error NotAuthorized();
    error NotWorker();
    error JobAlreadyActive();
    error NoActiveJob();
    error JobNotFound();
    error InvalidPhase(TrainingStatus expected, TrainingStatus actual);
    error TrainingTooSoon(uint256 nextAllowed, uint256 current);
    error InsufficientTrajectories(uint256 available, uint256 required);
    error BenchmarkNotImproved(uint256 previous, uint256 current, uint256 minImprovement);
    error JobExpired();
    error InvalidAttestation();
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════
    //                              MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyAuthorized() {
        if (msg.sender != dao && msg.sender != aiCEO && msg.sender != owner()) {
            revert NotAuthorized();
        }
        _;
    }

    modifier onlyWorker() {
        if (!authorizedWorkers[msg.sender]) {
            revert NotWorker();
        }
        _;
    }

    modifier hasActiveJob() {
        if (activeJob == bytes32(0)) revert NoActiveJob();
        _;
    }

    modifier noActiveJob() {
        if (activeJob != bytes32(0)) revert JobAlreadyActive();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(
        address _dao,
        address _aiCEO,
        address _agentVault,
        address _modelRegistry,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_dao == address(0)) revert ZeroAddress();
        
        dao = _dao;
        aiCEO = _aiCEO;
        agentVault = _agentVault;
        modelRegistry = _modelRegistry;

        // Default config
        config = TrainingConfig({
            minIntervalSeconds: 7 days,      // Weekly minimum
            trajectoryThreshold: 10000,      // 10k trajectories trigger
            maxTrajectories: 50000,          // Max 50k per run
            minBenchmarkImprovement: 100,    // 1% improvement required
            maxJobDuration: 24 hours,        // Max 24h per job
            benchmarkSamples: 1000           // 1000 simulation samples
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                          TRAJECTORY RECORDING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Record new trajectories for an archetype
     * @dev Called by game engine after trajectory storage
     */
    function recordTrajectories(
        string calldata archetype,
        uint256 count,
        bytes32 batchCid
    ) external onlyAuthorized {
        pendingTrajectories[archetype] += count;
        
        emit TrajectoriesRecorded(archetype, count, pendingTrajectories[archetype]);

        // Check if training should be triggered
        if (_shouldTriggerTraining(archetype)) {
            // AI CEO can decide to auto-trigger or manual
        }
    }

    /**
     * @notice Check if training should be triggered
     */
    function _shouldTriggerTraining(string memory archetype) internal view returns (bool) {
        if (activeJob != bytes32(0)) return false;
        
        uint256 trajectories = pendingTrajectories[archetype];
        uint256 lastTime = lastTrainingTime[archetype];
        
        // Has enough trajectories?
        if (trajectories < config.trajectoryThreshold) return false;
        
        // Minimum interval passed?
        if (block.timestamp < lastTime + config.minIntervalSeconds) return false;
        
        return true;
    }

    /**
     * @notice Check if training can be started for archetype
     */
    function canStartTraining(string calldata archetype) external view returns (
        bool canStart,
        string memory reason
    ) {
        if (activeJob != bytes32(0)) {
            return (false, "Another job is active");
        }
        
        uint256 trajectories = pendingTrajectories[archetype];
        if (trajectories < config.trajectoryThreshold) {
            return (false, "Insufficient trajectories");
        }
        
        uint256 lastTime = lastTrainingTime[archetype];
        if (block.timestamp < lastTime + config.minIntervalSeconds) {
            return (false, "Minimum interval not passed");
        }
        
        return (true, "Ready");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                          JOB MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new training job
     */
    function createJob(
        string calldata archetype,
        bytes32 datasetCid,
        uint256 trajectoryCount,
        bytes32 baseModelCid,
        bytes32 configHash,
        uint256 estimatedCost
    ) external onlyAuthorized noActiveJob whenNotPaused returns (bytes32) {
        // Check minimum interval
        uint256 lastTime = lastTrainingTime[archetype];
        if (block.timestamp < lastTime + config.minIntervalSeconds) {
            revert TrainingTooSoon(lastTime + config.minIntervalSeconds, block.timestamp);
        }

        bytes32 jobId = keccak256(
            abi.encodePacked(archetype, datasetCid, block.timestamp, msg.sender)
        );

        TrainingJob storage job = jobs[jobId];
        job.jobId = jobId;
        job.archetype = archetype;
        job.datasetCid = datasetCid;
        job.trajectoryCount = trajectoryCount;
        job.baseModelCid = baseModelCid;
        job.configHash = configHash;
        job.submitter = msg.sender;
        job.createdAt = block.timestamp;
        job.status = TrainingStatus.PENDING;
        job.estimatedCost = estimatedCost;

        // Get previous benchmark for comparison
        job.previousBenchmark = _getCurrentBenchmark(archetype);

        activeJob = jobId;
        allJobIds.push(jobId);
        archetypeJobs[archetype].push(jobId);
        totalJobs++;

        emit TrainingJobCreated(jobId, archetype, trajectoryCount, msg.sender);

        return jobId;
    }

    /**
     * @notice Start data preparation phase
     */
    function startDataPrep(
        bytes32 jobId,
        address worker
    ) external onlyAuthorized hasActiveJob {
        TrainingJob storage job = jobs[jobId];
        if (job.status != TrainingStatus.PENDING) {
            revert InvalidPhase(TrainingStatus.PENDING, job.status);
        }
        if (!authorizedWorkers[worker]) revert NotWorker();

        job.dataPrepWorker = worker;
        job.status = TrainingStatus.DATA_PREP;
        job.startedAt = block.timestamp;

        emit TrainingJobStarted(jobId, TrainingStatus.DATA_PREP);
    }

    /**
     * @notice Complete data preparation phase
     */
    function completeDataPrep(
        bytes32 jobId,
        bytes32 preparedDataCid,
        bytes32 attestation
    ) external onlyWorker hasActiveJob {
        TrainingJob storage job = jobs[jobId];
        if (job.status != TrainingStatus.DATA_PREP) {
            revert InvalidPhase(TrainingStatus.DATA_PREP, job.status);
        }
        if (msg.sender != job.dataPrepWorker) revert NotWorker();

        job.preparedDataCid = preparedDataCid;
        job.dataPrepAttestation = attestation;
        job.status = TrainingStatus.JUDGING;

        emit TrainingPhaseCompleted(jobId, TrainingStatus.DATA_PREP, preparedDataCid, attestation);
    }

    /**
     * @notice Start LLM judging phase
     */
    function startJudging(
        bytes32 jobId,
        address worker
    ) external onlyAuthorized hasActiveJob {
        TrainingJob storage job = jobs[jobId];
        if (job.status != TrainingStatus.JUDGING) {
            revert InvalidPhase(TrainingStatus.JUDGING, job.status);
        }
        if (!authorizedWorkers[worker]) revert NotWorker();

        job.judgeWorker = worker;

        emit TrainingJobStarted(jobId, TrainingStatus.JUDGING);
    }

    /**
     * @notice Complete LLM judging phase
     */
    function completeJudging(
        bytes32 jobId,
        bytes32 scoredDataCid,
        bytes32 attestation
    ) external onlyWorker hasActiveJob {
        TrainingJob storage job = jobs[jobId];
        if (job.status != TrainingStatus.JUDGING) {
            revert InvalidPhase(TrainingStatus.JUDGING, job.status);
        }
        if (msg.sender != job.judgeWorker) revert NotWorker();

        job.scoredDataCid = scoredDataCid;
        job.judgeAttestation = attestation;
        job.status = TrainingStatus.TRAINING;

        emit TrainingPhaseCompleted(jobId, TrainingStatus.JUDGING, scoredDataCid, attestation);
    }

    /**
     * @notice Start training phase
     */
    function startTraining(
        bytes32 jobId,
        address worker
    ) external onlyAuthorized hasActiveJob {
        TrainingJob storage job = jobs[jobId];
        if (job.status != TrainingStatus.TRAINING) {
            revert InvalidPhase(TrainingStatus.TRAINING, job.status);
        }
        if (!authorizedWorkers[worker]) revert NotWorker();

        job.trainingWorker = worker;

        emit TrainingJobStarted(jobId, TrainingStatus.TRAINING);
    }

    /**
     * @notice Complete training phase
     */
    function completeTraining(
        bytes32 jobId,
        bytes32 outputModelCid,
        bytes32 attestation
    ) external onlyWorker hasActiveJob {
        TrainingJob storage job = jobs[jobId];
        if (job.status != TrainingStatus.TRAINING) {
            revert InvalidPhase(TrainingStatus.TRAINING, job.status);
        }
        if (msg.sender != job.trainingWorker) revert NotWorker();

        job.outputModelCid = outputModelCid;
        job.trainingAttestation = attestation;
        job.status = TrainingStatus.BENCHMARKING;

        emit TrainingPhaseCompleted(jobId, TrainingStatus.TRAINING, outputModelCid, attestation);
    }

    /**
     * @notice Submit benchmark results and complete job
     */
    function completeBenchmark(
        bytes32 jobId,
        uint256 benchmarkScore
    ) external onlyAuthorized hasActiveJob {
        TrainingJob storage job = jobs[jobId];
        if (job.status != TrainingStatus.BENCHMARKING) {
            revert InvalidPhase(TrainingStatus.BENCHMARKING, job.status);
        }

        job.benchmarkScore = benchmarkScore;

        // Check if benchmark improved
        uint256 improvementBps;
        if (job.previousBenchmark > 0) {
            improvementBps = benchmarkScore > job.previousBenchmark 
                ? ((benchmarkScore - job.previousBenchmark) * 10000) / job.previousBenchmark
                : 0;
            
            if (improvementBps < config.minBenchmarkImprovement) {
                _failJob(jobId, "Benchmark did not improve enough");
                return;
            }
        } else {
            improvementBps = 10000; // 100% improvement for first model
        }

        // Complete job
        job.status = TrainingStatus.COMPLETED;
        job.completedAt = block.timestamp;

        // Update state
        lastTrainingTime[job.archetype] = block.timestamp;
        pendingTrajectories[job.archetype] = 0;
        activeJob = bytes32(0);
        completedJobs++;
        totalTrainingCost += job.actualCost;

        // Register model (external call)
        _registerModel(job);

        emit TrainingJobCompleted(jobId, job.outputModelCid, benchmarkScore, improvementBps);
    }

    /**
     * @notice Cancel a job
     */
    function cancelJob(bytes32 jobId, string calldata reason) external onlyAuthorized {
        TrainingJob storage job = jobs[jobId];
        if (job.createdAt == 0) revert JobNotFound();

        job.status = TrainingStatus.CANCELLED;
        job.failureReason = reason;

        if (activeJob == jobId) {
            activeJob = bytes32(0);
        }

        emit TrainingJobCancelled(jobId, reason);
    }

    function _failJob(bytes32 jobId, string memory reason) internal {
        TrainingJob storage job = jobs[jobId];
        job.status = TrainingStatus.FAILED;
        job.failureReason = reason;
        job.completedAt = block.timestamp;

        if (activeJob == jobId) {
            activeJob = bytes32(0);
        }

        emit TrainingJobFailed(jobId, reason);
    }

    function _getCurrentBenchmark(string memory archetype) internal view returns (uint256) {
        // Query model registry for current benchmark
        if (modelRegistry == address(0)) return 0;
        
        (bool success, bytes memory data) = modelRegistry.staticcall(
            abi.encodeWithSignature("getArchetypeInfo(string)", archetype)
        );
        
        if (!success || data.length == 0) return 0;
        
        // Decode and return latest benchmark (simplified)
        return 0; // Would decode actual benchmark
    }

    function _registerModel(TrainingJob storage job) internal {
        if (modelRegistry == address(0)) return;

        // Call model registry to register new model
        (bool success,) = modelRegistry.call(
            abi.encodeWithSignature(
                "registerModel(string,string,bytes32,string,bytes32,bytes32,uint256)",
                job.archetype,
                "Qwen/Qwen2.5-7B-Instruct",  // Base model
                job.outputModelCid,
                "",  // HF repo (empty for now)
                job.trainingAttestation,
                job.datasetCid,
                job.benchmarkScore
            )
        );
        // Continue even if registration fails - model is still valid
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              ADMIN
    // ═══════════════════════════════════════════════════════════════════════════

    function setConfig(TrainingConfig calldata _config) external onlyAuthorized {
        config = _config;
        emit ConfigUpdated();
    }

    function setWorkerAuthorized(address worker, bool authorized) external onlyAuthorized {
        authorizedWorkers[worker] = authorized;
        emit WorkerAuthorized(worker, authorized);
    }

    function setDAO(address _dao) external onlyOwner {
        if (_dao == address(0)) revert ZeroAddress();
        dao = _dao;
    }

    function setAICEO(address _aiCEO) external onlyOwner {
        aiCEO = _aiCEO;
    }

    function setAgentVault(address _vault) external onlyOwner {
        agentVault = _vault;
    }

    function setModelRegistry(address _registry) external onlyOwner {
        modelRegistry = _registry;
    }

    function setStorageEndpoint(string calldata _endpoint) external onlyAuthorized {
        storageEndpoint = _endpoint;
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

    function getJob(bytes32 jobId) external view returns (TrainingJob memory) {
        return jobs[jobId];
    }

    function getActiveJob() external view returns (TrainingJob memory) {
        if (activeJob == bytes32(0)) {
            return jobs[bytes32(0)];
        }
        return jobs[activeJob];
    }

    function getArchetypeJobs(string calldata archetype) external view returns (bytes32[] memory) {
        return archetypeJobs[archetype];
    }

    function getConfig() external view returns (TrainingConfig memory) {
        return config;
    }

    function getStats() external view returns (
        uint256 _totalJobs,
        uint256 _completedJobs,
        uint256 _totalCost,
        bool _hasActiveJob
    ) {
        return (totalJobs, completedJobs, totalTrainingCost, activeJob != bytes32(0));
    }

    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}

