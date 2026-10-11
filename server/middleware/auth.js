import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getJwtSecret } from '../security/jwtSecret.js';

const prisma = new PrismaClient();

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded; // { id, name, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireMaker = async (req, res, next) => {
  try {
    const account = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
    if (account?.role !== 'maker') return res.status(403).json({ error: 'This area is managed by your family meal planner' });
    req.user.role = account.role;
    next();
  } catch {
    res.status(500).json({ error: 'Could not verify your family permissions' });
  }
};
