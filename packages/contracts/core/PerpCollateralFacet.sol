// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {LibPerpEngine} from "../libraries/LibPerpEngine.sol";
import {PerpFacetBase} from "./PerpFacetBase.sol";

contract PerpCollateralFacet is PerpFacetBase {
    function depositPerpCollateral(uint256 rawAmount) external nonReentrant {
        LibPerpEngine.enforceInitialized();
        LibPerpEngine.deposit(rawAmount);
    }

    function withdrawPerpCollateral(uint256 rawAmount) external nonReentrant {
        LibPerpEngine.enforceInitialized();
        LibPerpEngine.withdraw(msg.sender, rawAmount);
    }

    function addPerpLiquidity(bytes32 marketId, uint256 rawAmount) external nonReentrant returns (uint256 shares) {
        LibPerpEngine.enforceInitialized();
        return LibPerpEngine.addLiquidity(msg.sender, marketId, rawAmount);
    }

    function removePerpLiquidity(bytes32 marketId, uint256 shares) external nonReentrant returns (uint256 assets) {
        LibPerpEngine.enforceInitialized();
        return LibPerpEngine.removeLiquidity(msg.sender, marketId, shares);
    }

    function addPerpPositionCollateral(bytes32 marketId, uint256 rawAmount) external nonReentrant {
        LibPerpEngine.enforceInitialized();
        LibPerpEngine.addPositionCollateral(msg.sender, marketId, rawAmount);
    }

    function removePerpPositionCollateral(bytes32 marketId, uint256 rawAmount) external nonReentrant {
        LibPerpEngine.enforceInitialized();
        LibPerpEngine.removePositionCollateral(msg.sender, marketId, rawAmount);
    }

    function claimPerpProtocolFees(bytes32 marketId, address to, uint256 rawAmount)
        external
        onlyFeeRecipientOrOwner
        nonReentrant
    {
        LibPerpEngine.claimProtocolFees(marketId, to, rawAmount);
    }
}
