// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title BBLNToken
 * @author Babylon Network
 * @notice BBLN governance token for Babylon prediction markets and AI training coordination
 * @dev ERC20 token with permit, burning, and minting capabilities
 *
 * Features:
 * - ERC20 with Permit (EIP-2612) for gasless approvals
 * - Burnable for deflationary mechanics
 * - Controlled minting by owner
 * - Max supply cap
 */
contract BBLNToken is ERC20, ERC20Burnable, ERC20Permit, Ownable2Step {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10 ** 18; // 100 million initial

    error ExceedsMaxSupply();
    error ZeroAddress();

    constructor(address owner_) ERC20("Babylon Token", "BBLN") ERC20Permit("Babylon Token") Ownable(owner_) {
        _mint(owner_, INITIAL_SUPPLY);
    }

    /**
     * @notice Mint new tokens (only owner)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        _mint(to, amount);
    }

    /**
     * @notice Get the maximum supply
     */
    function maxSupply() external pure returns (uint256) {
        return MAX_SUPPLY;
    }

    /**
     * @notice Get remaining mintable supply
     */
    function remainingMintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @notice Contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
