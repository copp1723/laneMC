/**
 * Google Ads API Monitoring Wrapper
 * Tracks API call performance, rate limits, and service health
 */

import Logger, { PerformanceMonitor } from './logger';

export interface GoogleAdsApiMetrics {
  method: string;
  endpoint: string;
  duration: number;
  success: boolean;
  error?: string;
  customerId?: string;
  statusCode?: number;
  responseSize?: number;
  rateLimitRemaining?: number;
}

export class GoogleAdsMonitor {
  private static apiCallStats = new Map<string, { count: number; totalDuration: number; errors: number }>();
  private static slowCallThreshold = 5000; // 5 seconds
  private static rateLimitWarningThreshold = 100; // Warn when less than 100 calls remaining

  /**
   * Monitor a Google Ads API call
   */
  static async monitorApiCall<T>(
    operation: () => Promise<T>,
    callInfo: {
      method: string;
      endpoint: string;
      customerId?: string;
      context?: string;
    }
  ): Promise<T> {
    const startTime = PerformanceMonitor.startTimer();
    const { method, endpoint, customerId, context } = callInfo;
    
    try {
      // Execute the API call
      const result = await operation();
      const duration = PerformanceMonitor.endTimer(startTime);
      
      // Determine response size if possible
      const responseSize = this.calculateResponseSize(result);
      
      // Log successful API call
      Logger.googleAds('Google Ads API call successful', {
        method,
        endpoint: this.sanitizeEndpoint(endpoint),
        duration,
        success: true,
        customerId,
        context,
        responseSize
      });
      
      // Track API call statistics
      this.updateApiCallStats(endpoint, duration, false);
      
      // Log slow API calls
      if (duration > this.slowCallThreshold) {
        Logger.warn('Slow Google Ads API call detected', {
          method,
          endpoint: this.sanitizeEndpoint(endpoint),
          duration,
          threshold: this.slowCallThreshold,
          customerId,
          context
        });
      }
      
      return result;
    } catch (error) {
      const duration = PerformanceMonitor.endTimer(startTime);
      
      // Extract error details
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = this.extractStatusCode(error);
      
      // Log failed API call
      Logger.googleAds('Google Ads API call failed', {
        method,
        endpoint: this.sanitizeEndpoint(endpoint),
        duration,
        success: false,
        error: errorMessage,
        customerId,
        context,
        statusCode
      });
      
      // Track error statistics
      this.updateApiCallStats(endpoint, duration, true);
      
      // Check for specific error types
      this.handleSpecificErrors(error, { method, endpoint, customerId });
      
      throw error;
    }
  }

  /**
   * Monitor rate limit status from API response headers
   */
  static checkRateLimit(headers: any, endpoint: string): void {
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '0', 10);
    const limit = parseInt(headers['x-ratelimit-limit'] || '0', 10);
    const resetTime = headers['x-ratelimit-reset'];
    
    if (remaining > 0 && remaining < this.rateLimitWarningThreshold) {
      Logger.warn('Google Ads API rate limit approaching', {
        endpoint: this.sanitizeEndpoint(endpoint),
        remaining,
        limit,
        resetTime,
        type: 'rate_limit_warning'
      });
    }
    
