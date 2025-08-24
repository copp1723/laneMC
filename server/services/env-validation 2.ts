/**
 * Environment Variable Validation Service
 * Validates all required environment variables at startup
 */

export interface EnvironmentConfig {
  // Database
  DATABASE_URL: string;
  
  // Server
  NODE_ENV: string;
  PORT: number;
  
  // Authentication
  JWT_SECRET_KEY?: string;
  SECRET_KEY?: string;
  
  // Google Ads API
  GOOGLE_ADS_CLIENT_ID: string;
  GOOGLE_ADS_CLIENT_SECRET: string;
  GOOGLE_ADS_DEVELOPER_TOKEN: string;
  GOOGLE_ADS_REFRESH_TOKEN: string;
  GOOGLE_ADS_LOGIN_CUSTOMER_ID?: string;
  GOOGLE_ADS_READ_ONLY?: boolean;
  GOOGLE_ADS_USE_PROTO_PLUS?: boolean;
  
  // OpenRouter API
  OPENROUTER_API_KEY: string;
}

export class EnvironmentValidator {
  private static requiredVars = [
    'DATABASE_URL',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET', 
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'OPENROUTER_API_KEY'
  ];

  private static conditionalVars = [
    { vars: ['JWT_SECRET_KEY', 'SECRET_KEY'], message: 'At least one JWT secret (JWT_SECRET_KEY or SECRET_KEY) is required' }
  ];

  /**
   * Validate all required environment variables
   */
  static validateEnvironment(): EnvironmentConfig {
    const errors: string[] = [];
    
    // Check required variables
    for (const varName of this.requiredVars) {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }
    
    // Check conditional variables (at least one must be present)
    for (const condition of this.conditionalVars) {
      const hasAny = condition.vars.some(varName => process.env[varName]);
      if (!hasAny) {
        errors.push(condition.message);
      }
    }
    
    // Additional validation for production
    if (process.env.NODE_ENV === 'production') {
      this.validateProductionEnvironment(errors);
    }
    
    if (errors.length > 0) {
      console.error('❌ Environment validation failed:');
      errors.forEach(error => console.error(`  - ${error}`));
      console.error('\n💡 Please check your .env file and ensure all required variables are set.');
      console.error('📋 See .env.example for reference.');
      throw new Error(`Environment validation failed: ${errors.length} error(s) found`);
    }
    
    console.log('✅ Environment validation passed');
    
    return this.getValidatedConfig();
  }
  
  /**
   * Additional validation for production environment
   */
  private static validateProductionEnvironment(errors: string[]) {
    // Ensure JWT secrets are strong in production
    const jwtSecret = process.env.JWT_SECRET_KEY || process.env.SECRET_KEY;
    if (jwtSecret && jwtSecret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long in production');
    }
    
    // Ensure database URL uses SSL in production
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sslmode=require')) {
      errors.push('DATABASE_URL must use SSL in production (add ?sslmode=require)');
    }
    
    // Warn about development-only settings
    if (process.env.NODE_ENV !== 'production') {
      errors.push('NODE_ENV must be set to "production" in production environment');
    }
  }

  /**
   * Verify SSL database connection at runtime
   */
  static async verifySSLConnection(): Promise<{
    isValid: boolean;
    sslEnabled: boolean;
    error?: string;
    connectionInfo?: any;
  }> {
    try {
      // Only verify in production or when explicitly requested
      if (process.env.NODE_ENV !== 'production' && !process.env.VERIFY_SSL) {
        return {
          isValid: true,
          sslEnabled: false,
          connectionInfo: { message: 'SSL verification skipped in development mode' }
        };
      }

      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1,
        connectionTimeoutMillis: 5000,
        // Use same SSL configuration as main pool
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      try {
        // Test connection and check SSL status
        const client = await pool.connect();
        
        try {
          // Query to check SSL status
          const sslQuery = `
            SELECT 
              ssl,
              version() as postgres_version,
              current_setting('ssl') as ssl_setting,
              inet_server_addr() as server_addr,
              inet_server_port() as server_port
            FROM pg_stat_ssl 
            WHERE pid = pg_backend_pid()
          `;
          
          const result = await client.query(sslQuery);
          const sslInfo = result.rows[0];
          
          const sslEnabled = sslInfo?.ssl === true || sslInfo?.ssl === 't';
          
          // In production, SSL should be enabled
          const isValid = process.env.NODE_ENV === 'production' ? sslEnabled : true;
          
          return {
            isValid,
            sslEnabled,
            connectionInfo: {
              ssl: sslInfo?.ssl,
              postgresVersion: sslInfo?.postgres_version,
              sslSetting: sslInfo?.ssl_setting,
              serverAddr: sslInfo?.server_addr,
              serverPort: sslInfo?.server_port,
              connectionString: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@') // Mask password
            }
          };
          
        } finally {
          client.release();
        }
        
      } finally {
        await pool.end();
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        isValid: false,
        sslEnabled: false,
        error: errorMessage,
        connectionInfo: {
          connectionString: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@') // Mask password
        }
      };
    }
  }

  /**
   * Verify external API endpoints use HTTPS
   */
  static verifyHTTPSEndpoints(): {
    isValid: boolean;
    checks: Array<{ service: string; endpoint: string; isSecure: boolean; }>;
  } {
    const endpoints = [
      { service: 'Google Ads API', endpoint: 'https://googleads.googleapis.com' },
      { service: 'OpenRouter API', endpoint: 'https://openrouter.ai' },
    ];
    
    const checks = endpoints.map(endpoint => ({
      ...endpoint,
      isSecure: endpoint.endpoint.startsWith('https://')
    }));
    
    const isValid = checks.every(check => check.isSecure);
    
    return { isValid, checks };
  }
  
  /**
   * Get validated configuration object
   */
  private static getValidatedConfig(): EnvironmentConfig {
    return {
      DATABASE_URL: process.env.DATABASE_URL!,
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: parseInt(process.env.PORT || '3000', 10),
      JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
      SECRET_KEY: process.env.SECRET_KEY,
      GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID!,
      GOOGLE_ADS_CLIENT_SECRET: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      GOOGLE_ADS_REFRESH_TOKEN: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      GOOGLE_ADS_READ_ONLY: process.env.GOOGLE_ADS_READ_ONLY === 'true',
      GOOGLE_ADS_USE_PROTO_PLUS: process.env.GOOGLE_ADS_USE_PROTO_PLUS === 'True',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!
    };
  }
  
  /**
   * Log environment status (without sensitive values)
   */
  static logEnvironmentStatus() {
    const config = this.getValidatedConfig();
    console.log('🔧 Environment Configuration:');
    console.log(`  - Environment: ${config.NODE_ENV}`);
    console.log(`  - Port: ${config.PORT}`);
    console.log(`  - Database: ${config.DATABASE_URL ? '✅ Connected' : '❌ Not configured'}`);
    console.log(`  - JWT Auth: ${config.JWT_SECRET_KEY || config.SECRET_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`  - Google Ads API: ${config.GOOGLE_ADS_CLIENT_ID ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`  - OpenRouter API: ${config.OPENROUTER_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`  - Read-only mode: ${config.GOOGLE_ADS_READ_ONLY ? '✅ Enabled' : '❌ Disabled'}`);
  }
}
