// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {LibPerpEngine} from "../libraries/LibPerpEngine.sol";
import {PerpFacetBase} from "./PerpFacetBase.sol";

contract PerpSettlementFacet is PerpFacetBase {
    function publishPerpOracleVersions(
        bytes32[] calldata marketIds,
        uint256[] calldata prices,
        uint64 timestamp
    ) external onlyUpdater nonReentrant {
        LibPerpEngine.publishOracleVersions(marketIds, prices, timestamp);
    }

    function executePerpOrder(bytes32 orderId) external nonReentrant {
        LibPerpEngine.enforceInitialized();
        LibPerpEngine.executeOrder(orderId);
    }

    function liquidatePerpPosition(address account, bytes32 marketId) external nonReentrant {
        LibPerpEngine.enforceInitialized();
        LibPerpEngine.liquidate(msg.sender, account, marketId);
    }
}
