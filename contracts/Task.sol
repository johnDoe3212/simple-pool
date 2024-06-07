//SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "./RewardToken.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Task is ReentrancyGuard {
    using SafeERC20 for IERC20;

    RewardToken private rewardToken;
    uint256 public totalDeposits;
    uint256 private initialRewardPool;
    uint256 public rewardPool;
    address public owner;

    mapping (address depositor => mapping(address token =>  uint256)) public tokenBalances;
    mapping (address => uint256) private rewards;
    mapping (address => uint256) public deposits;
 
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 amount);
    
    constructor (address token) {
        owner = msg.sender;
        rewardToken = RewardToken(token);   
    }

    modifier onlyOwner () {
        require (msg.sender == owner, "You are not an owner");
        _;
    }

    function balanceOfDeposit(address token) public view returns (uint256) {
        return tokenBalances[msg.sender][token];
    }   

    function depositRewardToken(uint256 amount) onlyOwner public {
        rewardToken.transferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        initialRewardPool += amount;   
    }

    function deposit(address token, uint256 amount) public {
        require(amount != 0, "Amount to deposit must be greater than 0");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);  
        tokenBalances[msg.sender][token] += amount;                                 
        deposits[msg.sender] += amount;
        rewards[msg.sender] += amount;
        totalDeposits += amount;
        calculateReward();
        emit Deposit (msg.sender, amount);
    }

    function withdraw(address token, uint256 amount) public nonReentrant {
        require(amount != 0, "Amount to withdraw must be greater than 0");
        require(tokenBalances[msg.sender][token] != 0, "Insufficient balance");
        tokenBalances[msg.sender][token] -= amount;
        deposits[msg.sender] -= amount;
        rewards[msg.sender] -= amount;        
        totalDeposits -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        calculateReward();
        emit Withdraw (msg.sender, amount);
    }

    function claimRewards() nonReentrant public {
        uint256 rewardsEarned = calculateReward();
        require(rewards[msg.sender] != 0, "Insufficient ballance");
        rewardToken.transfer(msg.sender, rewardsEarned);
        rewards[msg.sender] = 0;
        rewardPool -= rewardsEarned;
        emit Claim(msg.sender, rewardsEarned);
    }

    function calculateReward() public view returns (uint256) {
        uint256 rewardPoints = rewards[msg.sender];
        uint256 numerator = rewardPoints * initialRewardPool;

        if (numerator == 0 || totalDeposits == 0) {
            return 0;
        } 
        uint256 myReward = numerator / totalDeposits;
        return myReward;
    }
}