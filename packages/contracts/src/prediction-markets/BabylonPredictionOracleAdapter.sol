// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IBabylonPredictionOracleAdapter} from "./IBabylonPredictionOracleAdapter.sol";

interface IBabylonOutcomeOracle {
    function getOutcome(bytes32 sessionId) external view returns (bool outcome, bool finalized);
}

contract BabylonPredictionOracleAdapter is Ownable, IBabylonPredictionOracleAdapter {
    error InvalidOracle();
    error InvalidMarketKey();
    error InvalidSessionId();

    event MarketSessionLinked(bytes32 indexed marketKey, bytes32 indexed sessionId);
    event MarketCancelled(bytes32 indexed marketKey, bool cancelled);

    IBabylonOutcomeOracle public immutable babylonOracle;

    mapping(bytes32 => bytes32) public sessionIdByMarketKey;
    mapping(bytes32 => bool) public marketCancelled;

    constructor(address babylonOracle_, address owner_) Ownable(owner_) {
        if (babylonOracle_ == address(0)) revert InvalidOracle();
        babylonOracle = IBabylonOutcomeOracle(babylonOracle_);
    }

    function linkMarket(bytes32 marketKey, bytes32 sessionId) external onlyOwner {
        if (marketKey == bytes32(0)) revert InvalidMarketKey();
        if (sessionId == bytes32(0)) revert InvalidSessionId();

        sessionIdByMarketKey[marketKey] = sessionId;
        marketCancelled[marketKey] = false;

        emit MarketSessionLinked(marketKey, sessionId);
    }

    function setMarketCancelled(bytes32 marketKey, bool cancelled) external onlyOwner {
        if (marketKey == bytes32(0)) revert InvalidMarketKey();

        marketCancelled[marketKey] = cancelled;
        emit MarketCancelled(marketKey, cancelled);
    }

    function getDuel(bytes32 duelKey) external view returns (DuelState memory) {
        bytes32 sessionId = sessionIdByMarketKey[duelKey];

        if (marketCancelled[duelKey]) {
            return DuelState({
                duelKey: duelKey,
                status: DuelStatus.CANCELLED,
                winner: Side.NONE,
                sessionId: sessionId
            });
        }

        if (sessionId == bytes32(0)) {
            return DuelState({
                duelKey: duelKey,
                status: DuelStatus.BETTING_OPEN,
                winner: Side.NONE,
                sessionId: bytes32(0)
            });
        }

        (bool outcome, bool finalized) = babylonOracle.getOutcome(sessionId);
        if (!finalized) {
            return DuelState({
                duelKey: duelKey,
                status: DuelStatus.LOCKED,
                winner: Side.NONE,
                sessionId: sessionId
            });
        }

        return DuelState({
            duelKey: duelKey,
            status: DuelStatus.RESOLVED,
            winner: outcome ? Side.A : Side.B,
            sessionId: sessionId
        });
    }
}
