import React, { createContext, useContext, useState, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';

// Create context
const ThemeContext = createContext(null);

// Provider component
export const AppThemeProvider = ({ children }) => {
  const [mode, setMode] = useState('light');

  // Toggle theme mode function
  const toggleColorMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  // Create theme based on mode
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#5A30B5', // Refined IOTA Purple
            light: '#7C5DD6',
            dark: '#41248A',
            contrastText: '#ffffff',
          },
          secondary: {
            main: '#00BFA5', // Enhanced IOTA Teal
            light: '#33CFBA',
            dark: '#008F7B',
            contrastText: '#ffffff',
          },
          info: {
            main: '#3B82F6', // Blue for informational elements
            light: '#60A5FA',
            dark: '#2563EB',
          },
          success: {
            main: '#22C55E', // Green for success states
            light: '#4ADE80',
            dark: '#16A34A',
          },
          warning: {
            main: '#F59E0B', // Amber for warnings
            light: '#FBBF24',
            dark: '#D97706',
          },
          error: {
            main: '#EF4444', // Red for errors and alerts
            light: '#F87171',
            dark: '#DC2626',
          },
          background: {
            default: mode === 'light' ? '#F9FAFB' : '#080F1E',
            paper: mode === 'light' ? '#FFFFFF' : '#121F35',
            subtle: mode === 'light' ? '#F3F4F6' : '#1E293B',
          },
          grey: {
            50: '#F9FAFB',
            100: '#F3F4F6',
            200: '#E5E7EB',
            300: '#D1D5DB',
            400: '#9CA3AF',
            500: '#6B7280',
            600: '#4B5563',
            700: '#374151',
            800: '#1F2937',
            900: '#111827',
          },
          divider: mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)',
          riskLow: {
            main: '#22C55E',
            light: '#4ADE80',
            dark: '#16A34A',
            contrastText: '#ffffff',
          },
          riskMedium: {
            main: '#F59E0B',
            light: '#FBBF24',
            dark: '#D97706',
            contrastText: '#ffffff',
          },
          riskHigh: {
            main: '#EF4444',
            light: '#F87171',
            dark: '#DC2626',
            contrastText: '#ffffff',
          },
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          h1: {
            fontSize: '2.75rem',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
          },
          h2: {
            fontSize: '2.25rem',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.25,
          },
          h3: {
            fontSize: '1.875rem',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            lineHeight: 1.3,
          },
          h4: {
            fontSize: '1.5rem',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1.35,
          },
          h5: {
            fontSize: '1.25rem',
            fontWeight: 600,
            letterSpacing: '-0.015em',
            lineHeight: 1.4,
          },
          h6: {
            fontSize: '1.125rem',
            fontWeight: 600,
            letterSpacing: '-0.015em',
            lineHeight: 1.45,
          },
          subtitle1: {
            fontSize: '1.0625rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            lineHeight: 1.5,
          },
          subtitle2: {
            fontSize: '0.9375rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            lineHeight: 1.5,
          },
          body1: {
            fontSize: '1rem',
            lineHeight: 1.6,
            letterSpacing: '-0.005em',
          },
          body2: {
            fontSize: '0.875rem',
            lineHeight: 1.6,
            letterSpacing: '-0.005em',
          },
          button: {
            fontWeight: 600,
            letterSpacing: '0.01em',
            textTransform: 'none',
          },
          caption: {
            fontSize: '0.75rem',
            letterSpacing: '0.02em',
            lineHeight: 1.5,
          },
          overline: {
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            lineHeight: 1.5,
            textTransform: 'uppercase',
          },
        },
        shape: {
          borderRadius: 14,
        },
        breakpoints: {
          values: {
            xs: 0,
            sm: 600,
            md: 900,
            lg: 1200,
            xl: 1536,
          },
        },
        shadows: [
          'none',
          '0px 1px 2px rgba(0, 0, 0, 0.05)',
          '0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)',
          '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)',
          '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.05)',
          '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)',
          '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
          ...Array(18).fill('none'),
        ],
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                scrollbarWidth: 'thin',
                scrollbarColor: mode === 'dark' ? '#374151 #1E293B' : '#D1D5DB #F3F4F6',
                '&::-webkit-scrollbar': {
                  width: '8px',
                  height: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: mode === 'dark' ? '#1E293B' : '#F3F4F6',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: mode === 'dark' ? '#374151' : '#D1D5DB',
                  borderRadius: '4px',
                  '&:hover': {
                    background: mode === 'dark' ? '#4B5563' : '#9CA3AF',
                  },
                },
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                boxShadow: mode === 'dark' 
                  ? '0px 1px 3px rgba(0, 0, 0, 0.3)' 
                  : '0px 1px 3px rgba(0, 0, 0, 0.05)',
                backgroundImage: mode === 'dark'
                  ? 'linear-gradient(120deg, #080F1E 0%, #121F35 100%)'
                  : 'linear-gradient(120deg, #F9FAFB 0%, #F3F4F6 100%)',
                borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'}`,
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: '18px',
                boxShadow: mode === 'dark' 
                  ? '0px 4px 10px rgba(0, 0, 0, 0.25)' 
                  : '0px 4px 10px rgba(0, 0, 0, 0.05)',
                border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)'}`,
                transition: 'all 0.3s ease',
                backgroundImage: mode === 'dark'
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)'
                  : 'linear-gradient(145deg, rgba(255, 255, 255, 1) 0%, rgba(248, 250, 252, 0.6) 100%)',
                '&:hover': {
                  boxShadow: mode === 'dark' 
                    ? '0px 8px 24px rgba(0, 0, 0, 0.35)' 
                    : '0px 8px 24px rgba(0, 0, 0, 0.08)',
                  transform: 'translateY(-2px)',
                },
              },
            },
          },
          MuiPaper: {
            defaultProps: {
              elevation: 0,
            },
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                borderRadius: '16px',
                border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`,
              },
              rounded: {
                borderRadius: '16px',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 600,
                padding: '10px 16px',
                transition: 'all 0.2s ease',
                fontSize: '0.9375rem',
              },
              contained: {
                boxShadow: 'none',
                background: mode === 'dark'
                  ? 'linear-gradient(90deg, rgba(90, 48, 181, 0.9) 0%, rgba(64, 36, 138, 0.9) 100%)'
                  : 'linear-gradient(90deg, rgba(90, 48, 181, 1) 0%, rgba(64, 36, 138, 1) 100%)',
                '&:hover': {
                  boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
                  transform: 'translateY(-2px)',
                },
                '&.Mui-disabled': {
                  background: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                },
              },
              containedSecondary: {
                background: mode === 'dark'
                  ? 'linear-gradient(90deg, rgba(0, 191, 165, 0.9) 0%, rgba(0, 143, 123, 0.9) 100%)'
                  : 'linear-gradient(90deg, rgba(0, 191, 165, 1) 0%, rgba(0, 143, 123, 1) 100%)',
              },
              outlined: {
                borderWidth: '1.5px',
                '&:hover': {
                  borderWidth: '1.5px',
                  backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                },
              },
              text: {
                '&:hover': {
                  backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                },
              },
            },
          },
          MuiInputBase: {
            styleOverrides: {
              root: {
                fontSize: '0.9375rem',
                transition: 'all 0.2s ease',
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: '14px',
                transition: 'all 0.2s ease',
                border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                backgroundColor: mode === 'dark' ? 'rgba(18, 31, 53, 0.5)' : 'rgba(255, 255, 255, 0.9)',
                '&:hover': {
                  boxShadow: mode === 'dark' 
                    ? '0px 4px 8px rgba(0, 0, 0, 0.25)' 
                    : '0px 4px 8px rgba(0, 0, 0, 0.05)',
                  borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                },
                '&.Mui-focused': {
                  boxShadow: mode === 'dark' 
                    ? '0px 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(90, 48, 181, 0.3)' 
                    : '0px 4px 12px rgba(0, 0, 0, 0.1), 0 0 0 2px rgba(90, 48, 181, 0.2)',
                },
              },
              notchedOutline: {
                borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: '1px',
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  },
                  '&:hover fieldset': {
                    borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundImage: mode === 'dark'
                  ? 'linear-gradient(180deg, #080F1E 0%, #121F35 100%)'
                  : 'linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)',
                borderRight: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'}`,
                boxShadow: mode === 'dark'
                  ? '2px 0 8px rgba(0, 0, 0, 0.3)'
                  : '2px 0 8px rgba(0, 0, 0, 0.03)',
              },
            },
          },
          MuiListItemButton: {
            styleOverrides: {
              root: {
                borderRadius: '14px',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                margin: '4px 0',
                '&.Mui-selected': {
                  backgroundColor: mode === 'dark'
                    ? 'rgba(90, 48, 181, 0.2)'
                    : 'rgba(90, 48, 181, 0.08)',
                  color: mode === 'dark' ? '#7C5DD6' : '#5A30B5',
                  fontWeight: 500,
                  '&:hover': {
                    backgroundColor: mode === 'dark'
                      ? 'rgba(90, 48, 181, 0.3)'
                      : 'rgba(90, 48, 181, 0.15)',
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: '-12px',
                    top: '25%',
                    height: '50%',
                    width: '4px',
                    backgroundColor: mode === 'dark' ? '#7C5DD6' : '#5A30B5',
                    borderRadius: '0 4px 4px 0',
                  },
                },
                '&:hover': {
                  backgroundColor: mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(0, 0, 0, 0.04)',
                },
              },
            },
          },
          MuiListItem: {
            styleOverrides: {
              root: {
                padding: '4px 8px',
              },
            },
          },
          MuiListItemIcon: {
            styleOverrides: {
              root: {
                minWidth: '42px',
                color: 'inherit',
              },
            },
          },
          MuiTabs: {
            styleOverrides: {
              root: {
                borderRadius: '14px',
                overflow: 'hidden',
                backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                padding: '4px',
              },
              indicator: {
                height: '100%',
                borderRadius: '10px',
                backgroundColor: mode === 'dark' ? 'rgba(90, 48, 181, 0.2)' : 'rgba(90, 48, 181, 0.1)',
                zIndex: 0,
              },
            },
          },
          MuiTab: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 500,
                borderRadius: '10px',
                zIndex: 1,
                minHeight: '44px',
                padding: '10px 16px',
                fontSize: '0.9375rem',
                transition: 'all 0.2s ease',
                '&.Mui-selected': {
                  color: mode === 'dark' ? '#7C5DD6' : '#5A30B5',
                  fontWeight: 600,
                },
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                borderRadius: '10px',
                fontWeight: 500,
                fontSize: '0.8125rem',
                height: '32px',
              },
              filled: {
                background: mode === 'dark' 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(0, 0, 0, 0.07)',
              },
              filledPrimary: {
                background: mode === 'dark'
                  ? 'rgba(90, 48, 181, 0.3)'
                  : 'rgba(90, 48, 181, 0.1)',
              },
              filledSecondary: {
                background: mode === 'dark'
                  ? 'rgba(0, 191, 165, 0.3)'
                  : 'rgba(0, 191, 165, 0.1)',
              },
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                backgroundColor: mode === 'dark'
                  ? 'rgba(18, 31, 53, 0.95)'
                  : 'rgba(17, 24, 39, 0.95)',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '0.75rem',
                border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              },
              arrow: {
                color: mode === 'dark'
                  ? 'rgba(18, 31, 53, 0.95)'
                  : 'rgba(17, 24, 39, 0.95)',
              },
            },
          },
          MuiBadge: {
            styleOverrides: {
              badge: {
                fontWeight: 600,
                fontSize: '0.6875rem',
                minWidth: '20px',
                height: '20px',
                borderRadius: '10px',
                padding: '0 6px',
              },
            },
          },
          MuiLinearProgress: {
            styleOverrides: {
              root: {
                borderRadius: '6px',
                height: '8px',
                backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              },
              bar: {
                borderRadius: '6px',
              },
            },
          },
          MuiAvatar: {
            styleOverrides: {
              root: {
                fontSize: '1rem',
                fontWeight: 600,
              },
            },
          },
          MuiDivider: {
            styleOverrides: {
              root: {
                borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              },
            },
          },
          MuiPopover: {
            styleOverrides: {
              paper: {
                borderRadius: '14px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'}`,
                backgroundImage: mode === 'dark'
                  ? 'linear-gradient(145deg, rgba(18, 31, 53, 0.95) 0%, rgba(8, 15, 30, 0.95) 100%)'
                  : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.96) 100%)',
              },
            },
          },
          MuiTableContainer: {
            styleOverrides: {
              root: {
                borderRadius: '14px',
                border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'}`,
              },
            },
          },
          MuiTableHead: {
            styleOverrides: {
              root: {
                backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                '& .MuiTableCell-head': {
                  fontWeight: 600,
                  color: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                },
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                padding: '16px',
              },
            },
          },
        },
      }),
    [mode]
  );

  // Value object to be provided by context
  const value = {
    mode,
    toggleColorMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// For backwards compatibility
export const ThemeProvider = AppThemeProvider;

// Custom hook for using the Theme context
export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  
  return context;
};
