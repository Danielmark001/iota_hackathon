import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSnackbar } from './SnackbarContext';
// Import IOTA dApp Kit components with the correct hooks
import { 
  useCurrentWallet,
  useConnectWallet,
  useDisconnectWallet,
  useCurrentAccount,
  useIotaClient,
  useWallets
} from '@iota/dapp-kit';

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
  
  // Use IOTA dApp Kit hooks with the correct names
  const currentWallet = useCurrentWallet();
  const { wallets } = useWallets();
  const { connect, isConnecting, error: connectError } = useConnectWallet();
  const { disconnect } = useDisconnectWallet();
  const account = useCurrentAccount();
  const iotaClient = useIotaClient();

  // Extract relevant data from the hooks
  const wallet = currentWallet;
  const activeAddress = account?.address;
  const status = currentWallet ? 'connected' : connectError ? 'error' : isConnecting ? 'connecting' : 'disconnected';
  const walletBalance = account?.balance;
  
  // State variables
  const [isConnected, setIsConnected] = useState(false);
  const [isLocalConnecting, setIsLocalConnecting] = useState(false);
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
    
    // Try to determine by checking available properties in window
    if (typeof window.iota !== 'undefined') {
      return 'firefly';
    } else if (typeof window.tanglepay !== 'undefined') {
      return 'tanglepay';
    } else if (typeof window.bloom !== 'undefined') {
      return 'bloom';
    }
    
    // If wallet name is available from currentWallet
    if (wallet.name) {
      const lowerName = wallet.name.toLowerCase();
      if (lowerName.includes('firefly')) return 'firefly';
      if (lowerName.includes('tanglepay')) return 'tanglepay';
      if (lowerName.includes('bloom')) return 'bloom';
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
      const baseAmount = walletBalance.base?.toString() || '0';
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
      setIsLocalConnecting(true);
      setConnectionError(null);
      
      // Try to connect with the dApp Kit
      if (connect) {
        try {
          // Connect with preferred wallet if specified
          if (preferredWallet) {
            await connect({ wallet: preferredWallet });
          } else {
            await connect();
          }
          
          setWalletType(determineWalletType());
          return;
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
          
          // Try connecting via backend API if no specific wallet was requested
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
      setIsLocalConnecting(false);
    }
  }, [apiUrl, showSnackbar, connect, determineWalletType, connectionError]);
  
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
          // Try to get new address from wallet
          // For dApp Kit, this would typically be handled by the wallet UI
          if (activeAddress) {
            setAddress(activeAddress);
            showSnackbar('Address retrieved from wallet', 'success');
            return activeAddress;
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
  }, [apiUrl, isConnected, showSnackbar, wallet, status, activeAddress]);
  
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
        const baseAmount = walletBalance.base?.toString() || '0';
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
          // With dApp Kit, transactions are typically handled by the wallet UI
          // This is a simplified example - actual implementation depends on your needs
          
          // Since we can't directly trigger a send with dApp Kit, direct the user to use their wallet
          showSnackbar('Please use your connected wallet to send tokens', 'info');
          
          // You would typically provide instructions here or integrate with a specific wallet API
          // For now, we'll update the transaction history optimistically
          const newTransaction = {
            blockId: 'pending-' + Date.now(),
            transactionId: 'pending-' + Date.now(),
            amount,
            recipient: recipientAddress,
            timestamp: Date.now(),
            status: 'pending',
            direction: 'outgoing'
          };
          
          setTransactionHistory(prev => [newTransaction, ...prev]);
          
          return {
            success: true,
            blockId: newTransaction.blockId,
            transactionId: newTransaction.transactionId,
            amount,
            recipient: recipientAddress,
            explorerUrl: `${NETWORKS[network].explorer}/block/${newTransaction.blockId}`
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
      
      // For dApp Kit, data submission would typically be handled via a specific integration
      // If you need this functionality, you would integrate with the wallet's API directly
      // or use the IOTA client
      
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
  }, [apiUrl, isConnected, showSnackbar]);
  
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
      
      // If we have access to transaction history via the IOTA client
      if (iotaClient) {
        try {
          // This is a placeholder - the actual API would depend on the IOTA client implementation
          // For now, we'll use the API as a fallback
          try {
            const response = await axios.get(`${apiUrl}/api/iota/transactions/${address}`);
            if (response.data?.transactions) {
              setTransactionHistory(response.data.transactions);
              return response.data.transactions;
            }
          } catch (apiError) {
            console.error('Failed to get transaction history from API:', apiError);
          }
        } catch (clientError) {
          console.warn('Failed to get transaction history from IOTA client:', clientError);
        }
      }
      
      return transactionHistory;
    } catch (error) {
      console.error('Error getting transaction history:', error);
      return [];
    }
  }, [apiUrl, address, isConnected, iotaClient, transactionHistory]);
  
  // Get available wallet info - with dApp Kit this would come from the wallets array
  const getAvailableWallets = useCallback(() => {
    // If we have wallets from dApp Kit, use them
    if (wallets && wallets.length > 0) {
      return wallets.map(w => {
        const walletId = w.id.toLowerCase();
        let knownWallet = null;
        
        if (walletId.includes('firefly')) {
          knownWallet = 'firefly';
        } else if (walletId.includes('tanglepay')) {
          knownWallet = 'tanglepay';
        } else if (walletId.includes('bloom')) {
          knownWallet = 'bloom';
        }
        
        if (knownWallet && WALLET_INFO[knownWallet]) {
          return { ...WALLET_INFO[knownWallet], installed: true };
        }
        
        // Unknown wallet - use what info we have
        return {
          name: w.name || w.id || 'Unknown Wallet',
          logo: '/images/wallets/default-logo.png',
          installUrl: '#',
          description: 'Compatible IOTA wallet',
          installed: true
        };
      });
    }
    
    // Fall back to checking window properties
    const available = [];
    
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
  }, [wallets]);
  
  // Get current network info
  const getCurrentNetworkInfo = useCallback(() => {
    return NETWORKS[network] || NETWORKS.testnet;
  }, [network]);
  
  // Value object to be provided by context
  const value = {
    // State
    isConnected,
    isConnecting: isConnecting || isLocalConnecting, // Use dApp Kit's isConnecting, fallback to our local state
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
    client: iotaClient,
    activeAddress,
    account,
    
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
