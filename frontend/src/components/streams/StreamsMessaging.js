import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  CircularProgress,
  Chip,
  Grid,
  Alert,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  useTheme
} from '@mui/material';
import {
  Send,
  Attachment,
  MoreVert,
  Lock,
  LockOpen,
  Person,
  VerifiedUser,
  InsertDriveFile,
  Image,
  PictureAsPdf,
  Description,
  Add,
  Download,
  ContentCopy,
  Refresh
} from '@mui/icons-material';

// Contexts
import { useIoTA } from '../../context/IoTAContext';
import { useWeb3 } from '../../context/Web3Context';
import { useSnackbar } from '../../context/SnackbarContext';

// Services
import apiService from '../../services/apiService';

/**
 * StreamsMessaging Component
 * 
 * Enables secure messaging between users and the platform using IOTA Streams.
 * Supports end-to-end encrypted communication and secure document sharing.
 */
const StreamsMessaging = () => {
  const theme = useTheme();
  const { isConnected: isIotaConnected, address: iotaAddress } = useIoTA();
  const { currentAccount, isConnected: isEvmConnected } = useWeb3();
  const { showSnackbar } = useSnackbar();
  
  // Refs
  const messageEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // State
  const [loading, setLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [joinChannelOpen, setJoinChannelOpen] = useState(false);
  const [channelAddress, setChannelAddress] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(null);
  
  // Initialize and load channels
  useEffect(() => {
    if (isIotaConnected || isEvmConnected) {
      loadChannels();
    }
    
    // Cleanup interval on unmount
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isIotaConnected, isEvmConnected]);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Create auto-refresh for active channel
  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel.id);
      
      // Set up interval to refresh messages
      const interval = setInterval(() => {
        loadMessages(activeChannel.id, true);
      }, 15000); // Every 15 seconds
      
      setRefreshInterval(interval);
      
      return () => clearInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [activeChannel]);
  
  // Load user's channels
  const loadChannels = async () => {
    setLoading(true);
    try {
      const address = currentAccount || iotaAddress;
      
      if (!address) {
        throw new Error('No wallet address available');
      }
      
      const response = await apiService.getUserChannels(address);
      
      if (response && response.channels) {
        setChannels(response.channels);
        
        // Set first channel as active if it exists
        if (response.channels.length > 0 && !activeChannel) {
          setActiveChannel(response.channels[0]);
        }
      }
    } catch (error) {
      console.error('Error loading channels:', error);
      showSnackbar('Failed to load messaging channels', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Load messages for a channel
  const loadMessages = async (channelId, silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    
    try {
      const response = await apiService.getChannelMessages(channelId);
      
      if (response && response.messages) {
        setMessages(response.messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      if (!silent) {
        showSnackbar('Failed to load messages', 'error');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };
  
  // Create a new channel
  const createChannel = async () => {
    setChannelLoading(true);
    try {
      if (!newChannelName) {
        throw new Error('Channel name is required');
      }
      
      const address = currentAccount || iotaAddress;
      
      if (!address) {
        throw new Error('No wallet address available');
      }
      
      const response = await apiService.createChannel({
        name: newChannelName,
        description: 'Created via IntelliLend application',
        owner: address
      });
      
      if (response && response.success) {
        showSnackbar('Channel created successfully', 'success');
        setCreateChannelOpen(false);
        setNewChannelName('');
        
        // Reload channels
        await loadChannels();
      } else {
        throw new Error('Failed to create channel');
      }
    } catch (error) {
      console.error('Error creating channel:', error);
      showSnackbar(error.message || 'Failed to create channel', 'error');
    } finally {
      setChannelLoading(false);
    }
  };
  
  // Join an existing channel
  const joinChannel = async () => {
    setChannelLoading(true);
    try {
      if (!channelAddress) {
        throw new Error('Channel address is required');
      }
      
      const address = currentAccount || iotaAddress;
      
      if (!address) {
        throw new Error('No wallet address available');
      }
      
      const response = await apiService.joinChannel({
        channelAddress,
        subscriber: address
      });
      
      if (response && response.success) {
        showSnackbar('Joined channel successfully', 'success');
        setJoinChannelOpen(false);
        setChannelAddress('');
        
        // Reload channels
        await loadChannels();
      } else {
        throw new Error('Failed to join channel');
      }
    } catch (error) {
      console.error('Error joining channel:', error);
      showSnackbar(error.message || 'Failed to join channel', 'error');
    } finally {
      setChannelLoading(false);
    }
  };
  
  // Send a message
  const sendMessage = async () => {
    if (!newMessage || !activeChannel) {
      return;
    }
    
    setLoading(true);
    try {
      const address = currentAccount || iotaAddress;
      
      if (!address) {
        throw new Error('No wallet address available');
      }
      
      const response = await apiService.sendMessage({
        channelId: activeChannel.id,
        messageType: 'TEXT',
        content: newMessage,
        sender: address
      });
      
      if (response && response.success) {
        setNewMessage('');
        
        // Reload messages
        await loadMessages(activeChannel.id);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showSnackbar(error.message || 'Failed to send message', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Send a file
  const sendFile = async (file) => {
    if (!file || !activeChannel) {
      return;
    }
    
    setLoading(true);
    try {
      const address = currentAccount || iotaAddress;
      
      if (!address) {
        throw new Error('No wallet address available');
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('channelId', activeChannel.id);
      formData.append('sender', address);
      
      const response = await apiService.sendFile(formData);
      
      if (response && response.success) {
        showSnackbar('File sent successfully', 'success');
        
        // Reload messages
        await loadMessages(activeChannel.id);
      } else {
        throw new Error('Failed to send file');
      }
    } catch (error) {
      console.error('Error sending file:', error);
      showSnackbar(error.message || 'Failed to send file', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      sendFile(file);
    }
  };
  
  // Open file input
  const openFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Handle message menu open
  const handleMessageMenuOpen = (event, message) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedMessage(message);
  };
  
  // Handle message menu close
  const handleMessageMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedMessage(null);
  };
  
  // Copy message to clipboard
  const copyMessageToClipboard = () => {
    if (selectedMessage) {
      navigator.clipboard.writeText(selectedMessage.content);
      showSnackbar('Message copied to clipboard', 'success');
      handleMessageMenuClose();
    }
  };
  
  // Download file
  const downloadFile = () => {
    if (selectedMessage && selectedMessage.fileUrl) {
      window.open(selectedMessage.fileUrl, '_blank');
      handleMessageMenuClose();
    }
  };
  
  // Get file icon based on type
  const getFileIcon = (fileName) => {
    if (!fileName) return <Description />;
    
    const extension = fileName.split('.').pop().toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <Image />;
      case 'pdf':
        return <PictureAsPdf />;
      case 'doc':
      case 'docx':
        return <Description />;
      default:
        return <InsertDriveFile />;
    }
  };
  
  // Channel List Component
  const ChannelList = () => (
    <Paper variant="outlined" sx={{ height: '100%', overflow: 'auto' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Channels</Typography>
        <Box>
          <IconButton
            color="primary"
            onClick={() => setCreateChannelOpen(true)}
            disabled={!isIotaConnected && !isEvmConnected}
          >
            <Add />
          </IconButton>
          <IconButton
            color="primary"
            onClick={loadChannels}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : <Refresh />}
          </IconButton>
        </Box>
      </Box>
      <Divider />
      {channels.length > 0 ? (
        <List sx={{ p: 0 }}>
          {channels.map((channel) => (
            <ListItem
              key={channel.id}
              button
              selected={activeChannel && activeChannel.id === channel.id}
              onClick={() => setActiveChannel(channel)}
              sx={{
                borderLeft: activeChannel && activeChannel.id === channel.id
                  ? `4px solid ${theme.palette.primary.main}`
                  : '4px solid transparent'
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: channel.isEncrypted ? 'success.main' : 'primary.main' }}>
                  {channel.isEncrypted ? <Lock /> : <LockOpen />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={channel.name}
                secondary={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ mr: 1 }}>
                      {channel.participants} participants
                    </Typography>
                    {channel.isEncrypted && (
                      <Chip
                        label="Encrypted"
                        size="small"
                        color="success"
                        icon={<Lock sx={{ fontSize: 12 }} />}
                        sx={{ height: 20, '& .MuiChip-label': { px: 1, fontSize: 10 } }}
                      />
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No channels found
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Add />}
            onClick={() => setCreateChannelOpen(true)}
            sx={{ mt: 1 }}
            disabled={!isIotaConnected && !isEvmConnected}
          >
            Create Channel
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setJoinChannelOpen(true)}
            sx={{ mt: 1, ml: 1 }}
            disabled={!isIotaConnected && !isEvmConnected}
          >
            Join Channel
          </Button>
        </Box>
      )}
    </Paper>
  );
  
  // Message List Component
  const MessageList = () => (
    <Paper variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {activeChannel ? (
        <>
          <Box sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography variant="h6">{activeChannel.name}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {activeChannel.isEncrypted ? (
                <Chip 
                  icon={<Lock />} 
                  label="End-to-End Encrypted" 
                  size="small" 
                  color="success" 
                  sx={{ mr: 1 }} 
                />
              ) : (
                <Chip 
                  icon={<LockOpen />} 
                  label="Standard" 
                  size="small" 
                  sx={{ mr: 1 }} 
                />
              )}
              <Typography variant="body2" color="text.secondary">
                {activeChannel.participants} participants
              </Typography>
            </Box>
          </Box>
          <Divider />
          
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
            {messages.length > 0 ? (
              <List>
                {messages.map((message) => {
                  const isCurrentUser = message.sender === (currentAccount || iotaAddress);
                  
                  return (
                    <ListItem
                      key={message.id}
                      sx={{
                        justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-start',
                        mb: 1
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '70%',
                          bgcolor: isCurrentUser ? 'primary.main' : 'background.default',
                          color: isCurrentUser ? 'primary.contrastText' : 'text.primary',
                          borderRadius: 2,
                          p: 2,
                          position: 'relative'
                        }}
                      >
                        {/* Message Header */}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 1
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                            {message.senderName || message.sender.slice(0, 6) + '...'}
                          </Typography>
                          <IconButton
                            size="small"
                            sx={{
                              color: isCurrentUser ? 'primary.contrastText' : 'text.secondary',
                              p: 0
                            }}
                            onClick={(e) => handleMessageMenuOpen(e, message)}
                          >
                            <MoreVert fontSize="small" />
                          </IconButton>
                        </Box>
                        
                        {/* File Attachment */}
                        {message.fileUrl && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              mb: 1,
                              p: 1,
                              borderRadius: 1,
                              bgcolor: isCurrentUser
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(0, 0, 0, 0.05)'
                            }}
                          >
                            {getFileIcon(message.fileName)}
                            <Box sx={{ ml: 1, flexGrow: 1, overflow: 'hidden' }}>
                              <Typography variant="body2" noWrap>
                                {message.fileName || 'Attachment'}
                              </Typography>
                              {message.fileSize && (
                                <Typography variant="caption" color="text.secondary">
                                  {Math.round(message.fileSize / 1024)} KB
                                </Typography>
                              )}
                            </Box>
                            <IconButton
                              size="small"
                              sx={{
                                color: isCurrentUser ? 'primary.contrastText' : 'text.secondary'
                              }}
                              onClick={downloadFile}
                            >
                              <Download fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                        
                        {/* Message Content */}
                        {message.content && (
                          <Typography variant="body1">{message.content}</Typography>
                        )}
                        
                        {/* Message Footer */}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mt: 1
                          }}
                        >
                          <Typography variant="caption" color={isCurrentUser ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary'}>
                            {formatTimestamp(message.timestamp)}
                          </Typography>
                          {message.verified && (
                            <VerifiedUser
                              fontSize="small"
                              sx={{
                                color: isCurrentUser ? 'rgba(255, 255, 255, 0.7)' : 'success.main'
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    </ListItem>
                  );
                })}
                <div ref={messageEndRef} />
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', p: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No messages in this channel yet. Send the first message!
                </Typography>
              </Box>
            )}
          </Box>
          
          <Divider />
          
          <Box sx={{ p: 2, bgcolor: 'background.default' }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={loading || !isIotaConnected && !isEvmConnected}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      color="primary"
                      onClick={openFileInput}
                      disabled={loading || !isIotaConnected && !isEvmConnected}
                    >
                      <Attachment />
                    </IconButton>
                    <IconButton
                      color="primary"
                      onClick={sendMessage}
                      disabled={loading || !newMessage || !isIotaConnected && !isEvmConnected}
                    >
                      {loading ? <CircularProgress size={24} /> : <Send />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </Box>
        </>
      ) : (
        <Box sx={{ p: 3, textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No Channel Selected
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Select a channel from the list or create a new one to start messaging.
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setCreateChannelOpen(true)}
              sx={{ mt: 1 }}
              disabled={!isIotaConnected && !isEvmConnected}
            >
              Create Channel
            </Button>
            <Button
              variant="outlined"
              onClick={() => setJoinChannelOpen(true)}
              sx={{ mt: 1, ml: 1 }}
              disabled={!isIotaConnected && !isEvmConnected}
            >
              Join Channel
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  );
  
  return (
    <Box sx={{ width: '100%' }}>
      {!isIotaConnected && !isEvmConnected ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1">
            Please connect your IOTA or EVM wallet to use secure messaging.
          </Typography>
        </Alert>
      ) : (
        <Grid container spacing={2} sx={{ height: 'calc(100vh - 240px)' }}>
          <Grid item xs={12} md={3}>
            <ChannelList />
          </Grid>
          <Grid item xs={12} md={9}>
            <MessageList />
          </Grid>
        </Grid>
      )}
      
      {/* Message Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMessageMenuClose}
      >
        <MenuItem onClick={copyMessageToClipboard}>
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy Message</ListItemText>
        </MenuItem>
        {selectedMessage && selectedMessage.fileUrl && (
          <MenuItem onClick={downloadFile}>
            <ListItemIcon>
              <Download fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download File</ListItemText>
          </MenuItem>
        )}
      </Menu>
      
      {/* Create Channel Dialog */}
      <Dialog
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Channel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Create a new secure messaging channel using IOTA Streams. This channel will be end-to-end encrypted.
          </Typography>
          <TextField
            fullWidth
            label="Channel Name"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            margin="normal"
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateChannelOpen(false)}>Cancel</Button>
          <Button
            onClick={createChannel}
            color="primary"
            variant="contained"
            disabled={channelLoading || !newChannelName}
            startIcon={channelLoading ? <CircularProgress size={20} /> : <Add />}
          >
            Create Channel
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Join Channel Dialog */}
      <Dialog
        open={joinChannelOpen}
        onClose={() => setJoinChannelOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Join Channel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Join an existing IOTA Streams channel by entering the channel address.
          </Typography>
          <TextField
            fullWidth
            label="Channel Address"
            value={channelAddress}
            onChange={(e) => setChannelAddress(e.target.value)}
            margin="normal"
            variant="outlined"
            placeholder="Enter the channel address..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinChannelOpen(false)}>Cancel</Button>
          <Button
            onClick={joinChannel}
            color="primary"
            variant="contained"
            disabled={channelLoading || !channelAddress}
            startIcon={channelLoading ? <CircularProgress size={20} /> : null}
          >
            Join Channel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StreamsMessaging;
