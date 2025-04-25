import React from 'react';
import { Box, Paper, Typography, Tooltip, LinearProgress, Button, Skeleton } from '@mui/material';
import { Warning, Info, AddCircle } from '@mui/icons-material';

// Get color based on health factor
const getHealthColor = (healthFactor) => {
  if (healthFactor >= 1.7) return '#4caf50'; // Safe
  if (healthFactor >= 1.2) return '#ff9800'; // Warning
  return '#f44336'; // Danger
};

// Get status text based on health factor
const getHealthStatus = (healthFactor) => {
  if (healthFactor >= 1.7) return 'Safe';
  if (healthFactor >= 1.2) return 'Warning';
  return 'Danger';
};

// Calculate progress percentage for the health bar (capped at 100%)
const calculateProgress = (healthFactor) => {
  // Scale to make the bar more visually useful
  // 1.0 = 0% (liquidation threshold)
  // 2.0 = 100% (very safe)
  const progress = ((healthFactor - 1) / 1) * 100;
  return Math.min(Math.max(progress, 0), 100); // Clamp between 0-100
};

const HealthFactorCard = ({ healthFactor, loading = false }) => {
  // Format for display (always show two decimal places)
  const displayHealthFactor = loading ? '--' : healthFactor.toFixed(2);
  
  // Get status properties
  const healthColor = loading ? '#9e9e9e' : getHealthColor(healthFactor);
  const healthStatus = loading ? 'Loading...' : getHealthStatus(healthFactor);
  
  // Calculate progress for the health bar
  const progress = loading ? 0 : calculateProgress(healthFactor);
  
  return (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        height: '100%',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          Health Factor
          <Tooltip title="Health Factor represents the safety of your loan relative to its collateral value. A value below 1.0 triggers liquidation. Higher is safer." placement="top">
            <Info fontSize="small" sx={{ ml: 0.5, opacity: 0.7 }} />
          </Tooltip>
        </Typography>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
          <Skeleton variant="text" width="60%" height={40} className="loading-pulse" />
          <Skeleton variant="rectangular" width="100%" height={12} className="loading-pulse" />
          <Skeleton variant="text" width="40%" height={30} className="loading-pulse" />
          <Box sx={{ mt: 'auto' }}>
            <Skeleton variant="rectangular" width="100%" height={36} className="loading-pulse" />
          </Box>
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h3" sx={{ color: healthColor, fontWeight: 'medium' }}>
              {displayHealthFactor}
            </Typography>
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 12,
                borderRadius: 6,
                bgcolor: '#f5f5f5',
                '& .MuiLinearProgress-bar': {
                  bgcolor: healthColor,
                  transition: 'transform 1s ease',
                },
              }}
            />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Liquidation threshold
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Safe
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                mr: 1,
                backgroundColor: `${healthColor}20`,
              }}
            >
              {healthFactor < 1.5 && <Warning fontSize="small" sx={{ mr: 0.5, color: healthColor }} />}
              <Typography variant="body1" sx={{ fontWeight: 'medium', color: healthColor }}>
                {healthStatus}
              </Typography>
            </Box>
            
            {healthFactor < 1.5 && (
              <Typography variant="body2" color="text.secondary">
                {healthFactor < 1.2 
                  ? 'At risk of liquidation' 
                  : 'Consider adding more collateral'}
              </Typography>
            )}
          </Box>
          
          <Box sx={{ mt: 'auto' }}>
            <Button
              variant="outlined"
              color="primary"
              fullWidth
              startIcon={<AddCircle />}
              href="/deposit" // Link to deposit page
            >
              Add Collateral
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default HealthFactorCard;
