/**
 * Graceful Degradation Service
 * Provides fallback mechanisms when external services are unavailable
 */

import Logger from './logger';
import { CircuitBreakerManager } from './circuit-breaker';
import { storage } from '../storage';

export interface FallbackData {
  source: 'cache' | 'mock' | 'partial';
  timestamp: string;
  warning?: string;
}

export interface GoogleAdsAccountFallback {
  id: string;
  customerId: string;
  name: string;
  currency: string;
  timezone: string;
  isActive: boolean;
  fallback: FallbackData;
}

export interface GoogleAdsCampaignFallback {
  id: string;
  name: string;
  status: string;
  type: string;
  budget: number;
  fallback: FallbackData;
}

export interface GoogleAdsMetricsFallback {
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  fallback: FallbackData;
}

export class GracefulDegradationService {
  private static readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private static cache = new Map<string, { data: any; timestamp: number }>();

  /**
   * Execute operation with graceful degradation
   */
  static async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    cacheKey?: string
  ): Promise<T> {
    try {
      const result = await operation();
      
      // Cache successful result if cache key provided
      if (cacheKey) {
        this.setCache(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      Logger.warn('Primary operation failed, attempting fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        cacheKey
      });

      try {
        // Try cached data first if available
        if (cacheKey) {
          const cached = this.getCache<T>(cacheKey);
          if (cached) {
            Logger.info('Returning cached data due to service failure', { cacheKey });
            return cached;
          }
        }

        // Execute fallback operation
        const fallbackResult = await fallbackOperation();
        Logger.info('Fallback operation successful', { cacheKey });
        return fallbackResult;
      } catch (fallbackError) {
        Logger.error('Both primary and fallback operations failed', {
          primaryError: error instanceof Error ? error.message : 'Unknown error',
          fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
          cacheKey
        });
        throw error; // Throw original error
      }
    }
  }

  /**
   * Get Google Ads accounts with fallback
   */
  static async getGoogleAdsAccountsWithFallback(userId?: string): Promise<GoogleAdsAccountFallback[]> {
    const cacheKey = `accounts_${userId || 'all'}`;
    
    return this.executeWithFallback(
      async () => {
        // Primary: Get from database (which should have synced data)
        const accounts = await storage.getGoogleAdsAccounts(userId);
        return accounts.map(account => ({
          id: account.id,
          customerId: account.customerId,
          name: account.name,
          currency: account.currency || 'USD',
          timezone: account.timezone || 'UTC',
          isActive: account.isActive || false,
          fallback: {
            source: 'cache' as const,
            timestamp: new Date().toISOString()
          }
        }));
      },
      async () => {
        // Fallback: Return mock data or empty array
        Logger.warn('Using mock Google Ads accounts data');
        return [{
          id: 'mock-account-1',
          customerId: '1234567890',
          name: 'Demo Account (Service Unavailable)',
          currency: 'USD',
          timezone: 'America/New_York',
          isActive: true,
          fallback: {
            source: 'cache' as const,
            timestamp: new Date().toISOString(),
            warning: 'Google Ads service is temporarily unavailable. Showing demo data.'
          }
        }];
      },
      cacheKey
    );
  }

  /**
   * Get campaigns with fallback
   */
  static async getCampaignsWithFallback(customerId: string): Promise<GoogleAdsCampaignFallback[]> {
    const cacheKey = `campaigns_${customerId}`;
    
    return this.executeWithFallback(
      async () => {
        // Primary: Get from database
        const campaigns = await storage.getCampaigns(customerId);
        return campaigns.map(campaign => ({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status || 'UNKNOWN',
          type: campaign.type,
          budget: parseFloat(campaign.budget?.toString() || '0'),
          fallback: {
            source: 'cache' as const,
            timestamp: new Date().toISOString()
          }
        }));
      },
      async () => {
        // Fallback: Return mock campaigns
        Logger.warn('Using mock campaigns data', { customerId });
        return [{
          id: 'mock-campaign-1',
          name: 'Demo Campaign (Service Unavailable)',
          status: 'PAUSED',
          type: 'SEARCH',
          budget: 100,
          fallback: {
            source: 'cache' as const,
            timestamp: new Date().toISOString(),
            warning: 'Google Ads service is temporarily unavailable. Showing demo data.'
          }
        }];
      },
      cacheKey
    );
  }

  /**
   * Get performance metrics with fallback
   */
  static async getMetricsWithFallback(
    customerId: string,
    campaignId?: string,
    dateRange: string = 'LAST_7_DAYS'
  ): Promise<GoogleAdsMetricsFallback> {
    const cacheKey = `metrics_${customerId}_${campaignId || 'all'}_${dateRange}`;
    
    return this.executeWithFallback(
      async () => {
        // Primary: Get from database
        const metrics = await storage.getPerformanceMetrics(customerId, campaignId);
        
        // Aggregate metrics if multiple records
        const aggregated = metrics.reduce((acc, metric) => ({
          impressions: acc.impressions + (metric.impressions || 0),
          clicks: acc.clicks + (metric.clicks || 0),
          conversions: acc.conversions + (metric.conversions || 0),
          cost: acc.cost + parseFloat(metric.cost?.toString() || '0')
        }), { impressions: 0, clicks: 0, conversions: 0, cost: 0 });

        return {
          ...aggregated,
          ctr: aggregated.impressions > 0 ? aggregated.clicks / aggregated.impressions : 0,
          cpc: aggregated.clicks > 0 ? aggregated.cost / aggregated.clicks : 0,
          conversionRate: aggregated.clicks > 0 ? aggregated.conversions / aggregated.clicks : 0,
          fallback: {
            source: 'cache' as const,
            timestamp: new Date().toISOString()
          }
        };
      },
      async () => {
        // Fallback: Return mock metrics
        Logger.warn('Using mock metrics data', { customerId, campaignId });
        return {
          impressions: 1000,
          clicks: 50,
          conversions: 5,
          cost: 100,
          ctr: 0.05,
          cpc: 2.0,
          conversionRate: 0.1,
          fallback: {
            source: 'cache' as const,
            timestamp: new Date().toISOString(),
            warning: 'Google Ads service is temporarily unavailable. Showing demo data.'
          }
        };
      },
      cacheKey
    );
  }

  /**
   * Check if Google Ads service is available
   */
  static isGoogleAdsServiceAvailable(): boolean {
    const breaker = CircuitBreakerManager.getBreaker('google-ads-api');
    return breaker.isHealthy();
  }

  /**
   * Get service status for all external services
   */
  static getServiceStatus(): Record<string, { available: boolean; lastCheck: string }> {
    const breakerStats = CircuitBreakerManager.getAllStats();
    const status: Record<string, { available: boolean; lastCheck: string }> = {};

    for (const [service, stats] of Object.entries(breakerStats)) {
      status[service] = {
        available: stats.state === 'CLOSED',
        lastCheck: new Date().toISOString()
      };
    }

    return status;
  }

  /**
   * Cache management
   */
  private static setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private static getCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Clear expired cache entries
   */
  static clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of Array.from(this.cache.entries())) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Clear expired cache every 10 minutes
setInterval(() => {
  GracefulDegradationService.clearExpiredCache();
}, 10 * 60 * 1000);
