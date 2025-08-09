import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../services/auth';
import { storage } from '../storage';
import { openRouterService } from '../services/openrouter';
import { insertChatSessionSchema } from '@shared/schema';

const router = Router();

router.get('/sessions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.query;
    const sessions = await storage.getChatSessions(req.user!.id, accountId as string);
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/sessions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sessionData = insertChatSessionSchema.parse({ ...req.body, userId: req.user!.id });
    const session = await storage.createChatSession(sessionData);
    res.json(session);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await storage.getChatMessages(sessionId);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/sessions/:sessionId/messages', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Message content is required' });
    }
    const userMessage = await storage.createChatMessage({ sessionId, role: 'user', content });
    res.json({ message: userMessage });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/sessions/:sessionId/stream', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Message content is required' });
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    const recentMessages = await storage.getChatMessages(sessionId);
    const contextMessages = recentMessages.slice(-10).map((msg) => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));
    contextMessages.push({ role: 'user', content });
    await storage.createChatMessage({ sessionId, role: 'user', content });
    let fullResponse = '';
    await openRouterService.streamChatCompletion(
      contextMessages,
      (chunk: string) => { res.write(chunk); fullResponse += chunk; },
      async () => { await storage.createChatMessage({ sessionId, role: 'assistant', content: fullResponse }); res.end(); },
      (error: any) => { console.error('OpenRouter streaming error:', error); res.write(`\n\nError: ${error.message}`); res.end(); }
    );
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
