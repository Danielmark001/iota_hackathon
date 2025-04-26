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
    explorer: 'https://explorer.shimmer.network/shimmer',
    evm_explorer: 'https://explorer.evm.iota.org',
    evm_rpc: 'https://json-rpc.evm.iotaledger.net',
    chain_id: 1074
  },
  testnet: {
    name: 'IOTA Testnet',
    endpoint: 'https://api.testnet.shimmer.network',
    explorer: 'https://explorer.shimmer.network/testnet',
    evm_explorer: 'https://explorer.evm.testnet.iota.cafe',
    evm_rpc: 'https://json-rpc.evm.testnet.iota.cafe',
    chain_id: 1075
  },
  devnet: {
    name: 'IOTA Devnet',
    endpoint: 'https://api.testnet.shimmer.network',
    explorer: 'https://explorer.shimmer.network/testnet',
    evm_explorer: 'https://explorer.evm.testnet.iota.cafe',
    evm_rpc: 'https://json-rpc.evm.testnet.iota.cafe',
    chain_id: 1075
  }
};

// Wallet display information
const WALLET_INFO = {
  firefly: {
    name: 'Firefly',
    logo: '/images/wallets/firefly-logo.png',
    installUrl: 'https://firefly.iota.org/',
    description: 'IOTA\'s official wallet'
  },
  tanglepay: {
    name: 'TanglePay',
    logo: '/images/wallets/tanglepay-logo.png',
    installUrl: 'https://tanglepay.com/',
    description: 'Mobile and browser extension wallet'
  },
  bloom: {
    name: 'Bloom',
    logo: '/images/wallets/bloom-logo.png',
    installUrl: 'https://bloomwallet.io/',
    description: 'Modern wallet for IOTA'
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
  const [walletType, setWalletType] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  
  // API endpoint - would normally be from environment variables
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  
  // Determine wallet type from connection
  const determineWalletType = useCallback(() => {
    if (!wallet) return null;
    
    if (typeof window.iota !== 'undefined') {
      return 'firefly';
    } else if (typeof window.tanglepay !== 'undefined') {
      return 'tanglepay';
    } else if (typeof window.bloom !== 'undefined') {
      return 'bloom';
    }
    
    // Default to firefly if can't determine
    return 'firefly';
  }, [wallet]);
  
  // Update connection status based on wallet connection
  useEffect(() => {
    if (status === 'connected' && activeAddress) {
      setIsConnected(true);
      setAddress(activeAddress);
      setWalletType(determineWalletType());
      setConnectionError(null);
      showSnackbar('Wallet connected successfully', 'success');
    } else {
      setIsConnected(status === 'connected');
      
      if (status === 'error') {
        setConnectionError('Failed to connect to wallet. Please try again.');
      } else if (status === 'connecting') {
        setConnectionError(null);
      }
    }
  }, [status, activeAddress, showSnackbar, determineWalletType]);
  
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
  const initConnection = useCallback(async (preferredWallet = null) => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      // First try to connect to a wallet directly - this is the preferred method
      if (wallet) {
        try {
          // If a preferred wallet is specified, try to use it
          if (preferredWallet) {
            // Different wallet connections might have different methods
            // This is a simplification - in reality you would need to check
            // for each wallet type and use its specific connection method
            await connect({ wallet: preferredWallet });
            setWalletType(preferredWallet);
            return;
          } else {
            // Default connection attempt
            await connect();
            setWalletType(determineWalletType());
            return;
          }
        } catch (walletError) {
          console.warn(`Wallet connection failed (${preferredWallet || 'default'}):`, walletError);
          
          // Provide more specific error messages based on error type
          if (walletError.message && walletError.message.includes('not found')) {
            setConnectionError(`Wallet extension not detected. Please install a compatible IOTA wallet.`);
          } else if (walletError.message && walletError.message.includes('permission')) {
            setConnectionError('Connection permission denied. Please accept the connection request in your wallet.');
          } else if (walletError.message && walletError.message.includes('timeout')) {
            setConnectionError('Connection timed out. Please try again or check if your wallet is running.');
          } else {
            setConnectionError(`Wallet connection failed: ${walletError.message}`);
          }
          
          // Try different connection approaches as fallbacks
          try {
            // Try alternative wallet connection methods if available
            if (typeof window.iota !== 'undefined' && (!preferredWallet || preferredWallet === 'firefly')) {
              await window.iota.connect();
              setWalletType('firefly');
              return;
            } else if (typeof window.tanglepay !== 'undefined' && (!preferredWallet || preferredWallet === 'tanglepay')) {
              await window.tanglepay.connect();
              setWalletType('tanglepay');
              return;
            } else if (typeof window.bloom !== 'undefined' && (!preferredWallet || preferredWallet === 'bloom')) {
              await window.bloom.connect();
              setWalletType('bloom');
              return;
            }
            
            // If we've reached here and still have a preferred wallet, try a generic connection
            if (preferredWallet) {
              // Try connecting with a delay and retry
              await new Promise(resolve => setTimeout(resolve, 1000));
              await connect();
              setWalletType(determineWalletType());
              return;
            }
          } catch (retryError) {
            console.error('All wallet connection attempts failed:', retryError);
            setConnectionError('Failed to connect to any wallet. Please ensure you have a compatible wallet installed and try again.');
          }
        }
      }
      
      // As a last resort, try connecting via backend API if no specific wallet was requested
      if (!preferredWallet) {
        try {
          const healthResponse = await axios.get(`${apiUrl}/health`);
          
          if (healthResponse.data?.iota?.status === 'healthy') {
            setIsConnected(true);
            setNetwork(healthResponse.data.iota.network);
            setConnectionError(null);
            showSnackbar(`Connected to ${NETWORKS[healthResponse.data.iota.network]?.name || healthResponse.data.iota.network} via backend`, 'info');
            return;
          } else {
            throw new Error('IOTA node connection unavailable');
          }
        } catch (backendError) {
          console.error('Backend connection failed:', backendError);
          setConnectionError('Failed to connect to IOTA backend. Please ensure the backend services are running.');
        }
      }
      
      throw new Error('All connection attempts failed');
    } catch (error) {
      console.error('Error connecting to IOTA:', error);
      setIsConnected(false);
      if (!connectionError) {
        setConnectionError('Failed to connect to IOTA network. Please ensure you have a compatible wallet installed.');
      }
      showSnackbar('Failed to connect to IOTA network. Please ensure you have a compatible wallet installed.', 'error');
    } finally {
      setIsConnecting(false);
    }
  }, [apiUrl, showSnackbar, wallet, connect, determineWalletType, connectionError]);
  
  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      if (status === 'connected') {
        await disconnect();
        setWalletType(null);
        setConnectionError(null);
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
      
      if (wallet && status === 'connected') {
        try {
          // Try to generate address with connected wallet
          // This is a simplified example - actual implementation depends on the wallet API
          if (wallet.generateAddress) {
            const newAddress = await wallet.generateAddress();
            setAddress(newAddress);
            showSnackbar('New IOTA address generated', 'success');
            return newAddress;
          }
        } catch (walletError) {
          console.warn('Wallet address generation failed:', walletError);
          // Fall back to backend API
        }
      }
      
      // Fall back to backend API
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
  }, [apiUrl, isConnected, showSnackbar, wallet, status]);
  
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
      
      // First try with dApp Kit balance if it's the active address
      if (walletBalance && targetAddress === activeAddress) {
        const baseAmount = walletBalance.base.toString();
        const baseAmountFormatted = 
          Number(baseAmount) / 1_000_000 + ' ' + (network === 'mainnet' ? 'IOTA' : 'SMR');
        
        const balanceResult = {
          baseCoins: baseAmount,
          baseCoinsFormatted: baseAmountFormatted,
          nativeTokens: walletBalance.nativeTokens || []
        };
        
        setBalance(balanceResult);
        return balanceResult;
      }
      
      // Fall back to API
      const response = await axios.get(`${apiUrl}/api/iota/balance/${targetAddress}`);
      
      if (response.data) {
        if (targetAddress === address) {
          setBalance(response.data);
        }
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error checking IOTA balance:', error);
      showSnackbar('Failed to check IOTA balance', 'error');
      return null;
    }
  }, [apiUrl, address, activeAddress, isConnected, network, showSnackbar, walletBalance]);
  
  // Send IOTA tokens - prioritizes direct wallet connection
  const sendTokens = useCallback(async (recipientAddress, amount, options = {}) => {
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
            tag: options.tag || 'IntelliLend',
            data: options.data || null
          };
          
          // Send the transaction with retry logic
          let result;
          try {
            // First attempt
            result = await wallet.send(transaction);
          } catch (firstAttemptError) {
            console.warn('First transaction attempt failed, retrying:', firstAttemptError);
            
            // Display error message to user
            showSnackbar(`Transaction issue: ${firstAttemptError.message}. Retrying...`, 'warning');
            
            // Wait a moment and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            result = await wallet.send(transaction);
          }
          
          // Update transaction history
          if (result) {
            const newTransaction = {
              blockId: result.blockId,
              transactionId: result.transactionId || result.blockId,
              amount,
              recipient: recipientAddress,
              timestamp: Date.now(),
              status: 'pending',
              direction: 'outgoing'
            };
            
            setTransactionHistory(prev => [newTransaction, ...prev]);
          }
          
          showSnackbar(`Sent ${amount} SMR successfully`, 'success');
          await getBalance(); // Refresh balance after sending
          
          return {
            success: true,
            blockId: result.blockId,
            transactionId: result.transactionId || result.blockId,
            amount,
            recipient: recipientAddress,
            explorerUrl: `${NETWORKS[network].explorer}/block/${result.blockId}`
          };
        } catch (walletError) {
          console.error('Wallet send error:', walletError);
          
          // Provide more specific error messages
          if (walletError.message && walletError.message.includes('insufficient funds')) {
            showSnackbar('Insufficient funds for this transaction', 'error');
          } else if (walletError.message && walletError.message.includes('rejected')) {
            showSnackbar('Transaction rejected by wallet', 'error');
          } else {
            showSnackbar(`Wallet error: ${walletError.message}. Please ensure your wallet is properly connected.`, 'error');
          }
          
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
  }, [apiUrl, getBalance, isConnected, network, showSnackbar, wallet, status]);
  
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
      
      // Try to use wallet directly if possible
      if (wallet && status === 'connected' && wallet.submitData) {
        try {
          const result = await wallet.submitData({ data, tag });
          showSnackbar('Data submitted to IOTA Tangle via wallet', 'success');
          return result;
        } catch (walletError) {
          console.warn('Wallet data submission failed, falling back to API:', walletError);
        }
      }
      
      // Fall back to API
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
  }, [apiUrl, isConnected, showSnackbar, wallet, status]);
  
  // Get explorer URL for an address
  const getExplorerUrl = useCallback((addressToView, layer = 'l1') => {
    const currentNetwork = NETWORKS[network] || NETWORKS.testnet;
    const viewAddress = addressToView || address;
    
    if (!viewAddress) return null;
    
    if (layer === 'l2' || layer === 'evm') {
      return `${currentNetwork.evm_explorer}/address/${viewAddress}`;
    }
    
    return `${currentNetwork.explorer}/addr/${viewAddress}`;
  }, [address, network]);
  
  // Get transaction explorer URL
  const getTransactionExplorerUrl = useCallback((transactionId, layer = 'l1') => {
    if (!transactionId) return null;
    
    const currentNetwork = NETWORKS[network] || NETWORKS.testnet;
    
    if (layer === 'l2' || layer === 'evm') {
      return `${currentNetwork.evm_explorer}/tx/${transactionId}`;
    }
    
    return `${currentNetwork.explorer}/block/${transactionId}`;
  }, [network]);
  
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
  
  // Get wallet transaction history
  const getTransactionHistory = useCallback(async () => {
    try {
      if (!isConnected || !address) {
        return [];
      }
      
      // If wallet supports transaction history directly, use that
      if (wallet && wallet.getTransactionHistory) {
        try {
          const history = await wallet.getTransactionHistory();
          setTransactionHistory(history);
          return history;
        } catch (walletError) {
          console.warn('Failed to get transaction history from wallet:', walletError);
        }
      }
      
      // Otherwise try API
      try {
        const response = await axios.get(`${apiUrl}/api/iota/transactions/${address}`);
        if (response.data?.transactions) {
          setTransactionHistory(response.data.transactions);
          return response.data.transactions;
        }
      } catch (apiError) {
        console.error('Failed to get transaction history from API:', apiError);
      }
      
      return transactionHistory;
    } catch (error) {
      console.error('Error getting transaction history:', error);
      return [];
    }
  }, [apiUrl, address, isConnected, wallet, transactionHistory]);
  
  // Get available wallet info
  const getAvailableWallets = useCallback(() => {
    const available = [];
    
    // Check which wallets are potentially available
    if (typeof window.iota !== 'undefined') {
      available.push({ ...WALLET_INFO.firefly, installed: true });
    } else {
      available.push({ ...WALLET_INFO.firefly, installed: false });
    }
    
    if (typeof window.tanglepay !== 'undefined') {
      available.push({ ...WALLET_INFO.tanglepay, installed: true });
    } else {
      available.push({ ...WALLET_INFO.tanglepay, installed: false });
    }
    
    if (typeof window.bloom !== 'undefined') {
      available.push({ ...WALLET_INFO.bloom, installed: true });
    } else {
      available.push({ ...WALLET_INFO.bloom, installed: false });
    }
    
    return available;
  }, []);
  
  // Get current network info
  const getCurrentNetworkInfo = useCallback(() => {
    return NETWORKS[network] || NETWORKS.testnet;
  }, [network]);
  
  // Value object to be provided by context
  const value = {
    // State
    isConnected,
    isConnecting,
    network,
    networkInfo: NETWORKS[network] || NETWORKS.testnet,
    address,
    balance,
    walletType,
    connectionError,
    transactionHistory,
    
    // Wallet info
    walletInfo: WALLET_INFO,
    
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
    getTransactionExplorerUrl,
    changeNetwork,
    getTransactionHistory,
    getAvailableWallets,
    getCurrentNetworkInfo
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
