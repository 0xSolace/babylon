// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {BabylonDAO} from "../src/dao/BabylonDAO.sol";
import {BabylonAgentVault} from "../src/dao/BabylonAgentVault.sol";
import {BabylonTreasury} from "../src/dao/BabylonTreasury.sol";
import {TrainingOrchestrator} from "../src/training/TrainingOrchestrator.sol";
import {BBLNToken} from "../src/BBLNToken.sol";

/**
 * @title DeployDAO
 * @notice Deploy Babylon DAO infrastructure
 *
 * Usage:
 *   # Localnet
 *   forge script script/DeployDAO.s.sol:DeployDAO --rpc-url http://localhost:8545 --broadcast
 *
 *   # Testnet
 *   forge script script/DeployDAO.s.sol:DeployDAO --rpc-url $TESTNET_RPC --broadcast --verify
 */
contract DeployDAO is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(deployerKey);
        
        // AI CEO address (TEE-derived or placeholder for dev)
        address aiCEO = vm.envOr("AI_CEO_ADDRESS", deployer);
        uint256 aiCEOAgentId = vm.envOr("AI_CEO_AGENT_ID", uint256(1));
        
        // Existing contracts (optional)
        address bblnToken = vm.envOr("BBLN_TOKEN", address(0));
        address modelRegistry = vm.envOr("MODEL_REGISTRY", address(0));

        console2.log("=== Babylon DAO Deployment ===");
        console2.log("Deployer:", deployer);
        console2.log("AI CEO:", aiCEO);
        console2.log("AI CEO Agent ID:", aiCEOAgentId);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);

        // 1. Deploy Treasury first (no dependencies)
        BabylonTreasury treasury = new BabylonTreasury(
            deployer,    // DAO placeholder (will update)
            bblnToken,   // BBLN token (can be zero)
            deployer     // Initial owner
        );
        console2.log("\nTreasury deployed:", address(treasury));

        // 2. Deploy Agent Vault
        BabylonAgentVault vault = new BabylonAgentVault(
            deployer,    // DAO placeholder
            aiCEO,       // AI CEO
            address(treasury),
            deployer     // Initial owner
        );
        console2.log("Agent Vault deployed:", address(vault));

        // 3. Deploy DAO
        BabylonDAO dao = new BabylonDAO(
            aiCEO,
            aiCEOAgentId,
            address(treasury),
            address(vault),
            deployer     // Initial owner
        );
        console2.log("DAO deployed:", address(dao));

        // 4. Deploy Training Orchestrator
        TrainingOrchestrator training = new TrainingOrchestrator(
            address(dao),
            aiCEO,
            address(vault),
            modelRegistry,
            deployer     // Initial owner
        );
        console2.log("Training Orchestrator deployed:", address(training));

        // 5. Update references
        treasury.setDAO(address(dao));
        vault.setDAO(address(dao));

        // 6. Approve vault for auto-funding from treasury
        treasury.approveVault(address(vault), 1 ether);

        // 7. Add council members (initial - deployer for dev)
        dao.addCouncilMember(deployer, "Founder");

        // 8. Fund vault for initial operations
        if (deployer.balance > 0.5 ether) {
            vault.deposit{value: 0.1 ether}();
            console2.log("Vault funded with 0.1 ETH");
        }

        vm.stopBroadcast();

        // Summary
        console2.log("\n=== Deployment Summary ===");
        console2.log("BabylonDAO:", address(dao));
        console2.log("BabylonTreasury:", address(treasury));
        console2.log("BabylonAgentVault:", address(vault));
        console2.log("TrainingOrchestrator:", address(training));
        console2.log("");
        console2.log("AI CEO Address:", aiCEO);
        console2.log("AI CEO Agent ID:", aiCEOAgentId);
        console2.log("");
        console2.log("Update addresses in:");
        console2.log("  - vendor/babylon/packages/shared/src/contracts/dao.ts");
    }
}


