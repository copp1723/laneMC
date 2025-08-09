/**
 * Google Ads Automation Engine
 * Orchestrates automated campaign management, budget pacing, and performance optimization
 */

import { budgetPacingService } from './budget-pacing';
import { googleAdsService } from './google-ads';
import { openRouterService } from './openrouter';
import { storage } from '../storage';

export class AutomationEngine {
  private isRunning = false;
  private monitoringInterval = 30 * 60 * 1000; // 30 minutes
  private intervalId: NodeJS.Timeout | null = null;
  private accountLocks = new Set<string>();
  private MAX_CONCURRENCY = 3;

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Automation engine is already running');
      return;
    }

    console.log('🚀 Starting Lane MCP Automation Engine');
    
    // Start budget monitoring service
    await budgetPacingService.startMonitoring();
    
    // Start main automation loop
    this.isRunning = true;
    this.intervalId = setInterval(() => { this.runAutomationCycle().catch(console.error); }, this.monitoringInterval);

    // Run initial cycle
    await this.runAutomationCycle();
    
    console.log('✅ Lane MCP Automation Engine started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping Lane MCP Automation Engine');
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    await budgetPacingService.stopMonitoring();
    
    console.log('✅ Lane MCP Automation Engine stopped');
  }

  private async runAutomationCycle(): Promise<void> {
    try {
      console.log('🔄 Running automation cycle...');
      const accounts = (await storage.getAllGoogleAdsAccounts()).filter((a:any) => a.isActive);
      const queue = [...accounts];
      const workers = Array.from({ length: this.MAX_CONCURRENCY }, () => this.worker(queue));
      await Promise.all(workers);
      
      console.log(`✅ Automation cycle completed for ${accounts.length} accounts`);
    } catch (error) {
      console.error('❌ Automation cycle failed:', error);
    }
  }

  private async worker(queue: any[]): Promise<void> {
    for (;;) {
      const account = queue.pop();
      if (!account) return;
      if (this.accountLocks.has(account.id)) continue;
      this.accountLocks.add(account.id);
      try {
        await this.processAccountAutomation(account.id, account.customerId);
      } finally {
        this.accountLocks.delete(account.id);
      }
    }
  }

  private async processAccountAutomation(accountId: string, customerId: string): Promise<void> {
    try {
      // 1. Sync campaign performance data
      await this.syncPerformanceData(accountId, customerId);
      
      // 2. Check budget pacing and auto-adjust if needed  
      await this.checkBudgetPacing(accountId, customerId);
      
      // 3. Generate performance insights
      await this.generatePerformanceInsights(accountId, customerId);
      
    } catch (error) {
      console.error(`❌ Account automation failed for ${accountId}:`, error);
    }
  }

  private async syncPerformanceData(accountId: string, customerId: string): Promise<void> {
    try {
      // Get campaigns for this account
      const campaigns = await googleAdsService.getCampaigns(customerId);
      
      for (const campaign of campaigns) {
        // Get performance metrics
        const metrics = await googleAdsService.getPerformanceMetrics(customerId, campaign.id, 'YESTERDAY');
        
        // Store in database
        await storage.createPerformanceMetric({
          googleAdsAccountId: accountId,
          campaignId: campaign.id,
          date: new Date(),
          impressions: Number(metrics.impressions) || 0,
          clicks: Number(metrics.clicks) || 0,
          conversions: Number(metrics.conversions) || 0,
          cost: metrics.cost.toString(),
          ctr: metrics.ctr.toString(),
          cpc: metrics.cpc.toString(),
          conversionRate: metrics.conversionRate.toString(),
        });
      }
    } catch (error) {
      console.error('Failed to sync performance data:', error);
    }
  }

  private async checkBudgetPacing(accountId: string, customerId: string): Promise<void> {
    try {
      const campaigns = await googleAdsService.getCampaigns(customerId);
      
      for (const campaign of campaigns) {
        const account = await storage.getGoogleAdsAccount(accountId);
        if (!account) continue;
        
        const pacingResult = await budgetPacingService.checkCampaignBudget(account, campaign.id, campaign);
        
        // Auto-adjust budget if significantly off-pace
        const delta = Math.abs(pacingResult.adjustmentFactor - 1);
        if (delta >= 0.2) {
          // Apply budget bounds if available
          const bounds = { min: 5, max: 5000 }; // Default bounds
          const newBudget = Math.max(bounds.min, Math.min(bounds.max, pacingResult.recommendedBudget));

          console.log(`🔧 Auto-adjusting budget for campaign ${campaign.id}: $${campaign.budget} → $${newBudget}`);

          if (!googleAdsService.isReadOnly()) {
            await googleAdsService.updateCampaignBudget(customerId, campaign.id, newBudget);
          } else {
            console.log('Read-only mode: Skipping Google Ads budget update');
          }

          // Update database
          const dbCampaign = await storage.getCampaigns(accountId);
          const matchingCampaign = dbCampaign.find(c => c.googleCampaignId === campaign.id);
          if (matchingCampaign) {
            await storage.updateCampaign(matchingCampaign.id, { budget: newBudget as any });
          }
        }
      }
    } catch (error) {
      console.error('Failed to check budget pacing:', error);
    }
  }

  private async generatePerformanceInsights(accountId: string, customerId: string): Promise<void> {
    try {
      // Get recent performance data
      const metrics = await storage.getPerformanceMetrics(accountId);
      
      if (metrics.length === 0) return;
      
      // Generate AI insights using OpenRouter
      const performanceData = metrics.slice(0, 10); // Last 10 data points
      
      const prompt = `Analyze this Google Ads performance data and provide 3 actionable insights:

Performance Data:
${performanceData.map(m => `Date: ${m.date}, Spend: $${m.cost}, Clicks: ${m.clicks}, Conversions: ${m.conversions}, CPC: $${m.cpc}`).join('\n')}

Provide insights in this JSON format:
{
  "insights": [
    {
      "type": "opportunity|warning|optimization",
      "title": "Brief insight title",
      "description": "Detailed analysis and recommendation",
      "impact": "high|medium|low",
      "actionable": true/false
    }
  ]
}`;

      let fullResponse = '';
      
      await new Promise<void>((resolve, reject) => {
        openRouterService.streamChatCompletion(
          [{ role: 'user', content: prompt }],
          (chunk) => { fullResponse += chunk; },
          () => resolve(),
          (error) => reject(error)
        );
      });

      // Process insights (would typically store in database or send notifications)
      console.log(`💡 Generated performance insights for account ${accountId}`);
      
    } catch (error) {
      console.error('Failed to generate performance insights:', error);
    }
  }
}

export const automationEngine = new AutomationEngine();