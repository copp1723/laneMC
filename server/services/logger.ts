/**
 * Production Logging & Monitoring Service
 * Provides structured logging, performance monitoring, and observability
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Log levels: error, warn, info, http, verbose, debug, silly
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, ...meta } = info;
    return JSON.stringify({
      timestamp,
      level,
      service: service || 'lanemc',
      message,
      ...meta
    });
  })
);

// Create winston logger
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'lanemc' },
  transports: [
    // Console transport for development
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : []),

    // Production file transports
    ...(process.env.NODE_ENV === 'production' ? [
      // Error logs
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '30d',
        maxSize: '20m'
      }),

      // All logs
      new DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        maxSize: '20m'
      }),

      // HTTP logs
      new DailyRotateFile({
        filename: 'logs/http-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'http',
        maxFiles: '7d',
        maxSize: '20m'
      })
    ] : [])
  ]
});

// Performance monitoring utilities
export interface PerformanceMetrics {
  duration: number;
  memory: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

export interface RequestMetrics {
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  userAgent?: string;
  ip: string;
  userId?: string;
  responseSize?: number;
}

export interface DatabaseMetrics {
  query: string;
  duration: number;
  rowCount?: number;
  error?: string;
  context?: string;
}

export interface GoogleAdsMetrics {
  method: string;
  endpoint: string;
  duration: number;
  success: boolean;
  error?: string;
  customerId?: string;
  context?: string;
  statusCode?: number;
  responseSize?: number;
}

// Structured logging interface
export class Logger {
  // Basic logging methods
  static error(message: string, meta?: any) {
    logger.error(message, meta);
  }

  static warn(message: string, meta?: any) {
    logger.warn(message, meta);
  }

  static info(message: string, meta?: any) {
    logger.info(message, meta);
  }

  static debug(message: string, meta?: any) {
    logger.debug(message, meta);
  }

  static verbose(message: string, meta?: any) {
    logger.verbose(message, meta);
  }

  // HTTP request logging
  static http(message: string, metrics: RequestMetrics) {
    logger.http(message, {
      type: 'http_request',
      ...metrics
    });
  }

  // Performance logging
  static performance(operation: string, metrics: PerformanceMetrics, meta?: any) {
    logger.info(`Performance: ${operation}`, {
      type: 'performance',
      operation,
      ...metrics,
      ...meta
    });
  }

  // Database query logging
  static database(message: string, metrics: DatabaseMetrics) {
    const level = metrics.error ? 'error' : (metrics.duration > 1000 ? 'warn' : 'debug');
    logger.log(level, message, {
      type: 'database',
      ...metrics
    });
  }

  // Google Ads API logging
  static googleAds(message: string, metrics: GoogleAdsMetrics) {
    const level = !metrics.success ? 'error' : (metrics.duration > 5000 ? 'warn' : 'debug');
    logger.log(level, message, {
      type: 'google_ads_api',
      ...metrics
    });
  }

  // Security logging
  static security(message: string, meta: any) {
    logger.warn(message, {
      type: 'security',
      ...meta
    });
  }

  // Business logic logging
  static business(message: string, meta?: any) {
    logger.info(message, {
      type: 'business',
      ...meta
    });
  }

  // System health logging
  static health(message: string, meta?: any) {
    logger.info(message, {
      type: 'health',
      ...meta
    });
  }

  // Startup/shutdown logging
  static startup(message: string, meta?: any) {
    logger.info(message, {
      type: 'startup',
      ...meta
    });
  }

  static shutdown(message: string, meta?: any) {
    logger.info(message, {
      type: 'shutdown',
      ...meta
    });
  }
}

// Performance monitoring helpers
export class PerformanceMonitor {
  private static cpuUsage: NodeJS.CpuUsage = process.cpuUsage();

  static startTimer(): [number, number] {
    return process.hrtime();
  }

  static endTimer(startTime: [number, number]): number {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    return seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds
  }

  static getMetrics(): PerformanceMetrics {
    const duration = 0; // This would be set by the caller
    const memory = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.cpuUsage);
    this.cpuUsage = process.cpuUsage(); // Reset baseline

    return {
      duration,
      memory,
      cpuUsage
    };
  }

  static logSlowOperation(operation: string, duration: number, threshold: number = 1000, meta?: any) {
    if (duration > threshold) {
      Logger.performance(`Slow operation: ${operation}`, {
        duration,
        memory: process.memoryUsage()
      }, meta);
    }
  }
}

// Request correlation ID middleware helper
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default Logger;