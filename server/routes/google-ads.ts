import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../services/auth';
import { storage } from '../storage';
import { googleAdsService } from '../services/google-ads';

const router = Router();

// GET /api/google-ads/test-live
router.get('/test-live', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    const originalIsMock = (googleAdsService as any).isMockMode;
    (googleAdsService as any).isMockMode = false;
    const accounts = await googleAdsService.getAccessibleCustomers();
    (googleAdsService as any).isMockMode = originalIsMock;
    res.json({ success: true, message: 'Live Google Ads connection successful!', mode: 'LIVE', accountCount: accounts.length, accounts: accounts.slice(0, 5) });
  } catch (error: any) {
    console.error('Live Google Ads connection test failed:', error);
    res.status(500).json({ success: false, error: error.message, message: 'Failed to connect to live Google Ads accounts', mode: 'LIVE' });
  }
});

// GET /api/google-ads/accounts
router.get('/accounts', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    let accounts = await storage.getGoogleAdsAccounts(userId);
    if (accounts.length === 0) {
      try {
        const customerIds = await googleAdsService.getAccessibleCustomers();
        for (const resourceName of customerIds) {
          const customerId = resourceName.replace('customers/', '');
          try {
            const customerInfo = await googleAdsService.getCustomerInfo(customerId);
            await storage.createGoogleAdsAccount({ userId, customerId, name: customerInfo.name, currency: customerInfo.currency, timezone: customerInfo.timezone, isActive: true });
          } catch (err) {
            console.error(`Failed to sync customer ${customerId}:`, err);
          }
        }
        accounts = await storage.getGoogleAdsAccounts(userId);
      } catch (err) {
        console.error('Failed to auto-sync accounts from Google Ads API:', err);
      }
    }
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/google-ads/campaigns
router.post('/campaigns', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (googleAdsService.isReadOnly()) {
      return res.status(403).json({ message: 'Read-only mode enabled: Campaign creation is disabled.' });
    }
    const { accountId, campaignData } = req.body;
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) {
      return res.status(404).json({ message: 'Google Ads account not found' });
    }
    const googleCampaignId = await googleAdsService.createCampaign(account.customerId, campaignData);
    const campaign = await storage.createCampaign({ googleAdsAccountId: accountId, googleCampaignId, name: campaignData.name, type: campaignData.type.toUpperCase(), budget: campaignData.budget, bidStrategy: campaignData.bidStrategy, targetLocations: campaignData.targetLocations, keywords: campaignData.keywords });
    res.json({ message: 'Campaign created successfully', campaign: { id: campaign.id, googleCampaignId, name: campaign.name, status: 'PAUSED' } });
  } catch (error: any) {
    console.error('Campaign creation error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/google-ads/campaigns/:campaignId/budget
router.put('/campaigns/:campaignId/budget', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (googleAdsService.isReadOnly()) {
      return res.status(403).json({ message: 'Read-only mode enabled: Budget updates are disabled.' });
    }
    const { campaignId } = req.params;
    const { budget } = req.body;
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    const account = await storage.getGoogleAdsAccount(campaign.googleAdsAccountId!);
    if (!account) {
      return res.status(404).json({ message: 'Google Ads account not found' });
    }
    if (campaign.googleCampaignId) {
      await googleAdsService.updateCampaignBudget(account.customerId, campaign.googleCampaignId, budget);
    }
    await storage.updateCampaign(campaignId, { budget });
    res.json({ message: 'Campaign budget updated successfully', newBudget: budget });
  } catch (error: any) {
    console.error('Budget update error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/google-ads/accounts/sync
router.post('/accounts/sync', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const customerIds = await googleAdsService.getAccessibleCustomers();
    for (const resourceName of customerIds) {
      const customerId = resourceName.replace('customers/', '');
      try {
        const customerInfo = await googleAdsService.getCustomerInfo(customerId);
        const existingAccount = await storage.getGoogleAdsAccountByCustomerId(customerId);
        if (!existingAccount) {
          await storage.createGoogleAdsAccount({ userId: req.user!.id, customerId, name: customerInfo.name, currency: customerInfo.currency, timezone: customerInfo.timezone, isActive: true });
        }
      } catch (err) {
        console.error(`Failed to sync customer ${customerId}:`, err);
      }
    }
    const accounts = await storage.getGoogleAdsAccounts(req.user!.id);
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/google-ads/accounts/:accountId/metrics
router.get('/accounts/:accountId/metrics', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.params;
    const { campaignId, dateRange } = req.query as { campaignId?: string; dateRange?: string };
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    const metrics = await googleAdsService.getPerformanceMetrics(account.customerId, campaignId as string, dateRange || 'TODAY');
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/google-ads/accounts/:accountId/campaigns
router.get('/accounts/:accountId/campaigns', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.params;
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    const campaigns = await googleAdsService.getCampaigns(account.customerId);
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/google-ads/accounts/:accountId/pacing
router.get('/accounts/:accountId/pacing', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.params;
    const budgetPacing = await storage.getBudgetPacing(accountId);
    res.json(budgetPacing);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/google-ads/test-connection
router.get('/test-connection', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    const accessibleCustomers = await googleAdsService.getAccessibleCustomers();
    const customerTests: any[] = [];
    for (const customerId of accessibleCustomers.slice(0, 3)) {
      try {
        const customerInfo = await googleAdsService.getCustomerInfo(customerId);
        customerTests.push({ customerId, status: 'success' as const, info: customerInfo });
      } catch (error: any) {
        customerTests.push({ customerId, status: 'error' as const, error: error.message });
      }
    }
    res.json({ success: true, timestamp: new Date().toISOString(), results: { accessibleCustomers, customerTests }, summary: { totalAccessibleCustomers: accessibleCustomers.length, successfulCustomers: customerTests.filter((t) => t.status === 'success').length } });
  } catch (error: any) {
    console.error('❌ Google Ads API test failed:', error);
    res.status(500).json({ success: false, error: error.message, suggestion: error.message.includes('invalid_grant') ? 'Refresh token expired - regenerate using OAuth Playground' : error.message.includes('invalid_client') ? 'Check OAuth Client ID/Secret in Google Cloud Console' : 'Check Google Ads API credentials and permissions' });
  }
});

export default router;
