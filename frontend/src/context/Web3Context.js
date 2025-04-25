import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import LendingPoolABI from '../abis/LendingPool.json';
import ZKVerifierABI from '../abis/ZKVerifier.json';
import { useSnackbar } from './SnackbarContext';

// Create context
const Web3Context = createContext(null);

// Provider component
export const Web3Provider = ({ children }) => {
  // For development purposes - mock wallet connection
  const [provider, setProvider] = useState({});
  const [signer, setSigner] = useState({});
  const [currentAccount, setCurrentAccount] = useState('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
  const [chainId, setChainId] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lendingPool, setLendingPool] = useState({});
  const [zkVerifier, setZKVerifier] = useState({});
  const { showSnackbar } = useSnackbar();

  // Contract addresses - would normally be loaded from .env
  const LENDING_POOL_ADDRESS = '0x1234567890123456789012345678901234567890'; // Replace with actual address
  const ZK_VERIFIER_ADDRESS = '0x0987654321098765432109876543210987654321'; // Replace with actual address

  // Initialize ethers provider
  useEffect(() => {
    const initProvider = async () => {
      if (window.ethereum) {
        const ethersProvider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(ethersProvider);
        
        // Get network info
        const network = await ethersProvider.getNetwork();
        setChainId(network.chainId);
      }
    };
    
    initProvider();
  }, []);

  // Setup contract instances when provider changes
  useEffect(() => {
    if (provider && signer) {
      try {
        // Initialize contract instances
        const lendingPoolContract = new ethers.Contract(
          LENDING_POOL_ADDRESS,
          LendingPoolABI,
          signer
        );
        setLendingPool(lendingPoolContract);
        
        const zkVerifierContract = new ethers.Contract(
          ZK_VERIFIER_ADDRESS,
          ZKVerifierABI,
          signer
        );
        setZKVerifier(zkVerifierContract);
      } catch (error) {
        console.error('Failed to initialize contracts:', error);
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
          
          if (provider) {
            const newSigner = provider.getSigner();
            setSigner(newSigner);
          }
        } else if (accounts.length === 0) {
          // User disconnected their wallet
          setCurrentAccount('');
          setSigner(null);
        }
      };

      const handleChainChanged = (chainIdHex) => {
        setChainId(parseInt(chainIdHex, 16));
        
        // Refresh the page as recommended by MetaMask
        window.location.reload();
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
  }, [currentAccount, provider]);

  // Connect wallet function - mock implementation for development
  const connectWallet = useCallback(async () => {
    // For development, just return success without connecting real wallet
    showSnackbar('Wallet connected successfully', 'success');
    return true;
  }, [showSnackbar]);

  // Switch network if needed
  const switchNetwork = useCallback(async (targetChainId) => {
    // IOTA EVM testnet parameters
    const IOTA_CHAIN_ID = '0x1074'; // 4212 in decimal
    const IOTA_CHAIN_PARAMS = {
      chainId: IOTA_CHAIN_ID,
      chainName: 'IOTA EVM Testnet',
      nativeCurrency: {
        name: 'IOTA',
        symbol: 'IOTA',
        decimals: 18
      },
      rpcUrls: ['https://evm.testnet.chrysalis2.com'],
      blockExplorerUrls: ['https://explorer.testnet.chrysalis2.com']
    };
    
    if (!window.ethereum) return false;
    
    try {
      // First try to switch to the network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId || IOTA_CHAIN_ID }]
      });
      
      return true;
    } catch (switchError) {
      // If the network doesn't exist, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [IOTA_CHAIN_PARAMS]
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
    lendingPool,
    zkVerifier,
    connectWallet,
    switchNetwork
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
