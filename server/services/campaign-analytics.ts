/**
 * Advanced Campaign Analytics Service
 * Enterprise-level campaign performance analysis and optimization
 */

import { storage } from '../storage';
import { googleAdsService } from './google-ads';
import type { GoogleAdsAccount } from '@shared/schema';

export interface IndustryBenchmarks {
  avgCtr: number;
  avgCpc: number;
  avgConversionRate: number;
  qualityScoreBenchmark: number;
}

export interface EnhancedMetrics {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  costPerConversion: number;
  roas: number;
  qualityScore: number;
  impressionShare: number;
  searchImpressionShare: number;
}

export interface PerformanceScore {
  overall: number;
  efficiency: number;
  reach: number;
  quality: number;
  breakdown: {
    ctrScore: number;
    conversionScore: number;
    costEfficiencyScore: number;
    qualityScore: number;
  };
}

export interface OptimizationOpportunity {
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  description: string;
  recommendedAction: string;
  estimatedImprovement: string;
  implementationSteps: string[];
}

export interface TrendAnalysis {
  direction: 'improving' | 'declining' | 'stable';
  strength: 'weak' | 'moderate' | 'strong';
  metrics: {
    [key: string]: {
      trend: 'up' | 'down' | 'stable';
      changePercent: number;
      significance: 'low' | 'medium' | 'high';
    };
  };
}

export interface CampaignAnalysis {
  campaignId: string;
  enhancedMetrics: EnhancedMetrics;
  industryBenchmarks: IndustryBenchmarks;
  performanceScore: PerformanceScore;
  optimizationOpportunities: OptimizationOpportunity[];
  trendAnalysis: TrendAnalysis;
  recommendations: string[];
}

export interface ForecastResult {
  forecastPeriodDays: number;
  projectedMetrics: {
    cost: number;
    clicks: number;
    conversions: number;
    impressions: number;
  };
  budgetUtilization: {
    projectedSpend: number;
    remainingBudget: number;
    daysUntilBudgetExhausted: number;
  };
  confidenceLevel: number;
  assumptions: string[];
  recommendations: string[];
}

export interface AnomalyDetection {
  anomaliesDetected: number;
  overallHealthStatus: 'healthy' | 'needs_attention' | 'critical';
  anomalies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metric: string;
    currentValue: number | string;
    expectedRange: string;
    description: string;
    potentialCauses: string[];
    recommendedActions: string[];
  }>;
  monitoringRecommendations: string[];
}

class CampaignAnalyticsService {
  private industryBenchmarks: Record<string, IndustryBenchmarks> = {
    search: {
      avgCtr: 3.17,
      avgCpc: 2.69,
      avgConversionRate: 3.75,
      qualityScoreBenchmark: 7.0
    },
    display: {
      avgCtr: 0.46,
      avgCpc: 0.63,
      avgConversionRate: 0.77,
      qualityScoreBenchmark: 6.0
    },
    video: {
      avgCtr: 0.84,
      avgCpc: 1.85,
      avgConversionRate: 1.84,
      qualityScoreBenchmark: 6.5
    },
    performance_max: {
      avgCtr: 2.8,
      avgCpc: 1.45,
      avgConversionRate: 4.2,
      qualityScoreBenchmark: 8.0
    }
  };

  async analyzeCampaignPerformance(
    accountId: string, 
    campaignId: string,
    channelType: string = 'search'
  ): Promise<CampaignAnalysis> {
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) throw new Error('Account not found');

    // Get performance data
    const performance = await googleAdsService.getPerformanceMetrics(
      account.customerId,
      campaignId,
      'THIS_MONTH'
    );

    // Calculate enhanced metrics
    const enhancedMetrics = this.calculateEnhancedMetrics(performance);

    // Benchmark against industry standards
    const benchmarks = this.industryBenchmarks[channelType.toLowerCase()] || this.industryBenchmarks.search;

    // Performance scoring
    const performanceScore = this.calculatePerformanceScore(enhancedMetrics, benchmarks);

    // Optimization opportunities
    const opportunities = this.identifyOptimizationOpportunities(enhancedMetrics, benchmarks);

    // Trend analysis (simplified - would need historical data)
    const trendAnalysis = this.analyzePerformanceTrends(enhancedMetrics);

