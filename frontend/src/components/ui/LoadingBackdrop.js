import React from 'react';
import { Backdrop, CircularProgress, Typography, Box, useTheme, alpha } from '@mui/material';

const LoadingBackdrop = ({ open, message }) => {
  const theme = useTheme();
  
  return (
    <Backdrop
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        backgroundColor: alpha('#000', 0.7),
      }}
      open={open}
    >
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 4,
          borderRadius: 4,
          backgroundColor: alpha(theme.palette.background.paper, 0.15),
          backdropFilter: 'blur(12px)',
          border: `1px solid ${alpha('#fff', 0.2)}`,
          maxWidth: '400px',
          textAlign: 'center',
        }}
      >
        <Box sx={{ position: 'relative', mb: 3 }}>
          {/* IOTA Logo */}
          <Box 
            component="img" 
            src="/assets/iota-logo-icon.svg"
            alt="IOTA Logo" 
            sx={{ 
              width: 60, 
              height: 60,
              filter: 'brightness(1.5)',
              opacity: 0.9,
              animation: 'pulse 2s infinite ease-in-out',
              '@keyframes pulse': {
                '0%': { transform: 'scale(0.95)', opacity: 0.7 },
                '50%': { transform: 'scale(1.05)', opacity: 1 },
                '100%': { transform: 'scale(0.95)', opacity: 0.7 },
              },
            }} 
          />
          
          {/* Circular Progress */}
          <CircularProgress 
            sx={{ 
              position: 'absolute', 
              top: -8, 
              left: -8, 
              right: -8, 
              bottom: -8, 
              width: '76px !important', 
              height: '76px !important',
              color: theme.palette.primary.main,
            }} 
          />
        </Box>
        
        {/* Loading text */}
        <Typography 
          variant="h6"
          sx={{ 
            fontWeight: 'bold',
            color: '#fff',
            mb: 1,
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {message || 'Loading...'}
        </Typography>
        
        <Typography 
          variant="body2"
          sx={{ 
            color: alpha('#fff', 0.7),
            maxWidth: '280px',
          }}
        >
          Please wait while we process your request on the IOTA network
        </Typography>
      </Box>
    </Backdrop>
  );
};

// Default export with React.memo for performance
export default React.memo(LoadingBackdrop);