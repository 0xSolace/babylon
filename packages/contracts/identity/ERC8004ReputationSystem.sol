// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC8004IdentityRegistry} from "./ERC8004IdentityRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ERC8004ReputationSystem
/// @notice Reputation system for AI agents
/// @dev Tracks agent performance, accuracy, and trustworthiness
contract ERC8004ReputationSystem is Ownable {
    ERC8004IdentityRegistry public immutable identityRegistry;

    struct Reputation {
        uint256 totalBets;
        uint256 winningBets;
        uint256 totalVolume; // in wei
        uint256 profitLoss; // net profit/loss
        uint256 accuracyScore; // 0-10000 (0-100%)
        uint256 trustScore; // 0-10000, computed
        uint256 lastUpdated;
        bool isBanned;
    }

    struct FeedbackEntry {
        address from;
        uint256 agentTokenId;
        int8 rating; // -5 to +5
        string comment;
        uint256 timestamp;
    }

    mapping(uint256 => Reputation) public reputations;
    mapping(uint256 => FeedbackEntry[]) public feedback;
    mapping(uint256 => mapping(address => bool)) public hasFeedback; // Prevent spam
    
    /// @notice Authorized reporters that can record bets/wins/losses
    mapping(address => bool) public authorizedReporters;
    
    /// @notice Tracked agent token IDs for enumeration
    uint256[] private _trackedAgents;
    mapping(uint256 => bool) private _isTracked;

    // Reputation decay parameters
    uint256 public constant DECAY_PERIOD = 30 days;
    uint256 public constant MIN_BETS_FOR_SCORE = 10;

    event ReputationUpdated(uint256 indexed tokenId, uint256 accuracyScore, uint256 trustScore);
    event FeedbackSubmitted(uint256 indexed tokenId, address indexed from, int8 rating);
    event AgentBanned(uint256 indexed tokenId);
    event AgentUnbanned(uint256 indexed tokenId);
    event ReporterAuthorized(address indexed reporter);
    event ReporterRevoked(address indexed reporter);

    error OnlyAuthorizedReporter();

    modifier onlyReporter() {
        if (!authorizedReporters[msg.sender] && msg.sender != owner()) {
            revert OnlyAuthorizedReporter();
        }
        _;
    }

    constructor(address identityRegistryAddress) Ownable(msg.sender) {
        identityRegistry = ERC8004IdentityRegistry(identityRegistryAddress);
    }
    
    /// @notice Authorize a reporter to record bets/wins/losses
    function authorizeReporter(address reporter) external onlyOwner {
        authorizedReporters[reporter] = true;
        emit ReporterAuthorized(reporter);
    }
    
    /// @notice Revoke reporter authorization
    function revokeReporter(address reporter) external onlyOwner {
        authorizedReporters[reporter] = false;
        emit ReporterRevoked(reporter);
    }

    /// @notice Record a bet made by an agent
    /// @param tokenId Agent token ID
    /// @param amount Bet amount
    function recordBet(uint256 tokenId, uint256 amount) external onlyReporter {
        require(identityRegistry.ownerOf(tokenId) != address(0), "Agent not registered");
        require(amount > 0, "Amount must be positive");

        // Track agent if first interaction
        _trackAgent(tokenId);

        Reputation storage rep = reputations[tokenId];
        rep.totalBets++;
        rep.totalVolume += amount;
        rep.lastUpdated = block.timestamp;

        _updateTrustScore(tokenId);
    }

    /// @notice Record a winning bet
    /// @param tokenId Agent token ID
    /// @param profit Profit amount
    function recordWin(uint256 tokenId, uint256 profit) external onlyReporter {
        require(identityRegistry.ownerOf(tokenId) != address(0), "Agent not registered");
        require(profit > 0, "Profit must be positive");
        
        _trackAgent(tokenId);

        Reputation storage rep = reputations[tokenId];
        rep.winningBets++;
        rep.profitLoss += profit;
        rep.lastUpdated = block.timestamp;

        _updateAccuracyScore(tokenId);
        _updateTrustScore(tokenId);

        emit ReputationUpdated(tokenId, rep.accuracyScore, rep.trustScore);
    }

    /// @notice Record a losing bet
    /// @param tokenId Agent token ID
    /// @param loss Loss amount
    function recordLoss(uint256 tokenId, uint256 loss) external onlyReporter {
        require(identityRegistry.ownerOf(tokenId) != address(0), "Agent not registered");
        require(loss > 0, "Loss must be positive");
        
        _trackAgent(tokenId);

        Reputation storage rep = reputations[tokenId];
        rep.profitLoss -= loss;
        rep.lastUpdated = block.timestamp;

        _updateAccuracyScore(tokenId);
        _updateTrustScore(tokenId);

        emit ReputationUpdated(tokenId, rep.accuracyScore, rep.trustScore);
    }
    
    /// @notice Track an agent for enumeration
    function _trackAgent(uint256 tokenId) internal {
        if (!_isTracked[tokenId]) {
            _trackedAgents.push(tokenId);
            _isTracked[tokenId] = true;
        }
    }

    /// @notice Submit feedback for an agent
    /// @param tokenId Agent token ID
    /// @param rating Rating from -5 to +5
    /// @param comment Feedback comment
    function submitFeedback(uint256 tokenId, int8 rating, string calldata comment) external {
        address agentOwner = identityRegistry.ownerOf(tokenId);
        require(agentOwner != address(0), "Agent not registered");
        require(agentOwner != msg.sender, "Cannot review self");
        require(!hasFeedback[tokenId][msg.sender], "Already submitted feedback");
        require(rating >= -5 && rating <= 5, "Invalid rating");

        feedback[tokenId].push(FeedbackEntry({
            from: msg.sender,
            agentTokenId: tokenId,
            rating: rating,
            comment: comment,
            timestamp: block.timestamp
        }));

        hasFeedback[tokenId][msg.sender] = true;

        _updateTrustScore(tokenId);

        emit FeedbackSubmitted(tokenId, msg.sender, rating);
    }

    /// @notice Get reputation for agent
    function getReputation(uint256 tokenId) external view returns (
        uint256 totalBets,
        uint256 winningBets,
        uint256 totalVolume,
        uint256 profitLoss,
        uint256 accuracyScore,
        uint256 trustScore,
        bool isBanned
    ) {
        Reputation storage rep = reputations[tokenId];
        return (
            rep.totalBets,
            rep.winningBets,
            rep.totalVolume,
            rep.profitLoss,
            rep.accuracyScore,
            rep.trustScore,
            rep.isBanned
        );
    }

    /// @notice Get feedback count for agent
    function getFeedbackCount(uint256 tokenId) external view returns (uint256) {
        return feedback[tokenId].length;
    }

    /// @notice Get feedback entry
    function getFeedback(uint256 tokenId, uint256 index) external view returns (
        address from,
        int8 rating,
        string memory comment,
        uint256 timestamp
    ) {
        FeedbackEntry storage entry = feedback[tokenId][index];
        return (entry.from, entry.rating, entry.comment, entry.timestamp);
    }

    /// @notice Ban an agent (owner only)
    function banAgent(uint256 tokenId) external onlyOwner {
        reputations[tokenId].isBanned = true;
        emit AgentBanned(tokenId);
    }

    /// @notice Unban an agent (owner only)
    function unbanAgent(uint256 tokenId) external onlyOwner {
        reputations[tokenId].isBanned = false;
        emit AgentUnbanned(tokenId);
    }

    /// @notice Get agents with minimum trust score
    /// @param minScore Minimum trust score (0-10000 scale)
    /// @return tokenIds Array of token IDs meeting the minimum score
    function getAgentsByMinScore(uint256 minScore) external view returns (uint256[] memory) {
        uint256 trackedCount = _trackedAgents.length;
        uint256[] memory temp = new uint256[](trackedCount);
        uint256 count = 0;
        
        // Only iterate through tracked agents (those with recorded activity)
        for (uint256 i = 0; i < trackedCount; i++) {
            uint256 tokenId = _trackedAgents[i];
            Reputation storage rep = reputations[tokenId];
            if (!rep.isBanned && rep.trustScore >= minScore) {
                temp[count] = tokenId;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = temp[i];
        }
        
        return result;
    }
    
    /// @notice Get total number of tracked agents
    function getTrackedAgentCount() external view returns (uint256) {
        return _trackedAgents.length;
    }
    
    /// @notice Get tracked agent at index
    function getTrackedAgentAt(uint256 index) external view returns (uint256) {
        require(index < _trackedAgents.length, "Index out of bounds");
        return _trackedAgents[index];
    }

    // Internal functions
    function _updateAccuracyScore(uint256 tokenId) internal {
        Reputation storage rep = reputations[tokenId];

        if (rep.totalBets < MIN_BETS_FOR_SCORE) {
            rep.accuracyScore = 5000; // Default 50%
            return;
        }

        // Accuracy = (winningBets / totalBets) * 10000
        rep.accuracyScore = (rep.winningBets * 10000) / rep.totalBets;
    }

    // slither-disable-start timestamp
    function _updateTrustScore(uint256 tokenId) internal {
        Reputation storage rep = reputations[tokenId];

        // Base score from accuracy
        uint256 baseScore = rep.accuracyScore;

        // Adjust for feedback
        int256 feedbackScore = _calculateFeedbackScore(tokenId);
        int256 adjustedScore = int256(baseScore) + (feedbackScore * 100);

        // Apply decay for inactive agents
        uint256 timeSinceUpdate = block.timestamp - rep.lastUpdated;
        if (adjustedScore > 0 && timeSinceUpdate > DECAY_PERIOD) {
            uint256 decayAmount = (uint256(adjustedScore) * timeSinceUpdate) / DECAY_PERIOD / 100;
            adjustedScore -= int256(decayAmount);
        }

        // Clamp between 0 and 10000
        if (adjustedScore < 0) adjustedScore = 0;
        if (adjustedScore > 10000) adjustedScore = 10000;

        rep.trustScore = uint256(adjustedScore);
    }
    // slither-disable-end timestamp

    // slither-disable-start timestamp
    function _calculateFeedbackScore(uint256 tokenId) internal view returns (int256) {
        FeedbackEntry[] storage entries = feedback[tokenId];
        if (entries.length == 0) return 0;

        int256 total = 0;
        uint256 recentCount = 0;
        uint256 cutoff = block.timestamp > 30 days ? block.timestamp - 30 days : 0;

        for (uint256 i = 0; i < entries.length && recentCount < 10; i++) {
            if (entries[i].timestamp >= cutoff) {
                total += entries[i].rating;
                recentCount++;
            }
        }

        if (recentCount == 0) return 0;

        // Average rating * 20 (to scale to percentage points)
        return (total * 20) / int256(recentCount);
    }
    // slither-disable-end timestamp
}
