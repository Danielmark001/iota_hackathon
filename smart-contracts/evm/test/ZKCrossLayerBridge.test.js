const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZKCrossLayerBridge", function () {
  let zkBridge;
  let owner, oracle, relayer, zkVerifier, user1, user2;
  let messageId;
  
  // Constants
  const ORACLE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE"));
  const RELAYER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RELAYER_ROLE"));
  const ZK_VERIFIER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ZK_VERIFIER_ROLE"));
  
  beforeEach(async function () {
    // Get signers
    [owner, oracle, relayer, zkVerifier, user1, user2] = await ethers.getSigners();
    
    // Deploy ZKCrossLayerBridge
    const ZKCrossLayerBridge = await ethers.getContractFactory("ZKCrossLayerBridge");
    zkBridge = await ZKCrossLayerBridge.deploy(owner.address);
    await zkBridge.deployed();
    
    // Grant roles
    await zkBridge.grantRole(ORACLE_ROLE, oracle.address);
    await zkBridge.grantRole(RELAYER_ROLE, relayer.address);
    await zkBridge.grantRole(ZK_VERIFIER_ROLE, zkVerifier.address);
    
    // Set up mock protocol addresses
    await zkBridge.registerProtocolAddresses(
      user1.address, // Mock lending pool
      user2.address, // Mock risk assessment
      oracle.address // Mock trusted encryption oracle
    );
    
    // Register verifier for risk assessment
    await zkBridge.registerVerifier("RISK_ASSESSMENT", zkVerifier.address);
  });
  
  describe("Basic functionality", function () {
    it("Should set the owner correctly", async function () {
      expect(await zkBridge.hasRole(ethers.constants.HashZero, owner.address)).to.equal(true);
    });
    
    it("Should grant and check roles correctly", async function () {
      expect(await zkBridge.hasRole(ORACLE_ROLE, oracle.address)).to.equal(true);
      expect(await zkBridge.hasRole(RELAYER_ROLE, relayer.address)).to.equal(true);
      expect(await zkBridge.hasRole(ZK_VERIFIER_ROLE, zkVerifier.address)).to.equal(true);
    });
    
    it("Should register protocol addresses correctly", async function () {
      expect(await zkBridge.lendingPoolAddress()).to.equal(user1.address);
      expect(await zkBridge.riskAssessmentAddress()).to.equal(user2.address);
      expect(await zkBridge.trustedEncryptionOracleAddress()).to.equal(oracle.address);
    });
    
    it("Should register verifiers correctly", async function () {
      expect(await zkBridge.verifierRegistry("RISK_ASSESSMENT")).to.equal(zkVerifier.address);
    });
  });
  
  describe("Message sending", function () {
    it("Should send message to L1", async function () {
      const targetAddress = ethers.utils.formatBytes32String("INTELLILEND_ASSET_MODULE");
      const messageType = "RISK_SCORE_UPDATE";
      const payload = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256"],
        [user1.address, 75] // Address and risk score
      );
      
      // Send message
      const tx = await zkBridge.sendMessageToL1(
        targetAddress,
        messageType,
        payload,
        2000000, // Gas limit
        { value: ethers.utils.parseEther("0.01") } // Fee
      );
      
      // Get message ID from logs
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "MessageSent");
      messageId = event.args.messageId;
      
      // Verify event details
      expect(event.args.sender).to.equal(owner.address);
      expect(event.args.targetAddress).to.equal(targetAddress);
      expect(event.args.messageType).to.equal(messageType);
      expect(event.args.isPrivate).to.equal(false);
    });
    
    it("Should send private message to L1", async function () {
      const targetAddress = ethers.utils.formatBytes32String("INTELLILEND_ASSET_MODULE");
      const messageType = "PRIVATE_RISK_DATA";
      const encryptedPayload = ethers.utils.hexlify(ethers.utils.randomBytes(100)); // Simulated encrypted data
      
      // Send message
      const tx = await zkBridge.sendPrivateMessageToL1(
        targetAddress,
        messageType,
        encryptedPayload,
        2000000, // Gas limit
        { value: ethers.utils.parseEther("0.02") } // Higher fee for private message
      );
      
      // Get message ID from logs
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "MessageSent");
      
      // Verify event details
      expect(event.args.sender).to.equal(owner.address);
      expect(event.args.targetAddress).to.equal(targetAddress);
      expect(event.args.messageType).to.equal(messageType);
      expect(event.args.isPrivate).to.equal(true);
    });
  });
  
  describe("Message confirmation", function () {
    beforeEach(async function () {
      // Send a message first
      const targetAddress = ethers.utils.formatBytes32String("INTELLILEND_ASSET_MODULE");
      const messageType = "RISK_SCORE_UPDATE";
      const payload = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256"],
        [user1.address, 75] // Address and risk score
      );
      
      // Send message
      const tx = await zkBridge.sendMessageToL1(
        targetAddress,
        messageType,
        payload,
        2000000, // Gas limit
        { value: ethers.utils.parseEther("0.01") } // Fee
      );
      
      // Get message ID from logs
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "MessageSent");
      messageId = event.args.messageId;
    });
    
    it("Should confirm message by oracles", async function () {
      // Oracle 1 confirmation
      await zkBridge.connect(oracle).confirmMessage(messageId, ethers.utils.randomBytes(65));
      
      // Get message details
      const messageDetails = await zkBridge.getMessageDetails(messageId);
      expect(messageDetails.confirmationCount).to.equal(1);
      
      // Oracle 2 (owner has oracle role too) confirmation
      await zkBridge.confirmMessage(messageId, ethers.utils.randomBytes(65));
      
      // Get updated message details
      const updatedDetails = await zkBridge.getMessageDetails(messageId);
      expect(updatedDetails.confirmationCount).to.equal(2);
    });
    
    it("Should process message after sufficient confirmations", async function () {
      // Set min confirmations to 2 (for testing)
      await zkBridge.updateSecurityParams(2, 86400, 10240);
      
      // Oracle 1 confirmation
      await zkBridge.connect(oracle).confirmMessage(messageId, ethers.utils.randomBytes(65));
      
      // Oracle 2 (owner has oracle role too) confirmation
      const tx = await zkBridge.confirmMessage(messageId, ethers.utils.randomBytes(65));
      
      // Check for MessageProcessed event
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "MessageProcessed");
      expect(event).to.not.be.undefined;
      
      // Get updated message details
      const updatedDetails = await zkBridge.getMessageDetails(messageId);
      expect(updatedDetails.status).to.equal(2); // Processed status
    });
  });
  
  describe("L1 to L2 message processing", function () {
    it("Should process message from L1", async function () {
      // Create a message from L1
      const sender = ethers.utils.formatBytes32String("INTELLILEND_ASSET_MODULE");
      const messageType = "COLLATERAL_CHANGE";
      const payload = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256"],
        [user1.address, ethers.utils.parseEther("10000")]
      );
      const l1Timestamp = Math.floor(Date.now() / 1000);
      
      // Create mock signature
      const signature = ethers.utils.randomBytes(65);
      
      // Process message (only relayer can do this)
      await zkBridge.connect(relayer).processMessageFromL1(
        sender,
        messageType,
        payload,
        l1Timestamp,
        signature
      );
      
      // Verify message was processed (check for MessageProcessed event)
      // In a real test, we would check the effect of the processed message
    });
    
    it("Should fail when non-relayer tries to process message", async function () {
      // Create a message from L1
      const sender = ethers.utils.formatBytes32String("INTELLILEND_ASSET_MODULE");
      const messageType = "COLLATERAL_CHANGE";
      const payload = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256"],
        [user1.address, ethers.utils.parseEther("10000")]
      );
      const l1Timestamp = Math.floor(Date.now() / 1000);
      
      // Create mock signature
      const signature = ethers.utils.randomBytes(65);
      
      // Try to process message as non-relayer (should fail)
      await expect(
        zkBridge.connect(user1).processMessageFromL1(
          sender,
          messageType,
          payload,
          l1Timestamp,
          signature
        )
      ).to.be.reverted;
    });
  });
  
  describe("Zero-knowledge proof handling", function () {
    it("Should submit and verify a ZK proof", async function () {
      // Create a message ID for the proof to be associated with
      const targetAddress = ethers.utils.formatBytes32String("INTELLILEND_ASSET_MODULE");
      const messageType = "RISK_SCORE_UPDATE";
      const payload = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256"],
        [user1.address, 75]
      );
      
      // Send message to get a message ID
      const tx = await zkBridge.sendMessageToL1(
        targetAddress,
        messageType,
        payload,
        2000000,
        { value: ethers.utils.parseEther("0.01") }
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "MessageSent");
      messageId = event.args.messageId;
      
      // Submit a ZK proof
      const proofType = "RISK_ASSESSMENT";
      const proof = ethers.utils.hexlify(ethers.utils.randomBytes(200));
      const publicInputHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("public inputs"));
      
      const proofTx = await zkBridge.submitZKProof(
        messageId,
        proofType,
        proof,
        publicInputHash,
        { value: ethers.utils.parseEther("0.005") }
      );
      
      // Check for ProofSubmitted event
      const proofReceipt = await proofTx.wait();
      const proofEvent = proofReceipt.events.find(e => e.event === "ProofSubmitted");
      expect(proofEvent).to.not.be.undefined;
      
      // Get the proof ID
      const proofId = proofEvent.args.proofId;
      
      // Verify the proof as ZK verifier
      await zkBridge.connect(zkVerifier).verifyPendingProof(proofId);
      
      // Check proof details
      const proofDetails = await zkBridge.getProofDetails(proofId);
      expect(proofDetails.proofType).to.equal(proofType);
      expect(proofDetails.verified).to.equal(true);
    });
  });
  
  describe("Security and admin functions", function () {
    it("Should update fee parameters", async function () {
      await zkBridge.updateFees(
        ethers.utils.parseEther("0.002"), // New base fee
        ethers.utils.parseEther("0.00002"), // New fee per byte
        3, // New private fee multiplier
        ethers.utils.parseEther("0.01") // New ZK proof verification fee
      );
      
      // Check updated fees (would need getter functions in the contract)
    });
    
    it("Should update security parameters", async function () {
      await zkBridge.updateSecurityParams(
        4, // New min confirmations
        172800, // New message timeout (2 days)
        20480 // New max message size
      );
      
      // Check updated parameters (would need getter functions in the contract)
    });
    
    it("Should pause and unpause the contract", async function () {
      // Pause the contract
      await zkBridge.pause();
      
      // Try to send a message (should fail)
      const targetAddress = ethers.utils.formatBytes32String("INTELLILEND_ASSET_MODULE");
      const messageType = "TEST_MESSAGE";
      const payload = ethers.utils.randomBytes(10);
      
      await expect(
        zkBridge.sendMessageToL1(
          targetAddress,
          messageType,
          payload,
          2000000,
          { value: ethers.utils.parseEther("0.01") }
        )
      ).to.be.reverted;
      
      // Unpause the contract
      await zkBridge.unpause();
      
      // Try again (should succeed)
      await zkBridge.sendMessageToL1(
        targetAddress,
        messageType,
        payload,
        2000000,
        { value: ethers.utils.parseEther("0.01") }
      );
    });
  });
});
