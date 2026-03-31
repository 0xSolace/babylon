// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title LibMarket
/// @notice Storage library for prediction markets
/// @dev Uses diamond storage pattern for upgradeability
library LibMarket {
    bytes32 constant MARKET_STORAGE_POSITION = keccak256("babylon.market.storage");

    struct Market {
        bytes32 id;
        string question;
        uint8 numOutcomes;
        mapping(uint8 => uint256) shares; // outcome => total shares
        mapping(uint8 => string) outcomeNames;
        uint256 liquidity; // LMSR b parameter
        uint256 createdAt;
        uint256 resolveAt;
        bool resolved;
        uint8 winningOutcome;
        address oracle;
        uint256 totalVolume;
        uint256 feeRate; // basis points (e.g., 100 = 1%)
    }

    struct Position {
        mapping(uint8 => uint256) shares; // outcome => shares owned
        uint256 totalInvested;
        bool claimed; // Prevent double-claiming winnings
    }

    struct MarketStorage {
        mapping(bytes32 => Market) markets;
        mapping(address => mapping(bytes32 => Position)) positions;
        mapping(address => uint256) balances;
        bytes32[] marketIds;
        uint256 defaultLiquidity; // Default b parameter for LMSR
        uint256 defaultFeeRate;
        address feeRecipient;
        address chainlinkOracle; // Chainlink oracle contract address
        address mockOracle; // Mock oracle contract address (for testing)
    }

    // slither-disable-start assembly
    function marketStorage() internal pure returns (MarketStorage storage ms) {
        bytes32 position = MARKET_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }
    // slither-disable-end assembly

    function getMarket(bytes32 marketId) internal view returns (Market storage) {
        return marketStorage().markets[marketId];
    }

    function getPosition(address user, bytes32 marketId) internal view returns (Position storage) {
        return marketStorage().positions[user][marketId];
    }

    function getBalance(address user) internal view returns (uint256) {
        return marketStorage().balances[user];
    }

    function setBalance(address user, uint256 amount) internal {
        marketStorage().balances[user] = amount;
    }

    function addBalance(address user, uint256 amount) internal {
        marketStorage().balances[user] += amount;
    }

    function subtractBalance(address user, uint256 amount) internal {
        require(marketStorage().balances[user] >= amount, "Insufficient balance");
        marketStorage().balances[user] -= amount;
    }
}
