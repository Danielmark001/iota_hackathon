import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  Alert
} from '@mui/material';
import { Fingerprint, AccountBalance } from '@mui/icons-material';

// Custom Components
import IotaIdentityVerifier from './IotaIdentityVerifier';

// Contexts
import { useIoTA } from '../../context/IoTAContext';

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
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

/**
 * IdentityTabs Component
 * 
 * Provides tabbed interface for different identity verification methods
 */
const IdentityTabs = ({ onComplete }) => {
  const [tabValue, setTabValue] = useState(0);
  const { isConnected: isIotaConnected } = useIoTA();

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
          aria-label="identity verification tabs"
        >
          <Tab icon={<Fingerprint />} iconPosition="start" label="Standard Verification" />
          <Tab 
            icon={<AccountBalance />} 
            iconPosition="start" 
            label="IOTA Identity Verification" 
            disabled={!isIotaConnected}
          />
        </Tabs>
      </Paper>
      
      <TabPanel value={tabValue} index={0}>
        <Typography variant="body2">
          This is the standard identity verification flow that has already been implemented.
          Please proceed with the steps below to verify your identity.
        </Typography>
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        {isIotaConnected ? (
          <IotaIdentityVerifier onComplete={onComplete} />
        ) : (
          <Alert severity="info">
            <Typography variant="body1">
              Please connect your IOTA wallet to use the IOTA Identity verification method.
            </Typography>
          </Alert>
        )}
      </TabPanel>
    </Box>
  );
};

export default IdentityTabs;
