/**
 * Comprehensive Error Handling Service
 * Provides centralized error handling with proper status codes and user-friendly messages
 */

import { Request, Response, NextFunction } from 'express';
import Logger from './logger';

// Custom error classes
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public field?: string;
  public value?: any;

  constructor(message: string, field?: string, value?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden access') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class ExternalServiceError extends AppError {
  public service: string;

  constructor(message: string, service: string, statusCode: number = 503) {
    super(message, statusCode, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    field?: string;
    timestamp: string;
    requestId?: string;
  };
  details?: any;
}

export class ErrorHandler {
  /**
   * Global error handling middleware
   */
  static handle(err: Error, req: Request, res: Response, _next: NextFunction): void {
    const requestId = (req as any).requestId;
    
    // Log the error
    Logger.error('Request error occurred', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      requestId,
      userId: (req as any).user?.id
    });

    // Handle different error types
    if (err instanceof AppError) {
      ErrorHandler.handleAppError(err, req, res, requestId);
    } else if (err.name === 'ValidationError' || err.name === 'ZodError') {
      ErrorHandler.handleValidationError(err, req, res, requestId);
    } else if (err.name === 'JsonWebTokenError') {
      ErrorHandler.handleJWTError(err, req, res, requestId);
    } else if (err.name === 'TokenExpiredError') {
      ErrorHandler.handleTokenExpiredError(err, req, res, requestId);
    } else if (err.name === 'SyntaxError' && 'body' in err) {
      ErrorHandler.handleJSONParseError(err, req, res, requestId);
    } else {
      ErrorHandler.handleGenericError(err, req, res, requestId);
    }
  }

  /**
   * Handle custom application errors
   */
  private static handleAppError(err: AppError, _req: Request, res: Response, requestId?: string): void {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: err.message,
        code: err.code,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    if (err instanceof ValidationError) {
      response.error.field = err.field;
    }

    res.status(err.statusCode).json(response);
  }

  /**
   * Handle validation errors (Zod, etc.)
   */
  private static handleValidationError(err: any, _req: Request, res: Response, requestId?: string): void {
    let message = 'Validation failed';
    let field: string | undefined;

    if (err.issues && Array.isArray(err.issues)) {
      // Zod error
      const issue = err.issues[0];
      message = issue.message;
      field = issue.path?.join('.');
    } else if (err.errors && Array.isArray(err.errors)) {
      // Other validation errors
      const error = err.errors[0];
      message = error.message;
      field = error.field;
    }

    const response: ErrorResponse = {
      success: false,
      error: {
        message: ErrorHandler.getUserFriendlyMessage(message),
        code: 'VALIDATION_ERROR',
        field,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    res.status(400).json(response);
  }

  /**
   * Handle JWT errors
   */
  private static handleJWTError(_err: Error, _req: Request, res: Response, requestId?: string): void {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: 'Invalid authentication token',
        code: 'INVALID_TOKEN',
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    res.status(401).json(response);
  }

  /**
   * Handle expired token errors
   */
  private static handleTokenExpiredError(_err: Error, _req: Request, res: Response, requestId?: string): void {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: 'Authentication token has expired',
        code: 'TOKEN_EXPIRED',
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    res.status(401).json(response);
  }

  /**
   * Handle JSON parse errors
   */
  private static handleJSONParseError(_err: Error, _req: Request, res: Response, requestId?: string): void {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    res.status(400).json(response);
  }

  /**
   * Handle generic/unknown errors
   */
  private static handleGenericError(err: Error, _req: Request, res: Response, requestId?: string): void {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const response: ErrorResponse = {
      success: false,
      error: {
        message: isDevelopment ? err.message : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    // Include stack trace in development
    if (isDevelopment) {
      response.details = {
        stack: err.stack,
        name: err.name
      };
    }

    res.status(500).json(response);
  }

  /**
   * Convert technical error messages to user-friendly ones
   */
  private static getUserFriendlyMessage(message: string): string {
    const friendlyMessages: Record<string, string> = {
      'Required': 'This field is required',
      'Invalid email': 'Please enter a valid email address',
      'String must contain at least 1 character(s)': 'This field cannot be empty',
      'String must contain at least 6 character(s)': 'Password must be at least 6 characters long',
      'Expected string, received number': 'Please enter text for this field',
      'Expected number, received string': 'Please enter a valid number',
      'Invalid input': 'Please check your input and try again'
    };

    return friendlyMessages[message] || message;
  }

  /**
   * Handle 404 errors for undefined routes
   */
  static handle404(req: Request, res: Response): void {
    const requestId = (req as any).requestId;
    
    Logger.warn('Route not found', {
      url: req.url,
      method: req.method,
      requestId,
      userAgent: req.get('User-Agent')
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        message: `Route ${req.method} ${req.path} not found`,
        code: 'ROUTE_NOT_FOUND',
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    res.status(404).json(response);
  }

  /**
   * Async error wrapper for route handlers
   */
  static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}
