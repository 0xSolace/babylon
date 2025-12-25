// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import "forge-std/Script.sol";
import "../src/BBLNToken.sol";
import "../src/BabylonTreasury.sol";
import "../src/BabylonAgentVault.sol";
import "../src/BabylonDAO.sol";
import "../src/TrainingOrchestrator.sol";

/**
 * @title DeployAll
 * @notice Deployment script for all Babylon contracts
 * @dev Run with: forge script script/DeployAll.s.sol --rpc-url $RPC_URL --broadcast
 *
 * Environment variables:
 * - PRIVATE_KEY: Deployer private key
 * - OWNER_ADDRESS: Owner address for contracts (defaults to deployer)
 * - AI_CEO_ADDRESS: AI CEO address (optional, defaults to owner)
 */
contract DeployAll is Script {
    // Deployed contract instances
    BBLNToken public token;
    BabylonTreasury public treasury;
    BabylonAgentVault public vault;
    BabylonDAO public dao;
    TrainingOrchestrator public training;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address owner = vm.envOr("OWNER_ADDRESS", deployer);
        address aiCeo = vm.envOr("AI_CEO_ADDRESS", owner);

        console.log("=== Babylon Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Owner:", owner);
        console.log("AI CEO:", aiCeo);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy BBLNToken
        console.log("1. Deploying BBLNToken...");
        token = new BBLNToken(owner);
        console.log("   BBLNToken:", address(token));

        // 2. Deploy BabylonTreasury
        console.log("2. Deploying BabylonTreasury...");
        treasury = new BabylonTreasury(owner);
        console.log("   BabylonTreasury:", address(treasury));

        // 3. Deploy BabylonAgentVault
        console.log("3. Deploying BabylonAgentVault...");
        vault = new BabylonAgentVault(address(treasury), owner);
        console.log("   BabylonAgentVault:", address(vault));

        // 4. Deploy BabylonDAO
        console.log("4. Deploying BabylonDAO...");
        dao = new BabylonDAO(address(treasury), address(vault), aiCeo);
        console.log("   BabylonDAO:", address(dao));

        // 5. Deploy TrainingOrchestrator
        console.log("5. Deploying TrainingOrchestrator...");
        training = new TrainingOrchestrator(address(dao), address(vault));
        console.log("   TrainingOrchestrator:", address(training));

        // 6. Set up cross-references
        console.log("6. Setting up cross-references...");
        treasury.setDAO(address(dao));
        console.log("   - Treasury DAO set");

        vault.setDAO(address(dao));
        console.log("   - Vault DAO set");

        treasury.approveVault(address(vault));
        console.log("   - Vault approved in Treasury");

        vm.stopBroadcast();

        // Print deployment summary
        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("BBLNToken:", address(token));
        console.log("BabylonTreasury:", address(treasury));
        console.log("BabylonAgentVault:", address(vault));
        console.log("BabylonDAO:", address(dao));
        console.log("TrainingOrchestrator:", address(training));
        console.log("");

        // Output JSON for easy parsing
        console.log("=== JSON Output ===");
        console.log("{");
        console.log('  "network": "%s",', _getNetworkName());
        console.log('  "chainId": %s,', block.chainid);
        console.log('  "deployer": "%s",', deployer);
        console.log('  "contracts": {');
        console.log('    "BBLNToken": "%s",', address(token));
        console.log('    "BabylonTreasury": "%s",', address(treasury));
        console.log('    "BabylonAgentVault": "%s",', address(vault));
        console.log('    "BabylonDAO": "%s",', address(dao));
        console.log('    "TrainingOrchestrator": "%s"', address(training));
        console.log("  }");
        console.log("}");
    }

    function _getNetworkName() internal view returns (string memory) {
        if (block.chainid == 1) return "ethereum";
        if (block.chainid == 11155111) return "sepolia";
        if (block.chainid == 8453) return "base";
        if (block.chainid == 84532) return "base-sepolia";
        if (block.chainid == 420690) return "jeju-testnet";
        if (block.chainid == 420691) return "jeju-mainnet";
        if (block.chainid == 31337) return "localnet";
        if (block.chainid == 31337) return "anvil";
        return "unknown";
    }
}

/**
 * @title DeployBBLNToken
 * @notice Deploy only BBLNToken
 */
contract DeployBBLNToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER_ADDRESS", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);
        BBLNToken token = new BBLNToken(owner);
        vm.stopBroadcast();

        console.log("BBLNToken deployed:", address(token));
    }
}

/**
 * @title DeployBabylonDAO
 * @notice Deploy DAO with existing treasury and vault
 */
contract DeployBabylonDAO is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address vault = vm.envAddress("VAULT_ADDRESS");
        address aiCeo = vm.envOr("AI_CEO_ADDRESS", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);
        BabylonDAO dao = new BabylonDAO(treasury, vault, aiCeo);
        vm.stopBroadcast();

        console.log("BabylonDAO deployed:", address(dao));
    }
}
