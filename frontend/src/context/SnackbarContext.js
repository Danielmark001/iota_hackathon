import React, { createContext, useContext, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';

// Create context
const SnackbarContext = createContext(null);

// Provider component
export const SnackbarProvider = ({ children }) => {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info', // 'success', 'error', 'warning', 'info'
    autoHideDuration: 6000,
  });

  // Show snackbar function
  const showSnackbar = (message, severity = 'info', autoHideDuration = 6000) => {
    setSnackbar({
      open: true,
      message,
      severity,
      autoHideDuration,
    });
  };

  // Hide snackbar function
  const hideSnackbar = () => {
    setSnackbar((prev) => ({
      ...prev,
      open: false,
    }));
  };

  // Snackbar component
  const SnackbarComponent = () => (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={snackbar.autoHideDuration}
      onClose={hideSnackbar}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={hideSnackbar}
        severity={snackbar.severity}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
  );

  // Value object to be provided by context
  const value = {
    showSnackbar,
    hideSnackbar,
  };

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <SnackbarComponent />
    </SnackbarContext.Provider>
  );
};

// Custom hook for using the Snackbar context
export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  
  return context;
};
