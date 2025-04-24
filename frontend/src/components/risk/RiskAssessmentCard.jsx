import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  Card, 
  CardHeader, 
  CardContent, 
  Typography, 
  Divider, 
  Box, 
  Chip,
  LinearProgress,
  Stack,
  IconButton,
  Collapse,
  Button,
  useTheme,
  Tooltip,
  CardActions
} from '@mui/material';
import { 
  ExpandMore,
  ExpandLess,
  Refresh,
  Info,
  TrendingUp,
  TrendingDown,
  Remove
} from '@mui/icons-material';

import RiskScoreGauge from './RiskScoreGauge';
import { useRiskAssessment } from '../../hooks/useRiskAssessment';
import LoadingOverlay from '../common/LoadingOverlay';
import ErrorAlert from '../common/ErrorAlert';

/**
 * RiskAssessmentCard displays a user's risk assessment data including 
 * risk score, risk factors, and detailed analysis.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.riskAssessment - Risk assessment data
 * @param {string} props.address - User address
 * @param {boolean} props.simplified - Whether to show simplified version
 */
const RiskAssessmentCard = ({ 
  riskAssessment, 
  address, 
  simplified = false 
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(!simplified);
  const { refetch, loading, error } = useRiskAssessment(address);
  
  // Handle expand/collapse
  const handleExpandClick = () => {
    setExpanded(!expanded);
  };
  
  // Handle refresh
  const handleRefresh = () => {
    refetch();
  };
  
  // Render impact chip
  const renderImpactChip = (impact) => {
    let color = 'default';
    let icon = <Remove />;
    
    switch (impact) {
      case 'positive':
        color = 'success';
        icon = <TrendingUp fontSize="small" />;
        break;
      case 'negative':
        color = 'error';
        icon = <TrendingDown fontSize="small" />;
        break;
      case 'neutral':
        color = 'default';
        icon = <Remove fontSize="small" />;
        break;
      default:
        color = 'default';
        icon = <Remove fontSize="small" />;
    }
    
    return (
      <Chip 
        label={impact.charAt(0).toUpperCase() + impact.slice(1)} 
        color={color}
        size="small"
        icon={icon}
      />
    );
  };
  
  // Get color for factor score
  const getFactorScoreColor = (score) => {
    if (score < 30) return theme.palette.error.main;
    if (score < 60) return theme.palette.warning.main;
    return theme.palette.success.main;
  };
  
  if (error) {
    return (
      <Card>
        <CardHeader title="Risk Assessment" />
        <CardContent>
          <ErrorAlert 
            title="Error Loading Risk Assessment" 
            message={error} 
            onRetry={refetch}
          />
        </CardContent>
      </Card>
    );
  }
  
  if (!riskAssessment) {
    return (
      <Card>
        <CardHeader title="Risk Assessment" />
        <CardContent>
          <Typography variant="body2" color="textSecondary">
            No risk assessment data available.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card sx={{ height: '100%', position: 'relative' }}>
      {loading && <LoadingOverlay message="Updating risk assessment..." />}
      
      <CardHeader 
        title={
          <Box display="flex" alignItems="center">
            <Typography variant="h6" component="div">
              Risk Assessment
            </Typography>
            <Tooltip title="Refresh risk assessment">
              <IconButton size="small" onClick={handleRefresh} sx={{ ml: 1 }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
        subheader={
          <Typography variant="caption" color="textSecondary">
            Last updated: {new Date(riskAssessment.timestamp || Date.now()).toLocaleString()}
          </Typography>
        }
        action={
          !simplified && (
            <IconButton 
              onClick={handleExpandClick}
              aria-expanded={expanded}
              aria-label="show more"
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )
        }
      />
      
      <Divider />
      
      <CardContent>
        <Box display="flex" flexDirection="column" alignItems="center" mb={2}>
          <RiskScoreGauge 
            score={riskAssessment.riskScore} 
            size={simplified ? 140 : 180}
            showLabel
          />
        </Box>
        
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Typography 
            variant="subtitle1" 
            component="div" 
            gutterBottom 
            sx={{ mt: 2, fontWeight: 'medium' }}
          >
            Risk Factors
          </Typography>
          
          <Stack spacing={2} sx={{ mb: 3 }}>
            {riskAssessment.riskFactors?.slice(0, 5).map((factor, index) => (
              <Box key={index}>
                <Box 
                  display="flex" 
                  justifyContent="space-between" 
                  alignItems="center"
                  mb={0.5}
                >
                  <Box display="flex" alignItems="center">
                    <Typography variant="body2">
                      {factor.factor}
                    </Typography>
                    <Tooltip title={factor.description || 'This factor affects your risk score'}>
                      <Info 
                        fontSize="small" 
                        sx={{ 
                          ml: 0.5, 
                          color: theme.palette.text.secondary,
                          fontSize: 16,
                          cursor: 'help' 
                        }} 
                      />
                    </Tooltip>
                  </Box>
                  <Box display="flex" alignItems="center">
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 'medium',
                        color: getFactorScoreColor(factor.score)
                      }}
                    >
                      {factor.score}/100
                    </Typography>
                    <Box ml={1}>
                      {factor.impact && renderImpactChip(factor.impact)}
                    </Box>
                  </Box>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={factor.score} 
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    bgcolor: theme.palette.grey[200],
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getFactorScoreColor(factor.score)
                    }
                  }}
                />
              </Box>
            ))}
          </Stack>
          
          <Typography 
            variant="subtitle1" 
            component="div" 
            gutterBottom 
            sx={{ fontWeight: 'medium' }}
          >
            Risk Assessment Summary
          </Typography>
          
          <Typography variant="body2" paragraph>
            Based on AI analysis of on-chain data, transaction patterns, and lending behavior, 
            your risk profile is classified as <strong>{riskAssessment.riskClass}</strong>. 
            Your risk score is <strong>{riskAssessment.riskScore}/100</strong>, where lower 
            scores represent lower risk.
          </Typography>
          
          <Typography variant="body2" paragraph>
            This risk assessment impacts your borrowing power, interest rates, and 
            collateral requirements. Improving your risk score can lead to better
            lending terms and higher borrowing limits.
          </Typography>
          
          {!simplified && (
            <Button 
              variant="outlined" 
              color="primary" 
              fullWidth
              sx={{ mt: 1 }}
              onClick={() => window.location.href = `/risk-details/${address}`}
            >
              View Detailed Risk Analysis
            </Button>
          )}
        </Collapse>
      </CardContent>
      
      {simplified && (
        <CardActions>
          <Button 
            size="small" 
            onClick={handleExpandClick}
            startIcon={expanded ? <ExpandLess /> : <ExpandMore />}
          >
            {expanded ? 'Show Less' : 'Show More'}
          </Button>
          <Button 
            size="small" 
            color="primary"
            onClick={() => window.location.href = `/risk-details/${address}`}
          >
            Detailed Analysis
          </Button>
        </CardActions>
      )}
    </Card>
  );
};

RiskAssessmentCard.propTypes = {
  riskAssessment: PropTypes.shape({
    riskScore: PropTypes.number,
    riskClass: PropTypes.string,
    riskFactors: PropTypes.arrayOf(
      PropTypes.shape({
        factor: PropTypes.string,
        score: PropTypes.number,
        impact: PropTypes.string,
        description: PropTypes.string
      })
    ),
    recommendations: PropTypes.array,
    timestamp: PropTypes.string
  }),
  address: PropTypes.string.isRequired,
  simplified: PropTypes.bool
};

export default RiskAssessmentCard;
