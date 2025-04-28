import React, { useState, useEffect } from 'react';
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  IconButton,
  Divider,
  Typography,
  Box,
  Tooltip,
  ListItemButton,
  useMediaQuery,
  useTheme,
  alpha,
  Badge,
  Collapse,
  Button
} from '@mui/material';
import { 
  Dashboard as DashboardIcon,
  AccountBalanceWallet as WalletIcon,
  Fingerprint as IdentityIcon,
  Assessment as RiskIcon,
  Person as ProfileIcon,
  CompareArrows as CrossLayerIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Settings as SettingsIcon,
  NightsStay as DarkModeIcon,
  WbSunny as LightModeIcon,
  StarRate as StakingIcon,
  WarningAmber as LiquidationIcon,
  HistoryToggleOff as HistoryIcon,
  MonetizationOn as DepositIcon,
  Insights as AIIcon,
  Code as CodeIcon,
  SmartToy as RobotIcon,
  Psychology as BrainIcon,
  Analytics as AnalyticsIcon,
  TipsAndUpdates as TipsIcon,
  ArrowDropDown as ArrowDropDownIcon,
  ArrowDropUp as ArrowDropUpIcon,
  CurrencyExchange as BorrowIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppTheme } from '../../context/ThemeContext';
import { useWeb3 } from '../../context/Web3Context';
import WalletStatus from '../wallet/WalletStatus';

const drawerWidth = 260;
const closedDrawerWidth = 68;

