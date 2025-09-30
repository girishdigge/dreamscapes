// services/express/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();
const app = express();
const { logger, requestLogger } = require('./utils/logger');

const parseRoutes = require('./routes/parse');
const patchRoutes = require('./routes/patch');
const exportRoutes = require('./routes/export');
const healthRoutes = require('./routes/health');
const { errorHandler } = require('./middleware/errorHandler');
const { enhancedErrorHandler } = require('./middleware/errorHandler');

const PORT = process.env.PORT || 8000;
app.use(requestLogger());

// Security and optimization middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api', parseRoutes);
app.use('/api', patchRoutes);
app.use('/api', exportRoutes);
app.use('/', healthRoutes);

// API documentation route
app.get('/api', (req, res) => {
  res.json({
    name: 'Dreamscapes Express API',
    version: '1.0.0',
    description: 'Main orchestrator API for dream generation and processing',
    endpoints: {
      'POST /api/parse-dream': 'Generate dream from text description',
      'POST /api/patch-dream': 'Apply modifications to existing dream',
      'POST /api/export': 'Export dream as video',
      'GET /api/dreams': 'List cached dreams',
      'GET /api/scene/:id': 'Get specific dream scene',
      'GET /api/samples': 'Get sample dreams',
      'GET /health': 'Health check',
    },
    documentation: '/docs',
    status: 'operational',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api',
      'POST /api/parse-dream',
      'POST /api/patch-dream',
      'POST /api/export',
      'GET /api/dreams',
      'GET /api/samples',
    ],
  });
});

app.use(errorHandler);
app.use(enhancedErrorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info(`🎭 Express Orchestrator running on port ${PORT}`);
  logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(
    `🔗 MCP Gateway: ${
      process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8080'
    }`
  );
  logger.info(`🎬 Ready to process dreams!`);
});
