import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, hashPassword, comparePassword, generateToken, AuthRequest } from '../services/auth';
import { storage } from '../storage';
import { insertUserSchema } from '@shared/schema';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = insertUserSchema.parse(req.body);

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await hashPassword(password);
    const user = await storage.createUser({ username, email, password: hashedPassword });

    const token = generateToken(user.id);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      const firstError = error.errors[0];
      const fieldName = firstError.path.join('.');
      return res.status(400).json({ message: `${fieldName}: ${firstError.message}` });
    }
    console.error('Registration error:', error);
    res.status(400).json({ message: error.message || 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);

    const user = await storage.getUserByEmail(email);
    if (!user || !(await comparePassword(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      const firstError = error.errors[0];
      const fieldName = firstError.path.join('.');
      return res.status(400).json({ message: `${fieldName}: ${firstError.message}` });
    }
    console.error('Login error:', error);
    res.status(400).json({ message: error.message || 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  res.json({
    user: {
      id: req.user!.id,
      username: req.user!.username,
      email: req.user!.email,
      role: req.user!.role,
    },
  });
});

export default router;