const Sidebar = () => {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleColorMode } = useAppTheme();
  const { isConnected } = useWeb3();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  // Main menu items with cleaner structure
  const mainMenuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Lending', icon: <DepositIcon />, path: '/deposit' },
    { text: 'Borrowing', icon: <BorrowIcon />, path: '/borrow' },
    { text: 'Portfolio', icon: <ProfileIcon />, path: '/portfolio' },
    { text: 'Staking', icon: <StakingIcon />, path: '/staking', badge: { label: 'New', color: 'success' } },
  ];

  // IOTA specific tools
  const iotaToolsItems = [
    { text: 'IOTA Wallet', icon: <WalletIcon />, path: '/wallet' },
    { text: 'Identity Hub', icon: <IdentityIcon />, path: '/identity' },
    { text: 'Cross-Layer Bridge', icon: <CrossLayerIcon />, path: '/cross-layer' },
    { text: 'Contract Verification', icon: <CodeIcon />, path: '/contract-verification' },
  ];

  // New AI tools section
  const aiToolsItems = [
    { text: 'AI Dashboard', icon: <AIIcon />, path: '/ai-dashboard', badge: { label: 'Beta', color: 'primary' } },
    { text: 'Risk Analysis', icon: <RiskIcon />, path: '/risk' },
    { text: 'Explainable AI', icon: <BrainIcon />, path: '/explainable-ai' },
    { text: 'Smart Recommendations', icon: <TipsIcon />, path: '/recommendations' },
    { text: 'Market Predictions', icon: <AnalyticsIcon />, path: '/predictions' },
  ];

  // Utility menu items
  const utilityItems = [
    { text: 'Transactions', icon: <HistoryIcon />, path: '/transactions' },
    { text: 'Liquidation Alerts', icon: <LiquidationIcon />, path: '/liquidation-alerts', badge: { label: '3', color: 'error' } },
  ];

  // Adjust drawer for mobile
  useEffect(() => {
    if (isMobile && open) {
      setOpen(false);
    }
  }, [isMobile]);

  // State for expanded menu sections
  const [expandedSection, setExpandedSection] = useState('ai'); // AI section expanded by default

  // Toggle section expansion
  const toggleSection = (section) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  // Menu section component with improved styling
  const MenuSection = ({ title, items, sectionKey }) => {
    const isExpanded = expandedSection === sectionKey;
    
    return (
      <>
        {open && title && (
          <Box 
            onClick={() => toggleSection(sectionKey)} 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2.5,
              pt: 2, 
              pb: 0.5,
              cursor: 'pointer',
            }}
          >
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ 
                fontWeight: 600,
                letterSpacing: '0.05em',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
              }}
            >
              {title}
            </Typography>
            {sectionKey && (
              <Box 
                sx={{ 
                  transition: 'transform 0.2s ease',
                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                }}
              >
                <ArrowDropDownIcon fontSize="small" color="action" />
              </Box>
            )}
          </Box>
        )}
        <List sx={{ 
          px: open ? 1.5 : 0.5,
          maxHeight: sectionKey ? (isExpanded ? '1000px' : (open ? '42px' : '250px')) : 'none',
          overflow: 'hidden',
          transition: sectionKey ? 'max-height 0.3s ease-in-out' : 'none',
        }}>
          {items.map((item, index) => (
            <ListItem 
              key={item.text}
              disablePadding
              sx={{ 
                display: 'block', 
                mb: 0.5,
                opacity: sectionKey && !isExpanded && index > 0 ? 0 : 1,
                transition: 'opacity 0.2s ease-in-out',
              }}
            >
              <ListItemButton
                onClick={() => navigate(item.path)}
                selected={location.pathname === item.path}
                sx={{ 
                  minHeight: 40,
                  px: 1.5,
                  borderRadius: '8px',
                  justifyContent: open ? 'initial' : 'center',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  '&.Mui-selected': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '20%',
                      height: '60%',
                      width: 3,
                      borderRadius: '0 2px 2px 0',
                      backgroundColor: theme.palette.primary.main,
                    }
                  },
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.04)
                  }
                }}
              >
                <Tooltip title={open ? '' : item.text} placement="right">
                  <ListItemIcon 
                    sx={{ 
                      minWidth: 0, 
                      mr: open ? 2.5 : 'auto', 
                      justifyContent: 'center',
                      color: location.pathname === item.path 
                        ? theme.palette.primary.main
                        : theme.palette.text.secondary,
                      fontSize: '1.2rem'
                    }}
                  >
                    {item.badge ? (
                      <Badge 
                        badgeContent={item.badge.label} 
                        color={item.badge.color}
                        sx={{
                          '& .MuiBadge-badge': {
                            fontSize: '0.65rem',
                            height: 16,
                            minWidth: 16,
                            padding: '0 4px',
                            fontWeight: 600
                          }
                        }}
                      >
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </ListItemIcon>
                </Tooltip>
                {open && (
                  <ListItemText 
                    primary={item.text} 
                    primaryTypographyProps={{ 
                      fontWeight: location.pathname === item.path ? 600 : 400,
                      fontSize: '0.9rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </>
    );
  };

  // Animation effect for first load
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <Drawer
      variant={isMobile ? "temporary" : "permanent"}
      open={isMobile ? open : true}
      onClose={isMobile ? handleDrawerToggle : undefined}
      sx={{
        width: open ? drawerWidth : closedDrawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? drawerWidth : closedDrawerWidth,
          boxSizing: 'border-box',
          overflow: open ? 'auto' : 'hidden',
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(180deg, #121F35 0%, #1A2B45 100%)' 
            : 'linear-gradient(180deg, #F9FAFB 0%, #FFFFFF 100%)',
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
          boxShadow: theme.palette.mode === 'dark' 
            ? '0px 4px 20px rgba(0, 0, 0, 0.2)' 
            : '0px 4px 20px rgba(0, 0, 0, 0.05)',
          transition: theme.transitions.create(['width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.shorter,
          }),
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateX(0)' : 'translateX(-10px)',
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(theme.palette.primary.main, 0.2),
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: alpha(theme.palette.primary.main, 0.3),
          }
        },
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        py: 1.5,
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: open ? 'space-between' : 'center',
          px: open ? 2.5 : 1,
          py: 1,
        }}>
          {open ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box 
                  component="img" 
                  src="/assets/iota-logo-icon.svg"
                  alt="IOTA Logo" 
                  sx={{ 
                    width: 30, 
                    height: 30, 
                    mr: 1.5,
                    filter: theme.palette.mode === 'dark' ? 'brightness(1.5)' : 'none'
                  }} 
                />
                <Typography 
                  variant="h6" 
                  fontWeight={700}
                  sx={{
                    background: theme.palette.mode === 'dark' 
                      ? 'linear-gradient(90deg, #4C3F91 0%, #00BFA5 100%)' 
                      : 'linear-gradient(90deg, #4C3F91 0%, #00BFA5 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    textFillColor: 'transparent',
                  }}
                >
                  IntelliLend
                </Typography>
              </Box>
              <IconButton 
                onClick={handleDrawerToggle} 
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  }
                }}
              >
                <ChevronLeftIcon />
              </IconButton>
            </>
          ) : (
            <IconButton 
              onClick={handleDrawerToggle} 
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                }
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
        </Box>

        {open && (
          <Box 
            sx={{ 
              mx: 2.5, 
              mt: 2,
              mb: 1,
              p: 1.5,
              borderRadius: '10px',
              bgcolor: alpha(theme.palette.primary.main, 0.07),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              display: 'flex',
              alignItems: 'center',
              boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.05)}`
            }}
          >
            <Box 
              sx={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                bgcolor: theme.palette.success.main,
                boxShadow: `0 0 0 2px ${alpha(theme.palette.success.main, 0.3)}`,
                mr: 1.5,
              }} 
            />
            <Typography 
              sx={{ 
                fontWeight: 500,
                fontSize: '0.85rem',
              }}
            >
              IOTA EVM Testnet
            </Typography>
          </Box>
        )}
      </Box>

      {/* Wallet Status Component */}
      <WalletStatus compact={!open} />

      <Box sx={{ overflow: 'auto', flex: 1, py: 1.5 }}>
        <MenuSection title="Main Menu" items={mainMenuItems} sectionKey="main" />
        <Divider sx={{ my: 1.5, mx: open ? 2.5 : 1, opacity: 0.4 }} />
        <MenuSection title="IOTA Tools" items={iotaToolsItems} sectionKey="iota" />
        <Divider sx={{ my: 1.5, mx: open ? 2.5 : 1, opacity: 0.4 }} />
        <MenuSection title="AI Tools" items={aiToolsItems} sectionKey="ai" />
        <Divider sx={{ my: 1.5, mx: open ? 2.5 : 1, opacity: 0.4 }} />
        <MenuSection title="Utilities" items={utilityItems} sectionKey="util" />
      </Box>

      <Divider sx={{ my: 1, opacity: 0.4 }} />

      <Box sx={{ px: open ? 2.5 : 1, py: 1.5 }}>
        <Box sx={{ 
          display: 'flex',
          justifyContent: open ? 'space-between' : 'center',
          alignItems: 'center',
          gap: 1,
          mb: 1
        }}>
          {open && (
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ fontWeight: 500 }}
            >
              Theme
            </Typography>
          )}
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              onClick={toggleColorMode}
              size="small"
              sx={{
                color: theme.palette.text.secondary,
                bgcolor: theme.palette.mode === mode ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                }
              }}
            >
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
            
            <IconButton
              onClick={() => navigate('/settings')}
              size="small"
              sx={{
                color: theme.palette.text.secondary,
                bgcolor: location.pathname === '/settings' ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                }
              }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>
      
      {open && (
        <Box 
          sx={{ 
            p: 2, 
            textAlign: 'center',
            mt: 'auto',
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
          }}
        >
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 500,
              mb: 0.5
            }}
          >
            IntelliLend v1.0.0
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              fontSize: '0.7rem',
              opacity: 0.7
            }}
          >
            © 2025 IOTA Foundation
          </Typography>
        </Box>
      )}
    </Drawer>
  );
};

export default Sidebar;