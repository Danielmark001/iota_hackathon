import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  LinearProgress,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  ErrorOutline,
  WarningAmber,
  CheckCircle,
  Info
} from '@mui/icons-material';

/**
 * HealthFactorIndicator displays a visual representation of a user's health factor,
 * which indicates the safety of their loan against liquidation.
 * 
 * @param {Object} props - Component props
 * @param {string|number} props.healthFactor - Health factor value
 * @param {boolean} props.showLabel - Whether to show a text label
 * @param {boolean} props.showTooltip - Whether to show explanation tooltip
 * @param {string} props.size - Size of the indicator ('small', 'medium', 'large')
 */
const HealthFactorIndicator = ({
  healthFactor,
  showLabel = true,
  showTooltip = true,
  size = 'medium'
}) => {
  const theme = useTheme();
  
  // Handle special value 'MAX'
  const isMax = healthFactor === 'MAX' || healthFactor === Infinity;
  let numericHealthFactor = isMax ? 10 : parseFloat(healthFactor);
  
  // Clamp values for display
  let displayHealthFactor = numericHealthFactor;
  if (numericHealthFactor < 0) displayHealthFactor = 0;
  if (numericHealthFactor > 10 && !isMax) displayHealthFactor = 10;
  
  // Determine health factor status and colors
  let status = 'healthy';
  let statusText = 'Healthy';
  let icon = <CheckCircle />;
  let progressColor = theme.palette.success.main;
  let progressThickness = 10;
  
  if (numericHealthFactor < 1) {
    status = 'danger';
    statusText = 'Liquidation Risk';
    icon = <ErrorOutline />;
    progressColor = theme.palette.error.main;
  } else if (numericHealthFactor < 1.2) {
    status = 'warning';
    statusText = 'At Risk';
    icon = <WarningAmber />;
    progressColor = theme.palette.warning.main;
  } else if (numericHealthFactor < 1.5) {
    status = 'caution';
    statusText = 'Caution';
    icon = <WarningAmber />;
    progressColor = theme.palette.warning.light;
  }
  
  // Set size-dependent properties
  switch (size) {
    case 'small':
      progressThickness = 6;
      break;
    case 'large':
      progressThickness = 14;
      break;
    default:
      progressThickness = 10;
  }
  
  // Calculate progress value (0-100)
  let progressValue = 0;
  
  if (numericHealthFactor <= 0) {
    progressValue = 0;
  } else if (numericHealthFactor >= 3 || isMax) {
    progressValue = 100;
  } else {
    // Map 0-3 range to 0-100%
    progressValue = (numericHealthFactor / 3) * 100;
  }
  
  // Tooltip text
  const tooltipText = 
    "Health Factor represents the safety of your loan against liquidation. " +
    "If it falls below 1, your position may be liquidated. " +
    "Higher values indicate a safer position.";
  
  // Health factor indicators at key points
  const indicators = [
    { value: 1, label: "1.0", tooltip: "Liquidation Threshold" },
    { value: 1.5, label: "1.5", tooltip: "Caution Level" },
    { value: 3, label: "3.0", tooltip: "Safe Level" }
  ];
  
  // Map health factor values (0-3) to positions on the progress bar (0-100%)
  const getPositionForValue = (value) => {
    return Math.min(100, Math.max(0, (value / 3) * 100));
  };
  
  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 0.5
        }}
      >
        {showLabel && (
          <Box display="flex" alignItems="center">
            <Typography
              variant={size === 'small' ? 'body2' : 'body1'}
              color={`${status}.main`}
              fontWeight="medium"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <Box 
                component="span" 
                sx={{ 
                  display: 'flex', 
                  mr: 0.5, 
                  color: progressColor 
                }}
              >
                {React.cloneElement(icon, { 
                  fontSize: size === 'small' ? 'small' : 'medium'
                })}
              </Box>
              {statusText}
            </Typography>
            
            {showTooltip && (
              <Tooltip title={tooltipText} arrow placement="top">
                <Info
                  fontSize={size === 'small' ? 'small' : 'medium'}
                  sx={{
                    ml: 0.5,
                    color: theme.palette.text.secondary,
                    cursor: 'help'
                  }}
                />
              </Tooltip>
            )}
          </Box>
        )}
        
        <Typography
          variant={size === 'small' ? 'body2' : 'body1'}
          fontWeight="medium"
          color={progressColor}
        >
          {isMax ? '∞' : displayHealthFactor.toFixed(2)}
        </Typography>
      </Box>
      
      <Box sx={{ position: 'relative' }}>
        <LinearProgress
          variant="determinate"
          value={progressValue}
          sx={{
            height: progressThickness,
            borderRadius: progressThickness / 2,
            backgroundColor: alpha(theme.palette.grey[300], 0.5),
            '& .MuiLinearProgress-bar': {
              borderRadius: progressThickness / 2,
              backgroundColor: progressColor
            }
          }}
        />
        
        {/* Threshold indicators */}
        {indicators.map((indicator) => (
          <Tooltip
            key={indicator.value}
            title={indicator.tooltip}
            arrow
            placement="top"
          >
            <Box
              sx={{
                position: 'absolute',
                left: `${getPositionForValue(indicator.value)}%`,
                bottom: progressThickness,
                transform: 'translateX(-50%)',
                width: 1,
                height: progressThickness + 4,
                backgroundColor: theme.palette.grey[500],
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  width: 1,
                  height: progressThickness,
                  backgroundColor: 'inherit'
                }
              }}
            >
              <Typography
                variant="caption"
                component="div"
                sx={{
                  position: 'absolute',
                  bottom: progressThickness + 5,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: theme.palette.text.secondary,
                  whiteSpace: 'nowrap',
                  fontWeight: indicator.value === 1 ? 'bold' : 'normal',
                  color: indicator.value === 1 ? theme.palette.error.main : theme.palette.text.secondary
                }}
              >
                {indicator.label}
              </Typography>
            </Box>
          </Tooltip>
        ))}
      </Box>
      
      {/* Health factor explanation */}
      {size === 'large' && (
        <Box mt={2} mb={1}>
          <Typography variant="body2" color="textSecondary">
            Your Health Factor is{' '}
            <Box
              component="span"
              sx={{
                fontWeight: 'bold',
                color: progressColor
              }}
            >
              {isMax ? 'Infinite' : displayHealthFactor.toFixed(2)}
            </Box>
            {isMax ? (
              '. You have no borrowed assets, so your position is completely safe.'
            ) : numericHealthFactor < 1 ? (
              '. Your position is at immediate risk of liquidation. Add more collateral or repay some debt immediately.'
            ) : numericHealthFactor < 1.2 ? (
              '. Your position is at high risk of liquidation if market prices fluctuate. Consider adding more collateral.'
            ) : numericHealthFactor < 1.5 ? (
              '. Your position could be at risk if market conditions change significantly. Monitor closely.'
            ) : numericHealthFactor < 3 ? (
              '. Your position is relatively safe, but adding more collateral would further reduce liquidation risk.'
            ) : (
              '. Your position is very safe with minimal liquidation risk.'
            )}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

HealthFactorIndicator.propTypes = {
  healthFactor: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string
  ]),
  showLabel: PropTypes.bool,
  showTooltip: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium', 'large'])
};

export default HealthFactorIndicator;
