// Ensure environment variables are loaded first
import { config } from 'dotenv';
config();

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  users, googleAdsAccounts, campaigns, chatSessions, chatMessages,
  campaignBriefs, performanceMetrics, budgetPacing,
  type User, type InsertUser, type GoogleAdsAccount, type InsertGoogleAdsAccount,
  type Campaign, type InsertCampaign, type ChatSession, type InsertChatSession,
  type ChatMessage, type InsertChatMessage, type CampaignBrief, type InsertCampaignBrief,
  type PerformanceMetrics, type InsertPerformanceMetrics, type BudgetPacing, type InsertBudgetPacing
} from "@shared/schema";

// Enhanced database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool configuration
  max: 20, // Maximum number of clients in the pool
  min: 2, // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  maxUses: 7500, // Close (and replace) a connection after it has been used 7500 times
  // Retry configuration
  allowExitOnIdle: false, // Keep the pool alive
  // SSL configuration for production and managed database providers
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Connection error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', (client) => {
  console.log('Database client connected');
});

pool.on('remove', (client) => {
  console.log('Database client removed');
});

const db = drizzle(pool);

// Database connection retry logic
export async function connectWithRetry(maxRetries = 5, delay = 1000): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Test the connection
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('✅ Database connection established successfully');
      return;
    } catch (error) {
      console.error(`❌ Database connection attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : 'Unknown error');

      if (attempt === maxRetries) {
        throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
      }

      // Exponential backoff
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      console.log(`⏳ Retrying in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}

// Database health check function
export async function checkDatabaseHealth(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number; error?: string }> {
  const start = Date.now();

  try {
    const client = await pool.connect();
    await client.query('SELECT 1 as health_check');
    client.release();

    const latency = Date.now() - start;
    return { status: 'healthy', latency };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Graceful shutdown function
export async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
    console.log('Database pool closed gracefully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Google Ads Account management
  getGoogleAdsAccounts(): Promise<GoogleAdsAccount[]>;
  getGoogleAdsAccounts(userId: string): Promise<GoogleAdsAccount[]>;
  getGoogleAdsAccount(id: string): Promise<GoogleAdsAccount | undefined>;
  getGoogleAdsAccountByCustomerId(customerId: string): Promise<GoogleAdsAccount | undefined>;
  createGoogleAdsAccount(account: InsertGoogleAdsAccount): Promise<GoogleAdsAccount>;
  updateGoogleAdsAccount(id: string, updates: Partial<GoogleAdsAccount>): Promise<GoogleAdsAccount | undefined>;
  
  // Campaign management
  getCampaigns(googleAdsAccountId: string): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined>;
  
  // Chat management
  getChatSessions(userId: string, googleAdsAccountId?: string): Promise<ChatSession[]>;
  getChatSession(id: string): Promise<ChatSession | undefined>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Campaign briefs
  getCampaignBriefs(googleAdsAccountId: string): Promise<CampaignBrief[]>;
  getCampaignBrief(id: string): Promise<CampaignBrief | undefined>;
  createCampaignBrief(brief: InsertCampaignBrief): Promise<CampaignBrief>;
  updateCampaignBrief(id: string, updates: Partial<CampaignBrief>): Promise<CampaignBrief | undefined>;
  
  // Performance metrics
  getPerformanceMetrics(googleAdsAccountId: string, campaignId?: string): Promise<PerformanceMetrics[]>;
  createPerformanceMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics>;
  
  // Budget pacing
  getBudgetPacing(googleAdsAccountId: string, campaignId?: string): Promise<BudgetPacing[]>;
  createBudgetPacing(pacing: InsertBudgetPacing): Promise<BudgetPacing>;
}

export class DbStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Google Ads Account methods
  async getGoogleAdsAccounts(userId?: string): Promise<GoogleAdsAccount[]> {
    // For now, return all active accounts since we don't have user-account relationships in schema
    // In a real implementation, you'd join with a user_accounts table
    const query = db.select().from(googleAdsAccounts).where(eq(googleAdsAccounts.isActive, true));

    return await query;
  }

  async getGoogleAdsAccount(id: string): Promise<GoogleAdsAccount | undefined> {
    const result = await db.select().from(googleAdsAccounts).where(eq(googleAdsAccounts.id, id));
    return result[0];
  }

  async getGoogleAdsAccountByCustomerId(customerId: string): Promise<GoogleAdsAccount | undefined> {
    const result = await db.select().from(googleAdsAccounts).where(eq(googleAdsAccounts.customerId, customerId));
    return result[0];
  }

  async createGoogleAdsAccount(account: InsertGoogleAdsAccount): Promise<GoogleAdsAccount> {
    const result = await db.insert(googleAdsAccounts).values(account).returning();
    return result[0];
  }

  async updateGoogleAdsAccount(id: string, updates: Partial<GoogleAdsAccount>): Promise<GoogleAdsAccount | undefined> {
    const result = await db.update(googleAdsAccounts)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(googleAdsAccounts.id, id))
      .returning();
    return result[0];
  }

  // Campaign methods
  async getCampaigns(googleAdsAccountId: string): Promise<Campaign[]> {
    return await db.select().from(campaigns)
      .where(eq(campaigns.googleAdsAccountId, googleAdsAccountId))
      .orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const result = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return result[0];
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const result = await db.insert(campaigns).values(campaign).returning();
    return result[0];
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined> {
    const result = await db.update(campaigns)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(campaigns.id, id))
      .returning();
    return result[0];
  }

  // Chat methods
  async getChatSessions(userId: string, googleAdsAccountId?: string): Promise<ChatSession[]> {
    const conditions = [eq(chatSessions.userId, userId)];

    if (googleAdsAccountId) {
      conditions.push(eq(chatSessions.googleAdsAccountId, googleAdsAccountId));
    }

    return await db.select().from(chatSessions)
      .where(and(...conditions))
      .orderBy(desc(chatSessions.createdAt));
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    const result = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
    return result[0];
  }

  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    const result = await db.insert(chatSessions).values(session).returning();
    return result[0];
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt));
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values(message).returning();
    return result[0];
  }

  // Campaign brief methods
  async getCampaignBriefs(googleAdsAccountId: string): Promise<CampaignBrief[]> {
    return await db.select().from(campaignBriefs)
      .where(eq(campaignBriefs.googleAdsAccountId, googleAdsAccountId))
      .orderBy(desc(campaignBriefs.createdAt));
  }

  async getCampaignBrief(id: string): Promise<CampaignBrief | undefined> {
    const result = await db.select().from(campaignBriefs).where(eq(campaignBriefs.id, id));
    return result[0];
  }

  async createCampaignBrief(brief: InsertCampaignBrief): Promise<CampaignBrief> {
    const result = await db.insert(campaignBriefs).values(brief).returning();
    return result[0];
  }

  async updateCampaignBrief(id: string, updates: Partial<CampaignBrief>): Promise<CampaignBrief | undefined> {
    const result = await db.update(campaignBriefs)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(campaignBriefs.id, id))
      .returning();
    return result[0];
  }

  // Performance metrics methods
  async getPerformanceMetrics(googleAdsAccountId: string, campaignId?: string): Promise<PerformanceMetrics[]> {
    const conditions = [eq(performanceMetrics.googleAdsAccountId, googleAdsAccountId)];

    if (campaignId) {
      conditions.push(eq(performanceMetrics.campaignId, campaignId));
    }

    return await db.select().from(performanceMetrics)
      .where(and(...conditions))
      .orderBy(desc(performanceMetrics.date));
  }

  async createPerformanceMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics> {
    const result = await db.insert(performanceMetrics).values(metrics).returning();
    return result[0];
  }

  // Budget pacing methods
  async getBudgetPacing(googleAdsAccountId: string, campaignId?: string): Promise<BudgetPacing[]> {
    const conditions = [eq(budgetPacing.googleAdsAccountId, googleAdsAccountId)];

    if (campaignId) {
      conditions.push(eq(budgetPacing.campaignId, campaignId));
    }

    return await db.select().from(budgetPacing)
      .where(and(...conditions))
      .orderBy(desc(budgetPacing.date));
  }

  async createBudgetPacing(pacing: InsertBudgetPacing): Promise<BudgetPacing> {
    const result = await db.insert(budgetPacing).values(pacing).returning();
    return result[0];
  }
}

export const storage = new DbStorage();
