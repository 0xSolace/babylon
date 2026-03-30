// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {LibPerpEngine} from "../libraries/LibPerpEngine.sol";

contract PerpViewFacet {
    function getPerpEngineConfig()
        external
        view
        returns (
            address collateralToken,
            uint8 collateralDecimals,
            address oracleUpdater,
            address feeRecipient,
            uint16 protocolFeeShareBps,
            uint32 maxOracleDelay,
            uint256 nextOrderNonce
        )
    {
        LibPerpEngine.EngineStorage storage es = LibPerpEngine.engineStorage();
        return (
            es.collateralToken,
            es.collateralDecimals,
            es.oracleUpdater,
            es.feeRecipient,
            es.protocolFeeShareBps,
            es.maxOracleDelay,
            es.nextOrderNonce
        );
    }

    function getPerpAccount(address account) external view returns (uint256 freeCollateral) {
        return LibPerpEngine.engineStorage().cashBalances[account];
    }

    function getPerpMarketIds() external view returns (bytes32[] memory marketIds) {
        return LibPerpEngine.engineStorage().marketIds;
    }

    function getPerpMarket(bytes32 marketId)
        external
        view
        returns (
            string memory symbol,
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
            uint16 minLiquidityBps,
            bool active,
            uint256 totalLongSize,
            uint256 totalShortSize,
            uint256 vaultBalance,
            uint64 latestVersion
        )
    {
        LibPerpEngine.EngineStorage storage es = LibPerpEngine.engineStorage();
        LibPerpEngine.MarketConfig storage config = es.marketConfigs[marketId];
        LibPerpEngine.MarketState storage state = es.marketStates[marketId];
        return (
            config.symbol,
            config.maxOpenInterest,
            config.maxSkew,
            config.skewScale,
            config.minTradeSize,
            config.initialMarginBps,
            config.maintenanceMarginBps,
            config.liquidationFeeBps,
            config.openFeeBps,
            config.closeFeeBps,
            config.maxFundingVelocityBps,
            config.maxPriceImpactBps,
            config.minLiquidityBps,
            config.active,
            state.totalLongSize,
            state.totalShortSize,
            state.vaultBalance,
            state.latestVersion
        );
    }

    function getPerpOracleVersion(bytes32 marketId, uint64 versionId)
        external
        view
        returns (uint64 timestamp, uint256 price, int256 cumulativeFunding)
    {
        LibPerpEngine.OracleVersion storage version = LibPerpEngine.engineStorage().oracleVersions[marketId][versionId];
        return (version.timestamp, version.price, version.cumulativeFunding);
    }

    function getPerpPosition(address account, bytes32 marketId)
        external
        view
        returns (
            LibPerpEngine.Side side,
            uint256 size,
            uint256 collateral,
            uint256 entryPrice,
            int256 entryFunding
        )
    {
        LibPerpEngine.Position storage position = LibPerpEngine.engineStorage().positions[account][marketId];
        return (position.side, position.size, position.collateral, position.entryPrice, position.entryFunding);
    }

    function getPerpOrder(bytes32 orderId)
        external
        view
        returns (
            address account,
            bytes32 marketId,
            LibPerpEngine.Side side,
            bool reduceOnly,
            bool triggerAbove,
            uint64 createdAt,
            uint64 executableAtVersion,
            uint64 expiry,
            uint256 sizeDelta,
            uint256 collateralDelta,
            uint256 triggerPrice,
            uint256 acceptablePrice,
            bool active
        )
    {
        LibPerpEngine.Order storage order = LibPerpEngine.engineStorage().orders[orderId];
        return (
            order.account,
            order.marketId,
            order.side,
            order.reduceOnly,
            order.triggerAbove,
            order.createdAt,
            order.executableAtVersion,
            order.expiry,
            order.sizeDelta,
            order.collateralDelta,
            order.triggerPrice,
            order.acceptablePrice,
            order.active
        );
    }

    function getPerpActiveOrderIds() external view returns (bytes32[] memory orderIds) {
        return LibPerpEngine.engineStorage().activeOrderIds;
    }

    function getPerpVaultPosition(address provider, bytes32 marketId)
        external
        view
        returns (uint256 shares, uint256 totalShares, uint256 vaultBalance)
    {
        LibPerpEngine.EngineStorage storage es = LibPerpEngine.engineStorage();
        return (es.lpShares[provider][marketId], es.totalLpShares[marketId], es.marketStates[marketId].vaultBalance);
    }

    function getPerpProtocolFees(bytes32 marketId) external view returns (uint256) {
        return LibPerpEngine.engineStorage().protocolFees[marketId];
    }

    function previewPerpExecutionPrice(
        bytes32 marketId,
        uint256 indexPrice,
        LibPerpEngine.Side side,
        bool reduceOnly,
        uint256 sizeDelta
    ) external view returns (uint256) {
        return LibPerpEngine.executionPrice(marketId, indexPrice, side, reduceOnly, sizeDelta);
    }
}
