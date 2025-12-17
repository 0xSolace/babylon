// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {BBLNToken} from "../src/BBLNToken.sol";
import {BBLNPresale} from "../src/BBLNPresale.sol";

/**
 * @title DeployBBLNPresale
 * @notice Deploy BBLN token and presale with full ICO automation
 *
 * Features:
 *   - Deploys BBLNToken with proper allocations
 *   - Deploys BBLNPresale with CCA auction mechanics
 *   - Configures ELIZA holder bonus (50%)
 *   - Sets up LP infrastructure integration
 *   - Configures presale timeline
 *
 * Usage:
 *   # Local devnet
 *   forge script script/DeployBBLNPresale.s.sol:DeployBBLNPresale --rpc-url http://localhost:8545 --broadcast
 *
 *   # Sepolia testnet
 *   forge script script/DeployBBLNPresale.s.sol:DeployBBLNPresale --rpc-url $SEPOLIA_RPC --broadcast --verify
 *
 *   # Ethereum mainnet
 *   forge script script/DeployBBLNPresale.s.sol:DeployBBLNPresale --rpc-url $ETH_RPC --broadcast --verify
 *
 * Environment Variables:
 *   - DEPLOYER_KEY: Private key for deployment
 *   - TREASURY: Treasury address (defaults to deployer)
 *   - ELIZA_TOKEN: ELIZA token address for bonus verification
 *   - XLP_FACTORY: XLP V2 Factory address for LP creation
 *   - LP_LOCKER: LP Locker address for locking LP tokens
 *   - WETH: WETH address for LP pairing
 *   - DEV_MODE: Set to 1 to start presale immediately
 */