    if (remaining === 0) {
      Logger.error('Google Ads API rate limit exceeded', {
        endpoint: this.sanitizeEndpoint(endpoint),
        limit,
        resetTime,
        type: 'rate_limit_exceeded'
      });
    }
  }

  /**
   * Get API call performance statistics
   */
  static getApiCallStatistics(): Array<{
    endpoint: string;
    count: number;
    averageDuration: number;
    totalDuration: number;
    errors: number;
    errorRate: number;
  }> {
    const stats: Array<any> = [];
    
    this.apiCallStats.forEach((stat, endpoint) => {
      stats.push({
        endpoint: this.sanitizeEndpoint(endpoint),
        count: stat.count,
        averageDuration: Math.round(stat.totalDuration / stat.count),
        totalDuration: stat.totalDuration,
        errors: stat.errors,
        errorRate: Math.round((stat.errors / stat.count) * 100)
      });
    });
    
    // Sort by total duration (most expensive calls first)
    return stats.sort((a, b) => b.totalDuration - a.totalDuration);
  }

  /**
   * Reset API call statistics
   */
  static resetStatistics(): void {
    this.apiCallStats.clear();
    Logger.info('Google Ads API statistics reset');
  }

  /**
   * Set slow API call threshold
   */
  static setSlowCallThreshold(milliseconds: number): void {
    this.slowCallThreshold = milliseconds;
    Logger.info('Google Ads API slow call threshold updated', { threshold: milliseconds });
  }

  /**
   * Monitor authentication status
   */
  static logAuthenticationEvent(event: 'token_refresh' | 'auth_success' | 'auth_failure', details?: any): void {
    switch (event) {
      case 'token_refresh':
        Logger.info('Google Ads API token refreshed', {
          type: 'auth_event',
          event,
          ...details
        });
        break;
      case 'auth_success':
        Logger.info('Google Ads API authentication successful', {
          type: 'auth_event',
          event,
          ...details
        });
        break;
      case 'auth_failure':
        Logger.error('Google Ads API authentication failed', {
          type: 'auth_event',
          event,
          ...details
        });
        break;
    }
  }

  /**
   * Calculate response size for logging
   */
  private static calculateResponseSize(result: any): number {
    try {
      return JSON.stringify(result).length;
    } catch {
      return 0;
    }
  }

  /**
   * Extract HTTP status code from error
   */
  private static extractStatusCode(error: any): number | undefined {
    if (error?.response?.status) {
      return error.response.status;
    }
    if (error?.status) {
      return error.status;
    }
    return undefined;
  }

  /**
   * Handle specific Google Ads API errors
   */
  private static handleSpecificErrors(error: any, context: { method: string; endpoint: string; customerId?: string }): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = this.extractStatusCode(error);
    
    // Handle specific error types
    if (statusCode === 401) {
      Logger.security('Google Ads API authentication error', {
        type: 'authentication_failure',
        endpoint: context.endpoint,
        customerId: context.customerId,
        error: errorMessage
      });
    } else if (statusCode === 403) {
      Logger.security('Google Ads API authorization error', {
        type: 'authorization_failure',
        endpoint: context.endpoint,
        customerId: context.customerId,
        error: errorMessage
      });
    } else if (statusCode === 429) {
      Logger.warn('Google Ads API rate limit exceeded', {
        type: 'rate_limit_exceeded',
        endpoint: context.endpoint,
        customerId: context.customerId,
        error: errorMessage
      });
    } else if (statusCode && statusCode >= 500) {
      Logger.error('Google Ads API server error', {
        type: 'server_error',
        endpoint: context.endpoint,
        customerId: context.customerId,
        statusCode,
        error: errorMessage
      });
    }
  }

  /**
   * Sanitize endpoint for logging (remove sensitive parameters)
   */
  private static sanitizeEndpoint(endpoint: string): string {
    // Remove potential customer IDs and other sensitive data
    return endpoint
      .replace(/customers\/\d+/g, 'customers/***')
      .replace(/[?&]access_token=[^&]*/g, '?access_token=***')
      .replace(/[?&]key=[^&]*/g, '?key=***');
  }

  /**
   * Update internal API call statistics
   */
  private static updateApiCallStats(endpoint: string, duration: number, isError: boolean): void {
    const sanitizedEndpoint = this.sanitizeEndpoint(endpoint);
    const existing = this.apiCallStats.get(sanitizedEndpoint) || { count: 0, totalDuration: 0, errors: 0 };
    
    existing.count += 1;
    existing.totalDuration += duration;
    if (isError) {
      existing.errors += 1;
    }
    
    this.apiCallStats.set(sanitizedEndpoint, existing);
  }

  /**
   * Create a monitored Google Ads API operation wrapper
   */
  static createMonitoredOperation<T extends any[], R>(
    operation: (...args: T) => Promise<R>,
    operationInfo: { method: string; endpoint: string }
  ) {
    return async (...args: T): Promise<R> => {
      return this.monitorApiCall(
        () => operation(...args),
        operationInfo
      );
    };
  }
}