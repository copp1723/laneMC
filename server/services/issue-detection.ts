/**
 * Issue Detection Service
 * Provides intelligent issue detection with actionable recommendations
 */

import { storage } from '../storage';
import { googleAdsService } from './google-ads';
import { surgicalBudgetAnalysis } from './surgical-budget-analysis';
import type { GoogleAdsAccount } from '@shared/schema';

export interface DetectedIssue {
  id: string;
  campaignId: string;
  campaignName: string;
  accountId: string;
  type: 'PERFORMANCE_DROP' | 'BUDGET_OVERSPEND' | 'QUALITY_SCORE' | 'DISAPPROVAL' | 'BID_STRATEGY' | 'ANOMALY';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendations: string[];
  confidenceScore: number;
  detectedAt: string;
  affectedMetrics: string[];
  historicalContext?: {
    metric: string;
    currentValue: number;
    mean: number;
    changePercentage?: number;
  };
}

export interface AccountHealthScore {
  score: number;
  grade: string;
  issues: { critical: number; high: number; medium: number; low: number; };
}

class IssueDetectionService {
  
  /**
   * Detect issues for all campaigns in an account
   */
  async detectAccountIssues(accountId: string): Promise<DetectedIssue[]> {
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) {
      throw new Error(`Account with ID ${accountId} not found`);
    }
    
    const issues: DetectedIssue[] = [];
    
    try {
      // Get budget pacing issues
      const budgetIssues = await this.detectBudgetIssues(accountId);
      issues.push(...budgetIssues);
      
      // Get performance issues
      const performanceIssues = await this.detectPerformanceIssues(accountId);
      issues.push(...performanceIssues);
      
      // Get quality score issues
      const qualityIssues = await this.detectQualityScoreIssues(accountId);
      issues.push(...qualityIssues);
      
    } catch (error) {
      console.error(`Failed to detect issues for account ${accountId}:`, error);
    }
    
