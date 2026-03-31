// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/******************************************************************************\
* Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
* EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535
* Implementation: https://github.com/mudgen/diamond-3
\******************************************************************************/

library LibDiamond {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.diamond.storage");

    struct FacetAddressAndPosition {
        address facetAddress;
        uint96 functionSelectorPosition; // position in facetFunctionSelectors.functionSelectors array
    }

    struct FacetFunctionSelectors {
        bytes4[] functionSelectors;
        uint256 facetAddressPosition; // position of facetAddress in facetAddresses array
    }

    struct DiamondStorage {
        // maps function selector to the facet address and
        // the position of the selector in the facetFunctionSelectors.selectors array
        mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition;
        // maps facet addresses to function selectors
        mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
        // facet addresses
        address[] facetAddresses;
        // Used to query if a contract implements an interface.
        // Used to implement ERC-165.
        mapping(bytes4 => bool) supportedInterfaces;
        // owner of the contract
        address contractOwner;
    }

    // slither-disable-start assembly
    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
    // slither-disable-end assembly

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setContractOwner(address newOwner) internal {
        DiamondStorage storage ds = diamondStorage();
        address previousOwner = ds.contractOwner;
        ds.contractOwner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function contractOwner() internal view returns (address contractOwner_) {
        contractOwner_ = diamondStorage().contractOwner;
    }

    function enforceIsContractOwner() internal view {
        require(msg.sender == diamondStorage().contractOwner, "LibDiamond: Must be contract owner");
    }

    event DiamondCut(IDiamondCut.FacetCut[] diamondCut_, address init, bytes initCalldata);

    // Internal function version of diamondCut
    function diamondCut(
        IDiamondCut.FacetCut[] memory facetCuts,
        address init,
        bytes memory initCalldata
    ) internal {
        for (uint256 facetIndex; facetIndex < facetCuts.length; facetIndex++) {
            IDiamondCut.FacetCutAction action = facetCuts[facetIndex].action;
            if (action == IDiamondCut.FacetCutAction.Add) {
                addFunctions(facetCuts[facetIndex].facetAddress, facetCuts[facetIndex].functionSelectors);
            } else if (action == IDiamondCut.FacetCutAction.Replace) {
                replaceFunctions(facetCuts[facetIndex].facetAddress, facetCuts[facetIndex].functionSelectors);
            } else if (action == IDiamondCut.FacetCutAction.Remove) {
                removeFunctions(facetCuts[facetIndex].facetAddress, facetCuts[facetIndex].functionSelectors);
            } else {
                revert("LibDiamondCut: Incorrect FacetCutAction");
            }
        }
        emit DiamondCut(facetCuts, init, initCalldata);
        initializeDiamondCut(init, initCalldata);
    }

    function addFunctions(address facetAddress, bytes4[] memory functionSelectors) internal {
        require(functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");
        DiamondStorage storage ds = diamondStorage();
        require(facetAddress != address(0), "LibDiamondCut: Add facet can't be address(0)");
        uint96 selectorPosition = uint96(ds.facetFunctionSelectors[facetAddress].functionSelectors.length);
        // add new facet address if it does not exist
        if (selectorPosition == 0) {
            addFacet(ds, facetAddress);
        }
        for (uint256 selectorIndex; selectorIndex < functionSelectors.length; selectorIndex++) {
            bytes4 selector = functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
            require(oldFacetAddress == address(0), "LibDiamondCut: Can't add function that already exists");
            addFunction(ds, selector, selectorPosition, facetAddress);
            selectorPosition++;
        }
    }

    function replaceFunctions(address facetAddress, bytes4[] memory functionSelectors) internal {
        require(functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");
        DiamondStorage storage ds = diamondStorage();
        require(facetAddress != address(0), "LibDiamondCut: Add facet can't be address(0)");
        uint96 selectorPosition = uint96(ds.facetFunctionSelectors[facetAddress].functionSelectors.length);
        // add new facet address if it does not exist
        if (selectorPosition == 0) {
            addFacet(ds, facetAddress);
        }
        for (uint256 selectorIndex; selectorIndex < functionSelectors.length; selectorIndex++) {
            bytes4 selector = functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
            require(oldFacetAddress != facetAddress, "LibDiamondCut: Can't replace function with same function");
            removeFunction(ds, oldFacetAddress, selector);
            addFunction(ds, selector, selectorPosition, facetAddress);
            selectorPosition++;
        }
    }

    function removeFunctions(address facetAddress, bytes4[] memory functionSelectors) internal {
        require(functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");
        DiamondStorage storage ds = diamondStorage();
        // if function does not exist then do nothing and return
        require(facetAddress == address(0), "LibDiamondCut: Remove facet address must be address(0)");
        for (uint256 selectorIndex; selectorIndex < functionSelectors.length; selectorIndex++) {
            bytes4 selector = functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
            removeFunction(ds, oldFacetAddress, selector);
        }
    }

    function addFacet(DiamondStorage storage ds, address facetAddress) internal {
        enforceHasContractCode(facetAddress, "LibDiamondCut: New facet has no code");
        ds.facetFunctionSelectors[facetAddress].facetAddressPosition = ds.facetAddresses.length;
        ds.facetAddresses.push(facetAddress);
    }

    function addFunction(
        DiamondStorage storage ds,
        bytes4 selector,
        uint96 selectorPosition,
        address facetAddress
    ) internal {
        ds.selectorToFacetAndPosition[selector].functionSelectorPosition = selectorPosition;
        ds.facetFunctionSelectors[facetAddress].functionSelectors.push(selector);
        ds.selectorToFacetAndPosition[selector].facetAddress = facetAddress;
    }

    function removeFunction(DiamondStorage storage ds, address facetAddress, bytes4 selector) internal {
        require(facetAddress != address(0), "LibDiamondCut: Can't remove function that doesn't exist");
        // an immutable function is a function defined directly in a diamond
        require(facetAddress != address(this), "LibDiamondCut: Can't remove immutable function");
        uint256 selectorPosition = ds.selectorToFacetAndPosition[selector].functionSelectorPosition;
        uint256 lastSelectorPosition = ds.facetFunctionSelectors[facetAddress].functionSelectors.length - 1;
        if (selectorPosition != lastSelectorPosition) {
            bytes4 lastSelector = ds.facetFunctionSelectors[facetAddress].functionSelectors[lastSelectorPosition];
            ds.facetFunctionSelectors[facetAddress].functionSelectors[selectorPosition] = lastSelector;
            ds.selectorToFacetAndPosition[lastSelector].functionSelectorPosition = uint96(selectorPosition);
        }
        ds.facetFunctionSelectors[facetAddress].functionSelectors.pop();
        delete ds.selectorToFacetAndPosition[selector];

        // if no more selectors for facet address then delete the facet address
        if (lastSelectorPosition == 0) {
            uint256 lastFacetAddressPosition = ds.facetAddresses.length - 1;
            uint256 facetAddressPosition = ds.facetFunctionSelectors[facetAddress].facetAddressPosition;
            if (facetAddressPosition != lastFacetAddressPosition) {
                address lastFacetAddress = ds.facetAddresses[lastFacetAddressPosition];
                ds.facetAddresses[facetAddressPosition] = lastFacetAddress;
                ds.facetFunctionSelectors[lastFacetAddress].facetAddressPosition = facetAddressPosition;
            }
            ds.facetAddresses.pop();
            delete ds.facetFunctionSelectors[facetAddress].facetAddressPosition;
        }
    }

    // slither-disable-start low-level-calls
    function initializeDiamondCut(address init, bytes memory initCalldata) internal {
        if (init == address(0)) {
            require(initCalldata.length == 0, "LibDiamondCut: _init is address(0) but_calldata is not empty");
        } else {
            require(initCalldata.length > 0, "LibDiamondCut: _calldata is empty but _init is not address(0)");
            if (init != address(this)) {
                enforceHasContractCode(init, "LibDiamondCut: _init address has no code");
            }
            (bool success, bytes memory error) = init.delegatecall(initCalldata);
            if (!success) {
                if (error.length > 0) {
                    // bubble up the error
                    revert(string(error));
                } else {
                    revert("LibDiamondCut: _init function reverted");
                }
            }
        }
    }
    // slither-disable-end low-level-calls

    // slither-disable-start assembly
    function enforceHasContractCode(address contractAddress, string memory errorMessage) internal view {
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(contractAddress)
        }
        require(contractSize > 0, errorMessage);
    }
    // slither-disable-end assembly
}

interface IDiamondCut {
    enum FacetCutAction {Add, Replace, Remove}

    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }

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
    ) external;

    event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);
}
