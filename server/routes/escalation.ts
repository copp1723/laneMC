import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../services/auth';
import { storage } from '../storage';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { accountId } = req.query;
    const settings = await storage.getEscalationSettings(userId, accountId as string);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const settingData = { ...req.body, userId };
    const setting = await storage.createEscalationSetting(settingData);
    res.status(201).json(setting);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const setting = await storage.updateEscalationSetting(id, updates);
    if (!setting) {
      return res.status(404).json({ message: 'Escalation setting not found' });
    }
    res.json(setting);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await storage.deleteEscalationSetting(id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
