import { Router } from 'express';
import { campaignGenerator } from '../services/campaign-generator';
import { storage } from '../storage';
import { authenticateToken } from '../services/auth';
import { googleAdsService } from '../services/google-ads';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// Generate campaign from conversation
router.post('/generate-from-conversation', async (req, res) => {
  try {
    const { conversationId, sessionId } = req.body;
    
    if (!conversationId && !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Either conversationId or sessionId is required'
      });
    }
    
    // Get chat messages from the conversation
    const messages = await storage.getChatMessages(sessionId || conversationId);
    
    const result = await campaignGenerator.generateFromConversation(
      conversationId || sessionId,
      messages
    );
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    console.error('Campaign generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate campaign from structured brief
router.post('/generate-from-brief', async (req, res) => {
  try {
    const { brief, conversationId } = req.body;
    
    if (!brief) {
      return res.status(400).json({
        success: false,
        error: 'Campaign brief is required'
      });
    }
    
    // Convert brief to message format for the generator
    const messages = [
      {
        id: 'brief-input',
        role: 'user' as const,
        content: `Please create a Google Ads campaign with the following requirements: ${JSON.stringify(brief)}`,
        createdAt: new Date(),
        sessionId: conversationId || 'brief-generation',
        metadata: {}
      }
    ];
    
    const result = await campaignGenerator.generateFromConversation(
      conversationId || 'brief-generation',
      messages
    );
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    console.error('Campaign generation from brief error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Approve a generated draft campaign (promote status from draft to approved)
router.post('/approve/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
    await storage.updateCampaign(campaignId, { status: 'APPROVED' as any });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Apply (create in Google Ads) an approved campaign if not yet pushed
router.post('/apply/:campaignId', async (req, res) => {
  try {
    if (googleAdsService.isReadOnly()) {
      return res.status(403).json({ success: false, error: 'Read-only mode enabled: Applying campaigns is disabled.' });
    }

    const { campaignId } = req.params;
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
    if (campaign.status !== 'APPROVED') {
      return res.status(400).json({ success: false, error: 'Campaign must be APPROVED before apply' });
    }
    if (campaign.googleCampaignId) {
      return res.json({ success: true, message: 'Already applied', googleCampaignId: campaign.googleCampaignId });
    }
    if (!campaign.googleAdsAccountId) {
      return res.status(400).json({ success: false, error: 'Missing googleAdsAccountId on campaign' });
    }
    const account = await storage.getGoogleAdsAccount(campaign.googleAdsAccountId);
    if (!account) return res.status(404).json({ success: false, error: 'Google Ads account not found' });

    // Extract minimal spec from generationArtifact raw data if present
    const artifact: any = (campaign as any).generationArtifact || {};
    const raw = artifact.raw || {};
    const spec = {
      name: campaign.name,
      type: campaign.type,
      budget: Number(campaign.budget) || 1000,
      targetLocations: raw.targetLocations || [],
      keywords: raw.keywords?.suggested || raw.keywords || [],
      bidStrategy: raw.biddingStrategy?.type || 'MAXIMIZE_CLICKS'
    };

    const googleId = await googleAdsService.createCampaign(account.customerId, spec);
    await storage.updateCampaign(campaignId, { googleCampaignId: googleId, status: 'PAUSED' as any });

    res.json({ success: true, googleCampaignId: googleId });
  } catch (e: any) {
    console.error('Apply campaign failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export { router as campaignGeneratorRouter };