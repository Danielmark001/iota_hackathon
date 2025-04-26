import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Stepper,
  Step,
  StepLabel,
  TextField,
  CircularProgress,
  Divider,
  Alert,
  Checkbox,
  FormControlLabel,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Fingerprint,
  Check,
  Info,
  Error,
  Lock,
  AccountBalance,
  Person,
  Assignment,
} from '@mui/icons-material';

// Contexts
import { useIoTA } from '../../context/IoTAContext';
import { useSnackbar } from '../../context/SnackbarContext';

// Services
import apiService from '../../services/apiService';

// Steps for IOTA identity verification
const steps = ['Generate DID', 'Provide Information', 'Create Credential', 'Verify on Tangle'];

/**
 * IOTA Identity Verifier Component
 * 
 * Handles the complete IOTA Identity verification flow using the DID framework
 */
const IotaIdentityVerifier = ({ onComplete }) => {
  const { isConnected, address } = useIoTA();
  const { showSnackbar } = useSnackbar();
  
  // Component state
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [did, setDid] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    dateOfBirth: '',
    country: ''
  });
  const [disclosures, setDisclosures] = useState({
    name: true,
    address: true,
    dateOfBirth: true,
    income: false
  });
  const [credential, setCredential] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  
  // Check if connected to IOTA
  useEffect(() => {
    if (!isConnected) {
      showSnackbar('Please connect your IOTA wallet first', 'warning');
    }
  }, [isConnected, showSnackbar]);
  
  // Handle form field change
  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Handle disclosure toggle
  const handleDisclosureToggle = (field) => {
    setDisclosures({
      ...disclosures,
      [field]: !disclosures[field]
    });
  };
  
  // Step 1: Generate DID
  const handleGenerateDID = async () => {
    if (!isConnected || !address) {
      showSnackbar('IOTA wallet connection required', 'error');
      return;
    }
    
    setLoading(true);
    try {
      // Call the backend API to create a new DID
      const response = await apiService.createIdentity(address);
      
      if (response && response.did) {
        setDid(response.did);
        showSnackbar('DID generated successfully', 'success');
        setActiveStep(1);
      } else {
        throw new Error('Failed to generate DID');
      }
    } catch (error) {
      console.error('Error generating DID:', error);
      showSnackbar(error.message || 'Failed to generate DID', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Step 2: Submit user information
  const handleSubmitInfo = () => {
    // Validate form data
    if (!formData.fullName || !formData.email) {
      showSnackbar('Please fill in all required fields', 'error');
      return;
    }
    
    // Move to next step
    setActiveStep(2);
  };
  
  // Step 3: Create credential
  const handleCreateCredential = async () => {
    if (!did || !address) {
      showSnackbar('DID and wallet address required', 'error');
      return;
    }
    
    setLoading(true);
    try {
      // Prepare credential data
      const credentialData = {
        did: did,
        claims: {
          name: disclosures.name ? formData.fullName : undefined,
          email: formData.email,
          dateOfBirth: disclosures.dateOfBirth ? formData.dateOfBirth : undefined,
          country: formData.country,
          walletAddress: address
        },
        // Include only selected disclosures
        disclosures: Object.keys(disclosures).filter(key => disclosures[key])
      };
      
      // Call the backend API to create a verifiable credential
      const response = await apiService.createCredential(credentialData);
      
      if (response && response.credential) {
        setCredential(response.credential);
        showSnackbar('Credential created successfully', 'success');
        setActiveStep(3);
      } else {
        throw new Error('Failed to create credential');
      }
    } catch (error) {
      console.error('Error creating credential:', error);
      showSnackbar(error.message || 'Failed to create credential', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Step 4: Verify credential on Tangle
  const handleVerifyCredential = async () => {
    if (!did || !credential || !address) {
      showSnackbar('DID, credential, and wallet address required', 'error');
      return;
    }
    
    setLoading(true);
    try {
      // Call the backend API to verify the credential
      const response = await apiService.verifyIdentity({
        did: did,
        credential: credential,
        ethereumAddress: address
      });
      
      if (response && response.success) {
        setVerificationResult(response);
        showSnackbar('Identity verified successfully', 'success');
        
        // Call onComplete callback if provided
        if (onComplete) {
          onComplete({
            did,
            verified: true,
            timestamp: response.timestamp,
            ...response
          });
        }
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('Error verifying credential:', error);
      showSnackbar(error.message || 'Failed to verify credential', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle next step
  const handleNext = () => {
    switch (activeStep) {
      case 0:
        handleGenerateDID();
        break;
      case 1:
        handleSubmitInfo();
        break;
      case 2:
        handleCreateCredential();
        break;
      case 3:
        handleVerifyCredential();
        break;
      default:
        break;
    }
  };
  
  // Handle back
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };
  
  // Step 1: Generate DID Component
  const GenerateDIDStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Generate Decentralized Identifier (DID)
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        A DID is your unique identity on the IOTA network. It allows you to control and prove your identity without relying on a central authority.
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Your DID will be created on the IOTA Tangle. It will be associated with your current wallet address but will not expose any sensitive information.
        </Typography>
      </Alert>
      
      {address ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Wallet Address
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              bgcolor: 'action.hover',
              p: 1,
              borderRadius: 1
            }}
          >
            {address}
          </Typography>
        </Paper>
      ) : (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            No IOTA wallet connected. Please connect your wallet first.
          </Typography>
        </Alert>
      )}
      
      <Button
        variant="contained"
        color="primary"
        onClick={handleNext}
        disabled={loading || !isConnected || !address}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Fingerprint />}
      >
        {loading ? 'Generating DID...' : 'Generate DID'}
      </Button>
    </Box>
  );
  
  // Step 2: Information Form Component
  const InformationFormStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Provide Information
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Please provide the following information for your identity verification. This data will be used to create a verifiable credential.
      </Typography>
      
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Full Name"
              name="fullName"
              value={formData.fullName}
              onChange={handleFormChange}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleFormChange}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Date of Birth"
              name="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={handleFormChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Country"
              name="country"
              value={formData.country}
              onChange={handleFormChange}
            />
          </Grid>
        </Grid>
      </Paper>
      
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Privacy Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Select which information you want to include in your verifiable credential:
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.name}
                  onChange={() => handleDisclosureToggle('name')}
                />
              }
              label="Name"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.address}
                  onChange={() => handleDisclosureToggle('address')}
                />
              }
              label="Wallet Address"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.dateOfBirth}
                  onChange={() => handleDisclosureToggle('dateOfBirth')}
                />
              }
              label="Date of Birth"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.income}
                  onChange={() => handleDisclosureToggle('income')}
                />
              }
              label="Income Verification"
            />
          </Grid>
        </Grid>
      </Paper>
      
      <Alert severity="info">
        <Typography variant="body2">
          Your information is processed securely. Only the disclosures you select will be included in your verifiable credential.
        </Typography>
      </Alert>
      
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={loading}
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleNext}
          disabled={loading || !formData.fullName || !formData.email}
        >
          Continue
        </Button>
      </Box>
    </Box>
  );
  
  // Step 3: Create Credential Component
  const CreateCredentialStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Create Verifiable Credential
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        A verifiable credential is a tamper-proof digital credential that can be cryptographically verified. It will be created using your DID and the information you provided.
      </Typography>
      
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Credential Information
        </Typography>
        
        <List>
          <ListItem>
            <ListItemIcon>
              <Fingerprint color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="Decentralized Identifier (DID)" 
              secondary={did || 'Not generated yet'}
            />
          </ListItem>
          {disclosures.name && (
            <ListItem>
              <ListItemIcon>
                <Person color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Name" 
                secondary={formData.fullName}
              />
            </ListItem>
          )}
          {disclosures.address && (
            <ListItem>
              <ListItemIcon>
                <AccountBalance color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Wallet Address" 
                secondary={address}
              />
            </ListItem>
          )}
          {disclosures.dateOfBirth && formData.dateOfBirth && (
            <ListItem>
              <ListItemIcon>
                <Assignment color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Date of Birth" 
                secondary={formData.dateOfBirth}
              />
            </ListItem>
          )}
        </List>
      </Paper>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Your credential will be created and signed using the IOTA Identity framework. It will be stored securely and can be verified on the IOTA Tangle.
        </Typography>
      </Alert>
      
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={loading}
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleNext}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Lock />}
        >
          {loading ? 'Creating Credential...' : 'Create Credential'}
        </Button>
      </Box>
    </Box>
  );
  
  // Step 4: Verify Credential Component
  const VerifyCredentialStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Verify Credential on IOTA Tangle
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Your credential will now be verified on the IOTA Tangle. This ensures that it is valid and has not been tampered with.
      </Typography>
      
      {credential && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Credential Details
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Credential ID
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                bgcolor: 'action.hover',
                p: 1,
                borderRadius: 1
              }}
            >
              {credential.id || credential.slice(0, 50) + '...'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Chip 
              icon={<Lock />} 
              label="Zero-Knowledge Enabled" 
              color="primary" 
              variant="outlined" 
              sx={{ mr: 1 }}
            />
            <Chip 
              icon={<Fingerprint />} 
              label="IOTA Identity" 
              color="secondary" 
              variant="outlined" 
            />
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            This credential uses the IOTA Identity framework and zero-knowledge proofs to protect your privacy while allowing verification.
          </Typography>
        </Paper>
      )}
      
      {verificationResult ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="subtitle1">
            Verification Successful!
          </Typography>
          <Typography variant="body2">
            Your identity has been successfully verified on the IOTA Tangle. Your risk score has been updated accordingly.
          </Typography>
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Click "Verify on Tangle" to complete the verification process. This will submit your credential to the IOTA Tangle for verification.
          </Typography>
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={loading || verificationResult}
        >
          Back
        </Button>
        {!verificationResult ? (
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={loading || !credential}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Check />}
          >
            {loading ? 'Verifying...' : 'Verify on Tangle'}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            disabled={true}
            startIcon={<Check />}
          >
            Verified
          </Button>
        )}
      </Box>
    </Box>
  );
  
  // Render step content
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return <GenerateDIDStep />;
      case 1:
        return <InformationFormStep />;
      case 2:
        return <CreateCredentialStep />;
      case 3:
        return <VerifyCredentialStep />;
      default:
        return 'Unknown step';
    }
  };
  
  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      <Divider sx={{ mb: 4 }} />
      
      {getStepContent(activeStep)}
    </Box>
  );
};

export default IotaIdentityVerifier;
