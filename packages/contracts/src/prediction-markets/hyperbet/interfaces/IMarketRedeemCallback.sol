// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

interface IMarketRedeemCallback {
    function marketRedeemCallback(uint256 amountYes, uint256 amountNo, bytes calldata data) external;
}
