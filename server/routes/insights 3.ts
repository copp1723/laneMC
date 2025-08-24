/**
 * Insights API Routes
 * Provides business impact opportunities and recommendations
 */

import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../services/auth';
import { surgicalBudgetAnalysis } from '../services/surgical-budget-analysis';
import { issueDetectionService } from '../services/issue-detection';

const router = Router();

/**
 * GET /api/insights/opportunities
 * Get impact opportunities for an account
 */
router.get('/opportunities', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required'
      });
    }
    
    console.log(`[INSIGHTS] Getting opportunities for account: ${accountId}`);
    
    const budgetAnalyses = await surgicalBudgetAnalysis.analyzeAccountBudgets(accountId as string);
    
    // Generate impact opportunities
    const opportunities = generateImpactOpportunities(budgetAnalyses);
    
    console.log(`[INSIGHTS] Found ${opportunities.length} opportunities`);
    
    res.json(opportunities);
    
  } catch (error: any) {
    console.error('[INSIGHTS] Opportunities generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/insights/recommendations
 * Get prioritized recommendations for an account
 */
router.get('/recommendations', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required'
      });
    }
    
    console.log(`[INSIGHTS] Getting recommendations for account: ${accountId}`);
    
    const [budgetAnalyses, issues] = await Promise.all([
      surgicalBudgetAnalysis.analyzeAccountBudgets(accountId as string),
      issueDetectionService.detectAccountIssues(accountId as string)
    ]);
    
    // Generate prioritized recommendations
    const recommendations = generatePrioritizedRecommendations(budgetAnalyses, issues);
    
    console.log(`[INSIGHTS] Generated ${recommendations.length} recommendations`);
    
    res.json(recommendations);
    
  } catch (error: any) {
    console.error('[INSIGHTS] Recommendations generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/insights/business-impact
 * Get business impact analysis for an account
 */
router.get('/business-impact', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required'
      });
    }
    
    console.log(`[INSIGHTS] Calculating business impact for account: ${accountId}`);
    
    const budgetAnalyses = await surgicalBudgetAnalysis.analyzeAccountBudgets(accountId as string);
    
    // Calculate business impact metrics
    const businessImpact = calculateBusinessImpact(budgetAnalyses);
    
    console.log(`[INSIGHTS] Business impact: $${businessImpact.totalOpportunity} total opportunity`);
    
    res.json(businessImpact);
    
  } catch (error: any) {
    console.error('[INSIGHTS] Business impact calculation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to generate impact opportunities
 */
function generateImpactOpportunities(budgetAnalyses: any[]): any[] {
  const opportunities = [];
  
  // Revenue opportunities from underspending campaigns
  const underSpendingCampaigns = budgetAnalyses.filter(a => a.projectedOverage < -200);
  for (const campaign of underSpendingCampaigns) {
    const revenueOpportunity = Math.abs(campaign.projectedOverage);
    opportunities.push({
      id: `revenue_${campaign.campaignId}`,
      type: 'REVENUE',
      title: `Revenue Opportunity: ${campaign.campaignName}`,
      description: `Campaign is underspending with potential for additional revenue`,
      estimatedValue: Math.round(revenueOpportunity),
      period: 'monthly'
    });
  }
  
  // Savings opportunities from overspending campaigns
  const overSpendingCampaigns = budgetAnalyses.filter(a => a.projectedOverage > 200);
  for (const campaign of overSpendingCampaigns) {
    const savingsOpportunity = campaign.projectedOverage;
    opportunities.push({
      id: `savings_${campaign.campaignId}`,
      type: 'SAVINGS',
      title: `Cost Savings: ${campaign.campaignName}`,
      description: `Campaign is overspending and can be optimized`,
      estimatedValue: Math.round(savingsOpportunity),
      period: 'monthly'
    });
  }
  
  // Sort by estimated value (highest first)
  return opportunities
    .sort((a, b) => b.estimatedValue - a.estimatedValue)
    .slice(0, 5); // Top 5 opportunities
}

/**
 * Helper function to generate prioritized recommendations
 */
function generatePrioritizedRecommendations(budgetAnalyses: any[], issues: any[]): any[] {
  const recommendations = [];
  
  // Budget recommendations
  const criticalBudgetCampaigns = budgetAnalyses.filter(a => a.riskLevel === 'CRITICAL');
  for (const campaign of criticalBudgetCampaigns) {
    recommendations.push({
      id: `budget_${campaign.campaignId}`,
      priority: 1,
      type: 'BUDGET_ADJUSTMENT',
      title: `Critical Budget Issue: ${campaign.campaignName}`,
      description: campaign.impactMessage,
      action: campaign.actionRequired,
      expectedImpact: campaign.businessImpact,
      urgencyScore: campaign.urgencyScore,
      confidenceScore: Math.round(campaign.confidenceScore * 100)
    });
  }
  
  // Issue-based recommendations
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  for (const issue of criticalIssues) {
    recommendations.push({
      id: `issue_${issue.id}`,
      priority: issue.severity === 'critical' ? 1 : 2,
      type: 'ISSUE_RESOLUTION',
      title: issue.title,
      description: issue.description,
      action: issue.recommendations[0] || 'Review and optimize',
      expectedImpact: 'Improve campaign performance and prevent issues',
      urgencyScore: 80,
      confidenceScore: Math.round(issue.confidenceScore * 100)
    });
  }
  
  // Sort by priority and urgency
  return recommendations
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.urgencyScore - a.urgencyScore;
    })
    .slice(0, 10); // Top 10 recommendations
}

