// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

library LibPerpEngine {
    using SafeERC20 for IERC20;

    bytes32 internal constant STORAGE_POSITION = keccak256("babylon.perp.engine.storage.v2");
    uint256 internal constant BPS = 10_000;
    uint256 internal constant ONE = 1e18;
    uint256 internal constant PRICE_SCALE = 1e8;

    enum Side {
        LONG,
        SHORT
    }

    struct MarketConfig {
        bytes32 id;
        string symbol;
        uint256 maxOpenInterest;
        uint256 maxSkew;
        uint256 skewScale;
        uint256 minTradeSize;
        uint16 initialMarginBps;
        uint16 maintenanceMarginBps;
        uint16 liquidationFeeBps;
        uint16 openFeeBps;
        uint16 closeFeeBps;
        uint16 maxFundingVelocityBps;
        uint16 maxPriceImpactBps;
        uint16 minLiquidityBps;
        bool active;
    }

    struct MarketState {
        uint256 totalLongSize;
        uint256 totalShortSize;
        uint256 vaultBalance;
        uint64 latestVersion;
        bool exists;
    }

    struct OracleVersion {
        uint64 timestamp;
        uint256 price;
        int256 cumulativeFunding;
    }

    struct Position {
        Side side;
        uint256 size;
        uint256 collateral;
        uint256 entryPrice;
        int256 entryFunding;
    }

    struct Order {
        address account;
        bytes32 marketId;
        Side side;
        bool reduceOnly;
        bool triggerAbove;
        uint64 createdAt;
        uint64 executableAtVersion;
        uint64 expiry;
        uint256 sizeDelta;
        uint256 collateralDelta;
        uint256 triggerPrice;
        uint256 acceptablePrice;
        bool active;
    }

    struct EngineStorage {
        bool initialized;
        bool entered;
        address collateralToken;
        uint8 collateralDecimals;
        address oracleUpdater;
        address feeRecipient;
        uint16 protocolFeeShareBps;
        uint32 maxOracleDelay;
        uint256 nextOrderNonce;
        mapping(bytes32 => MarketConfig) marketConfigs;
        mapping(bytes32 => MarketState) marketStates;
        bytes32[] marketIds;
        mapping(bytes32 => mapping(uint64 => OracleVersion)) oracleVersions;
        mapping(address => uint256) cashBalances;
        mapping(address => mapping(bytes32 => Position)) positions;
        mapping(bytes32 => Order) orders;
        bytes32[] activeOrderIds;
        mapping(bytes32 => uint256) activeOrderIndexPlusOne;
        mapping(address => mapping(bytes32 => uint256)) lpShares;
        mapping(bytes32 => uint256) totalLpShares;
        mapping(bytes32 => uint256) protocolFees;
    }

    error EngineAlreadyInitialized();
    error EngineNotInitialized();
    error InvalidCollateralToken();
    error InvalidUpdater();
    error InvalidFeeRecipient();
    error InvalidFeeShare();
    error InvalidOracleDelay();
    error MarketAlreadyExists();
    error MarketNotFound();
    error MarketInactive();
    error InvalidMarketConfig();
    error InvalidAmount();
    error InsufficientCash();
    error InsufficientLiquidity();
    error OracleVersionMissing();
    error OracleVersionStale();
    error InvalidOracleTimestamp();
    error PriceMustBePositive();
    error TriggerNotSatisfied();
    error OrderNotFound();
    error OrderExpired();
    error CannotFlipPosition();
    error PositionNotFound();
    error PositionInsolvent();
    error InitialMarginViolation();
    error MaintenanceMarginViolation();
    error SlippageExceeded();
    error MaxOpenInterestExceeded();
    error MaxSkewExceeded();
    error LiquidityCoverageTooLow();
    error LiquidationNotAllowed();
    error ImpactTooLarge();
    error ReentrantCall();

    event PerpEngineInitialized(
        address indexed collateralToken,
        address indexed oracleUpdater,
        address indexed feeRecipient,
        uint16 protocolFeeShareBps,
        uint32 maxOracleDelay
    );
    event PerpMarketCreated(bytes32 indexed marketId, string symbol);
    event PerpMarketStatusUpdated(bytes32 indexed marketId, bool active);
    event OracleUpdaterUpdated(address indexed updater);
    event FeeRecipientUpdated(address indexed feeRecipient);
    event ProtocolFeeShareUpdated(uint16 protocolFeeShareBps);
    event PerpCollateralDeposited(address indexed account, uint256 rawAmount, uint256 normalizedAmount);
    event PerpCollateralWithdrawn(address indexed account, uint256 rawAmount, uint256 normalizedAmount);
    event PerpLiquidityAdded(address indexed provider, bytes32 indexed marketId, uint256 assets, uint256 shares);
    event PerpLiquidityRemoved(address indexed provider, bytes32 indexed marketId, uint256 assets, uint256 shares);
    event PerpPositionCollateralAdded(address indexed account, bytes32 indexed marketId, uint256 amount);
    event PerpPositionCollateralRemoved(address indexed account, bytes32 indexed marketId, uint256 amount);
    event PerpOrderPlaced(
        bytes32 indexed orderId,
        address indexed account,
        bytes32 indexed marketId,
        bool reduceOnly,
        Side side,
        uint256 sizeDelta,
        uint256 collateralDelta,
        uint256 triggerPrice,
        uint256 acceptablePrice,
        uint64 executableAtVersion,
        bool triggerAbove,
        uint64 expiry
    );
    event PerpOrderCancelled(bytes32 indexed orderId, address indexed account);
    event PerpOracleVersionPublished(
        bytes32 indexed marketId,
        uint64 indexed version,
        uint64 timestamp,
        uint256 price,
        int256 cumulativeFunding
    );
    event PerpOrderExecuted(
        bytes32 indexed orderId,
        address indexed account,
        bytes32 indexed marketId,
        Side side,
        bool reduceOnly,
        uint256 sizeDelta,
        uint256 fillPrice,
        uint64 version
    );
    event PerpPositionLiquidated(
        address indexed account,
        bytes32 indexed marketId,
        address indexed liquidator,
        uint256 fillPrice,
        uint64 version,
        uint256 liquidatorReward
    );
    event PerpProtocolFeesClaimed(bytes32 indexed marketId, address indexed to, uint256 rawAmount, uint256 normalizedAmount);

    function engineStorage() internal pure returns (EngineStorage storage es) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            es.slot := position
        }
    }

    function enter() internal {
        EngineStorage storage es = engineStorage();
        if (es.entered) revert ReentrantCall();
        es.entered = true;
    }

    function exit() internal {
        engineStorage().entered = false;
    }

    function initialize(
        address collateralToken,
        address oracleUpdater,
        address feeRecipient,
        uint16 protocolFeeShareBps,
        uint32 maxOracleDelay
    ) internal {
        EngineStorage storage es = engineStorage();
        if (es.initialized) revert EngineAlreadyInitialized();
        if (collateralToken == address(0)) revert InvalidCollateralToken();
        if (oracleUpdater == address(0)) revert InvalidUpdater();
        if (feeRecipient == address(0)) revert InvalidFeeRecipient();
        if (protocolFeeShareBps > BPS) revert InvalidFeeShare();
        if (maxOracleDelay == 0) revert InvalidOracleDelay();

        uint8 decimals = IERC20Metadata(collateralToken).decimals();
        if (decimals > 18) revert InvalidCollateralToken();

        es.initialized = true;
        es.collateralToken = collateralToken;
        es.collateralDecimals = decimals;
        es.oracleUpdater = oracleUpdater;
        es.feeRecipient = feeRecipient;
        es.protocolFeeShareBps = protocolFeeShareBps;
        es.maxOracleDelay = maxOracleDelay;
        es.nextOrderNonce = 1;

        emit PerpEngineInitialized(collateralToken, oracleUpdater, feeRecipient, protocolFeeShareBps, maxOracleDelay);
    }

    function enforceInitialized() internal view {
        if (!engineStorage().initialized) revert EngineNotInitialized();
    }

    function setOracleUpdater(address oracleUpdater) internal {
        if (oracleUpdater == address(0)) revert InvalidUpdater();
        engineStorage().oracleUpdater = oracleUpdater;
        emit OracleUpdaterUpdated(oracleUpdater);
    }

    function setFeeRecipient(address feeRecipient) internal {
        if (feeRecipient == address(0)) revert InvalidFeeRecipient();
        engineStorage().feeRecipient = feeRecipient;
        emit FeeRecipientUpdated(feeRecipient);
    }

    function setProtocolFeeShare(uint16 protocolFeeShareBps) internal {
        if (protocolFeeShareBps > BPS) revert InvalidFeeShare();
        engineStorage().protocolFeeShareBps = protocolFeeShareBps;
        emit ProtocolFeeShareUpdated(protocolFeeShareBps);
    }

    function createMarket(
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
    ) internal returns (bytes32 marketId) {
        if (
            bytes(symbol).length == 0 ||
            maxOpenInterest == 0 ||
            maxSkew == 0 ||
            skewScale == 0 ||
            minTradeSize == 0 ||
            initialMarginBps == 0 ||
            maintenanceMarginBps == 0 ||
            liquidationFeeBps == 0 ||
            initialMarginBps >= BPS ||
            maintenanceMarginBps >= initialMarginBps ||
            liquidationFeeBps >= BPS ||
            maxPriceImpactBps == 0 ||
            maxPriceImpactBps >= BPS ||
            minLiquidityBps == 0 ||
            minLiquidityBps >= BPS ||
            openFeeBps >= BPS ||
            closeFeeBps >= BPS ||
            maxSkew > skewScale
        ) {
            revert InvalidMarketConfig();
        }

        EngineStorage storage es = engineStorage();
        marketId = keccak256(abi.encodePacked(symbol, block.timestamp, es.marketIds.length, address(this)));
        if (es.marketStates[marketId].exists) revert MarketAlreadyExists();

        es.marketConfigs[marketId] = MarketConfig({
            id: marketId,
            symbol: symbol,
            maxOpenInterest: maxOpenInterest,
            maxSkew: maxSkew,
            skewScale: skewScale,
            minTradeSize: minTradeSize,
            initialMarginBps: initialMarginBps,
            maintenanceMarginBps: maintenanceMarginBps,
            liquidationFeeBps: liquidationFeeBps,
            openFeeBps: openFeeBps,
            closeFeeBps: closeFeeBps,
            maxFundingVelocityBps: maxFundingVelocityBps,
            maxPriceImpactBps: maxPriceImpactBps,
            minLiquidityBps: minLiquidityBps,
            active: true
        });
        es.marketStates[marketId].exists = true;
        es.marketIds.push(marketId);

        emit PerpMarketCreated(marketId, symbol);
    }

    function setMarketStatus(bytes32 marketId, bool active) internal {
        EngineStorage storage es = engineStorage();
        if (!es.marketStates[marketId].exists) revert MarketNotFound();
        es.marketConfigs[marketId].active = active;
        emit PerpMarketStatusUpdated(marketId, active);
    }

    function deposit(address account, uint256 rawAmount) internal {
        if (rawAmount == 0) revert InvalidAmount();
        EngineStorage storage es = engineStorage();
        uint256 normalizedAmount = normalizeCollateral(rawAmount);
        IERC20(es.collateralToken).safeTransferFrom(account, address(this), rawAmount);
        es.cashBalances[account] += normalizedAmount;
        emit PerpCollateralDeposited(account, rawAmount, normalizedAmount);
    }

    function withdraw(address account, uint256 rawAmount) internal {
        if (rawAmount == 0) revert InvalidAmount();
        EngineStorage storage es = engineStorage();
        uint256 normalizedAmount = normalizeCollateral(rawAmount);
        if (es.cashBalances[account] < normalizedAmount) revert InsufficientCash();
        es.cashBalances[account] -= normalizedAmount;
        IERC20(es.collateralToken).safeTransfer(account, rawAmount);
        emit PerpCollateralWithdrawn(account, rawAmount, normalizedAmount);
    }

    function addLiquidity(address provider, bytes32 marketId, uint256 rawAmount) internal returns (uint256 shares) {
        if (rawAmount == 0) revert InvalidAmount();
        EngineStorage storage es = engineStorage();
        MarketState storage state = es.marketStates[marketId];
        if (!state.exists) revert MarketNotFound();

        uint256 amount = normalizeCollateral(rawAmount);
        if (es.cashBalances[provider] < amount) revert InsufficientCash();

        uint256 totalShares = es.totalLpShares[marketId];
        if (totalShares == 0 || state.vaultBalance == 0) {
            shares = amount;
        } else {
            shares = amount * totalShares / state.vaultBalance;
        }
        if (shares == 0) revert InvalidAmount();

        es.cashBalances[provider] -= amount;
        state.vaultBalance += amount;
        es.totalLpShares[marketId] += shares;
        es.lpShares[provider][marketId] += shares;

        emit PerpLiquidityAdded(provider, marketId, amount, shares);
    }

    function removeLiquidity(address provider, bytes32 marketId, uint256 shares) internal returns (uint256 assets) {
        if (shares == 0) revert InvalidAmount();
        EngineStorage storage es = engineStorage();
        MarketState storage state = es.marketStates[marketId];
        if (!state.exists) revert MarketNotFound();

        uint256 providerShares = es.lpShares[provider][marketId];
        if (providerShares < shares) revert InvalidAmount();

        uint256 totalShares = es.totalLpShares[marketId];
        assets = shares * state.vaultBalance / totalShares;
        if (assets == 0) revert InvalidAmount();

        uint256 remainingVault = state.vaultBalance - assets;
        _enforceLiquidityCoverage(marketId, remainingVault, latestPrice(marketId));

        es.lpShares[provider][marketId] = providerShares - shares;
        es.totalLpShares[marketId] = totalShares - shares;
        state.vaultBalance = remainingVault;
        es.cashBalances[provider] += assets;

        emit PerpLiquidityRemoved(provider, marketId, assets, shares);
    }

    function addPositionCollateral(address account, bytes32 marketId, uint256 rawAmount) internal {
        if (rawAmount == 0) revert InvalidAmount();
        EngineStorage storage es = engineStorage();
        Position storage position = es.positions[account][marketId];
        if (position.size == 0) revert PositionNotFound();
        uint256 amount = normalizeCollateral(rawAmount);
        if (es.cashBalances[account] < amount) revert InsufficientCash();
        es.cashBalances[account] -= amount;
        position.collateral += amount;
        emit PerpPositionCollateralAdded(account, marketId, amount);
    }

    function removePositionCollateral(address account, bytes32 marketId, uint256 rawAmount) internal {
        if (rawAmount == 0) revert InvalidAmount();
        EngineStorage storage es = engineStorage();
        Position storage position = es.positions[account][marketId];
        if (position.size == 0) revert PositionNotFound();
        OracleVersion memory version = freshLatestVersion(marketId);
        uint256 amount = normalizeCollateral(rawAmount);
        if (position.collateral < amount) revert InvalidAmount();

        int256 equity = positionEquity(position, version.price, version.cumulativeFunding);
        position.collateral -= amount;
        uint256 notional = position.size * version.price / PRICE_SCALE;
        uint256 requiredMargin = notional * es.marketConfigs[marketId].initialMarginBps / BPS;
        if (equity - int256(amount) < int256(requiredMargin)) revert InitialMarginViolation();

        es.cashBalances[account] += amount;
        emit PerpPositionCollateralRemoved(account, marketId, amount);
    }

    function placeMarketOrder(
        address account,
        bytes32 marketId,
        Side side,
        bool reduceOnly,
        uint256 sizeDelta,
        uint256 collateralDelta,
        uint256 acceptablePrice,
        uint64 expiry
    ) internal returns (bytes32 orderId) {
        EngineStorage storage es = engineStorage();
        _validateOrderInputs(marketId, sizeDelta, collateralDelta, reduceOnly);

        if (!reduceOnly) {
            if (es.cashBalances[account] < collateralDelta) revert InsufficientCash();
            es.cashBalances[account] -= collateralDelta;
        }

        orderId = _reserveOrderId(account);
        es.orders[orderId] = Order({
            account: account,
            marketId: marketId,
            side: side,
            reduceOnly: reduceOnly,
            triggerAbove: false,
            createdAt: uint64(block.timestamp),
            executableAtVersion: es.marketStates[marketId].latestVersion + 1,
            expiry: expiry,
            sizeDelta: sizeDelta,
            collateralDelta: collateralDelta,
            triggerPrice: 0,
            acceptablePrice: acceptablePrice,
            active: true
        });
        _registerActiveOrder(orderId);

        emit PerpOrderPlaced(
            orderId,
            account,
            marketId,
            reduceOnly,
            side,
            sizeDelta,
            collateralDelta,
            0,
            acceptablePrice,
            es.marketStates[marketId].latestVersion + 1,
            false,
            expiry
        );
    }

    function placeTriggerOrder(
        address account,
        bytes32 marketId,
        Side side,
        bool reduceOnly,
        uint256 sizeDelta,
        uint256 collateralDelta,
        uint256 triggerPrice,
        uint256 acceptablePrice,
        bool triggerAbove,
        uint64 expiry
    ) internal returns (bytes32 orderId) {
        EngineStorage storage es = engineStorage();
        _validateOrderInputs(marketId, sizeDelta, collateralDelta, reduceOnly);
        if (triggerPrice == 0) revert PriceMustBePositive();

        if (!reduceOnly) {
            if (es.cashBalances[account] < collateralDelta) revert InsufficientCash();
            es.cashBalances[account] -= collateralDelta;
        }

        orderId = _reserveOrderId(account);
        es.orders[orderId] = Order({
            account: account,
            marketId: marketId,
            side: side,
            reduceOnly: reduceOnly,
            triggerAbove: triggerAbove,
            createdAt: uint64(block.timestamp),
            executableAtVersion: es.marketStates[marketId].latestVersion,
            expiry: expiry,
            sizeDelta: sizeDelta,
            collateralDelta: collateralDelta,
            triggerPrice: triggerPrice,
            acceptablePrice: acceptablePrice,
            active: true
        });
        _registerActiveOrder(orderId);

        emit PerpOrderPlaced(
            orderId,
            account,
            marketId,
            reduceOnly,
            side,
            sizeDelta,
            collateralDelta,
            triggerPrice,
            acceptablePrice,
            es.marketStates[marketId].latestVersion,
            triggerAbove,
            expiry
        );
    }

    function cancelOrder(address account, bytes32 orderId) internal {
        EngineStorage storage es = engineStorage();
        Order storage order = es.orders[orderId];
        if (!order.active || order.account == address(0)) revert OrderNotFound();
        if (order.account != account) revert OrderNotFound();

        order.active = false;
        _removeActiveOrder(orderId);
        if (!order.reduceOnly && order.collateralDelta > 0) {
            es.cashBalances[account] += order.collateralDelta;
        }

        emit PerpOrderCancelled(orderId, account);
    }

    function publishOracleVersions(bytes32[] calldata marketIds, uint256[] calldata prices, uint64 timestamp) internal {
        if (marketIds.length == 0 || marketIds.length != prices.length) revert InvalidAmount();
        if (timestamp == 0 || timestamp > block.timestamp) revert InvalidOracleTimestamp();

        for (uint256 i = 0; i < marketIds.length; i++) {
            _publishOracleVersion(marketIds[i], prices[i], timestamp);
        }
    }

    function executeOrder(bytes32 orderId) internal {
        EngineStorage storage es = engineStorage();
        Order storage order = es.orders[orderId];
        if (!order.active || order.account == address(0)) revert OrderNotFound();
        if (order.expiry != 0 && block.timestamp > order.expiry) revert OrderExpired();

        OracleVersion memory version = freshLatestVersion(order.marketId);
        if (versionExistsAt(order.marketId, order.executableAtVersion) == false) revert OracleVersionMissing();
        if (es.marketStates[order.marketId].latestVersion < order.executableAtVersion) revert OracleVersionMissing();

        if (order.triggerPrice > 0) {
            bool triggered = order.triggerAbove ? version.price >= order.triggerPrice : version.price <= order.triggerPrice;
            if (!triggered) revert TriggerNotSatisfied();
        }

        uint256 fillPrice = executionPrice(order.marketId, version.price, order.side, order.reduceOnly, order.sizeDelta);
        _enforceAcceptablePrice(order.side, order.reduceOnly, fillPrice, order.acceptablePrice);

        order.active = false;
        _removeActiveOrder(orderId);

        if (order.reduceOnly) {
            _executeReduce(order, fillPrice, version);
        } else {
            _executeIncrease(order, fillPrice, version);
        }

        emit PerpOrderExecuted(
            orderId,
            order.account,
            order.marketId,
            order.side,
            order.reduceOnly,
            order.sizeDelta,
            fillPrice,
            es.marketStates[order.marketId].latestVersion
        );
    }

    function liquidate(address liquidator, address account, bytes32 marketId) internal {
        EngineStorage storage es = engineStorage();
        Position storage position = es.positions[account][marketId];
        if (position.size == 0) revert PositionNotFound();

        OracleVersion memory version = freshLatestVersion(marketId);
        uint256 fillPrice = executionPrice(marketId, version.price, position.side, true, position.size);
        int256 pnl = positionPnl(position, fillPrice, version.cumulativeFunding);
        int256 equity = int256(position.collateral) + pnl;
        uint256 notional = position.size * fillPrice / PRICE_SCALE;
        uint256 maintenanceMargin = notional * es.marketConfigs[marketId].maintenanceMarginBps / BPS;
        if (equity >= int256(maintenanceMargin)) revert LiquidationNotAllowed();

        uint256 liquidationFee = notional * es.marketConfigs[marketId].liquidationFeeBps / BPS;
        uint256 liquidatorReward = 0;
        if (equity > 0) {
            uint256 available = uint256(equity);
            liquidatorReward = available < liquidationFee ? available : liquidationFee;
            if (available > liquidatorReward) {
                es.cashBalances[account] += available - liquidatorReward;
            }
            es.cashBalances[liquidator] += liquidatorReward;
        }

        _settleVaultPnl(es.marketStates[marketId], pnl, position.collateral);
        _decreaseOpenInterest(es.marketStates[marketId], position.side, position.size);

        delete es.positions[account][marketId];

        emit PerpPositionLiquidated(
            account,
            marketId,
            liquidator,
            fillPrice,
            es.marketStates[marketId].latestVersion,
            liquidatorReward
        );
    }

    function claimProtocolFees(bytes32 marketId, address to, uint256 rawAmount) internal {
        if (to == address(0)) revert InvalidFeeRecipient();
        if (rawAmount == 0) revert InvalidAmount();
        EngineStorage storage es = engineStorage();
        uint256 amount = normalizeCollateral(rawAmount);
        if (es.protocolFees[marketId] < amount) revert InsufficientLiquidity();
        es.protocolFees[marketId] -= amount;
        IERC20(es.collateralToken).safeTransfer(to, rawAmount);
        emit PerpProtocolFeesClaimed(marketId, to, rawAmount, amount);
    }

    function latestPrice(bytes32 marketId) internal view returns (uint256 price) {
        EngineStorage storage es = engineStorage();
        uint64 latestVersionId = es.marketStates[marketId].latestVersion;
        if (latestVersionId == 0) {
            return 0;
        }
        return es.oracleVersions[marketId][latestVersionId].price;
    }

    function freshLatestVersion(bytes32 marketId) internal view returns (OracleVersion memory version) {
        EngineStorage storage es = engineStorage();
        uint64 latestVersionId = es.marketStates[marketId].latestVersion;
        if (latestVersionId == 0) revert OracleVersionMissing();
        version = es.oracleVersions[marketId][latestVersionId];
        if (block.timestamp > version.timestamp + es.maxOracleDelay) revert OracleVersionStale();
    }

    function versionExistsAt(bytes32 marketId, uint64 versionId) internal view returns (bool) {
        if (versionId == 0) {
            return false;
        }
        return engineStorage().oracleVersions[marketId][versionId].timestamp != 0;
    }

    function normalizeCollateral(uint256 rawAmount) internal view returns (uint256) {
        EngineStorage storage es = engineStorage();
        if (es.collateralDecimals == 18) {
            return rawAmount;
        }
        return rawAmount * (10 ** (18 - es.collateralDecimals));
    }

    function denormalizeCollateral(uint256 normalizedAmount) internal view returns (uint256) {
        EngineStorage storage es = engineStorage();
        if (es.collateralDecimals == 18) {
            return normalizedAmount;
        }
        return normalizedAmount / (10 ** (18 - es.collateralDecimals));
    }

    function executionPrice(
        bytes32 marketId,
        uint256 indexPrice,
        Side side,
        bool reduceOnly,
        uint256 sizeDelta
    ) internal view returns (uint256) {
        if (indexPrice == 0) revert PriceMustBePositive();
        EngineStorage storage es = engineStorage();
        MarketConfig storage config = es.marketConfigs[marketId];
        MarketState storage state = es.marketStates[marketId];
        if (!state.exists) revert MarketNotFound();

        int256 signedSizeDelta = signedSize(side, sizeDelta);
        if (reduceOnly) {
            signedSizeDelta = -signedSizeDelta;
        }

        int256 skewBefore = int256(state.totalLongSize) - int256(state.totalShortSize);
        int256 skewAfter = skewBefore + signedSizeDelta;
        if (_abs(skewAfter) > config.maxSkew) revert MaxSkewExceeded();

        int256 premiumBefore = skewBefore * int256(ONE) / int256(config.skewScale);
        int256 premiumAfter = skewAfter * int256(ONE) / int256(config.skewScale);
        int256 avgPremium = (premiumBefore + premiumAfter) / 2;
        if (_abs(avgPremium) > uint256(config.maxPriceImpactBps) * 1e14) revert ImpactTooLarge();

        int256 adjusted = int256(indexPrice) * (int256(ONE) + avgPremium) / int256(ONE);
        if (adjusted <= 0) revert PriceMustBePositive();
        return uint256(adjusted);
    }

    function positionPnl(
        Position storage position,
        uint256 price,
        int256 cumulativeFunding
    ) internal view returns (int256 pnl) {
        if (position.size == 0) {
            return 0;
        }
        int256 priceDelta;
        if (position.side == Side.LONG) {
            priceDelta = int256(price) - int256(position.entryPrice);
        } else {
            priceDelta = int256(position.entryPrice) - int256(price);
        }

        int256 pricePnl = int256(position.size) * priceDelta / int256(PRICE_SCALE);
        int256 fundingDelta = cumulativeFunding - position.entryFunding;
        int256 fundingPnl = int256(position.size) * fundingDelta / int256(PRICE_SCALE);
        if (position.side == Side.LONG) {
            fundingPnl = -fundingPnl;
        }

        return pricePnl + fundingPnl;
    }

    function positionEquity(
        Position storage position,
        uint256 price,
        int256 cumulativeFunding
    ) internal view returns (int256) {
        return int256(position.collateral) + positionPnl(position, price, cumulativeFunding);
    }

    function signedSize(Side side, uint256 sizeDelta) internal pure returns (int256) {
        return side == Side.LONG ? int256(sizeDelta) : -int256(sizeDelta);
    }

    function _validateOrderInputs(
        bytes32 marketId,
        uint256 sizeDelta,
        uint256 collateralDelta,
        bool reduceOnly
    ) private view {
        EngineStorage storage es = engineStorage();
        MarketState storage state = es.marketStates[marketId];
        if (!state.exists) revert MarketNotFound();
        if (!es.marketConfigs[marketId].active) revert MarketInactive();
        if (sizeDelta == 0 || sizeDelta < es.marketConfigs[marketId].minTradeSize) revert InvalidAmount();
        if (!reduceOnly && collateralDelta == 0) revert InvalidAmount();
    }

    function _reserveOrderId(address account) private returns (bytes32 orderId) {
        EngineStorage storage es = engineStorage();
        uint256 nonce = es.nextOrderNonce++;
        orderId = keccak256(abi.encodePacked(account, nonce, block.chainid, address(this)));
    }

    function _registerActiveOrder(bytes32 orderId) private {
        EngineStorage storage es = engineStorage();
        es.activeOrderIds.push(orderId);
        es.activeOrderIndexPlusOne[orderId] = es.activeOrderIds.length;
    }

    function _removeActiveOrder(bytes32 orderId) private {
        EngineStorage storage es = engineStorage();
        uint256 indexPlusOne = es.activeOrderIndexPlusOne[orderId];
        if (indexPlusOne == 0) {
            return;
        }
        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = es.activeOrderIds.length - 1;
        if (index != lastIndex) {
            bytes32 lastOrderId = es.activeOrderIds[lastIndex];
            es.activeOrderIds[index] = lastOrderId;
            es.activeOrderIndexPlusOne[lastOrderId] = index + 1;
        }
        es.activeOrderIds.pop();
        delete es.activeOrderIndexPlusOne[orderId];
    }

    function _publishOracleVersion(bytes32 marketId, uint256 price, uint64 timestamp) private {
        if (price == 0) revert PriceMustBePositive();
        EngineStorage storage es = engineStorage();
        MarketState storage state = es.marketStates[marketId];
        MarketConfig storage config = es.marketConfigs[marketId];
        if (!state.exists) revert MarketNotFound();
        if (!config.active) revert MarketInactive();

        OracleVersion memory prior;
        if (state.latestVersion != 0) {
            prior = es.oracleVersions[marketId][state.latestVersion];
            if (timestamp <= prior.timestamp) revert InvalidOracleTimestamp();
        }

        int256 cumulativeFunding = prior.cumulativeFunding;
        if (state.latestVersion != 0 && config.maxFundingVelocityBps != 0) {
            int256 skew = int256(state.totalLongSize) - int256(state.totalShortSize);
            int256 proportionalSkew = skew * int256(ONE) / int256(config.skewScale);
            int256 maxVelocity = int256(uint256(config.maxFundingVelocityBps)) * 1e14;
            int256 fundingRatePerDay = proportionalSkew * maxVelocity / int256(ONE);
            int256 elapsed = int256(uint256(timestamp - prior.timestamp));
            int256 fundingDelta = int256(price) * fundingRatePerDay * elapsed / int256(1 days) / int256(ONE);
            cumulativeFunding += fundingDelta;
        }

        uint64 versionId = state.latestVersion + 1;
        es.oracleVersions[marketId][versionId] = OracleVersion({
            timestamp: timestamp,
            price: price,
            cumulativeFunding: cumulativeFunding
        });
        state.latestVersion = versionId;

        emit PerpOracleVersionPublished(marketId, versionId, timestamp, price, cumulativeFunding);
    }

    function _executeIncrease(Order storage order, uint256 fillPrice, OracleVersion memory version) private {
        EngineStorage storage es = engineStorage();
        MarketConfig storage config = es.marketConfigs[order.marketId];
        MarketState storage state = es.marketStates[order.marketId];
        Position storage position = es.positions[order.account][order.marketId];

        if (position.size != 0 && position.side != order.side) revert CannotFlipPosition();

        uint256 notional = order.sizeDelta * fillPrice / PRICE_SCALE;
        uint256 fee = notional * config.openFeeBps / BPS;
        if (order.collateralDelta <= fee) revert InitialMarginViolation();
        uint256 effectiveCollateral = order.collateralDelta - fee;

        int256 equityBefore = 0;
        if (position.size != 0) {
            equityBefore = positionEquity(position, version.price, version.cumulativeFunding);
        }
        int256 equityAfter = equityBefore + int256(effectiveCollateral);

        uint256 newSize = position.size + order.sizeDelta;
        uint256 newNotional = newSize * fillPrice / PRICE_SCALE;
        uint256 requiredInitialMargin = newNotional * config.initialMarginBps / BPS;
        if (equityAfter < int256(requiredInitialMargin)) revert InitialMarginViolation();

        if (position.size == 0) {
            position.side = order.side;
            position.size = order.sizeDelta;
            position.collateral = effectiveCollateral;
            position.entryPrice = fillPrice;
            position.entryFunding = version.cumulativeFunding;
        } else {
            uint256 oldSize = position.size;
            position.size = newSize;
            position.collateral += effectiveCollateral;
            position.entryPrice = (position.entryPrice * oldSize + fillPrice * order.sizeDelta) / newSize;
            position.entryFunding =
                (position.entryFunding * int256(oldSize) + version.cumulativeFunding * int256(order.sizeDelta))
                / int256(newSize);
        }

        _increaseOpenInterest(state, order.side, order.sizeDelta);
        _enforceOpenInterest(order.marketId, fillPrice);
        _applyFee(order.marketId, fee);
    }

    function _executeReduce(Order storage order, uint256 fillPrice, OracleVersion memory version) private {
        EngineStorage storage es = engineStorage();
        MarketConfig storage config = es.marketConfigs[order.marketId];
        MarketState storage state = es.marketStates[order.marketId];
        Position storage position = es.positions[order.account][order.marketId];
        if (position.size == 0 || position.side != order.side) revert PositionNotFound();
        if (order.sizeDelta > position.size) revert InvalidAmount();

        int256 totalPnl = positionPnl(position, fillPrice, version.cumulativeFunding);
        int256 totalEquity = int256(position.collateral) + totalPnl;
        if (totalEquity < 0) revert PositionInsolvent();

        uint256 sizeDelta = order.sizeDelta;
        uint256 collateralSlice = position.collateral * sizeDelta / position.size;
        int256 equitySlice = totalEquity * int256(sizeDelta) / int256(position.size);
        int256 realizedPnl = equitySlice - int256(collateralSlice);
        uint256 notional = sizeDelta * fillPrice / PRICE_SCALE;
        uint256 fee = notional * config.closeFeeBps / BPS;

        _settleVaultPnl(state, realizedPnl, collateralSlice);
        _applyFee(order.marketId, fee);

        uint256 remainingSize = position.size - sizeDelta;
        uint256 remainingCollateral = position.collateral - collateralSlice;
        int256 settlement = equitySlice - int256(fee);

        if (settlement >= 0) {
            es.cashBalances[order.account] += uint256(settlement);
            position.collateral = remainingCollateral;
        } else {
            if (remainingSize == 0) revert PositionInsolvent();
            uint256 deficit = uint256(-settlement);
            if (remainingCollateral < deficit) revert PositionInsolvent();
            position.collateral = remainingCollateral - deficit;
        }

        position.size = remainingSize;
        _decreaseOpenInterest(state, order.side, sizeDelta);

        if (remainingSize == 0) {
            delete es.positions[order.account][order.marketId];
        }
    }

    function _settleVaultPnl(MarketState storage state, int256 pnl, uint256 collateralCap) private {
        if (pnl > 0) {
            uint256 payout = uint256(pnl);
            if (state.vaultBalance < payout) revert InsufficientLiquidity();
            state.vaultBalance -= payout;
        } else if (pnl < 0) {
            uint256 gain = uint256(-pnl);
            if (gain > collateralCap) {
                gain = collateralCap;
            }
            state.vaultBalance += gain;
        }
    }

    function _applyFee(bytes32 marketId, uint256 fee) private {
        if (fee == 0) {
            return;
        }
        EngineStorage storage es = engineStorage();
        uint256 protocolShare = fee * es.protocolFeeShareBps / BPS;
        uint256 vaultShare = fee - protocolShare;
        es.protocolFees[marketId] += protocolShare;
        es.marketStates[marketId].vaultBalance += vaultShare;
    }

    function _increaseOpenInterest(MarketState storage state, Side side, uint256 sizeDelta) private {
        if (side == Side.LONG) {
            state.totalLongSize += sizeDelta;
        } else {
            state.totalShortSize += sizeDelta;
        }
    }

    function _decreaseOpenInterest(MarketState storage state, Side side, uint256 sizeDelta) private {
        if (side == Side.LONG) {
            state.totalLongSize -= sizeDelta;
        } else {
            state.totalShortSize -= sizeDelta;
        }
    }

    function _enforceAcceptablePrice(Side side, bool reduceOnly, uint256 fillPrice, uint256 acceptablePrice) private pure {
        if (acceptablePrice == 0) {
            return;
        }

        if (!reduceOnly) {
            if (side == Side.LONG && fillPrice > acceptablePrice) revert SlippageExceeded();
            if (side == Side.SHORT && fillPrice < acceptablePrice) revert SlippageExceeded();
            return;
        }

        if (side == Side.LONG && fillPrice < acceptablePrice) revert SlippageExceeded();
        if (side == Side.SHORT && fillPrice > acceptablePrice) revert SlippageExceeded();
    }

    function _enforceOpenInterest(bytes32 marketId, uint256 price) private view {
        EngineStorage storage es = engineStorage();
        MarketConfig storage config = es.marketConfigs[marketId];
        MarketState storage state = es.marketStates[marketId];
        uint256 openInterest = (state.totalLongSize + state.totalShortSize) * price / PRICE_SCALE;
        if (openInterest > config.maxOpenInterest) revert MaxOpenInterestExceeded();
        _enforceLiquidityCoverage(marketId, state.vaultBalance, price);
    }

    function _enforceLiquidityCoverage(bytes32 marketId, uint256 vaultBalance, uint256 price) private view {
        if (price == 0) {
            return;
        }
        EngineStorage storage es = engineStorage();
        MarketConfig storage config = es.marketConfigs[marketId];
        MarketState storage state = es.marketStates[marketId];
        uint256 openInterest = (state.totalLongSize + state.totalShortSize) * price / PRICE_SCALE;
        if (openInterest == 0) {
            return;
        }
        if (vaultBalance * BPS < openInterest * config.minLiquidityBps) revert LiquidityCoverageTooLow();
    }

    function _abs(int256 value) private pure returns (uint256) {
        return uint256(value >= 0 ? value : -value);
    }
}
