import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  MenuItem,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Alert,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  useTheme,
  alpha,
  Paper,
  Link,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  FileUpload as FileUploadIcon,
  Code as CodeIcon,
  Check as CheckIcon,
  Info as InfoIcon,
  CloudUpload as CloudUploadIcon,
  ContentPaste as ContentPasteIcon,
  HelpOutline as HelpIcon
} from '@mui/icons-material';
import { useWeb3 } from '../context/Web3Context';
import { useSnackbar } from '../context/SnackbarContext';

const verificationTypes = [
  { value: 'flattened', label: 'Contract Flattening' },
  { value: 'standard', label: 'Standard Input JSON' },
  { value: 'multi', label: 'Multi-part Files' },
  { value: 'vyper', label: 'Vyper Contract' }
];

const compilerVersions = [
  { value: '0.8.20', label: 'v0.8.20+commit.a1b79de6' },
  { value: '0.8.19', label: 'v0.8.19+commit.7dd6d404' },
  { value: '0.8.18', label: 'v0.8.18+commit.87f61d96' },
  { value: '0.8.17', label: 'v0.8.17+commit.8df45f5f' },
  { value: '0.8.16', label: 'v0.8.16+commit.07a7930e' }
];

const licenses = [
  { value: 'none', label: 'No License (None)' },
  { value: 'mit', label: 'MIT License' },
  { value: 'gpl2', label: 'GNU General Public License v2.0' },
  { value: 'gpl3', label: 'GNU General Public License v3.0' },
  { value: 'apache', label: 'Apache License 2.0' }
];

const optimizationValues = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' }
];

const steps = ['Enter Contract Address', 'Upload Source Code', 'Verify & Publish'];

