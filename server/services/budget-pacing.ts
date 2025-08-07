/**
 * Budget Pacing and Monitoring Service
 * Handles budget tracking, pacing algorithms, and spend monitoring for Google Ads campaigns
 */

import { storage } from '../storage';
import { googleAdsService } from './google-ads';
import type { BudgetPacing, EscalationSettings, GoogleAdsAccount } from '@shared/schema';

export enum BudgetStatus {
  ON_TRACK = "on_track",
  UNDERSPENDING = "underspending", 
  OVERSPENDING = "overspending",
  AT_RISK = "at_risk",
  EXHAUSTED = "exhausted"
}

export enum PacingStrategy {
  LINEAR = "linear",
  ACCELERATED = "accelerated", 
  CONSERVATIVE = "conservative",
  ADAPTIVE = "adaptive"
}

export interface BudgetAlert {
  id: string;
  campaignId: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  currentSpend: number;
  budgetLimit: number;
  projectedSpend: number;
  recommendedAction: string;
  timestamp: Date;
}

export interface PacingResult {
  currentSpend: number;
  dailyBudget: number;
  recommendedBudget: number;
  pacingStatus: BudgetStatus;
  daysRemaining: number;
  projectedSpend: number;
  adjustmentFactor: number;
  confidenceScore: number;
}

class BudgetPacingService {
  private monitoringInterval = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  private monitoringTimer: NodeJS.Timeout | null = null;
  private alertCallbacks: Array<(alert: BudgetAlert) => void> = [];
  private pacingHistory: Map<string, PacingResult[]> = new Map();

  // Pacing thresholds
  private thresholds = {
    overspendWarning: 0.95,  // 95% of budget
    overspendCritical: 1.0,   // 100% of budget
    underspendWarning: 0.70,  // 70% of expected spend
    atRiskThreshold: 0.90,   // 90% of budget with time remaining
  };

  // Intelligent pacing parameters
  private pacingParams = {
    // Adjustment factors for different scenarios
    weekendMultiplier: 0.7,      // Reduce spend on weekends
    monthEndAggression: 1.3,     // Increase spend near month end if under-pacing
    seasonalityBuffer: 0.15,     // 15% buffer for seasonal variations
    volatilityThreshold: 0.25,   // Trigger adjustments if 25% off pace
    
    // Learning parameters
    historicalWeight: 0.4,       // Weight of historical performance
    trendWeight: 0.3,           // Weight of recent trend analysis  
    targetWeight: 0.3,          // Weight of target achievement
    
    // Safety parameters
    maxDailyIncrease: 1.5,      // Never increase budget more than 50%
    maxDailyDecrease: 0.7,      // Never decrease budget more than 30%
    emergencyPauseThreshold: 0.95 // Pause at 95% of monthly budget
  };

  async startMonitoring(): Promise<void> {
    if (this.monitoringTimer) {
      return;
    }

    console.log('Starting budget pacing monitoring service');
    this.monitoringTimer = setInterval(() => {
      this.checkAllBudgets().catch(console.error);
    }, this.monitoringInterval);

    // Run initial check
    await this.checkAllBudgets();
  }

  async stopMonitoring(): Promise<void> {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    console.log('Budget pacing monitoring service stopped');
  }

  private async checkAllBudgets(): Promise<void> {
    try {
      // Get all Google Ads accounts
      const accounts = await storage.getAllGoogleAdsAccounts();
      
      for (const account of accounts) {
        await this.checkAccountBudgets(account);
      }

      console.log(`Checked budgets for ${accounts.length} Google Ads accounts`);
    } catch (error) {
      console.error('Error checking campaign budgets:', error);
    }
  }

  private async checkAccountBudgets(account: GoogleAdsAccount): Promise<void> {
    try {
      // Get campaigns for this account
      const campaigns = await googleAdsService.getCampaigns(account.customerId);
      
      for (const campaign of campaigns) {
        await this.checkCampaignBudget(account, campaign.id);
      }
    } catch (error) {
      console.error(`Error checking budgets for account ${account.id}:`, error);
    }
  }

