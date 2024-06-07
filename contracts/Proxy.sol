// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Task} from "./Task.sol";

interface TaskImplementation {
    function balanceOfDeposit(address token) external view returns (uint256);
    function depositRewardToken(uint256 amount) external;
    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount) external;
    function claimRewards() external;
    function calculateReward() external view returns (uint256);
}

contract TaskProxy is ReentrancyGuard {
    address public implementation;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _implementation) {
        implementation = _implementation;
        owner = msg.sender;
    }

    function upgradeImplementation(address _newImplementation) external onlyOwner {
        implementation = _newImplementation;
    }

    fallback() external payable {
        address _impl = implementation;
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := delegatecall(gas(), _impl, ptr, calldatasize(), 0, 0)
            let size := returndatasize()
            returndatacopy(ptr, 0, size)

            switch result
            case 0 {
                revert(ptr, size)
            }
            default {
                return(ptr, size)
            }
        }
    }

    receive() external payable {}
}