    return {
      campaignId,
      enhancedMetrics,
      industryBenchmarks: benchmarks,
      performanceScore,
      optimizationOpportunities: opportunities,
      trendAnalysis,
      recommendations: this.generateRecommendations(enhancedMetrics, opportunities)
    };
  }

  async forecastPerformance(
    accountId: string,
    campaignId: string,
    daysAhead: number = 30
  ): Promise<ForecastResult> {
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) throw new Error('Account not found');

    const performance = await googleAdsService.getPerformanceMetrics(
      account.customerId,
      campaignId,
      'THIS_MONTH'
    );

    const budget = 3000; // This should come from actual campaign budget

    // Calculate current daily metrics
    const currentDailyCost = performance.cost / 30; // Assume 30 days
    const currentDailyClicks = performance.clicks / 30;
    const currentDailyConversions = performance.conversions / 30;

    // Apply growth/decline trends (simplified model)
    const growthFactor = this.calculateGrowthFactor(performance);

    // Forecast metrics
    const forecastResult: ForecastResult = {
      forecastPeriodDays: daysAhead,
      projectedMetrics: {
        cost: Math.round(currentDailyCost * daysAhead * growthFactor * 100) / 100,
        clicks: Math.round(currentDailyClicks * daysAhead * growthFactor),
        conversions: Math.round(currentDailyConversions * daysAhead * growthFactor),
        impressions: Math.round(performance.impressions / 30 * daysAhead * growthFactor)
      },
      budgetUtilization: {
        projectedSpend: Math.round(currentDailyCost * daysAhead * growthFactor * 100) / 100,
        remainingBudget: Math.max(0, budget - (currentDailyCost * daysAhead * growthFactor)),
        daysUntilBudgetExhausted: this.calculateBudgetRunway(currentDailyCost * growthFactor, budget, performance.cost)
      },
      confidenceLevel: this.calculateForecastConfidence(performance),
      assumptions: [
        `Growth factor: ${growthFactor.toFixed(2)}x`,
        "Historical trend continuation",
        "No major market changes",
        "Consistent ad spend pattern"
      ],
      recommendations: []
    };

    // Add recommendations based on forecast
    forecastResult.recommendations = this.generateForecastRecommendations(forecastResult);

    return forecastResult;
  }

  async detectAnomalies(
    accountId: string,
    campaignId: string
  ): Promise<AnomalyDetection> {
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) throw new Error('Account not found');

    const performance = await googleAdsService.getPerformanceMetrics(
      account.customerId,
      campaignId,
      'THIS_MONTH'
    );

    const anomalies: AnomalyDetection['anomalies'] = [];
    const channelType = 'search'; // This should come from campaign type
    const benchmarks = this.industryBenchmarks[channelType];

    // Check for unusual CTR
    if (performance.clicks > 0 && performance.impressions > 0) {
      const ctr = (performance.clicks / performance.impressions) * 100;
      const expectedCtr = benchmarks.avgCtr;

      if (ctr < expectedCtr * 0.5) {
        anomalies.push({
          type: 'low_ctr',
          severity: 'high',
          metric: 'click_through_rate',
          currentValue: Math.round(ctr * 100) / 100,
          expectedRange: `${(expectedCtr * 0.8).toFixed(2)} - ${(expectedCtr * 1.2).toFixed(2)}`,
          description: 'CTR significantly below industry benchmark',
          potentialCauses: ['Poor ad copy', 'Irrelevant keywords', 'Low ad position'],
          recommendedActions: ['Review and optimize ad copy', 'Refine keyword targeting', 'Increase bids for better positioning']
        });
      } else if (ctr > expectedCtr * 2) {
        anomalies.push({
          type: 'high_ctr',
          severity: 'medium',
          metric: 'click_through_rate',
          currentValue: Math.round(ctr * 100) / 100,
          expectedRange: `${(expectedCtr * 0.8).toFixed(2)} - ${(expectedCtr * 1.2).toFixed(2)}`,
          description: 'CTR unusually high - monitor for click fraud',
          potentialCauses: ['Exceptional ad performance', 'Click fraud', 'Seasonal demand spike'],
          recommendedActions: ['Monitor for invalid clicks', 'Verify traffic quality', 'Consider scaling successful elements']
        });
      }
    }

    // Check for unusual conversion rates
    if (performance.conversions > 0 && performance.clicks > 0) {
      const conversionRate = (performance.conversions / performance.clicks) * 100;
      const expectedCr = benchmarks.avgConversionRate;

      if (conversionRate < expectedCr * 0.3) {
        anomalies.push({
          type: 'low_conversion_rate',
          severity: 'high',
          metric: 'conversion_rate',
          currentValue: Math.round(conversionRate * 100) / 100,
          expectedRange: `${(expectedCr * 0.7).toFixed(2)} - ${(expectedCr * 1.3).toFixed(2)}`,
          description: 'Conversion rate significantly below expectations',
          potentialCauses: ['Landing page issues', 'Poor traffic quality', 'Misaligned targeting'],
          recommendedActions: ['Audit landing pages', 'Review keyword targeting', 'Analyze user journey']
        });
      }
    }

    return {
      anomaliesDetected: anomalies.length,
      overallHealthStatus: anomalies.length === 0 ? 'healthy' : anomalies.length <= 2 ? 'needs_attention' : 'critical',
      anomalies,
      monitoringRecommendations: this.generateMonitoringRecommendations(anomalies)
    };
  }

  private calculateEnhancedMetrics(performance: any): EnhancedMetrics {
    const ctr = performance.impressions > 0 ? (performance.clicks / performance.impressions) * 100 : 0;
    const cpc = performance.clicks > 0 ? performance.cost / performance.clicks : 0;
    const conversionRate = performance.clicks > 0 ? (performance.conversions / performance.clicks) * 100 : 0;
    const costPerConversion = performance.conversions > 0 ? performance.cost / performance.conversions : 0;
    
    return {
      impressions: performance.impressions || 0,
      clicks: performance.clicks || 0,
      cost: performance.cost || 0,
      conversions: performance.conversions || 0,
      ctr: Math.round(ctr * 100) / 100,
      cpc: Math.round(cpc * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      costPerConversion: Math.round(costPerConversion * 100) / 100,
      roas: 0, // Would need revenue data
      qualityScore: 7, // Would come from actual quality score data
      impressionShare: 0, // Would need impression share data
      searchImpressionShare: 0 // Would need search impression share data
    };
  }

  private calculatePerformanceScore(metrics: EnhancedMetrics, benchmarks: IndustryBenchmarks): PerformanceScore {
    // CTR Score
    const ctrScore = Math.min((metrics.ctr / benchmarks.avgCtr) * 100, 100);
    
    // Conversion Score
    const conversionScore = Math.min((metrics.conversionRate / benchmarks.avgConversionRate) * 100, 100);
    
    // Cost Efficiency Score (inverse of CPC vs benchmark)
    const costEfficiencyScore = benchmarks.avgCpc > 0 ? Math.min((benchmarks.avgCpc / (metrics.cpc || 1)) * 100, 100) : 50;
    
    // Quality Score
    const qualityScore = (metrics.qualityScore / benchmarks.qualityScoreBenchmark) * 100;

    const overall = (ctrScore + conversionScore + costEfficiencyScore + qualityScore) / 4;

    return {
      overall: Math.round(overall),
      efficiency: Math.round((conversionScore + costEfficiencyScore) / 2),
      reach: Math.round(ctrScore),
      quality: Math.round(qualityScore),
      breakdown: {
        ctrScore: Math.round(ctrScore),
        conversionScore: Math.round(conversionScore),
        costEfficiencyScore: Math.round(costEfficiencyScore),
        qualityScore: Math.round(qualityScore)
      }
    };
  }

  private identifyOptimizationOpportunities(
    metrics: EnhancedMetrics, 
    benchmarks: IndustryBenchmarks
  ): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];

    // Low CTR opportunity
    if (metrics.ctr < benchmarks.avgCtr * 0.8) {
      opportunities.push({
        type: 'ctr_optimization',
        priority: 'high',
        impact: 'high',
        effort: 'medium',
        description: 'Click-through rate is below industry benchmark',
        recommendedAction: 'Optimize ad copy and improve ad relevance',
        estimatedImprovement: '15-25% increase in CTR',
        implementationSteps: [
          'A/B test new ad headlines',
          'Improve ad copy relevance to keywords',
          'Add compelling calls-to-action',
          'Use ad extensions to increase ad real estate'
        ]
      });
    }

    // High CPC opportunity
    if (metrics.cpc > benchmarks.avgCpc * 1.3) {
      opportunities.push({
        type: 'cost_optimization',
        priority: 'high',
        impact: 'medium',
        effort: 'low',
        description: 'Cost per click is significantly above benchmark',
        recommendedAction: 'Optimize bidding strategy and improve Quality Score',
        estimatedImprovement: '10-20% reduction in CPC',
        implementationSteps: [
          'Review and optimize keyword match types',
          'Improve landing page relevance',
          'Add negative keywords to filter irrelevant traffic',
          'Adjust bid strategy to Target CPA or ROAS'
        ]
      });
    }

    // Low conversion rate opportunity
    if (metrics.conversionRate < benchmarks.avgConversionRate * 0.7) {
      opportunities.push({
        type: 'conversion_optimization',
        priority: 'critical',
        impact: 'high',
        effort: 'high',
        description: 'Conversion rate is significantly below expectations',
        recommendedAction: 'Audit and optimize the conversion funnel',
        estimatedImprovement: '20-40% increase in conversion rate',
        implementationSteps: [
          'Audit landing page performance',
          'Improve page load speed',
          'Optimize call-to-action buttons',
          'Implement conversion tracking verification',
          'Test different landing page variations'
        ]
      });
    }

    return opportunities;
  }

  private analyzePerformanceTrends(metrics: EnhancedMetrics): TrendAnalysis {
    // Simplified trend analysis - would need historical data for real implementation
    return {
      direction: 'stable',
      strength: 'moderate',
      metrics: {
        ctr: { trend: 'stable', changePercent: 0, significance: 'low' },
        conversionRate: { trend: 'stable', changePercent: 0, significance: 'low' },
        cpc: { trend: 'stable', changePercent: 0, significance: 'low' },
        cost: { trend: 'stable', changePercent: 0, significance: 'low' }
      }
    };
  }

  private generateRecommendations(metrics: EnhancedMetrics, opportunities: OptimizationOpportunity[]): string[] {
    const recommendations: string[] = [];

    // High priority opportunities first
    const highPriorityOps = opportunities.filter(op => op.priority === 'critical' || op.priority === 'high');
    
    highPriorityOps.forEach(op => {
      recommendations.push(op.recommendedAction);
    });

    // General recommendations based on metrics
    if (metrics.impressions < 1000) {
      recommendations.push('Increase budget or expand keyword targeting to improve reach');
    }

    if (metrics.clicks < 100) {
      recommendations.push('Focus on improving ad visibility and click-through rate');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  private calculateGrowthFactor(performance: any): number {
    // Simplified growth calculation - would use historical data and seasonality in production
    const baseGrowth = 1.0;
    
    // Day of week adjustment
    const dayOfWeek = new Date().getDay();
    if ([0, 6].includes(dayOfWeek)) {
      return baseGrowth * 0.8; // Weekend slowdown
    } else if ([1, 2, 3].includes(dayOfWeek)) {
      return baseGrowth * 1.1; // Mid-week boost
    }
    
    return baseGrowth;
  }

  private calculateBudgetRunway(dailySpend: number, totalBudget: number, currentSpend: number): number {
    if (dailySpend <= 0) return Infinity;
    const remainingBudget = totalBudget - currentSpend;
    return Math.floor(remainingBudget / dailySpend);
  }

  private calculateForecastConfidence(performance: any): number {
    // Simple confidence calculation based on data volume
    const clickVolume = Math.min(performance.clicks / 100, 1); // Max confidence at 100+ clicks
    const impressionVolume = Math.min(performance.impressions / 1000, 1); // Max confidence at 1000+ impressions
    
    return (clickVolume + impressionVolume) / 2;
  }

  private generateForecastRecommendations(forecast: ForecastResult): string[] {
    const recommendations: string[] = [];

    if (forecast.budgetUtilization.daysUntilBudgetExhausted < 15) {
      recommendations.push('Consider increasing budget to maintain performance through month-end');
    }

    if (forecast.confidenceLevel < 0.5) {
      recommendations.push('Forecast has low confidence due to limited data - monitor closely');
    }

    return recommendations;
  }

  private generateMonitoringRecommendations(anomalies: AnomalyDetection['anomalies']): string[] {
    const recommendations: string[] = [];

    if (anomalies.some(a => a.severity === 'critical' || a.severity === 'high')) {
      recommendations.push('Set up daily performance monitoring alerts');
      recommendations.push('Review campaign settings and optimization rules');
    }

    if (anomalies.some(a => a.type.includes('ctr'))) {
      recommendations.push('Monitor ad copy performance and quality scores');
    }

    if (anomalies.some(a => a.type.includes('conversion'))) {
      recommendations.push('Set up landing page performance monitoring');
    }

    return recommendations;
  }
}

export const campaignAnalyticsService = new CampaignAnalyticsService();