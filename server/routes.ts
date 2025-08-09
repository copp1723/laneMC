import type { Express } from 'express';
import { createServer, type Server } from 'http';

import authRoutes from './routes/auth';
import googleAdsRoutes from './routes/google-ads';
import campaignBriefRoutes from './routes/campaign-brief';
import chatRoutes from './routes/chat';
import settingsRoutes from './routes/settings';
import supermemoryRoutes from './routes/supermemory';
import issuesRoutes from './routes/issues';
import escalationRoutes from './routes/escalation';
import analyticsRoutes from './routes/analytics';
import budgetPacingRoutes from './routes/budgetPacing';
import { campaignGeneratorRouter } from './routes/campaign-generator';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Mount modular routers with proper prefixes
  app.use('/api/auth', authRoutes);
  app.use('/api/google-ads', googleAdsRoutes);
  app.use('/api', campaignBriefRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/supermemory', supermemoryRoutes);
  app.use('/api/issues', issuesRoutes);
  app.use('/api/escalation-settings', escalationRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/budget-pacing', budgetPacingRoutes);

  // Keep existing campaign generator router
  app.use('/api/campaign-generator', campaignGeneratorRouter);

  return httpServer;
}