  async checkCampaignBudget(account: GoogleAdsAccount, campaignId: string): Promise<PacingResult> {
    try {
      // Get performance metrics for analysis
      const currentMetrics = await googleAdsService.getPerformanceMetrics(
        account.customerId, 
        campaignId, 
        'THIS_MONTH'
      );

      const historicalMetrics = await googleAdsService.getPerformanceMetrics(
        account.customerId, 
        campaignId, 
        'LAST_30_DAYS'
      );

      // Get campaign details for budget information
      const campaigns = await googleAdsService.getCampaigns(account.customerId);
      const campaign = campaigns.find(c => c.id === campaignId);
      
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const monthlyBudget = parseFloat(campaign.budget) || 3000; // Default fallback
      const currentSpend = currentMetrics.cost;
      
      // Calculate time factors
      const daysRemaining = this.calculateDaysRemainingInMonth();
      const daysElapsed = this.getDaysElapsedInMonth();
      const totalDaysInMonth = daysElapsed + daysRemaining;
      
      // Calculate intelligent pacing
      const pacingAnalysis = this.calculateIntelligentPacing({
        currentSpend,
        monthlyBudget,
        daysElapsed,
        daysRemaining,
        totalDaysInMonth,
        currentMetrics,
        historicalMetrics,
        campaign
      });

      const result: PacingResult = {
        currentSpend,
        dailyBudget: monthlyBudget / totalDaysInMonth,
        recommendedBudget: pacingAnalysis.recommendedDailyBudget,
        pacingStatus: pacingAnalysis.status,
        daysRemaining,
        projectedSpend: pacingAnalysis.projectedSpend,
        adjustmentFactor: pacingAnalysis.adjustmentFactor,
        confidenceScore: pacingAnalysis.confidenceScore
      };

      // Check for alerts
      const alerts = this.checkBudgetAlerts(account, campaignId, result, monthlyBudget);

      // Process alerts
      for (const alert of alerts) {
        await this.processAlert(alert);
      }

      // Store in history
      this.updatePacingHistory(campaignId, result);

      // Save budget pacing record
      await storage.createBudgetPacing({
        googleAdsAccountId: account.id,
        campaignId,
        date: new Date(),
        currentSpend: result.currentSpend,
        projectedSpend: result.projectedSpend,
        pacingStatus: result.pacingStatus,
        adjustmentFactor: result.adjustmentFactor,
        recommendedBudget: result.recommendedBudget
      });

      return result;
    } catch (error) {
      console.error(`Error checking budget for campaign ${campaignId}:`, error);
      throw error;
    }
  }

