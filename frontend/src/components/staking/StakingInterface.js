import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  useTheme
} from '@mui/material';
import {
  AccountBalanceWallet,
  Paid,
  ArrowForward,
  InfoOutlined,
  RefreshOutlined,
  CloseOutlined,
  CheckCircleOutline,
  ContentCopy,
  OpenInNew,
  BarChart,
  LocalAtm,
  StarOutline,
  StarRate,
  HelpOutline
} from '@mui/icons-material';

// Contexts
import { useIoTA } from '../../context/IoTAContext';
import { useWeb3 } from '../../context/Web3Context';
import { useSnackbar } from '../../context/SnackbarContext';

// Services
import apiService from '../../services/apiService';
import iotaService from '../../services/iotaService';

/**
 * StakingInterface Component
 * 
 * Provides a user interface for staking IOTA tokens directly from the platform
 * to earn additional yield while maintaining liquidity for lending/borrowing.
 */
const StakingInterface = () => {
  const theme = useTheme();
  const { isConnected: isIotaConnected, address: iotaAddress, balance: iotaBalance, connectWallet: connectIotaWallet } = useIoTA();
  const { isConnected: isEvmConnected, currentAccount } = useWeb3();
  const { showSnackbar } = useSnackbar();
  
  // State for staking
  const [loading, setLoading] = useState(false);
  const [loadingStakeData, setLoadingStakeData] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [stakeAmount, setStakeAmount] = useState('');
  const [stakePeriod, setStakePeriod] = useState(30); // days
  const [stakeTxHash, setStakeTxHash] = useState('');
  const [estimatedRewards, setEstimatedRewards] = useState(0);
  const [stakingStats, setStakingStats] = useState({
    totalStaked: 0,
    totalRewards: 0,
    avgAPY: 0,
    userStaked: 0,
    userRewards: 0,
    userAPY: 0
  });
  const [activeStakes, setActiveStakes] = useState([]);
  const [rewardsHistory, setRewardsHistory] = useState([]);
  const [compoundingEnabled, setCompoundingEnabled] = useState(false);
  const [remainingIota, setRemainingIota] = useState(0);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedStake, setSelectedStake] = useState(null);
  const [claimLoading, setClaimLoading] = useState(false);
  
  // Steps for the staking process
  const steps = ['Select Amount', 'Confirm Stake', 'Complete'];
  
  // Staking period options
  const periodOptions = [
    { value: 30, label: '30 Days' },
    { value: 90, label: '90 Days' },
    { value: 180, label: '180 Days' },
    { value: 365, label: '365 Days' }
  ];
  
  // Get APY for stake period
  const getAPY = (days) => {
    switch (days) {
      case 30: return 4.5;
      case 90: return 6.2;
      case 180: return 8.0;
      case 365: return 10.5;
      default: return 4.5;
    }
  };
  
  // Load staking data on component mount
  useEffect(() => {
    if (isIotaConnected && iotaAddress) {
      loadStakingData();
    }
  }, [isIotaConnected, iotaAddress]);
  
  // Watch for IOTA balance changes
  useEffect(() => {
    if (iotaBalance) {
      setRemainingIota(iotaBalance.available);
    }
  }, [iotaBalance]);
  
  // Update estimated rewards when stake parameters change
  useEffect(() => {
    if (stakeAmount && parseFloat(stakeAmount) > 0) {
      calculateEstimatedRewards();
    }
  }, [stakeAmount, stakePeriod, compoundingEnabled]);
  
  // Load staking data
  const loadStakingData = async () => {
    if (!isIotaConnected || !iotaAddress) return;
    
    setLoadingStakeData(true);
    try {
      // Get staking statistics
      const statsResponse = await apiService.getStakingStats(iotaAddress);
      setStakingStats(statsResponse);
      
      // Get active stakes
      const stakesResponse = await apiService.getActiveStakes(iotaAddress);
      setActiveStakes(stakesResponse.stakes || []);
      
      // Get rewards history
      const rewardsResponse = await apiService.getStakingRewards(iotaAddress);
      setRewardsHistory(rewardsResponse.rewards || []);
    } catch (error) {
      console.error('Error loading staking data:', error);
      showSnackbar('Failed to load staking data', 'error');
    } finally {
      setLoadingStakeData(false);
    }
  };
  
  // Calculate estimated rewards
  const calculateEstimatedRewards = () => {
    const amount = parseFloat(stakeAmount) || 0;
    const apy = getAPY(stakePeriod);
    const days = stakePeriod;
    
    if (compoundingEnabled) {
      // Compound daily
      const dailyRate = apy / 36500; // Daily rate
      const periods = days; // One period per day
      const compoundedAmount = amount * Math.pow(1 + dailyRate, periods);
      setEstimatedRewards(compoundedAmount - amount);
    } else {
      // Simple interest
      const reward = amount * (apy / 100) * (days / 365);
      setEstimatedRewards(reward);
    }
  };
  
  // Handle stake amount change
  const handleAmountChange = (event) => {
    const value = event.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setStakeAmount(value);
      
      // Update remaining IOTA
      if (iotaBalance && value) {
        setRemainingIota(Math.max(0, iotaBalance.available - parseFloat(value)));
      }
    }
  };
  
  // Handle stake period change
  const handlePeriodChange = (event) => {
    setStakePeriod(parseInt(event.target.value));
  };
  
  // Handle max amount button
  const handleMaxAmount = () => {
    if (iotaBalance) {
      // Set max to 99.5% of balance to account for fees
      const maxAmount = (iotaBalance.available * 0.995).toFixed(6);
      setStakeAmount(maxAmount);
      setRemainingIota(iotaBalance.available - parseFloat(maxAmount));
    }
  };
  
  // Handle staking
  const handleStake = async () => {
    if (!isIotaConnected) {
      showSnackbar('Please connect your IOTA wallet first', 'error');
      return;
    }
    
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      showSnackbar('Please enter a valid amount to stake', 'error');
      return;
    }
    
    if (parseFloat(stakeAmount) > iotaBalance?.available) {
      showSnackbar('Insufficient balance', 'error');
      return;
    }
    
    setLoading(true);
    setActiveStep(1);
    
    try {
      // Create staking transaction
      const stakeResponse = await apiService.initiateStaking({
        address: iotaAddress,
        amount: parseFloat(stakeAmount),
        period: stakePeriod,
        compounding: compoundingEnabled,
        timestamp: Date.now()
      });
      
      // Execute transaction via IOTA wallet
      const txResult = await iotaService.sendTokens({
        recipient: stakeResponse.stakingAddress,
        amount: parseFloat(stakeAmount),
        tag: 'STAKE',
        data: {
          period: stakePeriod,
          compounding: compoundingEnabled,
          referenceId: stakeResponse.referenceId
        }
      });
      
      setStakeTxHash(txResult.blockId);
      setActiveStep(2);
      
      // Reload staking data after a short delay
      setTimeout(() => {
        loadStakingData();
      }, 2000);
      
      showSnackbar('Staking transaction successful!', 'success');
    } catch (error) {
      console.error('Error staking:', error);
      showSnackbar('Failed to stake: ' + (error.message || 'Unknown error'), 'error');
      setActiveStep(0);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle claim button click
  const handleClaimClick = (stake) => {
    setSelectedStake(stake);
    setClaimDialogOpen(true);
  };
  
  // Handle claim rewards
  const handleClaimRewards = async () => {
    if (!selectedStake) return;
    
    setClaimLoading(true);
    try {
      const claimResponse = await apiService.claimStakingRewards({
        stakeId: selectedStake.id,
        address: iotaAddress
      });
      
      showSnackbar('Rewards claimed successfully!', 'success');
      setClaimDialogOpen(false);
      
      // Reload staking data
      loadStakingData();
    } catch (error) {
      console.error('Error claiming rewards:', error);
      showSnackbar('Failed to claim rewards: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setClaimLoading(false);
    }
  };
  
  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => showSnackbar('Copied to clipboard!', 'success'),
      () => showSnackbar('Failed to copy', 'error')
    );
  };
  
  // Reset the form
  const handleReset = () => {
    setStakeAmount('');
    setStakePeriod(30);
    setActiveStep(0);
    setStakeTxHash('');
    setCompoundingEnabled(false);
    
    if (iotaBalance) {
      setRemainingIota(iotaBalance.available);
    }
  };
  
  // Render the staking form
  const renderStakingForm = () => (
    <Box>
      {activeStep === 0 && (
        <>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Amount to Stake
              </Typography>
              <TextField
                fullWidth
                value={stakeAmount}
                onChange={handleAmountChange}
                variant="outlined"
                placeholder="0.00"
                InputProps={{
                  endAdornment: (
                    <Button
                      onClick={handleMaxAmount}
                      disabled={!iotaBalance}
                      size="small"
                    >
                      MAX
                    </Button>
                  ),
                }}
                disabled={loading}
              />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Available: {iotaBalance ? iotaBalance.available.toFixed(6) : '0.00'} SMR
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Remaining: {remainingIota.toFixed(6)} SMR
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Staking Period
              </Typography>
              <TextField
                select
                fullWidth
                value={stakePeriod}
                onChange={handlePeriodChange}
                variant="outlined"
                disabled={loading}
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({getAPY(option.value)}% APY)
                  </option>
                ))}
              </TextField>
              
              <Box sx={{ mt: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={compoundingEnabled}
                      onChange={(e) => setCompoundingEnabled(e.target.checked)}
                      color="primary"
                      disabled={loading}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Enable daily compounding
                      <Tooltip title="Automatically reinvests your daily rewards to earn interest on interest">
                        <IconButton size="small">
                          <HelpOutline fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Typography>
                  }
                />
              </Box>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.subtle', borderRadius: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Staking APY:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" fontWeight="bold">
                  {getAPY(stakePeriod)}%
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Estimated Rewards:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" fontWeight="bold">
                  {estimatedRewards.toFixed(6)} SMR
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Unlock Date:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  {new Date(Date.now() + stakePeriod * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Compounding:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  {compoundingEnabled ? 'Daily' : 'Disabled'}
                </Typography>
              </Grid>
            </Grid>
          </Box>
          
          <Divider sx={{ my: 3 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || loading || !isIotaConnected}
              onClick={handleStake}
              startIcon={loading ? <CircularProgress size={20} /> : <Paid />}
            >
              Stake IOTA
            </Button>
          </Box>
        </>
      )}
      
      {activeStep === 1 && (
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Processing Staking Transaction
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Your staking transaction is being processed. This may take a few moments.
          </Typography>
        </Box>
      )}
      
      {activeStep === 2 && (
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <CheckCircleOutline color="success" sx={{ fontSize: 48, mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Staking Successful!
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Your IOTA tokens have been successfully staked.
          </Typography>
          
          {stakeTxHash && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.subtle', borderRadius: 1, textAlign: 'left' }}>
              <Typography variant="subtitle2" gutterBottom>
                Transaction Hash
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {stakeTxHash}
                </Typography>
                <IconButton size="small" onClick={() => copyToClipboard(stakeTxHash)}>
                  <ContentCopy fontSize="small" />
                </IconButton>
                <IconButton 
                  size="small" 
                  component={Link}
                  href={`https://explorer.shimmer.network/testnet/block/${stakeTxHash}`}
                  target="_blank"
                >
                  <OpenInNew fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          )}
          
          <Box sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              onClick={handleReset}
              startIcon={<RefreshOutlined />}
            >
              Stake More
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
  
  // Render active stakes
  const renderActiveStakes = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Your Active Stakes
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={loadStakingData} disabled={loadingStakeData}>
            {loadingStakeData ? <CircularProgress size={20} /> : <RefreshOutlined />}
          </IconButton>
        </Tooltip>
      </Box>
      
      {activeStakes.length > 0 ? (
        <Grid container spacing={2}>
          {activeStakes.map(stake => (
            <Grid item xs={12} key={stake.id}>
              <Card variant="outlined">
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Amount Staked
                      </Typography>
                      <Typography variant="h6">
                        {parseFloat(stake.amount).toFixed(2)} SMR
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6} sm={4} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        APY
                      </Typography>
                      <Typography variant="body1" sx={{ color: theme.palette.success.main }}>
                        {stake.apy}%
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6} sm={4} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        Duration
                      </Typography>
                      <Typography variant="body1">
                        {stake.period} days
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6} sm={4} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        Status
                      </Typography>
                      <Chip 
                        size="small" 
                        label={stake.status} 
                        color={stake.status === 'Active' ? 'success' : 'default'}
                      />
                    </Grid>
                    
                    <Grid item xs={6} sm={4} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Unlock Date
                      </Typography>
                      <Typography variant="body1">
                        {new Date(stake.unlockTimestamp).toLocaleDateString()}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2" color="text.secondary">
                        Earned Rewards
                      </Typography>
                      <Typography variant="body1" fontWeight="bold" sx={{ color: theme.palette.success.main }}>
                        {parseFloat(stake.earnedRewards).toFixed(6)} SMR
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2" color="text.secondary">
                        Progress
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={stake.progressPercentage} 
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {stake.progressPercentage.toFixed(0)}%
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, alignItems: 'center' }}>
                      <Button
                        variant="outlined"
                        color="primary"
                        disabled={stake.status !== 'Active' || parseFloat(stake.earnedRewards) <= 0}
                        onClick={() => handleClaimClick(stake)}
                        startIcon={<LocalAtm />}
                        size="small"
                        sx={{ mr: 1 }}
                      >
                        Claim Rewards
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          You don't have any active stakes. Stake your IOTA tokens to start earning rewards.
        </Alert>
      )}
    </Box>
  );
  
  // Claim Rewards Dialog
  const ClaimRewardsDialog = () => (
    <Dialog 
      open={claimDialogOpen} 
      onClose={() => setClaimDialogOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Claim Staking Rewards
        <IconButton
          edge="end"
          color="inherit"
          onClick={() => setClaimDialogOpen(false)}
          aria-label="close"
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseOutlined />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        {selectedStake && (
          <>
            <Alert severity="info" sx={{ mb: 3 }}>
              You're about to claim the rewards for your stake. The rewards will be sent to your IOTA wallet.
            </Alert>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Stake Amount:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body1" fontWeight="bold">
                  {parseFloat(selectedStake.amount).toFixed(6)} SMR
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Earned Rewards:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body1" fontWeight="bold" sx={{ color: theme.palette.success.main }}>
                  {parseFloat(selectedStake.earnedRewards).toFixed(6)} SMR
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Recipient Address:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {formatAddress(iotaAddress)}
                </Typography>
              </Grid>
            </Grid>
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={() => setClaimDialogOpen(false)}>Cancel</Button>
        <Button 
          onClick={handleClaimRewards} 
          variant="contained" 
          color="primary"
          disabled={claimLoading}
          startIcon={claimLoading ? <CircularProgress size={20} /> : null}
        >
          {claimLoading ? 'Processing...' : 'Claim Rewards'}
        </Button>
      </DialogActions>
    </Dialog>
  );
  
  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StarRate color="warning" />
            IOTA Staking
          </Typography>
        </Box>
        
        {!isIotaConnected ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" gutterBottom>
              Connect IOTA Wallet to Start Staking
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Connect your IOTA wallet to stake tokens and earn rewards.
            </Typography>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={connectIotaWallet}
              startIcon={<AccountBalanceWallet />}
            >
              Connect IOTA Wallet
            </Button>
          </Box>
        ) : (
          <>
            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} lg={3}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Your Total Staked
                    </Typography>
                    <Typography variant="h5">
                      {stakingStats.userStaked.toFixed(2)} SMR
                    </Typography>
                    <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center' }}>
                      <ArrowForward sx={{ fontSize: 16, mr: 0.5 }} />
                      {stakingStats.userAPY.toFixed(2)}% APY
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} lg={3}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Your Earned Rewards
                    </Typography>
                    <Typography variant="h5">
                      {stakingStats.userRewards.toFixed(6)} SMR
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      Across {activeStakes.length} active stakes
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} lg={3}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Total Platform Staked
                    </Typography>
                    <Typography variant="h5">
                      {stakingStats.totalStaked.toLocaleString()} SMR
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                      <BarChart sx={{ fontSize: 16, mr: 0.5 }} />
                      {stakingStats.avgAPY.toFixed(2)}% Average APY
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} lg={3}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Available for Staking
                    </Typography>
                    <Typography variant="h5">
                      {iotaBalance ? iotaBalance.available.toFixed(2) : '0.00'} SMR
                    </Typography>
                    <Button 
                      variant="text" 
                      size="small" 
                      color="primary"
                      disabled={!iotaBalance || iotaBalance.available <= 0}
                      onClick={() => {
                        setActiveStep(0);
                        handleMaxAmount();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Stake Now
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            {/* Staking Steps */}
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
            
            {/* Staking Form */}
            <Box sx={{ mb: 4 }}>
              {renderStakingForm()}
            </Box>
            
            <Divider sx={{ mb: 4 }} />
            
            {/* Active Stakes */}
            {renderActiveStakes()}
            
            {/* Claim Rewards Dialog */}
            <ClaimRewardsDialog />
          </>
        )}
      </Paper>
      
      {/* Additional Information */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          About IOTA Staking
        </Typography>
        
        <Typography variant="body2" paragraph>
          Staking allows you to earn rewards on your IOTA tokens while still maintaining the ability to use them as collateral in the lending protocol.
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardHeader 
                title="Key Benefits" 
                titleTypographyProps={{ variant: 'subtitle1' }}
                avatar={<InfoOutlined color="primary" />}
              />
              <Divider />
              <CardContent>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Earn passive income on your IOTA tokens"
                      secondary="Generate yield while maintaining liquidity for lending/borrowing"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Flexible staking periods"
                      secondary="Choose from 30, 90, 180, or 365-day staking periods"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Compounding rewards"
                      secondary="Option to automatically reinvest your rewards daily"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Secure via IOTA Tangle"
                      secondary="All staking operations secured by IOTA's distributed ledger"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardHeader 
                title="How It Works" 
                titleTypographyProps={{ variant: 'subtitle1' }}
                avatar={<HelpOutline color="primary" />}
              />
              <Divider />
              <CardContent>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="1. Choose your staking amount and period"
                      secondary="Select how many IOTA tokens to stake and for how long"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="2. Confirm and execute the staking transaction"
                      secondary="Send your IOTA tokens to the staking contract"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="3. Start earning rewards immediately"
                      secondary="Rewards accrue daily based on your APY"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="4. Claim rewards or reinvest"
                      secondary="Withdraw your rewards at any time or compound them"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default StakingInterface;