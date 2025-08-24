/**
 * Budget Pacing API Routes
 * Provides detailed budget analysis and AI-powered insights
 */

import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../services/auth';
import { surgicalBudgetAnalysis } from '../services/surgical-budget-analysis';

const router = Router();

/**
 * GET /api/budget-pacing/:accountId/detailed
 * Get detailed budget pacing analysis for all campaigns in an account
 */
router.get('/:accountId/detailed', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`[BUDGET-PACING] Getting detailed analysis for account: ${accountId}`);
    const analyses = await surgicalBudgetAnalysis.analyzeAccountBudgets(accountId);
    
    // Transform to match frontend expectations
    const pacingData = analyses.map(analysis => ({
      campaignId: analysis.campaignId,
      campaignName: analysis.campaignName,
      currentSpend: analysis.currentSpend,
      budgetTarget: analysis.monthlyBudget,
      recommendedDailyBudget: analysis.recommendedDailyBudget,
      pacingStatus: mapRiskLevelToPacingStatus(analysis.riskLevel, analysis.projectedOverage),
      daysRemaining: analysis.daysRemaining,
      projectedSpend: analysis.projectedMonthEndSpend,
      confidenceScore: Math.round(analysis.confidenceScore * 100),
      dailyAverageSpend: analysis.currentSpend / Math.max(analysis.daysElapsed, 1),
      weeklyTrend: calculateWeeklyTrend(analysis),
      potentialSavings: analysis.projectedOverage > 0 ? analysis.projectedOverage : 0,
      potentialRevenueLoss: analysis.projectedOverage < 0 ? Math.abs(analysis.projectedOverage) : 0,
      lastOptimized: analysis.lastUpdated.toISOString().split('T')[0],
      budgetAdjustmentPercent: Math.round(analysis.budgetAdjustmentPercentage),
      projectedMonthEndSpend: analysis.projectedMonthEndSpend,
      recommendation: analysis.actionRequired,
      businessImpact: {
        urgencyScore: analysis.urgencyScore,
        dollarImpact: Math.abs(analysis.projectedOverage),
        impactType: analysis.projectedOverage > 0 ? 'OVERSPEND_RISK' : 'REVENUE_OPPORTUNITY',
        potentialSavings: analysis.projectedOverage > 0 ? analysis.projectedOverage : 0,
        monthlyRevenueLoss: analysis.projectedOverage < 0 ? Math.abs(analysis.projectedOverage) : 0
      }
    }));
    
    console.log(`[BUDGET-PACING] Returning ${pacingData.length} campaign analyses`);
    
    res.json({
      success: true,
      data: pacingData,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[BUDGET-PACING] Detailed analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/budget-pacing/:accountId/insights
 * Get AI-generated insights for budget optimization
 */
router.get('/:accountId/insights', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`[BUDGET-PACING] Generating insights for account: ${accountId}`);
    const analyses = await surgicalBudgetAnalysis.analyzeAccountBudgets(accountId);
    
    // Generate AI insights based on analysis
    const insights = generateBudgetInsights(analyses);
    
    console.log(`[BUDGET-PACING] Generated ${insights.length} insights`);
    
    res.json(insights);
    
  } catch (error: any) {
    console.error('[BUDGET-PACING] Insights generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/budget-pacing/:accountId/:campaignId/apply
 * Apply budget recommendation (read-only - returns implementation guide)
 */
router.post('/:accountId/:campaignId/apply', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId, campaignId } = req.params;
    const { recommendedBudget } = req.body;
    
    console.log(`[BUDGET-PACING] Apply recommendation for campaign ${campaignId}: $${recommendedBudget}`);
    
    // Since we're read-only, provide implementation guidance
    const analysis = await surgicalBudgetAnalysis.analyzeCampaignBudget(accountId, campaignId);
    
    const implementationGuide = {
      success: true,
      message: 'Budget recommendation ready for implementation',
      campaignName: analysis.campaignName,
      currentBudget: analysis.dailyBudget,
      recommendedBudget: recommendedBudget,
      expectedImpact: analysis.businessImpact,
      implementationSteps: [
        '1. Log into Google Ads',
        `2. Navigate to campaign: ${analysis.campaignName}`,
        '3. Go to Settings > Budget',
        `4. Change daily budget from $${analysis.dailyBudget.toFixed(2)} to $${recommendedBudget.toFixed(2)}`,
        '5. Save changes and monitor performance'
      ],
      reasoning: analysis.impactMessage
    };
    
    res.json(implementationGuide);
    
  } catch (error: any) {
    console.error('[BUDGET-PACING] Apply recommendation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to map risk level to pacing status
 */
function mapRiskLevelToPacingStatus(riskLevel: string, projectedOverage: number): string {
  if (riskLevel === 'CRITICAL') {
    return projectedOverage > 0 ? 'EXHAUSTED' : 'AT_RISK';
  }
  if (riskLevel === 'HIGH') {
    return projectedOverage > 0 ? 'OVERSPENDING' : 'UNDERSPENDING';
  }
  if (riskLevel === 'MEDIUM') {
    return 'AT_RISK';
  }
  return 'ON_TRACK';
}

/**
 * Helper function to calculate weekly trend
 */
function calculateWeeklyTrend(analysis: any): 'up' | 'down' | 'stable' {
  // Simple heuristic based on spend variance
  if (analysis.spendVariancePercentage > 10) return 'up';
  if (analysis.spendVariancePercentage < -10) return 'down';
  return 'stable';
}

/**
 * Helper function to generate budget insights
 */
function generateBudgetInsights(analyses: any[]): any[] {
  const insights = [];
  
  // Critical overspending insight
  const criticalCampaigns = analyses.filter(a => a.riskLevel === 'CRITICAL' && a.projectedOverage > 0);
  if (criticalCampaigns.length > 0) {
    const totalOverage = criticalCampaigns.reduce((sum, c) => sum + c.projectedOverage, 0);
    insights.push({
      type: 'critical',
      title: 'Critical Budget Overspend Risk',
      description: `${criticalCampaigns.length} campaigns are at risk of significant overspending`,
      impact: `$${totalOverage.toFixed(0)} potential overspend`,
      action: 'Reduce budgets immediately',
      campaignIds: criticalCampaigns.map(c => c.campaignId)
    });
  }
  
  // Revenue opportunity insight
  const underSpendingCampaigns = analyses.filter(a => a.projectedOverage < -500);
  if (underSpendingCampaigns.length > 0) {
    const totalOpportunity = underSpendingCampaigns.reduce((sum, c) => sum + Math.abs(c.projectedOverage), 0);
    insights.push({
      type: 'opportunity',
      title: 'Revenue Opportunity Available',
      description: `${underSpendingCampaigns.length} campaigns have unused budget capacity`,
      impact: `$${totalOpportunity.toFixed(0)} additional revenue potential`,
      action: 'Increase budgets to capture opportunity',
      campaignIds: underSpendingCampaigns.map(c => c.campaignId)
    });
  }
  
  // Performance optimization insight
  const highConfidenceCampaigns = analyses.filter(a => a.confidenceScore > 0.8 && a.riskLevel !== 'LOW');
  if (highConfidenceCampaigns.length > 0) {
    insights.push({
      type: 'warning',
      title: 'High-Confidence Optimization Needed',
      description: `${highConfidenceCampaigns.length} campaigns need immediate budget adjustments`,
      impact: 'Prevent budget waste and capture opportunities',
      action: 'Review and apply AI recommendations',
      campaignIds: highConfidenceCampaigns.map(c => c.campaignId)
    });
  }
  
  return insights;
}

export default router;
