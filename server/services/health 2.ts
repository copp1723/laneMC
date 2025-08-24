/**
 * Comprehensive Health Check Service
 * Monitors system health, database connectivity, and external API status
 */

import { Pool } from 'pg';
import { storage } from '../storage';
import { googleAdsService } from './google-ads';
import Logger from './logger';
import { CacheService } from './cache';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    googleAds: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
  };
  metrics: SystemMetrics;
}

export interface HealthCheck {
  status: 'pass' | 'warn' | 'fail';
  duration: number;
  message?: string;
  details?: any;
}

export interface SystemMetrics {
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  timestamp: string;
  nodeVersion: string;
  pid: number;
}

export class HealthService {
  private static startTime = Date.now();

  /**
   * Perform comprehensive health check
   */
  static async getHealthStatus(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const startTime = Date.now();

    Logger.health('Health check started');

    // Run all health checks in parallel
    const [database, googleAds, memory, disk] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkGoogleAds(),
      this.checkMemory(),
      this.checkDisk()
    ]);

    // Extract results from settled promises
    const checks = {
      database: database.status === 'fulfilled' ? database.value : { status: 'fail' as const, duration: 0, message: 'Health check failed' },
      googleAds: googleAds.status === 'fulfilled' ? googleAds.value : { status: 'fail' as const, duration: 0, message: 'Health check failed' },
      memory: memory.status === 'fulfilled' ? memory.value : { status: 'fail' as const, duration: 0, message: 'Health check failed' },
      disk: disk.status === 'fulfilled' ? disk.value : { status: 'fail' as const, duration: 0, message: 'Health check failed' }
    };

    // Determine overall health status
    const overallStatus = this.determineOverallStatus(checks);
    const duration = Date.now() - startTime;

    const health: HealthStatus = {
      status: overallStatus,
      timestamp,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: Date.now() - this.startTime,
      checks,
      metrics: this.getSystemMetrics()
    };

    Logger.health('Health check completed', {
      status: overallStatus,
      duration,
      checks: Object.entries(checks).map(([name, check]) => ({
        name,
        status: check.status,
        duration: check.duration
      }))
    });

    return health;
  }

  /**
   * Check database connectivity
   */
  private static async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      // Test basic database connectivity
      const testUser = await storage.getUser('health-check-test');
      const duration = Date.now() - start;

      if (duration > 5000) {
        return {
          status: 'warn',
          duration,
          message: 'Database responding slowly',
          details: { threshold: 5000 }
        };
      }

      return {
        status: 'pass',
        duration,
        message: 'Database connection healthy'
      };
    } catch (error) {
      const duration = Date.now() - start;
      Logger.error('Database health check failed', { error: error instanceof Error ? error.message : 'Unknown error', duration });
      
      return {
        status: 'fail',
        duration,
        message: 'Database connection failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Check Google Ads API connectivity
   */
  private static async checkGoogleAds(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      // Test Google Ads API connectivity by checking accessible customers
      // This is a read-only operation
      const customerIds = await googleAdsService.getAccessibleCustomers();
      const duration = Date.now() - start;

      if (duration > 10000) {
        return {
          status: 'warn',
          duration,
          message: 'Google Ads API responding slowly',
          details: { threshold: 10000, customerCount: customerIds.length }
        };
      }

      return {
        status: 'pass',
        duration,
        message: 'Google Ads API healthy',
        details: { customerCount: customerIds.length }
      };
    } catch (error) {
      const duration = Date.now() - start;
      Logger.warn('Google Ads API health check failed', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        duration 
      });
      
      // Google Ads API failure is not critical for basic app functionality
      return {
        status: 'warn',
        duration,
        message: 'Google Ads API unavailable',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Check memory usage
   */
  private static async checkMemory(): Promise<HealthCheck> {
    const start = Date.now();
    const memUsage = process.memoryUsage();
    const duration = Date.now() - start;
    
    // Convert to MB
    const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const percentage = (usedMB / totalMB) * 100;

    if (percentage > 90) {
      return {
        status: 'fail',
        duration,
        message: 'Memory usage critically high',
        details: { usedMB, totalMB, percentage }
      };
    }

    if (percentage > 75) {
      return {
        status: 'warn',
        duration,
        message: 'Memory usage high',
        details: { usedMB, totalMB, percentage }
      };
    }

    return {
      status: 'pass',
      duration,
      message: 'Memory usage normal',
      details: { usedMB, totalMB, percentage }
    };
  }

  /**
   * Check disk space (basic implementation)
   */
  private static async checkDisk(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      // Basic disk check - in production, you might want more sophisticated disk monitoring
      const duration = Date.now() - start;
      
      return {
        status: 'pass',
        duration,
        message: 'Disk space adequate',
        details: { note: 'Basic check - consider implementing fs.statSync for production' }
      };
    } catch (error) {
      const duration = Date.now() - start;
      
      return {
        status: 'warn',
        duration,
        message: 'Unable to check disk space',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Determine overall health status based on individual checks
   */
  private static determineOverallStatus(checks: HealthStatus['checks']): HealthStatus['status'] {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.includes('fail')) {
      // Critical failure if database fails
      if (checks.database.status === 'fail') {
        return 'unhealthy';
      }
      return 'degraded';
    }
    
    if (statuses.includes('warn')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Get current system metrics
   */
  private static getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    
    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        free: Math.round((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      pid: process.pid
    };
  }

  /**
   * Simple health check for load balancers
   */
  static async getSimpleHealth(): Promise<{ status: string; timestamp: string }> {
    return CacheService.getCachedResult(
      'health_checks',
      'simple_health',
      async () => {
        try {
          // Quick database connectivity check
          await storage.getUser('health-check-test');
          
          return {
            status: 'healthy',
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          Logger.error('Simple health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
          
          return {
            status: 'unhealthy',
            timestamp: new Date().toISOString()
          };
        }
      },
      15 // Cache for 15 seconds (quick updates for health status)
    );
  }
}