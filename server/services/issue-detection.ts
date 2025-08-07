import { storage } from "../storage";
import { googleAdsService } from "./google-ads";
import { budgetPacingService } from "./budget-pacing";
import type { GoogleAdsAccount, PerformanceMetrics } from "@shared/schema";

export interface DetectedIssue {
  id: string;
  accountId: string;
  campaignId: string;
  type: IssueType;
  severity: IssueSeverity;
  title: string;
  description: string;
  recommendations: string[];
  confidenceScore: number; // 0-100
  detectedAt: Date;
  affectedMetrics: string[];
  historicalContext?: {
    previousValue: number;
    currentValue: number;
    changePercentage: number;
    timeframe: string;
  };
}

export type IssueType = 
  | 'performance_drop'
  | 'budget_overspend' 
  | 'quality_score_drop'
  | 'disapproval'
  | 'bid_strategy_underperform'
  | 'keyword_anomaly'
  | 'conversion_drop'
  | 'cost_spike';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

interface PerformanceAnomaly {
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  severity: IssueSeverity;
}

class IssueDetectionService {
  private detectionHistory: Map<string, DetectedIssue[]> = new Map();
  private alertCallbacks: ((issue: DetectedIssue) => void)[] = [];

  // Core detection thresholds - configurable per account
  private readonly DEFAULT_THRESHOLDS = {
    ctr_drop_percentage: 25,        // 25% CTR drop triggers alert
    conversion_drop_percentage: 30,  // 30% conversion drop  
    cost_spike_percentage: 40,       // 40% cost increase
    quality_score_threshold: 5,      // Below 5 quality score
    budget_overspend_percentage: 10, // 10% over budget
    confidence_minimum: 60           // Minimum confidence to alert
  };

  async detectAllIssues(accountId: string): Promise<DetectedIssue[]> {
    try {
      const account = await storage.getGoogleAdsAccount(accountId);
      if (!account) throw new Error('Account not found');

      const allIssues: DetectedIssue[] = [];

      // Get campaigns for this account
      const campaigns = await googleAdsService.getCampaigns(account.customerId);

      for (const campaign of campaigns) {
        // 1. Performance anomaly detection
        const performanceIssues = await this.detectPerformanceAnomalies(account, campaign.id);
        allIssues.push(...performanceIssues);

        // 2. Budget pacing issues (leverage Priority 1 system)
        const budgetIssues = await this.detectBudgetIssues(account, campaign.id);
        allIssues.push(...budgetIssues);

        // 3. Quality score issues
        const qualityIssues = await this.detectQualityScoreIssues(account, campaign.id);
        allIssues.push(...qualityIssues);

        // 4. Disapproval detection
        const disapprovalIssues = await this.detectDisapprovals(account, campaign.id);
        allIssues.push(...disapprovalIssues);
      }

      // Filter by confidence and deduplicate
      const validIssues = this.filterAndPrioritizeIssues(allIssues);
      
      // Store detection history
      this.updateDetectionHistory(accountId, validIssues);

      // Trigger alerts for new critical issues
      await this.processNewAlerts(accountId, validIssues);

      return validIssues;

    } catch (error) {
      console.error(`Issue detection failed for account ${accountId}:`, error);
      return [];
    }
  }

