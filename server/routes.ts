import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { authenticateToken, hashPassword, comparePassword, generateToken, invalidateToken, AuthRequest } from "./services/auth";
import { storage } from "./storage";
import { googleAdsService } from "./services/google-ads";
import { openRouterService } from "./services/openrouter";
import { insertChatSessionSchema, insertCampaignBriefSchema } from "@shared/schema";
import { validate, authSchemas } from "./middleware/validation";
import { ErrorHandler, UnauthorizedError, ConflictError } from "./services/error-handler";
import { GracefulDegradationService } from "./services/graceful-degradation";

// Import new route modules
import budgetPacingRoutes from "./routes/budget-pacing";
import issuesRoutes from "./routes/issues";
import insightsRoutes from "./routes/insights";
import { registerCampaignGeneratorRoutes } from "./routes/campaign-generator";
import monitoringRoutes from "./routes/monitoring";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Mount new route modules
  app.use('/api/budget-pacing', budgetPacingRoutes);
  app.use('/api/issues', issuesRoutes);
  app.use('/api/insights', insightsRoutes);
  app.use('/api/monitoring', monitoringRoutes);
  
  // Register campaign generator routes
  registerCampaignGeneratorRoutes(app);

  // Test endpoint (no auth required)
  app.get("/api/test", (_req, res) => {
    res.json({
      success: true,
      message: "API is working!",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
  });

  // Create admin user endpoint (no auth required for setup)
  app.post("/api/setup/admin", async (_req, res) => {
    try {
      const adminEmail = 'admin@lanemc.com';
      const adminPassword = 'admin123';
      const adminUsername = 'admin';

      // Check if admin user already exists
      const existingUser = await storage.getUserByEmail(adminEmail);
      if (existingUser) {
        return res.json({
          success: true,
          message: 'Admin user already exists',
          email: adminEmail
        });
      }

      // Hash the password
      const hashedPassword = await hashPassword(adminPassword);

      // Create the admin user
      const adminUser = await storage.createUser({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin'
      });

      res.json({
        success: true,
        message: 'Admin user created successfully!',
        email: adminEmail,
        password: adminPassword,
        userId: adminUser.id
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Auth routes with validation
  app.post("/api/auth/register",
    validate({ body: authSchemas.register }),
    ErrorHandler.asyncHandler(async (req: Request, res: Response) => {
      const { username, email, password } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        throw new ConflictError("An account with this email already exists");
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
      });

      const token = generateToken(user.id);
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    })
  );

  app.post("/api/auth/login",
    validate({ body: authSchemas.login }),
    ErrorHandler.asyncHandler(async (req: Request, res: Response) => {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user || !(await comparePassword(password, user.password))) {
        throw new UnauthorizedError("Invalid email or password");
      }

      const token = generateToken(user.id);
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    })
  );

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  app.post("/api/auth/logout", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];
      
      if (token) {
        invalidateToken(token);
      }
      
      res.json({ message: "Logged out successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Logout error" });
    }
  });

  // Google Ads Account routes
  app.get("/api/google-ads/accounts", authenticateToken,
    ErrorHandler.asyncHandler(async (_req: Request, res: Response) => {
      // Use graceful degradation for Google Ads accounts
      const accounts = await GracefulDegradationService.getGoogleAdsAccountsWithFallback();

      res.json({
        success: true,
        data: accounts,
        serviceStatus: GracefulDegradationService.isGoogleAdsServiceAvailable() ? 'available' : 'degraded'
      });
    })
  );

  app.post("/api/google-ads/accounts/sync", authenticateToken, async (_req, res) => {
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

      const accounts = await storage.getGoogleAdsAccounts();
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
        async (_complete) => {
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

  // Health check is now handled in server/index.ts before rate limiting

  return httpServer;
}
