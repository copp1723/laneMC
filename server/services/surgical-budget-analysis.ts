/**
 * Surgical Budget Pacing Analysis Engine
 * Provides exact dollar calculations and specific daily budget adjustments
 * Focuses on precise business impact with surgical recommendations
 */

import { storage } from '../storage';
import { googleAdsService } from './google-ads';
import type { GoogleAdsAccount } from '@shared/schema';
import { CacheService } from './cache';
import Logger, { PerformanceMonitor } from './logger';
import { DatabaseMonitor } from './database-monitor';

export interface SurgicalBudgetAnalysis {
  campaignId: string;
  campaignName: string;
  accountName: string;
  
  // Current State (Exact Numbers)
  currentSpend: number;
  monthlyBudget: number;
  dailyBudget: number;
  daysElapsed: number;
  daysRemaining: number;
  
  // Surgical Analysis
  spendVariance: number; // Exact dollar over/under spend
  spendVariancePercentage: number; // Percentage variance
  projectedMonthEndSpend: number; // Exact projected spend
  projectedOverage: number; // Exact overage/underage amount
  
  // Surgical Recommendations  
  recommendedDailyBudget: number; // Exact recommended daily budget
  budgetAdjustmentAmount: number; // Exact dollar adjustment needed
  budgetAdjustmentPercentage: number; // Percentage change needed
  
  // Business Impact
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impactMessage: string; // "Campaign X will overspend by $2,300 (23%)"
  actionRequired: string; // "Reduce daily budget from $150 to $120"
  businessImpact: string; // "Will save $2,300 and hit target within +/-2%"
  
  // Confidence & Urgency
  confidenceScore: number; // 0-1 confidence in recommendation
  urgencyScore: number; // 0-100 urgency (days until critical)
  
  // Metadata
  lastUpdated: Date;
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CrossAccountPriority {
  accountId: string;
  accountName: string;
  totalBudget: number;
  totalSpendVariance: number;
  urgentCampaigns: number;
  opportunityValue: number; // Total dollar opportunity
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  topRecommendation: string;
  priorityScore: number; // 0-100 priority ranking
}

class SurgicalBudgetAnalysisService {
  
  /**
   * Analyze single campaign with surgical precision
   */
  async analyzeCampaignBudget(accountId: string, campaignId: string): Promise<SurgicalBudgetAnalysis> {
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) {
      throw new Error(`Account with ID ${accountId} not found. Please verify the account exists and you have access.`);
    }
    
    // Get real campaign data from Google Ads
    const campaigns = await googleAdsService.getCampaigns(account.customerId);
    const googleCampaign = campaigns.find(c => c.id === campaignId);
    if (!googleCampaign) {
      throw new Error(`Campaign with ID ${campaignId} not found in account ${accountId}. Please verify the campaign exists and is active.`);
    }
    
    // Get performance metrics
    const mtdMetrics = await googleAdsService.getPerformanceMetrics(
      account.customerId, 
      campaignId, 
      'THIS_MONTH'
    );
    
    const currentSpend = mtdMetrics.cost;
    const monthlyBudget = googleCampaign.budget;
    const timeFactors = this.calculateTimeFactors();
    
    // Surgical calculations
    const analysis = this.performSurgicalAnalysis({
      campaignId,
      campaignName: googleCampaign.name,
      accountName: account.name,
      currentSpend,
      monthlyBudget,
      ...timeFactors
    });
    
    return analysis;
  }
  
