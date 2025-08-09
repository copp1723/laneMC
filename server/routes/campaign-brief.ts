import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../services/auth';
import { storage } from '../storage';
import { campaignBriefGeneratorService } from '../services/campaign-brief-generator';
import { googleAdsService } from '../services/google-ads';
import { insertCampaignBriefSchema } from '@shared/schema';

const router = Router();

router.post('/campaign-brief/generate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId, accountId } = req.body;
    if (!sessionId || !accountId) {
      return res.status(400).json({ success: false, error: 'Session ID and Account ID are required' });
    }
    const messages = await storage.getChatMessages(sessionId);
    const result = await campaignBriefGeneratorService.generateFromConversation(sessionId, messages, accountId);
    res.json(result);
  } catch (error: any) {
    console.error('Campaign brief generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/campaign-brief/:briefId/refine', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { briefId } = req.params;
    const { feedback, requestedChanges } = req.body;
    const result = await campaignBriefGeneratorService.reviewAndRefineBreif(briefId, feedback || '', requestedChanges || []);
    res.json(result);
  } catch (error: any) {
    console.error('Brief refinement failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/campaigns/create-from-brief', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (googleAdsService.isReadOnly()) {
      return res.status(403).json({ success: false, error: 'Read-only mode enabled: Campaign creation is disabled.' });
    }
    const { briefId, accountId } = req.body;
    if (!briefId || !accountId) {
      return res.status(400).json({ success: false, error: 'Brief ID and Account ID are required' });
    }
    const brief = await storage.getCampaignBrief(briefId);
    if (!brief) {
      return res.status(404).json({ success: false, error: 'Campaign brief not found' });
    }
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Google Ads account not found' });
    }
    const campaignData = {
      name: brief.title,
      type: 'SEARCH',
      budget: parseFloat((brief.budget as any) || '100'),
      bidStrategy: 'MAXIMIZE_CLICKS',
      keywords: Array.isArray((brief as any).objectives) ? (brief as any).objectives : [],
      adGroups: [{ name: 'Ad Group 1', ads: [] as any[] }],
      targetLocations: [] as string[],
    };
    const googleCampaignId = await googleAdsService.createCampaign(account.customerId, campaignData as any);
    const campaign = await storage.createCampaign({ googleAdsAccountId: accountId, googleCampaignId, name: brief.title, type: 'SEARCH', status: 'PAUSED', budget: brief.budget, keywords: { primary: campaignData.keywords }, adGroups: campaignData.adGroups });
    res.json({ success: true, campaignId: campaign.id, googleCampaignId });
  } catch (error: any) {
    console.error('Campaign creation from brief failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/campaign-briefs', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.query;
    if (!accountId) {
      return res.status(400).json({ message: 'Account ID is required' });
    }
    const briefs = await storage.getCampaignBriefs(accountId as string);
    res.json(briefs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/campaign-briefs', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const briefData = insertCampaignBriefSchema.parse({ ...req.body, userId: req.user!.id });
    const brief = await storage.createCampaignBrief(briefData);
    res.json(brief);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/campaign-briefs/:briefId', authenticateToken, async (req, res) => {
  try {
    const { briefId } = req.params;
    const updates = req.body;
    const brief = await storage.updateCampaignBrief(briefId, updates);
    if (!brief) {
      return res.status(404).json({ message: 'Campaign brief not found' });
    }
    res.json(brief);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