  // Intelligent budget pacing calculation with machine learning approach
  private calculateIntelligentPacing(params: {
    currentSpend: number;
    monthlyBudget: number;
    daysElapsed: number;
    daysRemaining: number;
    totalDaysInMonth: number;
    currentMetrics: any;
    historicalMetrics: any;
    campaign: any;
  }) {
    const {
      currentSpend,
      monthlyBudget,
      daysElapsed,
      daysRemaining,
      totalDaysInMonth,
      currentMetrics,
      historicalMetrics
    } = params;

    // Calculate basic pacing metrics
    const expectedSpendRatio = daysElapsed / totalDaysInMonth;
    const expectedSpend = monthlyBudget * expectedSpendRatio;
    const actualSpendRatio = currentSpend / monthlyBudget;
    const dailySpendRate = currentSpend / Math.max(daysElapsed, 1);
    
    // Project spend based on current rate
    const linearProjectedSpend = currentSpend + (dailySpendRate * daysRemaining);
    
    // Calculate variance from expected pace
    const spendVariance = (currentSpend - expectedSpend) / expectedSpend;
    
    // Apply intelligent adjustments
    let adjustmentFactor = 1.0;
    let confidenceScore = 0.8;
    
    // Weekend adjustment (reduce spend on weekends)
    const isWeekend = this.isWeekend();
    if (isWeekend) {
      adjustmentFactor *= this.pacingParams.weekendMultiplier;
    }
    
    // Month-end acceleration (if under-spending near month end)
    const monthProgressRatio = daysElapsed / totalDaysInMonth;
    if (monthProgressRatio > 0.75 && spendVariance < -0.1) {
      adjustmentFactor *= this.pacingParams.monthEndAggression;
      confidenceScore -= 0.1; // Lower confidence for aggressive adjustments
    }
    
    // Historical performance weighting
    if (historicalMetrics && historicalMetrics.cost > 0) {
      const historicalDailyRate = historicalMetrics.cost / 30; // Assume 30-day historical
      const currentDailyRate = dailySpendRate;
      const performanceRatio = currentDailyRate / historicalDailyRate;
      
      // Adjust based on performance trend
      if (performanceRatio > 1.2) {
        adjustmentFactor *= 0.9; // Slow down if spending faster than historical
      } else if (performanceRatio < 0.8) {
        adjustmentFactor *= 1.1; // Speed up if spending slower than historical
      }
      
      confidenceScore += 0.1; // Higher confidence with historical data
    }
    
    // Calculate recommended daily budget
    const remainingBudget = Math.max(0, monthlyBudget - currentSpend);
    const baseDailyRecommendation = remainingBudget / Math.max(daysRemaining, 1);
    const adjustedDailyRecommendation = baseDailyRecommendation * adjustmentFactor;
    
    // Apply safety constraints
    const currentDailyBudget = monthlyBudget / totalDaysInMonth;
    const constrainedRecommendation = Math.min(
      Math.max(
        adjustedDailyRecommendation,
        currentDailyBudget * this.pacingParams.maxDailyDecrease
      ),
      currentDailyBudget * this.pacingParams.maxDailyIncrease
    );
    
    // Determine pacing status
    let status = BudgetStatus.ON_TRACK;
    if (currentSpend >= monthlyBudget * this.pacingParams.emergencyPauseThreshold) {
      status = BudgetStatus.EXHAUSTED;
    } else if (spendVariance > this.pacingParams.volatilityThreshold) {
      status = BudgetStatus.OVERSPENDING;
    } else if (spendVariance < -this.pacingParams.volatilityThreshold) {
      status = BudgetStatus.UNDERSPENDING;
    } else if (linearProjectedSpend > monthlyBudget * 0.95) {
      status = BudgetStatus.AT_RISK;
    }
    
    return {
      recommendedDailyBudget: constrainedRecommendation,
      projectedSpend: linearProjectedSpend,
      adjustmentFactor: constrainedRecommendation / currentDailyBudget,
      confidenceScore: Math.min(confidenceScore, 1.0),
      status,
      spendVariance,
      expectedSpend
    };
  }

  private calculatePacing(
    currentSpend: number,
    totalBudget: number,
    daysElapsed: number,
    daysRemaining: number,
    strategy: PacingStrategy
  ): PacingResult {
    if (daysElapsed === 0) daysElapsed = 1;

    const totalDays = daysElapsed + daysRemaining;
    const expectedSpendRatio = daysElapsed / totalDays;
    const actualSpendRatio = totalBudget > 0 ? currentSpend / totalBudget : 0;

    let dailyBudget: number;
    let recommendedBudget: number;

    // Calculate daily budget based on strategy
    switch (strategy) {
      case PacingStrategy.LINEAR:
        dailyBudget = totalBudget / totalDays;
        recommendedBudget = (totalBudget - currentSpend) / Math.max(daysRemaining, 1);
        break;

      case PacingStrategy.ACCELERATED:
        // Front-load spending
        dailyBudget = (totalBudget / totalDays) * 1.2;
        recommendedBudget = ((totalBudget - currentSpend) / Math.max(daysRemaining, 1)) * 0.8;
        break;

      case PacingStrategy.CONSERVATIVE:
        // Back-load spending
        dailyBudget = (totalBudget / totalDays) * 0.8;
        recommendedBudget = ((totalBudget - currentSpend) / Math.max(daysRemaining, 1)) * 1.2;
        break;

      case PacingStrategy.ADAPTIVE:
        // Use ML-based adjustment
        const adjustment = this.calculateMlAdjustment(currentSpend, totalBudget, daysElapsed, daysRemaining);
        dailyBudget = totalBudget / totalDays;
        recommendedBudget = dailyBudget * adjustment;
        break;

      default:
        dailyBudget = totalBudget / totalDays;
        recommendedBudget = (totalBudget - currentSpend) / Math.max(daysRemaining, 1);
    }

    // Calculate projected spend
    const projectedSpend = currentSpend + (recommendedBudget * daysRemaining);

    // Determine pacing status
    const status = this.determinePacingStatus(
      actualSpendRatio,
      expectedSpendRatio,
      projectedSpend,
      totalBudget
    );

    // Calculate confidence score
    const confidence = this.calculateConfidenceScore(
      daysElapsed,
      totalDays,
      currentSpend,
      totalBudget
    );

    return {
      currentSpend,
      dailyBudget,
      recommendedBudget,
      pacingStatus: status,
      daysRemaining,
      projectedSpend,
      adjustmentFactor: dailyBudget > 0 ? recommendedBudget / dailyBudget : 1.0,
      confidenceScore: confidence
    };
  }

