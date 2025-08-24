-- Performance optimization indexes for LaneMC database
-- Run this migration to improve query performance

-- =============================================================================
-- FOREIGN KEY INDEXES (Critical for join performance)
-- =============================================================================

-- Campaigns table foreign keys
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_google_ads_account_id 
ON campaigns (google_ads_account_id);

-- Chat sessions foreign keys  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_user_id 
ON chat_sessions (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_google_ads_account_id 
ON chat_sessions (google_ads_account_id);

-- Chat messages foreign keys
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_id 
ON chat_messages (session_id);

-- Campaign briefs foreign keys
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_briefs_user_id 
ON campaign_briefs (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_briefs_google_ads_account_id 
ON campaign_briefs (google_ads_account_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_briefs_chat_session_id 
ON campaign_briefs (chat_session_id);

-- Performance metrics foreign keys
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_google_ads_account_id 
ON performance_metrics (google_ads_account_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_campaign_id 
ON performance_metrics (campaign_id);

-- Budget pacing foreign keys
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_pacing_google_ads_account_id 
ON budget_pacing (google_ads_account_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_pacing_campaign_id 
ON budget_pacing (campaign_id);

-- =============================================================================
-- DATE/TIME INDEXES (Critical for time-series queries)
-- =============================================================================

-- Performance metrics date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_date 
ON performance_metrics (date DESC);

-- Composite index for account + date queries (most common pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_account_date 
ON performance_metrics (google_ads_account_id, date DESC);

-- Composite index for campaign + date queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_campaign_date 
ON performance_metrics (campaign_id, date DESC);

-- Budget pacing date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_pacing_date 
ON budget_pacing (date DESC);

-- Composite index for budget pacing account + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_pacing_account_date 
ON budget_pacing (google_ads_account_id, date DESC);

-- Created timestamp indexes for recent item queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_created_at 
ON campaigns (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_created_at 
ON chat_sessions (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_created_at 
ON chat_messages (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_briefs_created_at 
ON campaign_briefs (created_at DESC);

-- Updated timestamp indexes for recently modified items
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_updated_at 
ON campaigns (updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_briefs_updated_at 
ON campaign_briefs (updated_at DESC);

-- =============================================================================
-- STATUS/ENUM INDEXES (For filtering and grouping)
-- =============================================================================

-- Campaign status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_status 
ON campaigns (status);

-- Google Ads accounts active status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_google_ads_accounts_is_active 
ON google_ads_accounts (is_active);

-- Campaign brief status filtering  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_briefs_status 
ON campaign_briefs (status);

-- Budget pacing status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_pacing_pacing_status 
ON budget_pacing (pacing_status);

-- Chat message role filtering (for separating user/assistant messages)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_role 
ON chat_messages (role);

-- =============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- =============================================================================

-- Active campaigns by account (very common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_account_status_active 
ON campaigns (google_ads_account_id, status) 
WHERE status IN ('ENABLED', 'PAUSED');

-- Recent chat messages by session (chat history queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_created 
ON chat_messages (session_id, created_at DESC);

-- User's recent chat sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_user_created 
ON chat_sessions (user_id, created_at DESC);

-- User's campaign briefs by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_briefs_user_status 
ON campaign_briefs (user_id, status);

-- Recent performance metrics for surgical analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_account_campaign_date 
ON performance_metrics (google_ads_account_id, campaign_id, date DESC);

-- =============================================================================
-- SPECIALIZED INDEXES FOR SURGICAL ANALYSIS QUERIES
-- =============================================================================

-- Budget variance analysis (over/under pacing detection)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_pacing_variance_analysis 
ON budget_pacing (google_ads_account_id, pacing_status, date DESC)
WHERE pacing_status IN ('over_pacing', 'under_pacing');

-- High-spend campaigns for priority analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_high_cost 
ON performance_metrics (google_ads_account_id, cost DESC, date DESC)
WHERE cost > 100.00; -- Focus on campaigns with significant spend

-- Conversion performance analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_conversion_performance 
ON performance_metrics (campaign_id, conversion_rate DESC, date DESC)
WHERE conversions > 0;

-- =============================================================================
-- GIN INDEXES FOR JSONB COLUMNS (For complex queries on JSON data)
-- =============================================================================

-- Campaign targeting and keyword searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_target_locations_gin 
ON campaigns USING GIN (target_locations);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_keywords_gin 
ON campaigns USING GIN (keywords);

-- Campaign brief search and filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_briefs_objectives_gin 
ON campaign_briefs USING GIN (objectives);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_briefs_target_audience_gin 
ON campaign_briefs USING GIN (target_audience);

-- Budget pacing recommendations search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_pacing_recommendations_gin 
ON budget_pacing USING GIN (recommendations);

-- =============================================================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- =============================================================================

-- Only index active Google Ads accounts (most queries only care about active)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_google_ads_accounts_customer_id_active 
ON google_ads_accounts (customer_id) 
WHERE is_active = true;

-- Only index enabled/paused campaigns (ignore removed campaigns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_name_active 
ON campaigns (name) 
WHERE status IN ('ENABLED', 'PAUSED');

-- Recent performance data (last 90 days) for faster dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_recent 
ON performance_metrics (google_ads_account_id, campaign_id, date DESC)
WHERE date > NOW() - INTERVAL '90 days';

-- =============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER OPTIMIZATION
-- =============================================================================

-- Update table statistics after creating indexes
ANALYZE users;
ANALYZE google_ads_accounts;  
ANALYZE campaigns;
ANALYZE chat_sessions;
ANALYZE chat_messages;
ANALYZE campaign_briefs;
ANALYZE performance_metrics;
ANALYZE budget_pacing;

-- =============================================================================
-- PERFORMANCE MONITORING QUERIES
-- =============================================================================

-- Check index usage statistics (run periodically to ensure indexes are being used)
-- SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY idx_tup_read DESC;

-- Check table scan vs index scan ratios
-- SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
-- FROM pg_stat_user_tables 
-- WHERE schemaname = 'public'
-- ORDER BY seq_scan DESC;

-- Find missing indexes on foreign keys
-- SELECT 
--   c.conname AS constraint_name,
--   t.relname AS table_name,
--   ARRAY_AGG(col.attname ORDER BY u.attposition) AS columns,
--   pg_size_pretty(pg_relation_size(t.oid)) AS table_size
-- FROM pg_constraint c 
-- JOIN pg_class t ON c.conrelid = t.oid 
-- JOIN pg_namespace n ON t.relnamespace = n.oid 
-- JOIN UNNEST(c.conkey) WITH ORDINALITY AS u(attnum, attposition) ON true
-- JOIN pg_attribute col ON (col.attrelid = t.oid AND col.attnum = u.attnum)
-- LEFT JOIN pg_index i ON (i.indrelid = t.oid AND i.indkey[0] = u.attnum)
-- WHERE c.contype = 'f' 
--   AND n.nspname = 'public'
--   AND i.indexrelid IS NULL
-- GROUP BY c.conname, t.relname, t.oid;