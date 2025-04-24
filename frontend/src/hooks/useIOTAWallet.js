import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

/**
 * Custom hook for IOTA wallet integration
 * Provides functions to interact with IOTA and Shimmer networks via wallet extensions
 */
export const useIOTAWallet = () => {
  // Connection status
  const [isConnected, setIsConnected] = useState(false);
  
  // User information
  const [address, setAddress] = useState('');
  const [iotaBalance, setIotaBalance] = useState('0');
  const [shimmerBalance, setShimmerBalance] = useState('0');
  
  // Provider and network information
  const [provider, setProvider] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [networkName, setNetworkName] = useState('');
  
  // Error state
  const [error, setError] = useState(null);
  
  /**
   * Check for supported wallet providers
   * @returns {Object|null} Wallet provider if available
   */
  const getWalletProvider = () => {
    // Check for Firefly, Bloom, or other IOTA-compatible wallet extensions
    if (window.iota) {
      return window.iota;
    }
    
    // Check for MetaMask or other EVM wallets (as fallback for IOTA EVM)
    if (window.ethereum) {
      return window.ethereum;
    }
    
    return null;
  };
  
  /**
   * Initialize wallet connection
   */
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const walletProvider = getWalletProvider();
        
        if (!walletProvider) {
          return;
        }
        
        // Check if already connected
        const accounts = await walletProvider.request({ method: 'eth_accounts' });
        
        if (accounts && accounts.length > 0) {
          // Set up Web3Provider
          const provider = new ethers.providers.Web3Provider(walletProvider);
          setProvider(provider);
          
          // Get network
          const network = await provider.getNetwork();
          setChainId(network.chainId);
          setNetworkName(getNetworkName(network.chainId));
          
          // Set address
          setAddress(accounts[0]);
          setIsConnected(true);
          
          // Fetch balances
          await fetchBalances(accounts[0], provider);
        }
        
        // Set up event listeners
        setupEventListeners(walletProvider);
      } catch (error) {
        console.error('Error checking wallet connection:', error);
        setError(error.message);
      }
    };
    
    checkConnection();
    
    // Cleanup event listeners on unmount
    return () => {
      const walletProvider = getWalletProvider();
      if (walletProvider) {
        walletProvider.removeListener('accountsChanged', handleAccountsChanged);
        walletProvider.removeListener('chainChanged', handleChainChanged);
        walletProvider.removeListener('disconnect', handleDisconnect);
      }
    };
  }, []);
  
  /**
   * Set up wallet event listeners
   * @param {Object} walletProvider - Wallet provider
   */
  const setupEventListeners = (walletProvider) => {
    if (!walletProvider) return;
    
    // Remove any existing listeners to prevent duplicates
    walletProvider.removeListener('accountsChanged', handleAccountsChanged);
    walletProvider.removeListener('chainChanged', handleChainChanged);
    walletProvider.removeListener('disconnect', handleDisconnect);
    
    // Add listeners
    walletProvider.on('accountsChanged', handleAccountsChanged);
    walletProvider.on('chainChanged', handleChainChanged);
    walletProvider.on('disconnect', handleDisconnect);
  };
  
  /**
   * Handle account changes in wallet
   * @param {Array} accounts - New accounts
   */
  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      // User disconnected
      handleDisconnect();
    } else {
      // Account changed
      setAddress(accounts[0]);
      
      // Fetch new balances
      if (provider) {
        await fetchBalances(accounts[0], provider);
      }
    }
  };
  
  /**
   * Handle network changes in wallet
   * @param {string} chainIdHex - New chain ID (in hex)
   */
  const handleChainChanged = (chainIdHex) => {
    // Convert hex chain ID to number
    const newChainId = parseInt(chainIdHex, 16);
    
    // Refresh page as recommended by wallet providers
    window.location.reload();
  };
  
  /**
   * Handle wallet disconnection
   */
  const handleDisconnect = () => {
    setIsConnected(false);
    setAddress('');
    setIotaBalance('0');
    setShimmerBalance('0');
    setProvider(null);
    setChainId(null);
    setNetworkName('');
  };
  
  /**
   * Get network name based on chain ID
   * @param {number} chainId - Chain ID
   * @returns {string} Network name
   */
  const getNetworkName = (chainId) => {
    switch (chainId) {
      case 1074:
        return 'IOTA EVM';
      case 1075:
        return 'Shimmer EVM';
      case 1076:
        return 'IOTA Testnet';
      default:
        return 'Unknown Network';
    }
  };
  
  /**
   * Fetch balances for IOTA and Shimmer
   * @param {string} address - User address
   * @param {Object} provider - Ethers provider
   */
  const fetchBalances = async (address, provider) => {
    try {
      // Get balance on current network
      const balance = await provider.getBalance(address);
      
      // Determine which balance to update based on current network
      if (chainId === 1074) {
        // IOTA EVM
        setIotaBalance(formatBalance(balance));
        
        // Try to get Shimmer balance through the wallet provider
        try {
          const walletProvider = getWalletProvider();
          
          if (walletProvider && walletProvider.request) {
            // Request balance on Shimmer network
            const shimmerBalance = await walletProvider.request({
              method: 'eth_getBalance',
              params: [address, 'latest'],
              chainId: '0x433', // Shimmer chainId in hex
            });
            
            setShimmerBalance(formatBalance(shimmerBalance));
          }
        } catch (error) {
          console.error('Error fetching Shimmer balance:', error);
        }
      } else if (chainId === 1075) {
        // Shimmer EVM
        setShimmerBalance(formatBalance(balance));
        
        // Try to get IOTA balance through the wallet provider
        try {
          const walletProvider = getWalletProvider();
          
          if (walletProvider && walletProvider.request) {
            // Request balance on IOTA network
            const iotaBalance = await walletProvider.request({
              method: 'eth_getBalance',
              params: [address, 'latest'],
              chainId: '0x432', // IOTA chainId in hex
            });
            
            setIotaBalance(formatBalance(iotaBalance));
          }
        } catch (error) {
          console.error('Error fetching IOTA balance:', error);
        }
      } else {
        // Unknown network, just update the balance based on chainId
        if (chainId === 1076) {
          // Testnet
          setIotaBalance('0');
          setShimmerBalance(formatBalance(balance));
        } else {
          setIotaBalance(formatBalance(balance));
          setShimmerBalance('0');
        }
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
      setError(error.message);
    }
  };
  
  /**
   * Format balance from wei to human-readable format
   * @param {string|ethers.BigNumber} balance - Balance in wei
   * @returns {string} Formatted balance
   */
  const formatBalance = (balance) => {
    // Convert hex string to BigNumber if necessary
    const balanceBN = typeof balance === 'string' && balance.startsWith('0x') 
      ? ethers.BigNumber.from(balance) 
      : balance;
    
    // Format with 6 decimal places (IOTA format)
    return ethers.utils.formatUnits(balanceBN, 18);
  };
  
  /**
   * Connect wallet
   */
  const connect = useCallback(async () => {
    try {
      setError(null);
      
      const walletProvider = getWalletProvider();
      
      if (!walletProvider) {
        throw new Error('No IOTA wallet extension detected. Please install Firefly or another IOTA-compatible wallet.');
      }
      
      // Request accounts
      const accounts = await walletProvider.request({ method: 'eth_requestAccounts' });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('Failed to connect wallet. No accounts found.');
      }
      
      // Set up provider
      const provider = new ethers.providers.Web3Provider(walletProvider);
      setProvider(provider);
      
      // Get network
      const network = await provider.getNetwork();
      setChainId(network.chainId);
      setNetworkName(getNetworkName(network.chainId));
      
      // Set address
      setAddress(accounts[0]);
      setIsConnected(true);
      
      // Fetch balances
      await fetchBalances(accounts[0], provider);
      
      // Set up event listeners
      setupEventListeners(walletProvider);
      
      return {
        address: accounts[0],
        network: getNetworkName(network.chainId)
      };
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError(error.message);
      throw error;
    }
  }, []);
  
  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    handleDisconnect();
  }, []);
  
  /**
   * Switch network
   * @param {string} network - Network name ('iota', 'shimmer', or 'testnet')
   */
  const switchNetwork = useCallback(async (network) => {
    try {
      setError(null);
      
      const walletProvider = getWalletProvider();
      
      if (!walletProvider) {
        throw new Error('No wallet provider available');
      }
      
      // Determine chain ID based on network name
      let chainIdHex;
      switch (network.toLowerCase()) {
        case 'iota':
          chainIdHex = '0x432'; // 1074 in hex
          break;
        case 'shimmer':
          chainIdHex = '0x433'; // 1075 in hex
          break;
        case 'testnet':
          chainIdHex = '0x434'; // 1076 in hex
          break;
        default:
          throw new Error(`Unknown network: ${network}`);
      }
      
      // Request network switch
      try {
        await walletProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }]
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to the wallet
        if (switchError.code === 4902) {
          // Add the network
          let networkParams;
          switch (network.toLowerCase()) {
            case 'iota':
              networkParams = {
                chainId: chainIdHex,
                chainName: 'IOTA EVM',
                nativeCurrency: {
                  name: 'IOTA',
                  symbol: 'IOTA',
                  decimals: 18
                },
                rpcUrls: ['https://evm.wasp.sc.iota.org'],
                blockExplorerUrls: ['https://explorer.iota.org/evm']
              };
              break;
            case 'shimmer':
              networkParams = {
                chainId: chainIdHex,
                chainName: 'Shimmer EVM',
                nativeCurrency: {
                  name: 'Shimmer',
                  symbol: 'SMR',
                  decimals: 18
                },
                rpcUrls: ['https://json-rpc.evm.shimmer.network'],
                blockExplorerUrls: ['https://explorer.shimmer.network/evm']
              };
              break;
            case 'testnet':
              networkParams = {
                chainId: chainIdHex,
                chainName: 'IOTA Testnet',
                nativeCurrency: {
                  name: 'IOTA',
                  symbol: 'IOTA',
                  decimals: 18
                },
                rpcUrls: ['https://json-rpc.testnet.evm.shimmer.network'],
                blockExplorerUrls: ['https://explorer.testnet.shimmer.network/evm']
              };
              break;
          }
          
          await walletProvider.request({
            method: 'wallet_addEthereumChain',
            params: [networkParams]
          });
        } else {
          throw switchError;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error switching network:', error);
      setError(error.message);
      throw error;
    }
  }, []);
  
  /**
   * Send transaction
   * @param {string} to - Recipient address
   * @param {string} amount - Amount to send
   * @param {Object} options - Transaction options
   */
  const sendTransaction = useCallback(async (to, amount, options = {}) => {
    try {
      setError(null);
      
      if (!isConnected || !provider) {
        throw new Error('Wallet not connected');
      }
      
      // Create transaction
      const signer = provider.getSigner();
      
      const tx = {
        to,
        value: ethers.utils.parseEther(amount.toString()),
        ...options
      };
      
      // Send transaction
      const txResponse = await signer.sendTransaction(tx);
      
      // Wait for transaction to be mined
      const receipt = await txResponse.wait();
      
      return {
        hash: receipt.transactionHash,
        from: receipt.from,
        to: receipt.to,
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
        status: receipt.status === 1 ? 'confirmed' : 'failed'
      };
    } catch (error) {
      console.error('Error sending transaction:', error);
      setError(error.message);
      throw error;
    }
  }, [isConnected, provider]);
  
  /**
   * Sign a message
   * @param {string} message - Message to sign
   */
  const signMessage = useCallback(async (message) => {
    try {
      setError(null);
      
      if (!isConnected || !provider) {
        throw new Error('Wallet not connected');
      }
      
      const signer = provider.getSigner();
      const signature = await signer.signMessage(message);
      
      return {
        message,
        signature,
        address
      };
    } catch (error) {
      console.error('Error signing message:', error);
      setError(error.message);
      throw error;
    }
  }, [isConnected, provider, address]);
  
  return {
    isConnected,
    address,
    iotaBalance,
    shimmerBalance,
    provider,
    chainId,
    networkName,
    error,
    connect,
    disconnect,
    switchNetwork,
    sendTransaction,
    signMessage,
    refreshBalances: () => fetchBalances(address, provider)
  };
};

export default useIOTAWallet;
