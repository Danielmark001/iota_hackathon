const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingPool", function () {
  let LendingPool;
  let lendingPool;
  let LendingToken;
  let lendingToken;
  let CollateralToken;
  let collateralToken;
  let Bridge;
  let bridge;
  let owner;
  let user1;
  let user2;
  let liquidator;
  let addr1;
  let addr2;

  // Test amounts
  const depositAmount = ethers.utils.parseEther("10000");
  const collateralAmount = ethers.utils.parseEther("15000");
  const borrowAmount = ethers.utils.parseEther("7500");
  
  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, liquidator, addr1, addr2] = await ethers.getSigners();

    // Deploy tokens
    LendingToken = await ethers.getContractFactory("TestERC20");
    lendingToken = await LendingToken.deploy("Lending Token", "LTK");
    await lendingToken.deployed();
    
    CollateralToken = await ethers.getContractFactory("TestERC20");
    collateralToken = await CollateralToken.deploy("Collateral Token", "CTK");
    await collateralToken.deployed();
    
    // Mint tokens to users
    await lendingToken.mint(owner.address, ethers.utils.parseEther("1000000"));
    await collateralToken.mint(owner.address, ethers.utils.parseEther("1000000"));
    
    await lendingToken.transfer(user1.address, ethers.utils.parseEther("100000"));
    await collateralToken.transfer(user1.address, ethers.utils.parseEther("100000"));
    
    await lendingToken.transfer(user2.address, ethers.utils.parseEther("100000"));
    await collateralToken.transfer(user2.address, ethers.utils.parseEther("100000"));
    
    await lendingToken.transfer(liquidator.address, ethers.utils.parseEther("100000"));
    await collateralToken.transfer(liquidator.address, ethers.utils.parseEther("100000"));
    
    // Deploy bridge (mock version for tests)
    Bridge = await ethers.getContractFactory("MockBridge");
    bridge = await Bridge.deploy();
    await bridge.deployed();
    
    // Deploy lending pool
    LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(
      lendingToken.address,
      collateralToken.address,
      bridge.address
    );
    await lendingPool.deployed();
    
    // Approve tokens for lending pool
    await lendingToken.connect(user1).approve(lendingPool.address, ethers.constants.MaxUint256);
    await collateralToken.connect(user1).approve(lendingPool.address, ethers.constants.MaxUint256);
    
    await lendingToken.connect(user2).approve(lendingPool.address, ethers.constants.MaxUint256);
    await collateralToken.connect(user2).approve(lendingPool.address, ethers.constants.MaxUint256);
    
    await lendingToken.connect(liquidator).approve(lendingPool.address, ethers.constants.MaxUint256);
    await collateralToken.connect(liquidator).approve(lendingPool.address, ethers.constants.MaxUint256);
  });

  describe("Basic Operations", function () {
    it("Should allow deposits", async function () {
      await lendingPool.connect(user1).deposit(depositAmount);
      expect(await lendingPool.deposits(user1.address)).to.equal(depositAmount);
      expect(await lendingPool.totalDeposits()).to.equal(depositAmount);
    });
    
    it("Should allow adding collateral", async function () {
      await lendingPool.connect(user1).addCollateral(collateralAmount);
      expect(await lendingPool.collaterals(user1.address)).to.equal(collateralAmount);
      expect(await lendingPool.totalCollateral()).to.equal(collateralAmount);
    });
    
    it("Should calculate interest rate based on risk", async function () {
      // Default risk score is 50
      const rate = await lendingPool.calculateInterestRate(user1.address);
      expect(rate).to.be.gt(0);
      
      // Update risk score
      await lendingPool.updateRiskScore(user1.address, 75);
      const newRate = await lendingPool.calculateInterestRate(user1.address);
      
      // Higher risk score should result in higher interest rate
      expect(newRate).to.be.gt(rate);
    });
  });

  describe("Borrowing and Repayment", function () {
    beforeEach(async function () {
      // User1 deposits lending tokens
      await lendingPool.connect(user1).deposit(depositAmount);
      
      // User2 adds collateral
      await lendingPool.connect(user2).addCollateral(collateralAmount);
    });
    
    it("Should allow borrowing against collateral", async function () {
      await lendingPool.connect(user2).borrow(borrowAmount);
      expect(await lendingPool.borrows(user2.address)).to.equal(borrowAmount);
      expect(await lendingPool.totalBorrows()).to.equal(borrowAmount);
    });
    
    it("Should not allow borrowing more than collateral allows", async function () {
      // Try to borrow more than the collateral ratio allows
      const tooMuch = ethers.utils.parseEther("12000");
      await expect(
        lendingPool.connect(user2).borrow(tooMuch)
      ).to.be.revertedWith("Insufficient collateral for borrow amount");
    });
    
    it("Should allow repayment of borrowed funds", async function () {
      // Borrow first
      await lendingPool.connect(user2).borrow(borrowAmount);
      
      // Then repay half
      const repayAmount = borrowAmount.div(2);
      await lendingPool.connect(user2).repay(repayAmount);
      
      // Check balances
      expect(await lendingPool.borrows(user2.address)).to.equal(borrowAmount.sub(repayAmount));
      expect(await lendingPool.totalBorrows()).to.equal(borrowAmount.sub(repayAmount));
    });
    
    it("Should calculate health factor correctly", async function () {
      await lendingPool.connect(user2).borrow(borrowAmount);
      
      const healthFactor = await lendingPool.getHealthFactor(user2.address);
      
      // With 15000 collateral and 7500 borrow, health factor should be around 150%
      // (accounting for collateral factor and risk score adjustments)
      expect(healthFactor).to.be.gte(150);
    });
  });

  describe("Liquidation", function () {
    beforeEach(async function () {
      // User1 deposits lending tokens
      await lendingPool.connect(user1).deposit(depositAmount.mul(2));
      
      // User2 adds collateral and borrows
      await lendingPool.connect(user2).addCollateral(collateralAmount);
      await lendingPool.connect(user2).borrow(borrowAmount);
    });
    
    it("Should not allow liquidation of healthy positions", async function () {
      // Try to liquidate a healthy position
      await expect(
        lendingPool.connect(liquidator).liquidate(user2.address, borrowAmount.div(2))
      ).to.be.revertedWith("Position is not undercollateralized");
    });
    
    it("Should allow liquidation when risk score increases", async function () {
      // Increase risk score to make the position undercollateralized
      await lendingPool.updateRiskScore(user2.address, 90);
      
      // Check if position is healthy after risk increase
      const isHealthy = await lendingPool.isPositionHealthy(user2.address);
      expect(isHealthy).to.be.false;
      
      // Now liquidate
      const liquidateAmount = borrowAmount.div(4);
      await lendingPool.connect(liquidator).liquidate(user2.address, liquidateAmount);
      
      // Check that the borrowed amount decreased
      expect(await lendingPool.borrows(user2.address)).to.be.lt(borrowAmount);
      
      // Check that the liquidator received collateral
      const liquidatorCollateral = await collateralToken.balanceOf(liquidator.address);
      expect(liquidatorCollateral).to.be.gt(ethers.utils.parseEther("100000"));
    });
    
    it("Should improve health factor after liquidation", async function () {
      // Increase risk score to make the position undercollateralized
      await lendingPool.updateRiskScore(user2.address, 90);
      
      // Get health factor before liquidation
      const healthFactorBefore = await lendingPool.getHealthFactor(user2.address);
      
      // Liquidate
      const liquidateAmount = borrowAmount.div(4);
      await lendingPool.connect(liquidator).liquidate(user2.address, liquidateAmount);
      
      // Get health factor after liquidation
      const healthFactorAfter = await lendingPool.getHealthFactor(user2.address);
      
      // Health factor should improve after liquidation
      expect(healthFactorAfter).to.be.gt(healthFactorBefore);
    });
  });

  describe("Cross-Layer Communication", function () {
    it("Should send risk score updates to L1", async function () {
      // Update risk score
      await lendingPool.updateRiskScore(user1.address, 60);
      
      // Check bridge message count (mock bridge records messages)
      const messageCount = await bridge.messageCount();
      expect(messageCount).to.be.gt(0);
      
      // Get last message
      const message = await bridge.getLastMessage();
      
      // Check message type
      expect(message.messageType).to.equal("RISK_SCORE_UPDATE");
    });
    
    it("Should send collateral updates to L1", async function () {
      // Add collateral
      await lendingPool.connect(user1).addCollateral(collateralAmount);
      
      // Check bridge message count
      const messageCount = await bridge.messageCount();
      expect(messageCount).to.be.gt(0);
      
      // Get last message
      const message = await bridge.getLastMessage();
      
      // Check message type
      expect(message.messageType).to.equal("COLLATERAL_CHANGE");
    });
    
    it("Should send liquidation info to L1", async function () {
      // Setup for liquidation
      await lendingPool.connect(user1).deposit(depositAmount.mul(2));
      await lendingPool.connect(user2).addCollateral(collateralAmount);
      await lendingPool.connect(user2).borrow(borrowAmount);
      
      // Increase risk score to make the position undercollateralized
      await lendingPool.updateRiskScore(user2.address, 90);
      
      // Liquidate
      const liquidateAmount = borrowAmount.div(4);
      await lendingPool.connect(liquidator).liquidate(user2.address, liquidateAmount);
      
      // Check if liquidation message was sent
      const lastMessage = await bridge.getLastMessage();
      expect(lastMessage.messageType).to.equal("LIQUIDATION");
    });
  });
});

// Mock contracts for testing

// Mock Bridge contract
async function deployMockBridge() {
  const MockBridge = await ethers.getContractFactory("MockBridge");
  const bridge = await MockBridge.deploy();
  await bridge.deployed();
  return bridge;
}

// Mock ERC20 Token
async function deployTestERC20(name, symbol) {
  const TestERC20 = await ethers.getContractFactory("TestERC20");
  const token = await TestERC20.deploy(name, symbol);
  await token.deployed();
  return token;
}
