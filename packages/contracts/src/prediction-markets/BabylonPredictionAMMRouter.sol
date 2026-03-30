// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {BabylonPredictionOracleAdapter} from "./BabylonPredictionOracleAdapter.sol";
import {LvrMarket} from "./hyperbet/LvrMarket.sol";
import {NoToken, YesToken} from "./hyperbet/Token.sol";
import {IMarketBondCallback} from "./hyperbet/interfaces/IMarketBondCallback.sol";
import {IMarketBuyCallback} from "./hyperbet/interfaces/IMarketBuyCallback.sol";
import {IMarketRedeemCallback} from "./hyperbet/interfaces/IMarketRedeemCallback.sol";
import {IMarketSellCallback} from "./hyperbet/interfaces/IMarketSellCallback.sol";

contract BabylonPredictionAMMRouter is
    Ownable,
    Pausable,
    ReentrancyGuard,
    IMarketBuyCallback,
    IMarketSellCallback,
    IMarketRedeemCallback,
    IMarketBondCallback
{
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE_BPS = 1000;

    error InvalidCollateralToken();
    error InvalidOracleAdapter();
    error InvalidTreasury();
    error InvalidOwner();
    error InvalidResolveTime();
    error InvalidLiquidity();
    error InvalidMarketId();
    error MarketAlreadyExists();
    error UnknownMarket();
    error MarketNotAllowed();
    error FeeTooHigh();
    error InvalidOutcome();
    error SlippageExceeded();
    error NoClaimablePosition();

    event PredictionMarketCreated(
        bytes32 indexed marketKey,
        address indexed marketAddress,
        string marketId,
        string question,
        string resolutionSource,
        uint256 resolveAt,
        uint256 initialLiquidity
    );
    event PredictionMarketLinked(bytes32 indexed marketKey, bytes32 indexed sessionId);
    event PredictionSharesBought(
        bytes32 indexed marketKey,
        address indexed buyer,
        uint8 indexed outcome,
        uint256 collateralIn,
        uint256 sharesOut
    );
    event PredictionSharesSwapped(
        bytes32 indexed marketKey,
        address indexed trader,
        uint8 indexed outcomeIn,
        uint8 outcomeOut,
        uint256 sharesIn,
        uint256 sharesOut
    );
    event PredictionClaimed(
        bytes32 indexed marketKey,
        address indexed trader,
        uint256 yesShares,
        uint256 noShares,
        uint256 payout
    );
    event PredictionMarketSettled(bytes32 indexed marketKey, uint8 indexed outcome, bool cancelled);

    IERC20 public immutable collateralToken;
    BabylonPredictionOracleAdapter public immutable oracleAdapter;

    address public immutable treasury;
    uint256 public immutable feeBps;

    mapping(bytes32 => address) private marketAddressByKey;
    mapping(address => bool) private allowedMarkets;

    constructor(
        address collateralToken_,
        address oracleAdapter_,
        address treasury_,
        uint256 feeBps_,
        address owner_
    ) Ownable(owner_) {
        if (collateralToken_ == address(0)) revert InvalidCollateralToken();
        if (oracleAdapter_ == address(0)) revert InvalidOracleAdapter();
        if (owner_ == address(0)) revert InvalidOwner();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (treasury_ == address(0) && feeBps_ != 0) revert InvalidTreasury();

        collateralToken = IERC20(collateralToken_);
        oracleAdapter = BabylonPredictionOracleAdapter(oracleAdapter_);
        treasury = treasury_;
        feeBps = feeBps_;
    }

    modifier onlyAllowedMarket() {
        if (!allowedMarkets[msg.sender]) revert MarketNotAllowed();
        _;
    }

    function setTradingPaused(bool paused) external onlyOwner {
        if (paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    function createMarket(
        string calldata marketId,
        string calldata question,
        string calldata resolutionSource,
        uint256 resolveAt,
        bool isDynamic,
        uint256 initialLiquidity
    ) external onlyOwner whenNotPaused returns (bytes32 marketKey, address marketAddress) {
        if (bytes(marketId).length == 0) revert InvalidMarketId();
        if (resolveAt <= block.timestamp) revert InvalidResolveTime();
        if (initialLiquidity == 0) revert InvalidLiquidity();

        marketKey = keccak256(bytes(marketId));
        if (marketAddressByKey[marketKey] != address(0)) {
            revert MarketAlreadyExists();
        }

        LvrMarket market = new LvrMarket(
            address(this),
            marketKey,
            address(oracleAdapter),
            isDynamic,
            resolveAt - block.timestamp,
            address(collateralToken),
            treasury,
            feeBps
        );

        collateralToken.safeTransferFrom(msg.sender, address(market), initialLiquidity);
        market.initializeLiquidity(initialLiquidity);

        marketAddress = address(market);
        allowedMarkets[marketAddress] = true;
        marketAddressByKey[marketKey] = marketAddress;

        emit PredictionMarketCreated(
            marketKey,
            marketAddress,
            marketId,
            question,
            resolutionSource,
            resolveAt,
            initialLiquidity
        );
    }

    function linkMarketToSession(bytes32 marketKey, bytes32 sessionId) external onlyOwner {
        _getMarketAddress(marketKey);

        oracleAdapter.linkMarket(marketKey, sessionId);
        emit PredictionMarketLinked(marketKey, sessionId);
    }

    function setMarketCancelled(bytes32 marketKey, bool cancelled) external onlyOwner {
        _getMarketAddress(marketKey);

        oracleAdapter.setMarketCancelled(marketKey, cancelled);
    }

    function buyShares(
        bytes32 marketKey,
        uint8 outcome,
        uint256 collateralIn,
        uint256 minSharesOut
    ) external nonReentrant whenNotPaused returns (uint256 sharesOut) {
        if (outcome > 1) revert InvalidOutcome();

        LvrMarket market = _getMarket(marketKey);
        sharesOut = market.buy(outcome == 1, collateralIn, msg.sender);
        if (sharesOut < minSharesOut) revert SlippageExceeded();

        emit PredictionSharesBought(marketKey, msg.sender, outcome, collateralIn, sharesOut);
    }

    function sellShares(
        bytes32 marketKey,
        uint8 outcome,
        uint256 sharesIn,
        uint256 minSharesOut
    ) external nonReentrant whenNotPaused returns (uint256 sharesOut) {
        if (outcome > 1) revert InvalidOutcome();

        LvrMarket market = _getMarket(marketKey);
        sharesOut = market.sell(outcome == 1, sharesIn, msg.sender);
        if (sharesOut < minSharesOut) revert SlippageExceeded();

        emit PredictionSharesSwapped(
            marketKey,
            msg.sender,
            outcome,
            outcome == 1 ? uint8(0) : uint8(1),
            sharesIn,
            sharesOut
        );
    }

    function claimAll(bytes32 marketKey) external nonReentrant returns (uint256 payout) {
        LvrMarket market = _getMarket(marketKey);
        address yesToken = market.getToken(true);
        address noToken = market.getToken(false);
        uint256 yesBalance = IERC20(yesToken).balanceOf(msg.sender);
        uint256 noBalance = IERC20(noToken).balanceOf(msg.sender);

        if (yesBalance == 0 && noBalance == 0) revert NoClaimablePosition();

        uint256 balanceBefore = collateralToken.balanceOf(msg.sender);
        market.redeemCollateralWithToken(yesBalance, noBalance, msg.sender);
        payout = collateralToken.balanceOf(msg.sender) - balanceBefore;

        emit PredictionClaimed(marketKey, msg.sender, yesBalance, noBalance, payout);
    }

    function settleFromOracle(bytes32 marketKey) external nonReentrant {
        LvrMarket market = _getMarket(marketKey);
        market.settleFromOracle();

        (, , uint256 marketOutcome, , , , , ) = market.getMarketDetails();
        emit PredictionMarketSettled(marketKey, uint8(marketOutcome), marketOutcome == 2);
    }

    function getMarketAddress(bytes32 marketKey) external view returns (address) {
        return _getMarketAddress(marketKey);
    }

    function marketBuyCallback(uint256 collateralIn, bytes calldata data) external override onlyAllowedMarket {
        (address collateral, address buyer) = abi.decode(data, (address, address));
        IERC20(collateral).safeTransferFrom(buyer, msg.sender, collateralIn);
    }

    function marketSellCallback(uint256 tokenIn, bytes calldata data) external override onlyAllowedMarket {
        (address tokenToSell, address seller) = abi.decode(data, (address, address));
        if (tokenToSell == LvrMarket(msg.sender).getToken(true)) {
            YesToken(tokenToSell).operatorTransfer(seller, msg.sender, tokenIn);
            return;
        }
        if (tokenToSell == LvrMarket(msg.sender).getToken(false)) {
            NoToken(tokenToSell).operatorTransfer(seller, msg.sender, tokenIn);
            return;
        }
        IERC20(tokenToSell).safeTransferFrom(seller, msg.sender, tokenIn);
    }

    function marketRedeemCallback(uint256 amountYes, uint256 amountNo, bytes calldata data)
        external
        override
        onlyAllowedMarket
    {
        (address yesToken, address noToken, address redeemer) = abi.decode(data, (address, address, address));
        YesToken(yesToken).operatorTransfer(redeemer, msg.sender, amountYes);
        NoToken(noToken).operatorTransfer(redeemer, msg.sender, amountNo);
    }

    function marketBondCallback(uint256 bond, bytes calldata data) external override onlyAllowedMarket {
        (address collateral, address proposer) = abi.decode(data, (address, address));
        IERC20(collateral).safeTransferFrom(proposer, msg.sender, bond);
    }

    function _getMarket(bytes32 marketKey) internal view returns (LvrMarket market) {
        market = LvrMarket(_getMarketAddress(marketKey));
    }

    function _getMarketAddress(bytes32 marketKey) internal view returns (address marketAddress) {
        marketAddress = marketAddressByKey[marketKey];
        if (marketAddress == address(0)) revert UnknownMarket();
    }
}
