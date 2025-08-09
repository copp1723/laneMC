import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../services/auth';
import { issueDetectionService } from '../services/issue-detection';

const router = Router();

router.get('/detect/:accountId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.params;
    const issues = await issueDetectionService.detectAllIssues(accountId);
    res.json(issues);
  } catch (error: any) {
    console.error('Issue detection failed:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/health-score/:accountId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.params;
    const healthScore = await issueDetectionService.getAccountHealthScore(accountId);
    res.json(healthScore);
  } catch (error: any) {
    console.error('Health score calculation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
