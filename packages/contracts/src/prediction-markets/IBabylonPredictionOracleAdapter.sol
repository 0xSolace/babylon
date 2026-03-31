// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IBabylonPredictionOracleAdapter {
    enum DuelStatus {
        NULL,
        BETTING_OPEN,
        LOCKED,
        RESOLVED,
        CANCELLED
    }

    enum Side {
        NONE,
        A,
        B
    }

    struct DuelState {
        bytes32 duelKey;
        DuelStatus status;
        Side winner;
        bytes32 sessionId;
    }

    function getDuel(bytes32 duelKey) external view returns (DuelState memory);
}
