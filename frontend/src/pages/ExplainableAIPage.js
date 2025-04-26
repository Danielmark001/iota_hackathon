import React from 'react';
import { Container, Box, Typography, Breadcrumbs, Link, useTheme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Home, Analytics } from '@mui/icons-material';

// Import the Explainable AI Dashboard
import ExplainableAIDashboard from '../components/dashboard/ai/ExplainableAIDashboard';

const ExplainableAIPage = () => {
  const theme = useTheme();
  
  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        {/* Breadcrumbs navigation */}
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link
            component={RouterLink}
            to="/"
            color="inherit"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <Home sx={{ mr: 0.5 }} fontSize="small" />
            Home
          </Link>
          <Link
            component={RouterLink}
            to="/dashboard"
            color="inherit"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            Dashboard
          </Link>
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
            <Analytics sx={{ mr: 0.5 }} fontSize="small" />
            Explainable AI
          </Typography>
        </Breadcrumbs>
        
        {/* Page header with introduction */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Explainable AI Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gain deeper insights into your risk profile with our advanced AI analysis. This dashboard provides interactive visualizations, scenario analysis tools, and actionable recommendations to optimize your lending and borrowing strategy.
          </Typography>
        </Box>
        
        {/* Explainable AI Dashboard */}
        <ExplainableAIDashboard />
      </Box>
    </Container>
  );
};

export default ExplainableAIPage;
