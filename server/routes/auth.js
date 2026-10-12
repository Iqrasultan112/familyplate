import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { getJwtSecret } from '../security/jwtSecret.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = express.Router();
const prisma = new PrismaClient();
router.post('/register', rateLimit({ limit: 12, windowMs: 60 * 60 * 1000, message: 'Too many signup attempts. Please try again later.' }), async (req, res) => {
  try {
    const { password, allergies, dietaryPreferences, dislikes } = req.body;
    const name = String(req.body.name || '').trim().slice(0, 80);
    const email = String(req.body.email || '').trim().toLowerCase();
    // Planner is the default; allow the signup form to save an explicit
    // family-member choice too. Family membership itself remains invite-based.
    const requestedRole = String(req.body.role || 'maker').toLowerCase();
    const role = ['maker', 'member'].includes(requestedRole) ? requestedRole : 'maker';
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email and password' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (String(password).length < 8 || Buffer.byteLength(String(password), 'utf8') > 72) return res.status(400).json({ error: 'Password must be at least 8 characters and no more than 72 bytes' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        allergies: typeof allergies === 'object' ? JSON.stringify(allergies) : allergies || null,
        dietaryPreferences: typeof dietaryPreferences === 'object' ? JSON.stringify(dietaryPreferences) : dietaryPreferences || null,
        dislikes: dislikes || null
      }
    });

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, getJwtSecret(), { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        allergies: user.allergies ? JSON.parse(user.allergies) : [],
        dietaryPreferences: user.dietaryPreferences ? JSON.parse(user.dietaryPreferences) : [],
        dislikes: user.dislikes
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', rateLimit({ limit: 12, windowMs: 15 * 60 * 1000, message: 'Too many sign-in attempts. Wait a little, then try again.' }), async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, getJwtSecret(), { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role || 'member',
        allergies: user.allergies ? JSON.parse(user.allergies) : [],
        dietaryPreferences: user.dietaryPreferences ? JSON.parse(user.dietaryPreferences) : [],
        dislikes: user.dislikes
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

router.post('/reset-password', async (req, res) => {
  return res.status(503).json({ error: 'Password recovery is not configured yet. For your account safety, no password was changed.' });
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        allergies: true,
        dietaryPreferences: true,
        dislikes: true
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      ...user,
      allergies: user.allergies ? JSON.parse(user.allergies) : [],
      dietaryPreferences: user.dietaryPreferences ? JSON.parse(user.dietaryPreferences) : []
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
