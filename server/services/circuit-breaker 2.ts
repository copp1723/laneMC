/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by monitoring external service calls
 */

import Logger from './logger';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, calls are rejected
  HALF_OPEN = 'HALF_OPEN' // Testing if service is back
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;     // Time to wait before trying again (ms)
  monitoringPeriod: number;    // Time window for failure counting (ms)
  successThreshold: number;    // Successes needed to close from half-open
  timeout: number;             // Request timeout (ms)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  totalCalls: number;
  rejectedCalls: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private totalCalls: number = 0;
  private rejectedCalls: number = 0;
  private nextAttempt?: number;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {
    Logger.info(`Circuit breaker initialized: ${name}`, { config });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        Logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
      } else {
        this.rejectedCalls++;
        throw new Error(`Circuit breaker ${this.name} is OPEN - service unavailable`);
      }
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Circuit breaker ${this.name} - operation timeout`));
      }, this.config.timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.failures = 0; // Reset failure count on success

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successes = 0;
        Logger.info(`Circuit breaker ${this.name} closed - service recovered`);
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: any): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    Logger.warn(`Circuit breaker ${this.name} recorded failure`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      failures: this.failures,
      threshold: this.config.failureThreshold,
      state: this.state
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during half-open, go back to open
      this.state = CircuitState.OPEN;
      this.successes = 0;
      this.nextAttempt = Date.now() + this.config.recoveryTimeout;
      Logger.warn(`Circuit breaker ${this.name} opened - half-open test failed`);
    } else if (this.state === CircuitState.CLOSED && this.failures >= this.config.failureThreshold) {
      // Too many failures, open the circuit
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.recoveryTimeout;
      Logger.error(`Circuit breaker ${this.name} opened - failure threshold exceeded`, {
        failures: this.failures,
        threshold: this.config.failureThreshold
      });
    }
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttempt ? Date.now() >= this.nextAttempt : false;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalCalls: this.totalCalls,
      rejectedCalls: this.rejectedCalls
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = undefined;
    Logger.info(`Circuit breaker ${this.name} manually reset`);
  }

  /**
   * Check if the circuit is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED;
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerManager {
  private static breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker for a service
   */
  static getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        successThreshold: 3,
        timeout: 30000 // 30 seconds
      };

      const finalConfig = { ...defaultConfig, ...config };
      this.breakers.set(name, new CircuitBreaker(name, finalConfig));
    }

    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  static getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [name, breaker] of Array.from(this.breakers)) {
      stats[name] = breaker.getStats();
    }

    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    for (const breaker of Array.from(this.breakers.values())) {
      breaker.reset();
    }
    Logger.info('All circuit breakers reset');
  }

  /**
   * Get health status of all circuit breakers
   */
  static getHealthStatus(): { healthy: boolean; details: Record<string, boolean> } {
    const details: Record<string, boolean> = {};
    let allHealthy = true;

    for (const [name, breaker] of Array.from(this.breakers)) {
      const isHealthy = breaker.isHealthy();
      details[name] = isHealthy;
      if (!isHealthy) {
        allHealthy = false;
      }
    }

    return { healthy: allHealthy, details };
  }
}
