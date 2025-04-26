# IntelliLend Production Deployment Guide

This guide provides detailed instructions for deploying the IntelliLend platform to production with real IOTA MainNet integration.

## Pre-Deployment Checklist

Before proceeding with deployment, ensure the following prerequisites are met:

- [ ] Production server with at least 4GB RAM and 2 CPU cores
- [ ] Node.js v16+ installed on the server
- [ ] SSL certificates for HTTPS configuration
- [ ] Access to multiple IOTA MainNet nodes for redundancy
- [ ] Stronghold password that meets security requirements
- [ ] Private keys for contract deployment stored securely
- [ ] Adequate IOTA tokens for gas fees and transactions
- [ ] MongoDB or another database for persistence (optional)
- [ ] Redis for distributed caching (optional but recommended)
- [ ] Monitoring system configured (e.g., Prometheus, Grafana)

## Environment Configuration

Create a `.env.production` file with the following configuration:

```bash
# Node Environment
NODE_ENV=production

# Application Configuration
PORT=3001
FRONTEND_PORT=3000
ENABLE_CORS=true

# IOTA Network Configuration
IOTA_NETWORK=mainnet
IOTA_STORAGE_PATH=/path/to/secure/wallet-database
STRONGHOLD_SNAPSHOT_PATH=/path/to/secure/wallet.stronghold
STRONGHOLD_PASSWORD=YourSecureStrongholdPassword123!

# IOTA node endpoints for redundancy
IOTA_NODES=https://api.shimmer.network,https://mainnet.shimmer.iota-1.workers.dev,https://shimmer-mainnet.api.nodesail.io

# IOTA EVM Configuration
IOTA_EVM_RPC_URL=https://json-rpc.evm.shimmer.network
USE_MOCKS=false

# Contract Addresses (update after deployment)
LENDING_POOL_ADDRESS=0x...
ZK_VERIFIER_ADDRESS=0x...
ZK_BRIDGE_ADDRESS=0x...
BRIDGE_ADDRESS=0x...

# Admin wallet (for deployment and admin operations)
PRIVATE_KEY=YourPrivateKey

# Frontend Configuration
REACT_APP_API_URL=https://your-api-domain.com
REACT_APP_LENDING_POOL_ADDRESS=${LENDING_POOL_ADDRESS}
REACT_APP_ZK_VERIFIER_ADDRESS=${ZK_VERIFIER_ADDRESS}
REACT_APP_ZK_BRIDGE_ADDRESS=${ZK_BRIDGE_ADDRESS}
REACT_APP_USE_MOCKS=false
REACT_APP_IOTA_NETWORK=mainnet
REACT_APP_IOTA_EVM_RPC_URL=${IOTA_EVM_RPC_URL}

# Performance Configuration
CACHE_ENABLED=true
CACHE_TTL=300
CONNECTION_POOL_SIZE=5
REDIS_URL=redis://localhost:6379

# Security Configuration
JWT_SECRET=YourSecureJWTSecretKey
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=300

# Cross-layer Configuration
ENABLE_CROSS_LAYER=true
AGGREGATOR_PRIVATE_KEY=${PRIVATE_KEY}

# AI Model Configuration
AI_MODEL_PORT=5000
AI_MODEL_PATH=/path/to/models
USE_LOCAL_MODEL=true
```

## Security Hardening

1. **Secure Stronghold Setup**

   Create a secure Stronghold configuration:

   ```js
   const { createSecureRecovery } = require('./iota-sdk/utils/secure-recovery');
   
   // Initialize secure recovery
   const secureRecovery = createSecureRecovery({
     snapshotPath: process.env.STRONGHOLD_SNAPSHOT_PATH,
     backupDir: '/path/to/secure/backups',
     backupCount: 10,
     encryption: true,
     encryptionKey: process.env.STRONGHOLD_BACKUP_KEY || process.env.STRONGHOLD_PASSWORD
   });
   
   // Create backup before deployment
   await secureRecovery.createBackup({ force: true });
   ```

2. **HTTPS Configuration**

   Set up HTTPS for both frontend and backend:

   ```js
   const https = require('https');
   const fs = require('fs');
   
   const options = {
     key: fs.readFileSync('/path/to/privkey.pem'),
     cert: fs.readFileSync('/path/to/fullchain.pem')
   };
   
   https.createServer(options, app).listen(PORT, () => {
     logger.info(`Secure server running on port ${PORT}`);
   });
   ```

3. **Rate Limiting**

   Ensure proper rate limiting is configured:

   ```js
   const rateLimit = require('express-rate-limit');
   
   const mainLimiter = rateLimit({
     windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
     max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
     standardHeaders: true,
     legacyHeaders: false,
     message: {
       status: 429,
       error: 'Too many requests',
       message: 'Please try again later'
     }
   });
   
   app.use('/api/', mainLimiter);
   ```

