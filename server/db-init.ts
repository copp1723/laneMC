import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export async function initializeDatabase() {
  const tempPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const tempDb = drizzle(tempPool);

  try {
    console.log('🔄 Initializing database schema...');

    // Create users table
    await tempDb.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create google_ads_accounts table
    await tempDb.execute(sql`
      CREATE TABLE IF NOT EXISTS google_ads_accounts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        currency TEXT DEFAULT 'USD',
        timezone TEXT,
        is_active BOOLEAN DEFAULT true,
        refresh_token TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create campaigns table
    await tempDb.execute(sql`
      CREATE TABLE IF NOT EXISTS campaigns (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        google_ads_account_id VARCHAR REFERENCES google_ads_accounts(id),
        google_campaign_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'PAUSED',
        budget DECIMAL(10, 2),
        bid_strategy TEXT,
        target_locations JSONB,
        keywords JSONB,
        ad_groups JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create chat_sessions table
    await tempDb.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id),
        google_ads_account_id VARCHAR REFERENCES google_ads_accounts(id),
        title TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create chat_messages table
    await tempDb.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR REFERENCES chat_sessions(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create campaign_briefs table
    await tempDb.execute(sql`
      CREATE TABLE IF NOT EXISTS campaign_briefs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id),
        google_ads_account_id VARCHAR REFERENCES google_ads_accounts(id),
        chat_session_id VARCHAR REFERENCES chat_sessions(id),
        title TEXT NOT NULL,
        objectives JSONB,
        target_audience JSONB,
        budget DECIMAL(10,2),
        timeline JSONB,
        status TEXT DEFAULT 'draft',
        generated_campaign JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create performance_metrics table
    await tempDb.execute(sql`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id VARCHAR REFERENCES campaigns(id),
        date DATE NOT NULL,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        cost DECIMAL(10, 2) DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        conversion_value DECIMAL(10, 2) DEFAULT 0,
        ctr DECIMAL(5, 4) DEFAULT 0,
        cpc DECIMAL(10, 2) DEFAULT 0,
        cpa DECIMAL(10, 2) DEFAULT 0,
        roas DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create budget_pacing table
    await tempDb.execute(sql`
      CREATE TABLE IF NOT EXISTS budget_pacing (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id VARCHAR REFERENCES campaigns(id),
        date DATE NOT NULL,
        budget_allocated DECIMAL(10, 2) NOT NULL,
        budget_spent DECIMAL(10, 2) DEFAULT 0,
        pacing_percentage DECIMAL(5, 2) DEFAULT 0,
        recommended_adjustment DECIMAL(5, 2) DEFAULT 0,
        status TEXT DEFAULT 'on_track',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create escalation_settings table
    await tempDb.execute(sql`
      CREATE TABLE IF NOT EXISTS escalation_settings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        google_ads_account_id VARCHAR REFERENCES google_ads_accounts(id),
        metric_type TEXT NOT NULL,
        threshold_value DECIMAL(10, 2) NOT NULL,
        threshold_operator TEXT NOT NULL,
        notification_method TEXT NOT NULL,
        notification_target TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create supermemory_connections table
    await tempDb.execute(sql`
      CREATE TABLE IF NOT EXISTS supermemory_connections (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        connection_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        container_tags JSONB,
        document_limit INTEGER,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create supermemory_memories table
    await tempDb.execute(sql`
      CREATE TABLE IF NOT EXISTS supermemory_memories (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        memory_id TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        container_tags JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Database schema initialized successfully');

    // Test the connection by checking if users table exists and has the password column
    const result = await tempDb.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'password';
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Users table with password column confirmed');
    } else {
      console.error('❌ Users table password column not found');
    }
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    await tempPool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase().catch(console.error);
}
