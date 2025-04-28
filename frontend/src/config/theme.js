// Theme configuration for IntelliLend
import { createTheme } from '@mui/material/styles';

// Create a base theme to get the proper structure
const baseTheme = createTheme();

export const getTheme = (mode) => createTheme({
  palette: {
    mode,
    common: {
      black: '#000000',
      white: '#FFFFFF',
    },
    primary: {
      main: '#4C3F91',
      light: '#6F6CB4',
      dark: '#372B6B',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#00BFA5',
      light: '#33CDB6',
      dark: '#008573',
      contrastText: '#FFFFFF',
    },
    background: {
      default: mode === 'dark' ? '#121F35' : '#F9FAFB',
      paper: mode === 'dark' ? '#1A2635' : '#FFFFFF',
      subtle: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    },
    text: {
      primary: mode === 'dark' ? '#E5E7EB' : '#1F2937',
      secondary: mode === 'dark' ? '#9CA3AF' : '#6B7280',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#B91C1C',
    },
    warning: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
    },
    info: {
      main: '#3B82F6',
      light: '#60A5FA',
      dark: '#2563EB',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
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
      A100: '#F3F4F6',
      A200: '#E5E7EB',
      A400: '#9CA3AF',
      A700: '#374151',
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 700,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 500,
    },
    subtitle2: {
      fontWeight: 500,
    },
    body1: {
      fontWeight: 400,
    },
    body2: {
      fontWeight: 400,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    // Ensure pxToRem is available
    pxToRem: baseTheme.typography.pxToRem,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(90deg, #4C3F91 0%, #6F6CB4 100%)',
          '&:hover': {
            background: 'linear-gradient(90deg, #372B6B 0%, #4C3F91 100%)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(90deg, #00BFA5 0%, #33CDB6 100%)',
          '&:hover': {
            background: 'linear-gradient(90deg, #008573 0%, #00BFA5 100%)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});