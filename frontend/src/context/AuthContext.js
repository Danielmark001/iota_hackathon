import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWeb3 } from './Web3Context';

// Create context
const AuthContext = createContext(null);

// Provider component
export const AuthProvider = ({ children }) => {
  const { currentAccount, connectWallet } = useWeb3();
  // For development - set isAuthenticated to true by default
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  // Provide mock user profile data
  const [userProfile, setUserProfile] = useState({
    address: currentAccount || '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    name: 'Test User',
    email: 'user@example.com',
    balance: 1000,
    riskScore: 45,
    healthFactor: 1.8,
    identityVerified: false
  });

  // In development mode, we skip the authentication check
  useEffect(() => {
    // This is just to maintain reactivity with currentAccount
    if (currentAccount) {
      setUserProfile(prev => ({
        ...prev,
        address: currentAccount
      }));
    }
  }, [currentAccount]);

  // Function to log in (connect wallet) - always succeeds in development
  const login = async () => {
    // In development, we automatically succeed without real wallet connection
    await connectWallet();
    return true;
  };

  // Function to log out - in development, this doesn't really do anything
  const logout = () => {
    // For development, we stay authenticated
    // In a real app, we would set isAuthenticated to false
    console.log('Logout called (development mode - staying authenticated)');
  };

  // Value object to be provided by context
  const value = {
    isAuthenticated,
    isInitializing,
    userProfile,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for using the Auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};
