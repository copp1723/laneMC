import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // user, admin
  createdAt: timestamp("created_at").defaultNow(),
});

export const googleAdsAccounts = pgTable("google_ads_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: text("customer_id").notNull().unique(),
  name: text("name").notNull(),
  currency: text("currency").default("USD"),
  timezone: text("timezone"),
  isActive: boolean("is_active").default(true),
  refreshToken: text("refresh_token"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  googleAdsAccountId: varchar("google_ads_account_id").references(() => googleAdsAccounts.id),
  googleCampaignId: text("google_campaign_id"),
  name: text("name").notNull(),
  type: text("type").notNull(), // SEARCH, DISPLAY, VIDEO, etc.
  status: text("status").default("PAUSED"), // ENABLED, PAUSED, REMOVED
  budget: decimal("budget", { precision: 10, scale: 2 }),
  bidStrategy: text("bid_strategy"),
  targetLocations: jsonb("target_locations"),
  keywords: jsonb("keywords"),
  adGroups: jsonb("ad_groups"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  googleAdsAccountId: varchar("google_ads_account_id").references(() => googleAdsAccounts.id),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => chatSessions.id),
  role: text("role").notNull(), // user, assistant
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // for storing additional data like function calls
  createdAt: timestamp("created_at").defaultNow(),
});

export const campaignBriefs = pgTable("campaign_briefs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  googleAdsAccountId: varchar("google_ads_account_id").references(() => googleAdsAccounts.id),
  chatSessionId: varchar("chat_session_id").references(() => chatSessions.id),
  title: text("title").notNull(),
  objectives: jsonb("objectives"),
  targetAudience: jsonb("target_audience"),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  timeline: jsonb("timeline"),
  status: text("status").default("draft"), // draft, pending_approval, approved, rejected
  generatedCampaign: jsonb("generated_campaign"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const performanceMetrics = pgTable("performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  googleAdsAccountId: varchar("google_ads_account_id").references(() => googleAdsAccounts.id),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  date: timestamp("date").notNull(),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  conversions: integer("conversions").default(0),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0"),
  revenue: decimal("revenue", { precision: 10, scale: 2 }),
  ctr: decimal("ctr", { precision: 5, scale: 4 }),
  cpc: decimal("cpc", { precision: 10, scale: 2 }),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 4 }),
});

export const budgetPacing = pgTable("budget_pacing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  googleAdsAccountId: varchar("google_ads_account_id").references(() => googleAdsAccounts.id),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  date: timestamp("date").notNull(),
  budgetTarget: decimal("budget_target", { precision: 10, scale: 2 }),
  actualSpend: decimal("actual_spend", { precision: 10, scale: 2 }),
  pacingStatus: text("pacing_status"), // on_track, under_pacing, over_pacing
  recommendations: jsonb("recommendations"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertGoogleAdsAccountSchema = createInsertSchema(googleAdsAccounts).omit({ id: true, createdAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({ id: true, createdAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertCampaignBriefSchema = createInsertSchema(campaignBriefs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPerformanceMetricsSchema = createInsertSchema(performanceMetrics).omit({ id: true });
export const insertBudgetPacingSchema = createInsertSchema(budgetPacing).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type GoogleAdsAccount = typeof googleAdsAccounts.$inferSelect;
export type InsertGoogleAdsAccount = z.infer<typeof insertGoogleAdsAccountSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type CampaignBrief = typeof campaignBriefs.$inferSelect;
export type InsertCampaignBrief = z.infer<typeof insertCampaignBriefSchema>;
export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetrics = z.infer<typeof insertPerformanceMetricsSchema>;
export type BudgetPacing = typeof budgetPacing.$inferSelect;
export type InsertBudgetPacing = z.infer<typeof insertBudgetPacingSchema>;
