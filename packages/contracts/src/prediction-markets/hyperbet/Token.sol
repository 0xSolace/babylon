// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.33;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract YesToken is ERC20{
    address immutable market;
    address immutable operator;

    constructor(address _market, address _operator, uint256 liquidity) ERC20("YesToken", "YES") {
        require(_market != address(0), "invalid market");
        require(_operator != address(0), "invalid operator");
        market = _market;
        operator = _operator;
        mint(market, liquidity);
    }

    function mint(address user, uint256 amount) public {
        require(msg.sender == market);
        _mint(user, amount);
    }

    function burn(address user, uint256 amount) public {
        require(msg.sender == market || msg.sender == operator);
        _burn(user, amount);
    }

    function operatorTransfer(address from, address to, uint256 amount) external {
        require(msg.sender == market || msg.sender == operator);
        _transfer(from, to, amount);
    }
}

contract NoToken is ERC20{
    address immutable market;
    address immutable operator;

    constructor(address _market, address _operator, uint256 liquidity) ERC20("NoToken", "NO") {
        require(_market != address(0), "invalid market");
        require(_operator != address(0), "invalid operator");
        market = _market;
        operator = _operator;
        mint(market, liquidity);
    }

    function mint(address user, uint256 amount) public {
        require(msg.sender == market);
        _mint(user, amount);
    }

    function burn(address user, uint256 amount) public {
        require(msg.sender == market || msg.sender == operator);
        _burn(user, amount);
    }

    function operatorTransfer(address from, address to, uint256 amount) external {
        require(msg.sender == market || msg.sender == operator);
        _transfer(from, to, amount);
    }
}
