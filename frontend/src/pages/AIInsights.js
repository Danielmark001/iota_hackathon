import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Button, 
  Card, 
  CardContent, 
  CardActions, 
  Divider, 
  useTheme, 
  alpha, 
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  Analytics as AnalyticsIcon,
  PsychologyAlt as BrainIcon,
  ShowChart as ChartIcon,
  Lightbulb as LightbulbIcon,
  Shield as ShieldIcon,
  TrendingUp as TrendingUpIcon,
  WbIncandescent as IdeaIcon,
  AutoGraph as GraphIcon,
  ArrowForward as ArrowForwardIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import ConnectionErrorFallback from '../components/ui/ConnectionErrorFallback';

const FeatureCard = ({ title, description, icon, primaryAction, secondaryAction, badgeText, beta }) => {
  const theme = useTheme();
  
  return (
    <Card 
      elevation={0} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: 3,
        border: `1px solid ${theme.palette.divider}`,
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
          '& .MuiCardActions-root': {
            backgroundColor: alpha(theme.palette.primary.main, 0.03)
          }
        }
      }}
    >
      {beta && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: -28,
            transform: 'rotate(45deg)',
            backgroundColor: theme.palette.info.main,
            color: theme.palette.info.contrastText,
            padding: '2px 30px',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            zIndex: 1,
            boxShadow: `0 1px 3px ${alpha('#000', 0.2)}`
          }}
        >
          BETA
        </Box>
      )}
      
      <CardContent sx={{ p: 3, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box 
            sx={{ 
              width: 48, 
              height: 48, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              marginRight: 2
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" component="h2" fontWeight={600}>
            {title}
          </Typography>
        </Box>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          {description}
        </Typography>
        
        {badgeText && (
          <Box 
            sx={{ 
              display: 'inline-block', 
              borderRadius: '4px', 
              backgroundColor: alpha(theme.palette.success.main, 0.1),
              color: theme.palette.success.main,
              px: 1,
              py: 0.5,
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            {badgeText}
          </Box>
        )}
      </CardContent>
      
      <Divider />
      
      <CardActions 
        sx={{ 
          p: 2, 
          backgroundColor: theme.palette.background.paper,
          transition: 'background-color 0.2s ease'
        }}
      >
        <Button 
          variant="contained" 
          size="small" 
          disableElevation
          onClick={primaryAction.onClick}
          sx={{ 
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600
          }}
          endIcon={<ArrowForwardIcon />}
        >
          {primaryAction.label}
        </Button>
        
        {secondaryAction && (
          <Button 
            variant="text" 
            size="small" 
            color="inherit"
            onClick={secondaryAction.onClick}
            sx={{ 
              ml: 1, 
              textTransform: 'none',
              fontWeight: 500,
              color: theme.palette.text.secondary
            }}
          >
            {secondaryAction.label}
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

const AIInsights = () => {
  const { connectionError, connectWallet } = useWeb3();
  const navigate = useNavigate();
  const theme = useTheme();

  if (connectionError) {
    return <ConnectionErrorFallback onRetry={connectWallet} />;
  }

  const aiFeatures = [
    {
      title: "Risk Analysis AI",
      description: "Advanced AI algorithms assess your financial position, predict risks, and provide personalized recommendations to optimize your lending and borrowing strategy.",
      icon: <ShieldIcon fontSize="medium" />,
      primaryAction: {
        label: "View Risk Analysis",
        onClick: () => navigate('/risk')
      },
      secondaryAction: {
        label: "Learn More",
        onClick: () => navigate('/learn/ai-risk-analysis')
      }
    },
    {
      title: "Explainable AI Dashboard",
      description: "Understand exactly how our AI makes recommendations with transparent, interactive visualizations that break down each factor in the decision-making process.",
      icon: <BrainIcon fontSize="medium" />,
      primaryAction: {
        label: "Explore AI Dashboard",
        onClick: () => navigate('/explainable-ai')
      },
      beta: true
    },
    {
      title: "Market Predictions",
      description: "AI-powered market prediction tools analyze historical data and current trends to forecast potential market movements and identify investment opportunities.",
      icon: <ChartIcon fontSize="medium" />,
      primaryAction: {
        label: "View Predictions",
        onClick: () => navigate('/predictions')
      },
      badgeText: "Updated hourly"
    },
    {
      title: "Borrowing Strategy Simulator",
      description: "Test different borrowing strategies with our AI simulator to see potential outcomes and optimize your approach based on your risk tolerance and goals.",
      icon: <GraphIcon fontSize="medium" />,
      primaryAction: {
        label: "Use Simulator",
        onClick: () => navigate('/explainable-ai')
      }
    },
    {
      title: "Personalized Recommendations",
      description: "Receive tailored recommendations for optimizing your portfolio based on your unique financial situation, risk profile, and market conditions.",
      icon: <LightbulbIcon fontSize="medium" />,
      primaryAction: {
        label: "View Recommendations",
        onClick: () => navigate('/recommendations')
      }
    },
    {
      title: "Liquidation Risk Alerts",
      description: "AI constantly monitors your positions to alert you before potential liquidation events, giving you time to take preventive action.",
      icon: <TrendingUpIcon fontSize="medium" />,
      primaryAction: {
        label: "View Alerts",
        onClick: () => navigate('/liquidation-alerts')
      }
    }
  ];

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
          AI Insights & Tools
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Leverage advanced artificial intelligence to optimize your lending and borrowing strategy on the IOTA network. Our suite of AI tools provides personalized insights, risk analysis, and market predictions to help you make informed decisions.
        </Typography>
      </Box>
      
      {/* AI Overview Card */}
      <Card 
        elevation={0} 
        sx={{ 
          borderRadius: 3, 
          border: `1px solid ${theme.palette.divider}`,
          mb: 4,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ 
          height: 4, 
          background: 'linear-gradient(90deg, #4C3F91, #00BFA5)',
          width: '100%' 
        }} />
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Box 
              sx={{ 
                backgroundColor: alpha(theme.palette.info.main, 0.1),
                color: theme.palette.info.main,
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 2,
                mt: 0.5
              }}
            >
              <InfoIcon />
            </Box>
            
            <Box>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                How AI Powers IntelliLend
              </Typography>
              
              <Typography variant="body2" paragraph>
                IntelliLend uses a combination of machine learning models and neural networks trained on historical IOTA network data, market trends, and user behavior patterns. Our AI systems analyze your portfolio, transaction history, and market conditions to provide:
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ display: 'flex' }}>
                    <AnalyticsIcon color="primary" sx={{ mr: 1, mt: 0.2 }} />
                    <Typography variant="body2">
                      <strong>Risk Assessment</strong> - Evaluates liquidation risk and portfolio vulnerability
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ display: 'flex' }}>
                    <IdeaIcon color="primary" sx={{ mr: 1, mt: 0.2 }} />
                    <Typography variant="body2">
                      <strong>Strategic Recommendations</strong> - Suggests optimal lending/borrowing positions
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ display: 'flex' }}>
                    <TrendingUpIcon color="primary" sx={{ mr: 1, mt: 0.2 }} />
                    <Typography variant="body2">
                      <strong>Market Insights</strong> - Predicts potential market movements and opportunities
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
              <Typography variant="body2">
                All AI processing is done with strict privacy controls, and we provide complete transparency in how our models function through the Explainable AI dashboard.
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      {/* AI Features Grid */}
      <Grid container spacing={3}>
        {aiFeatures.map((feature, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <FeatureCard 
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
              primaryAction={feature.primaryAction}
              secondaryAction={feature.secondaryAction}
              badgeText={feature.badgeText}
              beta={feature.beta}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AIInsights;