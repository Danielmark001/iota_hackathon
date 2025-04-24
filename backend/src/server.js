/**
 * IntelliLend API Server
 * 
 * Main entry point for the IntelliLend backend server
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger.json');
const config = require('./config');
const logger = require('./utils/logger');
const { errorMiddleware } = require('./middleware/errorMiddleware');

// Import routes
const apiRoutes = require('./routes');

// Initialize the app
const app = express();
const PORT = config.server.port || 3001;

// Apply security middleware
app.use(helmet());

// Enable CORS
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  exposedHeaders: config.cors.exposedHeaders,
  credentials: config.cors.credentials,
  maxAge: config.cors.maxAge
}));

// Apply rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.'
});
app.use('/api/', apiLimiter);

// Logging middleware
if (config.env !== 'test') {
  app.use(morgan('combined', { stream: logger.stream }));
}

// Parse JSON request body
app.use(express.json());

// Parse URL-encoded request body
app.use(express.urlencoded({ extended: true }));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.version
  });
});

// Mount all API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use(errorMiddleware);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Resource not found'
  });
});

// Start the server
if (config.env !== 'test') {
  app.listen(PORT, () => {
    logger.info(`IntelliLend API server running on port ${PORT}`);
    logger.info(`Environment: ${config.env}`);
    logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
  });
}

// Export the app for testing
module.exports = app;
