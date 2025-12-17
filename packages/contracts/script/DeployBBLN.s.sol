// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {BBLNToken} from "../src/BBLNToken.sol";
import {Presale} from "@jeju/contracts/tokens/Presale.sol";

/**
 * @title DeployBBLN
 * @notice Deploy BBLN token and presale contracts
 *
 * Usage:
 *   # Sepolia testnet
 *   forge script script/DeployBBLN.s.sol:DeployBBLN --rpc-url $SEPOLIA_RPC --broadcast --verify
 *
 *   # Ethereum mainnet
 *   forge script script/DeployBBLN.s.sol:DeployBBLN --rpc-url $ETH_RPC --broadcast --verify
 */
contract DeployBBLN is Script {
    // Presale configuration
    uint256 constant TOKENS_FOR_SALE = 100_000_000 * 10 ** 18; // 100M BBLN (10%)
    uint256 constant SOFT_CAP = 500 ether;
    uint256 constant HARD_CAP = 5000 ether;
    uint256 constant MIN_BID = 0.1 ether;
    uint256 constant MAX_BID = 1000 ether;

    // CCA Auction pricing
    uint256 constant START_PRICE = 0.01 ether; // Start at 0.01 ETH per token
    uint256 constant RESERVE_PRICE = 0.0005 ether; // Floor at 0.0005 ETH per token
    uint256 constant PRICE_DECAY_PER_SECOND = 1e12; // ~86.4 ETH per day decay

    // Timeline (relative to deployment)
    uint256 constant EARLY_BIRD_DURATION = 2 days;
    uint256 constant AUCTION_DURATION = 7 days;
    uint256 constant TGE_DELAY = 1 days;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(deployerKey);
        address treasury = vm.envOr("TREASURY", deployer);
        address xlpPool = vm.envOr("XLP_POOL", deployer);

        console2.log("=== BBLN Token Deployment ===");
        console2.log("Deployer:", deployer);
        console2.log("Treasury:", treasury);
        console2.log("XLP Pool:", xlpPool);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);

        // 1. Deploy BBLN Token
        BBLNToken token = new BBLNToken(deployer);
        console2.log("\nBBLN Token deployed:", address(token));
        console2.log("  Total Supply:", token.totalSupply() / 1e18, "BBLN");

        // 2. Configure BBLN token fees and limits
        token.setFees(
            0, // creator fee
            8000, // 80% to holders/LPs
            1000, // 10% to treasury
            1000, // 10% burn
            50, // 0.5% bridge/LP fee
            address(0), // no creator
            xlpPool,
            treasury
        );

        token.setConfig(
            200, // 2% max wallet
            100, // 1% max tx
            true, // ban enforcement enabled
            false, // not paused
            false // no faucet on mainnet
        );
        console2.log("  Fees and limits configured");

        // 3. Deploy Presale (CCA Auction)
        Presale presale = new Presale(address(token), treasury, deployer);
        console2.log("\nPresale deployed:", address(presale));

        // 3. Configure Presale as CCA Auction
        uint256 whitelistStart = block.timestamp + 1 hours;
        uint256 publicStart = whitelistStart + EARLY_BIRD_DURATION;
        uint256 presaleEnd = publicStart + AUCTION_DURATION;
        uint256 tgeTimestamp = presaleEnd + TGE_DELAY;

        presale.configure(
            Presale.PresaleMode.CCA_AUCTION,
            TOKENS_FOR_SALE,
            SOFT_CAP,
            HARD_CAP,
            MIN_BID,
            MAX_BID,
            0, // token price (unused for CCA)
            START_PRICE,
            RESERVE_PRICE,
            PRICE_DECAY_PER_SECOND,
            whitelistStart,
            publicStart,
            presaleEnd,
            tgeTimestamp
        );

        // 4. Configure vesting: 100% liquid at TGE
        presale.setVesting(10000, 0, 0);

        // 5. Configure bonuses: ELIZA holder 50% bonus
        address elizaToken = vm.envOr("ELIZA_TOKEN", address(0));
        presale.setBonuses(
            0, // no whitelist bonus
            5000, // 50% ELIZA holder bonus
            100, // 1% for 1 ETH
            300, // 3% for 5 ETH
            500, // 5% for 10 ETH
            elizaToken,
            1000 * 10 ** 18 // 1000 ELIZA minimum
        );

        // 6. Transfer presale tokens
        token.transfer(address(presale), TOKENS_FOR_SALE);
        console2.log("\nTransferred", TOKENS_FOR_SALE / 1e18, "BBLN to presale");

        vm.stopBroadcast();

        // Summary
        console2.log("\n=== Deployment Summary ===");
        console2.log("BBLN Token:", address(token));
        console2.log("Presale:", address(presale));
        console2.log("");
        console2.log("Presale Timeline:");
        console2.log("  Whitelist Start:", whitelistStart);
        console2.log("  Public Start:", publicStart);
        console2.log("  Presale End:", presaleEnd);
        console2.log("  TGE:", tgeTimestamp);
        console2.log("");
        console2.log("Update addresses in:");
        console2.log("  - vendor/babylon/packages/shared/src/contracts/bbln.ts");
        console2.log("  - apps/bazaar/components/ico/BBLNPresaleCard.tsx");
    }
}
