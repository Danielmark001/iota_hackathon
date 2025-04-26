import React, { useState } from 'react';
import { useIoTA } from '../../context/IoTAContext';
import WalletConnection from '../wallet/WalletConnection';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  AccountBalanceWallet,
  Logout,
  NightsStay,
  WbSunny,
  MonetizationOn,
  Fingerprint,
  Assessment,
  Person,
  Settings,
  Close,
  Message,
  CompareArrows,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWeb3 } from '../../context/Web3Context';
import { useAppTheme } from '../../context/ThemeContext';

// Logo component for consistent branding
const Logo = () => (
  <Typography
    variant="h5"
    component={RouterLink}
    to="/"
    sx={{
      fontWeight: 700,
      color: 'inherit',
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'center',
    }}
  >
    <span style={{ color: '#2196f3' }}>Intelli</span>
    <span>Lend</span>
  </Typography>
);

const Header = () => {
  const navigate = useNavigate();
  const { isAuthenticated, login, logout } = useAuth();
  const { currentAccount, isConnecting, chainId } = useWeb3();
  const { mode, toggleColorMode } = useAppTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'));

  // Handle profile menu
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Handle drawer
  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  // Navigation items
  const navItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    { text: 'Deposit', icon: <MonetizationOn />, path: '/deposit' },
    { text: 'Borrow', icon: <AccountBalanceWallet />, path: '/borrow' },
    { text: 'Identity', icon: <Fingerprint />, path: '/identity' },
    { text: 'Risk Assessment', icon: <Assessment />, path: '/risk' },
    { text: 'Portfolio', icon: <Person />, path: '/portfolio' },
    { text: 'Messaging', icon: <Message />, path: '/messaging' },
    { text: 'Cross-Layer', icon: <CompareArrows />, path: '/cross-layer' },
  ];

  // Get network name
  const getNetworkName = (id) => {
    switch (id) {
      case 4212:
        return 'IOTA EVM Testnet';
      case 1:
        return 'Ethereum Mainnet';
      default:
        return 'Unknown Network';
    }
  };

  // Drawer content
  const drawer = (
    <Box sx={{ width: 250 }} role="presentation">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2 }}>
        <Logo />
        <IconButton onClick={handleDrawerToggle}>
          <Close />
        </IconButton>
      </Box>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItem
            button
            key={item.text}
            onClick={() => {
              navigate(item.path);
              setDrawerOpen(false);
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem button onClick={toggleColorMode}>
          <ListItemIcon>
            {mode === 'dark' ? <WbSunny /> : <NightsStay />}
          </ListItemIcon>
          <ListItemText
            primary={mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
          />
        </ListItem>
        {isAuthenticated && (
          <ListItem button onClick={logout}>
            <ListItemIcon>
              <Logout />
            </ListItemIcon>
            <ListItemText primary="Disconnect" />
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="fixed" color="default" elevation={0}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo */}
          <Logo />

          {/* Desktop navigation links */}
          {!isMobile && isAuthenticated && (
            <Box sx={{ display: 'flex', mx: 2 }}>
              {navItems.map((item) => (
                <Button
                  key={item.text}
                  color="inherit"
                  component={RouterLink}
                  to={item.path}
                  sx={{ mx: 0.5 }}
                >
                  {item.text}
                </Button>
              ))}
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {/* Theme toggle */}
          {!isMobile && (
            <Tooltip title={mode === 'dark' ? 'Light Mode' : 'Dark Mode'}>
              <IconButton onClick={toggleColorMode} color="inherit">
                {mode === 'dark' ? <WbSunny /> : <NightsStay />}
              </IconButton>
            </Tooltip>
          )}

          {/* Network indicator */}
          {isAuthenticated && chainId && (
            <Chip
              label={getNetworkName(chainId)}
              size="small"
              color={chainId === 4212 ? 'success' : 'warning'}
              sx={{ mr: 2 }}
            />
          )}

          {/* IOTA Wallet Connection */}
          <Box sx={{ mr: 2 }}>
            <WalletConnection />
          </Box>

          {/* Connect EVM wallet or user menu */}
          {isAuthenticated ? (
            <>
              <Tooltip title="Account">
                <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
                  <Avatar
                    sx={{
                      backgroundColor: 'primary.main',
                      width: 32,
                      height: 32,
                    }}
                  >
                    {currentAccount.substring(2, 4).toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                PaperProps={{
                  elevation: 0,
                  sx: {
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.1))',
                    mt: 1.5,
                    '& .MuiAvatar-root': {
                      width: 32,
                      height: 32,
                      ml: -0.5,
                      mr: 1,
                    },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <MenuItem onClick={() => {
                  handleMenuClose();
                  navigate('/portfolio');
                }}>
                  <Avatar>
                    <Person />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Account
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatAddress(currentAccount)}
                    </Typography>
                  </Box>
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => {
                  handleMenuClose();
                  navigate('/settings');
                }}>
                  <ListItemIcon>
                    <Settings fontSize="small" />
                  </ListItemIcon>
                  Settings
                </MenuItem>
                <MenuItem onClick={logout}>
                  <ListItemIcon>
                    <Logout fontSize="small" />
                  </ListItemIcon>
                  Disconnect
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={login}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect EVM Wallet'}
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile navigation drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default Header;