## Deployment Steps

### 1. Server Preparation

```bash
# Update server packages
sudo apt update && sudo apt upgrade -y

# Install Node.js if not already installed
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install Redis (if using distributed caching)
sudo apt install redis-server
sudo systemctl enable redis-server

# Create application directory
mkdir -p /opt/intellilend
```

### 2. Application Deployment

```bash
# Clone the repository
git clone https://github.com/yourusername/intellilend.git /opt/intellilend
cd /opt/intellilend

# Install dependencies
npm install --production

# Copy production environment file
cp .env.production .env

# Create secure directories for Stronghold
mkdir -p /opt/intellilend-secure/wallet-database
mkdir -p /opt/intellilend-secure/backups

# Update environment variables to point to secure directories
sed -i 's|/path/to/secure/wallet-database|/opt/intellilend-secure/wallet-database|g' .env
sed -i 's|/path/to/secure/wallet.stronghold|/opt/intellilend-secure/wallet.stronghold|g' .env

# Set secure permissions
chmod 700 /opt/intellilend-secure
chmod 600 .env
```

### 3. Contract Deployment

```bash
# Deploy contracts to IOTA EVM
NODE_ENV=production npm run deploy-contracts

# Update .env with deployed contract addresses
CONTRACT_ADDRESSES=$(node -e "const fs=require('fs');const deployments=JSON.parse(fs.readFileSync('./deployments/mainnet.json'));console.log(JSON.stringify(deployments))")
LENDING_POOL=$(echo $CONTRACT_ADDRESSES | jq -r '.LendingPool')
ZK_VERIFIER=$(echo $CONTRACT_ADDRESSES | jq -r '.ZKVerifier')
ZK_BRIDGE=$(echo $CONTRACT_ADDRESSES | jq -r '.ZKBridge')
BRIDGE=$(echo $CONTRACT_ADDRESSES | jq -r '.Bridge')

sed -i "s/LENDING_POOL_ADDRESS=0x.*/LENDING_POOL_ADDRESS=$LENDING_POOL/g" .env
sed -i "s/ZK_VERIFIER_ADDRESS=0x.*/ZK_VERIFIER_ADDRESS=$ZK_VERIFIER/g" .env
sed -i "s/ZK_BRIDGE_ADDRESS=0x.*/ZK_BRIDGE_ADDRESS=$ZK_BRIDGE/g" .env
sed -i "s/BRIDGE_ADDRESS=0x.*/BRIDGE_ADDRESS=$BRIDGE/g" .env
```

### 4. Backend Deployment

```bash
# Build the backend
npm run build:backend

# Start the backend with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Verify backend is running
pm2 status
curl https://your-api-domain.com/health
```

### 5. Frontend Deployment

Option 1: Host on the same server

```bash
# Build the frontend
npm run build:frontend

# Start the frontend with PM2
pm2 start ecosystem.config.js --only frontend

# Setup Nginx to serve frontend and proxy API requests
sudo apt install nginx
sudo cp deployment/nginx.conf /etc/nginx/sites-available/intellilend
sudo ln -s /etc/nginx/sites-available/intellilend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Option 2: Deploy to a CDN (e.g., Netlify, Vercel)

```bash
# Build the frontend
npm run build:frontend

# Deploy to Netlify (or your preferred service)
npx netlify-cli deploy --prod --dir build
```

### 6. Database Setup (Optional)

If using MongoDB for data persistence:

```bash
# Install MongoDB
sudo apt install mongodb

# Start and enable MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Initialize database and collections
mongosh < deployment/init-mongo.js
```

### 7. Backup Configuration

Set up automated backups for the Stronghold snapshot:

```bash
# Create backup script
cat > /opt/intellilend/backup.js << EOL
const { createSecureRecovery } = require('./iota-sdk/utils/secure-recovery');
require('dotenv').config();

