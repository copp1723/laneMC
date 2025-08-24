// Load environment variables first
import { config } from 'dotenv';
config();

// Validate environment variables before starting server
import { EnvironmentValidator } from './services/env-validation';
EnvironmentValidator.validateEnvironment();

import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import Logger, { PerformanceMonitor, generateRequestId } from "./services/logger";
import { HealthService } from "./services/health";
import { checkDatabaseHealth, connectWithRetry, closeDatabase } from "./storage";
import { ErrorHandler } from "./services/error-handler";
import { sanitizeInput } from "./middleware/validation";
import { CircuitBreakerManager } from "./services/circuit-breaker";

const app = express();

// Trust proxy for Render deployment (fixes rate limiting)
app.set('trust proxy', 1);

// CRITICAL: Middleware order - DO NOT CHANGE without coordinating with parallel work
// 1. Health endpoints (BEFORE rate limiting)

// Simple health check for load balancers
app.get("/api/health", async (req, res) => {
  try {
    const health = await HealthService.getSimpleHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    Logger.error('Health check endpoint failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString() });
  }
});

// Comprehensive health check for monitoring systems
app.get("/api/health/detailed", async (req, res) => {
  try {
    const health = await HealthService.getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    Logger.error('Detailed health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check system failure'
    });
  }
});

// Database-specific health check
app.get("/api/health/db", async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status: dbHealth.status,
      timestamp: new Date().toISOString(),
      latency: dbHealth.latency,
      error: dbHealth.error
    });
  } catch (error) {
    Logger.error('Database health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database health check system failure'
    });
  }
});

// Circuit breaker status endpoint
app.get("/api/monitoring/circuit-breakers", (req, res) => {
  try {
    const stats = CircuitBreakerManager.getAllStats();
    const health = CircuitBreakerManager.getHealthStatus();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      overall: health,
      details: stats
    });
  } catch (error) {
    Logger.error('Circuit breaker monitoring failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      error: 'Circuit breaker monitoring system failure'
    });
  }
});

// 2. Security headers (helmet)
// Allow disabling CSP quickly for emergency debugging: set DISABLE_CSP=1
const disableCsp = process.env.DISABLE_CSP === '1';
if (disableCsp) {
  console.warn('[SECURITY] Content Security Policy DISABLED via DISABLE_CSP=1 (do NOT leave this enabled in production)');
}
app.use(helmet({
  contentSecurityPolicy: disableCsp ? false : {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      // Allow inline styles (Tailwind JIT + Radix) and Google Fonts
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      // Allow dynamic import / React lazy (unsafe-eval) and inline (Vite preload polyfill safety)
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcElem: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      // Images (self, data URIs, https CDNs)
      imgSrc: ["'self'", "data:", "https:"],
      // Broaden connectSrc so front-end can call same-origin API & future external APIs during triage.
      // TODO: tighten by listing explicit domains once stabilized.
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  // Keep other helmet defaults
  referrerPolicy: { policy: 'no-referrer' }
}));

// 2.5. Response compression (gzip/deflate)
app.use(compression({
  filter: (req, res) => {
    // Don't compress if the request includes no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    // Skip compression for health checks (they're small anyway)
    if (req.path.startsWith('/api/health')) {
      return false;
    }
    // Use default compression filter for everything else
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses > 1KB
  level: 6 // Compression level (1-9, 6 is good balance of speed vs compression)
}));

// 3. CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'https://lanemc.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// 4. Rate limiting
// General API rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/api/health';
  }
});

// Strict auth rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { message: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', generalLimiter);

// 5. Request timeouts
app.use((req, res, next) => {
  // Set 30 second timeout for all requests
  req.setTimeout(30000, () => {
    res.status(408).json({ message: 'Request timeout' });
  });
  
  res.setTimeout(30000, () => {
    res.status(408).json({ message: 'Response timeout' });
  });
  
  next();
});

// 6. Existing logging middleware (preserve as-is for parallel work integration)
// 7. Body parsing and input sanitization
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(sanitizeInput);

// 8. Authentication middleware will be applied by routes

// Enhanced request/response logging with performance monitoring
app.use((req: any, res, next) => {
  const startTime = PerformanceMonitor.startTimer();
  const requestId = generateRequestId();
  const startMemory = process.memoryUsage();
  
  // Add request ID to request object for correlation
  req.requestId = requestId;
  req.startTime = Date.now();
  
  // Capture response data
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  let responseSize = 0;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    responseSize = JSON.stringify(bodyJson).length;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = PerformanceMonitor.endTimer(startTime);
    const endMemory = process.memoryUsage();
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    if (req.path.startsWith("/api") && !req.path.startsWith("/api/health")) {
      // Structured HTTP logging
      Logger.http(`${req.method} ${req.path} ${res.statusCode}`, {
        method: req.method,
        url: req.path,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent') || 'Unknown',
        ip: req.ip || req.connection.remoteAddress || 'Unknown',
        userId: req.user?.id,
        responseSize
      });

      // Performance monitoring for slow requests
      PerformanceMonitor.logSlowOperation(`API ${req.method} ${req.path}`, duration, 2000, {
        statusCode: res.statusCode,
        requestId,
        userId: req.user?.id
      });

      // Continue legacy logging for compatibility (can be removed later)
      if (process.env.NODE_ENV === 'development') {
        let logLine = `${req.method} ${req.path} ${res.statusCode} in ${Math.round(duration)}ms`;
        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }
        log(logLine);
      }
    }
  });

  next();
});

(async () => {
  // Initialize database connection with retry logic
  try {
    await connectWithRetry();
  } catch (error) {
    Logger.error('Failed to establish database connection', { error: error instanceof Error ? error.message : 'Unknown error' });
    process.exit(1);
  }

  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  console.log(`🔧 Environment detection: NODE_ENV=${process.env.NODE_ENV}, app.get('env')=${app.get("env")}`);
  
  if (process.env.NODE_ENV === "development") {
    console.log(`📦 Setting up Vite for development`);
    await setupVite(app, server);
  } else {
    console.log(`📦 Setting up static serving for production`);
    serveStatic(app);
  }

  // 404 handler for undefined routes (must be after static serving)
  app.use('*', ErrorHandler.handle404);

  // Global error handler (must be last)
  app.use(ErrorHandler.handle);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 3000 if not specified to match .env
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    EnvironmentValidator.logEnvironmentStatus();
  });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    try {
      // Close HTTP server
      server.close(() => {
        console.log('✅ HTTP server closed');
      });

      // Close database connections
      await closeDatabase();

      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    Logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled rejection', { reason, promise });
    gracefulShutdown('unhandledRejection');
  });
})();
