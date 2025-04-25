import React, { createContext, useContext, useState, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';

// Create context
const ThemeContext = createContext(null);

// Provider component
export const ThemeProvider = ({ children }) => {
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
            main: '#1976d2',
            light: '#42a5f5',
            dark: '#1565c0',
          },
          secondary: {
            main: '#9c27b0',
            light: '#ba68c8',
            dark: '#7b1fa2',
          },
          background: {
            default: mode === 'light' ? '#f5f5f5' : '#121212',
            paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
          },
          riskLow: {
            main: '#4caf50',
            contrastText: '#ffffff',
          },
          riskMedium: {
            main: '#ff9800',
            contrastText: '#ffffff',
          },
          riskHigh: {
            main: '#f44336',
            contrastText: '#ffffff',
          },
        },
        typography: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          h1: {
            fontSize: '2.5rem',
            fontWeight: 500,
          },
          h2: {
            fontSize: '2rem',
            fontWeight: 500,
          },
          h3: {
            fontSize: '1.75rem',
            fontWeight: 500,
          },
          h4: {
            fontSize: '1.5rem',
            fontWeight: 400,
          },
          h5: {
            fontSize: '1.25rem',
            fontWeight: 400,
          },
          h6: {
            fontSize: '1rem',
            fontWeight: 500,
          },
        },
        components: {
          MuiAppBar: {
            styleOverrides: {
              root: {
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: '12px',
                boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 500,
              },
              contained: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
                },
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                borderRadius: '8px',
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

// Custom hook for using the Theme context
export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  
  return context;
};
