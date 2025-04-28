import axios from 'axios';
import iotaService from './iotaService';

// Create axios instance with base URL and default configs
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3002', // Updated port to match server.js
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor for token authentication
api.interceptors.request.use(
  (config) => {
    // Get token from local storage if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// API endpoints
const apiService = {
  // Health check
  getHealthStatus: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      console.error('Error checking health status:', error);
      throw error;
    }
  },
  
  // User profile
  getUserProfile: async (address) => {
    try {
      const response = await api.get(`/api/user/${address}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Return fallback data on error
      return {
        address,
        deposits: 1500,
        borrows: 800,
        collateral: 2000,
        riskScore: 45,
        interestRate: 7.5,
        healthFactor: 1.8,
        identityVerified: false,
        lastUpdated: Date.now()
      };
    }
  },
  
  // Market data
  getMarketData: async () => {
    try {
      const response = await api.get('/api/market');
      return response.data;
    } catch (error) {
      console.error('Error fetching market data:', error);
      // Return fallback data on error
      return {
        totalDeposits: 500000,
        totalBorrows: 350000,
        totalCollateral: 750000,
        utilizationRate: 70,
        lastUpdated: Date.now()
      };
    }
  },
  
  // Historical data
  getHistoricalData: async (address) => {
    try {
      const response = await api.get(`/api/history/${address}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching historical data:', error);
      
      // Generate fallback chart data
      const days = 30;
      const labels = [];
      const deposits = [];
      const borrows = [];
      const riskScores = [];
      
      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString());
        
        // Generate simulated data with realistic trends
        const baseDeposit = 100 + Math.random() * 50;
        const baseBorrow = 50 + Math.random() * 30;
        const baseRisk = 30 + Math.random() * 20;
        
        // Add some trend (increasing deposits, fluctuating borrows)
        const deposit = baseDeposit + (days - i) * 2;
        const borrow = baseBorrow + Math.sin(i / 5) * 15;
        const risk = baseRisk - Math.cos(i / 7) * 10;
        
        deposits.push(deposit);
        borrows.push(borrow);
        riskScores.push(risk);
      }
      
      // Format for Chart.js
      return {
        labels,
        datasets: [
          {
            label: 'Deposits',
            data: deposits,
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            fill: true
          },
          {
            label: 'Borrows',
            data: borrows,
            borderColor: '#2196f3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            fill: true
          },
          {
            label: 'Risk Score',
            data: riskScores,
            borderColor: '#f44336',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            fill: true,
            yAxisID: 'y2'
          }
        ]
      };
    }
  },
  
  // Risk assessment
  getRiskAssessment: async (address) => {
    try {
      const response = await api.post('/api/risk-assessment', { address });
      return response.data;
    } catch (error) {
      console.error('Error fetching risk assessment:', error);
      throw error;
    }
  },
  
  // Get feature importance
  getFeatureImportance: async () => {
    try {
      const response = await api.get('/api/ai/feature-importance');
      return response.data;
    } catch (error) {
      console.error('Error fetching feature importance:', error);
      // Return fallback data on error
      return {
        features: [
          { feature: 'collateral_ratio', importance: 0.35 },
          { feature: 'transaction_history', importance: 0.25 },
          { feature: 'wallet_age', importance: 0.15 },
          { feature: 'repayment_history', importance: 0.15 },
          { feature: 'cross_chain_activity', importance: 0.10 }
        ]
      };
    }
  },
  
  // Get risk timeline
  getRiskTimeline: async (address) => {
    try {
      const response = await api.get(`/api/ai/risk-timeline/${address}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching risk timeline:', error);
      return null;
    }
  },
  
  // Get recommendations
  getRecommendations: async (address) => {
    try {
      const response = await api.get(`/api/recommendations/${address}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      return apiService.getMockRecommendations();
    }
  },
  
  // AI model scenario analysis
  analyzeScenarios: async (scenarios) => {
    try {
      const response = await api.post('/api/ai/scenario-analysis', { scenarios });
      return response.data;
    } catch (error) {
      console.error('Error analyzing scenarios:', error);
      throw error;
    }
  },
  
  // AI model risk simulation
  simulateRisk: async (params) => {
    try {
      const response = await api.post('/api/ai/simulate-risk', params);
      return response.data;
    } catch (error) {
      console.error('Error simulating risk:', error);
      throw error;
    }
  },
  
  // Bridge messages
  getBridgeMessages: async (address) => {
    try {
      const response = await api.get(`/api/bridge/messages/${address}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching bridge messages:', error);
      // Return fallback data
      return { 
        messages: [
          {
            messageId: '0x' + Math.random().toString(16).substring(2, 14),
            messageType: 'TRANSFER',
            status: 'Processed',
            timestamp: Date.now() - 3600000,
            sender: address,
            targetAddress: '0x' + Math.random().toString(16).substring(2, 42),
            direction: 'L2ToL1'
          },
          {
            messageId: '0x' + Math.random().toString(16).substring(2, 14),
            messageType: 'BRIDGE',
            status: 'Pending',
            timestamp: Date.now() - 7200000,
            sender: '0x' + Math.random().toString(16).substring(2, 42),
            targetAddress: address,
            direction: 'L1ToL2'
          }
        ],
        count: 2
      };
    }
  },
  
  // IOTA specific endpoints - using iotaService
  
  // Health
  checkIotaHealth: iotaService.checkHealth,
  
  // Wallet operations
  generateIotaAddress: iotaService.generateAddress,
  getIotaBalance: iotaService.getBalance,
  sendIotaTokens: iotaService.sendTokens,
  submitIotaData: iotaService.submitData,
  getIotaNetworkInfo: iotaService.getNetworkInfo,
  getIotaTransactions: iotaService.getTransactions,
  checkTransactionStatus: iotaService.checkTransactionStatus,
  
  // Identity operations
  createIdentity: iotaService.createIdentity,
  createCredential: iotaService.createCredential,
  verifyIdentity: iotaService.verifyIdentity,
  
  // Streams operations
  createChannel: iotaService.createChannel,
  joinChannel: iotaService.joinChannel,
  getUserChannels: iotaService.getUserChannels,
  getChannelMessages: iotaService.getChannelMessages,
  sendMessage: iotaService.sendMessage,
  sendFile: iotaService.sendFile,
  
  // Cross-layer operations
  sendCrossLayerMessage: iotaService.sendCrossLayerMessage,
  checkCrossLayerMessageStatus: iotaService.checkCrossLayerMessageStatus,
  getCrossLayerMessages: iotaService.getCrossLayerMessages,
  getCrossLayerTransactions: iotaService.getCrossLayerTransactions,
  getBridgeMessages: iotaService.getBridgeMessages,
  getLiquidationEvents: iotaService.getLiquidationEvents,
  getCrossLayerStats: iotaService.getCrossLayerStats,
  
  // Cross-layer swap operations
  initiateL1ToL2Transfer: async (transferData) => {
    try {
      const response = await api.post('/api/bridge/l1-to-l2', transferData);
      return response.data;
    } catch (error) {
      console.error('Error initiating L1 to L2 transfer:', error);
      throw error;
    }
  },
  
  initiateL2ToL1Transfer: async (transferData) => {
    try {
      const response = await api.post('/api/bridge/l2-to-l1', transferData);
      return response.data;
    } catch (error) {
      console.error('Error initiating L2 to L1 transfer:', error);
      throw error;
    }
  },
  
  getTransferStatus: async (transferId) => {
    try {
      const response = await api.get(`/api/bridge/transfer/${transferId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting transfer status:', error);
      throw error;
    }
  },
  
  getGasEstimates: async () => {
    try {
      const response = await api.get('/api/bridge/gas-estimates');
      return response.data;
    } catch (error) {
      console.error('Error getting gas estimates:', error);
      // Return default values on error
      return {
        l1ToL2Gas: 0.001,
        l2ToL1Gas: 0.005
      };
    }
  },
  
  // Simulated market assets data (since we don't have this endpoint yet)
  getMarketAssets: async () => {
    try {
      // In a real app, this would be an API call
      // For demo, return mocked data
      return [
        {
          id: 'iota',
          name: 'IOTA',
          symbol: 'MIOTA',
          icon: 'https://cryptologos.cc/logos/iota-miota-logo.png',
          supplyAPY: 4.5,
          supplyAPYChange: 0.3,
          borrowAPY: 7.2,
          totalSupply: 500000,
          totalBorrowed: 350000,
          utilization: 70,
        },
        {
          id: 'eth',
          name: 'Ethereum',
          symbol: 'ETH',
          icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
          supplyAPY: 3.2,
          supplyAPYChange: -0.1,
          borrowAPY: 5.8,
          totalSupply: 1500,
          totalBorrowed: 900,
          utilization: 60,
        },
        {
          id: 'usdt',
          name: 'Tether',
          symbol: 'USDT',
          icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
          supplyAPY: 8.5,
          supplyAPYChange: 1.2,
          borrowAPY: 12.1,
          totalSupply: 1000000,
          totalBorrowed: 850000,
          utilization: 85,
        },
        {
          id: 'smr',
          name: 'Shimmer',
          symbol: 'SMR',
          icon: 'https://cryptologos.cc/logos/shimmer-smr-logo.png',
          supplyAPY: 6.8,
          supplyAPYChange: 1.5,
          borrowAPY: 9.5,
          totalSupply: 750000,
          totalBorrowed: 500000,
          utilization: 67,
        },
        {
          id: 'dai',
          name: 'DAI',
          symbol: 'DAI',
          icon: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png',
          supplyAPY: 7.8,
          supplyAPYChange: 0.5,
          borrowAPY: 10.5,
          totalSupply: 800000,
          totalBorrowed: 400000,
          utilization: 50,
        },
        {
          id: 'btc',
          name: 'Bitcoin',
          symbol: 'BTC',
          icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
          supplyAPY: 2.1,
          supplyAPYChange: -0.2,
          borrowAPY: 4.3,
          totalSupply: 100,
          totalBorrowed: 45,
          utilization: 45,
        },
      ];
    } catch (error) {
      console.error('Error fetching market assets:', error);
      throw error;
    }
  },
  
  // Recommendations mock (used for development if API isn't ready)
  getMockRecommendations: async () => {
    return [
      {
        title: 'Verify Your Identity',
        description: 'Complete identity verification to reduce your risk score by up to 15 points and access better interest rates.',
        impact: 'high',
        type: 'verification'
      },
      {
        title: 'Increase Collateral Ratio',
        description: 'Your current health factor is 1.4. Consider adding more collateral to improve loan safety.',
        impact: 'medium',
        type: 'collateral'
      },
      {
        title: 'Use IOTA Network for Lower Fees',
        description: 'Switch to IOTA network for your transactions to benefit from lower fees and faster transaction times.',
        impact: 'high',
        type: 'network'
      },
      {
        title: 'Optimize Yield Strategy',
        description: 'Based on your risk profile, you could earn 2.3% more APY by switching to our optimized strategy.',
        impact: 'medium',
        type: 'yield'
      },
      {
        title: 'Diversify Collateral',
        description: 'Using multiple assets as collateral can reduce your liquidation risk during market volatility.',
        impact: 'low',
        type: 'strategy'
      }
    ];
  },
  
  // Mock network data for blockchain explorer
  getLatestBlocks: async () => {
    try {
      // In a real app, this would be an API call
      const currentTime = Date.now();
      
      // Generate blocks with timestamps 10-30 seconds apart
      const blocks = [];
      for (let i = 0; i < 10; i++) {
        const blockNumber = 127 - i;
        const timestamp = currentTime - (i * (10000 + Math.floor(Math.random() * 20000)));
        const txCount = Math.floor(Math.random() * 3) + 1;
        
        blocks.push({
          number: blockNumber,
          timestamp,
          transactions: txCount,
          validator: '0x' + Math.random().toString(16).substring(2, 42),
          size: Math.floor(Math.random() * 1000) + 500,
          gasUsed: Math.floor(Math.random() * 10000) + 5000,
        });
      }
      
      return { blocks };
    } catch (error) {
      console.error('Error getting latest blocks:', error);
      return { blocks: [] };
    }
  },
  
  // Mock transaction data for blockchain explorer
  getLatestTransactions: async () => {
    try {
      // In a real app, this would be an API call
      const currentTime = Date.now();
      
      // Generate transactions with timestamps 10-30 seconds apart
      const transactions = [];
      for (let i = 0; i < 10; i++) {
        const timestamp = currentTime - (i * (10000 + Math.floor(Math.random() * 20000)));
        const value = Math.random() * 10;
        const fee = Math.random() * 0.0001;
        
        transactions.push({
          hash: '0x' + Math.random().toString(16).substring(2, 66),
          type: ['Transfer', 'Contract Call', 'Contract Creation'][Math.floor(Math.random() * 3)],
          timestamp,
          from: '0x' + Math.random().toString(16).substring(2, 42),
          to: '0x' + Math.random().toString(16).substring(2, 42),
          value,
          fee,
          status: Math.random() > 0.1 ? 'Success' : 'Failed'
        });
      }
      
      return { transactions };
    } catch (error) {
      console.error('Error getting latest transactions:', error);
      return { transactions: [] };
    }
  }
};

export default apiService;