const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChainLiquidity", function () {
  let crossChainLiquidity;
  let lendingToken;
  let collateralToken;
  let bridge;
  let riskAssessment;
  let lendingPool;
  let owner, strategyController, user1, user2, user3;
  
  beforeEach(async function () {
    // Get signers
    [owner, strategyController, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy mock tokens
    const Token = await ethers.getContractFactory("ERC20Mock");
    lendingToken = await Token.deploy("IOTA Lending Token", "ILT");
    await lendingToken.deployed();
    
    collateralToken = await Token.deploy("IOTA Collateral Token", "ICT");
    await collateralToken.deployed();
    
    // Mint tokens to users
    const initialMint = ethers.utils.parseEther("10000");
    await lendingToken.mint(user1.address, initialMint);
    await lendingToken.mint(user2.address, initialMint);
    await lendingToken.mint(user3.address, initialMint);
    
    await collateralToken.mint(user1.address, initialMint);
    await collateralToken.mint(user2.address, initialMint);
    await collateralToken.mint(user3.address, initialMint);
    
    // Deploy mock contracts
    const MockContract = await ethers.getContractFactory("MockContract");
    bridge = await MockContract.deploy();
    riskAssessment = await MockContract.deploy();
    lendingPool = await MockContract.deploy();
    
    // Deploy CrossChainLiquidity
    const CrossChainLiquidity = await ethers.getContractFactory("CrossChainLiquidity");
    crossChainLiquidity = await CrossChainLiquidity.deploy(
      bridge.address,
      riskAssessment.address,
      lendingPool.address
    );
    await crossChainLiquidity.deployed();
    
    // Register assets
    await crossChainLiquidity.registerAsset(
      lendingToken.address,
      1, // IOTA EVM Chain ID
      ethers.utils.formatBytes32String("IOTA_LENDING_TOKEN")
    );
    
    await crossChainLiquidity.registerAsset(
      collateralToken.address,
      1, // IOTA EVM Chain ID
      ethers.utils.formatBytes32String("IOTA_COLLATERAL_TOKEN")
    );
    
    // Approve tokens for liquidity provision
    await lendingToken.connect(user1).approve(crossChainLiquidity.address, ethers.constants.MaxUint256);
    await lendingToken.connect(user2).approve(crossChainLiquidity.address, ethers.constants.MaxUint256);
    await lendingToken.connect(user3).approve(crossChainLiquidity.address, ethers.constants.MaxUint256);
  });
  
  describe("Asset registration", function () {
    it("Should register assets correctly", async function () {
      const assetDetails = await crossChainLiquidity.getAssetDetails(lendingToken.address);
      expect(assetDetails.totalLiquidity).to.equal(0);
      expect(assetDetails.allocatedLiquidity).to.equal(0);
      expect(assetDetails.utilizationRate).to.equal(0);
      expect(assetDetails.currentStrategyIndex).to.equal(0);
    });
    
    it("Should fail when non-owner tries to register an asset", async function () {
      const newToken = await ethers.getContractFactory("ERC20Mock").then(f => f.deploy("New Token", "NEW"));
      await newToken.deployed();
      
      await expect(
        crossChainLiquidity.connect(user1).registerAsset(
          newToken.address,
          1,
          ethers.utils.formatBytes32String("NEW_TOKEN")
        )
      ).to.be.reverted;
    });
  });
  
  describe("Strategy management", function () {
    it("Should register strategies correctly", async function () {
      await crossChainLiquidity.registerStrategy(
        lendingToken.address,
        "Conservative Lending",
        700, // 7% APY
        20, // Low risk
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1000000"),
        strategyController.address
      );
      
      const strategyCount = await crossChainLiquidity.getStrategyCount(lendingToken.address);
      expect(strategyCount).to.equal(1);
      
      const strategyDetails = await crossChainLiquidity.getStrategyDetails(lendingToken.address, 0);
      expect(strategyDetails.name).to.equal("Conservative Lending");
      expect(strategyDetails.projectedAPY).to.equal(700);
      expect(strategyDetails.riskScore).to.equal(20);
      expect(strategyDetails.minAmount).to.equal(ethers.utils.parseEther("1000"));
      expect(strategyDetails.maxAmount).to.equal(ethers.utils.parseEther("1000000"));
      expect(strategyDetails.strategyController).to.equal(strategyController.address);
      expect(strategyDetails.isActive).to.equal(true);
    });
    
    it("Should update strategies correctly", async function () {
      // Register a strategy first
      await crossChainLiquidity.registerStrategy(
        lendingToken.address,
        "Conservative Lending",
        700, // 7% APY
        20, // Low risk
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1000000"),
        strategyController.address
      );
      
      // Update the strategy
      await crossChainLiquidity.updateStrategy(
        lendingToken.address,
        0, // Strategy index
        800, // New APY
        25, // New risk score
        ethers.utils.parseEther("2000"), // New min amount
        ethers.utils.parseEther("2000000"), // New max amount
        true // Active status
      );
      
      // Check updated details
      const strategyDetails = await crossChainLiquidity.getStrategyDetails(lendingToken.address, 0);
      expect(strategyDetails.projectedAPY).to.equal(800);
      expect(strategyDetails.riskScore).to.equal(25);
      expect(strategyDetails.minAmount).to.equal(ethers.utils.parseEther("2000"));
      expect(strategyDetails.maxAmount).to.equal(ethers.utils.parseEther("2000000"));
    });
  });
  
  describe("Liquidity provision", function () {
    beforeEach(async function () {
      // Register strategies
      await crossChainLiquidity.registerStrategy(
        lendingToken.address,
        "Conservative Lending",
        700, // 7% APY
        20, // Low risk
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1000000"),
        strategyController.address
      );
      
      await crossChainLiquidity.registerStrategy(
        lendingToken.address,
        "Balanced Yield",
        1200, // 12% APY
        50, // Medium risk
        ethers.utils.parseEther("5000"),
        ethers.utils.parseEther("2000000"),
        strategyController.address
      );
      
      await crossChainLiquidity.registerStrategy(
        lendingToken.address,
        "Aggressive Growth",
        2500, // 25% APY
        80, // High risk
        ethers.utils.parseEther("10000"),
        ethers.utils.parseEther("5000000"),
        strategyController.address
      );
    });
    
    it("Should add liquidity correctly", async function () {
      const amount = ethers.utils.parseEther("10000");
      
      // Add liquidity
      await crossChainLiquidity.connect(user1).addLiquidity(lendingToken.address, amount);
      
      // Check asset details
      const assetDetails = await crossChainLiquidity.getAssetDetails(lendingToken.address);
      expect(assetDetails.totalLiquidity).to.equal(amount);
      
      // Check provider details
      const providerDetails = await crossChainLiquidity.getProviderDetails(user1.address, lendingToken.address);
      expect(providerDetails.assetLiquidity).to.equal(amount);
      expect(providerDetails.totalLiquidity).to.equal(amount);
    });
    
    it("Should remove liquidity correctly", async function () {
      const amount = ethers.utils.parseEther("10000");
      
      // Add liquidity
      await crossChainLiquidity.connect(user1).addLiquidity(lendingToken.address, amount);
      
      // Fast forward time to bypass lock period
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethers.provider.send("evm_mine");
      
      // Calculate shares
      const providerDetails = await crossChainLiquidity.getProviderDetails(user1.address, lendingToken.address);
      const shares = providerDetails.assetShares;
      
      // Remove half of liquidity
      await crossChainLiquidity.connect(user1).removeLiquidity(lendingToken.address, shares.div(2));
      
      // Check updated details
      const updatedDetails = await crossChainLiquidity.getProviderDetails(user1.address, lendingToken.address);
      expect(updatedDetails.assetLiquidity).to.be.closeTo(amount.div(2), ethers.utils.parseEther("0.1"));
      expect(updatedDetails.assetShares).to.be.closeTo(shares.div(2), 100);
    });
    
    it("Should apply early withdrawal fee", async function () {
      const amount = ethers.utils.parseEther("10000");
      
      // Add liquidity
      await crossChainLiquidity.connect(user1).addLiquidity(lendingToken.address, amount);
      
      // No time forwarding to trigger early withdrawal fee
      
      // Calculate shares
      const providerDetails = await crossChainLiquidity.getProviderDetails(user1.address, lendingToken.address);
      const shares = providerDetails.assetShares;
      
      // Get initial token balance
      const initialBalance = await lendingToken.balanceOf(user1.address);
      
      // Remove all liquidity
      await crossChainLiquidity.connect(user1).removeLiquidity(lendingToken.address, shares);
      
      // Check balance after withdrawal
      const newBalance = await lendingToken.balanceOf(user1.address);
      const returned = newBalance.sub(initialBalance);
      
      // Check if early withdrawal fee was applied (should be 5%)
      expect(returned).to.be.lt(amount);
      expect(returned).to.be.closeTo(amount.mul(95).div(100), ethers.utils.parseEther("0.1"));
    });
  });
  
  describe("Cross-chain functionality", function () {
    it("Should process cross-chain deposits", async function () {
      // Simulate a cross-chain deposit
      await crossChainLiquidity.processCrossChainDeposit(
        1, // Chain ID
        ethers.utils.formatBytes32String("IOTA_LENDING_TOKEN"),
        ethers.utils.parseEther("5000"),
        user2.address
      );
      
      // Check asset details
      const assetDetails = await crossChainLiquidity.getAssetDetails(lendingToken.address);
      expect(assetDetails.totalLiquidity).to.equal(ethers.utils.parseEther("5000"));
      
      // Check provider details
      const providerDetails = await crossChainLiquidity.getProviderDetails(user2.address, lendingToken.address);
      expect(providerDetails.assetLiquidity).to.equal(ethers.utils.parseEther("5000"));
      expect(providerDetails.totalLiquidity).to.equal(ethers.utils.parseEther("5000"));
    });
    
    it("Should send cross-chain liquidity", async function () {
      // Add liquidity first
      const amount = ethers.utils.parseEther("10000");
      await crossChainLiquidity.connect(user1).addLiquidity(lendingToken.address, amount);
      
      // Mock bridge call
      const sendMessageToL1 = bridge.interface.encodeFunctionData("sendMessageToL1", [
        ethers.constants.HashZero,
        "CROSS_CHAIN_DEPOSIT",
        ethers.utils.randomBytes(100),
        2000000
      ]);
      await bridge.givenMethodReturnBytes(sendMessageToL1, ethers.utils.randomBytes(32));
      
      // Send cross-chain liquidity
      const sendAmount = ethers.utils.parseEther("2000");
      await crossChainLiquidity.connect(user1).sendCrossChainLiquidity(
        lendingToken.address,
        2, // Target chain ID
        sendAmount,
        ethers.utils.formatBytes32String("RECIPIENT")
      );
      
      // Check updated provider details
      const providerDetails = await crossChainLiquidity.getProviderDetails(user1.address, lendingToken.address);
      expect(providerDetails.assetLiquidity).to.equal(amount.sub(sendAmount));
      
      // Check updated asset details
      const assetDetails = await crossChainLiquidity.getAssetDetails(lendingToken.address);
      expect(assetDetails.totalLiquidity).to.equal(amount.sub(sendAmount));
    });
  });
  
  describe("Market conditions and rebalancing", function () {
    beforeEach(async function () {
      // Register strategies
      await crossChainLiquidity.registerStrategy(
        lendingToken.address,
        "Conservative Lending",
        700, // 7% APY
        20, // Low risk
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1000000"),
        strategyController.address
      );
      
      await crossChainLiquidity.registerStrategy(
        lendingToken.address,
        "Balanced Yield",
        1200, // 12% APY
        50, // Medium risk
        ethers.utils.parseEther("5000"),
        ethers.utils.parseEther("2000000"),
        strategyController.address
      );
      
      // Add liquidity
      const amount = ethers.utils.parseEther("20000");
      await crossChainLiquidity.connect(user1).addLiquidity(lendingToken.address, amount);
    });
    
    it("Should update market conditions", async function () {
      // Update market conditions
      await crossChainLiquidity.updateMarketConditions(70, 30, 40);
      
      // Get market conditions
      const marketConditions = await crossChainLiquidity.getMarketConditions();
      expect(marketConditions.volatility).to.equal(70);
      expect(marketConditions.trend).to.equal(30);
      expect(marketConditions.systemRisk).to.equal(40);
    });
    
    it("Should trigger rebalance", async function () {
      // Mock strategy controller functions
      const executeStrategySwitch = strategyController.interface.encodeFunctionData("withdraw", [
        lendingToken.address,
        ethers.utils.parseEther("20000")
      ]);
      await strategyController.givenMethodReturnBool(executeStrategySwitch, true);
      
      const executeAllocation = strategyController.interface.encodeFunctionData("allocate", [
        lendingToken.address,
        ethers.utils.parseEther("20000")
      ]);
      await strategyController.givenMethodReturnBool(executeAllocation, true);
      
      // Set rebalance threshold to 0 to ensure rebalance happens
      await crossChainLiquidity.updateProtocolParameters(
        0, // rebalanceThreshold
        1, // rebalanceInterval
        1000, // performanceFee
        500, // withdrawalFee
        7 * 24 * 60 * 60 // minLockPeriod
      );
      
      // Trigger rebalance
      await crossChainLiquidity.rebalance(lendingToken.address);
      
      // Get asset details after rebalance
      const assetDetails = await crossChainLiquidity.getAssetDetails(lendingToken.address);
      
      // The strategy index should have changed if rebalance happened
      // In this case, it should move to strategy 1 (Balanced Yield) which has higher APY
      expect(assetDetails.currentStrategyIndex).to.equal(1);
    });
  });
  
  describe("Yield harvesting", function () {
    beforeEach(async function () {
      // Register strategy
      await crossChainLiquidity.registerStrategy(
        lendingToken.address,
        "Conservative Lending",
        700, // 7% APY
        20, // Low risk
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1000000"),
        strategyController.address
      );
      
      // Add liquidity
      const amount = ethers.utils.parseEther("20000");
      await crossChainLiquidity.connect(user1).addLiquidity(lendingToken.address, amount);
    });
    
    it("Should harvest yield", async function () {
      // Simulate yield by transferring tokens to the contract
      const yieldAmount = ethers.utils.parseEther("2000");
      await lendingToken.mint(crossChainLiquidity.address, yieldAmount);
      
      // Mock strategy controller harvest function
      const executeHarvest = strategyController.interface.encodeFunctionData("harvest", [
        lendingToken.address
      ]);
      await strategyController.givenMethodReturnBool(executeHarvest, true);
      
      // Initial asset details
      const initialDetails = await crossChainLiquidity.getAssetDetails(lendingToken.address);
      
      // Harvest yield
      await crossChainLiquidity.harvestYield(lendingToken.address);
      
      // Get updated asset details
      const updatedDetails = await crossChainLiquidity.getAssetDetails(lendingToken.address);
      
      // The total liquidity should have increased by the yield minus the performance fee
      const expectedYield = yieldAmount.mul(90).div(100); // 10% fee
      expect(updatedDetails.totalLiquidity).to.be.closeTo(
        initialDetails.totalLiquidity.add(expectedYield),
        ethers.utils.parseEther("0.1")
      );
    });
  });
  
  describe("Protocol administration", function () {
    it("Should update protocol parameters", async function () {
      // Update protocol parameters
      await crossChainLiquidity.updateProtocolParameters(
        100, // rebalanceThreshold
        2 * 24 * 60 * 60, // rebalanceInterval
        1500, // performanceFee
        1000, // withdrawalFee
        14 * 24 * 60 * 60 // minLockPeriod
      );
      
      // Verification would require getter functions for these parameters
    });
    
    it("Should add and remove supported chains", async function () {
      // Add a new supported chain
      await crossChainLiquidity.addSupportedChain(2); // Ethereum chain ID
      
      // Verify the chain is supported
      expect(await crossChainLiquidity.supportedChains(2)).to.equal(true);
      
      // Remove the supported chain
      await crossChainLiquidity.removeSupportedChain(2);
      
      // Verify the chain is no longer supported
      expect(await crossChainLiquidity.supportedChains(2)).to.equal(false);
    });
    
    it("Should pause and unpause the contract", async function () {
      // Pause the contract
      await crossChainLiquidity.pause();
      
      // Try to add liquidity (should fail)
      await expect(
        crossChainLiquidity.connect(user1).addLiquidity(
          lendingToken.address,
          ethers.utils.parseEther("1000")
        )
      ).to.be.reverted;
      
      // Unpause the contract
      await crossChainLiquidity.unpause();
      
      // Try again (should succeed)
      await crossChainLiquidity.connect(user1).addLiquidity(
        lendingToken.address,
        ethers.utils.parseEther("1000")
      );
    });
  });
});

// Mock ERC20 contract for testing
contract("ERC20Mock", () => {
  // Implementation skipped as it would be provided by the test framework
});

// Mock contract for simulating external contracts
contract("MockContract", () => {
  // Implementation skipped as it would be provided by the test framework
});