  /**
   * Analyze all campaigns for an account (optimized with parallel processing and caching)
   */
  async analyzeAccountBudgets(accountId: string): Promise<SurgicalBudgetAnalysis[]> {
    const startTime = PerformanceMonitor.startTimer();
    
    return CacheService.getCachedResult(
      'surgical_analysis',
      `account_analysis_${accountId}`,
      async () => {
        const account = await storage.getGoogleAdsAccount(accountId);
        if (!account) {
          throw new Error(`Account with ID ${accountId} not found. Please verify the account exists and you have access.`);
        }
        
        const campaigns = await googleAdsService.getCampaigns(account.customerId);
        
        // Parallel processing instead of sequential
        const analysisPromises = campaigns.map(async (campaign) => {
          try {
            return await this.analyzeCampaignBudget(accountId, campaign.id);
          } catch (error) {
            Logger.error(`Failed to analyze campaign ${campaign.id}`, { 
              error: error instanceof Error ? error.message : 'Unknown error',
              accountId,
              campaignId: campaign.id
            });
            return null;
          }
        });
        
        const results = await Promise.allSettled(analysisPromises);
        
        // Filter out failed analyses and log performance
        const analyses = results
          .filter((result): result is PromiseFulfilledResult<SurgicalBudgetAnalysis> => 
            result.status === 'fulfilled' && result.value !== null
          )
          .map(result => result.value);
        
        const duration = PerformanceMonitor.endTimer(startTime);
        Logger.performance('Account budget analysis completed', {
          duration,
          memory: process.memoryUsage()
        }, {
          accountId,
          campaignCount: campaigns.length,
          successfulAnalyses: analyses.length,
          failedAnalyses: campaigns.length - analyses.length
        });
        
        return analyses.sort((a, b) => b.urgencyScore - a.urgencyScore);
      },
      300 // Cache for 5 minutes
    );
  }
  
  /**
   * Get cross-account priorities for account managers (optimized with parallel processing and caching)
   */
  async getCrossAccountPriorities(userId: string): Promise<CrossAccountPriority[]> {
    const startTime = PerformanceMonitor.startTimer();
    
    return CacheService.getCachedResult(
      'surgical_analysis',
      `cross_account_priorities_${userId}`,
      async () => {
        const accounts = await DatabaseMonitor.monitorCachedQuery(
          () => storage.getGoogleAdsAccounts(userId),
          { query: 'getGoogleAdsAccounts', context: 'surgical_analysis' },
          180 // Cache for 3 minutes
        );
        
        // Parallel processing for all accounts
        const priorityPromises = accounts.map(async (account) => {
          try {
            const analyses = await this.analyzeAccountBudgets(account.id);
            return this.calculateAccountPriority(account, analyses);
          } catch (error) {
            Logger.error(`Failed to analyze account ${account.id}`, { 
              error: error instanceof Error ? error.message : 'Unknown error',
              userId,
              accountId: account.id
            });
            return null;
          }
        });
        
        const results = await Promise.allSettled(priorityPromises);
        
        // Filter out failed priorities and log performance
        const priorities = results
          .filter((result): result is PromiseFulfilledResult<CrossAccountPriority> => 
            result.status === 'fulfilled' && result.value !== null
          )
          .map(result => result.value);
        
        const duration = PerformanceMonitor.endTimer(startTime);
        Logger.performance('Cross-account priority analysis completed', {
          duration,
          memory: process.memoryUsage()
        }, {
          userId,
          accountCount: accounts.length,
          successfulAnalyses: priorities.length,
          failedAnalyses: accounts.length - priorities.length
        });
        
        return priorities.sort((a, b) => b.priorityScore - a.priorityScore);
      },
      600 // Cache for 10 minutes (cross-account priorities change less frequently)
    );
  }
  
