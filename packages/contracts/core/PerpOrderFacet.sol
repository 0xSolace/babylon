// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {LibPerpEngine} from "../libraries/LibPerpEngine.sol";
import {PerpFacetBase} from "./PerpFacetBase.sol";

contract PerpOrderFacet is PerpFacetBase {
    function placePerpMarketOrder(
        bytes32 marketId,
        LibPerpEngine.Side side,
        bool reduceOnly,
        uint256 sizeDelta,
        uint256 collateralDelta,
        uint256 acceptablePrice,
        uint64 expiry
    ) external nonReentrant returns (bytes32 orderId) {
        LibPerpEngine.enforceInitialized();
        return LibPerpEngine.placeMarketOrder(
            msg.sender,
            marketId,
            side,
            reduceOnly,
            sizeDelta,
            collateralDelta,
            acceptablePrice,
            expiry
        );
    }

    function placePerpTriggerOrder(
        bytes32 marketId,
        LibPerpEngine.Side side,
        bool reduceOnly,
        uint256 sizeDelta,
        uint256 collateralDelta,
        uint256 triggerPrice,
        uint256 acceptablePrice,
        bool triggerAbove,
        uint64 expiry
    ) external nonReentrant returns (bytes32 orderId) {
        LibPerpEngine.enforceInitialized();
        return LibPerpEngine.placeTriggerOrder(
            msg.sender,
            marketId,
            side,
            reduceOnly,
            sizeDelta,
            collateralDelta,
            triggerPrice,
            acceptablePrice,
            triggerAbove,
            expiry
        );
    }

    function cancelPerpOrder(bytes32 orderId) external nonReentrant {
        LibPerpEngine.enforceInitialized();
        LibPerpEngine.cancelOrder(msg.sender, orderId);
    }
}
