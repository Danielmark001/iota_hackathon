import React from 'react';
import { Box, Chip, Tooltip, Paper, Typography, Link } from '@mui/material';
import { Info, BugReport, Warning } from '@mui/icons-material';

/**
 * NetworkIndicator Component
 * 
 * Displays the current IOTA network (MainNet, TestNet, DevNet) and environment (development, production)
 * to improve developer and user awareness of the current context.
 */
const NetworkIndicator = ({ network, isDevEnv }) => {
  // Determine network display information
  const getNetworkInfo = () => {
    switch (network) {
      case 'mainnet':
        return {
          name: 'IOTA MainNet',
          color: 'success',
          icon: null,
          description: 'Production IOTA network with real tokens',
          explorerUrl: 'https://explorer.shimmer.network/shimmer',
          evmExplorerUrl: 'https://explorer.evm.iota.org'
        };
      case 'testnet':
        return {
          name: 'IOTA TestNet',
          color: 'warning',
          icon: <Warning fontSize="small" />,
          description: 'Testing IOTA network with no real value tokens',
          explorerUrl: 'https://explorer.shimmer.network/testnet',
          evmExplorerUrl: 'https://explorer.evm.testnet.iota.cafe'
        };
      case 'devnet':
        return {
          name: 'IOTA DevNet',
          color: 'info',
          icon: <BugReport fontSize="small" />,
          description: 'Development IOTA network for testing new features',
          explorerUrl: 'https://explorer.shimmer.network/testnet',
          evmExplorerUrl: 'https://explorer.evm.testnet.iota.cafe'
        };
      default:
        return {
          name: `Unknown (${network})`,
          color: 'error',
          icon: <Warning fontSize="small" />,
          description: 'Unknown network configuration',
          explorerUrl: '#',
          evmExplorerUrl: '#'
        };
    }
  };
  
  const networkInfo = getNetworkInfo();
  
  return (
    <Box 
      sx={{ 
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 1
      }}
    >
      <Tooltip
        title={
          <Paper elevation={0} sx={{ p: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              {networkInfo.name}
            </Typography>
            <Typography variant="body2">
              {networkInfo.description}
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Link 
                href={networkInfo.explorerUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                color="inherit"
                underline="hover"
                sx={{ display: 'block', fontSize: '0.8rem' }}
              >
                L1 Explorer
              </Link>
              <Link 
                href={networkInfo.evmExplorerUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                color="inherit"
                underline="hover"
                sx={{ display: 'block', fontSize: '0.8rem' }}
              >
                L2 EVM Explorer
              </Link>
            </Box>
          </Paper>
        }
        placement="left"
        arrow
      >
        <Chip
          label={networkInfo.name}
          color={networkInfo.color}
          size="small"
          icon={networkInfo.icon}
          sx={{ 
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
            '& .MuiChip-label': {
              fontWeight: 'medium'
            }
          }}
        />
      </Tooltip>
      
      {isDevEnv && (
        <Tooltip title="Development environment - No real tokens are used">
          <Chip
            label="Development"
            color="info"
            size="small"
            icon={<BugReport fontSize="small" />}
            sx={{ 
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              '& .MuiChip-label': {
                fontWeight: 'medium'
              }
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

export default NetworkIndicator;
