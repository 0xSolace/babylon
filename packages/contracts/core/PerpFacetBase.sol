// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibPerpEngine} from "../libraries/LibPerpEngine.sol";

abstract contract PerpFacetBase {
    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    modifier onlyUpdater() {
        LibPerpEngine.enforceInitialized();
        require(msg.sender == LibPerpEngine.engineStorage().oracleUpdater, "PerpFacetBase: not updater");
        _;
    }

    modifier onlyFeeRecipientOrOwner() {
        LibPerpEngine.enforceInitialized();
        require(
            msg.sender == LibDiamond.contractOwner() ||
                msg.sender == LibPerpEngine.engineStorage().feeRecipient,
            "PerpFacetBase: not fee recipient"
        );
        _;
    }

    modifier nonReentrant() {
        LibPerpEngine.enter();
        _;
        LibPerpEngine.exit();
    }
}