  private calculateMlAdjustment(
    currentSpend: number,
    totalBudget: number,
    daysElapsed: number,
    daysRemaining: number
  ): number {
    // Simplified ML adjustment - in production, this would use actual ML models
    
    // Base adjustment on spend velocity
    let velocityFactor = 1.0;
    if (daysElapsed > 0) {
      const dailyVelocity = currentSpend / daysElapsed;
      const expectedDaily = totalBudget / (daysElapsed + daysRemaining);
      velocityFactor = dailyVelocity > 0 ? expectedDaily / dailyVelocity : 1.0;
    }

    // Seasonality adjustment (simplified)
    const dayOfWeek = new Date().getDay();
    let seasonalityFactor = 1.0;
    if ([0, 6].includes(dayOfWeek)) { // Weekend
      seasonalityFactor = 0.8;
    } else if ([1, 2, 3].includes(dayOfWeek)) { // Mid-week
      seasonalityFactor = 1.1;
    }

    // Combine factors with intelligent weighting
    const adjustment = 
      velocityFactor * (1 - this.pacingParams.seasonalityBuffer) +
      seasonalityFactor * this.pacingParams.seasonalityBuffer;

    // Clamp adjustment to reasonable range
    return Math.max(0.5, Math.min(2.0, adjustment));
  }

  private isWeekend(): boolean {
    const today = new Date();
    const dayOfWeek = today.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
  }

  private determinePacingStatus(
    actualRatio: number,
    expectedRatio: number,
    projectedSpend: number,
    totalBudget: number
  ): BudgetStatus {
    if (actualRatio >= 1.0) {
      return BudgetStatus.EXHAUSTED;
    }

    if (projectedSpend > totalBudget * this.thresholds.overspendCritical) {
      return BudgetStatus.OVERSPENDING;
    }

    if (projectedSpend > totalBudget * this.thresholds.overspendWarning) {
      return BudgetStatus.AT_RISK;
    }

    if (actualRatio < expectedRatio * this.thresholds.underspendWarning) {
      return BudgetStatus.UNDERSPENDING;
    }

    return BudgetStatus.ON_TRACK;
  }

  private calculateConfidenceScore(
    daysElapsed: number,
    totalDays: number,
    currentSpend: number,
    totalBudget: number
  ): number {
    // More data = higher confidence
    const dataConfidence = Math.min(daysElapsed / 7, 1.0); // Full confidence after 7 days

    // Consistent spending = higher confidence
    let consistency = 0.5;
    if (daysElapsed > 0) {
      const dailyAvg = currentSpend / daysElapsed;
      const expectedDaily = totalBudget / totalDays;
      if (expectedDaily > 0) {
        consistency = 1.0 - Math.abs(dailyAvg - expectedDaily) / expectedDaily;
        consistency = Math.max(0, Math.min(1, consistency));
      }
    }

    // Combine factors
    return dataConfidence * 0.7 + consistency * 0.3;
  }

  private checkBudgetAlerts(
    account: GoogleAdsAccount,
    campaignId: string,
    pacingResult: PacingResult,
    budgetLimit: number
  ): BudgetAlert[] {
    const alerts: BudgetAlert[] = [];

    // Overspend alerts
    if (pacingResult.pacingStatus === BudgetStatus.EXHAUSTED) {
      alerts.push({
        id: `${campaignId}_exhausted_${Date.now()}`,
        campaignId,
        alertType: "budget_exhausted",
        severity: "critical",
        message: `Campaign has exhausted its budget`,
        currentSpend: pacingResult.currentSpend,
        budgetLimit,
        projectedSpend: pacingResult.projectedSpend,
        recommendedAction: "Pause campaign or increase budget immediately",
        timestamp: new Date()
      });
    } else if (pacingResult.pacingStatus === BudgetStatus.OVERSPENDING) {
      alerts.push({
        id: `${campaignId}_overspend_${Date.now()}`,
        campaignId,
        alertType: "overspending",
        severity: "high",
        message: `Campaign is overspending`,
        currentSpend: pacingResult.currentSpend,
        budgetLimit,
        projectedSpend: pacingResult.projectedSpend,
        recommendedAction: "Reduce daily budget or pause low-performing keywords",
        timestamp: new Date()
      });
    }

    return alerts;
  }

