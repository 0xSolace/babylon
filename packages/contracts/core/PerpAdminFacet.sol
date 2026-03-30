// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {LibPerpEngine} from "../libraries/LibPerpEngine.sol";
import {PerpFacetBase} from "./PerpFacetBase.sol";

contract PerpAdminFacet is PerpFacetBase {
    function initializePerpEngine(
        address collateralToken,
        address oracleUpdater,
        address feeRecipient,
        uint16 protocolFeeShareBps,
        uint32 maxOracleDelay
    ) external onlyOwner {
        LibPerpEngine.initialize(
            collateralToken,
            oracleUpdater,
            feeRecipient,
            protocolFeeShareBps,
            maxOracleDelay
        );
    }

    function createPerpMarket(
        string calldata symbol,
        uint256 maxOpenInterest,
        uint256 maxSkew,
        uint256 skewScale,
        uint256 minTradeSize,
        uint16 initialMarginBps,
        uint16 maintenanceMarginBps,
        uint16 liquidationFeeBps,
        uint16 openFeeBps,
        uint16 closeFeeBps,
        uint16 maxFundingVelocityBps,
        uint16 maxPriceImpactBps,
        uint16 minLiquidityBps
    ) external onlyOwner returns (bytes32 marketId) {
        LibPerpEngine.enforceInitialized();
        return LibPerpEngine.createMarket(
            symbol,
            maxOpenInterest,
            maxSkew,
            skewScale,
            minTradeSize,
            initialMarginBps,
            maintenanceMarginBps,
            liquidationFeeBps,
            openFeeBps,
            closeFeeBps,
            maxFundingVelocityBps,
            maxPriceImpactBps,
            minLiquidityBps
        );
    }

    function setPerpMarketStatus(bytes32 marketId, bool active) external onlyOwner {
        LibPerpEngine.enforceInitialized();
        LibPerpEngine.setMarketStatus(marketId, active);
    }

    function setPerpOracleUpdater(address oracleUpdater) external onlyOwner {
        LibPerpEngine.setOracleUpdater(oracleUpdater);
    }

    function setPerpFeeRecipient(address feeRecipient) external onlyOwner {
        LibPerpEngine.setFeeRecipient(feeRecipient);
    }

    function setPerpProtocolFeeShare(uint16 protocolFeeShareBps) external onlyOwner {
        LibPerpEngine.setProtocolFeeShare(protocolFeeShareBps);
    }
}
