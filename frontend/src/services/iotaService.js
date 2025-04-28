import axios from 'axios';

// Get API URL from environment or use default
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/**
 * IOTA Service
 * 
 * A service for interacting with IOTA-related backend APIs.
 * Handles all IOTA wallet, identity, streams, and cross-layer operations.
 */
const iotaService = {
  /**
   * Check IOTA node health
   * @returns {Promise<Object>} Health status
   */
  checkHealth: async () => {
    try {
      const response = await axios.get(`${API_URL}/health`);
      return response.data;
    } catch (error) {
      console.error('Error checking IOTA health:', error);
      throw error;
    }
  },
  
  /**
   * Generate a new IOTA address
   * @param {Object} options - Options for generating address
   * @returns {Promise<Object>} Generated address info
   */
  generateAddress: async (options = {}) => {
    try {
      // Get auth token if available
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Add query parameters if provided
      const queryParams = new URLSearchParams();
      if (options.label) {
        queryParams.append('label', options.label);
      }
      
      const response = await axios.get(
        `${API_URL}/api/iota/address?${queryParams}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error generating IOTA address:', error);
      throw error;
    }
  },
  
  /**
   * Get balance for an IOTA address
   * @param {string} address - IOTA address
   * @param {Object} options - Options for checking balance
   * @returns {Promise<Object>} Balance info
   */
  getBalance: async (address, options = {}) => {
    try {
      // Add query parameters
      const queryParams = new URLSearchParams();
      if (options.includeTransactions) {
        queryParams.append('includeTransactions', 'true');
      }
      
      const response = await axios.get(
        `${API_URL}/api/iota/balance/${address}?${queryParams}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting IOTA balance:', error);
      throw error;
    }
  },
  
  /**
   * Send IOTA tokens
   * @param {Object} data - Transaction data
   * @param {string} data.address - Recipient address
   * @param {string} data.amount - Amount to send
   * @param {string} data.tag - Optional tag
   * @param {string} data.message - Optional message
   * @returns {Promise<Object>} Transaction result
   */
  sendTokens: async (data) => {
    try {
      // Get auth token if available
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.post(
        `${API_URL}/api/iota/send`,
        data,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending IOTA tokens:', error);
      throw error;
    }
  },
  
  /**
   * Submit data to IOTA Tangle
   * @param {Object} data - Data to submit
   * @param {string} tag - Optional tag
   * @returns {Promise<Object>} Submission result
   */
  submitData: async (data, tag = 'IntelliLend') => {
    try {
      const response = await axios.post(
        `${API_URL}/api/iota/submit`,
        { data, tag }
      );
      return response.data;
    } catch (error) {
      console.error('Error submitting data to IOTA Tangle:', error);
      throw error;
    }
  },
  
  /**
   * Get network information
   * @returns {Promise<Object>} Network info
   */
  getNetworkInfo: async () => {
    try {
      const response = await axios.get(`${API_URL}/api/iota/network`);
      return response.data;
    } catch (error) {
      console.error('Error getting IOTA network information:', error);
      throw error;
    }
  },
  
  /**
   * Get transactions for an account
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Transaction list
   */
  getTransactions: async (options = {}) => {
    try {
      // Get auth token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Create query parameters
      const queryParams = new URLSearchParams();
      
      if (options.limit) queryParams.append('limit', options.limit);
      if (options.type !== undefined) queryParams.append('type', options.type);
      if (options.from) queryParams.append('from', options.from);
      if (options.to) queryParams.append('to', options.to);
      if (options.minValue) queryParams.append('minValue', options.minValue);
      if (options.tag) queryParams.append('tag', options.tag);
      
      const response = await axios.get(
        `${API_URL}/api/iota/transactions?${queryParams}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting IOTA transactions:', error);
      throw error;
    }
  },
  
  /**
   * Check transaction status
   * @param {string} transactionId - Transaction ID to check
   * @returns {Promise<Object>} Transaction status
   */
  checkTransactionStatus: async (transactionId) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/iota/transaction/${transactionId}/status`
      );
      return response.data;
    } catch (error) {
      console.error('Error checking transaction status:', error);
      throw error;
    }
  },
  
  /**
   * Create a new identity (DID)
   * @param {string} ethereumAddress - Ethereum address to associate with DID
   * @returns {Promise<Object>} Created identity info
   */
  createIdentity: async (ethereumAddress) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/iota/identity/create`,
        { ethereumAddress }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating IOTA identity:', error);
      throw error;
    }
  },
  
  /**
   * Create a verifiable credential
   * @param {Object} data - Credential data
   * @returns {Promise<Object>} Created credential info
   */
  createCredential: async (data) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/iota/identity/credential`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Error creating credential:', error);
      throw error;
    }
  },
  
  /**
   * Verify identity with credential
   * @param {Object} data - Verification data
   * @param {string} data.did - DID
   * @param {Object} data.credential - Verifiable credential
   * @param {string} data.ethereumAddress - Ethereum address
   * @returns {Promise<Object>} Verification result
   */
  verifyIdentity: async (data) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/iota/identity/verify`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Error verifying identity:', error);
      throw error;
    }
  },
  
  /**
   * Create a new IOTA Streams channel
   * @param {Object} data - Channel data
   * @param {string} data.name - Channel name
   * @param {string} data.description - Channel description
   * @param {string} data.owner - Owner address
   * @returns {Promise<Object>} Created channel info
   */
  createChannel: async (data) => {
    try {
      // Get auth token if available
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.post(
        `${API_URL}/api/iota/streams/channel`,
        data,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating Streams channel:', error);
      throw error;
    }
  },
  
  /**
   * Join an existing IOTA Streams channel
   * @param {Object} data - Join data
   * @param {string} data.channelAddress - Channel address
   * @param {string} data.subscriber - Subscriber address
   * @returns {Promise<Object>} Join result
   */
  joinChannel: async (data) => {
    try {
      // Get auth token if available
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.post(
        `${API_URL}/api/iota/streams/subscribe`,
        data,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error joining Streams channel:', error);
      throw error;
    }
  },
  
  /**
   * Get channels for a user
   * @param {string} address - User address
   * @returns {Promise<Object>} User's channels
   */
  getUserChannels: async (address) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/iota/streams/channels/${address}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting user channels:', error);
      throw error;
    }
  },
  
  /**
   * Get messages from a channel
   * @param {string} channelId - Channel ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Channel messages
   */
  getChannelMessages: async (channelId, options = {}) => {
    try {
      // Get auth token if available
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Create query parameters
      const queryParams = new URLSearchParams();
      
      if (options.limit) queryParams.append('limit', options.limit);
      if (options.fromTimestamp) queryParams.append('fromTimestamp', options.fromTimestamp);
      
      const response = await axios.get(
        `${API_URL}/api/iota/streams/messages/${channelId}?${queryParams}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting channel messages:', error);
      throw error;
    }
  },
  
  /**
   * Send a message to a channel
   * @param {Object} data - Message data
   * @param {string} data.channelId - Channel ID
   * @param {string} data.messageType - Message type
   * @param {string} data.content - Message content
   * @param {string} data.sender - Sender address
   * @returns {Promise<Object>} Sent message info
   */
  sendMessage: async (data) => {
    try {
      // Get auth token if available
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.post(
        `${API_URL}/api/iota/streams/message`,
        data,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },
  
  /**
   * Send a file to a channel
   * @param {FormData} formData - Form data with file and metadata
   * @returns {Promise<Object>} Sent file info
   */
  sendFile: async (formData) => {
    try {
      // Get auth token if available
      const token = localStorage.getItem('auth_token');
      const headers = token 
        ? { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        : { 'Content-Type': 'multipart/form-data' };
      
      const response = await axios.post(
        `${API_URL}/api/iota/streams/file`,
        formData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending file:', error);
      throw error;
    }
  },
  
  /**
   * Send a cross-layer message
   * @param {Object} data - Message data
   * @param {string} data.targetAddress - Target address
   * @param {string} data.messageType - Message type
   * @param {Object} data.payload - Message payload
   * @returns {Promise<Object>} Message result
   */
  sendCrossLayerMessage: async (data) => {
    try {
      // Get auth token if available
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.post(
        `${API_URL}/api/cross-layer/send`,
        data,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending cross-layer message:', error);
      throw error;
    }
  },
  
  /**
   * Check cross-layer message status
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>} Message status
   */
  checkCrossLayerMessageStatus: async (messageId) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/cross-layer/status/${messageId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error checking cross-layer message status:', error);
      throw error;
    }
  },
  
  /**
   * Get cross-layer messages for a user
   * @param {string} address - User address
   * @returns {Promise<Object>} Cross-layer messages
   */
  getCrossLayerMessages: async (address) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/cross-layer/messages/${address}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting cross-layer messages:', error);
      throw error;
    }
  },
  
  /**
   * Get cross-layer transactions
   * @param {string} address - User address
   * @returns {Promise<Object>} Cross-layer transactions
   */
  getCrossLayerTransactions: async (address) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/cross-layer/transactions/${address}`
      );
      return response.data || { transactions: [] };
    } catch (error) {
      console.error('Error getting cross-layer transactions:', error);
      return { transactions: [] };
    }
  },
  
  /**
   * Get bridge messages
   * @param {string} address - User address
   * @returns {Promise<Object>} Bridge messages
   */
  getBridgeMessages: async (address) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/bridge/messages/${address}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting bridge messages:', error);
      throw error;
    }
  },
  
  /**
   * Get liquidation events
   * @returns {Promise<Object>} Liquidation events
   */
  getLiquidationEvents: async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/liquidations`
      );
      return response.data || { events: [] };
    } catch (error) {
      console.error('Error getting liquidation events:', error);
      return { events: [] };
    }
  },
  
  /**
   * Get cross-layer stats
   * @returns {Promise<Object>} Cross-layer stats
   */
  getCrossLayerStats: async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/cross-layer/stats`
      );
      return response.data || {
        l1TotalValue: 0,
        l2TotalValue: 0,
        crossLayerTransactions: 0,
        riskAssessmentEvents: 0
      };
    } catch (error) {
      console.error('Error getting cross-layer stats:', error);
      return {
        l1TotalValue: 0,
        l2TotalValue: 0,
        crossLayerTransactions: 0,
        riskAssessmentEvents: 0
      };
    }
  }
};

export default iotaService;