const ContractVerification = () => {
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();
  const { isConnected, useMockData } = useWeb3();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    contractAddress: '',
    contractName: '',
    verificationType: 'flattened',
    compilerVersion: '0.8.20',
    optimizationEnabled: 'no',
    runs: '200',
    license: 'mit',
    sourceCode: '',
    evmVersion: 'default',
    constructorArguments: '',
    contractLibraries: ''
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    
    if (name === 'contractAddress' && errorMessage) {
      setErrorMessage('');
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData((prev) => ({
        ...prev,
        sourceCode: e.target.result
      }));
    };
    reader.readAsText(file);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!formData.contractAddress) {
        setErrorMessage('Contract address is required');
        return;
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(formData.contractAddress)) {
        setErrorMessage('Invalid contract address format');
        return;
      }
    }

    if (activeStep === 1) {
      if (!formData.sourceCode) {
        setErrorMessage('Source code is required');
        return;
      }
      if (!formData.contractName) {
        setErrorMessage('Contract name is required');
        return;
      }
    }

    if (activeStep === 2) {
      handleVerify();
      return;
    }

    setActiveStep((prevStep) => prevStep + 1);
    setErrorMessage('');
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setErrorMessage('');
  };

  const handleReset = () => {
    setActiveStep(0);
    setVerificationSuccess(false);
    setFormData({
      contractAddress: '',
      contractName: '',
      verificationType: 'flattened',
      compilerVersion: '0.8.20',
      optimizationEnabled: 'no',
      runs: '200',
      license: 'mit',
      sourceCode: '',
      evmVersion: 'default',
      constructorArguments: '',
      contractLibraries: ''
    });
  };

  const handleVerify = () => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setVerificationSuccess(true);
      showSnackbar('Contract verification successful!', 'success');
    }, 2500);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
        Verify & Publish Contract Source Code
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Verify and publish your contract source code on the IOTA EVM Testnet explorer
      </Typography>

      <Card elevation={0} sx={{ 
        borderRadius: 3, 
        border: `1px solid ${theme.palette.divider}`,
        mb: 4,
        overflow: 'hidden'
      }}>
        <Box sx={{ 
          height: 4, 
          background: 'linear-gradient(90deg, #4C3F91, #00BFA5)',
          width: '100%' 
        }} />
        <CardContent sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center' }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: 32, 
            height: 32, 
            borderRadius: '50%',
            bgcolor: theme.palette.mode === 'dark' ? alpha('#4C3F91', 0.2) : alpha('#4C3F91', 0.1),
            color: theme.palette.info.main,
            mr: 2
          }}>
            <InfoIcon fontSize="small" />
          </Box>
          <Typography variant="body2">
            Verifying contract source code helps the community trust your contract implementation and enables better interaction
            with your contract on the explorer. Published contracts can be audited by anyone.
          </Typography>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ 
        borderRadius: 3,
        border: `1px solid ${theme.palette.divider}`,
        overflow: 'hidden'
      }}>
        <Box sx={{ 
          height: 4, 
          width: '100%',
          background: 'linear-gradient(90deg, #00BFA5, #4C3F91)',
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '30%',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.3), rgba(255,255,255,0.1))',
            animation: verificationSuccess ? 'none' : 'shimmer 2s infinite',
            '@keyframes shimmer': {
              '0%': {
                transform: 'translateX(-100%)'
              },
              '100%': {
                transform: 'translateX(400%)'
              }
            }
          }
        }} />
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stepper 
            activeStep={activeStep} 
            sx={{ 
              mb: 4,
              '& .MuiStepLabel-label': {
                fontSize: '0.9rem',
              },
              '& .MuiStepIcon-root': {
                color: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.7) : theme.palette.primary.main,
                '&.Mui-active': {
                  color: '#00BFA5',
                },
                '&.Mui-completed': {
                  color: '#00BFA5',
                },
              },
              '& .MuiStepConnector-line': {
                borderColor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.3) : alpha(theme.palette.primary.main, 0.2),
              }
            }}
          >
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {verificationSuccess ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Box 
                sx={{ 
                  width: 60, 
                  height: 60, 
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  color: theme.palette.success.main,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2
                }}
              >
                <CheckIcon fontSize="large" />
              </Box>
              <Typography variant="h5" gutterBottom fontWeight={600}>
                Contract Verified Successfully!
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                The contract {formData.contractAddress} has been verified and published.
                <br />The source code is now publicly available on the IOTA EVM explorer.
              </Typography>
              <Box sx={{ mt: 3 }}>
                <Button 
                  variant="outlined" 
                  component={Link} 
                  href={`https://explorer.evm.testnet.iota.cafe/address/${formData.contractAddress}`}
                  target="_blank"
                  sx={{ mr: 2, borderRadius: 2 }}
                >
                  View on Explorer
                </Button>
                <Button 
                  variant="contained" 
                  onClick={handleReset}
                  sx={{ borderRadius: 2 }}
                >
                  Verify Another Contract
                </Button>
              </Box>
            </Box>
          ) : (
            <>
              {errorMessage && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                  {errorMessage}
                </Alert>
              )}

              {activeStep === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Enter Contract Address
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Enter the address of the deployed smart contract you want to verify
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <TextField
                        label="Contract Address"
                        name="contractAddress"
                        value={formData.contractAddress}
                        onChange={handleChange}
                        placeholder="0x..."
                        fullWidth
                        variant="outlined"
                        helperText="The address of the deployed contract to verify"
                        InputProps={{
                          endAdornment: (
                            <Tooltip title="Paste from clipboard">
                              <IconButton
                                size="small"
                                onClick={async () => {
                                  try {
                                    const text = await navigator.clipboard.readText();
                                    if (text.startsWith('0x')) {
                                      setFormData(prev => ({ ...prev, contractAddress: text }));
                                    }
                                  } catch (err) {
                                    console.error('Failed to read clipboard:', err);
                                  }
                                }}
                              >
                                <ContentPasteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {activeStep === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Upload Contract Source Code
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Provide your contract source code and verification settings
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Contract Name"
                        name="contractName"
                        value={formData.contractName}
                        onChange={handleChange}
                        fullWidth
                        variant="outlined"
                        helperText="The name of the main contract class"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        select
                        label="Verification Type"
                        name="verificationType"
                        value={formData.verificationType}
                        onChange={handleChange}
                        fullWidth
                        variant="outlined"
                        helperText="Select the verification method"
                      >
                        {verificationTypes.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        select
                        label="Compiler Version"
                        name="compilerVersion"
                        value={formData.compilerVersion}
                        onChange={handleChange}
                        fullWidth
                        variant="outlined"
                        helperText="Select the compiler version used"
                      >
                        {compilerVersions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        select
                        label="License Type"
                        name="license"
                        value={formData.license}
                        onChange={handleChange}
                        fullWidth
                        variant="outlined"
                        helperText="Select the license for your contract"
                      >
                        {licenses.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        select
                        label="Optimization"
                        name="optimizationEnabled"
                        value={formData.optimizationEnabled}
                        onChange={handleChange}
                        fullWidth
                        variant="outlined"
                        helperText="Was optimization enabled during compilation?"
                      >
                        {optimizationValues.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Optimization Runs"
                        name="runs"
                        value={formData.runs}
                        onChange={handleChange}
                        fullWidth
                        variant="outlined"
                        type="number"
                        disabled={formData.optimizationEnabled === 'no'}
                        helperText="Number of optimization runs (if enabled)"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ 
                        border: `1px dashed ${theme.palette.divider}`,
                        borderRadius: 2,
                        p: 3,
                        textAlign: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.03),
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                          borderColor: theme.palette.primary.main
                        }
                      }}>
                        <input
                          accept=".sol"
                          id="source-code-upload"
                          type="file"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="source-code-upload">
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <CloudUploadIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                              Upload Source Code File
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Drag and drop your .sol file or click to browse
                            </Typography>
                            <Button
                              variant="outlined"
                              startIcon={<FileUploadIcon />}
                              component="span"
                              sx={{ mt: 2, borderRadius: 2 }}
                            >
                              Select File
                            </Button>
                          </Box>
                        </label>
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Source Code
                      </Typography>
                      <TextField
                        name="sourceCode"
                        value={formData.sourceCode}
                        onChange={handleChange}
                        fullWidth
                        multiline
                        rows={12}
                        variant="outlined"
                        placeholder="Paste your Solidity source code here..."
                        InputProps={{
                          sx: {
                            fontFamily: 'monospace',
                            fontSize: '0.875rem'
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Constructor Arguments (ABI-encoded)"
                        name="constructorArguments"
                        value={formData.constructorArguments}
                        onChange={handleChange}
                        fullWidth
                        variant="outlined"
                        placeholder="0x..."
                        helperText="If the contract was deployed with constructor arguments, enter the ABI-encoded values (optional)"
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {activeStep === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Verify & Publish
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Review your information and submit for verification
                  </Typography>
                  
                  <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: alpha(theme.palette.background.paper, 0.5), border: `1px solid ${theme.palette.divider}` }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Contract Address:
                        </Typography>
                        <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                          {formData.contractAddress}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Contract Name:
                        </Typography>
                        <Typography variant="body2">
                          {formData.contractName}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Compiler Version:
                        </Typography>
                        <Typography variant="body2">
                          {compilerVersions.find(v => v.value === formData.compilerVersion)?.label || formData.compilerVersion}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          License:
                        </Typography>
                        <Typography variant="body2">
                          {licenses.find(l => l.value === formData.license)?.label || formData.license}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Optimization:
                        </Typography>
                        <Typography variant="body2">
                          {formData.optimizationEnabled === 'yes' ? `Enabled (${formData.runs} runs)` : 'Disabled'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Source Code:
                        </Typography>
                        <Box 
                          sx={{ 
                            mt: 1, 
                            p: 2, 
                            borderRadius: 1,
                            bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#F8FAFC',
                            border: `1px solid ${theme.palette.divider}`,
                            maxHeight: 150,
                            overflow: 'auto'
                          }}
                        >
                          <Typography 
                            variant="body2" 
                            component="pre"
                            sx={{ 
                              fontFamily: 'monospace', 
                              fontSize: '0.8rem',
                              m: 0,
                              p: 0,
                              overflowX: 'auto' 
                            }}
                          >
                            {formData.sourceCode.length > 500 
                              ? formData.sourceCode.substring(0, 500) + '...'
                              : formData.sourceCode || 'No source code provided'}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                  
                  <Box sx={{ mt: 3 }}>
                    <FormControlLabel
                      control={
                        <Checkbox 
                          defaultChecked
                          color="primary"
                        />
                      }
                      label="I confirm that the provided source code and settings match the deployed contract"
                    />
                  </Box>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  disabled={activeStep === 0 || loading}
                  sx={{ borderRadius: 2 }}
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={loading}
                  sx={{ borderRadius: 2 }}
                  endIcon={
                    loading ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : activeStep === 2 ? (
                      <CodeIcon />
                    ) : null
                  }
                >
                  {activeStep === steps.length - 1 ? 'Verify Contract' : 'Continue'}
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ContractVerification;