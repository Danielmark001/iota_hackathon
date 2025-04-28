import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useSnackbar } from './SnackbarContext';
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, NETWORK_CONFIG, USE_MOCK_DATA } from '../config/contracts';

// Create context
const Web3Context = createContext(null);

// Provider component
export const Web3Provider = ({ children }) => {
  // State for web3 connection
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [currentAccount, setCurrentAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lendingPool, setLendingPool] = useState(null);
  const [zkVerifier, setZKVerifier] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const { showSnackbar } = useSnackbar();

  // Initialize ethers provider
  useEffect(() => {
    const initProvider = async () => {
      try {
        let ethersProvider;
        
        if (window.ethereum) {
          // Use injected provider (MetaMask, etc.)
          ethersProvider = new ethers.providers.Web3Provider(window.ethereum);
        } else {
          // Fallback to JSON RPC provider
          ethersProvider = new ethers.providers.JsonRpcProvider(
            NETWORK_CONFIG.rpcUrls[0]
          );
          
          console.log('Using JSON RPC provider:', NETWORK_CONFIG.rpcUrls[0]);
        }
        
        setProvider(ethersProvider);
        
        // Get network info
        const network = await ethersProvider.getNetwork();
        setChainId(network.chainId);
        
        // Get signer if available (only with injected providers)
        if (window.ethereum) {
          // Get connected accounts without prompting
          const accounts = await window.ethereum.request({ 
            method: 'eth_accounts'
          });
          
          if (accounts.length > 0) {
            setCurrentAccount(accounts[0]);
            const newSigner = ethersProvider.getSigner();
            setSigner(newSigner);
            setIsConnected(true);
          } else {
            // Use read-only mode with provider
            setSigner(ethersProvider);
          }
        } else {
          // Use provider as signer for read-only operations
          setSigner(ethersProvider);
        }
      } catch (error) {
        console.error('Failed to initialize provider:', error);
        setConnectionError('Failed to connect to blockchain network');
      }
    };
    
    initProvider();
  }, []);

  // Setup contract instances when provider changes
  useEffect(() => {
    if (provider && signer) {
      try {
        // Initialize contract instances using addresses from config
        const lendingPoolContract = new ethers.Contract(
          CONTRACT_ADDRESSES.LENDING_POOL,
          CONTRACT_ABIS.LENDING_POOL,
          signer
        );
        setLendingPool(lendingPoolContract);
        
        const zkVerifierContract = new ethers.Contract(
          CONTRACT_ADDRESSES.ZK_VERIFIER,
          CONTRACT_ABIS.ZK_VERIFIER,
          signer
        );
        setZKVerifier(zkVerifierContract);
        
        // Clear any previous connection errors
        setConnectionError(null);
      } catch (error) {
        console.error('Failed to initialize contracts:', error);
        setConnectionError('Failed to connect to blockchain contracts');
        showSnackbar('Failed to connect to blockchain contracts', 'error');
      }
    }
  }, [provider, signer, showSnackbar]);

  // Event listeners for account and chain changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0 && accounts[0] !== currentAccount) {
          setCurrentAccount(accounts[0]);
          setIsConnected(true);
          
          if (provider) {
            const newSigner = provider.getSigner();
            setSigner(newSigner);
          }
        } else if (accounts.length === 0) {
          // User disconnected their wallet
          setCurrentAccount('');
          setIsConnected(false);
          // Fallback to provider for read-only operations
          setSigner(provider);
        }
      };

      const handleChainChanged = (chainIdHex) => {
        const newChainId = parseInt(chainIdHex, 16);
        setChainId(newChainId);
        
        if (newChainId !== parseInt(NETWORK_CONFIG.chainId, 16)) {
          showSnackbar(`Connected to network ID ${newChainId}. Please switch to IOTA EVM Testnet.`, 'warning');
        }
      };

      // Subscribe to events
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      // Cleanup
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [currentAccount, provider, showSnackbar]);

  // Connect wallet function
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      showSnackbar('No wallet detected. Please install MetaMask or another Web3 wallet.', 'error');
      return false;
    }
    
    setIsConnecting(true);
    
    try {
      // Request accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      if (accounts.length > 0) {
        setCurrentAccount(accounts[0]);
        setIsConnected(true);
        
        if (provider) {
          const newSigner = provider.getSigner();
          setSigner(newSigner);
        }
        
        // Check if on the right network
        const network = await provider.getNetwork();
        if (network.chainId !== parseInt(NETWORK_CONFIG.chainId, 16)) {
          showSnackbar(`Connected to wrong network. Please switch to IOTA EVM Testnet.`, 'warning');
          switchNetwork();
        } else {
          showSnackbar('Wallet connected successfully', 'success');
        }
        
        return true;
      } else {
        showSnackbar('Please connect a wallet account', 'error');
        return false;
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      showSnackbar('Failed to connect wallet', 'error');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [provider, showSnackbar]);

  // Switch network if needed
  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) {
      showSnackbar('No wallet detected. Please install MetaMask or another Web3 wallet.', 'error');
      return false;
    }
    
    try {
      // First try to switch to the network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORK_CONFIG.chainId }]
      });
      
      return true;
    } catch (switchError) {
      // If the network doesn't exist, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [NETWORK_CONFIG]
          });
          
          return true;
        } catch (addError) {
          console.error('Error adding network:', addError);
          showSnackbar('Failed to add network', 'error');
          return false;
        }
      } else {
        console.error('Error switching network:', switchError);
        showSnackbar('Failed to switch network', 'error');
        return false;
      }
    }
  }, [showSnackbar]);

  // Value object to be provided by context
  const value = {
    provider,
    signer,
    currentAccount,
    chainId,
    isConnecting,
    isConnected,
    lendingPool,
    zkVerifier,
    connectWallet,
    switchNetwork,
    connectionError,
    useMockData: USE_MOCK_DATA
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

// Custom hook for using the Web3 context
export const useWeb3 = () => {
  const context = useContext(Web3Context);
  
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  
  return context;
};
