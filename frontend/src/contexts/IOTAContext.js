import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

/**
 * IOTA Context for wallet connectivity and interactions
 * 
 * This context provides functionality for connecting to IOTA wallets,
 * managing addresses, and interacting with the IOTA network.
 */

// Create the context
const IOTAContext = createContext();

// Custom hook for using the IOTA context
export const useIOTAContext = () => useContext(IOTAContext);

// IOTA Provider component
export const IOTAProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  
  // API wrapper for IOTA operations
  const api = {
    /**
     * Generate a new IOTA address
     * @returns {Promise<string>} The new address
     */
    generateAddress: async () => {
      try {
        const response = await axios.get('/api/iota/address');
        return response.data.address;
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to generate address');
        throw error;
      }
    },
    
    /**
     * Get balance for an address
     * @param {string} addr - The address to check (defaults to current address)
     * @returns {Promise<Object>} Balance information
     */
    getBalance: async (addr = null) => {
      try {
        const addressToCheck = addr || address;
        if (!addressToCheck) throw new Error('No address specified');
        
        const response = await axios.get(`/api/iota/balance/${addressToCheck}`);
        
        // If checking current address, update the state
        if (addressToCheck === address) {
          setBalance(response.data);
        }
        
        return response.data;
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to get balance');
        throw error;
      }
    },
    
    /**
     * Send IOTA tokens
     * @param {string} recipient - Recipient address
     * @param {string} amount - Amount to send
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Transaction information
     */
    sendTokens: async (recipient, amount, options = {}) => {
      try {
        if (!connected) throw new Error('Wallet not connected');
        
        const response = await axios.post('/api/iota/send', {
          address: recipient,
          amount: amount,
          tag: options.tag,
          message: options.message
        });
        
        // Update balance after sending
        await api.getBalance();
        
        return response.data;
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to send tokens');
        throw error;
      }
    },
    
    /**
     * Get transaction history
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Transaction history
     */
    getTransactions: async (options = {}) => {
      try {
        if (!connected) throw new Error('Wallet not connected');
        
        const response = await axios.get('/api/iota/transactions', {
          params: options
        });
        
        // Update transactions state
        setTransactions(response.data.transactions);
        
        return response.data.transactions;
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to get transactions');
        throw error;
      }
    },
    
    /**
     * Store data on the Tangle
     * @param {Object} data - Data to store
     * @param {string} tag - Optional tag
     * @returns {Promise<Object>} Block information
     */
    storeData: async (data, tag = 'INTELLILEND') => {
      try {
        const response = await axios.post('/api/iota/submit', {
          data,
          tag
        });
        
        return response.data;
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to store data');
        throw error;
      }
    },
    
    /**
     * Get network information
     * @returns {Promise<Object>} Network information
     */
    getNetworkInfo: async () => {
      try {
        const response = await axios.get('/api/iota/network');
        return response.data;
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to get network information');
        throw error;
      }
    }
  };
  
  /**
   * Connect to IOTA wallet
   * @param {Object} options - Connection options
   * @returns {Promise<boolean>} Connection success
   */
  const connectWallet = async (options = {}) => {
    try {
      setConnecting(true);
      setError(null);
      
      // Since we don't have a direct wallet connection in the browser yet,
      // we'll simulate a connection by generating an address from the backend
      const addr = options.address || await api.generateAddress();
      setAddress(addr);
      
      // Get initial balance
      const balanceData = await api.getBalance(addr);
      setBalance(balanceData);
      
      // Get transaction history
      await api.getTransactions();
      
      setConnected(true);
      return true;
    } catch (error) {
      console.error('Error connecting to IOTA wallet:', error);
      setError(error.message || 'Failed to connect wallet');
      return false;
    } finally {
      setConnecting(false);
    }
  };
  
  /**
   * Disconnect from IOTA wallet
   */
  const disconnectWallet = () => {
    setConnected(false);
    setAddress(null);
    setBalance(null);
    setTransactions([]);
  };
  
  // Context value
  const contextValue = {
    connected,
    connecting,
    address,
    balance,
    error,
    transactions,
    connectWallet,
    disconnectWallet,
    api
  };
  
  return (
    <IOTAContext.Provider value={contextValue}>
      {children}
    </IOTAContext.Provider>
  );
};

export default IOTAContext;
