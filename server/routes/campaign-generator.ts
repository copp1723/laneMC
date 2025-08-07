import { Router } from 'express';
import { campaignGenerator } from '../services/campaign-generator';
import { storage } from '../storage';
import { authenticateToken } from '../services/auth';

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

export { router as campaignGeneratorRouter };