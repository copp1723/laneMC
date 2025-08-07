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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Google Ads Account management
  getGoogleAdsAccounts(): Promise<GoogleAdsAccount[]>;
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
  async getGoogleAdsAccounts(): Promise<GoogleAdsAccount[]> {
    return await db.select().from(googleAdsAccounts).where(eq(googleAdsAccounts.isActive, true));
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
    let query = db.select().from(chatSessions).where(eq(chatSessions.userId, userId));
    
    if (googleAdsAccountId) {
      query = query.where(eq(chatSessions.googleAdsAccountId, googleAdsAccountId));
    }
    
    return await query.orderBy(desc(chatSessions.createdAt));
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
    let query = db.select().from(performanceMetrics)
      .where(eq(performanceMetrics.googleAdsAccountId, googleAdsAccountId));
    
    if (campaignId) {
      query = query.where(eq(performanceMetrics.campaignId, campaignId));
    }
    
    return await query.orderBy(desc(performanceMetrics.date));
  }

  async createPerformanceMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics> {
    const result = await db.insert(performanceMetrics).values(metrics).returning();
    return result[0];
  }

  // Budget pacing methods
  async getBudgetPacing(googleAdsAccountId: string, campaignId?: string): Promise<BudgetPacing[]> {
    let query = db.select().from(budgetPacing)
      .where(eq(budgetPacing.googleAdsAccountId, googleAdsAccountId));
    
    if (campaignId) {
      query = query.where(eq(budgetPacing.campaignId, campaignId));
    }
    
    return await query.orderBy(desc(budgetPacing.date));
  }

  async createBudgetPacing(pacing: InsertBudgetPacing): Promise<BudgetPacing> {
    const result = await db.insert(budgetPacing).values(pacing).returning();
    return result[0];
  }
}

export const storage = new DbStorage();
