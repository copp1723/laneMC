/**
 * Request Validation Middleware
 * Provides comprehensive validation for request parameters, body, and query strings
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../services/error-handler';
import Logger from '../services/logger';

export interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  headers?: ZodSchema;
}

/**
 * Validation middleware factory
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      // Validate request parameters
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      // Validate query parameters
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }

      // Validate headers
      if (schemas.headers) {
        req.headers = schemas.headers.parse(req.headers);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.errors[0];
        const field = firstError.path.join('.');
        const message = firstError.message;

        Logger.warn('Request validation failed', {
          url: req.url,
          method: req.method,
          field,
          message,
          value: 'received' in firstError ? firstError.received : undefined
        });

        next(new ValidationError(message, field, 'received' in firstError ? firstError.received : undefined));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // ID parameter validation
  idParam: z.object({
    id: z.string().uuid('Invalid ID format')
  }),

  // Account ID parameter validation
  accountIdParam: z.object({
    accountId: z.string().min(1, 'Account ID is required')
  }),

  // Campaign ID parameter validation
  campaignIdParam: z.object({
    campaignId: z.string().min(1, 'Campaign ID is required')
  }),

  // Pagination query validation
  paginationQuery: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a number').transform(Number).optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional()
  }),

  // Date range query validation
  dateRangeQuery: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
    dateRange: z.enum(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'LAST_MONTH']).optional()
  }),

  // Account ID query validation
  accountIdQuery: z.object({
    accountId: z.string().min(1, 'Account ID is required')
  }),

  // Optional account ID query validation
  optionalAccountIdQuery: z.object({
    accountId: z.string().min(1, 'Account ID is required').optional()
  })
};

/**
 * Authentication validation schemas
 */
export const authSchemas = {
  login: z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required')
  }),

  register: z.object({
    username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be less than 50 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password must be less than 100 characters')
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters').max(100, 'New password must be less than 100 characters')
  })
};

/**
 * Campaign validation schemas
 */
export const campaignSchemas = {
  create: z.object({
    name: z.string().min(1, 'Campaign name is required').max(255, 'Campaign name must be less than 255 characters'),
    type: z.enum(['SEARCH', 'DISPLAY', 'VIDEO', 'SHOPPING', 'APP'], {
      errorMap: () => ({ message: 'Campaign type must be one of: SEARCH, DISPLAY, VIDEO, SHOPPING, APP' })
    }),
    budget: z.number().positive('Budget must be a positive number'),
    googleAdsAccountId: z.string().min(1, 'Google Ads account ID is required'),
    bidStrategy: z.string().optional(),
    targetLocations: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional()
  }),

  update: z.object({
    name: z.string().min(1, 'Campaign name is required').max(255, 'Campaign name must be less than 255 characters').optional(),
    status: z.enum(['ENABLED', 'PAUSED', 'REMOVED']).optional(),
    budget: z.number().positive('Budget must be a positive number').optional(),
    bidStrategy: z.string().optional(),
    targetLocations: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional()
  })
};

/**
 * Chat validation schemas
 */
export const chatSchemas = {
  createSession: z.object({
    title: z.string().min(1, 'Session title is required').max(255, 'Session title must be less than 255 characters').optional(),
    googleAdsAccountId: z.string().min(1, 'Google Ads account ID is required')
  }),

  createMessage: z.object({
    content: z.string().min(1, 'Message content is required').max(10000, 'Message content must be less than 10,000 characters'),
    role: z.enum(['user', 'assistant']).optional()
  })
};

/**
 * Campaign brief validation schemas
 */
export const campaignBriefSchemas = {
  create: z.object({
    title: z.string().min(1, 'Brief title is required').max(255, 'Brief title must be less than 255 characters'),
    googleAdsAccountId: z.string().min(1, 'Google Ads account ID is required'),
    chatSessionId: z.string().min(1, 'Chat session ID is required').optional(),
    objectives: z.array(z.string()).min(1, 'At least one objective is required'),
    targetAudience: z.object({
      demographics: z.array(z.string()).optional(),
      interests: z.array(z.string()).optional(),
      behaviors: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional()
    }).optional(),
    budget: z.number().positive('Budget must be a positive number'),
    timeline: z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
      duration: z.string().optional()
    })
  }),

  update: z.object({
    title: z.string().min(1, 'Brief title is required').max(255, 'Brief title must be less than 255 characters').optional(),
    objectives: z.array(z.string()).min(1, 'At least one objective is required').optional(),
    targetAudience: z.object({
      demographics: z.array(z.string()).optional(),
      interests: z.array(z.string()).optional(),
      behaviors: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional()
    }).optional(),
    budget: z.number().positive('Budget must be a positive number').optional(),
    timeline: z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
      duration: z.string().optional()
    }).optional(),
    status: z.enum(['draft', 'pending_approval', 'approved', 'rejected']).optional()
  })
};

/**
 * Sanitize input middleware
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  // Sanitize string inputs to prevent XSS
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
}

/**
 * Rate limiting validation
 */
export function validateRateLimit(maxRequests: number, windowMs: number) {
  const requests = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    if (!requests.has(clientId)) {
      requests.set(clientId, []);
    }

    const clientRequests = requests.get(clientId)!;
    
    // Remove old requests outside the window
    const validRequests = clientRequests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          timestamp: new Date().toISOString()
        }
      });
    }

    validRequests.push(now);
    requests.set(clientId, validRequests);
    
    next();
  };
}
