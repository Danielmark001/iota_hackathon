import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  TextField,
  IconButton,
  Divider,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Alert,
  AlertTitle,
  Tooltip,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  VerifiedUser,
  AddCircleOutline,
  DeleteOutline,
  Download,
  FileCopy,
  Refresh,
  Edit,
  Send,
  VisibilityOff,
  Visibility,
  Check,
  Error,
  DriveFileRenameOutline,
  Share,
  HistoryEdu,
  WorkOutline,
  School,
  Badge,
  ContactMail,
  AccountBalance,
  Key,
  SecurityUpdateGood,
  Fingerprint
} from '@mui/icons-material';

// Contexts
import { useIoTA } from '../../../context/IoTAContext';
import { useWeb3 } from '../../../context/Web3Context';
import { useSnackbar } from '../../../context/SnackbarContext';

// Services
import apiService from '../../../services/apiService';
import iotaService from '../../../services/iotaService';

/**
 * AdvancedIdentityDashboard Component
 * 
 * A comprehensive dashboard for managing IOTA DIDs and Verifiable Credentials,
 * allowing users to create, manage, and revoke their digital identities and credentials.
 */
const AdvancedIdentityDashboard = () => {
  // Contexts
  const { isConnected: isIotaConnected, address: iotaAddress } = useIoTA();
  const { isConnected: isEvmConnected, currentAccount } = useWeb3();
  const { showSnackbar } = useSnackbar();
  
  // State
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [tabValue, setTabValue] = useState(0);
  const [identities, setIdentities] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [credentialFormData, setCredentialFormData] = useState({
    type: 'EducationCredential',
    name: '',
    description: '',
    expirationDate: '',
    attributes: []
  });
  const [newAttribute, setNewAttribute] = useState({ key: '', value: '' });
  
  // Steps for creating a new identity
  const steps = ['Create DID', 'Configure DID Document', 'Finalize'];
  
  // Credential templates
  const credentialTemplates = [
    { 
      value: 'EducationCredential', 
      label: 'Education Credential',
      icon: <School />,
      defaultAttributes: [
        { key: 'degree', value: '' },
        { key: 'institution', value: '' },
        { key: 'graduationDate', value: '' }
      ]
    },
    { 
      value: 'EmploymentCredential', 
      label: 'Employment Credential',
      icon: <WorkOutline />,
      defaultAttributes: [
        { key: 'position', value: '' },
        { key: 'company', value: '' },
        { key: 'startDate', value: '' }
      ]
    },
    { 
      value: 'IdentityCredential', 
      label: 'Identity Credential',
      icon: <Badge />,
      defaultAttributes: [
        { key: 'firstName', value: '' },
        { key: 'lastName', value: '' },
        { key: 'dateOfBirth', value: '' },
        { key: 'nationality', value: '' }
      ]
    },
    { 
      value: 'AddressCredential', 
      label: 'Address Credential',
      icon: <ContactMail />,
      defaultAttributes: [
        { key: 'street', value: '' },
        { key: 'city', value: '' },
        { key: 'postalCode', value: '' },
        { key: 'country', value: '' }
      ]
    },
    { 
      value: 'FinancialCredential', 
      label: 'Financial Credential',
      icon: <AccountBalance />,
      defaultAttributes: [
        { key: 'creditScore', value: '' },
        { key: 'verifiedIncome', value: '' },
        { key: 'assessmentDate', value: '' }
      ]
    },
    { 
      value: 'CustomCredential', 
      label: 'Custom Credential',
      icon: <DriveFileRenameOutline />,
      defaultAttributes: []
    }
  ];
  
  // Load identities and credentials on mount
  useEffect(() => {
    if (isIotaConnected && iotaAddress) {
      loadIdentities();
    }
  }, [isIotaConnected, iotaAddress]);
  
  // Load identities from IOTA
  const loadIdentities = async () => {
    if (!isIotaConnected || !iotaAddress) return;
    
    setLoading(true);
    try {
      // Get identities
      const identitiesResponse = await iotaService.getUserIdentities(iotaAddress);
      setIdentities(identitiesResponse.identities || []);
      
      // If we have identities, load credentials for the first one
      if (identitiesResponse.identities && identitiesResponse.identities.length > 0) {
        setSelectedIdentity(identitiesResponse.identities[0]);
        await loadCredentials(identitiesResponse.identities[0].did);
      }
    } catch (error) {
      console.error('Error loading identities:', error);
      showSnackbar('Failed to load identities', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Load credentials for a specific DID
  const loadCredentials = async (did) => {
    setLoading(true);
    try {
      const credentialsResponse = await iotaService.getCredentials(did);
      setCredentials(credentialsResponse.credentials || []);
    } catch (error) {
      console.error('Error loading credentials:', error);
      showSnackbar('Failed to load credentials', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle identity selection
  const handleSelectIdentity = async (identity) => {
    setSelectedIdentity(identity);
    await loadCredentials(identity.did);
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Create a new identity
  const handleCreateIdentity = async () => {
    setLoading(true);
    try {
      const response = await iotaService.createIdentity({
        controller: iotaAddress,
        metadata: {
          ethereumAddress: currentAccount || '',
          platform: 'IntelliLend',
          createdAt: new Date().toISOString()
        }
      });
      
      showSnackbar('Identity created successfully!', 'success');
      
      // Add to identities list
      setIdentities([...identities, response]);
      setSelectedIdentity(response);
      
      // Close dialog
      setCreateDialogOpen(false);
      
      // Reset stepper
      setActiveStep(0);
    } catch (error) {
      console.error('Error creating identity:', error);
      showSnackbar('Failed to create identity: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Delete an identity
  const handleDeleteIdentity = async (identity) => {
    setLoading(true);
    try {
      await iotaService.deleteIdentity(identity.did);
      
      // Remove from identities list
      const updatedIdentities = identities.filter(id => id.did !== identity.did);
      setIdentities(updatedIdentities);
      
      // Update selected identity if needed
      if (selectedIdentity && selectedIdentity.did === identity.did) {
        setSelectedIdentity(updatedIdentities.length > 0 ? updatedIdentities[0] : null);
        if (updatedIdentities.length > 0) {
          await loadCredentials(updatedIdentities[0].did);
        } else {
          setCredentials([]);
        }
      }
      
      showSnackbar('Identity deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting identity:', error);
      showSnackbar('Failed to delete identity: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle credential form change
  const handleCredentialFormChange = (e) => {
    const { name, value } = e.target;
    setCredentialFormData({
      ...credentialFormData,
      [name]: value
    });
    
    // If credential type changed, update attributes with template
    if (name === 'type') {
      const template = credentialTemplates.find(t => t.value === value);
      if (template) {
        setCredentialFormData({
          ...credentialFormData,
          type: value,
          attributes: [...template.defaultAttributes]
        });
      }
    }
  };
  
  // Handle new attribute change
  const handleAttributeChange = (e) => {
    const { name, value } = e.target;
    setNewAttribute({
      ...newAttribute,
      [name]: value
    });
  };
  
  // Add new attribute to credential form
  const handleAddAttribute = () => {
    if (newAttribute.key.trim() === '') return;
    
    setCredentialFormData({
      ...credentialFormData,
      attributes: [...credentialFormData.attributes, { ...newAttribute }]
    });
    
    setNewAttribute({ key: '', value: '' });
  };
  
  // Remove attribute from credential form
  const handleRemoveAttribute = (index) => {
    const updatedAttributes = [...credentialFormData.attributes];
    updatedAttributes.splice(index, 1);
    
    setCredentialFormData({
      ...credentialFormData,
      attributes: updatedAttributes
    });
  };
  
  // Handle attribute value change
  const handleAttributeValueChange = (index, value) => {
    const updatedAttributes = [...credentialFormData.attributes];
    updatedAttributes[index].value = value;
    
    setCredentialFormData({
      ...credentialFormData,
      attributes: updatedAttributes
    });
  };
  
  // Create a new credential
  const handleCreateCredential = async () => {
    if (!selectedIdentity) {
      showSnackbar('Please select an identity first', 'error');
      return;
    }
    
    setLoading(true);
    try {
      // Convert attributes to required format
      const attributesObject = {};
      credentialFormData.attributes.forEach(attr => {
        if (attr.key && attr.value) {
          attributesObject[attr.key] = attr.value;
        }
      });
      
      // Create credential
      const response = await iotaService.createCredential({
        did: selectedIdentity.did,
        type: credentialFormData.type,
        name: credentialFormData.name,
        description: credentialFormData.description,
        expirationDate: credentialFormData.expirationDate || undefined,
        attributes: attributesObject
      });
      
      // Add to credentials list
      setCredentials([...credentials, response]);
      
      // Close dialog
      setCredentialDialogOpen(false);
      
      // Reset form
      setCredentialFormData({
        type: 'EducationCredential',
        name: '',
        description: '',
        expirationDate: '',
        attributes: []
      });
      
      showSnackbar('Credential created successfully!', 'success');
    } catch (error) {
      console.error('Error creating credential:', error);
      showSnackbar('Failed to create credential: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Revoke a credential
  const handleRevokeCredential = async () => {
    if (!selectedCredential) return;
    
    setLoading(true);
    try {
      await iotaService.revokeCredential(selectedCredential.id);
      
      // Update credentials list
      const updatedCredentials = credentials.map(cred => {
        if (cred.id === selectedCredential.id) {
          return { ...cred, revoked: true, revokedAt: new Date().toISOString() };
        }
        return cred;
      });
      
      setCredentials(updatedCredentials);
      
      // Close dialog
      setRevokeDialogOpen(false);
      setSelectedCredential(null);
      
      showSnackbar('Credential revoked successfully', 'success');
    } catch (error) {
      console.error('Error revoking credential:', error);
      showSnackbar('Failed to revoke credential: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Share a credential
  const handleShareCredential = async () => {
    if (!selectedCredential) return;
    
    setLoading(true);
    try {
      // Generate a shareable link or QR code
      const shareableData = await iotaService.getShareableCredential(selectedCredential.id);
      
      // For now, just show a success message - in a real app, you would show the link or QR code
      showSnackbar('Credential shared successfully! Share link generated.', 'success');
      
      // Close dialog
      setShareDialogOpen(false);
      setSelectedCredential(null);
    } catch (error) {
      console.error('Error sharing credential:', error);
      showSnackbar('Failed to share credential: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Get credential type icon
  const getCredentialTypeIcon = (type) => {
    const template = credentialTemplates.find(t => t.value === type);
    return template ? template.icon : <DriveFileRenameOutline />;
  };
  
  // Format date string for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };
  
  // Identity List
  const IdentityList = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Your Identities
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={loadIdentities} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <Refresh />}
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddCircleOutline />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Identity
          </Button>
        </Box>
      </Box>
      
      {identities.length > 0 ? (
        <List>
          {identities.map((identity) => (
            <ListItem
              key={identity.did}
              button
              selected={selectedIdentity && selectedIdentity.did === identity.did}
              onClick={() => handleSelectIdentity(identity)}
              sx={{
                borderLeft: selectedIdentity && selectedIdentity.did === identity.did
                  ? `4px solid ${identity.verified ? '#4caf50' : '#2196f3'}`
                  : 'none',
                bgcolor: selectedIdentity && selectedIdentity.did === identity.did
                  ? 'rgba(0, 0, 0, 0.04)'
                  : 'transparent'
              }}
            >
              <ListItemIcon>
                {identity.verified ? (
                  <Tooltip title="Verified Identity">
                    <VerifiedUser color="success" />
                  </Tooltip>
                ) : (
                  <Fingerprint color="primary" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body1" fontWeight={selectedIdentity && selectedIdentity.did === identity.did ? 'bold' : 'normal'}>
                      {identity.name || 'DID:' + identity.did.substring(8, 16) + '...'}
                    </Typography>
                    {identity.verified && (
                      <Chip
                        label="Verified"
                        color="success"
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>
                }
                secondary={
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {identity.did}
                  </Typography>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this identity?')) {
                      handleDeleteIdentity(identity);
                    }
                  }}
                >
                  <DeleteOutline />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      ) : (
        <Alert severity="info">
          <Typography variant="body2">
            {loading ? 'Loading identities...' : 'You don\'t have any identities yet. Create your first identity to get started.'}
          </Typography>
        </Alert>
      )}
    </Box>
  );
  
  // Credentials List
  const CredentialsList = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Your Credentials
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddCircleOutline />}
          onClick={() => setCredentialDialogOpen(true)}
          disabled={!selectedIdentity}
        >
          Create Credential
        </Button>
      </Box>
      
      {!selectedIdentity ? (
        <Alert severity="info">
          <Typography variant="body2">
            Please select an identity to view its credentials.
          </Typography>
        </Alert>
      ) : credentials.length > 0 ? (
        <Grid container spacing={2}>
          {credentials.map((credential) => (
            <Grid item xs={12} md={6} key={credential.id}>
              <Card
                variant="outlined"
                sx={{
                  position: 'relative',
                  opacity: credential.revoked ? 0.7 : 1,
                  borderColor: credential.revoked ? '#f44336' : 'inherit'
                }}
              >
                {credential.revoked && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-25deg)',
                      bgcolor: 'rgba(244, 67, 54, 0.1)',
                      color: '#f44336',
                      p: 1,
                      borderRadius: 1,
                      border: '2px solid #f44336',
                      zIndex: 1,
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '80%',
                      textAlign: 'center'
                    }}
                  >
                    REVOKED
                  </Box>
                )}
                <CardHeader
                  avatar={getCredentialTypeIcon(credential.type)}
                  title={credential.name || credential.type}
                  subheader={
                    <Typography variant="caption" color="text.secondary">
                      {credential.issuer ? `Issued by: ${credential.issuer}` : 'Self-issued'}
                      {credential.expirationDate && ` • Expires: ${formatDate(credential.expirationDate)}`}
                    </Typography>
                  }
                  action={
                    <Box>
                      <Tooltip title="Copy">
                        <IconButton
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(credential));
                            showSnackbar('Credential copied to clipboard', 'success');
                          }}
                        >
                          <FileCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Share">
                        <IconButton
                          onClick={() => {
                            setSelectedCredential(credential);
                            setShareDialogOpen(true);
                          }}
                          disabled={credential.revoked}
                        >
                          <Share fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Revoke">
                        <IconButton
                          onClick={() => {
                            setSelectedCredential(credential);
                            setRevokeDialogOpen(true);
                          }}
                          disabled={credential.revoked}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                />
                <Divider />
                <CardContent>
                  {credential.description && (
                    <Typography variant="body2" paragraph>
                      {credential.description}
                    </Typography>
                  )}
                  
                  <Typography variant="subtitle2" gutterBottom>
                    Attributes
                  </Typography>
                  
                  {credential.attributes && Object.keys(credential.attributes).length > 0 ? (
                    <List dense>
                      {Object.entries(credential.attributes).map(([key, value]) => (
                        <ListItem key={key}>
                          <ListItemText
                            primary={key}
                            secondary={value}
                            primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                            secondaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No attributes
                    </Typography>
                  )}
                  
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip
                      icon={credential.verified ? <Check /> : <Error />}
                      label={credential.verified ? 'Verified' : 'Unverified'}
                      color={credential.verified ? 'success' : 'default'}
                      size="small"
                    />
                    <Typography variant="caption" color="text.secondary">
                      Created: {formatDate(credential.issuanceDate)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">
          <Typography variant="body2">
            {loading ? 'Loading credentials...' : 'No credentials found for this identity. Create your first credential to get started.'}
          </Typography>
        </Alert>
      )}
    </Box>
  );
  
  // Verification History
  const VerificationHistory = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Verification History
      </Typography>
      
      <Alert severity="info">
        <Typography variant="body2">
          This section will show all verification requests and their results.
          Feature coming soon.
        </Typography>
      </Alert>
    </Box>
  );
  
  // Privacy Settings
  const PrivacySettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Privacy Settings
      </Typography>
      
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Selective Disclosure
          </Typography>
          
          <Typography variant="body2" paragraph>
            Configure which attributes are shared when presenting your credentials.
          </Typography>
          
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Only share required attributes when presenting credentials"
          />
          
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Use zero-knowledge proofs when possible"
          />
          
          <FormControlLabel
            control={<Switch />}
            label="Auto-approve credential verification requests"
          />
        </CardContent>
      </Card>
      
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Revocation Settings
          </Typography>
          
          <Typography variant="body2" paragraph>
            Configure how revocation status is published.
          </Typography>
          
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Publish revocation status to the IOTA Tangle"
          />
          
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Include reason when revoking credentials"
          />
          
          <FormControlLabel
            control={<Switch />}
            label="Allow temporary suspension of credentials"
          />
        </CardContent>
      </Card>
    </Box>
  );
  
  // Security Key Management
  const SecurityKeyManagement = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Security Key Management
      </Typography>
      
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Active Keys
          </Typography>
          
          <List>
            <ListItem>
              <ListItemIcon>
                <Key color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Primary Authentication Key"
                secondary="Created: 04/15/2023 • Last used: Today"
              />
              <ListItemSecondaryAction>
                <Chip
                  label="Active"
                  color="success"
                  size="small"
                />
              </ListItemSecondaryAction>
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <Key />
              </ListItemIcon>
              <ListItemText
                primary="Backup Authentication Key"
                secondary="Created: 04/15/2023 • Last used: Never"
              />
              <ListItemSecondaryAction>
                <Chip
                  label="Backup"
                  color="default"
                  size="small"
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
          
          <Button
            variant="outlined"
            size="small"
            color="primary"
            startIcon={<AddCircleOutline />}
            sx={{ mt: 2 }}
          >
            Add Key
          </Button>
        </CardContent>
      </Card>
      
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Recovery Options
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Make sure you have a backup of your identity keys. If you lose access to your keys,
              you won't be able to recover your digital identity.
            </Typography>
          </Alert>
          
          <Button
            variant="outlined"
            size="small"
            color="primary"
            startIcon={<Download />}
            sx={{ mr: 1 }}
          >
            Export Recovery Kit
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            color="primary"
            startIcon={<SecurityUpdateGood />}
          >
            Configure Trusted Recovery
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
  
  // Identity Creation Dialog
  const IdentityCreationDialog = () => (
    <Dialog
      open={createDialogOpen}
      onClose={() => setCreateDialogOpen(false)}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>Create New Identity</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mt: 2, mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {activeStep === 0 && (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>What is a DID?</AlertTitle>
              <Typography variant="body2">
                A Decentralized Identifier (DID) is a new type of identifier that enables verifiable, 
                self-sovereign digital identity. A DID is fully under the control of the DID subject, 
                independent from any centralized registry, identity provider, or certificate authority.
              </Typography>
            </Alert>
            
            <Typography variant="body1" paragraph>
              We're going to create a new DID on the IOTA Tangle. This DID will be associated with your
              IOTA address and can be used to issue and verify credentials.
            </Typography>
            
            <Typography variant="body1" paragraph>
              Your identity will be secured by IOTA's distributed ledger technology, giving you
              full control over your digital identity.
            </Typography>
          </Box>
        )}
        
        {activeStep === 1 && (
          <Box>
            <Typography variant="body1" paragraph>
              Your DID document contains the cryptographic material that allows you to prove
              ownership of your DID. It includes information about verification methods,
              service endpoints, and more.
            </Typography>
            
            <Typography variant="body1" paragraph>
              For now, we'll create a basic DID document with default settings.
              You can customize it further after creation.
            </Typography>
            
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Advanced configuration options will be available in the future.
              </Typography>
            </Alert>
          </Box>
        )}
        
        {activeStep === 2 && (
          <Box>
            <Typography variant="body1" paragraph>
              Your DID is almost ready! Once you click "Create Identity", your DID will be
              created on the IOTA Tangle and will be permanently associated with your
              IOTA address.
            </Typography>
            
            <Typography variant="body1" paragraph>
              This operation cannot be undone, but you can always create multiple DIDs
              if needed.
            </Typography>
            
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                After creation, you'll be able to issue credentials, verify your identity,
                and control what information you share with others.
              </Typography>
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
        <Button
          disabled={activeStep === 0 ? false : true}
          onClick={() => setActiveStep(1)}
        >
          Back
        </Button>
        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            color="primary"
            onClick={() => setActiveStep(activeStep + 1)}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateIdentity}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            Create Identity
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
  
  // Credential Creation Dialog
  const CredentialCreationDialog = () => (
    <Dialog
      open={credentialDialogOpen}
      onClose={() => setCredentialDialogOpen(false)}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>Create New Credential</DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Credential Name"
              name="name"
              value={credentialFormData.name}
              onChange={handleCredentialFormChange}
              margin="normal"
              required
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Credential Type</InputLabel>
              <Select
                name="type"
                value={credentialFormData.type}
                onChange={handleCredentialFormChange}
                label="Credential Type"
              >
                {credentialTemplates.map((template) => (
                  <MenuItem key={template.value} value={template.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {template.icon}
                      <Typography sx={{ ml: 1 }}>{template.label}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={credentialFormData.description}
              onChange={handleCredentialFormChange}
              margin="normal"
              multiline
              rows={2}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Expiration Date"
              name="expirationDate"
              type="date"
              value={credentialFormData.expirationDate}
              onChange={handleCredentialFormChange}
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom>
          Credential Attributes
        </Typography>
        
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              label="Attribute Name"
              name="key"
              value={newAttribute.key}
              onChange={handleAttributeChange}
              placeholder="e.g., firstName, degree, etc."
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              label="Attribute Value"
              name="value"
              value={newAttribute.value}
              onChange={handleAttributeChange}
              placeholder="e.g., John, Bachelor of Science, etc."
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleAddAttribute}
              disabled={!newAttribute.key}
              startIcon={<AddCircleOutline />}
            >
              Add
            </Button>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 2 }}>
          {credentialFormData.attributes.length > 0 ? (
            <List dense>
              {credentialFormData.attributes.map((attr, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={attr.key}
                    secondary={
                      <TextField
                        fullWidth
                        size="small"
                        value={attr.value}
                        onChange={(e) => handleAttributeValueChange(index, e.target.value)}
                        variant="standard"
                      />
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveAttribute(index)}
                    >
                      <DeleteOutline />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Add attributes to your credential using the form above.
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCredentialDialogOpen(false)}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreateCredential}
          disabled={loading || !credentialFormData.name}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          Create Credential
        </Button>
      </DialogActions>
    </Dialog>
  );
  
  // Revoke Credential Dialog
  const RevokeCredentialDialog = () => (
    <Dialog
      open={revokeDialogOpen}
      onClose={() => setRevokeDialogOpen(false)}
    >
      <DialogTitle>Revoke Credential</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to revoke this credential? This action cannot be undone.
          Once revoked, the credential will no longer be valid for verification.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setRevokeDialogOpen(false)}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleRevokeCredential}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          Revoke Credential
        </Button>
      </DialogActions>
    </Dialog>
  );
  
  // Share Credential Dialog
  const ShareCredentialDialog = () => (
    <Dialog
      open={shareDialogOpen}
      onClose={() => setShareDialogOpen(false)}
    >
      <DialogTitle>Share Credential</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Share this credential with others. You can choose what information to include.
        </DialogContentText>
        
        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Include credential metadata"
          />
          
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Include issuer information"
          />
          
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Include all attributes"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShareDialogOpen(false)}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleShareCredential}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <Send />}
        >
          Share
        </Button>
      </DialogActions>
    </Dialog>
  );
  
  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h5" gutterBottom>
          Advanced Identity Management
        </Typography>
        
        {!isIotaConnected ? (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>IOTA Wallet Required</AlertTitle>
            <Typography variant="body2">
              Connect your IOTA wallet to manage your decentralized identities.
            </Typography>
          </Alert>
        ) : (
          <Box sx={{ width: '100%' }}>
            <Box sx={{ mb: 3 }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="identity tabs">
                <Tab label="Identities" />
                <Tab label="Credentials" />
                <Tab label="Verification History" />
                <Tab label="Privacy" />
                <Tab label="Security" />
              </Tabs>
            </Box>
            
            <Box sx={{ mt: 2 }}>
              {tabValue === 0 && <IdentityList />}
              {tabValue === 1 && <CredentialsList />}
              {tabValue === 2 && <VerificationHistory />}
              {tabValue === 3 && <PrivacySettings />}
              {tabValue === 4 && <SecurityKeyManagement />}
            </Box>
            
            {/* Dialogs */}
            <IdentityCreationDialog />
            <CredentialCreationDialog />
            <RevokeCredentialDialog />
            <ShareCredentialDialog />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default AdvancedIdentityDashboard;