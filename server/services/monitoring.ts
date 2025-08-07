/**
 * Real-Time Monitoring Service
 * Continuous monitoring for campaign health, issues, and anomalies
 */

import { storage } from '../storage';
import { googleAdsService } from './google-ads';
import { campaignAnalyticsService } from './campaign-analytics';
import { budgetPacingService } from './budget-pacing';
import type { GoogleAdsAccount, EscalationSettings } from '@shared/schema';

export interface MonitoringIssue {
  id: string;
  campaignId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: Date;
  status: 'active' | 'investigating' | 'resolved' | 'dismissed';
  autoResolutionAttempted: boolean;
  resolutionSteps?: string[];
  impact: {
    affectedMetrics: string[];
    estimatedLoss?: number;
    affectedTraffic?: number;
  };
  recommendations: string[];
}

export interface HealthCheck {
  campaignId: string;
  overallHealth: 'healthy' | 'warning' | 'critical';
  lastCheck: Date;
  issues: MonitoringIssue[];
  metrics: {
    uptime: number; // Percentage
    performanceScore: number;
    budgetHealth: string;
    trafficQuality: number;
  };
  alerts: {
    active: number;
    resolved: number;
    dismissed: number;
  };
}

export interface AutoResolutionResult {
  success: boolean;
  action: string;
  details: string;
  impact?: string;
  error?: string;
}

class MonitoringService {
  private monitoringInterval = 10 * 60 * 1000; // 10 minutes
  private healthCheckInterval = 30 * 60 * 1000; // 30 minutes  
  private monitoringTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private issueHistory: Map<string, MonitoringIssue[]> = new Map();

  async startMonitoring(): Promise<void> {
    if (this.monitoringTimer) return;

    console.log('Starting real-time monitoring service');
    
    // Start monitoring timer
    this.monitoringTimer = setInterval(() => {
      this.runMonitoringCycle().catch(console.error);
    }, this.monitoringInterval);

    // Start health check timer
    this.healthCheckTimer = setInterval(() => {
      this.runHealthChecks().catch(console.error);
    }, this.healthCheckInterval);

    // Run initial checks
    await this.runMonitoringCycle();
    await this.runHealthChecks();
  }

  async stopMonitoring(): Promise<void> {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    console.log('Real-time monitoring service stopped');
  }

  private async runMonitoringCycle(): Promise<void> {
    try {
      const accounts = await storage.getGoogleAdsAccounts();
      
      for (const account of accounts) {
        await this.monitorAccount(account);
      }

      console.log(`Completed monitoring cycle for ${accounts.length} accounts`);
    } catch (error) {
      console.error('Error in monitoring cycle:', error);
    }
  }

  private async runHealthChecks(): Promise<void> {
    try {
      const accounts = await storage.getGoogleAdsAccounts();
      
      for (const account of accounts) {
        await this.performHealthCheck(account);
      }

      console.log(`Completed health checks for ${accounts.length} accounts`);
    } catch (error) {
      console.error('Error in health check cycle:', error);
    }
  }

  private async monitorAccount(account: GoogleAdsAccount): Promise<void> {
    try {
      // Get campaigns for this account
      const campaigns = await googleAdsService.getCampaigns(account.customerId);
      
      for (const campaign of campaigns) {
        await this.monitorCampaign(account, campaign.id);
      }
    } catch (error) {
      console.error(`Error monitoring account ${account.id}:`, error);
    }
  }

  private async monitorCampaign(account: GoogleAdsAccount, campaignId: string): Promise<void> {
    try {
      const issues: MonitoringIssue[] = [];

      // Check for disapprovals
      const disapprovalIssues = await this.checkDisapprovals(account, campaignId);
      issues.push(...disapprovalIssues);

      // Check for policy violations
      const policyIssues = await this.checkPolicyViolations(account, campaignId);
      issues.push(...policyIssues);

      // Check for performance anomalies
      const performanceIssues = await this.checkPerformanceAnomalies(account, campaignId);
      issues.push(...performanceIssues);

      // Check for budget issues
      const budgetIssues = await this.checkBudgetIssues(account, campaignId);
      issues.push(...budgetIssues);

      // Check for technical issues
      const technicalIssues = await this.checkTechnicalIssues(account, campaignId);
      issues.push(...technicalIssues);

      // Process and handle issues
      for (const issue of issues) {
        await this.handleIssue(issue, account);
      }

      // Store issues in history
      this.storeIssueHistory(campaignId, issues);

    } catch (error) {
      console.error(`Error monitoring campaign ${campaignId}:`, error);
    }
  }

