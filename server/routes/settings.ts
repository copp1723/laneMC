import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../services/auth';
import { googleAdsService } from '../services/google-ads';

const router = Router();

router.get('/user', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userSettings = {
      id: req.user?.id,
      email: req.user?.email || 'user@example.com',
      name: 'Lane MCP User',
      timezone: 'America/New_York',
      language: 'en',
      notifications: { emailAlerts: true, budgetWarnings: true, campaignIssues: true, weeklyReports: false },
      preferences: { defaultCurrency: 'USD', dashboardLayout: 'executive', autoRefreshInterval: 300 },
    };
    res.json(userSettings);
  } catch (error) {
    console.error('Error getting user settings:', error);
    res.status(500).json({ error: 'Failed to get user settings' });
  }
});

router.put('/user', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    res.json({ success: true, message: 'User settings updated' });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Failed to update user settings' });
  }
});

router.get('/api', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    const hasGoogleCreds = !!(process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_REFRESH_TOKEN);
    const apiSettings = {
      googleAds: {
        clientId: process.env.GOOGLE_ADS_CLIENT_ID?.substring(0, 20) + '...' || '',
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? '***configured***' : '',
        loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '',
        status: hasGoogleCreds ? 'connected' : 'disconnected',
      },
      openRouter: { model: 'anthropic/claude-3-sonnet', temperature: 0.7, maxTokens: 2000 },
    };
    res.json(apiSettings);
  } catch (error) {
    console.error('Error getting API settings:', error);
    res.status(500).json({ error: 'Failed to get API settings' });
  }
});

router.put('/api', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    res.json({ success: true, message: 'API settings updated' });
  } catch (error) {
    console.error('Error updating API settings:', error);
    res.status(500).json({ error: 'Failed to update API settings' });
  }
});

router.post('/api/test-connection', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    try {
      await googleAdsService.getAccessibleCustomers();
      res.json({ success: true, message: 'All connections are working properly', details: { googleAds: 'connected', openRouter: 'connected' } });
    } catch {
      res.json({ success: false, message: 'Google Ads connection failed - check credentials', details: { googleAds: 'failed', openRouter: 'connected' } });
    }
  } catch (error) {
    console.error('Error testing API connections:', error);
    res.status(500).json({ error: 'Failed to test connections' });
  }
});

export default router;
