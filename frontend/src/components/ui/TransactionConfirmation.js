import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Divider,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  Close,
  Check,
  Info,
  Warning,
  AccountBalanceWallet,
  Error,
} from '@mui/icons-material';

const TransactionStatus = {
  PENDING: 'pending',
  SIGNING: 'signing',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
};

const TransactionConfirmation = ({
  open,
  onClose,
  title = 'Confirm Transaction',
  message = 'Please review transaction details before confirming.',
  details = {},
  status = TransactionStatus.PENDING,
  errorMessage = '',
  transactionHash = '',
  networkName = 'IOTA EVM',
  onConfirm,
  onViewExplorer,
}) => {
  const theme = useTheme();
  
  // Generate transaction details list
  const renderDetails = () => {
    return Object.entries(details).map(([key, value], index) => (
      <ListItem key={index} sx={{ px: 0, py: 1 }}>
        <ListItemText
          primary={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          secondary={value}
          primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
          secondaryTypographyProps={{ variant: 'body1', fontWeight: 'medium' }}
        />
      </ListItem>
    ));
  };
  
  // Render different content based on status
  const renderContent = () => {
    switch (status) {
      case TransactionStatus.SIGNING:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CircularProgress size={50} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Waiting for Confirmation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please confirm this transaction in your wallet...
            </Typography>
          </Box>
        );
        
      case TransactionStatus.PROCESSING:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CircularProgress size={50} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Processing Transaction
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your transaction is being processed by the network...
            </Typography>
            {transactionHash && (
              <Chip
                label={`Tx: ${transactionHash.slice(0, 10)}...${transactionHash.slice(-8)}`}
                color="primary"
                variant="outlined"
                size="small"
                sx={{ mt: 2 }}
                onClick={onViewExplorer}
                clickable
              />
            )}
          </Box>
        );
        
      case TransactionStatus.SUCCESS:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                mb: 2,
              }}
            >
              <Check sx={{ color: 'white', fontSize: 30 }} />
            </Box>
            <Typography variant="h6" gutterBottom>
              Transaction Successful
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Your transaction has been confirmed on the {networkName} network.
            </Typography>
            {transactionHash && (
              <Chip
                label={`Tx: ${transactionHash.slice(0, 10)}...${transactionHash.slice(-8)}`}
                color="success"
                variant="outlined"
                size="small"
                sx={{ mt: 1 }}
                onClick={onViewExplorer}
                clickable
              />
            )}
          </Box>
        );
        
      case TransactionStatus.ERROR:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'error.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                mb: 2,
              }}
            >
              <Error sx={{ color: 'white', fontSize: 30 }} />
            </Box>
            <Typography variant="h6" gutterBottom>
              Transaction Failed
            </Typography>
            <Typography variant="body2" color="error.main" paragraph>
              {errorMessage || 'There was an error processing your transaction.'}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Please try again or contact support if the issue persists.
            </Typography>
          </Box>
        );
        
      case TransactionStatus.PENDING:
      default:
        return (
          <>
            <Typography variant="body2" color="text.secondary" paragraph>
              {message}
            </Typography>
            
            <Box sx={{ my: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Transaction Details
              </Typography>
              <List disablePadding>
                {renderDetails()}
              </List>
            </Box>
            
            <Box
              sx={{
                p: 2,
                bgcolor: 'info.light',
                color: 'info.contrastText',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'flex-start',
              }}
            >
              <Info sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2">
                  Always verify transaction details before confirming. Once submitted, transactions cannot be reversed.
                </Typography>
              </Box>
            </Box>
          </>
        );
    }
  };
  
  // Render appropriate action buttons based on status
  const renderActions = () => {
    switch (status) {
      case TransactionStatus.SIGNING:
      case TransactionStatus.PROCESSING:
        return (
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
        );
        
      case TransactionStatus.SUCCESS:
        return (
          <>
            {onViewExplorer && (
              <Button onClick={onViewExplorer} color="primary">
                View in Explorer
              </Button>
            )}
            <Button onClick={onClose} variant="contained" color="primary">
              Done
            </Button>
          </>
        );
        
      case TransactionStatus.ERROR:
        return (
          <>
            <Button onClick={onClose} color="inherit">
              Cancel
            </Button>
            <Button onClick={onConfirm} variant="contained" color="primary">
              Try Again
            </Button>
          </>
        );
        
      case TransactionStatus.PENDING:
      default:
        return (
          <>
            <Button onClick={onClose} color="inherit">
              Cancel
            </Button>
            <Button 
              onClick={onConfirm} 
              variant="contained" 
              color="primary"
              startIcon={<AccountBalanceWallet />}
            >
              Confirm
            </Button>
          </>
        );
    }
  };
  
  return (
    <Dialog
      open={open}
      onClose={status !== TransactionStatus.PROCESSING && status !== TransactionStatus.SIGNING ? onClose : null}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: status === TransactionStatus.SUCCESS 
            ? 'success.light' 
            : status === TransactionStatus.ERROR 
            ? 'error.light' 
            : 'background.default',
        }}
      >
        <Typography variant="h6" component="div">
          {status === TransactionStatus.SUCCESS ? 'Transaction Successful' :
           status === TransactionStatus.ERROR ? 'Transaction Failed' :
           title}
        </Typography>
        {(status === TransactionStatus.PENDING || status === TransactionStatus.SUCCESS || status === TransactionStatus.ERROR) && (
          <IconButton edge="end" color="inherit" onClick={onClose}>
            <Close />
          </IconButton>
        )}
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        {renderContent()}
      </DialogContent>
      
      {/* Only show actions for appropriate statuses */}
      {(status === TransactionStatus.PENDING || 
        status === TransactionStatus.SUCCESS || 
        status === TransactionStatus.ERROR ||
        status === TransactionStatus.SIGNING ||
        status === TransactionStatus.PROCESSING) && (
        <>
          <Divider />
          <DialogActions sx={{ px: 3, py: 2 }}>
            {renderActions()}
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default TransactionConfirmation;
export { TransactionStatus };