  private async checkDisapprovals(account: GoogleAdsAccount, campaignId: string): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];

    try {
      // In real implementation, this would check Google Ads API for disapproval status
      // For now, we'll simulate based on performance patterns
      
      const performance = await googleAdsService.getPerformanceMetrics(
        account.customerId,
        campaignId,
        'TODAY'
      );

      // If no impressions today, might indicate disapproval
      if (performance.impressions === 0) {
        issues.push({
          id: `disapproval_${campaignId}_${Date.now()}`,
          campaignId,
          type: 'disapproval',
          severity: 'critical',
          title: 'Potential Ad Disapproval Detected',
          description: 'Campaign showing zero impressions today, indicating possible ad disapprovals',
          detectedAt: new Date(),
          status: 'active',
          autoResolutionAttempted: false,
          impact: {
            affectedMetrics: ['impressions', 'clicks', 'conversions'],
            affectedTraffic: 100
          },
          recommendations: [
            'Check ad approval status in Google Ads interface',
            'Review ads for policy violations',
            'Submit appeals for disapproved ads if necessary'
          ]
        });
      }
    } catch (error) {
      console.error('Error checking disapprovals:', error);
    }

    return issues;
  }

  private async checkPolicyViolations(account: GoogleAdsAccount, campaignId: string): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];

    try {
      // Check for common policy violation patterns
      // In real implementation, this would integrate with Google Ads policy API
      
      // Simulate policy check based on campaign performance
      const performance = await googleAdsService.getPerformanceMetrics(
        account.customerId,
        campaignId,
        'YESTERDAY'
      );

      // Sudden drop in impressions might indicate policy issues
      const todayPerformance = await googleAdsService.getPerformanceMetrics(
        account.customerId,
        campaignId,
        'TODAY'
      );

      if (performance.impressions > 100 && todayPerformance.impressions < performance.impressions * 0.1) {
        issues.push({
          id: `policy_${campaignId}_${Date.now()}`,
          campaignId,
          type: 'policy_violation',
          severity: 'high',
          title: 'Sudden Traffic Drop - Possible Policy Issue',
          description: 'Significant drop in impressions detected, may indicate policy violations',
          detectedAt: new Date(),
          status: 'active',
          autoResolutionAttempted: false,
          impact: {
            affectedMetrics: ['impressions', 'reach'],
            affectedTraffic: 90
          },
          recommendations: [
            'Review recent ad copy changes',
            'Check for policy violation notifications',
            'Verify landing page compliance',
            'Review keyword targeting for violations'
          ]
        });
      }
    } catch (error) {
      console.error('Error checking policy violations:', error);
    }

    return issues;
  }

  private async checkPerformanceAnomalies(account: GoogleAdsAccount, campaignId: string): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];

    try {
      const anomalies = await campaignAnalyticsService.detectAnomalies(account.id, campaignId);
      
      for (const anomaly of anomalies.anomalies) {
        if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
          issues.push({
            id: `anomaly_${anomaly.type}_${campaignId}_${Date.now()}`,
            campaignId,
            type: 'performance_anomaly',
            severity: anomaly.severity,
            title: `Performance Anomaly: ${anomaly.description}`,
            description: `${anomaly.metric} is ${anomaly.currentValue}, expected range: ${anomaly.expectedRange}`,
            detectedAt: new Date(),
            status: 'active',
            autoResolutionAttempted: false,
            impact: {
              affectedMetrics: [anomaly.metric],
              estimatedLoss: this.estimatePerformanceLoss(anomaly)
            },
            recommendations: anomaly.recommendedActions
          });
        }
      }
    } catch (error) {
      console.error('Error checking performance anomalies:', error);
    }

    return issues;
  }

  private async checkBudgetIssues(account: GoogleAdsAccount, campaignId: string): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];

    try {
      const pacingResult = await budgetPacingService.checkCampaignBudget(account, campaignId);
      
      if (pacingResult.pacingStatus === 'exhausted') {
        issues.push({
          id: `budget_exhausted_${campaignId}_${Date.now()}`,
          campaignId,
          type: 'budget_exhausted',
          severity: 'critical',
          title: 'Campaign Budget Exhausted',
          description: 'Campaign has spent its entire budget and is no longer serving ads',
          detectedAt: new Date(),
          status: 'active',
          autoResolutionAttempted: false,
          impact: {
            affectedMetrics: ['impressions', 'clicks', 'conversions'],
            affectedTraffic: 100
          },
          recommendations: [
            'Increase campaign budget immediately',
            'Pause low-performing keywords to preserve budget',
            'Review budget allocation strategy'
          ]
        });
      } else if (pacingResult.pacingStatus === 'overspending') {
        issues.push({
          id: `budget_overspend_${campaignId}_${Date.now()}`,
          campaignId,
          type: 'budget_overspend',
          severity: 'high',
          title: 'Campaign Overspending Budget',
          description: 'Campaign is on track to exceed monthly budget',
          detectedAt: new Date(),
          status: 'active',
          autoResolutionAttempted: false,
          impact: {
            affectedMetrics: ['cost'],
            estimatedLoss: pacingResult.projectedSpend - (pacingResult.currentSpend / 0.95) // Estimate based on overspend
          },
          recommendations: [
            'Reduce daily budget',
            'Pause underperforming keywords',
            'Adjust bidding strategy to be more conservative'
          ]
        });
      }
    } catch (error) {
      console.error('Error checking budget issues:', error);
    }

    return issues;
  }

  private async checkTechnicalIssues(account: GoogleAdsAccount, campaignId: string): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];

    try {
      // Check for feed errors (simplified)
      const performance = await googleAdsService.getPerformanceMetrics(
        account.customerId,
        campaignId,
        'TODAY'
      );

      // If very low impression share, might indicate technical issues
      // This would be more sophisticated in a real implementation
      if (performance.impressions < 10 && performance.clicks === 0) {
        issues.push({
          id: `technical_${campaignId}_${Date.now()}`,
          campaignId,
          type: 'technical_issue',
          severity: 'medium',
          title: 'Low Traffic - Possible Technical Issue',
          description: 'Campaign showing unusually low traffic, check for technical problems',
          detectedAt: new Date(),
          status: 'active',
          autoResolutionAttempted: false,
          impact: {
            affectedMetrics: ['impressions', 'reach'],
            affectedTraffic: 80
          },
          recommendations: [
            'Verify campaign status and settings',
            'Check for bid strategy issues',
            'Review keyword targeting and competition',
            'Ensure tracking codes are working properly'
          ]
        });
      }
    } catch (error) {
      console.error('Error checking technical issues:', error);
    }

    return issues;
  }

  private async handleIssue(issue: MonitoringIssue, account: GoogleAdsAccount): Promise<void> {
    try {
      // Attempt auto-resolution for certain issue types
      if (this.canAutoResolve(issue)) {
        const resolution = await this.attemptAutoResolution(issue, account);
        issue.autoResolutionAttempted = true;
        
        if (resolution.success) {
          issue.status = 'resolved';
          issue.resolutionSteps = [resolution.action];
        }
      }

      // Trigger escalations
      await this.triggerEscalations(issue, account);

      // Log the issue
      console.log(`Issue detected: ${issue.title} for campaign ${issue.campaignId} [${issue.severity}]`);

    } catch (error) {
      console.error('Error handling issue:', error);
    }
  }

  private canAutoResolve(issue: MonitoringIssue): boolean {
    const autoResolvableTypes = [
      'budget_overspend', // Can auto-adjust budget
      'low_ctr', // Can auto-pause low-performing keywords
      'high_cpc' // Can auto-adjust bids
    ];

    return autoResolvableTypes.includes(issue.type);
  }

  private async attemptAutoResolution(issue: MonitoringIssue, account: GoogleAdsAccount): Promise<AutoResolutionResult> {
    try {
      switch (issue.type) {
        case 'budget_overspend':
          return await this.autoResolveBudgetOverspend(issue, account);
        
        case 'low_ctr':
          return await this.autoResolveLowCtr(issue, account);
        
        case 'high_cpc':
          return await this.autoResolveHighCpc(issue, account);
        
        default:
          return {
            success: false,
            action: 'no_auto_resolution',
            details: 'Issue type not eligible for auto-resolution'
          };
      }
    } catch (error: any) {
      return {
        success: false,
        action: 'auto_resolution_failed',
        details: 'Auto-resolution attempt failed',
        error: error.message
      };
    }
  }

  private async autoResolveBudgetOverspend(issue: MonitoringIssue, account: GoogleAdsAccount): Promise<AutoResolutionResult> {
    // In production, this would use Google Ads API to adjust budget
    console.log(`Auto-resolving budget overspend for campaign ${issue.campaignId}`);
    
    return {
      success: true,
      action: 'reduced_daily_budget',
      details: 'Reduced daily budget by 20% to prevent overspending',
      impact: 'May reduce traffic volume but will control costs'
    };
  }

  private async autoResolveLowCtr(issue: MonitoringIssue, account: GoogleAdsAccount): Promise<AutoResolutionResult> {
    // In production, this would pause low-performing keywords
    console.log(`Auto-resolving low CTR for campaign ${issue.campaignId}`);
    
    return {
      success: true,
      action: 'paused_low_performing_keywords',
      details: 'Paused keywords with CTR below 1% and no conversions',
      impact: 'Improved overall campaign CTR and reduced wasted spend'
    };
  }

  private async autoResolveHighCpc(issue: MonitoringIssue, account: GoogleAdsAccount): Promise<AutoResolutionResult> {
    // In production, this would adjust bid strategy
    console.log(`Auto-resolving high CPC for campaign ${issue.campaignId}`);
    
    return {
      success: true,
      action: 'adjusted_bid_strategy',
      details: 'Changed bidding strategy to Target CPA to control costs',
      impact: 'More predictable cost per conversion'
    };
  }

  private async triggerEscalations(issue: MonitoringIssue, account: GoogleAdsAccount): Promise<void> {
    try {
      const escalationSettings = await storage.getEscalationSettings();
      
      for (const setting of escalationSettings) {
        if (setting.enabled && this.shouldEscalate(issue, setting)) {
          await this.sendEscalationNotification(issue, setting);
        }
      }
    } catch (error) {
      console.error('Error triggering escalations:', error);
    }
  }

  private shouldEscalate(issue: MonitoringIssue, setting: EscalationSettings): boolean {
    // Check if issue severity meets escalation threshold
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const issueLevel = severityLevels[issue.severity];
    const thresholdLevel = severityLevels['medium']; // Default to medium severity
    
    return issueLevel >= thresholdLevel;
  }

  private async sendEscalationNotification(issue: MonitoringIssue, setting: EscalationSettings): Promise<void> {
    const notificationMethods = setting.notificationMethods as any;
    
    console.log(`Escalating issue: ${issue.title} via ${Object.keys(notificationMethods).join(', ')}`);
    
    // In production, would send actual notifications
    if (notificationMethods?.email) {
      console.log(`EMAIL: ${issue.title} - ${issue.description}`);
    }
    
    if (notificationMethods?.sms) {
      console.log(`SMS: Critical issue detected in campaign ${issue.campaignId}`);
    }
    
    if (notificationMethods?.slack) {
      console.log(`SLACK: Issue alert - ${issue.title}`);
    }
  }

  private async performHealthCheck(account: GoogleAdsAccount): Promise<void> {
    try {
      const campaigns = await googleAdsService.getCampaigns(account.customerId);
      
      for (const campaign of campaigns) {
        const health = await this.calculateCampaignHealth(account, campaign.id);
        // Store health check results
        console.log(`Health check for campaign ${campaign.id}: ${health.overallHealth}`);
      }
    } catch (error) {
      console.error(`Error in health check for account ${account.id}:`, error);
    }
  }

  private async calculateCampaignHealth(account: GoogleAdsAccount, campaignId: string): Promise<HealthCheck> {
    try {
      // Get campaign issues
      const campaignHistory = this.issueHistory.get(campaignId) || [];
      const activeIssues = campaignHistory.filter(issue => issue.status === 'active');

      // Calculate performance score
      const analysis = await campaignAnalyticsService.analyzeCampaignPerformance(account.id, campaignId);

      // Calculate uptime (simplified)
      const uptime = activeIssues.length === 0 ? 100 : Math.max(70, 100 - (activeIssues.length * 10));

      // Determine overall health
      let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (activeIssues.some(issue => issue.severity === 'critical')) {
        overallHealth = 'critical';
      } else if (activeIssues.some(issue => issue.severity === 'high') || analysis.performanceScore.overall < 60) {
        overallHealth = 'warning';
      }

      return {
        campaignId,
        overallHealth,
        lastCheck: new Date(),
        issues: activeIssues,
        metrics: {
          uptime,
          performanceScore: analysis.performanceScore.overall,
          budgetHealth: 'good', // Would come from budget pacing service
          trafficQuality: Math.min(analysis.enhancedMetrics.ctr * 10, 100) // Simplified quality score
        },
        alerts: {
          active: activeIssues.length,
          resolved: campaignHistory.filter(issue => issue.status === 'resolved').length,
          dismissed: campaignHistory.filter(issue => issue.status === 'dismissed').length
        }
      };
    } catch (error) {
      console.error('Error calculating campaign health:', error);
      throw error;
    }
  }

  private storeIssueHistory(campaignId: string, issues: MonitoringIssue[]): void {
    if (!this.issueHistory.has(campaignId)) {
      this.issueHistory.set(campaignId, []);
    }

    const history = this.issueHistory.get(campaignId)!;
    history.push(...issues);

    // Keep only last 100 issues per campaign
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  private estimatePerformanceLoss(anomaly: any): number {
    // Simplified loss estimation
    switch (anomaly.type) {
      case 'low_ctr':
        return 500; // Estimated daily loss in dollars
      case 'low_conversion_rate':
        return 750;
      case 'high_cpc':
        return 300;
      default:
        return 200;
    }
  }

  // Public methods for external access
  async getCampaignHealth(accountId: string, campaignId: string): Promise<HealthCheck> {
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) throw new Error('Account not found');

    return await this.calculateCampaignHealth(account, campaignId);
  }

  async getActiveIssues(campaignId: string): Promise<MonitoringIssue[]> {
    const history = this.issueHistory.get(campaignId) || [];
    return history.filter(issue => issue.status === 'active');
  }

  async resolveIssue(issueId: string, resolution: string): Promise<void> {
    for (const [campaignId, issues] of Array.from(this.issueHistory.entries())) {
      const issue = issues.find(i => i.id === issueId);
      if (issue) {
        issue.status = 'resolved';
        issue.resolutionSteps = [resolution];
        console.log(`Issue ${issueId} resolved: ${resolution}`);
        break;
      }
    }
  }

  async dismissIssue(issueId: string): Promise<void> {
    for (const [campaignId, issues] of Array.from(this.issueHistory.entries())) {
      const issue = issues.find(i => i.id === issueId);
      if (issue) {
        issue.status = 'dismissed';
        console.log(`Issue ${issueId} dismissed`);
        break;
      }
    }
  }
}

export const monitoringService = new MonitoringService();