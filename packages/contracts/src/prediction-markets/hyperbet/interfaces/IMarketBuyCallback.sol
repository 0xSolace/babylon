// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

interface IMarketBuyCallback {
    function marketBuyCallback(uint256 collateralIn, bytes calldata data) external;
}
