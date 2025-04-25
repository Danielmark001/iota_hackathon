import axios from 'axios';

// Create axios instance with base URL and default configs
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
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
  // User profile
  getUserProfile: async (address) => {
    try {
      const response = await api.get(`/api/user/${address}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  },
  
  // Market data
  getMarketData: async () => {
    try {
      const response = await api.get('/api/market');
      return response.data;
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  },
  
  // Historical data
  getHistoricalData: async (address) => {
    try {
      const response = await api.get(`/api/history/${address}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching historical data:', error);
      throw error;
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
  
  // Get recommendations
  getRecommendations: async (address) => {
    try {
      const response = await api.get(`/api/recommendations/${address}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching recommendations:', error);
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
      throw error;
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
  }
};

export default apiService;
