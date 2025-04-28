import React, { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Chip,
  Divider,
  Card,
  CardContent,
  CardActions,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  useTheme,
  alpha,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Check as CheckIcon,
  Info as InfoIcon,
  VerifiedUser as VerifiedUserIcon,
  AccountBalance as AccountBalanceIcon,
  Compare as CompareIcon,
  Timeline as TimelineIcon,
  ArrowForward as ArrowForwardIcon,
  AddCircle as AddCircleIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
  Circle as CircleIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Helper component for expandable card
const ExpandableCard = ({ title, description, details, impact, type, actions, expanded: initialExpanded = false }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(initialExpanded);
  
  // Determine impact color
  const getImpactColor = (impact) => {
    switch (impact.toLowerCase()) {
      case 'high':
        return theme.palette.success.main;
      case 'medium':
        return theme.palette.warning.main;
      case 'low':
        return theme.palette.info.main;
      default:
        return theme.palette.primary.main;
    }
  };
  
  // Determine icon based on recommendation type
  const getTypeIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'verification':
        return <VerifiedUserIcon />;
      case 'collateral':
        return <AccountBalanceIcon />;
      case 'activity':
        return <TimelineIcon />;
      case 'comparison':
        return <CompareIcon />;
      default:
        return <InfoIcon />;
    }
  };
  
  return (
    <Card
      elevation={0}
      sx={{
        mb: 2,
        border: `1px solid ${theme.palette.divider}`,
        borderLeft: `4px solid ${getImpactColor(impact)}`,
        borderRadius: 2,
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.08)}`,
        }
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <Box
            sx={{
              backgroundColor: alpha(getImpactColor(impact), 0.1),
              color: getImpactColor(impact),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 1,
              borderRadius: 1,
              mr: 2
            }}
          >
            {getTypeIcon(type)}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h3" gutterBottom>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {description}
            </Typography>
          </Box>
          <Chip
            label={`${impact} Impact`}
            size="small"
            sx={{
              backgroundColor: alpha(getImpactColor(impact), 0.1),
              color: getImpactColor(impact),
              fontWeight: 'medium',
              ml: 1
            }}
          />
        </Box>
      </CardContent>
      
      <CardActions 
        sx={{ 
          justifyContent: 'space-between',
          px: 2,
        }}
      >
        <Button
          size="small"
          onClick={() => setExpanded(!expanded)}
          startIcon={
            <ExpandMoreIcon
              sx={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }}
            />
          }
        >
          {expanded ? 'Less Details' : 'More Details'}
        </Button>
        
        {actions && (
          <Button
            size="small"
            variant="contained"
            disableElevation
            endIcon={<ArrowForwardIcon />}
            onClick={actions.onClick}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '0.8125rem',
              py: 0.5,
              px: 1.5
            }}
          >
            {actions.label}
          </Button>
        )}
      </CardActions>
      
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardContent sx={{ pt: 0, pb: 2 }}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2" paragraph>
            {details}
          </Typography>
          
          <Box
            sx={{
              bgcolor: alpha(theme.palette.info.main, 0.05),
              borderRadius: 1,
              p: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
            }}
          >
            <InfoIcon
              fontSize="small"
              sx={{
                color: theme.palette.info.main,
                mr: 1,
                mt: 0.3
              }}
            />
            <Typography variant="body2" color="text.secondary">
              Implementing this recommendation could improve your risk score and potentially lower borrowing costs.
            </Typography>
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  );
};

// Progress indicator component
const ProgressSteps = ({ currentScore, targetScore }) => {
  const theme = useTheme();
  
  // Determine risk level and color
  const getRiskLevel = (score) => {
    if (score <= 30) return { label: 'Low Risk', color: theme.palette.success.main };
    if (score <= 60) return { label: 'Medium Risk', color: theme.palette.warning.main };
    return { label: 'High Risk', color: theme.palette.error.main };
  };
  
  const currentRisk = getRiskLevel(currentScore);
  const targetRisk = getRiskLevel(targetScore);
  
  const steps = [
    { value: 100, label: 'High Risk' },
    { value: 60, label: 'Medium Risk' },
    { value: 30, label: 'Low Risk' },
    { value: 0, label: 'Minimal Risk' }
  ];
  
  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Current: <span style={{ color: currentRisk.color, fontWeight: 500 }}>{currentScore} ({currentRisk.label})</span>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Target: <span style={{ color: targetRisk.color, fontWeight: 500 }}>{targetScore} ({targetRisk.label})</span>
        </Typography>
      </Box>
      
      <Box sx={{ position: 'relative', pt: 3, pb: 1 }}>
        {/* Progress bar */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            borderRadius: 4,
            bgcolor: alpha(theme.palette.grey[200], 0.3),
          }}
        />
        
        {/* Risk zones */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: '0%',
            width: '40%',
            height: 8,
            borderRadius: '4px 0 0 4px',
            bgcolor: alpha(theme.palette.error.main, 0.2),
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: '40%',
            width: '30%',
            height: 8,
            bgcolor: alpha(theme.palette.warning.main, 0.2),
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: '70%',
            width: '30%',
            height: 8,
            borderRadius: '0 4px 4px 0',
            bgcolor: alpha(theme.palette.success.main, 0.2),
          }}
        />
        
        {/* Current and target markers */}
        <Tooltip title="Current Risk Score">
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: `${100 - currentScore}%`,
              zIndex: 2,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: currentRisk.color,
                border: `2px solid ${theme.palette.background.paper}`,
                boxShadow: theme.shadows[2],
              }}
            />
          </Box>
        </Tooltip>
        
        <Tooltip title="Target Risk Score">
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: `${100 - targetScore}%`,
              zIndex: 1,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: theme.palette.background.paper,
                border: `2px solid ${targetRisk.color}`,
                boxShadow: `0 0 0 2px ${alpha(targetRisk.color, 0.3)}`,
              }}
            />
          </Box>
        </Tooltip>
        
        {/* Step markers */}
        {steps.map((step) => (
          <Box
            key={step.value}
            sx={{
              position: 'absolute',
              top: 17,
              left: `${100 - step.value}%`,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                width: 2,
                height: 8,
                bgcolor: theme.palette.divider,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                whiteSpace: 'nowrap',
                mt: 0.5,
                opacity: 0.7,
                fontSize: '0.65rem',
              }}
            >
              {step.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const ActionableInsightsPanel = ({ recommendations, riskFactors, riskScore }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  // Simulate a target risk score by reducing current score by 15 points
  const targetRiskScore = Math.max(10, riskScore - 15);
  
  // Group recommendations by impact level
  const groupedRecommendations = recommendations.reduce((acc, rec) => {
    const impact = rec.impact.toLowerCase();
    if (!acc[impact]) {
      acc[impact] = [];
    }
    acc[impact].push(rec);
    return acc;
  }, {});
  
  // Order priority as high, medium, low
  const orderedImpacts = ['high', 'medium', 'low'];
  
  // Generate actions for recommendations
  const getActionForType = (type) => {
    switch (type.toLowerCase()) {
      case 'verification':
        return {
          label: 'Verify Identity',
          onClick: () => navigate('/identity')
        };
      case 'collateral':
        return {
          label: 'Adjust Collateral',
          onClick: () => navigate('/borrow')
        };
      case 'activity':
        return {
          label: 'View Opportunities',
          onClick: () => navigate('/cross-layer')
        };
      default:
        return {
          label: 'Learn More',
          onClick: () => {}
        };
    }
  };
  
  return (
    <Box>
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 4, 
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.5)} 100%)`,
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={7}>
            <Typography variant="h6" gutterBottom>
              Improving Your Risk Profile
            </Typography>
            <Typography variant="body2" paragraph>
              By implementing the recommendations below, you can potentially improve your risk score from {riskScore} to around {targetRiskScore}, which would reduce your borrowing costs and increase your borrowing capacity.
            </Typography>
            
            <ProgressSteps currentScore={riskScore} targetScore={targetRiskScore} />
          </Grid>
          
          <Grid item xs={12} md={5}>
            <Box 
              sx={{ 
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                p: 2,
                height: '100%',
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Potential Benefits
              </Typography>
              <List dense sx={{ pt: 0 }}>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <ArrowDownwardIcon fontSize="small" sx={{ color: theme.palette.success.main }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Lower Interest Rates" 
                    secondary="Reduce borrowing costs by up to 1.5%" 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <ArrowUpwardIcon fontSize="small" sx={{ color: theme.palette.success.main }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Higher Borrowing Capacity" 
                    secondary="Increase borrowing limit by ~20%" 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckCircleIcon fontSize="small" sx={{ color: theme.palette.success.main }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Lower Liquidation Risk" 
                    secondary="More resilient during market volatility" 
                  />
                </ListItem>
              </List>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      <Typography variant="h6" gutterBottom>
        Recommended Actions
      </Typography>
      
      {orderedImpacts.map(impact => 
        groupedRecommendations[impact] && (
          <Box key={impact} sx={{ mb: 4 }}>
            <Typography 
              variant="subtitle1" 
              color="text.secondary" 
              gutterBottom
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                opacity: 0.8,
                '&::after': {
                  content: '""',
                  display: 'block',
                  height: 1,
                  bgcolor: theme.palette.divider,
                  flex: 1,
                  ml: 2
                }
              }}
            >
              {impact.charAt(0).toUpperCase() + impact.slice(1)} Priority
            </Typography>
            
            {groupedRecommendations[impact].map((recommendation, index) => (
              <ExpandableCard
                key={index}
                title={recommendation.title}
                description={recommendation.description}
                details={recommendation.details}
                impact={recommendation.impact}
                type={recommendation.type}
                actions={getActionForType(recommendation.type)}
                expanded={index === 0 && impact === 'high'}
              />
            ))}
          </Box>
        )
      )}
      
      <Box sx={{ mt: 4 }}>
        <Alert severity="info" icon={<InfoIcon />}>
          <Typography variant="subtitle2">
            AI-Powered Recommendations
          </Typography>
          <Typography variant="body2">
            These recommendations are generated based on your unique risk profile, transaction history, and market conditions. They are updated daily to provide you with the most relevant insights.
          </Typography>
        </Alert>
      </Box>
    </Box>
  );
};

export default ActionableInsightsPanel;