/**
 * Helper function to calculate business impact
 */
function calculateBusinessImpact(budgetAnalyses: any[]): any {
  const totalBudget = budgetAnalyses.reduce((sum, a) => sum + a.monthlyBudget, 0);
  const totalCurrentSpend = budgetAnalyses.reduce((sum, a) => sum + a.currentSpend, 0);
  const totalProjectedSpend = budgetAnalyses.reduce((sum, a) => sum + a.projectedMonthEndSpend, 0);
  
  const potentialSavings = budgetAnalyses
    .filter(a => a.projectedOverage > 0)
    .reduce((sum, a) => sum + a.projectedOverage, 0);
    
  const revenueOpportunity = budgetAnalyses
    .filter(a => a.projectedOverage < 0)
    .reduce((sum, a) => sum + Math.abs(a.projectedOverage), 0);
  
  const totalOpportunity = potentialSavings + revenueOpportunity;
  
  const criticalCampaigns = budgetAnalyses.filter(a => a.riskLevel === 'CRITICAL').length;
  const highRiskCampaigns = budgetAnalyses.filter(a => a.riskLevel === 'HIGH').length;
  
  return {
    totalBudget: Math.round(totalBudget),
    currentSpend: Math.round(totalCurrentSpend),
    projectedSpend: Math.round(totalProjectedSpend),
    budgetUtilization: totalBudget > 0 ? Math.round((totalCurrentSpend / totalBudget) * 100) : 0,
    potentialSavings: Math.round(potentialSavings),
    revenueOpportunity: Math.round(revenueOpportunity),
    totalOpportunity: Math.round(totalOpportunity),
    campaignsAnalyzed: budgetAnalyses.length,
    criticalCampaigns,
    highRiskCampaigns,
    optimizationScore: calculateOptimizationScore(budgetAnalyses),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Helper function to calculate optimization score
 */
function calculateOptimizationScore(budgetAnalyses: any[]): number {
  if (budgetAnalyses.length === 0) return 0;
  
  const onTrackCampaigns = budgetAnalyses.filter(a => a.riskLevel === 'LOW').length;
  const totalCampaigns = budgetAnalyses.length;
  
  return Math.round((onTrackCampaigns / totalCampaigns) * 100);
}

export default router;
