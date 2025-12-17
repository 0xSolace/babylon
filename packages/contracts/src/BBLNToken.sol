// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Token} from "@jeju/contracts/tokens/Token.sol";

/**
 * @title BBLNToken
 * @author Babylon Labs
 * @notice The official Babylon (BBLN) token deployed on Ethereum mainnet
 * @dev Inherits from Jeju's canonical Token contract with BBLN-specific configuration
 *
 * Features inherited from Token:
 * - ERC20 with Permit (EIP-2612)
 * - EIP-3009 gasless transfers
 * - Trading fees (creator, holder, treasury, burn)
 * - Cross-chain via Hyperlane
 * - Ban enforcement
 * - Anti-whale limits
 *
 * Configuration: After deployment, owner must call setFees() and setConfig()
 * - Fees: 0% creator, 80% holder (XLP), 10% treasury, 10% burn
 * - Limits: 2% max wallet, 1% max tx for anti-whale
 */
contract BBLNToken is Token {
    // ═══════════════════════════════════════════════════════════════════════════
    //                              CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion

    // Allocation
    uint256 public constant BABYLON_LABS_ALLOCATION = 200_000_000 * 10 ** 18; // 20%
    uint256 public constant PUBLIC_SALE_ALLOCATION = 100_000_000 * 10 ** 18; // 10%
    uint256 public constant AIRDROP_ALLOCATION = 100_000_000 * 10 ** 18; // 10%
    uint256 public constant LIQUIDITY_ALLOCATION = 100_000_000 * 10 ** 18; // 10%
    uint256 public constant TREASURY_ALLOCATION = 500_000_000 * 10 ** 18; // 50%

    // ═══════════════════════════════════════════════════════════════════════════
    //                              CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Deploy BBLN token
     * @dev After deployment, owner must call setFees() and setConfig() to configure the token
     * @param owner Initial owner address (Babylon Labs multisig)
     */
    constructor(address owner)
        Token("Babylon", "BBLN", TOTAL_SUPPLY, owner, TOTAL_SUPPLY, true)
    {
        // Token is deployed with default settings
        // Owner must call setFees() and setConfig() post-deployment
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //                              VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get deflation stats for analytics
     */
    function getDeflationaryStats()
        external
        view
        returns (uint256 burned, uint256 xlpFees, uint256 protocolFees, uint256 burnRate)
    {
        burned = totalBurned;
        xlpFees = totalFeesCollected * 80 / 100;
        protocolFees = totalFeesCollected * 10 / 100;
        burnRate = totalSupply() > 0 ? (totalBurned * 10000) / TOTAL_SUPPLY : 0;
    }
}
