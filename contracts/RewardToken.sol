//SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RewardToken is ERC20, Ownable {
    constructor()
        ERC20("Reward", "RTK")
        Ownable(msg.sender)
    {}

    function mintRewards(uint256 amount) onlyOwner public {
        _mint(msg.sender, amount);
    }
}