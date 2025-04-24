/**
 * Mock Smart Contract Implementations
 * 
 * This file provides mock implementations of the smart contracts for local testing.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Load mock database
const dbPath = path.join(__dirname, 'db.json');
let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Save database helper
function saveDb() {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// Mock LendingPool contract
const lendingPool = {
  address: '0x30233164e435d972d67a0b712d74696ac121877b',
  
  // User data
  deposits: async (address) => {
    return ethers.BigNumber.from(db.users[address]?.deposits || '0');
  },
  
  borrows: async (address) => {
    return ethers.BigNumber.from(db.users[address]?.borrows || '0');
  },
  
  collaterals: async (address) => {
    return ethers.BigNumber.from(db.users[address]?.collateral || '0');
  },
  
  riskScores: async (address) => {
    return ethers.BigNumber.from(db.users[address]?.riskScore || 50);
  },
  
  calculateInterestRate: async (address) => {
    // Base rate is 3%
    const baseRate = 3;
    
    // Add risk premium based on risk score
    const riskScore = db.users[address]?.riskScore || 50;
    const riskPremium = Math.floor(riskScore / 10);
    
    // Add utilization factor
    const utilizationRate = db.market.utilizationRate;
    const utilizationFactor = Math.floor(utilizationRate / 20);
    
    return ethers.BigNumber.from(baseRate + riskPremium + utilizationFactor);
  },
  
  getHealthFactor: async (address) => {
    const healthFactor = (db.users[address]?.healthFactor || 1.5) * 100;
    return ethers.BigNumber.from(Math.floor(healthFactor));
  },
  
  // Market data
  totalDeposits: async () => {
    return ethers.BigNumber.from(db.market.totalDeposits);
  },
  
  totalBorrows: async () => {
    return ethers.BigNumber.from(db.market.totalBorrows);
  },
  
  totalCollateral: async () => {
    return ethers.BigNumber.from(db.market.totalCollateral);
  },
  
  // Actions
  updateRiskScore: async (address, score) => {
    if (!db.users[address]) {
      db.users[address] = {
        deposits: '0',
        borrows: '0',
        collateral: '0',
        riskScore: 50,
        healthFactor: 1.5
      };
    }
    
    db.users[address].riskScore = score;
    saveDb();
    
    return {
      hash: '0x' + Buffer.from(crypto.randomBytes(32)).toString('hex'),
      wait: async () => ({})
    };
  }
};

// Mock Bridge contract
const bridge = {
  address: '0xb879e4c38b4ddb85b6814ecc90bc017fd788b10e',
  
  sendMessageToL1: async (targetAddress, messageType, payload, gasLimit) => {
    const messageId = '0x' + Buffer.from(crypto.randomBytes(32)).toString('hex');
    
    db.messages.push({
      id: messageId,
      sender: '0x3c0d9184692b1E34852d0F0be7adC3bd1Dbf0e15',
      targetAddress,
      messageType,
      status: 'Pending',
      timestamp: new Date().toISOString()
    });
    
    saveDb();
    
    return {
      hash: '0x' + Buffer.from(crypto.randomBytes(32)).toString('hex'),
      wait: async () => ({})
    };
  },
  
  getMessageIdsBySender: async (address) => {
    return db.messages
      .filter(msg => msg.sender === address)
      .map(msg => msg.id);
  },
  
  messages: async (messageId) => {
    const message = db.messages.find(msg => msg.id === messageId);
    
    if (!message) {
      return {
        messageId: '0x0000000000000000000000000000000000000000000000000000000000000000',
        sender: '0x0000000000000000000000000000000000000000',
        targetAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload: '0x',
        timestamp: 0,
        status: 0,
        direction: 0,
        messageType: '',
        gasLimit: 0,
        fee: 0
      };
    }
    
    const statuses = { 'Pending': 0, 'Processed': 1, 'Failed': 2, 'Canceled': 3 };
    
    return {
      messageId: message.id,
      sender: message.sender,
      targetAddress: message.targetAddress,
      payload: '0x',
      timestamp: ethers.BigNumber.from(Math.floor(new Date(message.timestamp).getTime() / 1000)),
      status: statuses[message.status],
      direction: 0,
      messageType: message.messageType,
      gasLimit: ethers.BigNumber.from(2000000),
      fee: ethers.BigNumber.from(0)
    };
  }
};

module.exports = {
  lendingPool,
  bridge
};