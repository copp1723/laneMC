/**
 * Performance Caching Service
 * Provides intelligent caching for expensive operations
 */

import NodeCache from 'node-cache';
import Logger, { PerformanceMonitor } from './logger';

export interface CacheConfig {
  ttl?: number; // Time to live in seconds
  checkperiod?: number; // Cleanup interval in seconds
  maxKeys?: number; // Maximum number of keys
}

export interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
}

export class CacheService {
  private static instances: Map<string, NodeCache> = new Map();
  private static stats: Map<string, { hits: number; misses: number }> = new Map();

  /**
   * Get or create a cache instance
   */
  static getCache(name: string, config: CacheConfig = {}): NodeCache {
    if (!this.instances.has(name)) {
      const cache = new NodeCache({
        stdTTL: config.ttl || 300, // Default 5 minutes
        checkperiod: config.checkperiod || 60, // Cleanup every minute
        maxKeys: config.maxKeys || 1000, // Limit memory usage
        useClones: false // Better performance, but be careful with objects
      });

      // Initialize stats
      this.stats.set(name, { hits: 0, misses: 0 });

      // Add event listeners
      cache.on('set', (key, value) => {
        Logger.debug(`Cache SET: ${name}:${key}`, { 
          cacheInstance: name,
          keySize: JSON.stringify(value).length
        });
      });

      cache.on('del', (key, value) => {
        Logger.debug(`Cache DEL: ${name}:${key}`, { cacheInstance: name });
      });

      cache.on('expired', (key, value) => {
        Logger.debug(`Cache EXPIRED: ${name}:${key}`, { cacheInstance: name });
      });

      this.instances.set(name, cache);
      Logger.info(`Cache instance created: ${name}`, { config });
    }

    return this.instances.get(name)!;
  }

  /**
   * Get value with performance monitoring
   */
  static async get<T>(cacheName: string, key: string): Promise<T | undefined> {
    const cache = this.getCache(cacheName);
    const stats = this.stats.get(cacheName)!;
    
    const startTime = PerformanceMonitor.startTimer();
    const value = cache.get<T>(key);
    const duration = PerformanceMonitor.endTimer(startTime);

    if (value !== undefined) {
      stats.hits++;
      Logger.debug(`Cache HIT: ${cacheName}:${key}`, { 
        duration,
        cacheInstance: cacheName 
      });
    } else {
      stats.misses++;
      Logger.debug(`Cache MISS: ${cacheName}:${key}`, { 
        duration,
        cacheInstance: cacheName 
      });
    }

    return value;
  }

  /**
   * Set value with performance monitoring
   */
  static async set<T>(cacheName: string, key: string, value: T, ttl?: number): Promise<boolean> {
    const cache = this.getCache(cacheName);
    const startTime = PerformanceMonitor.startTimer();
    
    const success = cache.set(key, value, ttl || 0);
    const duration = PerformanceMonitor.endTimer(startTime);

    Logger.debug(`Cache SET: ${cacheName}:${key}`, { 
      duration,
      success,
      ttl: ttl || cache.options.stdTTL,
      cacheInstance: cacheName
    });

    return success;
  }

  /**
   * Cache wrapper for expensive operations
   */
  static async getCachedResult<T>(
    cacheName: string,
    key: string,
    operation: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(cacheName, key);
    if (cached !== undefined) {
      return cached;
    }

    // Execute expensive operation
    const startTime = PerformanceMonitor.startTimer();
    const result = await operation();
    const duration = PerformanceMonitor.endTimer(startTime);

    // Cache the result
    await this.set(cacheName, key, result, ttl);

    Logger.info(`Expensive operation cached: ${cacheName}:${key}`, {
      duration,
      cacheInstance: cacheName
    });

    return result;
  }

  /**
   * Delete from cache
   */
  static async del(cacheName: string, key: string | string[]): Promise<number> {
    const cache = this.getCache(cacheName);
    return cache.del(key);
  }

  /**
   * Clear entire cache instance
   */
  static async flush(cacheName: string): Promise<void> {
    const cache = this.getCache(cacheName);
    cache.flushAll();
    Logger.info(`Cache flushed: ${cacheName}`);
  }

  /**
   * Get cache statistics
   */
  static getStats(cacheName?: string): CacheStats | Map<string, CacheStats> {
    if (cacheName) {
      const cache = this.instances.get(cacheName);
      const stats = this.stats.get(cacheName);
      
      if (!cache || !stats) {
        throw new Error(`Cache instance not found: ${cacheName}`);
      }

      const keys = cache.keys().length;
      const total = stats.hits + stats.misses;
      
      return {
        keys,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: total > 0 ? (stats.hits / total) * 100 : 0,
        memoryUsage: JSON.stringify(cache.keys().map(k => cache.get(k))).length
      };
    }

    // Return stats for all cache instances
    const allStats = new Map<string, CacheStats>();
    for (const [name] of Array.from(this.instances)) {
      allStats.set(name, this.getStats(name) as CacheStats);
    }
    return allStats;
  }

  /**
   * Reset statistics
   */
  static resetStats(cacheName?: string): void {
    if (cacheName) {
      const stats = this.stats.get(cacheName);
      if (stats) {
        stats.hits = 0;
        stats.misses = 0;
      }
    } else {
      for (const [name, stats] of Array.from(this.stats)) {
        stats.hits = 0;
        stats.misses = 0;
      }
    }
    Logger.info(`Cache statistics reset${cacheName ? ` for ${cacheName}` : ''}`);
  }

  /**
   * Create a cached wrapper function
   */
  static createCachedFunction<T extends any[], R>(
    cacheName: string,
    operation: (...args: T) => Promise<R>,
    keyGenerator: (...args: T) => string,
    ttl?: number
  ) {
    return async (...args: T): Promise<R> => {
      const key = keyGenerator(...args);
      return this.getCachedResult(cacheName, key, () => operation(...args), ttl);
    };
  }
}

// Pre-configured cache instances for common use cases
export class AppCaches {
  // Google Ads API responses (5 minute cache)
  static googleAds = CacheService.getCache('google_ads', { 
    ttl: 300, // 5 minutes
    maxKeys: 500 
  });

  // Surgical analysis results (10 minute cache)
  static surgicalAnalysis = CacheService.getCache('surgical_analysis', { 
    ttl: 600, // 10 minutes
    maxKeys: 200 
  });

  // Database query results (2 minute cache)
  static databaseQueries = CacheService.getCache('database_queries', { 
    ttl: 120, // 2 minutes
    maxKeys: 1000 
  });

  // Health check results (30 second cache)
  static healthChecks = CacheService.getCache('health_checks', { 
    ttl: 30, // 30 seconds
    maxKeys: 50 
  });

  // User session data (15 minute cache)
  static userSessions = CacheService.getCache('user_sessions', { 
    ttl: 900, // 15 minutes
    maxKeys: 1000 
  });

  /**
   * Get comprehensive cache statistics
   */
  static getAllStats(): { [key: string]: CacheStats } {
    const stats = CacheService.getStats() as Map<string, CacheStats>;
    const result: { [key: string]: CacheStats } = {};
    
    for (const [name, stat] of Array.from(stats)) {
      result[name] = stat;
    }
    
    return result;
  }

  /**
   * Flush all application caches
   */
  static flushAll(): void {
    CacheService.flush('google_ads');
    CacheService.flush('surgical_analysis');
    CacheService.flush('database_queries');
    CacheService.flush('health_checks');
    CacheService.flush('user_sessions');
    
    Logger.info('All application caches flushed');
  }
}