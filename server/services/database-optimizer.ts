/**
 * Database Performance Optimizer
 * Monitors database performance and provides optimization recommendations
 */

import { Pool } from 'pg';
import Logger from './logger';
import fs from 'fs/promises';
import path from 'path';

export interface IndexUsageStats {
  schemaname: string;
  tablename: string;
  indexname: string;
  idx_tup_read: number;
  idx_tup_fetch: number;
  usage_ratio: number;
}

export interface TableStats {
  schemaname: string;
  tablename: string;
  seq_scan: number;
  seq_tup_read: number;
  idx_scan: number;
  idx_tup_fetch: number;
  table_scans_ratio: number;
  table_size: string;
}

export interface QueryPerformanceStats {
  query: string;
  calls: number;
  total_time: number;
  mean_time: number;
  rows: number;
}

export class DatabaseOptimizer {
  private static pool: Pool;

  static initialize(pool: Pool): void {
    this.pool = pool;
    Logger.info('Database optimizer initialized');
  }

  /**
   * Run performance optimization migration
   */
  static async runPerformanceIndexes(): Promise<void> {
    try {
      const migrationPath = path.join(process.cwd(), 'migrations', 'add_performance_indexes.sql');
      const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
      
      Logger.info('Running performance indexes migration...');
      const startTime = Date.now();
      
      await this.pool.query(migrationSQL);
      
      const duration = Date.now() - startTime;
      Logger.info('Performance indexes migration completed', { 
        duration,
        migrationFile: 'add_performance_indexes.sql'
      });
    } catch (error) {
      Logger.error('Failed to run performance indexes migration', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get index usage statistics
   */
  static async getIndexUsageStats(): Promise<IndexUsageStats[]> {
    try {
      const query = `
        SELECT 
          schemaname, 
          tablename, 
          indexname, 
          idx_tup_read, 
          idx_tup_fetch,
          CASE 
            WHEN idx_tup_read > 0 THEN (idx_tup_fetch::float / idx_tup_read::float) * 100
            ELSE 0 
          END as usage_ratio
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public' 
        ORDER BY idx_tup_read DESC;
      `;
      
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      Logger.error('Failed to get index usage stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get table scan statistics
   */
  static async getTableStats(): Promise<TableStats[]> {
    try {
      const query = `
        SELECT 
          schemaname, 
          tablename, 
          seq_scan, 
          seq_tup_read, 
          idx_scan, 
          idx_tup_fetch,
          CASE 
            WHEN (seq_scan + idx_scan) > 0 
            THEN (seq_scan::float / (seq_scan + idx_scan)::float) * 100
            ELSE 0 
          END as table_scans_ratio,
          pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY seq_scan DESC;
      `;
      
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      Logger.error('Failed to get table stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Find unused indexes that should be considered for removal
   */
  static async getUnusedIndexes(): Promise<IndexUsageStats[]> {
    try {
      const stats = await this.getIndexUsageStats();
      
      // Filter indexes that have very low usage
      const unusedIndexes = stats.filter(index => 
        index.idx_tup_read < 100 && // Less than 100 reads
        !index.indexname.includes('_pkey') && // Not primary keys
        !index.indexname.includes('_unique') // Not unique constraints
      );
      
      Logger.info('Found potentially unused indexes', { 
        count: unusedIndexes.length,
        indexes: unusedIndexes.map(i => i.indexname)
      });
      
      return unusedIndexes;
    } catch (error) {
      Logger.error('Failed to find unused indexes', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Find tables with high sequential scan ratios (may need indexes)
   */
  static async getTablesNeedingIndexes(): Promise<TableStats[]> {
    try {
      const stats = await this.getTableStats();
      
      // Filter tables with high sequential scan ratios
      const needingIndexes = stats.filter(table => 
        table.table_scans_ratio > 50 && // More than 50% sequential scans
        table.seq_scan > 100 // And significant scan activity
      );
      
      Logger.info('Found tables potentially needing indexes', { 
        count: needingIndexes.length,
        tables: needingIndexes.map(t => ({ 
          name: t.tablename, 
          scan_ratio: `${t.table_scans_ratio.toFixed(1)}%`,
          size: t.table_size
        }))
      });
      
      return needingIndexes;
    } catch (error) {
      Logger.error('Failed to find tables needing indexes', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get slow query statistics (requires pg_stat_statements extension)
   */
  static async getSlowQueries(): Promise<QueryPerformanceStats[]> {
    try {
      // Check if pg_stat_statements extension is available
      const extensionQuery = `
        SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';
      `;
      const extensionResult = await this.pool.query(extensionQuery);
      
      if (extensionResult.rows.length === 0) {
        Logger.warn('pg_stat_statements extension not available, cannot get slow query stats');
        return [];
      }
      
      const query = `
        SELECT 
          substr(query, 1, 100) as query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        WHERE mean_time > 100 -- Queries taking more than 100ms on average
        ORDER BY mean_time DESC 
        LIMIT 20;
      `;
      
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      Logger.warn('Could not get slow query stats (pg_stat_statements may not be enabled)', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Update table statistics for query planner
   */
  static async updateTableStatistics(): Promise<void> {
    try {
      Logger.info('Updating table statistics for query planner...');
      
      const tables = [
        'users',
        'google_ads_accounts', 
        'campaigns',
        'chat_sessions',
        'chat_messages',
        'campaign_briefs',
        'performance_metrics',
        'budget_pacing'
      ];
      
      for (const table of tables) {
        await this.pool.query(`ANALYZE ${table}`);
        Logger.debug(`Updated statistics for table: ${table}`);
      }
      
      Logger.info('Table statistics update completed', { tablesUpdated: tables.length });
    } catch (error) {
      Logger.error('Failed to update table statistics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate performance optimization report
   */
  static async generateOptimizationReport(): Promise<{
    indexUsage: IndexUsageStats[];
    tableStats: TableStats[];
    unusedIndexes: IndexUsageStats[];
    tablesNeedingIndexes: TableStats[];
    slowQueries: QueryPerformanceStats[];
    recommendations: string[];
  }> {
    try {
      Logger.info('Generating database optimization report...');
      
      const [indexUsage, tableStats, unusedIndexes, tablesNeedingIndexes, slowQueries] = 
        await Promise.all([
          this.getIndexUsageStats(),
          this.getTableStats(),
          this.getUnusedIndexes(),
          this.getTablesNeedingIndexes(),
          this.getSlowQueries()
        ]);
      
      // Generate recommendations
      const recommendations: string[] = [];
      
      if (unusedIndexes.length > 0) {
        recommendations.push(
          `Consider removing ${unusedIndexes.length} unused indexes to reduce storage and improve write performance`
        );
      }
      
      if (tablesNeedingIndexes.length > 0) {
        recommendations.push(
          `${tablesNeedingIndexes.length} tables have high sequential scan ratios and may benefit from additional indexes`
        );
      }
      
      if (slowQueries.length > 0) {
        recommendations.push(
          `Found ${slowQueries.length} slow queries averaging >100ms - consider optimization`
        );
      }
      
      const highScanTables = tableStats.filter(t => t.table_scans_ratio > 80);
      if (highScanTables.length > 0) {
        recommendations.push(
          `${highScanTables.length} tables have >80% sequential scans - may need composite indexes`
        );
      }
      
      if (recommendations.length === 0) {
        recommendations.push('Database performance appears optimal - no immediate optimizations needed');
      }
      
      Logger.info('Database optimization report generated', {
        indexCount: indexUsage.length,
        tableCount: tableStats.length,
        recommendationCount: recommendations.length
      });
      
      return {
        indexUsage,
        tableStats,
        unusedIndexes,
        tablesNeedingIndexes,
        slowQueries,
        recommendations
      };
    } catch (error) {
      Logger.error('Failed to generate optimization report', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Run maintenance tasks
   */
  static async runMaintenance(): Promise<void> {
    try {
      Logger.info('Running database maintenance tasks...');
      
      await this.updateTableStatistics();
      
      // Could add other maintenance tasks here:
      // - VACUUM ANALYZE for heavily updated tables
      // - Reindex if fragmentation is high
      // - Clean up old performance metrics data
      
      Logger.info('Database maintenance completed');
    } catch (error) {
      Logger.error('Database maintenance failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}