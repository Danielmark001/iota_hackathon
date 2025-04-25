import React from 'react';
import { Box, Typography, Paper, Tooltip, LinearProgress, Skeleton } from '@mui/material';
import { Info } from '@mui/icons-material';

// Utility function to get color based on risk score
const getRiskColor = (score) => {
  if (score <= 30) return '#4caf50'; // Green (low risk)
  if (score <= 60) return '#ff9800'; // Orange (medium risk)
  return '#f44336'; // Red (high risk)
};

// Utility function to get risk level text
const getRiskLevel = (score) => {
  if (score <= 30) return 'Low Risk';
  if (score <= 60) return 'Medium Risk';
  return 'High Risk';
};

const RiskScoreGauge = ({ score, loading = false }) => {
  // Format score for display (always show two digits)
  const displayScore = loading ? '--' : score.toString().padStart(2, '0');
  
  // Get color and risk level
  const riskColor = loading ? '#9e9e9e' : getRiskColor(score);
  const riskLevel = loading ? 'Loading...' : getRiskLevel(score);
  
  return (
    <Paper 
      elevation={2}
      sx={{
        p: 3,
        height: '100%',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          AI Risk Assessment
          <Tooltip title="Lower score indicates lower risk and better lending terms. Score is calculated using AI analysis of on-chain activity, identity verification, and market conditions." placement="top">
            <Info fontSize="small" sx={{ ml: 0.5, opacity: 0.7, verticalAlign: 'middle' }} />
          </Tooltip>
        </Typography>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, gap: 2 }}>
          <Skeleton variant="circular" width={120} height={120} className="loading-pulse" />
          <Skeleton variant="text" width="60%" height={30} className="loading-pulse" />
          <Skeleton variant="text" width="40%" height={24} className="loading-pulse" />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, position: 'relative' }}>
            <Box
              sx={{
                width: 150,
                height: 150,
                borderRadius: '50%',
                border: '12px solid #f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: -12,
                  left: -12,
                  width: 150,
                  height: 150,
                  borderRadius: '50%',
                  border: `12px solid ${riskColor}`,
                  borderColor: `${riskColor} ${riskColor} #f5f5f5 #f5f5f5`,
                  transform: `rotate(${(score / 100) * 180}deg)`,
                  transition: 'all 1s ease-out',
                },
              }}
            >
              <Typography variant="h3" sx={{ fontWeight: 'bold', color: riskColor }}>
                {displayScore}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Low Risk</Typography>
              <Typography variant="body2">High Risk</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={score}
              sx={{
                height: 10,
                borderRadius: 5,
                bgcolor: '#f5f5f5',
                '& .MuiLinearProgress-bar': {
                  bgcolor: riskColor,
                  transition: 'transform 1s ease',
                },
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 'medium',
                  color: riskColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 2,
                  px: 2,
                  py: 0.5,
                  backgroundColor: `${riskColor}20`,
                }}
              >
                {riskLevel}
              </Typography>
            </Box>
          </Box>
          
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
            Your risk score affects your borrowing limit and interest rates
          </Typography>
        </>
      )}
    </Paper>
  );
};

export default RiskScoreGauge;
