import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Divider,
  Alert
} from '@mui/material';

// Components
import StreamsMessaging from '../components/streams/StreamsMessaging';

// Contexts
import { useIoTA } from '../context/IoTAContext';

/**
 * MessagingPage Component
 * 
 * This page displays the IOTA Streams Messaging interface for secure
 * communication between users and the platform.
 */
const MessagingPage = () => {
  const { isConnected } = useIoTA();
  
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Secure Messaging
        </Typography>
        <Typography variant="body1" color="text.secondary">
          End-to-end encrypted messaging using IOTA Streams. All communication is secure, private, and stored on the IOTA Tangle.
        </Typography>
      </Box>
      
      {/* Main content */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        {!isConnected ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body1">
              Connect your IOTA wallet to use secure messaging. All messages are encrypted end-to-end using IOTA Streams.
            </Typography>
          </Alert>
        ) : null}
        
        <StreamsMessaging />
      </Paper>
    </Container>
  );
};

export default MessagingPage;
