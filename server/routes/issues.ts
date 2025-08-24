/**
 * Issues Detection API Routes
 * Provides intelligent issue detection and health scoring
 */

import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../services/auth';
import { issueDetectionService } from '../services/issue-detection';

const router = Router();

/**
 * GET /api/issues/detect
 * Detect issues for an account
 */
router.get('/detect', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required'
      });
    }
    
    console.log(`[ISSUES] Detecting issues for account: ${accountId}`);
    const issues = await issueDetectionService.detectAccountIssues(accountId as string);
    
    console.log(`[ISSUES] Found ${issues.length} issues`);
    
    res.json(issues);
    
  } catch (error: any) {
    console.error('[ISSUES] Issue detection failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/issues/health-score
 * Calculate account health score
 */
router.get('/health-score', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required'
      });
    }
    
    console.log(`[ISSUES] Calculating health score for account: ${accountId}`);
    const healthScore = await issueDetectionService.calculateHealthScore(accountId as string);
    
    console.log(`[ISSUES] Health score: ${healthScore.score} (${healthScore.grade})`);
    
    res.json(healthScore);
    
  } catch (error: any) {
    console.error('[ISSUES] Health score calculation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/issues/actionable
 * Get actionable alerts for quick insights
 */
router.get('/actionable', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required'
      });
    }
    
    console.log(`[ISSUES] Getting actionable alerts for account: ${accountId}`);
    const issues = await issueDetectionService.detectAccountIssues(accountId as string);
    
    // Transform to actionable alerts format
    const actionableAlerts = issues
      .filter(issue => issue.severity === 'critical' || issue.severity === 'high')
      .slice(0, 3) // Top 3 most critical
      .map(issue => ({
        id: issue.id,
        type: mapIssueTypeToAlertType(issue.type),
        title: issue.title,
        description: issue.description,
        ctaText: generateCTAText(issue.type),
        ctaLink: `/campaigns/${issue.campaignId}`
      }));
    
    console.log(`[ISSUES] Returning ${actionableAlerts.length} actionable alerts`);
    
    res.json(actionableAlerts);
    
  } catch (error: any) {
    console.error('[ISSUES] Actionable alerts failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/issues/summary
 * Get issues summary for dashboard
 */
router.get('/summary', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required'
      });
    }
    
    console.log(`[ISSUES] Getting issues summary for account: ${accountId}`);
    
    const [issues, healthScore] = await Promise.all([
      issueDetectionService.detectAccountIssues(accountId as string),
      issueDetectionService.calculateHealthScore(accountId as string)
    ]);
    
    const summary = {
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      mediumIssues: issues.filter(i => i.severity === 'medium').length,
      lowIssues: issues.filter(i => i.severity === 'low').length,
      healthScore: healthScore.score,
      healthGrade: healthScore.grade,
      topIssue: issues.length > 0 ? {
        title: issues[0].title,
        severity: issues[0].severity,
        campaignName: issues[0].campaignName
      } : null,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`[ISSUES] Summary: ${summary.totalIssues} total issues, health score ${summary.healthScore}`);
    
    res.json(summary);
    
  } catch (error: any) {
    console.error('[ISSUES] Issues summary failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to map issue type to alert type
 */
function mapIssueTypeToAlertType(issueType: string): string {
  switch (issueType) {
    case 'BUDGET_OVERSPEND':
      return 'BUDGET';
    case 'PERFORMANCE_DROP':
    case 'QUALITY_SCORE':
    case 'BID_STRATEGY':
      return 'PERFORMANCE';
    case 'DISAPPROVAL':
    case 'ANOMALY':
      return 'POLICY';
    default:
      return 'PERFORMANCE';
  }
}

/**
 * Helper function to generate CTA text
 */
function generateCTAText(issueType: string): string {
  switch (issueType) {
    case 'BUDGET_OVERSPEND':
      return 'Adjust Budget';
    case 'PERFORMANCE_DROP':
      return 'Optimize Performance';
    case 'QUALITY_SCORE':
      return 'Improve Quality';
    case 'DISAPPROVAL':
      return 'Fix Approval';
    case 'BID_STRATEGY':
      return 'Update Bids';
    case 'ANOMALY':
      return 'Investigate';
    default:
      return 'View Details';
  }
}

export default router;
