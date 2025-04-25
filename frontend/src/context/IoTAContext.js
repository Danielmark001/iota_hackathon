import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSnackbar } from './SnackbarContext';

// Create context
const IoTAContext = createContext(null);

// IOTA network options
const NETWORKS = {
  mainnet: {
    name: 'IOTA Mainnet',
    endpoint: 'https://api.shimmer.network',
    explorer: 'https://explorer.shimmer.network/shimmer'
  },
  testnet: {
    name: 'IOTA Testnet',
    endpoint: 'https://api.testnet.shimmer.network',
    explorer: 'https://explorer.shimmer.network/testnet'
  },
  devnet: {
    name: 'IOTA Devnet',
    endpoint: 'https://api.testnet.shimmer.network',
    explorer: 'https://explorer.shimmer.network/testnet'
  }
};

// Provider component
export const IoTAProvider = ({ children }) => {
  const { showSnackbar } = useSnackbar();
  
  // State variables
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [network, setNetwork] = useState('testnet'); // Default to testnet
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState({
    baseCoins: 0,
    baseCoinsFormatted: '0 SMR',
    nativeTokens: []
  });
  
  // API endpoint - would normally be from environment variables
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  
  // Initialize IOTA connection via backend API
  const initConnection = useCallback(async () => {
    try {
      setIsConnecting(true);
      
      // Check if backend is connected to IOTA
      const healthResponse = await axios.get(`${apiUrl}/health`);
      
      if (healthResponse.data?.iota?.status === 'healthy') {
        setIsConnected(true);
        setNetwork(healthResponse.data.iota.network);
        showSnackbar(`Connected to ${NETWORKS[healthResponse.data.iota.network]?.name || healthResponse.data.iota.network}`, 'success');
      } else {
        setIsConnected(false);
        showSnackbar('IOTA node connection unavailable', 'error');
      }
    } catch (error) {
      console.error('Error connecting to IOTA:', error);
      setIsConnected(false);
      showSnackbar('Failed to connect to IOTA network', 'error');
    } finally {
      setIsConnecting(false);
    }
  }, [apiUrl, showSnackbar]);
  
  // Initialize connection on component mount
  useEffect(() => {
    initConnection();
  }, [initConnection]);
  
  // Generate a new IOTA address
  const generateAddress = useCallback(async () => {
    try {
      if (!isConnected) {
        showSnackbar('IOTA connection required', 'warning');
        return null;
      }
      
      const response = await axios.get(`${apiUrl}/api/iota/address`);
      
      if (response.data?.address) {
        setAddress(response.data.address);
        showSnackbar('New IOTA address generated', 'success');
        return response.data.address;
      }
      
      return null;
    } catch (error) {
      console.error('Error generating IOTA address:', error);
      showSnackbar('Failed to generate IOTA address', 'error');
      return null;
    }
  }, [apiUrl, isConnected, showSnackbar]);
  
  // Get IOTA balance for an address
  const getBalance = useCallback(async (addressToCheck) => {
    try {
      if (!isConnected) {
        showSnackbar('IOTA connection required', 'warning');
        return null;
      }
      
      const targetAddress = addressToCheck || address;
      
      if (!targetAddress) {
        showSnackbar('Address required to check balance', 'warning');
        return null;
      }
      
      const response = await axios.get(`${apiUrl}/api/iota/balance/${targetAddress}`);
      
      if (response.data) {
        setBalance(response.data);
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error checking IOTA balance:', error);
      showSnackbar('Failed to check IOTA balance', 'error');
      return null;
    }
  }, [apiUrl, address, isConnected, showSnackbar]);
  
  // Send IOTA tokens
  const sendTokens = useCallback(async (recipientAddress, amount) => {
    try {
      if (!isConnected) {
        showSnackbar('IOTA connection required', 'warning');
        return null;
      }
      
      if (!recipientAddress || !amount) {
        showSnackbar('Recipient address and amount required', 'warning');
        return null;
      }
      
      // Get authentication token if using secure endpoints
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.post(
        `${apiUrl}/api/iota/send`,
        { address: recipientAddress, amount },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      
      if (response.data?.success) {
        showSnackbar(`Sent ${amount} SMR successfully`, 'success');
        // Refresh balance after sending
        await getBalance();
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error sending IOTA tokens:', error);
      showSnackbar(error.response?.data?.message || 'Failed to send IOTA tokens', 'error');
      return null;
    }
  }, [apiUrl, getBalance, isConnected, showSnackbar]);
  
  // Submit data to IOTA Tangle
  const submitData = useCallback(async (data, tag = 'IntelliLend') => {
    try {
      if (!isConnected) {
        showSnackbar('IOTA connection required', 'warning');
        return null;
      }
      
      if (!data) {
        showSnackbar('Data required for submission', 'warning');
        return null;
      }
      
      const response = await axios.post(`${apiUrl}/api/iota/submit`, { data, tag });
      
      if (response.data?.success) {
        showSnackbar('Data submitted to IOTA Tangle', 'success');
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error submitting data to IOTA Tangle:', error);
      showSnackbar('Failed to submit data to IOTA Tangle', 'error');
      return null;
    }
  }, [apiUrl, isConnected, showSnackbar]);
  
  // Get explorer URL for an address
  const getExplorerUrl = useCallback((addressToView) => {
    const currentNetwork = NETWORKS[network] || NETWORKS.testnet;
    const viewAddress = addressToView || address;
    
    if (!viewAddress) return null;
    
    return `${currentNetwork.explorer}/addr/${viewAddress}`;
  }, [address, network]);
  
  // Change network
  const changeNetwork = useCallback(async (newNetwork) => {
    // This would require backend changes to support switching networks
    // For now, we'll just update the local state
    if (newNetwork && NETWORKS[newNetwork]) {
      setNetwork(newNetwork);
      showSnackbar(`Switched to ${NETWORKS[newNetwork].name}`, 'info');
      
      // Reconnect to reinitialize with new network
      await initConnection();
      return true;
    }
    
    return false;
  }, [initConnection, showSnackbar]);
  
  // Value object to be provided by context
  const value = {
    isConnected,
    isConnecting,
    network,
    networkInfo: NETWORKS[network] || NETWORKS.testnet,
    address,
    balance,
    initConnection,
    generateAddress,
    getBalance,
    sendTokens,
    submitData,
    getExplorerUrl,
    changeNetwork
  };
  
  return <IoTAContext.Provider value={value}>{children}</IoTAContext.Provider>;
};

// Custom hook for using the IOTA context
export const useIoTA = () => {
  const context = useContext(IoTAContext);
  
  if (!context) {
    throw new Error('useIoTA must be used within an IoTAProvider');
  }
  
  return context;
};
