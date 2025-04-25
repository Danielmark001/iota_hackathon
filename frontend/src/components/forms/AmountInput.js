import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Slider,
  Button,
  InputAdornment,
  Tooltip,
  Skeleton,
} from '@mui/material';
import { Info } from '@mui/icons-material';

const AmountInput = ({
  label = 'Amount',
  value = '',
  onChange,
  onSliderChange,
  onMaxClick,
  percentage = 0,
  symbol = '',
  balance = 0,
  maxAmount = 0,
  error = false,
  helperText = '',
  loading = false,
  disabled = false,
  showMaxButton = true,
  showSlider = true,
  showBalance = true,
  hideSymbol = false,
}) => {
  // Handle slider marks
  const sliderMarks = [
    { value: 0, label: '0%' },
    { value: 25, label: '25%' },
    { value: 50, label: '50%' },
    { value: 75, label: '75%' },
    { value: 100, label: '100%' },
  ];
  
  if (loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1, mb: 1.5 }} />
        {showSlider && (
          <Skeleton variant="rectangular" width="100%" height={40} sx={{ mt: 2 }} />
        )}
      </Box>
    );
  }
  
  return (
    <Box>
      <TextField
        fullWidth
        label={label}
        value={value}
        onChange={onChange}
        type="number"
        disabled={disabled}
        error={error}
        helperText={
          error ? helperText : 
          showBalance ? `Balance: ${balance} ${symbol}` : 
          helperText
        }
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {showMaxButton && (
                <Button
                  variant="text"
                  size="small"
                  onClick={onMaxClick}
                  disabled={disabled || maxAmount <= 0}
                  sx={{ mr: 0.5 }}
                >
                  MAX
                </Button>
              )}
              {!hideSymbol && (
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {symbol}
                </Typography>
              )}
            </InputAdornment>
          ),
          inputProps: {
            min: 0,
            step: 'any',
          },
        }}
      />
      
      {showSlider && (
        <Box sx={{ px: 1, mt: 3, mb: 1 }}>
          <Slider
            value={percentage}
            onChange={onSliderChange}
            disabled={disabled || maxAmount <= 0}
            marks={sliderMarks}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
          />
        </Box>
      )}
    </Box>
  );
};

export default AmountInput;
