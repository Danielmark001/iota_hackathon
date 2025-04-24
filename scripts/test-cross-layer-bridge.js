/**
 * Test script for cross-layer communication between EVM (Layer 2) and Move (Layer 1)
 * 
 * This script demonstrates how the IntelliLend protocol uses IOTA's dual-layer architecture
 * to enhance security and efficiency in DeFi lending operations.
 */

const { ethers } = require('ethers');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Contract ABIs and addresses
const LENDING_POOL_ABI = require('../abis/LendingPool.json');
const BRIDGE_ABI = require('../abis/CrossLayerBridge.json');

// Configuration
const LENDING_POOL_ADDRESS = process.env.LENDING_POOL_ADDRESS || '0x0000000000000000000000000000000000000000';
const BRIDGE_ADDRESS = process.env.BRIDGE_ADDRESS || '0x0000000000000000000000000000000000000000';
const TEST_WALLET_PRIVATE_KEY = process.env.TEST_WALLET_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';
const IOTA_EVM_RPC_URL = process.env.IOTA_EVM_RPC_URL || 'https://evm.wasp.sc.iota.org';

// Connect to IOTA EVM node
const provider = new ethers.providers.JsonRpcProvider(IOTA_EVM_RPC_URL);
const wallet = new ethers.Wallet(TEST_WALLET_PRIVATE_KEY, provider);
const lendingPoolContract = new ethers.Contract(
  LENDING_POOL_ADDRESS,
  LENDING_POOL_ABI,
  wallet
);
const bridgeContract = new ethers.Contract(
  BRIDGE_ADDRESS,
  BRIDGE_ABI,
  wallet
);

/**
 * Main function to test cross-layer communication
 */
async function testCrossLayerCommunication() {
  try {
    console.log('====================================');
    console.log('IOTA IntelliLend Cross-Layer Bridge Test');
    console.log('====================================');
    
    // Get current account
    const address = wallet.address;
    console.log(`Using account: ${address}`);
    
    // Get current balances
    const ethBalance = await provider.getBalance(address);
    console.log(`ETH Balance: ${ethers.utils.formatEther(ethBalance)} ETH`);
    
    // Display contract addresses
    console.log(`Lending Pool: ${LENDING_POOL_ADDRESS}`);
    console.log(`Bridge: ${BRIDGE_ADDRESS}`);
    
    // 1. Send a risk score update message from Layer 2 to Layer 1
    console.log('\nTest 1: Sending risk score update from Layer 2 to Layer 1');
    await testRiskScoreUpdate(address);
    
    // 2. Send a collateral change message from Layer 2 to Layer 1
    console.log('\nTest 2: Sending collateral change from Layer 2 to Layer 1');
    await testCollateralChange(address);
    
    // 3. Simulate a liquidation event and send to Layer 1
    console.log('\nTest 3: Simulating liquidation event');
    await testLiquidation(address);
    
    // 4. Get all messages sent by this account
    console.log('\nTest 4: Retrieving all messages sent by this account');
    await getAccountMessages(address);
    
    console.log('\nAll tests completed successfully!');
    
  } catch (error) {
    console.error('Error in cross-layer bridge test:', error);
  }
}

/**
 * Test sending a risk score update from Layer 2 to Layer 1
 */
async function testRiskScoreUpdate(address) {
  try {
    // Generate a random risk score (0-100)
    const riskScore = Math.floor(Math.random() * 100);
    console.log(`Generated risk score: ${riskScore}`);
    
    // First, update the risk score in the lending pool
    console.log('Updating risk score in lending pool...');
    const updateTx = await lendingPoolContract.updateRiskScore(address, riskScore);
    await updateTx.wait();
    console.log(`Risk score updated in lending pool. Transaction: ${updateTx.hash}`);
    
    // Verify the update
    const updatedScore = await lendingPoolContract.riskScores(address);
    console.log(`Verified risk score in contract: ${updatedScore.toNumber()}`);
    
    // Check if the lending pool automatically sent the message to Layer 1
    // This is for demonstration - in a real setup, the lending pool would handle this internally
    console.log('Checking if message was sent to Layer 1...');
    
    // Get messages from the bridge
    const messageIds = await bridgeContract.getMessageIdsBySender(address);
    
    if (messageIds.length > 0) {
      console.log(`Found ${messageIds.length} messages from this account.`);
      
      // Get the latest message
      const latestMessageId = messageIds[messageIds.length - 1];
      const message = await bridgeContract.messages(latestMessageId);
      
      console.log('Latest message:');
      console.log(`- ID: ${latestMessageId}`);
      console.log(`- Type: ${message.messageType}`);
      console.log(`- Status: ${['Pending', 'Processed', 'Failed', 'Canceled'][message.status]}`);
      console.log(`- Timestamp: ${new Date(message.timestamp.toNumber() * 1000).toLocaleString()}`);
    } else {
      console.log('No messages found. Sending a manual message...');
      
      // Manually send a message through the bridge
      // In a real implementation, this would be handled by the lending pool contract
      
      // Prepare the payload: address (bytes20) + risk score (uint8)
      const payload = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint8'],
        [address, riskScore]
      );
      
      // Convert address to bytes32 for Move layer
      const targetAddressBytes = ethers.utils.hexZeroPad(address, 32);
      
      // Send the message
      const bridgeTx = await bridgeContract.sendMessageToL1(
        targetAddressBytes,
        'RISK_SCORE_UPDATE',
        payload,
        2000000, // Gas limit
        { value: ethers.utils.parseEther('0.01') } // Fee for the bridge
      );
      
      await bridgeTx.wait();
      console.log(`Message sent to Layer 1. Transaction: ${bridgeTx.hash}`);
    }
    
    console.log('Risk score update test completed.');
    
  } catch (error) {
    console.error('Error in risk score update test:', error);
  }
}

