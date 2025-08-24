import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

// Validate JWT secret is provided
if (!process.env.JWT_SECRET_KEY && !process.env.SECRET_KEY) {
  throw new Error('JWT_SECRET_KEY or SECRET_KEY environment variable is required for authentication');
}

const JWT_SECRET = (process.env.JWT_SECRET_KEY || process.env.SECRET_KEY) as string;

// Token blacklist for logout functionality (in-memory for MVP)
const tokenBlacklist = new Set<string>();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  // Check if token is blacklisted
  if (tokenBlacklist.has(token)) {
    return res.status(403).json({ message: 'Token has been invalidated' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  try {
    const user = await storage.getUser(payload.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    res.status(500).json({ message: 'Authentication error' });
  }
}

export function requireRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

export function invalidateToken(token: string): void {
  tokenBlacklist.add(token);
  
  // Clean up expired tokens periodically (simple cleanup for MVP)
  if (tokenBlacklist.size > 1000) {
    // In production, this would be more sophisticated with actual expiry checking
    tokenBlacklist.clear();
  }
}
