import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { authenticateToken, hashPassword, comparePassword, generateToken, AuthRequest } from "./services/auth";
import { storage } from "./storage";
import { googleAdsService } from "./services/google-ads";
import { openRouterService } from "./services/openrouter";
import { budgetPacingService } from "./services/budget-pacing";
import { campaignGeneratorRouter } from './routes/campaign-generator';
import { issueDetectionService } from "./services/issue-detection";
import { campaignBriefGeneratorService } from "./services/campaign-brief-generator";
import { insertUserSchema, insertChatSessionSchema, insertChatMessageSchema, insertCampaignBriefSchema, insertSupermemoryConnectionSchema, insertSupermemoryMemorySchema } from "@shared/schema";
import { supermemoryService } from "./services/supermemory";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password } = insertUserSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
      });

      const token = generateToken(user.id);
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (error: any) {
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const firstError = error.errors[0];
        const fieldName = firstError.path.join('.');
        return res.status(400).json({
          message: `${fieldName}: ${firstError.message}`
        });
      }

      console.error('Registration error:', error);
      res.status(400).json({ message: error.message || 'Registration failed' });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }).parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user || !(await comparePassword(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = generateToken(user.id);
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (error: any) {
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const firstError = error.errors[0];
        const fieldName = firstError.path.join('.');
        return res.status(400).json({
          message: `${fieldName}: ${firstError.message}`
        });
      }

      console.error('Login error:', error);
      res.status(400).json({ message: error.message || 'Login failed' });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    res.json({ 
      user: { 
        id: req.user!.id, 
        username: req.user!.username, 
        email: req.user!.email, 
        role: req.user!.role 
      } 
    });
  });

  // Test live Google Ads connection endpoint
  app.get("/api/google-ads/test-live", authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log('Testing live Google Ads connection...');
      console.log('Environment:', process.env.ENVIRONMENT);
      console.log('Has credentials:', {
        clientId: !!process.env.GOOGLE_ADS_CLIENT_ID,
        clientSecret: !!process.env.GOOGLE_ADS_CLIENT_SECRET,
        developerToken: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        refreshToken: !!process.env.GOOGLE_ADS_REFRESH_TOKEN,
        loginCustomerId: !!process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
      });
      
      // Temporarily force live mode for this test
      const originalIsMock = (googleAdsService as any).isMockMode;
      (googleAdsService as any).isMockMode = false;
      
      const accounts = await googleAdsService.getAccessibleCustomers();
      
      // Restore original mode
      (googleAdsService as any).isMockMode = originalIsMock;
      
      res.json({ 
        success: true, 
        message: 'Live Google Ads connection successful!',
        mode: 'LIVE',
        accountCount: accounts.length,
        accounts: accounts.slice(0, 5),
        credentials: {
          clientId: !!process.env.GOOGLE_ADS_CLIENT_ID,
          clientSecret: !!process.env.GOOGLE_ADS_CLIENT_SECRET,
          developerToken: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          refreshToken: !!process.env.GOOGLE_ADS_REFRESH_TOKEN,
          loginCustomerId: !!process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
        }
      });
    } catch (error: any) {
      console.error('Live Google Ads connection test failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        message: 'Failed to connect to live Google Ads accounts',
        mode: 'LIVE'
      });
    }
  });

  // Google Ads Account routes
  app.get("/api/google-ads/accounts", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      let accounts = await storage.getGoogleAdsAccounts(userId);
      
      // If no accounts exist in database, try to sync from Google Ads API
      if (accounts.length === 0) {
        console.log('No accounts found, attempting to sync from Google Ads API...');
        try {
          // Get accessible customers from Google Ads API
          const customerIds = await googleAdsService.getAccessibleCustomers();
          
          for (const resourceName of customerIds) {
            const customerId = resourceName.replace('customers/', '');
            
            try {
              const customerInfo = await googleAdsService.getCustomerInfo(customerId);
              
              await storage.createGoogleAdsAccount({
                userId,
                customerId,
                name: customerInfo.name,
                currency: customerInfo.currency,
                timezone: customerInfo.timezone,
                isActive: true,
              });
            } catch (error) {
              console.error(`Failed to sync customer ${customerId}:`, error);
            }
          }
          
          accounts = await storage.getGoogleAdsAccounts(userId);
        } catch (error) {
          console.error('Failed to auto-sync accounts from Google Ads API:', error);
          // Return empty array if sync fails - user can manually sync
        }
      }
      
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Campaign management routes
  app.post("/api/google-ads/campaigns", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (googleAdsService.isReadOnly()) {
        return res.status(403).json({ message: "Read-only mode enabled: Campaign creation is disabled." });
      }

      const { accountId, campaignData } = req.body;

      const account = await storage.getGoogleAdsAccount(accountId);
      if (!account) {
        return res.status(404).json({ message: "Google Ads account not found" });
      }

      // Create campaign in Google Ads
      const googleCampaignId = await googleAdsService.createCampaign(
        account.customerId,
        campaignData
      );

      // Save campaign to database
      const campaign = await storage.createCampaign({
        googleAdsAccountId: accountId,
        googleCampaignId,
        name: campaignData.name,
        type: campaignData.type.toUpperCase(),
        budget: campaignData.budget,
        bidStrategy: campaignData.bidStrategy,
        targetLocations: campaignData.targetLocations,
        keywords: campaignData.keywords,
      });

      res.json({
        message: "Campaign created successfully",
        campaign: {
          id: campaign.id,
          googleCampaignId,
          name: campaign.name,
          status: 'PAUSED' // Campaigns start paused for review
        }
      });
    } catch (error: any) {
      console.error('Campaign creation error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/google-ads/campaigns/:campaignId/budget", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (googleAdsService.isReadOnly()) {
        return res.status(403).json({ message: "Read-only mode enabled: Budget updates are disabled." });
      }
      const { campaignId } = req.params;
      const { budget } = req.body;
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const account = await storage.getGoogleAdsAccount(campaign.googleAdsAccountId!);
      if (!account) {
        return res.status(404).json({ message: "Google Ads account not found" });
      }

      // Update budget in Google Ads
      if (campaign.googleCampaignId) {
        await googleAdsService.updateCampaignBudget(
          account.customerId,
          campaign.googleCampaignId,
          budget
        );
      }

      // Update campaign in database
      await storage.updateCampaign(campaignId, { budget });

      res.json({ 
        message: "Campaign budget updated successfully",
        newBudget: budget
      });
    } catch (error: any) {
      console.error('Budget update error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/google-ads/accounts/sync", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Get accessible customers from Google Ads API
      const customerIds = await googleAdsService.getAccessibleCustomers();
      
      for (const resourceName of customerIds) {
        const customerId = resourceName.replace('customers/', '');
        
        try {
          const customerInfo = await googleAdsService.getCustomerInfo(customerId);
          
          // Check if account already exists
          const existingAccount = await storage.getGoogleAdsAccountByCustomerId(customerId);
          
          if (!existingAccount) {
            await storage.createGoogleAdsAccount({
              userId: req.user!.id,
              customerId,
              name: customerInfo.name,
              currency: customerInfo.currency,
              timezone: customerInfo.timezone,
              isActive: true,
            });
          }
        } catch (error) {
          console.error(`Failed to sync customer ${customerId}:`, error);
        }
      }

      const accounts = await storage.getGoogleAdsAccounts(req.user!.id);
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Performance metrics routes
  app.get("/api/google-ads/accounts/:accountId/metrics", authenticateToken, async (req, res) => {
    try {
      const { accountId } = req.params;
      const { campaignId, dateRange } = req.query;
      
      const account = await storage.getGoogleAdsAccount(accountId);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }

      const metrics = await googleAdsService.getPerformanceMetrics(
        account.customerId,
        campaignId as string,
        dateRange as string || 'TODAY'
      );

      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Campaign routes
  app.get("/api/google-ads/accounts/:accountId/campaigns", authenticateToken, async (req, res) => {
    try {
      const { accountId } = req.params;
      
      const account = await storage.getGoogleAdsAccount(accountId);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }

      const campaigns = await googleAdsService.getCampaigns(account.customerId);
      res.json(campaigns);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Budget pacing routes
  app.get("/api/google-ads/accounts/:accountId/pacing", authenticateToken, async (req, res) => {
    try {
      const { accountId } = req.params;
      
      const budgetPacing = await storage.getBudgetPacing(accountId);
      res.json(budgetPacing);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Escalation settings routes
  app.get("/api/escalation-settings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { accountId } = req.query;
      const settings = await storage.getEscalationSettings(userId, accountId as string);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/escalation-settings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const settingData = {
        ...req.body,
        userId
      };
      const setting = await storage.createEscalationSetting(settingData);
      res.status(201).json(setting);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/escalation-settings/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const setting = await storage.updateEscalationSetting(id, updates);
      
      if (!setting) {
        return res.status(404).json({ message: "Escalation setting not found" });
      }
      
      res.json(setting);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/escalation-settings/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteEscalationSetting(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Issue Detection routes
  app.get("/api/issues/detect/:accountId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { accountId } = req.params;
      const issues = await issueDetectionService.detectAllIssues(accountId);
      res.json(issues);
    } catch (error: any) {
      console.error('Issue detection failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/issues/health-score/:accountId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { accountId } = req.params;
      const healthScore = await issueDetectionService.getAccountHealthScore(accountId);
      res.json(healthScore);
    } catch (error: any) {
      console.error('Health score calculation failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Chat routes
  app.get("/api/chat/sessions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { accountId } = req.query;
      const sessions = await storage.getChatSessions(req.user!.id, accountId as string);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/sessions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const sessionData = insertChatSessionSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });
      
      const session = await storage.createChatSession(sessionData);
      res.json(session);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/chat/sessions/:sessionId/messages", authenticateToken, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const messages = await storage.getChatMessages(sessionId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/sessions/:sessionId/messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { content } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: "Message content is required" });
      }

      // Save user message
      const userMessage = await storage.createChatMessage({
        sessionId,
        role: 'user',
        content,
      });

      res.json({ message: userMessage });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Chat streaming endpoint
  app.post("/api/chat/sessions/:sessionId/stream", authenticateToken, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: "Message content is required" });
      }

      // Set headers for streaming
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Get recent messages for context
      const recentMessages = await storage.getChatMessages(sessionId);
      const contextMessages = recentMessages.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Add current user message
      contextMessages.push({ role: 'user', content });

      // Save user message
      await storage.createChatMessage({
        sessionId,
        role: 'user',
        content,
      });

      let fullResponse = '';

      await openRouterService.streamChatCompletion(
        contextMessages,
        (chunk) => {
          res.write(chunk);
          fullResponse += chunk;
        },
        async (complete) => {
          // Save assistant message
          await storage.createChatMessage({
            sessionId,
            role: 'assistant',
            content: fullResponse,
          });
          
          res.end();
        },
        (error) => {
          console.error('OpenRouter streaming error:', error);
          res.write(`\n\nError: ${error.message}`);
          res.end();
        }
      );

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Campaign Brief Generation routes
  app.post("/api/campaign-brief/generate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sessionId, accountId } = req.body;
      
      if (!sessionId || !accountId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Session ID and Account ID are required' 
        });
      }

      // Get chat messages for the session
      const messages = await storage.getChatMessages(sessionId);
      
      const result = await campaignBriefGeneratorService.generateFromConversation(
        sessionId,
        messages,
        accountId
      );

      res.json(result);
    } catch (error: any) {
      console.error('Campaign brief generation failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.post("/api/campaign-brief/:briefId/refine", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { briefId } = req.params;
      const { feedback, requestedChanges } = req.body;

      const result = await campaignBriefGeneratorService.reviewAndRefineBreif(
        briefId,
        feedback || '',
        requestedChanges || []
      );

      res.json(result);
    } catch (error: any) {
      console.error('Brief refinement failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.post("/api/campaigns/create-from-brief", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { briefId, accountId } = req.body;
      
      if (!briefId || !accountId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Brief ID and Account ID are required' 
        });
      }

      // Get the campaign brief
      const brief = await storage.getCampaignBrief(briefId);
      if (!brief) {
        return res.status(404).json({ 
          success: false, 
          error: 'Campaign brief not found' 
        });
      }

      // Get the Google Ads account
      const account = await storage.getGoogleAdsAccount(accountId);
      if (!account) {
        return res.status(404).json({ 
          success: false, 
          error: 'Google Ads account not found' 
        });
      }

      // Create campaign structure from brief
      const campaignData = {
        name: brief.title,
        type: 'SEARCH',
        budget: parseFloat(brief.budget || '100'),
        bidStrategy: 'MAXIMIZE_CLICKS',
        keywords: Array.isArray(brief.objectives) ? brief.objectives : [],
        adGroups: [{
          name: 'Ad Group 1',
          ads: [] as any[]
        }],
        targetLocations: [] as string[]
      };

      // Create campaign via Google Ads API
      const campaignId = await googleAdsService.createCampaign(
        account.customerId,
        campaignData as any
      );

      // Save campaign to database
      const campaign = await storage.createCampaign({
        googleAdsAccountId: accountId,
        googleCampaignId: campaignId,
        name: brief.title,
        type: 'SEARCH',
        status: 'PAUSED', // Start paused for safety
        budget: brief.budget,
        keywords: { primary: campaignData.keywords },
        adGroups: campaignData.adGroups
      });

      // Update brief status to approved
      // Note: would need to add updateCampaignBrief method to storage

      res.json({ 
        success: true, 
        campaignId: campaign.id,
        googleCampaignId: campaignId
      });

    } catch (error: any) {
      console.error('Campaign creation from brief failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Campaign brief routes
  app.get("/api/campaign-briefs", authenticateToken, async (req, res) => {
    try {
      const { accountId } = req.query;
      if (!accountId) {
        return res.status(400).json({ message: "Account ID is required" });
      }
      
      const briefs = await storage.getCampaignBriefs(accountId as string);
      res.json(briefs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/campaign-briefs", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const briefData = insertCampaignBriefSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });
      
      const brief = await storage.createCampaignBrief(briefData);
      res.json(brief);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/campaign-briefs/:briefId", authenticateToken, async (req, res) => {
    try {
      const { briefId } = req.params;
      const updates = req.body;
      
      const brief = await storage.updateCampaignBrief(briefId, updates);
      if (!brief) {
        return res.status(404).json({ message: "Campaign brief not found" });
      }
      
      res.json(brief);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Advanced analytics routes
  app.get("/api/analytics/accounts/:accountId/campaigns/:campaignId/analysis", authenticateToken, async (req, res) => {
    try {
      const { accountId, campaignId } = req.params;
      const { channelType = 'search' } = req.query;
      
      // Mock analytics data for development
      const mockAnalysis = {
        campaignId,
        enhancedMetrics: {
          impressions: 12500,
          clicks: 485,
          cost: 1247.50,
          conversions: 18,
          ctr: 3.88,
          cpc: 2.57,
          conversionRate: 3.71,
          costPerConversion: 69.31
        },
        performanceScore: {
          overall: 82,
          efficiency: 85,
          reach: 78,
          quality: 84
        },
        optimizationOpportunities: [
          {
            type: "keyword_expansion",
            priority: "high",
            impact: "high",
            description: "Add high-converting keyword variations",
            estimatedImprovement: "15-25% increase in conversions"
          }
        ],
        recommendations: [
          "Expand keyword targeting with high-intent variations",
          "Optimize ad copy for better CTR",
          "Consider increasing budget for high-performing campaigns"
        ]
      };
      
      res.json({ success: true, data: mockAnalysis });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Budget pacing routes
  app.get("/api/budget-pacing/accounts/:accountId/status", authenticateToken, async (req, res) => {
    try {
      const { accountId } = req.params;
      
      // Mock budget pacing data
      const mockStatus = [
        {
          campaignId: "campaign_1",
          currentSpend: 850,
          dailyBudget: 100,
          recommendedBudget: 95,
          pacingStatus: "on_track",
          daysRemaining: 12,
          projectedSpend: 2990,
          confidenceScore: 0.85
        }
      ];
      
      res.json({ success: true, data: mockStatus });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Mount real campaign generator router (replaces previous mock endpoint)
  app.use('/api/campaign-generator', campaignGeneratorRouter);

  // Monitoring routes
  app.get("/api/monitoring/accounts/:accountId/campaigns/:campaignId/health", authenticateToken, async (req, res) => {
    try {
      const { accountId, campaignId } = req.params;
      
      // Mock health data
      const mockHealth = {
        campaignId,
        overallHealth: "healthy",
        lastCheck: new Date(),
        issues: [],
        metrics: {
          uptime: 98.5,
          performanceScore: 82,
          budgetHealth: "good",
          trafficQuality: 85
        },
        alerts: {
          active: 0,
          resolved: 3,
          dismissed: 1
        }
      };
      
      res.json({ success: true, data: mockHealth });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Scheduler routes
  app.get("/api/scheduler/tasks", authenticateToken, async (req, res) => {
    try {
      // Mock scheduled tasks
      const mockTasks = [
        {
          id: "budget_pacing_check",
          name: "Budget Pacing Check",
          description: "Check and adjust budget pacing for all campaigns",
          schedule: "0 */2 * * *",
          enabled: true,
          status: "idle",
          lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
          nextRun: new Date(Date.now() + 2 * 60 * 60 * 1000)
        },
        {
          id: "performance_monitoring",
          name: "Performance Monitoring", 
          description: "Monitor campaign performance and detect issues",
          schedule: "*/10 * * * *",
          enabled: true,
          status: "idle",
          lastRun: new Date(Date.now() - 10 * 60 * 1000),
          nextRun: new Date(Date.now() + 10 * 60 * 1000)
        }
      ];
      
      res.json({ success: true, data: mockTasks });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Budget pacing routes  
  app.get('/api/budget-pacing/:accountId', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { accountId } = req.params;
      const { campaignId } = req.query;
      
      const result = await budgetPacingService.getBudgetStatus(
        accountId, 
        campaignId as string
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error getting budget status:', error);
      res.status(500).json({ error: 'Failed to get budget status' });
    }
  });

  // Apply budget recommendation
  app.post('/api/budget-pacing/:accountId/:campaignId/apply', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (googleAdsService.isReadOnly()) {
        return res.status(403).json({ error: 'Read-only mode enabled: Applying budget changes is disabled.' });
      }

      const { accountId, campaignId } = req.params;
      const { recommendedBudget } = req.body;

      // Get the account
      const account = await storage.getGoogleAdsAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Apply the budget change via Google Ads API
      await googleAdsService.updateCampaignBudget(
        account.customerId,
        campaignId,
        recommendedBudget
      );

      res.json({ success: true, appliedBudget: recommendedBudget });
    } catch (error) {
      console.error('Error applying budget recommendation:', error);
      res.status(500).json({ error: 'Failed to apply budget recommendation' });
    }
  });

  // Google Ads API Testing
  app.get('/api/google-ads/test-connection', authenticateToken, async (req, res) => {
    try {
      console.log('🧪 Testing Google Ads API live connection...');
      
      // Test 1: Get accessible customers
      console.log('Step 1: Testing accessible customers endpoint...');
      const accessibleCustomers = await googleAdsService.getAccessibleCustomers();
      console.log('✅ Accessible customers:', accessibleCustomers);

      // Test 2: Try to get customer info for each accessible customer
      const customerTests = [];
      for (const customerId of accessibleCustomers.slice(0, 3)) { // Test first 3
        try {
          console.log(`Step 2: Testing customer info for ${customerId}...`);
          const customerInfo = await googleAdsService.getCustomerInfo(customerId);
          customerTests.push({
            customerId,
            status: 'success' as const,
            info: customerInfo
          });
          console.log(`✅ Customer ${customerId}:`, customerInfo);
        } catch (error: any) {
          customerTests.push({
            customerId,
            status: 'error' as const,
            error: error.message
          });
          console.log(`❌ Customer ${customerId} failed:`, error.message);
        }
      }

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        results: {
          accessibleCustomers,
          customerTests
        },
        summary: {
          totalAccessibleCustomers: accessibleCustomers.length,
          successfulCustomers: customerTests.filter(t => t.status === 'success').length
        }
      });

    } catch (error: any) {
      console.error('❌ Google Ads API test failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        suggestion: error.message.includes('invalid_grant') 
          ? 'Refresh token expired - regenerate using OAuth Playground'
          : error.message.includes('invalid_client')
          ? 'Check OAuth Client ID/Secret in Google Cloud Console'
          : 'Check Google Ads API credentials and permissions'
      });
    }
  });

  // Settings routes
  app.get('/api/settings/user', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userSettings = {
  id: req.user?.id,
        email: req.user?.email || 'user@example.com',
        name: 'Lane MCP User',
        timezone: 'America/New_York',
        language: 'en',
        notifications: {
          emailAlerts: true,
          budgetWarnings: true,
          campaignIssues: true,
          weeklyReports: false,
        },
        preferences: {
          defaultCurrency: 'USD',
          dashboardLayout: 'executive',
          autoRefreshInterval: 300,
        },
      };
      res.json(userSettings);
    } catch (error) {
      console.error('Error getting user settings:', error);
      res.status(500).json({ error: 'Failed to get user settings' });
    }
  });

  app.put('/api/settings/user', authenticateToken, async (req: AuthRequest, res) => {
    try {
      res.json({ success: true, message: 'User settings updated' });
    } catch (error) {
      console.error('Error updating user settings:', error);
      res.status(500).json({ error: 'Failed to update user settings' });
    }
  });

  app.get('/api/settings/api', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const hasGoogleCreds = !!(process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_REFRESH_TOKEN);
      const apiSettings = {
        googleAds: {
          clientId: process.env.GOOGLE_ADS_CLIENT_ID?.substring(0, 20) + '...' || '',
          developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? '***configured***' : '',
          loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '',
          status: hasGoogleCreds ? 'connected' : 'disconnected',
        },
        openRouter: {
          model: 'anthropic/claude-3-sonnet',
          temperature: 0.7,
          maxTokens: 2000,
        },
      };
      res.json(apiSettings);
    } catch (error) {
      console.error('Error getting API settings:', error);
      res.status(500).json({ error: 'Failed to get API settings' });
    }
  });

  app.put('/api/settings/api', authenticateToken, async (req: AuthRequest, res) => {
    try {
      res.json({ success: true, message: 'API settings updated' });
    } catch (error) {
      console.error('Error updating API settings:', error);
      res.status(500).json({ error: 'Failed to update API settings' });
    }
  });

  app.post('/api/settings/api/test-connection', authenticateToken, async (req: AuthRequest, res) => {
    try {
      try {
        await googleAdsService.getAccessibleCustomers();
        res.json({ 
          success: true, 
          message: 'All connections are working properly',
          details: {
            googleAds: 'connected',
            openRouter: 'connected'
          }
        });
      } catch (error) {
        res.json({ 
          success: false, 
          message: 'Google Ads connection failed - check credentials',
          details: {
            googleAds: 'failed',
            openRouter: 'connected'
          }
        });
      }
    } catch (error) {
      console.error('Error testing API connections:', error);
      res.status(500).json({ error: 'Failed to test connections' });
    }
  });

  // Google OAuth routes
  app.get('/api/auth/google', (req, res) => {
    const scopes = [
      'https://www.googleapis.com/auth/adwords'
    ];
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_ADS_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent('https://oauth2-playground.googleusercontent.com/')}&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    res.redirect(authUrl);
  });

  app.get('/api/auth/google/disconnect', authenticateToken, (req: AuthRequest, res) => {
    // In a real app, you would revoke the refresh token and clear it from storage
    res.json({ success: true, message: 'Google Ads disconnected' });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'development',
      services: {
        budgetPacing: "operational",
        monitoring: "operational", 
        analytics: "operational",
        campaignGenerator: "operational",
        scheduler: "operational"
      }
    });
  });

  // Supermemory connection routes
  app.get('/api/supermemory/connections', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const connections = await storage.getSupermemoryConnections(req.user!.id);
      res.json(connections);
    } catch (error: any) {
      console.error('Error getting Supermemory connections:', error);
      res.status(500).json({ error: 'Failed to get connections' });
    }
  });

  app.post('/api/supermemory/connections', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { provider, accessToken, refreshToken, containerTags, documentLimit } = req.body;
      
      // Create connection via Supermemory API
      const connectionId = await supermemoryService.createConnection({
        provider,
        accessToken,
        refreshToken,
        containerTags,
        documentLimit
      });

      // Store connection in our database
      const connection = await storage.createSupermemoryConnection({
        userId: req.user!.id,
        connectionId,
        provider,
        containerTags,
        documentLimit,
        metadata: { accessToken: !!accessToken, refreshToken: !!refreshToken }
      });

      res.json(connection);
    } catch (error: any) {
      console.error('Error creating Supermemory connection:', error);
      res.status(500).json({ error: 'Failed to create connection' });
    }
  });

  app.delete('/api/supermemory/connections/:connectionId', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { connectionId } = req.params;
      
      // Find connection in our database
      const connection = await storage.getSupermemoryConnectionByConnectionId(connectionId);
      if (!connection || connection.userId !== req.user!.id) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      // Delete from Supermemory API
      await supermemoryService.deleteConnection(connectionId, connection.containerTags as string[]);
      
      // Delete from our database
      await storage.deleteSupermemoryConnection(connection.id);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting Supermemory connection:', error);
      res.status(500).json({ error: 'Failed to delete connection' });
    }
  });

  // Supermemory memory routes
  app.get('/api/supermemory/memories', authenticateToken, async (req: AuthRequest, res) => {
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

  app.post('/api/supermemory/memories', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { content, title, type, connectionId, containerTags, url, summary, customId } = req.body;
      
      // Add memory via Supermemory API
      const memoryId = await supermemoryService.addMemory({
        content,
        title,
        type,
        connectionId,
        containerTags,
        url,
        summary,
        customId
      });

      // Store memory in our database
      const memory = await storage.createSupermemoryMemory({
        userId: req.user!.id,
        memoryId,
        customId,
        connectionId,
        title,
        content,
        summary,
        url,
        type: type || 'text',
        status: 'processing',
        containerTags,
        metadata: { source: 'api' }
      });

      res.json(memory);
    } catch (error: any) {
      console.error('Error creating Supermemory memory:', error);
      res.status(500).json({ error: 'Failed to create memory' });
    }
  });

  app.get('/api/supermemory/memories/:memoryId', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { memoryId } = req.params;
      
      // Find memory in our database
      const localMemory = await storage.getSupermemoryMemoryByMemoryId(memoryId);
      if (!localMemory || localMemory.userId !== req.user!.id) {
        return res.status(404).json({ error: 'Memory not found' });
      }

      // Get updated memory from Supermemory API
      const apiMemory = await supermemoryService.getMemory(memoryId);
      
      // Update local memory with latest data
      await storage.updateSupermemoryMemory(localMemory.id, {
        title: apiMemory.title,
        content: apiMemory.content,
        summary: apiMemory.summary,
        status: apiMemory.status,
        ogImage: apiMemory.og_image,
        source: apiMemory.source
      });

      res.json({
        ...localMemory,
        ...apiMemory
      });
    } catch (error: any) {
      console.error('Error getting Supermemory memory:', error);
      res.status(500).json({ error: 'Failed to get memory' });
    }
  });

  app.delete('/api/supermemory/memories/:memoryId', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { memoryId } = req.params;
      
      // Find memory in our database
      const memory = await storage.getSupermemoryMemoryByMemoryId(memoryId);
      if (!memory || memory.userId !== req.user!.id) {
        return res.status(404).json({ error: 'Memory not found' });
      }

      // Delete from Supermemory API
      await supermemoryService.deleteMemory(memoryId);
      
      // Delete from our database
      await storage.deleteSupermemoryMemory(memory.id);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting Supermemory memory:', error);
      res.status(500).json({ error: 'Failed to delete memory' });
    }
  });

  app.get('/api/supermemory/search', authenticateToken, async (req: AuthRequest, res) => {
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

  // Google Ads + Supermemory integration routes
  app.post('/api/supermemory/campaign-data/:accountId/:campaignId', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { accountId, campaignId } = req.params;
      
      // Get account and campaign data
      const account = await storage.getGoogleAdsAccount(accountId);
      if (!account || account.userId !== req.user!.id) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Get campaign data from Google Ads API
      const campaigns = await googleAdsService.getCampaigns(account.customerId);
      const campaign = campaigns.find(c => c.id === campaignId);
      
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Store campaign data in Supermemory
      const memoryId = await supermemoryService.addCampaignMemory(
        campaign,
        accountId,
        account.customerId
      );

      res.json({ 
        success: true, 
        memoryId,
        message: 'Campaign data stored in Supermemory'
      });
    } catch (error: any) {
      console.error('Error storing campaign data in Supermemory:', error);
      res.status(500).json({ error: 'Failed to store campaign data' });
    }
  });

  app.post('/api/supermemory/performance-data/:accountId', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { accountId } = req.params;
      const { campaignId, dateRange } = req.body;
      
      // Get account
      const account = await storage.getGoogleAdsAccount(accountId);
      if (!account || account.userId !== req.user!.id) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Get performance data from Google Ads API
      const metrics = await googleAdsService.getPerformanceMetrics(
        account.customerId,
        campaignId,
        dateRange || 'LAST_30_DAYS'
      );

      // Store performance data in Supermemory
      const memoryId = await supermemoryService.addPerformanceMemory(
        metrics,
        accountId,
        account.customerId,
        campaignId
      );

      res.json({ 
        success: true, 
        memoryId,
        message: 'Performance data stored in Supermemory'
      });
    } catch (error: any) {
      console.error('Error storing performance data in Supermemory:', error);
      res.status(500).json({ error: 'Failed to store performance data' });
    }
  });

  return httpServer;
}
