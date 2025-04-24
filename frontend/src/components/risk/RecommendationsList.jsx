import React from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Divider,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  useTheme,
  Button,
  alpha
} from '@mui/material';
import {
  PriorityHigh,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Warning,
  ArrowUpward,
  EmojiEvents,
  Info,
  Security
} from '@mui/icons-material';

/**
 * RecommendationsList displays AI-generated recommendations for improving
 * a user's risk score and optimizing their lending strategy.
 * 
 * @param {Object} props - Component props
 * @param {Array} props.recommendations - List of recommendations
 * @param {Array} props.riskFactors - List of risk factors
 * @param {string} props.address - User address
 */
const RecommendationsList = ({ recommendations = [], riskFactors = [], address }) => {
  const theme = useTheme();
  
  // Generate recommendations if none provided
  const generateDefaultRecommendations = () => {
    const defaultRecommendations = [
      {
        action: 'Improve repayment consistency',
        description: 'Maintaining consistent, on-time repayments improves your risk score over time.',
        impact: 'high',
        type: 'medium_priority'
      },
      {
        action: 'Diversify your collateral',
        description: 'Using different types of assets as collateral reduces overall risk exposure.',
        impact: 'medium',
        type: 'low_priority'
      },
      {
        action: 'Reduce loan-to-value ratio',
        description: 'Maintaining a lower LTV ratio improves your position\'s safety against market volatility.',
        impact: 'high',
        type: 'high_priority'
      }
    ];
    
    // Add recommendations based on risk factors
    if (riskFactors.length > 0) {
      // Find the worst risk factor
      const worstFactor = [...riskFactors].sort((a, b) => a.score - b.score)[0];
      
      if (worstFactor) {
        let recommendation = {
          action: '',
          description: '',
          impact: 'high',
          type: 'high_priority'
        };
        
        // Create recommendation based on factor type
        switch (worstFactor.factor.toLowerCase().replace(/\s+/g, '_')) {
          case 'repayment_ratio':
          case 'repayment_history':
            recommendation.action = 'Focus on improving repayment history';
            recommendation.description = 'Your repayment history is a significant factor in your risk assessment. Consider setting up automatic payments to ensure timely repayments.';
            break;
          case 'wallet_activity':
          case 'transaction_frequency':
            recommendation.action = 'Maintain consistent wallet activity';
            recommendation.description = 'Regular, predictable transaction patterns improve your risk profile by demonstrating stability.';
            break;
          case 'balance_volatility':
            recommendation.action = 'Reduce balance volatility';
            recommendation.description = 'High balance fluctuations may indicate higher risk. Maintain more stable balances in your wallet.';
            break;
          case 'cross_chain_activity':
            recommendation.action = 'Consolidate cross-chain activity';
            recommendation.description = 'While cross-chain activity is normal, high volumes across many chains can increase perceived risk.';
            break;
          case 'collateral_diversity':
            recommendation.action = 'Diversify your collateral assets';
            recommendation.description = 'Using multiple asset types as collateral reduces risk exposure to individual asset volatility.';
            break;
          default:
            recommendation.action = `Improve ${worstFactor.factor}`;
            recommendation.description = `This factor significantly impacts your risk score. Focus on improving it to reduce your overall risk.`;
        }
        
        defaultRecommendations.unshift(recommendation);
      }
    }
    
    return defaultRecommendations;
  };
  
  // Use provided recommendations or generate defaults
  const allRecommendations = recommendations.length > 0 
    ? recommendations 
    : generateDefaultRecommendations();
  
  // Get icon for recommendation type
  const getRecommendationIcon = (type, impact) => {
    switch (type) {
      case 'high_priority':
        return <PriorityHigh sx={{ color: theme.palette.error.main }} />;
      case 'medium_priority':
        return <Warning sx={{ color: theme.palette.warning.main }} />;
      case 'low_priority':
        return <Info sx={{ color: theme.palette.info.main }} />;
      case 'opportunity':
        return <EmojiEvents sx={{ color: theme.palette.success.main }} />;
      default:
        // Fall back to impact if type not specified
        if (impact === 'high') {
          return <PriorityHigh sx={{ color: theme.palette.error.main }} />;
        } else if (impact === 'medium') {
          return <Warning sx={{ color: theme.palette.warning.main }} />;
        } else if (impact === 'positive') {
          return <CheckCircle sx={{ color: theme.palette.success.main }} />;
        } else {
          return <Info sx={{ color: theme.palette.info.main }} />;
        }
    }
  };
  
  // Get background color for recommendation
  const getRecommendationBackground = (type, impact) => {
    switch (type) {
      case 'high_priority':
        return alpha(theme.palette.error.main, 0.08);
      case 'medium_priority':
        return alpha(theme.palette.warning.main, 0.08);
      case 'low_priority':
        return alpha(theme.palette.info.main, 0.08);
      case 'opportunity':
        return alpha(theme.palette.success.main, 0.08);
      default:
        // Fall back to impact if type not specified
        if (impact === 'high') {
          return alpha(theme.palette.error.main, 0.08);
        } else if (impact === 'medium') {
          return alpha(theme.palette.warning.main, 0.08);
        } else if (impact === 'positive') {
          return alpha(theme.palette.success.main, 0.08);
        } else {
          return alpha(theme.palette.info.main, 0.08);
        }
    }
  };
  
  // Get chip for impact level
  const getImpactChip = (impact) => {
    let color = 'default';
    let label = 'Low Impact';
    
    switch (impact) {
      case 'high':
        color = 'error';
        label = 'High Impact';
        break;
      case 'medium':
        color = 'warning';
        label = 'Medium Impact';
        break;
      case 'low':
        color = 'info';
        label = 'Low Impact';
        break;
      case 'positive':
        color = 'success';
        label = 'Positive Impact';
        break;
      default:
        color = 'default';
        label = 'Impact: Unknown';
    }
    
    return (
      <Chip 
        label={label} 
        color={color} 
        size="small" 
        sx={{ ml: 1 }}
      />
    );
  };
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader 
        title={
          <Box display="flex" alignItems="center">
            <Security sx={{ mr: 1, color: theme.palette.primary.main }} />
            <Typography variant="h6" component="div">
              AI Recommendations
            </Typography>
          </Box>
        }
        subheader="Suggestions to improve your risk profile"
      />
      
      <Divider />
      
      <CardContent>
        <List disablePadding>
          {allRecommendations.map((recommendation, index) => (
            <React.Fragment key={index}>
              {index > 0 && <Divider sx={{ my: 1.5 }} />}
              <ListItem 
                alignItems="flex-start"
                disablePadding
                sx={{ 
                  px: 2, 
                  py: 1.5,
                  borderRadius: 1,
                  my: 1,
                  backgroundColor: getRecommendationBackground(
                    recommendation.type, 
                    recommendation.impact
                  )
                }}
              >
                <ListItemIcon>
                  {getRecommendationIcon(recommendation.type, recommendation.impact)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle1" component="div" fontWeight="medium">
                        {recommendation.action}
                      </Typography>
                      {getImpactChip(recommendation.impact)}
                    </Box>
                  }
                  secondary={
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      component="div"
                      sx={{ mt: 0.5 }}
                    >
                      {recommendation.description}
                    </Typography>
                  }
                />
              </ListItem>
            </React.Fragment>
          ))}
        </List>
        
        {allRecommendations.length === 0 && (
          <Box textAlign="center" py={3}>
            <Typography variant="body1" color="textSecondary">
              No recommendations available at this time.
            </Typography>
          </Box>
        )}
        
        <Box mt={3} textAlign="center">
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ArrowUpward />}
            onClick={() => window.location.href = `/improve-risk/${address}`}
          >
            Improve Your Score
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

RecommendationsList.propTypes = {
  recommendations: PropTypes.arrayOf(
    PropTypes.shape({
      action: PropTypes.string.isRequired,
      description: PropTypes.string,
      impact: PropTypes.string,
      type: PropTypes.string
    })
  ),
  riskFactors: PropTypes.arrayOf(
    PropTypes.shape({
      factor: PropTypes.string,
      score: PropTypes.number,
      impact: PropTypes.string
    })
  ),
  address: PropTypes.string.isRequired
};

export default RecommendationsList;
