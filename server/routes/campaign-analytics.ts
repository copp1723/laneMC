import { Router } from 'express';
import { campaignAnalyticsService } from '../services/campaign-analytics';
import { authenticateToken } from '../services/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticateToken as any);

// Analyze campaign performance
router.get('/accounts/:accountId/campaigns/:campaignId/analysis', async (req, res) => {
  try {
    const { accountId, campaignId } = req.params;
    const { channelType = 'search' } = req.query;
    
    const analysis = await campaignAnalyticsService.analyzeCampaignPerformance(
      accountId, 
      campaignId, 
      channelType as string
    );
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    console.error('Campaign analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Forecast campaign performance
router.get('/accounts/:accountId/campaigns/:campaignId/forecast', async (req, res) => {
  try {
    const { accountId, campaignId } = req.params;
    const { daysAhead = '30' } = req.query;
    
    const forecast = await campaignAnalyticsService.forecastPerformance(
      accountId,
      campaignId,
      parseInt(daysAhead as string)
    );
    
    res.json({
      success: true,
      data: forecast
    });
  } catch (error: any) {
    console.error('Performance forecast error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Detect anomalies
router.get('/accounts/:accountId/campaigns/:campaignId/anomalies', async (req, res) => {
  try {
    const { accountId, campaignId } = req.params;
    
    const anomalies = await campaignAnalyticsService.detectAnomalies(
      accountId,
      campaignId
    );
    
    res.json({
      success: true,
      data: anomalies
    });
  } catch (error: any) {
    console.error('Anomaly detection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export { router as campaignAnalyticsRouter };