  private async detectPerformanceAnomalies(
    account: GoogleAdsAccount,
    campaignId: string
  ): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];

    try {
      // Get current performance metrics
      const currentMetrics = await googleAdsService.getPerformanceMetrics(
        account.customerId,
        campaignId,
        'LAST_7_DAYS'
      );

      // Get historical baseline (last 30 days for comparison)
      const historicalMetrics = await googleAdsService.getPerformanceMetrics(
        account.customerId,
        campaignId,
        'LAST_30_DAYS'
      );

      // Analyze key performance indicators
      const anomalies = this.analyzePerformanceMetrics(currentMetrics, historicalMetrics);

      for (const anomaly of anomalies) {
        const issue: DetectedIssue = {
          id: `${campaignId}-${anomaly.metric}-${Date.now()}`,
          accountId: account.id,
          campaignId,
          type: this.mapMetricToIssueType(anomaly.metric),
          severity: anomaly.severity,
          title: this.generateIssueTitle(anomaly),
          description: this.generateIssueDescription(anomaly),
          recommendations: this.generateRecommendations(anomaly),
          confidenceScore: this.calculateConfidenceScore(anomaly),
          detectedAt: new Date(),
          affectedMetrics: [anomaly.metric],
          historicalContext: {
            previousValue: anomaly.expectedValue,
            currentValue: anomaly.currentValue,
            changePercentage: anomaly.deviation,
            timeframe: 'last_7_days'
          }
        };

        issues.push(issue);
      }

    } catch (error) {
      console.error(`Performance anomaly detection failed for campaign ${campaignId}:`, error);
    }

    return issues;
  }

  private analyzePerformanceMetrics(
    current: any,
    historical: any
  ): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];

    // CTR Analysis
    const ctrChange = this.calculatePercentageChange(historical.ctr, current.ctr);
    if (Math.abs(ctrChange) > this.DEFAULT_THRESHOLDS.ctr_drop_percentage) {
      anomalies.push({
        metric: 'ctr',
        currentValue: current.ctr,
        expectedValue: historical.ctr,
        deviation: ctrChange,
        severity: this.calculateSeverityFromDeviation(ctrChange, 'ctr')
      });
    }

    // Conversion Rate Analysis
    const conversionChange = this.calculatePercentageChange(historical.conversionRate, current.conversionRate);
    if (Math.abs(conversionChange) > this.DEFAULT_THRESHOLDS.conversion_drop_percentage) {
      anomalies.push({
        metric: 'conversion_rate',
        currentValue: current.conversionRate,
        expectedValue: historical.conversionRate,
        deviation: conversionChange,
        severity: this.calculateSeverityFromDeviation(conversionChange, 'conversion')
      });
    }

    // Cost Per Click Analysis
    const cpcChange = this.calculatePercentageChange(historical.cpc, current.cpc);
    if (cpcChange > this.DEFAULT_THRESHOLDS.cost_spike_percentage) {
      anomalies.push({
        metric: 'cpc',
        currentValue: current.cpc,
        expectedValue: historical.cpc,
        deviation: cpcChange,
        severity: this.calculateSeverityFromDeviation(cpcChange, 'cost')
      });
    }

    return anomalies;
  }

  private async detectBudgetIssues(
    account: GoogleAdsAccount,
    campaignId: string
  ): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];

    try {
      // Leverage existing budget pacing system
      const pacingResults = await budgetPacingService.getBudgetStatus(account.id, campaignId);
      
      for (const result of pacingResults) {
        if (result.pacingStatus !== 'on_track') {
          const issue: DetectedIssue = {
            id: `budget-${campaignId}-${Date.now()}`,
            accountId: account.id,
            campaignId,
            type: 'budget_overspend',
            severity: this.mapPacingStatusToSeverity(result.pacingStatus),
            title: `Budget Pacing Issue: ${result.pacingStatus.replace('_', ' ').toUpperCase()}`,
            description: `Campaign is ${result.pacingStatus.replace('_', ' ')} with ${result.adjustmentFactor}x the expected spend rate`,
            recommendations: [
              result.adjustmentFactor > 1 ? 'Consider reducing daily budget or pausing underperforming ads' : 'Increase budget or improve ad relevance to maintain spend pace',
              'Review bidding strategy alignment with campaign goals',
              'Analyze keyword performance and adjust bids accordingly'
            ],
            confidenceScore: result.confidenceScore,
            detectedAt: new Date(),
            affectedMetrics: ['budget_pacing', 'spend_rate'],
            historicalContext: {
              previousValue: result.projectedSpend / result.adjustmentFactor,
              currentValue: result.projectedSpend,
              changePercentage: (result.adjustmentFactor - 1) * 100,
              timeframe: 'month_to_date'
            }
          };

          issues.push(issue);
        }
      }

    } catch (error) {
      console.error(`Budget issue detection failed for campaign ${campaignId}:`, error);
    }

    return issues;
  }

  private async detectQualityScoreIssues(
    account: GoogleAdsAccount,
    campaignId: string
  ): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];

    try {
      // Get quality score data from Google Ads API
      const qualityScoreData = await googleAdsService.getQualityScoreMetrics(
        account.customerId,
        campaignId
      );

      for (const keywordData of qualityScoreData) {
        if (keywordData.qualityScore < this.DEFAULT_THRESHOLDS.quality_score_threshold) {
          const issue: DetectedIssue = {
            id: `quality-${campaignId}-${keywordData.keywordId}-${Date.now()}`,
            accountId: account.id,
            campaignId,
            type: 'quality_score_drop',
            severity: keywordData.qualityScore <= 3 ? 'critical' : 'high',
            title: `Low Quality Score: ${keywordData.keyword}`,
            description: `Keyword "${keywordData.keyword}" has quality score of ${keywordData.qualityScore}/10`,
            recommendations: this.generateQualityScoreRecommendations(keywordData),
            confidenceScore: 85, // High confidence for quality score issues
            detectedAt: new Date(),
            affectedMetrics: ['quality_score', 'cpc', 'ad_rank']
          };

          issues.push(issue);
        }
      }

    } catch (error) {
      console.error(`Quality score detection failed for campaign ${campaignId}:`, error);
    }

    return issues;
  }

  private async detectDisapprovals(
    account: GoogleAdsAccount,
    campaignId: string
  ): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];

    try {
      const disapprovals = await googleAdsService.getAdDisapprovals(
        account.customerId,
        campaignId
      );

      for (const disapproval of disapprovals) {
        const issue: DetectedIssue = {
          id: `disapproval-${campaignId}-${disapproval.adId}-${Date.now()}`,
          accountId: account.id,
          campaignId,
          type: 'disapproval',
          severity: 'high', // Disapprovals always high priority
          title: `Ad Disapproval: ${disapproval.policyTopic}`,
          description: `Ad "${disapproval.headline}" was disapproved for: ${disapproval.reason}`,
          recommendations: [
            'Review ad content against Google Ads policies',
            'Edit ad to comply with policy requirements',
            'Submit appeal if disapproval appears incorrect'
          ],
          confidenceScore: 100, // Definitive - from Google Ads directly
          detectedAt: new Date(),
          affectedMetrics: ['ad_status', 'impressions', 'reach']
        };

        issues.push(issue);
      }

    } catch (error) {
      console.error(`Disapproval detection failed for campaign ${campaignId}:`, error);
    }

    return issues;
  }

  // Utility methods
  private calculatePercentageChange(previous: number, current: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private calculateSeverityFromDeviation(deviation: number, metricType: string): IssueSeverity {
    const absDeviation = Math.abs(deviation);
    
    switch (metricType) {
      case 'ctr':
      case 'conversion':
        if (absDeviation > 50) return 'critical';
        if (absDeviation > 30) return 'high';
        if (absDeviation > 15) return 'medium';
        return 'low';
      
      case 'cost':
        if (absDeviation > 60) return 'critical';
        if (absDeviation > 40) return 'high';
        if (absDeviation > 20) return 'medium';
        return 'low';
        
      default:
        return 'medium';
    }
  }

  private mapMetricToIssueType(metric: string): IssueType {
    switch (metric) {
      case 'ctr': return 'performance_drop';
      case 'conversion_rate': return 'conversion_drop';
      case 'cpc': return 'cost_spike';
      default: return 'performance_drop';
    }
  }

  private mapPacingStatusToSeverity(status: string): IssueSeverity {
    switch (status) {
      case 'over_pacing': return 'high';
      case 'under_pacing': return 'medium';
      case 'way_over_pacing': return 'critical';
      case 'way_under_pacing': return 'high';
      default: return 'low';
    }
  }

  private generateIssueTitle(anomaly: PerformanceAnomaly): string {
    const metricName = anomaly.metric.toUpperCase().replace('_', ' ');
    const direction = anomaly.deviation > 0 ? 'Increased' : 'Decreased';
    return `${metricName} ${direction} by ${Math.abs(anomaly.deviation).toFixed(1)}%`;
  }

  private generateIssueDescription(anomaly: PerformanceAnomaly): string {
    const metricName = anomaly.metric.replace('_', ' ');
    return `${metricName} changed from ${anomaly.expectedValue.toFixed(2)} to ${anomaly.currentValue.toFixed(2)} (${anomaly.deviation > 0 ? '+' : ''}${anomaly.deviation.toFixed(1)}%)`;
  }

  private generateRecommendations(anomaly: PerformanceAnomaly): string[] {
    switch (anomaly.metric) {
      case 'ctr':
        return anomaly.deviation < 0 ? [
          'Review ad copy relevance and update messaging',
          'Test new ad variations with stronger calls-to-action',
          'Audit keyword relevance and add negative keywords'
        ] : [
          'Analyze what\'s driving increased CTR',
          'Scale successful ad variations',
          'Consider increasing budget to capture more traffic'
        ];
        
      case 'conversion_rate':
        return anomaly.deviation < 0 ? [
          'Review landing page experience and load times',
          'Check conversion tracking implementation',
          'Analyze traffic quality and adjust targeting'
        ] : [
          'Identify factors driving improved conversions',
          'Scale successful campaigns and ad groups',
          'Consider expanding to similar audiences'
        ];
        
      case 'cpc':
        return [
          'Review bidding strategy effectiveness',
          'Analyze competitor activity in auction insights',
          'Consider adjusting bid adjustments for time/location'
        ];
        
      default:
        return ['Monitor performance closely and investigate underlying causes'];
    }
  }

  private generateQualityScoreRecommendations(keywordData: any): string[] {
    const recommendations = [];
    
    if (keywordData.adRelevance === 'BELOW_AVERAGE') {
      recommendations.push('Improve ad copy relevance to keyword themes');
    }
    
    if (keywordData.landingPageExperience === 'BELOW_AVERAGE') {
      recommendations.push('Optimize landing page content and user experience');
    }
    
    if (keywordData.expectedCtr === 'BELOW_AVERAGE') {
      recommendations.push('Create more compelling ad headlines and descriptions');
    }
    
    return recommendations.length > 0 ? recommendations : [
      'Review keyword match types and add negative keywords',
      'Improve ad group structure and keyword grouping'
    ];
  }

  private calculateConfidenceScore(anomaly: PerformanceAnomaly): number {
    const baseConfidence = 60;
    const deviationFactor = Math.min(Math.abs(anomaly.deviation) / 100, 0.4) * 40;
    return Math.min(baseConfidence + deviationFactor, 95);
  }

  private filterAndPrioritizeIssues(issues: DetectedIssue[]): DetectedIssue[] {
    return issues
      .filter(issue => issue.confidenceScore >= this.DEFAULT_THRESHOLDS.confidence_minimum)
      .sort((a, b) => {
        // Sort by severity first, then confidence
        const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        return severityDiff !== 0 ? severityDiff : b.confidenceScore - a.confidenceScore;
      });
  }

  private updateDetectionHistory(accountId: string, issues: DetectedIssue[]): void {
    const existing = this.detectionHistory.get(accountId) || [];
    const recent = existing.slice(-50); // Keep last 50 detections
    this.detectionHistory.set(accountId, [...recent, ...issues]);
  }

  private async processNewAlerts(accountId: string, currentIssues: DetectedIssue[]): Promise<void> {
    const previousIssues = this.detectionHistory.get(accountId) || [];
    const newIssues = currentIssues.filter(current => 
      !previousIssues.some(prev => prev.campaignId === current.campaignId && prev.type === current.type)
    );

    for (const issue of newIssues) {
      if (issue.severity === 'critical' || issue.severity === 'high') {
        this.triggerAlert(issue);
      }
    }
  }

  private triggerAlert(issue: DetectedIssue): void {
    console.log(`🚨 ${issue.severity.toUpperCase()} ALERT: ${issue.title}`);
    
    // Trigger registered callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(issue);
      } catch (error) {
        console.error('Alert callback failed:', error);
      }
    });
  }

  // Public API methods
  addAlertCallback(callback: (issue: DetectedIssue) => void): void {
    this.alertCallbacks.push(callback);
  }

  async getAccountHealthScore(accountId: string): Promise<{
    score: number;
    grade: string;
    issues: { critical: number; high: number; medium: number; low: number };
  }> {
    const issues = await this.detectAllIssues(accountId);
    
    const issueCounts = {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    };

    // Calculate health score (100 - weighted issue penalty)
    const penalty = (issueCounts.critical * 25) + (issueCounts.high * 15) + (issueCounts.medium * 8) + (issueCounts.low * 3);
    const score = Math.max(0, 100 - penalty);
    
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

    return { score, grade, issues: issueCounts };
  }
}

export const issueDetectionService = new IssueDetectionService();