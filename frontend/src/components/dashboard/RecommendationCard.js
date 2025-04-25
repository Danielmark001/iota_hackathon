import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Skeleton,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  Security,
  AccountBalance,
  Check,
  EmojiEvents,
  ArrowForward,
  Assignment,
  Lightbulb,
} from '@mui/icons-material';

// Icons for different recommendation types
const getRecommendationIcon = (type) => {
  switch (type) {
    case 'collateral':
      return <Security color="primary" />;
    case 'yield':
      return <TrendingUp color="success" />;
    case 'verification':
      return <Check color="info" />;
    case 'strategy':
      return <EmojiEvents color="secondary" />;
    default:
      return <Lightbulb color="warning" />;
  }
};

// Impact color based on importance
const getImpactColor = (impact) => {
  switch (impact) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'success';
    default:
      return 'info';
  }
};

const RecommendationCard = ({ recommendations = [], loading = false }) => {
  const theme = useTheme();
  
  // Sort recommendations by impact (high first)
  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    return impactOrder[a.impact] - impactOrder[b.impact];
  });
  
  // Skeleton for loading state
  const renderSkeletons = () => (
    <List sx={{ width: '100%' }}>
      {[1, 2, 3].map((i) => (
        <Box key={i}>
          <ListItem alignItems="flex-start">
            <ListItemIcon>
              <Skeleton variant="circular" width={24} height={24} />
            </ListItemIcon>
            <ListItemText
              primary={<Skeleton variant="text" width="60%" />}
              secondary={<Skeleton variant="text" width="90%" />}
            />
            <Skeleton variant="rounded" width={70} height={24} />
          </ListItem>
          {i < 3 && <Divider variant="inset" component="li" />}
        </Box>
      ))}
    </List>
  );
  
  // Content when there are no recommendations
  const renderEmpty = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        gap: 2,
      }}
    >
      <Assignment sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.6 }} />
      <Typography variant="h6" color="text.secondary">
        No Recommendations
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: '80%' }}>
        You're doing great! We'll provide personalized recommendations when there are opportunities to improve your position.
      </Typography>
    </Box>
  );
  
  // List of recommendations
  const renderRecommendations = () => (
    <List sx={{ width: '100%' }}>
      {sortedRecommendations.map((rec, index) => (
        <Box key={index}>
          <ListItem alignItems="flex-start">
            <ListItemIcon>
              {getRecommendationIcon(rec.type)}
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="subtitle1" fontWeight="medium">
                  {rec.title}
                </Typography>
              }
              secondary={
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {rec.description}
                </Typography>
              }
            />
            <Chip
              label={rec.impact || 'Info'}
              color={getImpactColor(rec.impact)}
              size="small"
              sx={{ alignSelf: 'flex-start', mt: 0.5 }}
            />
          </ListItem>
          {index < sortedRecommendations.length - 1 && <Divider variant="inset" component="li" />}
        </Box>
      ))}
    </List>
  );
  
  return (
    <Paper
      elevation={2}
      sx={{
        height: '100%',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          p: 2,
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(25, 118, 210, 0.05)',
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Lightbulb color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6">AI Recommendations</Typography>
        </Box>
        <Button 
          endIcon={<ArrowForward />}
          size="small"
        >
          View All
        </Button>
      </Box>
      
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {loading ? (
          renderSkeletons()
        ) : recommendations.length > 0 ? (
          renderRecommendations()
        ) : (
          renderEmpty()
        )}
      </Box>
    </Paper>
  );
};

export default RecommendationCard;
