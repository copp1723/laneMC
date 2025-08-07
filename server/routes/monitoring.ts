import { Router } from 'express';
import { monitoringService } from '../services/monitoring';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get campaign health status
router.get('/accounts/:accountId/campaigns/:campaignId/health', async (req, res) => {
  try {
    const { accountId, campaignId } = req.params;
    
    const health = await monitoringService.getCampaignHealth(accountId, campaignId);
    
    res.json({
      success: true,
      data: health
    });
  } catch (error: any) {
    console.error('Campaign health check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get active issues for a campaign
router.get('/campaigns/:campaignId/issues', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const issues = await monitoringService.getActiveIssues(campaignId);
    
    res.json({
      success: true,
      data: issues
    });
  } catch (error: any) {
    console.error('Get issues error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Resolve an issue
router.post('/issues/:issueId/resolve', async (req, res) => {
  try {
    const { issueId } = req.params;
    const { resolution } = req.body;
    
    if (!resolution) {
      return res.status(400).json({
        success: false,
        error: 'Resolution description is required'
      });
    }
    
    await monitoringService.resolveIssue(issueId, resolution);
    
    res.json({
      success: true,
      message: 'Issue resolved successfully'
    });
  } catch (error: any) {
    console.error('Resolve issue error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Dismiss an issue
router.post('/issues/:issueId/dismiss', async (req, res) => {
  try {
    const { issueId } = req.params;
    
    await monitoringService.dismissIssue(issueId);
    
    res.json({
      success: true,
      message: 'Issue dismissed successfully'
    });
  } catch (error: any) {
    console.error('Dismiss issue error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start monitoring service
router.post('/start', async (req, res) => {
  try {
    await monitoringService.startMonitoring();
    
    res.json({
      success: true,
      message: 'Monitoring service started'
    });
  } catch (error: any) {
    console.error('Start monitoring error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop monitoring service
router.post('/stop', async (req, res) => {
  try {
    await monitoringService.stopMonitoring();
    
    res.json({
      success: true,
      message: 'Monitoring service stopped'
    });
  } catch (error: any) {
    console.error('Stop monitoring error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export { router as monitoringRouter };