import { Router } from 'express';
import { budgetPacingService } from '../services/budget-pacing';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get budget status for account or specific campaign
router.get('/accounts/:accountId/budget-status', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { campaignId } = req.query;
    
    const status = await budgetPacingService.getBudgetStatus(
      accountId, 
      campaignId as string | undefined
    );
    
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    console.error('Budget status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start budget monitoring
router.post('/monitoring/start', async (req, res) => {
  try {
    await budgetPacingService.startMonitoring();
    
    res.json({
      success: true,
      message: 'Budget monitoring started'
    });
  } catch (error: any) {
    console.error('Start monitoring error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop budget monitoring
router.post('/monitoring/stop', async (req, res) => {
  try {
    await budgetPacingService.stopMonitoring();
    
    res.json({
      success: true,
      message: 'Budget monitoring stopped'
    });
  } catch (error: any) {
    console.error('Stop monitoring error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export { router as budgetPacingRouter };