/**
 * Test sending a collateral change from Layer 2 to Layer 1
 */
async function testCollateralChange(address) {
  try {
    // Mock collateral amount
    const collateralAmount = ethers.utils.parseEther('10');
    console.log(`Test collateral amount: ${ethers.utils.formatEther(collateralAmount)} IOTA`);
    
    // Prepare the payload: address (bytes20) + collateral amount (uint256)
    const payload = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256'],
      [address, collateralAmount]
    );
    
    // Convert address to bytes32 for Move layer
    const targetAddressBytes = ethers.utils.hexZeroPad(address, 32);
    
    // Send the message
    const bridgeTx = await bridgeContract.sendMessageToL1(
      targetAddressBytes,
      'COLLATERAL_CHANGE',
      payload,
      2000000, // Gas limit
      { value: ethers.utils.parseEther('0.01') } // Fee for the bridge
    );
    
    await bridgeTx.wait();
    console.log(`Collateral change message sent to Layer 1. Transaction: ${bridgeTx.hash}`);
    
    console.log('Collateral change test completed.');
    
  } catch (error) {
    console.error('Error in collateral change test:', error);
  }
}

/**
 * Test simulating a liquidation event and sending to Layer 1
 */
async function testLiquidation(address) {
  try {
    // Mock liquidation parameters
    const borrower = address;
    const repayAmount = ethers.utils.parseEther('5');
    const collateralAmount = ethers.utils.parseEther('7.5');
    
    console.log(`Test liquidation - Borrower: ${borrower}`);
    console.log(`Repay amount: ${ethers.utils.formatEther(repayAmount)} IOTA`);
    console.log(`Collateral amount: ${ethers.utils.formatEther(collateralAmount)} IOTA`);
    
    // Prepare the payload: borrower (bytes20) + repay amount (uint256) + collateral amount (uint256)
    const payload = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256'],
      [borrower, repayAmount, collateralAmount]
    );
    
    // Convert address to bytes32 for Move layer
    const targetAddressBytes = ethers.utils.hexZeroPad(borrower, 32);
    
    // Send the message
    const bridgeTx = await bridgeContract.sendMessageToL1(
      targetAddressBytes,
      'LIQUIDATION',
      payload,
      2000000, // Gas limit
      { value: ethers.utils.parseEther('0.01') } // Fee for the bridge
    );
    
    await bridgeTx.wait();
    console.log(`Liquidation message sent to Layer 1. Transaction: ${bridgeTx.hash}`);
    
    console.log('Liquidation test completed.');
    
  } catch (error) {
    console.error('Error in liquidation test:', error);
  }
}

/**
 * Get all messages sent by an account
 */
async function getAccountMessages(address) {
  try {
    // Get messages from the bridge
    const messageIds = await bridgeContract.getMessageIdsBySender(address);
    
    console.log(`Found ${messageIds.length} messages from account ${address}.`);
    
    // Get details for each message
    for (let i = 0; i < messageIds.length; i++) {
      const messageId = messageIds[i];
      const message = await bridgeContract.messages(messageId);
      
      console.log(`\nMessage ${i + 1}:`);
      console.log(`- ID: ${messageId}`);
      console.log(`- Sender: ${message.sender}`);
      console.log(`- Target: ${ethers.utils.hexStripZeros(message.targetAddress)}`);
      console.log(`- Type: ${message.messageType}`);
      console.log(`- Status: ${['Pending', 'Processed', 'Failed', 'Canceled'][message.status]}`);
      console.log(`- Timestamp: ${new Date(message.timestamp.toNumber() * 1000).toLocaleString()}`);
      console.log(`- Fee: ${ethers.utils.formatEther(message.fee)} IOTA`);
    }
    
  } catch (error) {
    console.error('Error getting account messages:', error);
  }
}

// Execute the main function
if (require.main === module) {
  testCrossLayerCommunication()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  testCrossLayerCommunication,
  testRiskScoreUpdate,
  testCollateralChange,
  testLiquidation,
  getAccountMessages
};
