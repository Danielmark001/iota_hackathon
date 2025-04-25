import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  CircularProgress,
  Divider,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  useTheme,
} from '@mui/material';
import {
  Fingerprint,
  Lock,
  Security,
  Check,
  Info,
  ArrowBack,
  ArrowForward,
  AccountBalance,
  Person,
  Assignment,
  VerifiedUser,
  Done,
  Visibility,
  VisibilityOff,
  Assessment,
  TrendingDown,
  TrendingUp,
  AccountBalanceWallet,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

// Components
import LoadingBackdrop from '../components/ui/LoadingBackdrop';

// Contexts
import { useWeb3 } from '../context/Web3Context';
import { useSnackbar } from '../context/SnackbarContext';

// Services
import apiService from '../services/apiService';

// Steps for identity verification
const steps = ['Choose Method', 'Provide Information', 'Generate Proof', 'Verify on Chain'];

const IdentityPage = () => {
  const theme = useTheme();
  const { currentAccount, zkVerifier } = useWeb3();
  const { showSnackbar } = useSnackbar();
  
  // Component state
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [userProfile, setUserProfile] = useState(null);
  const [verificationMethod, setVerificationMethod] = useState('');
  const [formData, setFormData] = useState({});
  const [proofData, setProofData] = useState(null);
  const [disclosures, setDisclosures] = useState({
    name: false,
    address: false,
    dateOfBirth: false,
    incomeRange: false,
    creditScore: false,
  });
  
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
  
  // Handle verification method selection
  const handleMethodSelect = (method) => {
    setVerificationMethod(method);
  };
  
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
  
  // Handle next step
  const handleNext = async () => {
    // Validate current step
    if (activeStep === 0 && !verificationMethod) {
      showSnackbar('Please select a verification method', 'error');
      return;
    }
    
    if (activeStep === 1) {
      // Validate form data based on selected method
      if (verificationMethod === 'iota-identity') {
        if (!formData.fullName || !formData.email) {
          showSnackbar('Please fill in all required fields', 'error');
          return;
        }
      } else if (verificationMethod === 'credential') {
        if (!formData.verifierId || !formData.credential) {
          showSnackbar('Please provide your credential information', 'error');
          return;
        }
      } else if (verificationMethod === 'zero-knowledge') {
        if (!formData.incomeRange || !formData.creditBand) {
          showSnackbar('Please select all required options', 'error');
          return;
        }
      }
    }
    
    if (activeStep === 2) {
      // Generate proof
      setProcessing(true);
      try {
        // In a real app, this would call a ZK proving service
        // For demo, simulate proof generation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate mock proof
        const proof = {
          method: verificationMethod,
          timestamp: Date.now(),
          publicInputs: {
            userAddress: currentAccount,
            disclosures: Object.keys(disclosures).filter(key => disclosures[key])
          },
          // Simulated proof data - in a real app this would be cryptographic proof
          proofData: Array(32).fill(0).map(() => Math.floor(Math.random() * 256).toString(16)).join('')
        };
        
        setProofData(proof);
        showSnackbar('Zero-knowledge proof generated successfully', 'success');
      } catch (error) {
        console.error('Error generating proof:', error);
        showSnackbar('Failed to generate proof. Please try again.', 'error');
        return;
      } finally {
        setProcessing(false);
      }
    }
    
    if (activeStep === 3) {
      // Submit proof to blockchain
      setProcessing(true);
      try {
        // In a real app, this would call the ZKVerifier contract
        // For demo, simulate blockchain interaction
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Update user profile (mock)
        setUserProfile({
          ...userProfile,
          identityVerified: true,
          riskScore: Math.max(0, userProfile.riskScore - 15) // Reduce risk score after verification
        });
        
        showSnackbar('Identity verified successfully! Your risk score has been updated.', 'success');
      } catch (error) {
        console.error('Error verifying identity on-chain:', error);
        showSnackbar('Failed to verify identity on blockchain. Please try again.', 'error');
        return;
      } finally {
        setProcessing(false);
      }
    }
    
    // Proceed to next step
    setActiveStep(prevStep => prevStep + 1);
  };
  
  // Handle back
  const handleBack = () => {
    setActiveStep(prevStep => prevStep - 1);
  };
  
  // Handle reset
  const handleReset = () => {
    setActiveStep(0);
    setVerificationMethod('');
    setFormData({});
    setProofData(null);
    setDisclosures({
      name: false,
      address: false,
      dateOfBirth: false,
      incomeRange: false,
      creditScore: false,
    });
  };
  
  // Step 1: Method Selection Component
  const MethodSelection = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          Select Identity Verification Method
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Choose how you want to verify your identity while preserving your privacy:
        </Typography>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Card 
          elevation={verificationMethod === 'iota-identity' ? 3 : 1}
          sx={{ 
            height: '100%', 
            cursor: 'pointer',
            border: verificationMethod === 'iota-identity' ? `2px solid ${theme.palette.primary.main}` : 'none',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }
          }}
          onClick={() => handleMethodSelect('iota-identity')}
        >
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Fingerprint color="primary" sx={{ fontSize: 40, mr: 1 }} />
              <Typography variant="h6">
                IOTA Identity
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Use IOTA's identity framework to verify yourself while maintaining complete control over your personal data.
            </Typography>
            <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between' }}>
              <Chip label="Recommended" color="primary" size="small" />
              <Radio
                checked={verificationMethod === 'iota-identity'}
                onChange={() => handleMethodSelect('iota-identity')}
                value="iota-identity"
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Card 
          elevation={verificationMethod === 'credential' ? 3 : 1}
          sx={{ 
            height: '100%', 
            cursor: 'pointer',
            border: verificationMethod === 'credential' ? `2px solid ${theme.palette.primary.main}` : 'none',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }
          }}
          onClick={() => handleMethodSelect('credential')}
        >
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <VerifiedUser color="primary" sx={{ fontSize: 40, mr: 1 }} />
              <Typography variant="h6">
                Verifiable Credential
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Use existing verified credentials from trusted institutions without revealing the underlying data.
            </Typography>
            <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
              <Radio
                checked={verificationMethod === 'credential'}
                onChange={() => handleMethodSelect('credential')}
                value="credential"
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Card 
          elevation={verificationMethod === 'zero-knowledge' ? 3 : 1}
          sx={{ 
            height: '100%', 
            cursor: 'pointer',
            border: verificationMethod === 'zero-knowledge' ? `2px solid ${theme.palette.primary.main}` : 'none',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }
          }}
          onClick={() => handleMethodSelect('zero-knowledge')}
        >
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Lock color="primary" sx={{ fontSize: 40, mr: 1 }} />
              <Typography variant="h6">
                Zero-Knowledge Proof
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Prove facts about yourself (income, credit score, etc.) without revealing the actual values.
            </Typography>
            <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
              <Radio
                checked={verificationMethod === 'zero-knowledge'}
                onChange={() => handleMethodSelect('zero-knowledge')}
                value="zero-knowledge"
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12}>
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            All methods use zero-knowledge proofs to protect your privacy. Your personal data never leaves your device.
          </Typography>
        </Alert>
      </Grid>
    </Grid>
  );
  
  // Step 2: Information Form Component
  const InformationForm = () => {
    // Different forms based on selected method
    if (verificationMethod === 'iota-identity') {
      return (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              IOTA Identity Information
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Please provide the following information to create your identity credential:
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Full Name"
              name="fullName"
              value={formData.fullName || ''}
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
              value={formData.email || ''}
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
              value={formData.dateOfBirth || ''}
              onChange={handleFormChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Country of Residence"
              name="country"
              value={formData.country || ''}
              onChange={handleFormChange}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Privacy Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Select which information you're willing to disclose. Only verified facts will be shared, not the actual data.
            </Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.name}
                  onChange={() => handleDisclosureToggle('name')}
                />
              }
              label="Verify Name"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.address}
                  onChange={() => handleDisclosureToggle('address')}
                />
              }
              label="Verify Address"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.dateOfBirth}
                  onChange={() => handleDisclosureToggle('dateOfBirth')}
                />
              }
              label="Verify Age (over 18)"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.incomeRange}
                  onChange={() => handleDisclosureToggle('incomeRange')}
                />
              }
              label="Verify Income Range"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Alert severity="info">
              <Typography variant="body2">
                All information is processed locally. Only zero-knowledge proofs will be submitted to the blockchain.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      );
    } else if (verificationMethod === 'credential') {
      return (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Verifiable Credential
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Use an existing verified credential to prove your identity:
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Credential Provider"
              name="verifierId"
              value={formData.verifierId || ''}
              onChange={handleFormChange}
              required
              helperText="e.g., KYC Provider, Financial Institution, Government ID"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Credential ID"
              name="credential"
              value={formData.credential || ''}
              onChange={handleFormChange}
              required
              helperText="The unique identifier for your credential"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="body2" gutterBottom>
              Select which credential facts to verify:
            </Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.name}
                  onChange={() => handleDisclosureToggle('name')}
                />
              }
              label="Verify Name"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.address}
                  onChange={() => handleDisclosureToggle('address')}
                />
              }
              label="Verify Address"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.dateOfBirth}
                  onChange={() => handleDisclosureToggle('dateOfBirth')}
                />
              }
              label="Verify Age (over 18)"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.creditScore}
                  onChange={() => handleDisclosureToggle('creditScore')}
                />
              }
              label="Verify Credit Score Range"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Alert severity="info">
              <Typography variant="body2">
                We'll verify your credential with the provider without revealing your personal information.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      );
    } else if (verificationMethod === 'zero-knowledge') {
      return (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Zero-Knowledge Proof
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Prove facts about yourself without revealing the actual data:
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <FormLabel component="legend">Annual Income Range</FormLabel>
              <RadioGroup
                name="incomeRange"
                value={formData.incomeRange || ''}
                onChange={handleFormChange}
              >
                <FormControlLabel value="0-25000" control={<Radio />} label="$0 - $25,000" />
                <FormControlLabel value="25001-50000" control={<Radio />} label="$25,001 - $50,000" />
                <FormControlLabel value="50001-100000" control={<Radio />} label="$50,001 - $100,000" />
                <FormControlLabel value="100001-250000" control={<Radio />} label="$100,001 - $250,000" />
                <FormControlLabel value="250001+" control={<Radio />} label="$250,001+" />
              </RadioGroup>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <FormLabel component="legend">Credit Score Band</FormLabel>
              <RadioGroup
                name="creditBand"
                value={formData.creditBand || ''}
                onChange={handleFormChange}
              >
                <FormControlLabel value="poor" control={<Radio />} label="Poor (300-579)" />
                <FormControlLabel value="fair" control={<Radio />} label="Fair (580-669)" />
                <FormControlLabel value="good" control={<Radio />} label="Good (670-739)" />
                <FormControlLabel value="verygood" control={<Radio />} label="Very Good (740-799)" />
                <FormControlLabel value="excellent" control={<Radio />} label="Excellent (800-850)" />
              </RadioGroup>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              What would you like to prove?
            </Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.incomeRange}
                  onChange={() => handleDisclosureToggle('incomeRange')}
                />
              }
              label="Income is above platform minimum"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.creditScore}
                  onChange={() => handleDisclosureToggle('creditScore')}
                />
              }
              label="Credit score is Good or better"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={disclosures.dateOfBirth}
                  onChange={() => handleDisclosureToggle('dateOfBirth')}
                />
              }
              label="Age verification (over 18)"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Alert severity="info">
              <Typography variant="body2">
                Using zero-knowledge proofs, you'll be able to prove these facts without revealing the actual values.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      );
    }
    
    return null;
  };
  
  // Step 3: Generate Proof Component
  const GenerateProof = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          Generate Zero-Knowledge Proof
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          We'll now generate a cryptographic proof that verifies your information without revealing the actual data.
        </Typography>
      </Grid>
      
      <Grid item xs={12}>
        <Paper variant="outlined" sx={{ p: 3, bgcolor: 'background.default' }}>
          <Typography variant="subtitle1" gutterBottom>
            Information to be proven:
          </Typography>
          
          <List>
            {disclosures.name && (
              <ListItem>
                <ListItemIcon>
                  <Person color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Name Verification" 
                  secondary="Proving that your name matches your credentials without revealing it"
                />
              </ListItem>
            )}
            {disclosures.address && (
              <ListItem>
                <ListItemIcon>
                  <AccountBalance color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Address Verification" 
                  secondary="Proving your address is valid without revealing it"
                />
              </ListItem>
            )}
            {disclosures.dateOfBirth && (
              <ListItem>
                <ListItemIcon>
                  <Assignment color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Age Verification" 
                  secondary="Proving you are above 18 years old without revealing your birth date"
                />
              </ListItem>
            )}
            {disclosures.incomeRange && (
              <ListItem>
                <ListItemIcon>
                  <Assignment color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Income Verification" 
                  secondary="Proving your income meets lending criteria without revealing the exact amount"
                />
              </ListItem>
            )}
            {disclosures.creditScore && (
              <ListItem>
                <ListItemIcon>
                  <Assessment color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Credit Score Verification" 
                  secondary="Proving your credit score meets lending criteria without revealing the exact score"
                />
              </ListItem>
            )}
            {!Object.values(disclosures).some(v => v) && (
              <ListItem>
                <ListItemText 
                  primary="No disclosures selected" 
                  secondary="Please go back and select at least one disclosure to verify"
                />
              </ListItem>
            )}
          </List>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1">
              Verification Method: {verificationMethod.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </Typography>
            <Chip
              icon={<Lock />}
              label="Zero-Knowledge"
              color="primary"
              variant="outlined"
            />
          </Box>
        </Paper>
      </Grid>
      
      <Grid item xs={12}>
        <Alert severity="info">
          <Typography variant="body2">
            The proof generation happens entirely on your device. No personal data is sent to our servers or stored on the blockchain.
          </Typography>
        </Alert>
      </Grid>
      
      {proofData && (
        <Grid item xs={12}>
          <Paper sx={{ p: 2, bgcolor: theme.palette.success.light, color: theme.palette.success.contrastText }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Check sx={{ mr: 1 }} />
              <Typography variant="subtitle1">
                Proof Generated Successfully
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Your zero-knowledge proof is ready to be verified on-chain. This proof cryptographically verifies your credentials without exposing any private information.
            </Typography>
          </Paper>
        </Grid>
      )}
    </Grid>
  );
  
  // Step 4: Verify on Chain Component
  const VerifyOnChain = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          Verify Proof on Blockchain
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Submit your zero-knowledge proof to the IOTA blockchain for verification:
        </Typography>
      </Grid>
      
      <Grid item xs={12}>
        <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: 'background.default' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="medium">
              Zero-Knowledge Proof Details
            </Typography>
            <Chip 
              label={new Date(proofData?.timestamp).toLocaleString()} 
              size="small" 
              variant="outlined"
            />
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Verification Method:
              </Typography>
              <Typography variant="body1">
                {verificationMethod.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Public Inputs:
              </Typography>
              <Typography variant="body1">
                {proofData?.publicInputs.disclosures.length} disclosed facts
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Proof Hash:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontFamily: 'monospace', 
                    bgcolor: 'action.hover', 
                    p: 1, 
                    borderRadius: 1,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {proofData?.proofData}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Verifying on-chain will submit the proof to IOTA's blockchain through a zero-knowledge verifier contract.
            Your identity will be verified without any personal information being stored on-chain.
          </Typography>
        </Alert>
        
        <Box sx={{ bgcolor: theme.palette.primary.light, p: 2, borderRadius: 2, mb: 3 }}>
          <Typography variant="subtitle1" color="primary.contrastText">
            Benefits of Verification
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <TrendingDown sx={{ color: theme.palette.primary.contrastText }} />
              </ListItemIcon>
              <ListItemText 
                primary="Reduced Risk Score" 
                secondary="Your risk score will be reduced by up to 15 points"
                primaryTypographyProps={{ color: 'primary.contrastText' }}
                secondaryTypographyProps={{ color: 'primary.contrastText', opacity: 0.7 }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <TrendingDown sx={{ color: theme.palette.primary.contrastText }} />
              </ListItemIcon>
              <ListItemText 
                primary="Lower Interest Rates" 
                secondary="Access better interest rates on borrowed assets"
                primaryTypographyProps={{ color: 'primary.contrastText' }}
                secondaryTypographyProps={{ color: 'primary.contrastText', opacity: 0.7 }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <TrendingUp sx={{ color: theme.palette.primary.contrastText }} />
              </ListItemIcon>
              <ListItemText 
                primary="Higher Borrowing Limit" 
                secondary="Increase your maximum borrowing capacity"
                primaryTypographyProps={{ color: 'primary.contrastText' }}
                secondaryTypographyProps={{ color: 'primary.contrastText', opacity: 0.7 }}
              />
            </ListItem>
          </List>
        </Box>
      </Grid>
    </Grid>
  );
  
  // Final Step: Completion Component
  const Completion = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sx={{ textAlign: 'center' }}>
        <Box 
          sx={{ 
            width: 80, 
            height: 80, 
            borderRadius: '50%', 
            bgcolor: 'success.main', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3
          }}
        >
          <Check sx={{ fontSize: 40, color: 'white' }} />
        </Box>
        
        <Typography variant="h5" gutterBottom>
          Identity Verification Complete!
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Your identity has been successfully verified on the IOTA blockchain.
        </Typography>
      </Grid>
      
      <Grid item xs={12}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Verification Results
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Chip 
                  label="Verified" 
                  color="success" 
                  icon={<VerifiedUser />}
                  sx={{ mt: 0.5 }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Original Risk Score
                </Typography>
                <Typography variant="h6">
                  {userProfile ? (userProfile.riskScore + 15) : 60}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  New Risk Score
                </Typography>
                <Typography variant="h6" color="success.main">
                  {userProfile ? userProfile.riskScore : 45}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Improvement
                </Typography>
                <Typography variant="h6" color="success.main">
                  -15 points
                </Typography>
              </Grid>
            </Grid>
          </Box>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="subtitle1" gutterBottom>
            Verified Credentials:
          </Typography>
          
          <List>
            {disclosures.name && (
              <ListItem>
                <ListItemIcon>
                  <Check color="success" />
                </ListItemIcon>
                <ListItemText primary="Name Verification" />
              </ListItem>
            )}
            {disclosures.address && (
              <ListItem>
                <ListItemIcon>
                  <Check color="success" />
                </ListItemIcon>
                <ListItemText primary="Address Verification" />
              </ListItem>
            )}
            {disclosures.dateOfBirth && (
              <ListItem>
                <ListItemIcon>
                  <Check color="success" />
                </ListItemIcon>
                <ListItemText primary="Age Verification" />
              </ListItem>
            )}
            {disclosures.incomeRange && (
              <ListItem>
                <ListItemIcon>
                  <Check color="success" />
                </ListItemIcon>
                <ListItemText primary="Income Verification" />
              </ListItem>
            )}
            {disclosures.creditScore && (
              <ListItem>
                <ListItemIcon>
                  <Check color="success" />
                </ListItemIcon>
                <ListItemText primary="Credit Score Verification" />
              </ListItem>
            )}
          </List>
        </Paper>
        
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight="medium">
            Your borrowing terms have been automatically improved!
          </Typography>
          <Typography variant="body2">
            With your verified identity, you now have access to better interest rates and increased borrowing limits.
          </Typography>
        </Alert>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            component={RouterLink}
            to="/dashboard"
            startIcon={<ArrowForward />}
          >
            Go to Dashboard
          </Button>
          <Button
            variant="outlined"
            color="primary"
            component={RouterLink}
            to="/borrow"
            startIcon={<AccountBalanceWallet />}
          >
            Borrow Assets
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
  
  // Already Verified Component
  const AlreadyVerified = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sx={{ textAlign: 'center' }}>
        <Box 
          sx={{ 
            width: 80, 
            height: 80, 
            borderRadius: '50%', 
            bgcolor: 'success.main', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3
          }}
        >
          <VerifiedUser sx={{ fontSize: 40, color: 'white' }} />
        </Box>
        
        <Typography variant="h5" gutterBottom>
          Identity Already Verified
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          You have already completed identity verification. Your risk score reflects this benefit.
        </Typography>
      </Grid>
      
      <Grid item xs={12}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Verification Status
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Chip 
                  label="Verified" 
                  color="success" 
                  icon={<VerifiedUser />}
                  sx={{ mt: 0.5 }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Risk Score
                </Typography>
                <Typography variant="h6" color="success.main">
                  {userProfile ? userProfile.riskScore : 45}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Verification Benefit
                </Typography>
                <Typography variant="h6" color="success.main">
                  -15 points
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Paper>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight="medium">
            Re-verification not required
          </Typography>
          <Typography variant="body2">
            Your identity verification is valid and active. You're already receiving the benefits of verified status.
          </Typography>
        </Alert>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            component={RouterLink}
            to="/dashboard"
            startIcon={<ArrowForward />}
          >
            Return to Dashboard
          </Button>
          <Button
            variant="outlined"
            color="primary"
            component={RouterLink}
            to="/borrow"
            startIcon={<AccountBalanceWallet />}
          >
            Borrow Assets
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <LoadingBackdrop open={loading} message="Loading verification options..." />
      
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Identity Verification
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Verify your identity using zero-knowledge proofs to improve your risk score and borrowing terms.
        </Typography>
      </Box>
      
      {/* Main content */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        {/* If already verified, show that component */}
        {userProfile && userProfile.identityVerified && activeStep === 0 ? (
          <AlreadyVerified />
        ) : (
          <>
            {/* Stepper */}
            {activeStep < steps.length && (
              <>
                <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
                  {steps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
                <Divider sx={{ mb: 4 }} />
              </>
            )}
            
            {/* Step content */}
            <Box sx={{ mt: 2, mb: 4 }}>
              {activeStep === 0 && <MethodSelection />}
              {activeStep === 1 && <InformationForm />}
              {activeStep === 2 && <GenerateProof />}
              {activeStep === 3 && <VerifyOnChain />}
              {activeStep === steps.length && <Completion />}
            </Box>
            
            {/* Step navigation */}
            {activeStep < steps.length && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
                <Button
                  color="inherit"
                  disabled={activeStep === 0 || processing}
                  onClick={handleBack}
                  startIcon={<ArrowBack />}
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
                  disabled={processing}
                  endIcon={processing ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
                >
                  {activeStep === steps.length - 1 ? 'Verify' : 'Next'}
                </Button>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
};

export default IdentityPage;
