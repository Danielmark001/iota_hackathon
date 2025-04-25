import React from 'react';
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Avatar,
  Chip,
  InputAdornment,
  IconButton,
  Tooltip,
  Skeleton,
  useTheme,
} from '@mui/material';
import { Info } from '@mui/icons-material';

const AssetSelector = ({
  assets = [],
  value = '',
  onChange,
  error = false,
  helperText = '',
  label = 'Asset',
  loading = false,
  disabled = false,
  displayBalance = true,
  displayApy = true,
  apyType = 'supply', // 'supply' or 'borrow'
}) => {
  const theme = useTheme();
  
  if (loading) {
    return (
      <Skeleton 
        variant="rectangular" 
        width="100%" 
        height={56} 
        sx={{ borderRadius: 1 }} 
      />
    );
  }
  
  // Format APY with plus/minus sign and color
  const formatApy = (apy, type) => {
    const sign = type === 'supply' ? '+' : '-';
    const color = type === 'supply' ? 'success.main' : 'error.main';
    
    return (
      <Typography color={color} fontWeight="medium" variant="body2">
        {sign}{apy}%
      </Typography>
    );
  };
  
  return (
    <TextField
      select
      fullWidth
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      helperText={helperText}
      disabled={disabled || assets.length === 0}
      SelectProps={{
        MenuProps: {
          PaperProps: {
            sx: {
              maxHeight: 300,
              borderRadius: 2,
            },
          },
        },
      }}
    >
      {assets.length === 0 ? (
        <MenuItem disabled>
          <Typography variant="body2" color="text.secondary">
            No assets available
          </Typography>
        </MenuItem>
      ) : (
        assets.map((asset) => (
          <MenuItem key={asset.symbol} value={asset.symbol} sx={{ py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {asset.icon ? (
                  <Avatar 
                    src={asset.icon} 
                    alt={asset.name} 
                    sx={{ width: 28, height: 28, mr: 1 }} 
                  />
                ) : (
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      mr: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '0.75rem',
                    }}
                  >
                    {asset.symbol.substring(0, 1)}
                  </Box>
                )}
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    {asset.name}
                  </Typography>
                  {displayBalance && asset.balance !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                      Balance: {asset.balance} {asset.symbol}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {displayApy && asset[apyType === 'supply' ? 'apy' : 'borrowApy'] !== undefined && (
                  <Chip 
                    label={formatApy(
                      asset[apyType === 'supply' ? 'apy' : 'borrowApy'], 
                      apyType
                    )} 
                    size="small"
                    variant="outlined"
                    color={apyType === 'supply' ? 'success' : 'error'}
                    sx={{ mr: 1 }}
                  />
                )}
                {asset.symbol && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {asset.symbol}
                  </Typography>
                )}
              </Box>
            </Box>
          </MenuItem>
        ))
      )}
    </TextField>
  );
};

export default AssetSelector;
