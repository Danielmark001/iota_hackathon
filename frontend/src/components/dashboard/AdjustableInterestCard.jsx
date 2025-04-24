import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  Slider,
  Chip,
  Button,
  useTheme,
  Tooltip,
  alpha,
  Paper
} from '@mui/material';
import {
  TrendingDown,
  TrendingUp,
  Info,
  Refresh
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { formatPercentage } from '../../utils/formatters';

/**
 * AdjustableInterestCard displays the relationship between risk score and 
 * interest rate, allowing users to see how improving their risk score could
 * affect their borrowing rates.
 * 
 * @param {Object} props - Component props
 * @param {number} props.currentScore - Current risk score
 * @param {number} props.baseRate - Base interest rate
 * @param {string} props.address - User address
 * @param {boolean} props.readOnly - Whether the component is in readonly mode
 */
const AdjustableInterestCard = ({ 
  currentScore = 50, 
  baseRate = 3, 
  address,
  readOnly = false
}) => {
  const theme = useTheme();
  const [simulatedScore, setSimulatedScore] = useState(currentScore);
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState({
    current: 0,
    simulated: 0,
    difference: 0
  });
  
  // Calculate interest rate based on risk score
  const calculateInterestRate = (score) => {
    // Base rate (e.g., 3%) plus risk premium based on score
    // Higher score = higher risk = higher interest rate
    // Formula: base_rate + (risk_score / 100) * max_premium
    // Where max_premium is 10% (total max rate 13%)
    const maxPremium = 10; // 10% premium for highest risk
    const riskPremium = (score / 100) * maxPremium;
    return baseRate + riskPremium;
  };
  
  // Update rates when scores change
  useEffect(() => {
    const currentRate = calculateInterestRate(currentScore);
    const simulatedRate = calculateInterestRate(simulatedScore);
    
    setRates({
      current: currentRate,
      simulated: simulatedRate,
      difference: currentRate - simulatedRate
    });
  }, [currentScore, simulatedScore, baseRate]);
  
  // Handle slider change
  const handleScoreChange = (_, newValue) => {
    setSimulatedScore(newValue);
  };
  
  // Get color for simulated score
  const getScoreColor = (score) => {
    if (score < 20) return theme.palette.success.main;
    if (score < 40) return theme.palette.success.light;
    if (score < 60) return theme.palette.warning.main;
    if (score < 80) return theme.palette.warning.dark;
    return theme.palette.error.main;
  };
  
  // Handle reset
  const handleReset = () => {
    setSimulatedScore(currentScore);
  };
  
  // Handle improve score button click
  const handleImproveScore = async () => {
    if (!address) return;
    
    try {
      setLoading(true);
      
      // This would be a real API call in production
      // For now, just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      window.location.href = `/improve-risk/${address}`;
    } catch (error) {
      console.error('Error navigating to improve score page:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        backgroundColor: alpha(theme.palette.background.paper, 0.6),
        border: `1px solid ${theme.palette.divider}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box display="flex" alignItems="center" mb={1}>
        <Typography variant="subtitle1" fontWeight="medium">
          Interest Rate Simulator
        </Typography>
        <Tooltip title="This simulator shows how your risk score affects your interest rate. Lower risk scores mean lower interest rates.">
          <Info 
            fontSize="small" 
            sx={{ 
              ml: 1, 
              color: theme.palette.text.secondary,
              cursor: 'help'
            }} 
          />
        </Tooltip>
      </Box>
      
      <Typography variant="body2" color="textSecondary" paragraph>
        Adjust the risk score to see how it affects your interest rate.
      </Typography>
      
      <Box 
        mb={2} 
        mt={1} 
        display="flex" 
        justifyContent="space-between" 
        alignItems="center"
      >
        <Typography variant="body2" color="textSecondary">
          Current Rate: {formatPercentage(rates.current)}
        </Typography>
        
        <Chip 
          label={`Score: ${Math.round(currentScore)}`} 
          size="small"
          sx={{ 
            backgroundColor: alpha(getScoreColor(currentScore), 0.1),
            color: getScoreColor(currentScore),
            fontWeight: 'medium'
          }}
        />
      </Box>
      
      <Box 
        mb={2} 
        sx={{ 
          px: 1,
          py: 1, 
          borderRadius: 1,
          backgroundColor: alpha(getScoreColor(simulatedScore), 0.05),
          border: `1px dashed ${alpha(getScoreColor(simulatedScore), 0.3)}`
        }}
      >
        <Typography 
          variant="body2" 
          fontWeight="medium" 
          mb={2}
          align="center"
        >
          Simulated Risk Score: {Math.round(simulatedScore)}
        </Typography>
        
        <Slider
          value={simulatedScore}
          onChange={handleScoreChange}
          aria-labelledby="risk-score-slider"
          valueLabelDisplay="auto"
          min={0}
          max={100}
          marks={[
            { value: 0, label: '0' },
            { value: 50, label: '50' },
            { value: 100, label: '100' }
          ]}
          sx={{
            color: getScoreColor(simulatedScore),
            '& .MuiSlider-thumb': {
              width: 16,
              height: 16,
              '&:before': {
                width: 8,
                height: 8
              }
            }
          }}
          disabled={readOnly}
        />
        
        <Box 
          display="flex" 
          justifyContent="space-between" 
          mt={1}
        >
          <Typography variant="caption" color="success.main">Low Risk</Typography>
          <Typography variant="caption" color="warning.main">Medium Risk</Typography>
          <Typography variant="caption" color="error.main">High Risk</Typography>
        </Box>
      </Box>
      
      <Box 
        mb={2}
        p={1.5}
        borderRadius={1}
        bgcolor={
          rates.difference > 0 
            ? alpha(theme.palette.success.main, 0.1) 
            : alpha(theme.palette.grey[200], 0.5)
        }
      >
        <Box 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center"
        >
          <Typography variant="body2" fontWeight="medium">
            Simulated Rate:
          </Typography>
          <Typography 
            variant="body1" 
            fontWeight="bold"
            color={
              simulatedScore < currentScore 
                ? theme.palette.success.main 
                : theme.palette.text.primary
            }
          >
            {formatPercentage(rates.simulated)}
          </Typography>
        </Box>
        
        {rates.difference !== 0 && (
          <Box 
            display="flex" 
            alignItems="center" 
            mt={1}
            p={0.75}
            borderRadius={1}
            bgcolor={alpha(
              rates.difference > 0 
                ? theme.palette.success.main 
                : theme.palette.error.main,
              0.1
            )}
          >
            {rates.difference > 0 ? (
              <TrendingDown 
                fontSize="small" 
                sx={{ 
                  color: theme.palette.success.main,
                  mr: 0.5
                }} 
              />
            ) : (
              <TrendingUp 
                fontSize="small" 
                sx={{ 
                  color: theme.palette.error.main,
                  mr: 0.5 
                }} 
              />
            )}
            
            <Typography 
              variant="body2"
              color={
                rates.difference > 0 
                  ? theme.palette.success.main 
                  : theme.palette.error.main
              }
            >
              {rates.difference > 0 ? 'Save ' : 'Increase '} 
              {formatPercentage(Math.abs(rates.difference))}
              {rates.difference > 0 ? ' on interest' : ' in interest'}
            </Typography>
          </Box>
        )}
      </Box>
      
      <Box 
        display="flex" 
        justifyContent="space-between" 
        mt="auto"
      >
        <Button 
          variant="outlined" 
          color="inherit" 
          size="small"
          startIcon={<Refresh />}
          onClick={handleReset}
          disabled={simulatedScore === currentScore || readOnly}
        >
          Reset
        </Button>
        
        <Button 
          variant="contained" 
          color="primary" 
          size="small"
          onClick={handleImproveScore}
          disabled={loading || readOnly}
        >
          Improve Score
        </Button>
      </Box>
    </Paper>
  );
};

AdjustableInterestCard.propTypes = {
  currentScore: PropTypes.number,
  baseRate: PropTypes.number,
  address: PropTypes.string,
  readOnly: PropTypes.bool
};

export default AdjustableInterestCard;
