#!/usr/bin/env tsx

/**
 * Database Optimization Script
 * Run this script to optimize database performance
 */

import { config } from 'dotenv';
config();

import { Pool } from 'pg';
import { DatabaseOptimizer } from '../server/services/database-optimizer';
import Logger from '../server/services/logger';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5, // Lower connection pool for script
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    DatabaseOptimizer.initialize(pool);

    const args = process.argv.slice(2);
    const command = args[0] || 'report';

    switch (command) {
      case 'indexes':
        console.log('🚀 Running performance indexes migration...');
        await DatabaseOptimizer.runPerformanceIndexes();
        console.log('✅ Performance indexes created successfully');
        break;

      case 'analyze':
        console.log('📊 Updating table statistics...');
        await DatabaseOptimizer.updateTableStatistics();
        console.log('✅ Table statistics updated');
        break;

      case 'maintenance':
        console.log('🔧 Running database maintenance...');
        await DatabaseOptimizer.runMaintenance();
        console.log('✅ Database maintenance completed');
        break;

      case 'report':
      default:
        console.log('📋 Generating optimization report...');
        const report = await DatabaseOptimizer.generateOptimizationReport();
        
        console.log('\n=== DATABASE OPTIMIZATION REPORT ===\n');
        
        console.log(`📊 Index Usage (Top 10):`);
        report.indexUsage.slice(0, 10).forEach(index => {
          console.log(`  ${index.indexname}: ${index.idx_tup_read.toLocaleString()} reads (${index.usage_ratio.toFixed(1)}% efficiency)`);
        });
        
        console.log(`\n📈 Table Statistics (Top 5 by scan ratio):`);
        report.tableStats.slice(0, 5).forEach(table => {
          console.log(`  ${table.tablename}: ${table.table_scans_ratio.toFixed(1)}% sequential scans (${table.table_size})`);
        });
        
        if (report.unusedIndexes.length > 0) {
          console.log(`\n⚠️  Unused Indexes (${report.unusedIndexes.length}):`);
          report.unusedIndexes.forEach(index => {
            console.log(`  ${index.indexname}: Only ${index.idx_tup_read} reads`);
          });
        }
        
        if (report.tablesNeedingIndexes.length > 0) {
          console.log(`\n🔍 Tables Needing Indexes (${report.tablesNeedingIndexes.length}):`);
          report.tablesNeedingIndexes.forEach(table => {
            console.log(`  ${table.tablename}: ${table.table_scans_ratio.toFixed(1)}% sequential scans`);
          });
        }
        
        if (report.slowQueries.length > 0) {
          console.log(`\n🐌 Slow Queries (${report.slowQueries.length}):`);
          report.slowQueries.slice(0, 5).forEach(query => {
            console.log(`  ${query.mean_time.toFixed(1)}ms avg: ${query.query}...`);
          });
        }
        
        console.log(`\n💡 Recommendations:`);
        report.recommendations.forEach(rec => {
          console.log(`  • ${rec}`);
        });
        
        console.log('\n=== END REPORT ===');
        break;
    }

  } catch (error) {
    console.error('❌ Database optimization failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ES module check for main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}