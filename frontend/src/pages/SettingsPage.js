import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Paper,
  Divider,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Settings,
  Notifications,
  DarkMode,
  Language,
  Security,
  CurrencyExchange,
  Save,
  Delete,
  Refresh,
  VerifiedUser,
  Block,
  Warning,
  VisibilityOff,
  Close,
} from '@mui/icons-material';

// Contexts
import { useWeb3 } from '../context/Web3Context';
import { useSnackbar } from '../context/SnackbarContext';
import { useAppTheme } from '../context/ThemeContext';

// Components
import LoadingBackdrop from '../components/ui/LoadingBackdrop';

const SettingsPage = () => {
  const theme = useTheme();
  const { currentAccount } = useWeb3();
  const { showSnackbar } = useSnackbar();
  const { mode, toggleColorMode } = useAppTheme();
  
  // Component state
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    notifications: {
      borrowAlerts: true,
      marketUpdates: true,
      riskNotifications: true,
      priceAlerts: false,
      emailNotifications: false,
    },
    display: {
      darkMode: mode === 'dark',
      language: 'en',
      currency: 'USD',
      decimalPlaces: 2,
    },
    privacy: {
      hideBalances: false,
      hideTransactionAmounts: false,
      privacyMode: false,
    },
    security: {
      requireConfirmation: true,
      autoLock: true,
      timeoutMinutes: 15,
    },
  });
  
  const [saving, setSaving] = useState(false);
  
  // Reset settings when account changes
  useEffect(() => {
    if (currentAccount) {
      // In a real app, we would load settings from a server or local storage
      setSettings(prevSettings => ({
        ...prevSettings,
        display: {
          ...prevSettings.display,
          darkMode: mode === 'dark',
        }
      }));
    }
  }, [currentAccount, mode]);
  
  // Handle settings change
  const handleSettingChange = (category, setting, value) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      [category]: {
        ...prevSettings[category],
        [setting]: value,
      }
    }));
    
    // Handle special cases
    if (category === 'display' && setting === 'darkMode') {
      toggleColorMode();
    }
  };
  
  // Handle save settings
  const handleSaveSettings = async () => {
    setSaving(true);
    
    try {
      // In a real app, we would save settings to a server or local storage
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showSnackbar('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showSnackbar('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };
  
  // Handle reset settings
  const handleResetSettings = () => {
    // Confirm reset
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      setSettings({
        notifications: {
          borrowAlerts: true,
          marketUpdates: true,
          riskNotifications: true,
          priceAlerts: false,
          emailNotifications: false,
        },
        display: {
          darkMode: false,
          language: 'en',
          currency: 'USD',
          decimalPlaces: 2,
        },
        privacy: {
          hideBalances: false,
          hideTransactionAmounts: false,
          privacyMode: false,
        },
        security: {
          requireConfirmation: true,
          autoLock: true,
          timeoutMinutes: 15,
        },
      });
      
      // If currently in dark mode, switch to light mode
      if (mode === 'dark') {
        toggleColorMode();
      }
      
      showSnackbar('Settings reset to default', 'info');
    }
  };
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <LoadingBackdrop open={loading} />
      
      {/* Page header */}
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Customize your experience and preferences.
      </Typography>
      
      <Grid container spacing={3}>
        {/* Left column - Categories */}
        <Grid item xs={12} md={3}>
          <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
            <List component="nav" dense>
              <ListItem button selected>
                <ListItemIcon>
                  <Notifications />
                </ListItemIcon>
                <ListItemText primary="Notifications" />
              </ListItem>
              <ListItem button>
                <ListItemIcon>
                  <DarkMode />
                </ListItemIcon>
                <ListItemText primary="Display" />
              </ListItem>
              <ListItem button>
                <ListItemIcon>
                  <VisibilityOff />
                </ListItemIcon>
                <ListItemText primary="Privacy" />
              </ListItem>
              <ListItem button>
                <ListItemIcon>
                  <Security />
                </ListItemIcon>
                <ListItemText primary="Security" />
              </ListItem>
              <Divider sx={{ my: 1 }} />
              <ListItem button>
                <ListItemIcon>
                  <VerifiedUser />
                </ListItemIcon>
                <ListItemText primary="Identity" />
              </ListItem>
              <ListItem button>
                <ListItemIcon>
                  <Block color="error" />
                </ListItemIcon>
                <ListItemText primary="Delete Account" />
              </ListItem>
            </List>
          </Paper>
        </Grid>
        
        {/* Right column - Settings */}
        <Grid item xs={12} md={9}>
          {/* Notifications */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Notifications color="primary" sx={{ mr: 1 }} />
              <Typography variant="h5">
                Notifications
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.borrowAlerts}
                      onChange={(e) => handleSettingChange('notifications', 'borrowAlerts', e.target.checked)}
                    />
                  }
                  label="Borrow/Liquidation Alerts"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  Receive alerts when your position approaches liquidation threshold.
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.marketUpdates}
                      onChange={(e) => handleSettingChange('notifications', 'marketUpdates', e.target.checked)}
                    />
                  }
                  label="Market Updates"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  Receive updates about important market changes.
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.riskNotifications}
                      onChange={(e) => handleSettingChange('notifications', 'riskNotifications', e.target.checked)}
                    />
                  }
                  label="Risk Assessment Notifications"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  Be notified when your risk score changes.
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.priceAlerts}
                      onChange={(e) => handleSettingChange('notifications', 'priceAlerts', e.target.checked)}
                    />
                  }
                  label="Price Alerts"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  Receive alerts about significant price changes for your assets.
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.emailNotifications}
                      onChange={(e) => handleSettingChange('notifications', 'emailNotifications', e.target.checked)}
                    />
                  }
                  label="Email Notifications"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  Receive important alerts via email (requires verification).
                </Typography>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Display Settings */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <DarkMode color="primary" sx={{ mr: 1 }} />
              <Typography variant="h5">
                Display
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.display.darkMode}
                      onChange={(e) => handleSettingChange('display', 'darkMode', e.target.checked)}
                    />
                  }
                  label="Dark Mode"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Language</InputLabel>
                  <Select
                    value={settings.display.language}
                    onChange={(e) => handleSettingChange('display', 'language', e.target.value)}
                    label="Language"
                  >
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="es">Spanish</MenuItem>
                    <MenuItem value="fr">French</MenuItem>
                    <MenuItem value="de">German</MenuItem>
                    <MenuItem value="ja">Japanese</MenuItem>
                    <MenuItem value="zh">Chinese</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={settings.display.currency}
                    onChange={(e) => handleSettingChange('display', 'currency', e.target.value)}
                    label="Currency"
                  >
                    <MenuItem value="USD">USD ($)</MenuItem>
                    <MenuItem value="EUR">EUR (€)</MenuItem>
                    <MenuItem value="GBP">GBP (£)</MenuItem>
                    <MenuItem value="JPY">JPY (¥)</MenuItem>
                    <MenuItem value="MIOTA">MIOTA</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Decimal Places</InputLabel>
                  <Select
                    value={settings.display.decimalPlaces}
                    onChange={(e) => handleSettingChange('display', 'decimalPlaces', e.target.value)}
                    label="Decimal Places"
                  >
                    <MenuItem value={0}>0</MenuItem>
                    <MenuItem value={1}>1</MenuItem>
                    <MenuItem value={2}>2</MenuItem>
                    <MenuItem value={3}>3</MenuItem>
                    <MenuItem value={4}>4</MenuItem>
                    <MenuItem value={5}>5</MenuItem>
                    <MenuItem value={6}>6</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Privacy Settings */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <VisibilityOff color="primary" sx={{ mr: 1 }} />
              <Typography variant="h5">
                Privacy
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.privacy.hideBalances}
                      onChange={(e) => handleSettingChange('privacy', 'hideBalances', e.target.checked)}
                    />
                  }
                  label="Hide Balances"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  Replace balance amounts with asterisks for privacy.
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.privacy.hideTransactionAmounts}
                      onChange={(e) => handleSettingChange('privacy', 'hideTransactionAmounts', e.target.checked)}
                    />
                  }
                  label="Hide Transaction Amounts"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  Hide transaction amounts in history and activity records.
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.privacy.privacyMode}
                      onChange={(e) => handleSettingChange('privacy', 'privacyMode', e.target.checked)}
                    />
                  }
                  label="Privacy Mode"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  Automatically blur sensitive information when the app detects someone looking over your shoulder.
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    IntelliLend uses zero-knowledge proofs to protect your privacy. Your personal data never leaves your device.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Security Settings */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Security color="primary" sx={{ mr: 1 }} />
              <Typography variant="h5">
                Security
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.security.requireConfirmation}
                      onChange={(e) => handleSettingChange('security', 'requireConfirmation', e.target.checked)}
                    />
                  }
                  label="Require Transaction Confirmation"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  Always confirm transactions before signing.
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.security.autoLock}
                      onChange={(e) => handleSettingChange('security', 'autoLock', e.target.checked)}
                    />
                  }
                  label="Auto-Lock After Inactivity"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  Automatically disconnect wallet after a period of inactivity.
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Auto-Lock Timeout (minutes)"
                  type="number"
                  variant="outlined"
                  size="small"
                  value={settings.security.timeoutMinutes}
                  onChange={(e) => handleSettingChange('security', 'timeoutMinutes', parseInt(e.target.value))}
                  disabled={!settings.security.autoLock}
                  InputProps={{
                    inputProps: { min: 1, max: 60 }
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Alert severity="warning">
                  <Typography variant="body2">
                    Always keep your private keys secure. IntelliLend will never ask for your seed phrase or private keys.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Danger Zone */}
          <Paper 
            elevation={2} 
            sx={{ 
              p: 3, 
              borderRadius: 2, 
              mb: 3, 
              border: `1px solid ${theme.palette.error.main}`,
              borderLeft: `4px solid ${theme.palette.error.main}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Warning color="error" sx={{ mr: 1 }} />
              <Typography variant="h5" color="error.main">
                Danger Zone
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body2" paragraph>
                  These actions are irreversible. Please proceed with caution.
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1">
                      Clear Local Data
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Clear all cached data and local settings.
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<Delete />}
                  >
                    Clear Data
                  </Button>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle1">
                      Delete Account
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Permanently delete your account and all associated data.
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Delete />}
                  >
                    Delete Account
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Action buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              variant="outlined"
              color="warning"
              onClick={handleResetSettings}
              startIcon={<Refresh />}
            >
              Reset Defaults
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveSettings}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SettingsPage;
