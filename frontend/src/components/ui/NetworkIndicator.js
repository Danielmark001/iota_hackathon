import React from 'react';
import { 
  Chip, 
  Box, 
  Tooltip, 
  useTheme,
  Paper,
  Typography,
  alpha
} from '@mui/material';
import { 
  Code as CodeIcon,
  SignalCellularAlt as SignalIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';

const NetworkIndicator = ({ network, isDevEnv, sx = {} }) => {
  const theme = useTheme();
  
  // Set color based on network
  const getNetworkColor = () => {
    switch (network) {
      case 'mainnet':
        return 'success';
      case 'testnet':
        return 'warning';
      case 'devnet':
        return 'info';
      default:
        return 'default';
    }
  };
  
  // Set name based on network
  const getNetworkName = () => {
    switch (network) {
      case 'mainnet':
        return 'IOTA Mainnet';
      case 'testnet':
        return 'Shimmer Testnet';
      case 'devnet':
        return 'IOTA Devnet';
      default:
        return network || 'Unknown Network';
    }
  };
  
  return (
    <Paper 
      elevation={0}
      sx={{ 
        display: 'flex',
        flexWrap: { xs: 'wrap', md: 'nowrap' },
        alignItems: 'center',
        gap: { xs: 3, md: 2 },
        p: 2.5,
        mb: 3,
        borderRadius: '18px',
        border: `1px solid ${theme.palette.mode === 'dark' 
          ? alpha(theme.palette.primary.main, 0.2) 
          : alpha(theme.palette.primary.main, 0.15)}`,
        background: theme.palette.mode === 'dark' 
          ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.25)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)` 
          : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.15)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
        backdropFilter: 'blur(10px)',
        boxShadow: theme.palette.mode === 'dark' 
          ? '0 4px 20px rgba(0, 0, 0, 0.2)' 
          : '0 4px 20px rgba(0, 0, 0, 0.05)',
        ...sx
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        flexBasis: { xs: '100%', md: 'auto' },
        flexGrow: 0,
      }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.palette.mode === 'dark' 
              ? `linear-gradient(135deg, ${alpha(theme.palette[getNetworkColor()].dark, 0.8)} 0%, ${alpha(theme.palette[getNetworkColor()].main, 0.4)} 100%)` 
              : `linear-gradient(135deg, ${alpha(theme.palette[getNetworkColor()].main, 0.8)} 0%, ${alpha(theme.palette[getNetworkColor()].light, 0.4)} 100%)`,
            color: theme.palette.common.white,
            boxShadow: `0 4px 12px ${alpha(theme.palette[getNetworkColor()].main, 0.3)}`,
            '& svg': {
              fontSize: '1.5rem',
              filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2))',
            }
          }}
        >
          <SignalIcon />
        </Box>
        <Box>
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 700, 
              mb: 0.5, 
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
            }}
          >
            Network
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${theme.palette[getNetworkColor()].main} 0%, ${alpha(theme.palette[getNetworkColor()].main, 0.6)} 100%)`,
                mr: 1,
                boxShadow: `0 0 10px ${alpha(theme.palette[getNetworkColor()].main, 0.5)}`,
                animation: network !== 'mainnet' ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { opacity: 0.6, transform: 'scale(0.9)', boxShadow: `0 0 0 0 ${alpha(theme.palette[getNetworkColor()].main, 0.7)}` },
                  '50%': { opacity: 1, transform: 'scale(1.1)', boxShadow: `0 0 0 6px ${alpha(theme.palette[getNetworkColor()].main, 0)}` },
                  '100%': { opacity: 0.6, transform: 'scale(0.9)', boxShadow: `0 0 0 0 ${alpha(theme.palette[getNetworkColor()].main, 0)}` }
                }
              }}
            />
            <Typography 
              variant="body1" 
              color={theme.palette[getNetworkColor()].main}
              sx={{ 
                fontWeight: 600,
                textShadow: theme.palette.mode === 'dark' 
                  ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
                  : 'none',
              }}
            >
              {getNetworkName()}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Divider */}
      <Box 
        sx={{ 
          width: { xs: '100%', md: 1 }, 
          height: { xs: 1, md: 36 }, 
          bgcolor: theme.palette.divider,
          mx: { xs: 0, md: 1 },
          my: { xs: 1, md: 0 },
          opacity: 0.8,
        }} 
      />

      {/* Development Mode Indicator */}
      {isDevEnv && (
        <>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            flexBasis: { xs: '100%', md: 'auto' },
            flexGrow: 0,
          }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: theme.palette.mode === 'dark' 
                  ? `linear-gradient(135deg, ${alpha(theme.palette.error.dark, 0.8)} 0%, ${alpha(theme.palette.error.main, 0.4)} 100%)` 
                  : `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.8)} 0%, ${alpha(theme.palette.error.light, 0.4)} 100%)`,
                color: theme.palette.common.white,
                boxShadow: `0 4px 12px ${alpha(theme.palette.error.main, 0.3)}`,
                '& svg': {
                  fontSize: '1.5rem',
                  filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2))',
                }
              }}
            >
              <CodeIcon />
            </Box>
            <Box>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  fontWeight: 700, 
                  mb: 0.5, 
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                }}
              >
                Mode
              </Typography>
              <Typography 
                variant="body1" 
                color="error"
                sx={{ 
                  fontWeight: 600,
                  textShadow: theme.palette.mode === 'dark' 
                    ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
                    : 'none',
                }}
              >
                Development
              </Typography>
            </Box>
          </Box>

          {/* Additional Divider for Dev Mode */}
          <Box 
            sx={{ 
              width: { xs: '100%', md: 1 }, 
              height: { xs: 1, md: 36 }, 
              bgcolor: theme.palette.divider,
              mx: { xs: 0, md: 1 },
              my: { xs: 1, md: 0 },
              opacity: 0.8,
            }} 
          />
        </>
      )}

      {/* Network Stats */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        flexBasis: { xs: '100%', md: 'auto' },
        flexGrow: 0,
      }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.palette.mode === 'dark' 
              ? `linear-gradient(135deg, ${alpha(theme.palette.secondary.dark, 0.8)} 0%, ${alpha(theme.palette.secondary.main, 0.4)} 100%)` 
              : `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.8)} 0%, ${alpha(theme.palette.secondary.light, 0.4)} 100%)`,
            color: theme.palette.common.white,
            boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}`,
            '& svg': {
              fontSize: '1.5rem',
              filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2))',
            }
          }}
        >
          <SpeedIcon />
        </Box>
        <Box>
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 700, 
              mb: 0.5, 
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
            }}
          >
            Gas Price
          </Typography>
          <Typography 
            variant="body1" 
            color="secondary"
            sx={{ 
              fontWeight: 600,
              textShadow: theme.palette.mode === 'dark' 
                ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
                : 'none',
            }}
          >
            &lt; 0.1 Gwei
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default NetworkIndicator;