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
  CurrencyExchange as BorrowIcon,
  Security as SecurityIcon,
  Stream as StreamIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWeb3 } from '../../context/Web3Context';
import WalletStatus from '../wallet/WalletStatus';

const drawerWidth = 260;
const closedDrawerWidth = 68;

const Sidebar = () => {
  const [open, setOpen] = useState(false); // Start in compact mode
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected } = useWeb3();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  // Main menu items with AI Dashboard added at top
  const mainMenuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'AI Dashboard', icon: <AIIcon />, path: '/ai-dashboard', badge: { label: 'Beta', color: 'primary' } },
    { text: 'Lending', icon: <DepositIcon />, path: '/deposit' },
    { text: 'Borrowing', icon: <BorrowIcon />, path: '/borrow' },
    { text: 'Portfolio', icon: <ProfileIcon />, path: '/portfolio' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  // IOTA specific tools - reduced to fit without scrolling
  const iotaToolsItems = [
    { text: 'IOTA Wallet', icon: <WalletIcon />, path: '/wallet' },
    { text: 'Identity Hub', icon: <IdentityIcon />, path: '/identity' },
    { text: 'Cross-Layer Bridge', icon: <CrossLayerIcon />, path: '/cross-layer' },
  ];

  // AI tools section - without dashboard (moved to main menu)
  const aiToolsItems = [
    { text: 'Risk Analysis', icon: <RiskIcon />, path: '/risk' },
    { text: 'Explainable AI', icon: <BrainIcon />, path: '/explainable-ai' },
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
  }, [isMobile, open]);

  // State for expanded menu sections - AI section expanded by default
  const [expandedSection, setExpandedSection] = useState('ai');

  // Toggle section expansion
  const toggleSection = (section) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  // Menu section component with improved styling - more compact
  const MenuSection = ({ title, items, sectionKey }) => {
    const isExpanded = sectionKey === null || expandedSection === sectionKey;
    
    return (
      <>
        {open && title && (
          <Box 
            onClick={() => toggleSection(sectionKey)} 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              pt: 1, 
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
                fontSize: '0.7rem',
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
          px: open ? 1 : 0.5,
          maxHeight: sectionKey ? (isExpanded ? 'auto' : (open ? '42px' : 'auto')) : 'none',
          overflow: 'visible',
          transition: sectionKey ? 'max-height 0.3s ease-in-out' : 'none',
        }}>
          {items.map((item, index) => (
            <ListItem 
              key={item.text}
              disablePadding
              sx={{ 
                display: 'block', 
                mb: 3.5,
                opacity: sectionKey && !isExpanded && index > 0 ? 0 : 1,
                transition: 'opacity 0.2s ease-in-out',
              }}
            >
              <ListItemButton
                onClick={() => navigate(item.path)}
                selected={location.pathname === item.path}
                sx={{ 
                  minHeight: 42,
                  px: 1,
                  borderRadius: '6px',
                  justifyContent: open ? 'initial' : 'center',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  my: 0.5,
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
                      fontSize: '1.2rem',
                      '& .MuiSvgIcon-root': {
                        fontSize: '1.8rem'
                      }
                    }}
                  >
                    {item.badge ? (
                      <Box sx={{ position: 'relative' }}>
                        {item.icon}
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: -10,
                            right: -12,
                            bgcolor: item.badge.color === 'success' ? '#4caf50' : 
                                    item.badge.color === 'primary' ? '#651fff' : 
                                    item.badge.color === 'error' ? '#f44336' : '#2196f3',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '0.6rem',
                            fontWeight: 'bold',
                            px: 0.8,
                            py: 0.1,
                            minWidth: 24,
                            textAlign: 'center'
                          }}
                        >
                          {item.badge.label}
                        </Box>
                      </Box>
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
          overflow: 'visible',
          background: 'linear-gradient(180deg, #F9FAFB 0%, #FFFFFF 100%)',
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.05)',
          transition: theme.transitions.create(['width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.shorter,
          }),
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateX(0)' : 'translateX(-10px)',
          // No scrollbar styles needed
        },
      }}
    >
      {/* Testnet label at top */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Box
          sx={{
            borderRadius: '12px',
            border: '1px solid #ff0000',
            color: '#ff0000',
            fontSize: '12px',
            py: 0.3,
            px: 1,
            display: 'inline-block',
            fontWeight: 500,
          }}
        >
          testnet
        </Box>
      </Box>
      
      {/* IOTA Logo */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: open ? 'space-between' : 'center',
        px: open ? 2.5 : 1,
        py: 2,
        mb: 1,
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
                }}
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjMDAwIi8+PC9zdmc+';
                }}
              />
              <Typography 
                variant="h6" 
                fontWeight={700}
                sx={{
                  background: 'linear-gradient(90deg, #4C3F91 0%, #00BFA5 100%)',
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
          <Box 
            component="img" 
            src="/assets/iota-logo-icon.svg"
            alt="IOTA Logo" 
            sx={{ width: 30, height: 30 }}
            onError={(e) => {
              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjMDAwIi8+PC9zdmc+';
            }}
          />
        )}
      </Box>

      {/* Network status indicator */}
      {open ? (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-start',
          px: 2.5,
          py: 0.5,
        }}>
          <Box 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              py: 0.5,
              px: 1,
              borderRadius: '16px',
              bgcolor: alpha(theme.palette.success.main, 0.1),
              border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
              justifyContent: 'center'
            }}
          >
            <Box 
              sx={{ 
                width: 6, 
                height: 6, 
                borderRadius: '50%', 
                bgcolor: theme.palette.success.main,
                boxShadow: `0 0 0 2px ${alpha(theme.palette.success.main, 0.3)}`,
                mr: 0.5,
              }} 
            />
            <Typography 
              sx={{ 
                fontWeight: 500,
                fontSize: '0.7rem',
                color: theme.palette.success.main
              }}
            >
              TESTNET
            </Typography>
          </Box>
        </Box>
      ) : null}

      {/* Wallet Status - integrated in a more compact way */}
      {!open && (
        <Box sx={{ px: 0.5, py: 1 }}>
          <WalletStatus compact={true} />
        </Box>
      )}

      <Box sx={{ overflow: 'visible', flex: 0, py: 3 }}>
        <MenuSection items={mainMenuItems} sectionKey={null} />
        <Divider sx={{ my: 2, mx: open ? 2 : 0.5, opacity: 0.4 }} />
        <MenuSection title="IOTA Tools" items={iotaToolsItems} sectionKey="iota" />
        <Divider sx={{ my: 1, mx: open ? 2 : 0.5, opacity: 0.4 }} />
        <MenuSection title="AI Tools" items={aiToolsItems} sectionKey="ai" />
        <Divider sx={{ my: 1, mx: open ? 2 : 0.5, opacity: 0.4 }} />
        <MenuSection title="Utilities" items={utilityItems} sectionKey="util" />
      </Box>

      {/* No footer to save space and prevent scrolling */}
    </Drawer>
  );
};

export default Sidebar;