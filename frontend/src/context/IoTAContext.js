import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSnackbar } from './SnackbarContext';

// Create context
const IoTAContext = createContext(null);

// Provider component
export const IoTAProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState('');
  const [walletType, setWalletType] = useState('');
  const [connectionError, setConnectionError] = useState(null);
  const [balance, setBalance] = useState({
    baseCoinsFormatted: '0 MIOTA',
    baseCoins: '0',
    nativeTokens: []
  });

  const [networkInfo, setNetworkInfo] = useState({
    name: 'IOTA EVM Testnet',
    chainId: '0x1074', // 4212 in decimal (IOTA EVM Testnet)
    rpcUrl: 'https://iota-testnet-evm.public.blastapi.io',
    explorerUrl: 'https://explorer.evm.testnet.iota.cafe'
  });

  const { showSnackbar } = useSnackbar();

  // Initialize connection
  const initConnection = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Simulate wallet connection
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock successful connection
      const mockAddress = '0x' + Array(40).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      
      setAddress(mockAddress);
      setWalletType(['firefly', 'tanglepay', 'bloom'][Math.floor(Math.random() * 3)]);
      
      // Mock wallet balance
      setBalance({
        baseCoinsFormatted: '1,234.56 MIOTA',
        baseCoins: '1234560000000000',
        nativeTokens: [
          { id: '0x8a9c4dfe8b47d4868f1cc7808d178c6fc562a441', amount: '5.75', symbol: 'SMR' },
          { id: '0x3aa5ebb10dc797cac828524e59a333d0a371443c', amount: '120', symbol: 'IOT' }
        ]
      });
      
      setIsConnected(true);
      showSnackbar('Wallet connected successfully', 'success');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setConnectionError('Failed to connect to wallet. Please try again.');
      showSnackbar('Failed to connect wallet', 'error');
    } finally {
      setIsConnecting(false);
    }
  }, [showSnackbar]);

  // Get balance
  const getBalance = useCallback(async () => {
    if (!isConnected) return;
    
    try {
      // Simulate balance fetch
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Update with new mock balance
      setBalance({
        baseCoinsFormatted: '1,234.56 MIOTA',
        baseCoins: '1234560000000000',
        nativeTokens: [
          { id: '0x8a9c4dfe8b47d4868f1cc7808d178c6fc562a441', amount: '5.75', symbol: 'SMR' },
          { id: '0x3aa5ebb10dc797cac828524e59a333d0a371443c', amount: '120', symbol: 'IOT' }
        ]
      });
      
      return true;
    } catch (error) {
      console.error('Error fetching balance:', error);
      showSnackbar('Failed to fetch wallet balance', 'error');
      return false;
    }
  }, [isConnected, showSnackbar]);

  // Get explorer URL
  const getExplorerUrl = useCallback(() => {
    return `${networkInfo.explorerUrl}/address/${address}`;
  }, [networkInfo, address]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setIsConnected(false);
    setAddress('');
    setWalletType('');
    setBalance({
      baseCoinsFormatted: '0 MIOTA',
      baseCoins: '0',
      nativeTokens: []
    });
    showSnackbar('Wallet disconnected', 'info');
  }, [showSnackbar]);

  // Value object to be provided by context
  const value = {
    isConnected,
    isConnecting,
    address,
    walletType,
    balance,
    networkInfo,
    connectionError,
    initConnection,
    getBalance,
    getExplorerUrl,
    disconnectWallet
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