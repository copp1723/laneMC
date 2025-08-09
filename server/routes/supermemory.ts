import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../services/auth';
import { storage } from '../storage';
import { supermemoryService } from '../services/supermemory';
import { googleAdsService } from '../services/google-ads';

const router = Router();

router.get('/connections', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const connections = await storage.getSupermemoryConnections(req.user!.id);
    res.json(connections);
  } catch (error: any) {
    console.error('Error getting Supermemory connections:', error);
    res.status(500).json({ error: 'Failed to get connections' });
  }
});

router.post('/connections', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { provider, accessToken, refreshToken, containerTags, documentLimit } = req.body;
    const connectionId = await supermemoryService.createConnection({ provider, accessToken, refreshToken, containerTags, documentLimit });
    const connection = await storage.createSupermemoryConnection({ userId: req.user!.id, connectionId, provider, containerTags, documentLimit, metadata: { accessToken: !!accessToken, refreshToken: !!refreshToken } });
    res.json(connection);
  } catch (error: any) {
    console.error('Error creating Supermemory connection:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

router.delete('/connections/:connectionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { connectionId } = req.params;
    const connection = await storage.getSupermemoryConnectionByConnectionId(connectionId);
    if (!connection || connection.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    await supermemoryService.deleteConnection(connectionId, connection.containerTags as string[]);
    await storage.deleteSupermemoryConnection(connection.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting Supermemory connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

router.get('/memories', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { containerTags } = req.query;
    const tagArray = containerTags ? (containerTags as string).split(',') : undefined;
    const memories = await storage.getSupermemoryMemories(req.user!.id, tagArray);
    res.json(memories);
  } catch (error: any) {
    console.error('Error getting Supermemory memories:', error);
    res.status(500).json({ error: 'Failed to get memories' });
  }
});

router.post('/memories', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { content, title, type, connectionId, containerTags, url, summary, customId } = req.body;
    const memoryId = await supermemoryService.addMemory({ content, title, type, connectionId, containerTags, url, summary, customId });
    const memory = await storage.createSupermemoryMemory({ userId: req.user!.id, memoryId, customId, connectionId, title, content, summary, url, type: type || 'text', status: 'processing', containerTags, metadata: { source: 'api' } });
    res.json(memory);
  } catch (error: any) {
    console.error('Error creating Supermemory memory:', error);
    res.status(500).json({ error: 'Failed to create memory' });
  }
});

router.get('/memories/:memoryId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { memoryId } = req.params;
    const localMemory = await storage.getSupermemoryMemoryByMemoryId(memoryId);
    if (!localMemory || localMemory.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    const apiMemory = await supermemoryService.getMemory(memoryId);
    await storage.updateSupermemoryMemory(localMemory.id, { title: apiMemory.title, content: apiMemory.content, summary: apiMemory.summary, status: apiMemory.status, ogImage: (apiMemory as any).og_image, source: apiMemory.source });
    res.json({ ...localMemory, ...apiMemory });
  } catch (error: any) {
    console.error('Error getting Supermemory memory:', error);
    res.status(500).json({ error: 'Failed to get memory' });
  }
});

router.delete('/memories/:memoryId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { memoryId } = req.params;
    const memory = await storage.getSupermemoryMemoryByMemoryId(memoryId);
    if (!memory || memory.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    await supermemoryService.deleteMemory(memoryId);
    await storage.deleteSupermemoryMemory(memory.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting Supermemory memory:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { q, containerTags } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    const tagArray = containerTags ? (containerTags as string).split(',') : undefined;
    const results = await supermemoryService.searchMemories(q as string, tagArray);
    res.json(results);
  } catch (error: any) {
    console.error('Error searching Supermemory:', error);
    res.status(500).json({ error: 'Failed to search memories' });
  }
});

router.post('/campaign-data/:accountId/:campaignId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId, campaignId } = req.params;
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account || account.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const campaigns = await googleAdsService.getCampaigns(account.customerId);
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const memoryId = await supermemoryService.addCampaignMemory(campaign, accountId, account.customerId);
    res.json({ success: true, memoryId, message: 'Campaign data stored in Supermemory' });
  } catch (error: any) {
    console.error('Error storing campaign data in Supermemory:', error);
    res.status(500).json({ error: 'Failed to store campaign data' });
  }
});

router.post('/performance-data/:accountId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.params;
    const { campaignId, dateRange } = req.body as { campaignId?: string; dateRange?: string };
    const account = await storage.getGoogleAdsAccount(accountId);
    if (!account || account.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const metrics = await googleAdsService.getPerformanceMetrics(account.customerId, campaignId, dateRange || 'LAST_30_DAYS');
    const memoryId = await supermemoryService.addPerformanceMemory(metrics, accountId, account.customerId, campaignId);
    res.json({ success: true, memoryId, message: 'Performance data stored in Supermemory' });
  } catch (error: any) {
    console.error('Error storing performance data in Supermemory:', error);
    res.status(500).json({ error: 'Failed to store performance data' });
  }
});

export default router;
