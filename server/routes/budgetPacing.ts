import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../services/auth';
import { storage } from '../storage';
import { budgetPacingService } from '../services/budget-pacing';
import { googleAdsService } from '../services/google-ads';

const router = Router();

router.get('/accounts/:accountId/status', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const mockStatus = [
      { campaignId: 'campaign_1', currentSpend: 850, dailyBudget: 100, recommendedBudget: 95, pacingStatus: 'on_track', daysRemaining: 12, projectedSpend: 2990, confidenceScore: 0.85 },
    ];
    res.json({ success: true, data: mockStatus });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:accountId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.params;
    const { campaignId } = req.query;
    const result = await budgetPacingService.getBudgetStatus(accountId, campaignId as string);
    res.json(result);
  } catch (error) {
    console.error('Error getting budget status:', error);
    res.status(500).json({ error: 'Failed to get budget status' });
  }
});

router.post('/:accountId/:campaignId/apply', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (googleAdsService.isReadOnly()) {
      return res.status(403).json({ error: 'Read-only mode enabled: Applying budget changes is disabled.' });
    }
    const { accountId, campaignId } = req.params;
    const { recommendedBudget } = req.body;
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    await googleAdsService.updateCampaignBudget(account.customerId, campaignId, recommendedBudget);
    res.json({ success: true, appliedBudget: recommendedBudget });
  } catch (error) {
    console.error('Error applying budget recommendation:', error);
    res.status(500).json({ error: 'Failed to apply budget recommendation' });
  }
});

export default router;
