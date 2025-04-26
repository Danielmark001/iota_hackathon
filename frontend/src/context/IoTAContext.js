import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSnackbar } from './SnackbarContext';
// Import IOTA dApp Kit components
import { useWallet, useConnect, useDisconnect, useBalance } from '@iota/dapp-kit';

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
  
  // Use IOTA dApp Kit hooks
  const { wallet, client, activeAddress, status } = useWallet();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletBalance } = useBalance(activeAddress);
  
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
  
  // Update connection status based on wallet connection
  useEffect(() => {
    if (status === 'connected' && activeAddress) {
      setIsConnected(true);
      setAddress(activeAddress);
      showSnackbar('Wallet connected successfully', 'success');
    } else {
      setIsConnected(status === 'connected');
    }
  }, [status, activeAddress, showSnackbar]);
  
  // Update balance when wallet balance changes
  useEffect(() => {
    if (walletBalance) {
      const baseAmount = walletBalance.base.toString();
      const baseAmountFormatted = 
        Number(baseAmount) / 1_000_000 + ' ' + (network === 'mainnet' ? 'IOTA' : 'SMR');
      
      setBalance({
        baseCoins: baseAmount,
        baseCoinsFormatted: baseAmountFormatted,
        nativeTokens: walletBalance.nativeTokens || []
      });
    }
  }, [walletBalance, network]);
  
  // Initialize IOTA connection with priority on direct wallet connection
  const initConnection = useCallback(async () => {
    try {
      setIsConnecting(true);
      
      // First try to connect to a wallet directly - this is the preferred method
      if (wallet) {
        try {
          await connect();
          return; // If wallet connection succeeds, we're done
        } catch (walletError) {
          console.warn('Direct wallet connection failed:', walletError);
          // Instead of falling back, we'll retry with a different approach
          try {
            // Try different connection method if available
            if (typeof window.iota !== 'undefined') {
              await window.iota.connect();
              return;
            }
            
            // Try connecting with a delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            await connect();
            return;
          } catch (retryError) {
            console.error('All wallet connection attempts failed:', retryError);
            // Now try backend as last resort
          }
        }
      }
      
      // As a last resort, try connecting via backend API
      const healthResponse = await axios.get(`${apiUrl}/health`);
      
      if (healthResponse.data?.iota?.status === 'healthy') {
        setIsConnected(true);
        setNetwork(healthResponse.data.iota.network);
        showSnackbar(`Connected to ${NETWORKS[healthResponse.data.iota.network]?.name || healthResponse.data.iota.network}`, 'success');
      } else {
        throw new Error('IOTA node connection unavailable');
      }
    } catch (error) {
      console.error('Error connecting to IOTA:', error);
      setIsConnected(false);
      showSnackbar('Failed to connect to IOTA network. Please ensure you have a compatible wallet installed.', 'error');
    } finally {
      setIsConnecting(false);
    }
  }, [apiUrl, showSnackbar, wallet, connect]);
  
  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      if (status === 'connected') {
        await disconnect();
        showSnackbar('Wallet disconnected', 'info');
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      showSnackbar('Failed to disconnect wallet', 'error');
    }
  }, [disconnect, status, showSnackbar]);
  
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
  
  // Send IOTA tokens - prioritizes direct wallet connection
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
      
      // Always try to use the connected wallet directly
      if (wallet && status === 'connected') {
        try {
          // Convert amount to base units (glow) - 1 SMR = 1,000,000 glow
          const amountInGlow = BigInt(Math.floor(Number(amount) * 1_000_000)).toString();
          
          // Create the transaction
          const transaction = {
            address: recipientAddress,
            amount: amountInGlow,
            tag: 'IntelliLend'
          };
          
          // Send the transaction with retry logic
          let result;
          try {
            // First attempt
            result = await wallet.send(transaction);
          } catch (firstAttemptError) {
            console.warn('First transaction attempt failed, retrying:', firstAttemptError);
            
            // Wait a moment and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            result = await wallet.send(transaction);
          }
          
          showSnackbar(`Sent ${amount} SMR successfully`, 'success');
          await getBalance(); // Refresh balance after sending
          
          return {
            success: true,
            blockId: result.blockId,
            transactionId: result.transactionId,
            amount,
            recipient: recipientAddress
          };
        } catch (walletError) {
          console.error('Wallet send error:', walletError);
          showSnackbar(`Wallet error: ${walletError.message}. Please ensure your wallet is properly connected.`, 'error');
          throw walletError; // Throw instead of returning null to prevent falling back
        }
      } else {
        // If wallet is not connected, direct the user to connect one
        showSnackbar('Please connect your IOTA wallet to send tokens', 'warning');
        throw new Error('Wallet not connected');
      }
    } catch (error) {
      console.error('Error sending IOTA tokens:', error);
      showSnackbar(error.response?.data?.message || 'Failed to send IOTA tokens', 'error');
      throw error;
    }
  }, [apiUrl, getBalance, isConnected, showSnackbar, wallet, status]);
  
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
    // State
    isConnected,
    isConnecting,
    network,
    networkInfo: NETWORKS[network] || NETWORKS.testnet,
    address,
    balance,
    
    // Wallet status from dApp Kit
    walletStatus: status,
    wallet,
    client,
    activeAddress,
    
    // Methods
    initConnection,
    disconnectWallet,
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
