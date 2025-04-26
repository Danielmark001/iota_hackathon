import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Alert,
  Grid,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import { Fingerprint, AccountBalance } from '@mui/icons-material';

// Original identity page for traditional verification
import IdentityPage from './IdentityPage';

// IOTA identity component
import IotaIdentityVerifier from '../components/identity/IotaIdentityVerifier';

// Contexts
import { useWeb3 } from '../context/Web3Context';
import { useIoTA } from '../context/IoTAContext';
import { useSnackbar } from '../context/SnackbarContext';

// Services
import apiService from '../services/apiService';

/**
 * TabPanel Component
 * 
 * A container for the content of each tab
 */
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`identity-tabpanel-${index}`}
      aria-labelledby={`identity-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box>
          {children}
        </Box>
      )}
    </div>
  );
}

/**
 * EnhancedIdentityPage Component
 * 
 * Provides a tabbed interface for different identity verification methods.
 * Includes standard verification and IOTA Identity verification.
 */
const EnhancedIdentityPage = () => {
  const [tabValue, setTabValue] = useState(0);
  const { isConnected: isIotaConnected } = useIoTA();
  const { currentAccount } = useWeb3();
  const { showSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  // Load user profile data
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentAccount) return;
      
      setLoading(true);
      try {
        const profileData = await apiService.getUserProfile(currentAccount);
        setUserProfile(profileData);
        
        // If user is already verified, we can show a different UI
        if (profileData.identityVerified) {
          showSnackbar('Your identity is already verified', 'info');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        showSnackbar('Failed to load user profile data', 'error');
        
        // Set mock data for demo
        setUserProfile({
          address: currentAccount,
          deposits: 1500,
          borrows: 800,
          collateral: 2000,
          riskScore: 45,
          interestRate: 7.5,
          healthFactor: 1.8,
          identityVerified: false
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadUserData();
  }, [currentAccount, showSnackbar]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Handle identity verification completion
  const handleVerificationComplete = (result) => {
    if (result && result.verified) {
      // Update user profile with verification status
      setUserProfile({
        ...userProfile,
        identityVerified: true,
        riskScore: Math.max(0, (userProfile?.riskScore || 60) - 15)
      });
      
      showSnackbar('Identity verified successfully', 'success');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Identity Verification
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Verify your identity using zero-knowledge proofs to improve your risk score and borrowing terms.
        </Typography>
      </Box>
      
      {/* Verification methods tabs */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="identity verification methods"
            variant="fullWidth"
          >
            <Tab 
              icon={<Fingerprint />} 
              iconPosition="start" 
              label="Standard Verification" 
            />
            <Tab 
              icon={<AccountBalance />} 
              iconPosition="start" 
              label="IOTA Identity Verification" 
              disabled={!isIotaConnected}
            />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          {/* Standard verification flow */}
          <Box sx={{ 
            position: 'relative',
            '& > *': { 
              maxWidth: '100%',
              mx: 'auto',
              p: 0,
              boxShadow: 'none',
              borderRadius: 0
            } 
          }}>
            <IdentityPage />
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {/* IOTA Identity verification flow */}
          {isIotaConnected ? (
            <IotaIdentityVerifier onComplete={handleVerificationComplete} />
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body1">
                Please connect your IOTA wallet to use the IOTA Identity verification method.
              </Typography>
            </Alert>
          )}
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default EnhancedIdentityPage;