  private async processAlert(alert: BudgetAlert): Promise<void> {
    try {
      // Log the alert
      console.log(`Budget Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);

      // Check escalation settings
      const escalationSettings = await storage.getEscalationSettingsByCampaign(alert.campaignId);
      
      for (const setting of escalationSettings) {
        if (setting.enabled && setting.type === 'budget_pacing') {
          await this.triggerEscalation(alert, setting);
        }
      }

      // Notify callbacks
      this.alertCallbacks.forEach(callback => callback(alert));
    } catch (error) {
      console.error('Error processing budget alert:', error);
    }
  }

  private async triggerEscalation(alert: BudgetAlert, setting: EscalationSettings): Promise<void> {
    // Check if threshold is met
    const thresholdMet = this.checkAlertThreshold(alert, setting);
    
    if (!thresholdMet) return;

    // Process notification methods
    const notificationMethods = setting.notificationMethods as any;
    
    if (notificationMethods?.email) {
      await this.sendEmailAlert(alert, setting);
    }
    
    if (notificationMethods?.sms) {
      await this.sendSmsAlert(alert, setting);
    }
    
    if (notificationMethods?.slack) {
      await this.sendSlackAlert(alert, setting);
    }
  }

  private checkAlertThreshold(alert: BudgetAlert, setting: EscalationSettings): boolean {
    const threshold = Number(setting.threshold) || 0;
    const spendPercentage = (alert.currentSpend / alert.budgetLimit) * 100;
    
    return spendPercentage >= threshold;
  }

  private async sendEmailAlert(alert: BudgetAlert, setting: EscalationSettings): Promise<void> {
    // Email notification implementation
    console.log(`EMAIL ALERT: ${alert.message} for campaign ${alert.campaignId}`);
  }

  private async sendSmsAlert(alert: BudgetAlert, setting: EscalationSettings): Promise<void> {
    // SMS notification implementation
    console.log(`SMS ALERT: ${alert.message} for campaign ${alert.campaignId}`);
  }

  private async sendSlackAlert(alert: BudgetAlert, setting: EscalationSettings): Promise<void> {
    // Slack notification implementation
    console.log(`SLACK ALERT: ${alert.message} for campaign ${alert.campaignId}`);
  }

  private updatePacingHistory(campaignId: string, result: PacingResult): void {
    if (!this.pacingHistory.has(campaignId)) {
      this.pacingHistory.set(campaignId, []);
    }
    
    const history = this.pacingHistory.get(campaignId)!;
    history.push(result);
    
    // Keep only last 30 entries
    if (history.length > 30) {
      history.shift();
    }
  }

  private calculateDaysRemainingInMonth(): number {
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDayOfMonth.getDate() - now.getDate();
  }

  private getDaysElapsedInMonth(): number {
    const now = new Date();
    return now.getDate();
  }

  // Public methods for external use
  async getBudgetStatus(accountId: string, campaignId?: string): Promise<PacingResult[]> {
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) throw new Error('Account not found');

    if (campaignId) {
      const result = await this.checkCampaignBudget(account, campaignId);
      return [result];
    }

    // Get all campaigns for the account
    const campaigns = await googleAdsService.getCampaigns(account.customerId);
    const results: PacingResult[] = [];

    for (const campaign of campaigns) {
      const result = await this.checkCampaignBudget(account, campaign.id);
      results.push(result);
    }

    return results;
  }

  addAlertCallback(callback: (alert: BudgetAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  removeAlertCallback(callback: (alert: BudgetAlert) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }
}

export const budgetPacingService = new BudgetPacingService();