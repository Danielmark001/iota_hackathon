import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { 
  TrendingUp, 
  Psychology, 
  Security, 
  CompareArrows, 
  Speed,
  Fingerprint,
  Layers,
  Code,
  Check
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { login, isInitializing } = useAuth();
  
  // Hero section with CTA
  const Hero = () => (
    <Box
      sx={{
        bgcolor: 'background.paper',
        pt: isMobile ? 8 : 12,
        pb: isMobile ? 10 : 16,
        position: 'relative',
        backgroundImage: 'linear-gradient(120deg, rgba(25, 118, 210, 0.1), rgba(156, 39, 176, 0.1))',
        overflow: 'hidden',
        textAlign: 'center',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <img 
            src="/assets/iota-logo-full.svg"
            alt="IOTA Logo" 
            style={{ 
              width: isMobile ? 240 : 320,
              height: 'auto',
              marginBottom: 16,
              filter: theme.palette.mode === 'dark' ? 'brightness(1.5)' : 'none'
            }} 
          />
        </Box>
        <Typography
          component="h1"
          variant={isMobile ? 'h3' : 'h2'}
          align="center"
          color="text.primary"
          fontWeight="bold"
          gutterBottom
        >
          <span style={{ color: theme.palette.primary.main }}>Intelli</span>Lend
        </Typography>
        <Typography variant={isMobile ? 'h5' : 'h4'} align="center" color="text.primary" paragraph>
          AI-Powered DeFi Lending Platform on IOTA
        </Typography>
        <Typography variant="h6" align="center" color="text.secondary" paragraph sx={{ maxWidth: 800, mx: 'auto' }}>
          Experience the future of decentralized lending with intelligent risk assessment, 
          personalized rates, and optimized capital efficiency.
        </Typography>
        <Box sx={{ mt: 4 }}>
          <Grid container spacing={2} justifyContent="center">
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={login}
                disabled={isInitializing}
                sx={{ px: 4, py: 1.5, borderRadius: 2 }}
              >
                Connect Wallet
              </Button>
            </Grid>
            <Grid item>
              <Button 
                variant="outlined"
                color="primary"
                size="large"
                href="https://docs.iota.org/"
                target="_blank"
                sx={{ px: 4, py: 1.5, borderRadius: 2 }}
              >
                Learn More
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Container>
      
      {/* Decorative elements */}
      <Box
        sx={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          borderRadius: '50%',
          backgroundColor: theme.palette.primary.main,
          opacity: 0.05,
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -150,
          left: -150,
          width: 500,
          height: 500,
          borderRadius: '50%',
          backgroundColor: theme.palette.secondary.main,
          opacity: 0.05,
          zIndex: 0,
        }}
      />
    </Box>
  );
  
  // Features section
  const Features = () => (
    <Box sx={{ py: 8, bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : 'grey.50' }}>
      <Container maxWidth="lg">
        <Typography variant="h4" align="center" gutterBottom>
          Key Features
        </Typography>
        <Typography variant="h6" align="center" color="text.secondary" paragraph sx={{ mb: 6 }}>
          IntelliLend combines AI and blockchain technology to revolutionize DeFi lending
        </Typography>
        
        <Grid container spacing={4}>
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 2 }}>
              <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    mb: 2,
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                  }}
                >
                  <Psychology fontSize="large" />
                </Box>
                <Typography gutterBottom variant="h5" component="h2" align="center">
                  AI Risk Assessment
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  Machine learning models analyze on-chain activity for personalized risk scoring and dynamic interest rates.
                </Typography>
              </Box>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 2 }}>
              <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    mb: 2,
                    bgcolor: 'secondary.light',
                    color: 'secondary.contrastText',
                  }}
                >
                  <Fingerprint fontSize="large" />
                </Box>
                <Typography gutterBottom variant="h5" component="h2" align="center">
                  Privacy-Preserving Identity
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  Zero-knowledge proofs enable secure identity verification without compromising user privacy.
                </Typography>
              </Box>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 2 }}>
              <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    mb: 2,
                    bgcolor: 'success.light',
                    color: 'success.contrastText',
                  }}
                >
                  <Layers fontSize="large" />
                </Box>
                <Typography gutterBottom variant="h5" component="h2" align="center">
                  Dual-Layer Architecture
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  Leverages IOTA's unique Layer 1 (Move) and Layer 2 (EVM) capabilities for enhanced security and efficiency.
                </Typography>
              </Box>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 2 }}>
              <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    mb: 2,
                    bgcolor: 'warning.light',
                    color: 'warning.contrastText',
                  }}
                >
                  <CompareArrows fontSize="large" />
                </Box>
                <Typography gutterBottom variant="h5" component="h2" align="center">
                  Cross-Chain Liquidity
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  Aggregate liquidity from multiple chains through IOTA's cross-chain integration for optimal capital efficiency.
                </Typography>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
  
  // How it works section
  const HowItWorks = () => (
    <Box sx={{ py: 8 }}>
      <Container maxWidth="lg">
        <Typography variant="h4" align="center" gutterBottom>
          How IntelliLend Works
        </Typography>
        <Typography variant="h6" align="center" color="text.secondary" paragraph sx={{ mb: 6 }}>
          A seamless and intelligent lending experience powered by AI and IOTA
        </Typography>
        
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box 
              component="img"
              src="/assets/iota-logo-icon.svg"
              alt="IOTA Integration"
              sx={{ 
                width: '100%', 
                maxHeight: 300,
                objectFit: 'contain',
                filter: theme.palette.mode === 'dark' ? 'brightness(1.5)' : 'none',
                display: { xs: 'none', md: 'block' }
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <List>
              <ListItem alignItems="flex-start">
                <ListItemIcon>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      bgcolor: 'primary.main',
                      color: 'white',
                    }}
                  >
                    1
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary="Connect Your Wallet"
                  secondary="Simply connect your IOTA wallet to get started with IntelliLend."
                />
              </ListItem>
              
              <ListItem alignItems="flex-start">
                <ListItemIcon>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      bgcolor: 'primary.main',
                      color: 'white',
                    }}
                  >
                    2
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary="AI Risk Assessment"
                  secondary="Our AI analyzes your on-chain activity to determine your personalized risk score."
                />
              </ListItem>
              
              <ListItem alignItems="flex-start">
                <ListItemIcon>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      bgcolor: 'primary.main',
                      color: 'white',
                    }}
                  >
                    3
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary="Verify Identity (Optional)"
                  secondary="Use zero-knowledge proofs to verify your identity without revealing personal information to improve your rates."
                />
              </ListItem>
              
              <ListItem alignItems="flex-start">
                <ListItemIcon>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      bgcolor: 'primary.main',
                      color: 'white',
                    }}
                  >
                    4
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary="Deposit or Borrow"
                  secondary="Supply assets to earn interest or borrow against your collateral at personalized rates based on your risk profile."
                />
              </ListItem>
              
              <ListItem alignItems="flex-start">
                <ListItemIcon>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      bgcolor: 'primary.main',
                      color: 'white',
                    }}
                  >
                    5
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary="Optimize Your Portfolio"
                  secondary="Receive AI-powered recommendations to maximize yields and minimize risks."
                />
              </ListItem>
            </List>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
  
  // Advantages section
  const Advantages = () => (
    <Box sx={{ py: 8, bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : 'grey.50' }}>
      <Container maxWidth="lg">
        <Typography variant="h4" align="center" gutterBottom>
          Why Choose IntelliLend
        </Typography>
        <Typography variant="h6" align="center" color="text.secondary" paragraph sx={{ mb: 6 }}>
          Our unique advantages compared to traditional DeFi lending platforms
        </Typography>
        
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Security color="primary" fontSize="large" sx={{ mr: 1 }} />
                <Typography variant="h6">Enhanced Security</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Move-based asset representation on Layer 1 provides object-centric security, while EVM Layer 2 handles lending operations.
              </Typography>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Speed color="primary" fontSize="large" sx={{ mr: 1 }} />
                <Typography variant="h6">Capital Efficiency</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                AI optimizes capital allocation across pools and risk profiles, resulting in better rates for both lenders and borrowers.
              </Typography>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <img 
                  src="/assets/iota-logo-icon.svg"
                  alt="IOTA Logo" 
                  style={{ 
                    width: 28, 
                    height: 28, 
                    marginRight: 8,
                    filter: theme.palette.mode === 'dark' ? 'brightness(1.5)' : 'none'
                  }} 
                />
                <Typography variant="h6">IOTA Integration</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Built specifically for IOTA's ecosystem, taking advantage of its unique features including high throughput and low fees.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
  
  // CTA section
  const CallToAction = () => (
    <Box
      sx={{
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        py: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={7}>
            <Typography variant="h3" component="h2" gutterBottom>
              Ready to get started?
            </Typography>
            <Typography variant="h6" paragraph sx={{ opacity: 0.9 }}>
              Join IntelliLend today and experience the future of DeFi lending powered by AI and IOTA.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="secondary"
                size="large"
                onClick={login}
                disabled={isInitializing}
                sx={{ px: 4, py: 1.5, borderRadius: 2, boxShadow: 3 }}
              >
                Connect Wallet
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'block' } }}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%' 
              }}
            >
              <img 
                src={require('../assets/iota-logo-icon.svg').default}
                alt="IOTA Logo" 
                style={{ 
                  width: 120, 
                  height: 120,
                  filter: 'brightness(5)'
                }} 
              />
            </Box>
          </Grid>
        </Grid>
      </Container>
      
      {/* Background decorations */}
      <Box
        sx={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -150,
          left: -150,
          width: 500,
          height: 500,
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          zIndex: 0,
        }}
      />
    </Box>
  );
  
  return (
    <Box>
      <Hero />
      <Features />
      <HowItWorks />
      <Advantages />
      <CallToAction />
    </Box>
  );
};

export default LandingPage;