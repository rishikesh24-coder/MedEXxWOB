const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const environment = require('./config/environment');
const { createCorsOptions } = require('./config/cors');
const { checkConnection } = require('./config/supabase');
const abdmConfig = require('./config/abdm');
const logger = require('./utils/logger');

const app = express();

// Trust Proxy Configuration (Safely enabled only when TRUST_PROXY is explicitly specified)
if (environment.security && environment.security.trustProxy) {
  const tp = environment.security.trustProxy;
  const parsedTp = tp === 'true' ? true : tp === 'false' ? false : !isNaN(Number(tp)) ? Number(tp) : tp;
  app.set('trust proxy', parsedTp);
  logger.info(`Trust proxy configured: ${parsedTp}`);
}

// 1. Security & Core Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors(createCorsOptions()));

app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger for development
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`);
  });
  next();
});

// 2. Health Check Endpoint
app.get('/api/health', async (req, res) => {
  const supabaseStatus = await checkConnection();

  return res.status(200).json({
    status: 'healthy',
    product: 'MedEx',
    service: 'MedEx Healthcare Logistics & Inter-Hospital Exchange Backend',
    uptime: Math.round(process.uptime() * 100) / 100,
    timestamp: new Date().toISOString(),
    supabase: {
      configured: supabaseStatus.configured,
      initialized: supabaseStatus.initialized,
      connected: supabaseStatus.connected,
      message: supabaseStatus.message,
    },
    abdm: {
      configured: abdmConfig.isConfigured,
      status: abdmConfig.isConfigured ? 'configured' : 'placeholder_ready',
    },
    payment: {
      provider: environment.payment.provider,
      configured: environment.payment.isConfigured,
      mode: environment.payment.provider === 'razorpay' ? 'production_gateway' : 'mock_development_adapter'
    }
  });
});

// 3. Mount MedEx REST API routes
const apiRoutes = require('./routes');
app.use('/api', apiRoutes);

// 4. Serve compiled production frontend if dist directory is present
const distPath = path.resolve(__dirname, '../dist');
const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'));

if (hasDist) {
  app.use(express.static(distPath));
}

// Root welcome route (serves frontend index.html if dist exists, or API metadata if backend-only)
app.get('/', (req, res) => {
  if (hasDist) {
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  res.status(200).json({
    product: 'MedEx',
    message: 'MedEx Inter-Hospital Healthcare Logistics REST API is active.',
    healthEndpoint: '/api/health',
    version: '1.0.0',
  });
});

if (hasDist) {
  // SPA Fallback: Any unmatched non-API GET request serves the frontend application
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// 4. 404 Not Found Handler (applies to unmatched /api routes or missing assets)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
    timestamp: new Date().toISOString(),
  });
});

// 5. Centralized Error Handler
app.use((err, req, res, next) => {
  logger.error(`Error on ${req.method} ${req.originalUrl}:`, err.message);

  const statusCode = err.statusCode || (typeof err.status === 'number' ? err.status : 500);
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred on the MedEx server.';

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(err.missingFields && { missingFields: err.missingFields }),
      ...(err.hospital && { hospital: err.hospital }),
      ...(err.rejectionReason && { rejectionReason: err.rejectionReason }),
    },
    timestamp: new Date().toISOString(),
  });
});

// 6. Server Startup & Graceful Lifecycle
let serverInstance = null;

if (require.main === module) {
  serverInstance = app.listen(environment.port, () => {
    logger.info('=======================================================');
    logger.info(`  MedEx Backend running on http://localhost:${environment.port}`);
    logger.info(`  Health Check: http://localhost:${environment.port}/api/health`);
    logger.info(`  Environment: ${environment.nodeEnv}`);
    logger.info(`  CORS Mode: ${environment.isProduction ? 'PRODUCTION_ALLOWLIST' : 'DEVELOPMENT_DEFAULTS'}`);
    logger.info(`  Allowed Origins: ${environment.cors.origins.length > 0 ? environment.cors.origins.join(', ') : '(None configured - all cross-origin browser requests blocked)'}`);
    logger.info(`  Supabase: ${environment.supabase.isConfigured ? 'CONFIGURED' : 'PENDING'}`);
    logger.info(`  ABDM Placeholder: READY`);
    logger.info('=======================================================');
  });

  let isShuttingDown = false;
  const handleShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    // Safety timeout: force process exit after 10s if connections fail to drain
    const forceTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out (10s). Forcing termination.');
      process.exit(1);
    }, 10000);
    forceTimeout.unref();

    // Close idle connections immediately to speed up drain (Node 18.2+)
    if (serverInstance && typeof serverInstance.closeIdleConnections === 'function') {
      serverInstance.closeIdleConnections();
    }

    if (serverInstance) {
      serverInstance.close((err) => {
        clearTimeout(forceTimeout);
        if (err) {
          logger.error('Error occurred while closing HTTP server:', err.message);
          process.exit(1);
        }
        logger.info('MedEx HTTP server closed cleanly. All connections terminated.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

module.exports = app;
