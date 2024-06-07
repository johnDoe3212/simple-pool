import { ethers } from "hardhat";
import { RewardToken, Task, TestToken, ReentrancyToken } from "../typechain-types";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Task", function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let rewardToken: RewardToken;
  let task: Task;
  let testToken: TestToken;
  let reentrancyToken: ReentrancyToken; 

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    const RewardToken = await ethers.getContractFactory("RewardToken");
    const Task = await ethers.getContractFactory("Task");
    const TestToken = await ethers.getContractFactory("TestToken");
    const ReentrancyToken = await ethers.getContractFactory("ReentrancyToken");
    const mintAm = ethers.utils.parseUnits("1", "8");

    rewardToken = await RewardToken.deploy();
    testToken = await TestToken.deploy();
    reentrancyToken = await ReentrancyToken.connect(user1).deploy(ethers.utils.parseUnits("1", "5"));
    task = await Task.deploy(rewardToken.address);

    await rewardToken.connect(owner).mintRewards(mintAm);
    await rewardToken.connect(owner).approve(task.address, mintAm);
    await testToken.connect(user1).mint(mintAm);
    await testToken.connect(user1).approve(task.address, mintAm);
    await testToken.connect(user2).mint(mintAm);
    await testToken.connect(user2).approve(task.address, mintAm);
    await testToken.connect(user3).mint(mintAm);
    await testToken.connect(user3).approve(task.address, mintAm);
    await reentrancyToken.connect(user1).approve(task.address, mintAm);
  });

  it("should be possible to mint by owner", async function () {
    expect(await rewardToken.connect(owner).mintRewards(ethers.utils.parseUnits("1", "4"))).to.changeTokenBalance(rewardToken, owner, ethers.utils.parseUnits("1", "4"));
  });

  it("shouldn't be possible to mint by non-owner address", async function() {
    await expect(rewardToken.connect(user1).mintRewards(ethers.utils.parseUnits("1", "4"))).to.be.revertedWithCustomError(rewardToken, "OwnableUnauthorizedAccount");
  });
  
  it("should display the balance of the selected token", async function() {
    expect(await task.connect(user1).balanceOfDeposit(testToken.address)).to.eq(0);
    const amount = ethers.utils.parseUnits("238", "0" );
    await task.connect(user2).deposit(testToken.address, amount);
    expect(await task.connect(user2).balanceOfDeposit(testToken.address)).to.eq(amount);
  });

  it("should be possible to dep rewards only by owner", async function () {
    const amount = ethers.utils.parseUnits("1", "4");
    expect(await task.connect(owner).depositRewardToken(amount)).to.changeTokenBalances(rewardToken, [owner.address, task.address], [-amount, amount]);
    await expect(task.connect(user1).depositRewardToken(amount)).to.be.revertedWith("You are not an owner");
  });

  it("should be possible to dep tokens by users", async function () {
    const amount = ethers.utils.parseUnits("1", "2");
    expect(await task.connect(user1).deposit(testToken.address, amount)).to.changeTokenBalances(testToken, [user1.address, task.address], [-amount, amount]);
    expect(await task.connect(user1).deposit(testToken.address, amount)).to.emit(task, "Deposit").withArgs(user1.address, testToken.address, amount);
  });

  it('should revert if amount to dep is zero', async function () {
    const amount = 0;
    await expect(task.connect(user1).deposit(testToken.address, amount)).to.be.revertedWith('Amount to deposit must be greater than 0');
  });
  
  it("should be possible to withdraw by users", async function () {
    const amount = ethers.utils.parseUnits("1", "2");
    expect(await task.connect(user1).deposit(testToken.address, 10000)).to.changeTokenBalances(testToken, [user1.address, task.address], [-10000, 10000]);
    expect(await task.connect(user1).withdraw(testToken.address, amount)).to.emit(task, "Withdraw");
    expect(await task.connect(user1).withdraw(testToken.address, amount)).to.changeTokenBalances(testToken, [task.address, user1.address], [-amount, amount]);
  });

  it('should revert if amount to withdraw is zero', async function () {
    const amount = 0;
    await expect(task.connect(user1).withdraw(testToken.address, amount)).to.be.revertedWith('Amount to withdraw must be greater than 0');
  });

  it('should revert if insufficient balance', async function () {
    const amount = ethers.utils.parseUnits('10', 18);
    await expect(task.connect(user1).withdraw(testToken.address, amount)).to.be.revertedWith('Insufficient balance');
  });

  it("should be reverted with correct error", async function () {
    await task.connect(owner).depositRewardToken(ethers.utils.parseUnits("1", "4"));
    await expect(task.connect(user1).claimRewards()).to.be.revertedWith("Insufficient ballance");
  });

  it("should be possible to claim rewards for users who have deposited", async function () {
    await task.connect(owner).depositRewardToken(ethers.utils.parseUnits("1", "4"));
    const amount = ethers.utils.parseUnits("1", "2");
    await task.connect(user1).deposit(testToken.address, amount);
    expect(await task.connect(user1).claimRewards()).to.changeTokenBalances(rewardToken, [task.address, user1.address], [-amount, amount]);
  });

  it("shouldn't be reentrant", async function () {
    const amount = 10;
    await task.connect(user1).deposit(reentrancyToken.address, 100);
    await expect(task.connect(user1).withdraw(reentrancyToken.address, amount)).to.be.reverted;
  });

  it("should return the correct reward calculation", async function () {
    const user1Amount = 100;
    const user2Amount = 200;
    const user3Amount = 300;
    await task.connect(owner).depositRewardToken(1000);
    await task.connect(user1).deposit(testToken.address, user1Amount);
    await task.connect(user2).deposit(testToken.address, user2Amount);
    expect(await task.connect(user1).calculateReward()).to.eq(333);
    expect(await task.connect(user2).calculateReward()).to.eq(666);
    await task.connect(user1).withdraw(testToken.address, user1Amount);
    expect(await task.connect(user1).calculateReward()).to.eq(0);
    expect(await task.connect(user2).calculateReward()).to.eq(1000);
    await task.connect(user3).deposit(testToken.address, user3Amount);
    expect(await task.connect(user1).calculateReward()).to.eq(0);
    expect(await task.connect(user2).calculateReward()).to.eq(400);
    expect(await task.connect(user3).calculateReward()).to.eq(600);
  }); 
});