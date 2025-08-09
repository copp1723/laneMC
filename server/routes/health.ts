import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || 'development',
    services: {
      budgetPacing: 'operational',
      monitoring: 'operational',
      analytics: 'operational',
      campaignGenerator: 'operational',
      scheduler: 'operational',
    },
  });
});

export default router;