async function backup() {
  const secureRecovery = createSecureRecovery({
    snapshotPath: process.env.STRONGHOLD_SNAPSHOT_PATH,
    backupDir: '/opt/intellilend-secure/backups',
    backupCount: 10,
    encryption: true,
    encryptionKey: process.env.STRONGHOLD_BACKUP_KEY || process.env.STRONGHOLD_PASSWORD
  });
  
  try {
    const backupPath = await secureRecovery.createBackup();
    console.log(\`Backup created at \${backupPath}\`);
  } catch (error) {
    console.error(\`Backup failed: \${error.message}\`);
    process.exit(1);
  }
}

backup();
EOL

# Set up daily backup with crontab
(crontab -l 2>/dev/null; echo "0 2 * * * cd /opt/intellilend && /usr/bin/node backup.js >> /var/log/intellilend-backup.log 2>&1") | crontab -
```

### 8. Monitoring Setup

Set up Prometheus and Grafana for monitoring:

```bash
# Install Prometheus and Grafana
sudo apt install -y prometheus grafana

# Copy configuration files
sudo cp deployment/prometheus.yml /etc/prometheus/
sudo cp deployment/grafana-datasource.yml /etc/grafana/provisioning/datasources/
sudo cp deployment/grafana-dashboard.yml /etc/grafana/provisioning/dashboards/
sudo cp deployment/intellilend-dashboard.json /var/lib/grafana/dashboards/

# Restart services
sudo systemctl restart prometheus
sudo systemctl restart grafana-server
```

### 9. Health Check and Verification

Verify deployment with health checks:

```bash
# Check backend health
curl https://your-api-domain.com/health

# Verify IOTA connection
curl https://your-api-domain.com/api/iota/network

# Verify frontend is accessible
curl https://your-domain.com
```

## Post-Deployment Tasks

### Production Verification Checklist

- [ ] Verify IOTA connection is stable and healthy
- [ ] Test wallet integration with real accounts
- [ ] Confirm cross-layer functionality is working
- [ ] Verify contract interactions work correctly
- [ ] Test AI risk assessment with real data
- [ ] Check all API endpoints for correct responses
- [ ] Verify security configuration (HTTPS, rate limiting)
- [ ] Confirm monitoring and alerting are functioning
- [ ] Test backup and recovery procedures

### Ongoing Maintenance

1. **Regular Backups**
   - Ensure automated backups are running
   - Periodically test recovery procedures

2. **Monitoring**
   - Set up alerts for critical issues
   - Monitor node health and performance
   - Track error rates and API usage

3. **Updates**
   - Regularly update dependencies
   - Apply security patches promptly
   - Update IOTA nodes to latest versions

4. **Performance Tuning**
   - Monitor API response times
   - Adjust cache settings based on usage
   - Optimize database queries if needed

## Scaling Considerations

As usage grows, consider the following scaling strategies:

1. **Horizontal Scaling**
   - Deploy multiple backend instances behind a load balancer
   - Implement Redis for session sharing between instances
   - Configure sticky sessions if needed

2. **Database Scaling**
   - Implement database sharding for high transaction volumes
   - Add database replicas for read operations
   - Consider time-series databases for metrics

3. **IOTA Node Scaling**
   - Increase the number of IOTA nodes for redundancy
   - Consider running your own IOTA nodes for better control
   - Implement more sophisticated node selection algorithms

4. **Caching Strategy**
   - Implement multi-level caching
   - Use Redis Cluster for distributed caching
   - Adjust TTL values based on data volatility

## Disaster Recovery

In case of major issues, follow these recovery steps:

1. **Backend Failure**
   - Check logs for error details
   - Restart the service using PM2: `pm2 restart all`
   - If persistent, roll back to previous version

2. **Stronghold Issues**
   - Stop all services using the wallet
   - Restore from the most recent backup
   - Verify wallet integrity before restarting services

3. **Database Corruption**
   - Stop dependent services
   - Restore from backup
   - Verify data integrity
   - Restart services

4. **Node Connection Failures**
   - Verify node health and connectivity
   - Update node list if needed
   - Restart services to reconnect

## Troubleshooting

### Common Production Issues

1. **Connection Timeouts**
   - Check IOTA node status and availability
   - Verify network connectivity
   - Increase connection timeout settings

2. **High Memory Usage**
   - Check for memory leaks
   - Adjust Node.js memory limits
   - Consider upgrading server resources

3. **Slow Response Times**
   - Analyze performance metrics
   - Optimize database queries
   - Adjust caching strategy

4. **Certificate Errors**
   - Verify SSL certificate validity
   - Check certificate chain
   - Renew expired certificates

### How to Check Logs

```bash
# Check application logs
pm2 logs

# Check specific service logs
pm2 logs backend
pm2 logs frontend

# Check system logs
journalctl -u intellilend

# Check nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

## Support and Resources

- **IOTA Documentation**: [https://docs.iota.org/](https://docs.iota.org/)
- **IOTA SDK Documentation**: [https://wiki.iota.org/iota-sdk/welcome/](https://wiki.iota.org/iota-sdk/welcome/)
- **IOTA Explorer**: [https://explorer.shimmer.network/shimmer](https://explorer.shimmer.network/shimmer)
- **Support Channels**: See project README for contact information