contract DeployBBLNPresale is Script {
    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    // Token allocation
    uint256 constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18; // 1B BBLN
    uint256 constant TOKENS_FOR_SALE = 100_000_000 * 10 ** 18; // 100M (10%)
    uint256 constant TOKENS_FOR_AIRDROP = 100_000_000 * 10 ** 18; // 100M (10%)
    uint256 constant TOKENS_FOR_LIQUIDITY = 100_000_000 * 10 ** 18; // 100M (10%)
    uint256 constant TOKENS_FOR_TREASURY = 500_000_000 * 10 ** 18; // 500M (50%)
    uint256 constant TOKENS_FOR_TEAM = 200_000_000 * 10 ** 18; // 200M (20%)

    // Presale configuration
    uint256 constant SOFT_CAP = 500 ether;
    uint256 constant HARD_CAP = 5000 ether;
    uint256 constant MIN_CONTRIBUTION = 0.1 ether;
    uint256 constant MAX_CONTRIBUTION = 100 ether;

    // CCA Auction pricing
    uint256 constant START_PRICE = 0.00005 ether; // $0.18 at $3600/ETH
    uint256 constant RESERVE_PRICE = 0.00001 ether; // Floor price
    uint256 constant PRICE_DECAY_PER_SECOND = 1e12;

    // LP configuration
    uint256 constant LP_FUNDING_BPS = 2000; // 20% of raised ETH to LP
    uint256 constant LP_LOCK_DURATION = 180 days;

    // ELIZA bonus
    uint256 constant ELIZA_MIN_BALANCE = 1000 * 10 ** 18; // 1000 ELIZA
    uint256 constant ELIZA_BONUS_BPS = 5000; // 50% bonus

    // Timeline
    uint256 constant PRESALE_DURATION = 7 days;
    uint256 constant CLAIM_DELAY = 1 days;

    // =========================================================================
    // DEPLOYMENT
    // =========================================================================

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(deployerKey);
        address treasury = vm.envOr("TREASURY", deployer);

        // ELIZA token addresses
        address elizaToken = vm.envOr("ELIZA_TOKEN", address(0));

        // LP infrastructure (can be set later if not available)
        address xlpFactory = vm.envOr("XLP_FACTORY", address(0));
        address lpLocker = vm.envOr("LP_LOCKER", address(0));
        address weth = vm.envOr("WETH", address(0));

        // Check dev mode
        bool devMode = vm.envOr("DEV_MODE", uint256(0)) == 1;

        console2.log("=== BBLN ICO Deployment ===");
        console2.log("Deployer:", deployer);
        console2.log("Treasury:", treasury);
        console2.log("Chain ID:", block.chainid);
        console2.log("Dev Mode:", devMode);
        console2.log("");

        vm.startBroadcast(deployerKey);

        // =====================================================================
        // 1. Deploy BBLN Token
        // =====================================================================
        BBLNToken token = new BBLNToken(deployer);
        console2.log("BBLN Token deployed:", address(token));
        console2.log("  Total Supply:", token.totalSupply() / 1e18, "BBLN");

        // Configure token fees and limits (max total 25%)
        // Fee structure: 2% holders, 2% treasury, 0.5% burn = 4.5% total
        token.setFees(
            0, // creator fee
            200, // 2% to holders/LPs
            200, // 2% to treasury
            50, // 0.5% burn
            50, // 0.5% bridge/LP fee
            address(0), // no creator
            xlpFactory != address(0) ? xlpFactory : deployer, // LP pool
            treasury
        );

        token.setConfig(
            200, // 2% max wallet
            100, // 1% max tx
            true, // ban enforcement enabled
            false, // not paused
            devMode // faucet enabled in dev mode
        );
        console2.log("  Token configured");

        // =====================================================================
        // 2. Deploy BBLNPresale
        // =====================================================================
        BBLNPresale presale = new BBLNPresale(
            address(token),
            elizaToken,
            treasury,
            deployer
        );
        console2.log("");
        console2.log("BBLNPresale deployed:", address(presale));

        // =====================================================================
        // 3. Configure Presale
        // =====================================================================
        presale.configure(
            TOKENS_FOR_SALE,
            SOFT_CAP,
            HARD_CAP,
            MIN_CONTRIBUTION,
            MAX_CONTRIBUTION,
            START_PRICE,
            RESERVE_PRICE,
            PRICE_DECAY_PER_SECOND,
            LP_FUNDING_BPS,
            LP_LOCK_DURATION
        );
        console2.log("  Presale configured");

        // Configure ELIZA bonus
        if (elizaToken != address(0)) {
            presale.setElizaBonus(ELIZA_MIN_BALANCE, ELIZA_BONUS_BPS);
            console2.log("  ELIZA bonus configured:", ELIZA_BONUS_BPS / 100, "%");
        }

        // Configure LP infrastructure if available
        if (xlpFactory != address(0) && lpLocker != address(0) && weth != address(0)) {
            presale.setLPInfrastructure(xlpFactory, lpLocker, weth);
            console2.log("  LP infrastructure configured");
        }

        // =====================================================================
        // 4. Exempt presale and treasury from limits
        // =====================================================================
        token.setLimitExempt(address(presale), true);
        token.setFeeExempt(address(presale), true);
        token.setLimitExempt(treasury, true);
        token.setFeeExempt(treasury, true);
        console2.log("  Limit exemptions configured");

        // =====================================================================
        // 5. Transfer tokens to presale
        // =====================================================================
        token.transfer(address(presale), TOKENS_FOR_SALE);
        console2.log("");
        console2.log("Transferred", TOKENS_FOR_SALE / 1e18, "BBLN to presale");

        // =====================================================================
        // 6. Allocate remaining tokens
        // =====================================================================

        // Treasury allocation
        token.transfer(treasury, TOKENS_FOR_TREASURY);
        console2.log("Transferred", TOKENS_FOR_TREASURY / 1e18, "BBLN to treasury");

        // Team allocation (to deployer, to be distributed via vesting)
        // Note: In production, this would go to a vesting contract
        console2.log("Team allocation:", TOKENS_FOR_TEAM / 1e18, "BBLN (in deployer)");

        // Liquidity allocation (to deployer, to be added to LP at TGE)
        console2.log("Liquidity allocation:", TOKENS_FOR_LIQUIDITY / 1e18, "BBLN (in deployer)");

        // Airdrop allocation (to deployer, to be transferred to airdrop contract)
        console2.log("Airdrop allocation:", TOKENS_FOR_AIRDROP / 1e18, "BBLN (in deployer)");

        // =====================================================================
        // 7. Start presale (in dev mode)
        // =====================================================================
        if (devMode) {
            presale.startPresaleNow();
            console2.log("");
            console2.log("Presale started (dev mode)");
        }

        vm.stopBroadcast();

        // =====================================================================
        // Summary
        // =====================================================================
        console2.log("");
        console2.log("=== Deployment Summary ===");
        console2.log("BBLN Token:", address(token));
        console2.log("BBLNPresale:", address(presale));
        console2.log("Treasury:", treasury);
        console2.log("");
        console2.log("Presale Configuration:");
        console2.log("  Tokens for Sale:", TOKENS_FOR_SALE / 1e18);
        console2.log("  Soft Cap:", SOFT_CAP / 1e18, "ETH");
        console2.log("  Hard Cap:", HARD_CAP / 1e18, "ETH");
        console2.log("  Min Contribution:", MIN_CONTRIBUTION / 1e18, "ETH");
        console2.log("  Max Contribution:", MAX_CONTRIBUTION / 1e18, "ETH");
        console2.log("  LP Funding:", LP_FUNDING_BPS / 100, "%");
        console2.log("  ELIZA Bonus:", ELIZA_BONUS_BPS / 100, "%");
        console2.log("");

        if (!devMode) {
            console2.log("Next steps:");
            console2.log("  1. Set LP infrastructure: presale.setLPInfrastructure(...)");
            console2.log("  2. Start presale: presale.startPresale(duration, claimDelay)");
            console2.log("  3. After presale ends: presale.finalize()");
        }

        console2.log("");
        console2.log("Update addresses in:");
        console2.log("  - packages/shared/src/contracts/bbln.ts");
        console2.log("  - apps/web/src/app/launch/page.tsx");
    }
}

