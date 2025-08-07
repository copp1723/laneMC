import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  users, googleAdsAccounts, campaigns, chatSessions, chatMessages,
  campaignBriefs, performanceMetrics, budgetPacing, escalationSettings,
  type User, type InsertUser, type GoogleAdsAccount, type InsertGoogleAdsAccount,
  type Campaign, type InsertCampaign, type ChatSession, type InsertChatSession,
  type ChatMessage, type InsertChatMessage, type CampaignBrief, type InsertCampaignBrief,
  type PerformanceMetrics, type InsertPerformanceMetrics, type BudgetPacing, type InsertBudgetPacing,
  type EscalationSettings, type InsertEscalationSettings
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
  getGoogleAdsAccounts(userId: string): Promise<GoogleAdsAccount[]>;
  getAllGoogleAdsAccounts(): Promise<GoogleAdsAccount[]>;
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
  updateBudgetPacing(id: string, updates: Partial<BudgetPacing>): Promise<BudgetPacing | undefined>;
  
  // Escalation settings
  getEscalationSettings(userId: string, googleAdsAccountId?: string): Promise<EscalationSettings[]>;
  getEscalationSetting(id: string): Promise<EscalationSettings | undefined>;
  getEscalationSettingsByCampaign(campaignId: string): Promise<EscalationSettings[]>;
  createEscalationSetting(setting: InsertEscalationSettings): Promise<EscalationSettings>;
  updateEscalationSetting(id: string, updates: Partial<EscalationSettings>): Promise<EscalationSettings | undefined>;
  deleteEscalationSetting(id: string): Promise<void>;
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
  async getGoogleAdsAccounts(userId: string): Promise<GoogleAdsAccount[]> {
    return await db.select().from(googleAdsAccounts).where(eq(googleAdsAccounts.userId, userId));
  }

  async getAllGoogleAdsAccounts(): Promise<GoogleAdsAccount[]> {
    return await db.select().from(googleAdsAccounts);
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
    if (googleAdsAccountId) {
      return await db.select().from(chatSessions)
        .where(and(
          eq(chatSessions.userId, userId),
          eq(chatSessions.googleAdsAccountId, googleAdsAccountId)
        ))
        .orderBy(desc(chatSessions.createdAt));
    }
    
    return await db.select().from(chatSessions)
      .where(eq(chatSessions.userId, userId))
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
    if (campaignId) {
      return await db.select().from(performanceMetrics)
        .where(and(
          eq(performanceMetrics.googleAdsAccountId, googleAdsAccountId),
          eq(performanceMetrics.campaignId, campaignId)
        ))
        .orderBy(desc(performanceMetrics.date));
    }
    
    return await db.select().from(performanceMetrics)
      .where(eq(performanceMetrics.googleAdsAccountId, googleAdsAccountId))
      .orderBy(desc(performanceMetrics.date));
  }

  async createPerformanceMetrics(metrics: InsertPerformanceMetrics): Promise<PerformanceMetrics> {
    const result = await db.insert(performanceMetrics).values(metrics).returning();
    return result[0];
  }

  // Budget pacing methods
  async getBudgetPacing(googleAdsAccountId: string, campaignId?: string): Promise<BudgetPacing[]> {
    if (campaignId) {
      return await db.select().from(budgetPacing)
        .where(and(
          eq(budgetPacing.googleAdsAccountId, googleAdsAccountId),
          eq(budgetPacing.campaignId, campaignId)
        ))
        .orderBy(desc(budgetPacing.date));
    }
    
    return await db.select().from(budgetPacing)
      .where(eq(budgetPacing.googleAdsAccountId, googleAdsAccountId))
      .orderBy(desc(budgetPacing.date));
  }

  async createBudgetPacing(pacing: InsertBudgetPacing): Promise<BudgetPacing> {
    const result = await db.insert(budgetPacing).values(pacing).returning();
    return result[0];
  }

  async updateBudgetPacing(id: string, updates: Partial<BudgetPacing>): Promise<BudgetPacing | undefined> {
    const result = await db.update(budgetPacing)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(budgetPacing.id, id))
      .returning();
    return result[0];
  }

  // Escalation settings methods
  async getEscalationSettings(userId: string, googleAdsAccountId?: string): Promise<EscalationSettings[]> {
    if (googleAdsAccountId) {
      return await db.select().from(escalationSettings)
        .where(and(
          eq(escalationSettings.userId, userId),
          eq(escalationSettings.googleAdsAccountId, googleAdsAccountId)
        ))
        .orderBy(desc(escalationSettings.createdAt));
    }
    
    return await db.select().from(escalationSettings)
      .where(eq(escalationSettings.userId, userId))
      .orderBy(desc(escalationSettings.createdAt));
  }

  async getEscalationSetting(id: string): Promise<EscalationSettings | undefined> {
    const result = await db.select().from(escalationSettings).where(eq(escalationSettings.id, id));
    return result[0];
  }

  async getEscalationSettingsByCampaign(campaignId: string): Promise<EscalationSettings[]> {
    return await db.select().from(escalationSettings)
      .where(eq(escalationSettings.campaignId, campaignId))
      .orderBy(desc(escalationSettings.createdAt));
  }

  async createEscalationSetting(setting: InsertEscalationSettings): Promise<EscalationSettings> {
    const result = await db.insert(escalationSettings).values(setting).returning();
    return result[0];
  }

  async updateEscalationSetting(id: string, updates: Partial<EscalationSettings>): Promise<EscalationSettings | undefined> {
    const result = await db.update(escalationSettings)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(escalationSettings.id, id))
      .returning();
    return result[0];
  }

  async deleteEscalationSetting(id: string): Promise<void> {
    await db.delete(escalationSettings).where(eq(escalationSettings.id, id));
  }
}

export const storage = new DbStorage();
