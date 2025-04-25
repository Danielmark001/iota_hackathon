import React from 'react';
import { Box, Container, Typography, Button, Paper } from '@mui/material';
import { Home, ArrowBack } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();
  
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper
        elevation={3}
        sx={{
          p: 5,
          borderRadius: 3,
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Typography variant="h1" component="h1" sx={{ fontSize: { xs: '5rem', md: '8rem' }, fontWeight: 700, opacity: 0.8 }}>
          404
        </Typography>
        
        <Typography variant="h4" component="h2" gutterBottom>
          Page Not Found
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4, maxWidth: '80%', mx: 'auto' }}>
          The page you're looking for doesn't exist or has been moved.
          Please check the URL or navigate back to the dashboard.
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Home />}
            component={RouterLink}
            to="/dashboard"
            size="large"
          >
            Go to Dashboard
          </Button>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => navigate(-1)}
            size="large"
          >
            Go Back
          </Button>
        </Box>
        
        {/* Decorative elements */}
        <Box
          sx={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 150,
            height: 150,
            borderRadius: '50%',
            backgroundColor: 'primary.main',
            opacity: 0.1,
            zIndex: 0,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -40,
            left: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            backgroundColor: 'secondary.main',
            opacity: 0.1,
            zIndex: 0,
          }}
        />
      </Paper>
    </Container>
  );
};

export default NotFound;
