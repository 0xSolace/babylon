// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {IDiamondCut} from "../libraries/LibDiamond.sol";

/// @title DiamondCutFacet
/// @notice Facet for adding/replacing/removing functions
/// @dev Only the contract owner can perform diamond cuts
contract DiamondCutFacet is IDiamondCut {
    /// @notice Add/replace/remove any number of functions and optionally execute
    ///         a function with delegatecall
    /// @param facetCuts Contains the facet addresses and function selectors
    /// @param init The address of the contract or facet to execute initCalldata
    /// @param initCalldata A function call, including function selector and arguments
    ///                  initCalldata is executed with delegatecall on init
    function diamondCut(
        FacetCut[] calldata facetCuts,
        address init,
        bytes calldata initCalldata
    ) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.diamondCut(facetCuts, init, initCalldata);
    }
}
