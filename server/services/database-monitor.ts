/**
 * Database Performance Monitoring Wrapper
 * Tracks query performance, slow queries, and database health
 */

import { Pool } from 'pg';
import Logger, { PerformanceMonitor } from './logger';
import { CacheService } from './cache';

export interface DatabaseQueryMetrics {
  query: string;
  duration: number;
  rowCount?: number;
  error?: string;
  context?: string;
}

export class DatabaseMonitor {
  private static slowQueryThreshold = 1000; // 1 second
  private static queryStats = new Map<string, { count: number; totalDuration: number; errors: number }>();

  /**
   * Monitor a database query execution
   */
  static async monitorQuery<T>(
    operation: () => Promise<T>,
    queryInfo: { query: string; context?: string }
  ): Promise<T> {
    const startTime = PerformanceMonitor.startTimer();
    const { query, context } = queryInfo;
    
    try {
      const result = await operation();
      const duration = PerformanceMonitor.endTimer(startTime);
      
      // Determine row count if result is an array
      const rowCount = Array.isArray(result) ? result.length : undefined;
      
      // Log the query metrics
      Logger.database('Database query executed', {
        query: this.sanitizeQuery(query),
        duration,
        rowCount,
        context
      });
      
      // Track query statistics
      this.updateQueryStats(query, duration, false);
      
      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        Logger.warn('Slow database query detected', {
          query: this.sanitizeQuery(query),
          duration,
          threshold: this.slowQueryThreshold,
          context,
          rowCount
        });
      }
      
      return result;
    } catch (error) {
      const duration = PerformanceMonitor.endTimer(startTime);
      
      // Log the error
      Logger.database('Database query failed', {
        query: this.sanitizeQuery(query),
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });
      
      // Track error statistics
      this.updateQueryStats(query, duration, true);
      
      throw error;
    }
  }

  /**
   * Monitor raw SQL queries (for direct database access)
   */
  static async monitorRawQuery<T extends any[]>(
    pool: Pool,
    query: string,
    values: any[] = [],
    context?: string
  ): Promise<T> {
    const startTime = PerformanceMonitor.startTimer();
    
    try {
      const result = await pool.query(query, values);
      const duration = PerformanceMonitor.endTimer(startTime);
      
      Logger.database('Raw SQL query executed', {
        query: this.sanitizeQuery(query),
        duration,
        rowCount: result.rowCount || 0,
        context
      });
      
      this.updateQueryStats(query, duration, false);
      
      if (duration > this.slowQueryThreshold) {
        Logger.warn('Slow raw SQL query detected', {
          query: this.sanitizeQuery(query),
          duration,
          threshold: this.slowQueryThreshold,
          context,
          rowCount: result.rowCount
        });
      }
      
      return result.rows as T;
    } catch (error) {
      const duration = PerformanceMonitor.endTimer(startTime);
      
      Logger.database('Raw SQL query failed', {
        query: this.sanitizeQuery(query),
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });
      
      this.updateQueryStats(query, duration, true);
      
      throw error;
    }
  }

  /**
   * Get database performance statistics
   */
  static getQueryStatistics(): Array<{
    query: string;
    count: number;
    averageDuration: number;
    totalDuration: number;
    errors: number;
    errorRate: number;
  }> {
    const stats: Array<any> = [];
    
    this.queryStats.forEach((stat, query) => {
      stats.push({
        query: this.sanitizeQuery(query),
        count: stat.count,
        averageDuration: Math.round(stat.totalDuration / stat.count),
        totalDuration: stat.totalDuration,
        errors: stat.errors,
        errorRate: Math.round((stat.errors / stat.count) * 100)
      });
    });
    
    // Sort by total duration (most expensive queries first)
    return stats.sort((a, b) => b.totalDuration - a.totalDuration);
  }

  /**
   * Reset query statistics (useful for periodic reporting)
   */
  static resetStatistics(): void {
    this.queryStats.clear();
    Logger.info('Database query statistics reset');
  }

  /**
   * Set slow query threshold
   */
  static setSlowQueryThreshold(milliseconds: number): void {
    this.slowQueryThreshold = milliseconds;
    Logger.info('Database slow query threshold updated', { threshold: milliseconds });
  }

  /**
   * Monitor database connection pool status
   */
  static monitorConnectionPool(pool: Pool, poolName: string = 'default'): void {
    const poolInfo = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
    
    Logger.debug('Database connection pool status', {
      pool: poolName,
      ...poolInfo
    });
    
    // Warn if connection pool is getting full
    if (pool.waitingCount > 0) {
      Logger.warn('Database connection pool has waiting connections', {
        pool: poolName,
        ...poolInfo
      });
    }
    
    // Warn if too many connections are being used (use default of 20 from storage configuration)
    const maxConnections = 20; // From storage.ts pool configuration
    if (pool.totalCount > maxConnections * 0.8) {
      Logger.warn('Database connection pool usage is high', {
        pool: poolName,
        ...poolInfo,
        maxConnections
      });
    }
  }

  /**
   * Sanitize query for logging (remove sensitive data, truncate long queries)
   */
  private static sanitizeQuery(query: string): string {
    // Remove potential sensitive data patterns
    let sanitized = query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/password\s*=\s*"[^"]*"/gi, 'password="***"')
      .replace(/email\s*=\s*'[^']*'/gi, "email='***'")
      .replace(/email\s*=\s*"[^"]*"/gi, 'email="***"');
    
    // Truncate very long queries
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200) + '...';
    }
    
    // Normalize whitespace
    return sanitized.replace(/\s+/g, ' ').trim();
  }

  /**
   * Update internal query statistics
   */
  private static updateQueryStats(query: string, duration: number, isError: boolean): void {
    const sanitizedQuery = this.sanitizeQuery(query);
    const existing = this.queryStats.get(sanitizedQuery) || { count: 0, totalDuration: 0, errors: 0 };
    
    existing.count += 1;
    existing.totalDuration += duration;
    if (isError) {
      existing.errors += 1;
    }
    
    this.queryStats.set(sanitizedQuery, existing);
  }

  /**
   * Create a monitored database operation wrapper
   */
  static createMonitoredOperation<T extends any[], R>(
    operation: (...args: T) => Promise<R>,
    operationName: string
  ) {
    return async (...args: T): Promise<R> => {
      return this.monitorQuery(
        () => operation(...args),
        { query: operationName, context: 'drizzle-orm' }
      );
    };
  }

  /**
   * Monitor and cache database queries for read-heavy operations
   */
  static async monitorCachedQuery<T>(
    operation: () => Promise<T>,
    queryInfo: { query: string; context?: string; cacheKey?: string },
    ttl?: number
  ): Promise<T> {
    const cacheKey = queryInfo.cacheKey || `query_${queryInfo.query.replace(/\s+/g, '_').substring(0, 50)}`;
    
    return CacheService.getCachedResult(
      'database_queries',
      cacheKey,
      () => this.monitorQuery(operation, queryInfo),
      ttl || 120 // Default 2 minutes cache
    );
  }

  /**
   * Cached version of raw SQL queries (for read-only queries)
   */
  static async monitorCachedRawQuery<T extends any[]>(
    pool: Pool,
    query: string,
    values: any[] = [],
    context?: string,
    ttl?: number
  ): Promise<T> {
    // Create a unique cache key based on query and values
    const cacheKey = `raw_${this.sanitizeQuery(query)}_${JSON.stringify(values)}`;
    
    return CacheService.getCachedResult(
      'database_queries',
      cacheKey,
      () => this.monitorRawQuery<T>(pool, query, values, context),
      ttl || 120 // Default 2 minutes cache
    );
  }

  /**
   * Cache expensive aggregation queries
   */
  static async monitorCachedAggregation<T>(
    operation: () => Promise<T>,
    aggregationName: string,
    ttl?: number
  ): Promise<T> {
    return this.monitorCachedQuery(
      operation,
      { 
        query: aggregationName, 
        context: 'aggregation',
        cacheKey: `agg_${aggregationName}`
      },
      ttl || 300 // Default 5 minutes for aggregations
    );
  }
}