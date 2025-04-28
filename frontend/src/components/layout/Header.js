import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Box, 
  IconButton, 
  InputBase, 
  Tooltip, 
  Button,
  Typography,
  alpha,
  useTheme,
  Badge,
  Avatar,
  useMediaQuery,
  Chip
} from '@mui/material';
import { 
  Search as SearchIcon,
  AccountBalanceWallet as WalletIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Notifications as NotificationsIcon,
  Help as HelpIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  FiberManualRecord as DotIcon
} from '@mui/icons-material';
import { useWeb3 } from '../../context/Web3Context';
import { useAppTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

const Header = ({ network = 'testnet', isDevEnv = false }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { mode, toggleColorMode } = useAppTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const { 
    isConnected, 
    currentAccount, 
    connectWallet,
    isConnecting
  } = useWeb3();

  // Handle search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const searchTerm = e.target.search.value;
    if (!searchTerm) return;
    
    // Determine what to search for based on the input
    if (searchTerm.startsWith('0x') && searchTerm.length > 10) {
      // If it looks like an address or hash
      if (searchTerm.length >= 40) {
        navigate(`/transactions?address=${searchTerm}`);
      } else {
        navigate(`/transactions?tx=${searchTerm}`);
      }
    } else if (!isNaN(searchTerm)) {
      // If it's a number, assume it's a block
      navigate(`/transactions?block=${searchTerm}`);
    } else {
      // Default search
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  // Shortened address display
  const shortAddress = currentAccount ? 
    `${currentAccount.substring(0, 6)}...${currentAccount.substring(currentAccount.length - 4)}` : 
    '';

  return (
    <AppBar 
      position="sticky" 
      elevation={0}
      sx={{ 
        background: theme.palette.mode === 'dark' 
          ? 'linear-gradient(90deg, rgba(18, 31, 53, 0.95) 0%, rgba(26, 43, 69, 0.95) 100%)' 
          : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        color: theme.palette.text.primary,
        zIndex: theme.zIndex.drawer + 1,
        position: 'sticky',
        top: 0
      }}
    >
      <Toolbar sx={{ px: { xs: 2, sm: 3 }, minHeight: { xs: '64px', md: '64px' }, gap: 2 }}>
        {/* Network Status */}
        <Box 
          sx={{ 
            display: 'flex',
            alignItems: 'center',
            mr: 1
          }}
        >
          <Typography 
            variant="body2" 
            sx={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.75rem',
              color: theme.palette.text.secondary
            }}
          >
            Gas 
            <Box component="span" sx={{ 
              display: 'inline-flex', 
              alignItems: 'center',
              ml: 1,
              color: theme.palette.success.main
            }}>
              &lt; 0.1 Gwei
            </Box>
          </Typography>
        </Box>
        
        {/* Search Bar - Minimalist style inspired by IOTA explorer */}
        <Box 
          component="form" 
          onSubmit={handleSearchSubmit}
          sx={{ 
            position: 'relative',
            backgroundColor: theme.palette.mode === 'dark' 
              ? alpha(theme.palette.common.white, 0.05) 
              : alpha(theme.palette.common.black, 0.03),
            border: `1px solid ${theme.palette.mode === 'dark' 
              ? alpha(theme.palette.common.white, 0.1) 
              : alpha(theme.palette.common.black, 0.08)}`,
            borderRadius: 1.5,
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark' 
                ? alpha(theme.palette.common.white, 0.07) 
                : alpha(theme.palette.common.black, 0.05),
              borderColor: theme.palette.mode === 'dark' 
                ? alpha(theme.palette.common.white, 0.15) 
                : alpha(theme.palette.common.black, 0.12),
            },
            '&:focus-within': {
              borderColor: theme.palette.primary.main,
              boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.15)}`,
            },
            flexGrow: 1,
            maxWidth: 550,
            transition: 'all 0.2s ease',
          }}
        >
          <Box sx={{ 
            padding: '0 12px', 
            height: '100%', 
            position: 'absolute', 
            display: 'flex', 
            alignItems: 'center',
            pointerEvents: 'none',
          }}>
            <SearchIcon sx={{ 
              color: theme.palette.mode === 'dark' 
                ? alpha(theme.palette.common.white, 0.5) 
                : alpha(theme.palette.common.black, 0.4),
              fontSize: '1.1rem',
            }} />
          </Box>
          <InputBase
            name="search"
            placeholder={isMobile ? "Search..." : "Search by address / txn hash / block / token..."}
            sx={{
              color: 'inherit',
              width: '100%',
              '& .MuiInputBase-input': {
                padding: '10px 12px 10px 36px',
                width: '100%',
                fontSize: '0.875rem',
                transition: 'background 0.2s',
                '&::placeholder': {
                  color: theme.palette.mode === 'dark' 
                    ? alpha(theme.palette.common.white, 0.5) 
                    : alpha(theme.palette.common.black, 0.4),
                  opacity: 1,
                },
              },
            }}
          />
          <Box 
            sx={{ 
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              display: { xs: 'none', md: 'flex' },
              color: theme.palette.mode === 'dark' 
                ? alpha(theme.palette.common.white, 0.3) 
                : alpha(theme.palette.common.black, 0.2),
              alignItems: 'center',
              fontSize: '0.7rem',
              fontFamily: 'monospace',
              pointerEvents: 'none',
            }}
          >
            /
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: { xs: 1, sm: 2 }
        }}>
          {/* Theme Toggle */}
          <Tooltip title={mode === 'dark' ? "Light Mode" : "Dark Mode"} arrow placement="bottom">
            <IconButton 
              onClick={toggleColorMode}
              size="small"
              sx={{
                color: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.7) : alpha(theme.palette.common.black, 0.6),
                backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.black, 0.04),
                borderRadius: '10px',
                width: 34,
                height: 34,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.1) : alpha(theme.palette.common.black, 0.08),
                  transform: 'translateY(-1px)',
                }
              }}
            >
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Help Button */}
          <Tooltip title="Help & Documentation" arrow placement="bottom">
            <IconButton 
              size="small"
              sx={{
                color: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.7) : alpha(theme.palette.common.black, 0.6),
                backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.black, 0.04),
                borderRadius: '10px',
                width: 34,
                height: 34,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.1) : alpha(theme.palette.common.black, 0.08),
                  transform: 'translateY(-1px)',
                }
              }}
            >
              <HelpIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          
          {/* Notifications Button */}
          <Tooltip title="Notifications" arrow placement="bottom">
            <IconButton 
              size="small"
              sx={{
                color: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.7) : alpha(theme.palette.common.black, 0.6),
                backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.black, 0.04),
                borderRadius: '10px',
                width: 34,
                height: 34,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.1) : alpha(theme.palette.common.black, 0.08),
                  transform: 'translateY(-1px)',
                }
              }}
            >
              <Badge 
                badgeContent={3} 
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.65rem',
                    height: 16,
                    minWidth: 16,
                    padding: '0 4px',
                    fontWeight: 600,
                    border: `2px solid ${theme.palette.mode === 'dark' ? '#1A2635' : '#FFFFFF'}`,
                  }
                }}
              >
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Wallet Connection Button - Styled after IOTA explorer */}
          {isConnected ? (
            <Button
              variant="contained"
              disableElevation
              startIcon={
                <Box 
                  sx={{ 
                    width: 10, 
                    height: 10, 
                    borderRadius: '50%',
                    bgcolor: theme.palette.success.main,
                    boxShadow: `0 0 0 2px ${alpha(theme.palette.success.main, 0.3)}`,
                  }}
                />
              }
              endIcon={<ArrowDownIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/wallet')}
              sx={{ 
                borderRadius: '10px', 
                py: 0.9,
                px: 2,
                minHeight: 38,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                backgroundColor: theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.primary.main, 0.15) 
                  : alpha(theme.palette.primary.light, 0.1),
                color: theme.palette.mode === 'dark' 
                  ? theme.palette.primary.light 
                  : theme.palette.primary.main,
                border: `1px solid ${theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.primary.main, 0.3) 
                  : alpha(theme.palette.primary.main, 0.15)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: theme.palette.mode === 'dark' 
                    ? alpha(theme.palette.primary.main, 0.25) 
                    : alpha(theme.palette.primary.light, 0.18),
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 8px ${alpha(theme.palette.primary.main, 0.1)}`
                },
                '&:active': {
                  transform: 'translateY(0)',
                  boxShadow: 'none'
                }
              }}
            >
              {shortAddress}
            </Button>
          ) : (
            <Button
              variant="contained"
              disableElevation
              startIcon={
                <WalletIcon sx={{ fontSize: '1.1rem' }}/>
              }
              onClick={connectWallet}
              disabled={isConnecting}
              sx={{ 
                borderRadius: '10px', 
                py: 0.9,
                px: 2,
                minHeight: 38,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                background: 'linear-gradient(90deg, #4C3F91 0%, #00BFA5 100%)',
                boxShadow: theme.palette.mode === 'dark' 
                  ? '0 4px 12px rgba(0, 0, 0, 0.2)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.08)',
                border: `1px solid ${theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.primary.light, 0.2) 
                  : alpha(theme.palette.primary.dark, 0.1)}`,
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%)',
                  transform: 'translateX(-100%)',
                  transition: 'transform 0.8s ease',
                },
                '&:hover': {
                  boxShadow: theme.palette.mode === 'dark' 
                    ? '0 6px 16px rgba(0, 0, 0, 0.3)' 
                    : '0 6px 16px rgba(0, 0, 0, 0.12)',
                  transform: 'translateY(-1px)',
                  '&::before': {
                    transform: 'translateX(100%)'
                  }
                },
                '&:active': {
                  transform: 'translateY(0)',
                  boxShadow: theme.palette.mode === 'dark' 
                    ? '0 3px 8px rgba(0, 0, 0, 0.3)' 
                    : '0 3px 8px rgba(0, 0, 0, 0.1)',
                }
              }}
            >
              Connect
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;