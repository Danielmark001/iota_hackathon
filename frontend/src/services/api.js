/**
 * API Service - Handles communication with the backend API
 */
import axios from 'axios';

// API base URL, could be loaded from environment variables
const API_BASE_URL = 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Get user data from the API
 * @param {string} address - User's wallet address
 * @returns {Promise<Object>} User data
 */
export const getUserData = async (address) => {
  try {
    const response = await api.get(`/api/user/${address}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
};

/**
 * Get market data from the API
 * @returns {Promise<Object>} Market data
 */
export const getMarketData = async () => {
  try {
    const response = await api.get('/api/market');
    return response.data;
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error;
  }
};

/**
 * Get risk assessment for a user
 * @param {string} address - User's wallet address
 * @param {Object} onChainData - Optional on-chain data
 * @returns {Promise<Object>} Risk assessment data
 */
export const getRiskAssessment = async (address, onChainData = null) => {
  try {
    const response = await api.post('/api/risk-assessment', {
      address,
      onChainData,
    });
    return response.data;
  } catch (error) {
    console.error('Error getting risk assessment:', error);
    throw error;
  }
};

/**
 * Get bridge messages for a user
 * @param {string} address - User's wallet address
 * @returns {Promise<Array>} List of bridge messages
 */
export const getBridgeMessages = async (address) => {
  try {
    const response = await api.get(`/api/bridge/messages/${address}`);
    return response.data.messages;
  } catch (error) {
    console.error('Error fetching bridge messages:', error);
    throw error;
  }
};

/**
 * Get recommendations for a user
 * @param {string} address - User's wallet address
 * @returns {Promise<Array>} List of recommendations
 */
export const getRecommendations = async (address) => {
  try {
    const response = await api.get(`/api/recommendations/${address}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }
};

/**
 * Check API health status
 * @returns {Promise<boolean>} True if API is healthy
 */
export const checkApiHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data.status === 'ok';
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
};

export default {
  getUserData,
  getMarketData,
  getRiskAssessment,
  getBridgeMessages,
  getRecommendations,
  checkApiHealth,
};