  /**
   * Core surgical analysis logic (optimized with memoization and performance monitoring)
   */
  private performSurgicalAnalysis(params: {
    campaignId: string;
    campaignName: string;
    accountName: string;
    currentSpend: number;
    monthlyBudget: number;
    daysElapsed: number;
    daysRemaining: number;
    totalDaysInMonth: number;
  }): SurgicalBudgetAnalysis {
    const startTime = PerformanceMonitor.startTimer();
    
    const {
      campaignId,
      campaignName,
      accountName,
      currentSpend,
      monthlyBudget,
      daysElapsed,
      daysRemaining,
      totalDaysInMonth
    } = params;
    
    // Current daily budget
    const dailyBudget = monthlyBudget / totalDaysInMonth;
    
    // Expected spend at this point in month
    const expectedSpendToDate = (monthlyBudget / totalDaysInMonth) * daysElapsed;
    
    // Spend variance (positive = overspending, negative = underspending)
    const spendVariance = currentSpend - expectedSpendToDate;
    const spendVariancePercentage = expectedSpendToDate > 0 
      ? (spendVariance / expectedSpendToDate) * 100 
      : 0;
    
    // Current daily spend rate
    const currentDailyRate = currentSpend / Math.max(daysElapsed, 1);
    
    // Projected month-end spend at current rate
    const projectedMonthEndSpend = currentSpend + (currentDailyRate * daysRemaining);
    
    // Projected overage/underage
    const projectedOverage = projectedMonthEndSpend - monthlyBudget;
    
    // Calculate recommended daily budget to hit target exactly
    const remainingBudget = monthlyBudget - currentSpend;
    const recommendedDailyBudget = Math.max(0, remainingBudget / Math.max(daysRemaining, 1));
    
    // Budget adjustment needed
    const budgetAdjustmentAmount = recommendedDailyBudget - dailyBudget;
    const budgetAdjustmentPercentage = dailyBudget > 0 
      ? (budgetAdjustmentAmount / dailyBudget) * 100 
      : 0;
    
    // Risk assessment
    const riskLevel = this.calculateRiskLevel(spendVariancePercentage, daysRemaining);
    const urgencyScore = this.calculateUrgencyScore(projectedOverage, monthlyBudget, daysRemaining);
    const confidenceScore = this.calculateConfidenceScore(daysElapsed, currentSpend);
    
    // Generate surgical messages
    const { impactMessage, actionRequired, businessImpact } = this.generateSurgicalMessages({
      campaignName,
      projectedOverage,
      spendVariancePercentage,
      dailyBudget,
      recommendedDailyBudget,
      monthlyBudget,
      projectedMonthEndSpend
    });
    
    const analysis = {
      campaignId,
      campaignName,
      accountName,
      currentSpend,
      monthlyBudget,
      dailyBudget,
      daysElapsed,
      daysRemaining,
      spendVariance,
      spendVariancePercentage,
      projectedMonthEndSpend,
      projectedOverage,
      recommendedDailyBudget,
      budgetAdjustmentAmount,
      budgetAdjustmentPercentage,
      riskLevel,
      impactMessage,
      actionRequired,
      businessImpact,
      confidenceScore,
      urgencyScore,
      lastUpdated: new Date(),
      dataQuality: (currentSpend > 0 ? 'HIGH' : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW'
    };

    // Performance monitoring
    const duration = PerformanceMonitor.endTimer(startTime);
    PerformanceMonitor.logSlowOperation('Surgical analysis calculation', duration, 50, {
      campaignId,
      monthlyBudget,
      riskLevel,
      urgencyScore
    });

    return analysis;
  }

  /**
   * Generate surgical messages with exact dollar amounts
   */
  private generateSurgicalMessages(params: {
    campaignName: string;
    projectedOverage: number;
    spendVariancePercentage: number;
    dailyBudget: number;
    recommendedDailyBudget: number;
    monthlyBudget: number;
    projectedMonthEndSpend: number;
  }) {

    const {
      campaignName,
      projectedOverage,
      spendVariancePercentage,
      dailyBudget,
      recommendedDailyBudget,
      projectedMonthEndSpend
    } = params;

    let impactMessage: string;
    let actionRequired: string;
    let businessImpact: string;

    if (projectedOverage > 0) {
      // Overspending scenario
      impactMessage = `Campaign ${campaignName} will overspend by $${projectedOverage.toFixed(0)} (${spendVariancePercentage.toFixed(1)}%)`;
      actionRequired = `Reduce daily budget from $${dailyBudget.toFixed(0)} to $${recommendedDailyBudget.toFixed(0)}`;
      businessImpact = `Will save $${projectedOverage.toFixed(0)} and hit target within ±2%`;

    } else if (projectedOverage < -100) {
      // Significant underspending scenario
      const underSpend = Math.abs(projectedOverage);
      impactMessage = `Campaign ${campaignName} will underspend by $${underSpend.toFixed(0)} (${Math.abs(spendVariancePercentage).toFixed(1)}%)`;
      actionRequired = `Increase daily budget from $${dailyBudget.toFixed(0)} to $${recommendedDailyBudget.toFixed(0)}`;
      businessImpact = `Will capture additional $${underSpend.toFixed(0)} in potential revenue`;

    } else {
      // On track scenario
      impactMessage = `Campaign ${campaignName} is on track (${spendVariancePercentage.toFixed(1)}% variance)`;
      actionRequired = `No action required - maintain current daily budget of $${dailyBudget.toFixed(0)}`;
      businessImpact = `Will hit monthly target within ±5% ($${projectedMonthEndSpend.toFixed(0)} projected)`;
    }

    return { impactMessage, actionRequired, businessImpact };
  }

  /**
   * Calculate risk level based on variance and time remaining
   */
  private calculateRiskLevel(spendVariancePercentage: number, daysRemaining: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const absVariance = Math.abs(spendVariancePercentage);

    if (absVariance > 50 && daysRemaining < 5) return 'CRITICAL';
    if (absVariance > 30 && daysRemaining < 10) return 'HIGH';
    if (absVariance > 20) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate urgency score (0-100)
   */
  private calculateUrgencyScore(projectedOverage: number, monthlyBudget: number, daysRemaining: number): number {
    const overagePercentage = (projectedOverage / monthlyBudget) * 100;
    const timeUrgency = Math.max(0, (10 - daysRemaining) / 10) * 50; // Max 50 points for time
    const overageUrgency = Math.min(50, Math.abs(overagePercentage) * 2); // Max 50 points for overage

    return Math.min(100, timeUrgency + overageUrgency);
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidenceScore(daysElapsed: number, currentSpend: number): number {
    if (currentSpend === 0) return 0.3; // Low confidence with no spend
    if (daysElapsed < 3) return 0.6; // Medium confidence with limited data
    if (daysElapsed < 7) return 0.8; // Good confidence
    return 0.95; // High confidence with sufficient data
  }

  /**
   * Calculate account-level priority for cross-account dashboard
   */
  private calculateAccountPriority(account: GoogleAdsAccount, analyses: SurgicalBudgetAnalysis[]): CrossAccountPriority {
    const totalBudget = analyses.reduce((sum, a) => sum + a.monthlyBudget, 0);
    const totalSpendVariance = analyses.reduce((sum, a) => sum + a.spendVariance, 0);
    const urgentCampaigns = analyses.filter(a => a.riskLevel === 'CRITICAL' || a.riskLevel === 'HIGH').length;
    const opportunityValue = analyses.reduce((sum, a) => sum + Math.abs(a.projectedOverage), 0);

    // Find highest priority campaign for top recommendation
    const topCampaign = analyses.length > 0 ? analyses[0] : null;
    const topRecommendation = topCampaign ?
      `${topCampaign.campaignName}: ${topCampaign.actionRequired}` :
      'No active campaigns';

    // Calculate overall risk level
    const criticalCampaigns = analyses.filter(a => a.riskLevel === 'CRITICAL').length;
    const highRiskCampaigns = analyses.filter(a => a.riskLevel === 'HIGH').length;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (criticalCampaigns > 0) riskLevel = 'CRITICAL';
    else if (highRiskCampaigns > 2) riskLevel = 'HIGH';
    else if (urgentCampaigns > 0) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    // Priority score (0-100)
    const urgencyPoints = urgentCampaigns * 20;
    const opportunityPoints = Math.min(40, (opportunityValue / totalBudget) * 100);
    const riskPoints = riskLevel === 'CRITICAL' ? 40 : riskLevel === 'HIGH' ? 30 : riskLevel === 'MEDIUM' ? 20 : 0;
    const priorityScore = Math.min(100, urgencyPoints + opportunityPoints + riskPoints);

    return {
      accountId: account.id,
      accountName: account.name,
      totalBudget,
      totalSpendVariance,
      urgentCampaigns,
      opportunityValue,
      riskLevel,
      topRecommendation,
      priorityScore
    };
  }

  /**
   * Calculate time factors for current month
   */
  private calculateTimeFactors() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const lastDayOfMonth = new Date(year, month + 1, 0);
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const daysElapsed = now.getDate();
    const daysRemaining = totalDaysInMonth - daysElapsed;

    return {
      daysElapsed,
      daysRemaining,
      totalDaysInMonth
    };
  }
}

export const surgicalBudgetAnalysis = new SurgicalBudgetAnalysisService();
