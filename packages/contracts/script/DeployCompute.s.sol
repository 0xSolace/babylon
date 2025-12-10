// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

// Import from Jeju Network contracts
import {ComputeRegistry} from "@jeju/contracts/compute/ComputeRegistry.sol";
import {LedgerManager} from "@jeju/contracts/compute/LedgerManager.sol";
import {InferenceServing} from "@jeju/contracts/compute/InferenceServing.sol";
import {ComputeStaking} from "@jeju/contracts/compute/ComputeStaking.sol";
import {BanManager} from "@jeju/contracts/moderation/BanManager.sol";

/**
 * @title DeployCompute
 * @notice Deploys Compute Marketplace contracts using Jeju Network implementations
 * @dev Run with: forge script script/DeployCompute.s.sol --rpc-url $RPC_URL --broadcast
 */
contract DeployCompute is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying Compute Marketplace (using Jeju contracts)");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Jeju BanManager first (used by ComputeStaking)
        BanManager banManager = new BanManager(deployer, deployer); // governance, owner
        console.log("BanManager deployed at:", address(banManager));

        // Deploy Jeju ComputeRegistry
        ComputeRegistry registry = new ComputeRegistry(deployer);
        console.log("ComputeRegistry deployed at:", address(registry));

        // Deploy Jeju LedgerManager
        LedgerManager ledger = new LedgerManager(address(registry), deployer);
        console.log("LedgerManager deployed at:", address(ledger));

        // Deploy Jeju InferenceServing
        InferenceServing inference = new InferenceServing(address(registry), address(ledger), deployer);
        console.log("InferenceServing deployed at:", address(inference));

        // Authorize InferenceServing to call LedgerManager.processSettlement
        ledger.setInferenceContract(address(inference));
        console.log("InferenceServing authorized on LedgerManager");

        // Deploy Jeju ComputeStaking
        ComputeStaking staking = new ComputeStaking(address(banManager), deployer);
        console.log("ComputeStaking deployed at:", address(staking));

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n========== DEPLOYMENT SUMMARY ==========");
        console.log("Network:", block.chainid);
        console.log("Contracts from Jeju Network:");
        console.log("BanManager:", address(banManager));
        console.log("ComputeRegistry:", address(registry));
        console.log("LedgerManager:", address(ledger));
        console.log("InferenceServing:", address(inference));
        console.log("ComputeStaking:", address(staking));
        console.log("=========================================\n");
    }
}