    return issues.sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity));
  }
  
  /**
   * Calculate account health score
   */
  async calculateHealthScore(accountId: string): Promise<AccountHealthScore> {
    const issues = await this.detectAccountIssues(accountId);
    
    const issueCounts = {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
    };
    
    // Calculate score (100 - penalty points)
    let score = 100;
    score -= issueCounts.critical * 25; // Critical issues: -25 points each
    score -= issueCounts.high * 15;     // High issues: -15 points each
    score -= issueCounts.medium * 8;    // Medium issues: -8 points each
    score -= issueCounts.low * 3;       // Low issues: -3 points each
    
    score = Math.max(0, score); // Don't go below 0
    
    // Calculate grade
    let grade: string;
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';
    
    return {
      score,
      grade,
      issues: issueCounts
    };
  }
  
  /**
   * Detect budget-related issues
   */
  private async detectBudgetIssues(accountId: string): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    
    try {
      const budgetAnalyses = await surgicalBudgetAnalysis.analyzeAccountBudgets(accountId);
      
      for (const analysis of budgetAnalyses) {
        if (analysis.riskLevel === 'CRITICAL' || analysis.riskLevel === 'HIGH') {
          const severity = analysis.riskLevel === 'CRITICAL' ? 'critical' : 'high';
          
          issues.push({
            id: `budget_${analysis.campaignId}_${Date.now()}`,
            campaignId: analysis.campaignId,
            campaignName: analysis.campaignName,
            accountId,
            type: 'BUDGET_OVERSPEND',
            severity,
            title: `Budget Pacing Issue: ${analysis.campaignName}`,
            description: analysis.impactMessage,
            recommendations: [analysis.actionRequired],
            confidenceScore: analysis.confidenceScore,
            detectedAt: new Date().toISOString(),
            affectedMetrics: ['budget', 'spend', 'pacing'],
            historicalContext: {
              metric: 'Budget Variance',
              currentValue: analysis.spendVariancePercentage,
              mean: 0,
              changePercentage: analysis.spendVariancePercentage
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to detect budget issues:', error);
    }
    
    return issues;
  }
  
  /**
   * Detect performance-related issues
   */
  private async detectPerformanceIssues(accountId: string): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    
    try {
      const account = await storage.getGoogleAdsAccount(accountId);
      if (!account) return issues;
      
      const campaigns = await googleAdsService.getCampaigns(account.customerId);
      
      for (const campaign of campaigns) {
        const metrics = await googleAdsService.getPerformanceMetrics(
          account.customerId,
          campaign.id,
          'LAST_7_DAYS'
        );
        
        // Check for low CTR
        if (metrics.ctr < 0.02) { // Less than 2% CTR
          issues.push({
            id: `performance_ctr_${campaign.id}_${Date.now()}`,
            campaignId: campaign.id,
            campaignName: campaign.name,
            accountId,
            type: 'PERFORMANCE_DROP',
            severity: metrics.ctr < 0.01 ? 'high' : 'medium',
            title: `Low Click-Through Rate: ${campaign.name}`,
            description: `CTR is ${(metrics.ctr * 100).toFixed(2)}%, below industry average of 2%`,
            recommendations: [
              'Review ad copy relevance and compelling messaging',
              'Test new ad variations with stronger calls-to-action',
              'Refine keyword targeting to improve relevance'
            ],
            confidenceScore: 0.85,
            detectedAt: new Date().toISOString(),
            affectedMetrics: ['ctr', 'clicks', 'impressions'],
            historicalContext: {
              metric: 'Click-Through Rate',
              currentValue: metrics.ctr * 100,
              mean: 2.0,
              changePercentage: ((metrics.ctr * 100 - 2.0) / 2.0) * 100
            }
          });
        }
        
        // Check for high CPC
        if (metrics.cpc > 5.0) { // More than $5 CPC
          issues.push({
            id: `performance_cpc_${campaign.id}_${Date.now()}`,
            campaignId: campaign.id,
            campaignName: campaign.name,
            accountId,
            type: 'PERFORMANCE_DROP',
            severity: metrics.cpc > 10.0 ? 'high' : 'medium',
            title: `High Cost Per Click: ${campaign.name}`,
            description: `CPC is $${metrics.cpc.toFixed(2)}, which may indicate bidding inefficiencies`,
            recommendations: [
              'Review bid strategy and consider automated bidding',
              'Add negative keywords to reduce irrelevant clicks',
              'Improve Quality Score to reduce costs'
            ],
            confidenceScore: 0.75,
            detectedAt: new Date().toISOString(),
            affectedMetrics: ['cpc', 'cost', 'clicks'],
            historicalContext: {
              metric: 'Cost Per Click',
              currentValue: metrics.cpc,
              mean: 3.0,
              changePercentage: ((metrics.cpc - 3.0) / 3.0) * 100
            }
          });
        }
        
        // Check for low conversion rate
        if (metrics.conversionRate < 0.02 && metrics.clicks > 100) { // Less than 2% conversion rate with sufficient clicks
          issues.push({
            id: `performance_cvr_${campaign.id}_${Date.now()}`,
            campaignId: campaign.id,
            campaignName: campaign.name,
            accountId,
            type: 'PERFORMANCE_DROP',
            severity: 'medium',
            title: `Low Conversion Rate: ${campaign.name}`,
            description: `Conversion rate is ${(metrics.conversionRate * 100).toFixed(2)}% with ${metrics.clicks} clicks`,
            recommendations: [
              'Review landing page experience and relevance',
              'Test different landing pages or improve page load speed',
              'Ensure conversion tracking is properly implemented'
            ],
            confidenceScore: 0.70,
            detectedAt: new Date().toISOString(),
            affectedMetrics: ['conversion_rate', 'conversions', 'clicks'],
            historicalContext: {
              metric: 'Conversion Rate',
              currentValue: metrics.conversionRate * 100,
              mean: 3.0,
              changePercentage: ((metrics.conversionRate * 100 - 3.0) / 3.0) * 100
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to detect performance issues:', error);
    }
    
    return issues;
  }
  
  /**
   * Detect quality score issues using real Google Ads data
   */
  private async detectQualityScoreIssues(accountId: string): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    
    try {
      const account = await storage.getGoogleAdsAccount(accountId);
      if (!account) return issues;
      
      // Get campaigns and analyze their quality scores
      const campaigns = await googleAdsService.getCampaigns(account.customerId);
      
      for (const campaign of campaigns) {
        // Quality score analysis would require keyword-level data from Google Ads API
        // This is a placeholder for real quality score detection
        // In a real implementation, you would query keyword performance report
        // with quality_score_info fields
        console.log(`Quality score analysis for campaign ${campaign.name} would be implemented here`);
      }
    } catch (error) {
      console.error('Failed to detect quality score issues:', error);
    }
    
    return issues;
  }
  
  /**
   * Get severity weight for sorting
   */
  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }
}

export const issueDetectionService = new IssueDetectionService();
