// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import "./IPredictionOracle.sol";

interface IDstackVerifier {
    function verify(bytes calldata teeQuote, uint256 timestamp, bytes calldata payload) external view returns (bool);
}

/**
 * @title PredictionOracle
 * @notice TEE-backed oracle for prediction game outcomes
 * @dev Stores game results with TEE attestation for trustless verification
 * Implements IPredictionOracle for external contract integration
 */
contract PredictionOracle is IPredictionOracle {
    struct GameOutcome {
        bytes32 sessionId;
        string question;
        bool outcome;              // true = YES, false = NO
        bytes32 commitment;        // Hash committed at game start
        bytes32 salt;              // Salt for commitment
        uint256 startTime;
        uint256 endTime;
        bytes teeQuote;            // TEE attestation quote
        uint256 totalPayout;
        bool finalized;
    }

    mapping(bytes32 => GameOutcome) public games;
    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => address[]) private gameWinners;
    
    // slither-disable-next-line immutable-states
    address public gameServer;
    uint256 public gameCount;
    address public dstackVerifier;

    error InvalidDstackVerifier();

    event GameCommitted(
        bytes32 indexed sessionId,
        string question,
        bytes32 commitment,
        uint256 startTime
    );

    event GameRevealed(
        bytes32 indexed sessionId,
        bool outcome,
        uint256 endTime,
        bytes teeQuote,
        uint256 winnersCount
    );

    modifier onlyGameServer() {
        require(msg.sender == gameServer, "Only game server");
        _;
    }

    constructor(address gameServer_) {
        require(gameServer_ != address(0), "Invalid game server");
        gameServer = gameServer_;
        dstackVerifier = address(0);
    }

    event DstackVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    /// @notice Set the dstack verifier address
    function setDstackVerifier(address verifier) external onlyGameServer {
        if (verifier == address(0)) revert InvalidDstackVerifier();
        address old = dstackVerifier;
        dstackVerifier = verifier;
        emit DstackVerifierUpdated(old, verifier);
    }

    /// @notice Clear the dstack verifier and disable TEE verification
    function clearDstackVerifier() external onlyGameServer {
        address old = dstackVerifier;
        dstackVerifier = address(0);
        emit DstackVerifierUpdated(old, address(0));
    }

    /**
     * @notice Commit to a game outcome at start
     * @param sessionId Unique game session ID
     * @param question The yes/no question
     * @param commitment Hash of (outcome + salt)
     */
    // slither-disable-start timestamp
    function commitGame(
        bytes32 sessionId,
        string calldata question,
        bytes32 commitment
    ) external onlyGameServer {
        require(!commitments[commitment], "Commitment already exists");
        require(games[sessionId].startTime == 0, "Session already exists");

        games[sessionId] = GameOutcome({
            sessionId: sessionId,
            question: question,
            outcome: false,
            commitment: commitment,
            salt: bytes32(0),
            startTime: block.timestamp,
            endTime: 0,
            teeQuote: "",
            totalPayout: 0,
            finalized: false
        });

        commitments[commitment] = true;
        gameCount++;

        emit GameCommitted(sessionId, question, commitment, block.timestamp);
    }
    // slither-disable-end timestamp

    /**
     * @notice Reveal game outcome with TEE proof
     * @param sessionId Game session ID
     * @param outcome The outcome (true=YES, false=NO)
     * @param salt The salt used in commitment
     * @param teeQuote TEE attestation quote
     * @param winners List of winner addresses
     * @param totalPayout Total prize pool distributed
     */
    // slither-disable-start timestamp
    function revealGame(
        bytes32 sessionId,
        bool outcome,
        bytes32 salt,
        bytes memory teeQuote,
        address[] calldata winners,
        uint256 totalPayout
    ) external onlyGameServer {
        GameOutcome storage game = games[sessionId];
        require(game.startTime > 0, "Game not found");
        require(!game.finalized, "Already finalized");

        // Verify commitment
        bytes32 expectedCommitment = keccak256(abi.encode(outcome, salt));
        require(game.commitment == expectedCommitment, "Commitment mismatch");

        uint256 revealTimestamp = block.timestamp;

        game.outcome = outcome;
        game.salt = salt;
        game.endTime = revealTimestamp;
        game.teeQuote = teeQuote;
        gameWinners[sessionId] = winners;
        game.totalPayout = totalPayout;
        game.finalized = true;

        emit GameRevealed(sessionId, outcome, revealTimestamp, teeQuote, winners.length);

        if (dstackVerifier != address(0)) {
            require(
                IDstackVerifier(dstackVerifier).verify(teeQuote, revealTimestamp, abi.encode(sessionId, outcome)),
                "TEE quote verification failed"
            );
        }
    }
    // slither-disable-end timestamp
    
    // ============ IPredictionOracle Implementation ============

    /**
     * @notice Get winners array for a game
     * @param sessionId Game session ID
     * @return List of winner addresses
     */
    function getWinners(bytes32 sessionId) external view virtual override returns (address[] memory) {
        return gameWinners[sessionId];
    }

    /**
     * @notice Get game outcome
     */
    function getOutcome(bytes32 sessionId) external view override returns (bool outcome, bool finalized) {
        GameOutcome storage game = games[sessionId];
        return (game.outcome, game.finalized);
    }

    /**
     * @notice Check if address is a winner
     */
    function isWinner(bytes32 sessionId, address player) external view virtual override returns (bool) {
        GameOutcome storage game = games[sessionId];
        if (!game.finalized) return false;
        
        address[] storage winners = gameWinners[sessionId];
        for (uint i = 0; i < winners.length; i++) {
            if (winners[i] == player) return true;
        }
        return false;
    }

    /**
     * @notice Verify a commitment exists
     */
    function verifyCommitment(bytes32 commitment) external view override returns (bool) {
        return commitments[commitment];
    }
}
