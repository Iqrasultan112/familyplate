import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// Routes
import authRoutes from './routes/auth.js';
import familyRoutes from './routes/family.js';
import mealRequestRoutes from './routes/mealRequests.js';
import voteRoutes from './routes/votes.js';
import weeklyMenuRoutes from './routes/weeklyMenu.js';
import eventRoutes from './routes/events.js';
import recipeRoutes from './routes/recipes.js';
import communityRoutes from './routes/community.js';
import aiRoutes from './routes/ai.js';
import menuRoutes from './routes/menu.js';
import inventoryRoutes from './routes/inventory.js';
import shoppingRoutes from './routes/shopping.js';
import profileRoutes from './routes/profile.js';
import groupRoutes from './routes/groups.js';

// Sockets
import { setupFamilyChat } from './socket/familyChat.js';
import { setupCommunityChat } from './socket/communityChat.js';
import { getJwtSecret } from './security/jwtSecret.js';

dotenv.config();
getJwtSecret();

const app = express();
const server = http.createServer(app);
const configuredClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedClientOrigins = new Set([configuredClientUrl.replace(/\/$/, '')]);
for (const hostname of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
  if (hostname) allowedClientOrigins.add(`https://${hostname.replace(/^https?:\/\//i, '').replace(/\/$/, '')}`);
}
try {
  const clientOrigin = new URL(configuredClientUrl);
  if (clientOrigin.hostname === 'localhost' || clientOrigin.hostname === '127.0.0.1') {
    const loopbackAlias = new URL(clientOrigin);
    loopbackAlias.hostname = clientOrigin.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    allowedClientOrigins.add(loopbackAlias.origin);
  }
} catch {
  console.warn('CLIENT_URL is not a valid URL; using the configured origin only.');
}
const allowClientOrigin = (origin, callback) => callback(null, !origin || allowedClientOrigins.has(origin));
const io = new Server(server, {
  cors: {
    origin: allowClientOrigin,
    methods: ["GET", "POST"]
  }
});
const prisma = new PrismaClient();
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    socket.data.user = jwt.verify(token, getJwtSecret());
    next();
  } catch {
    next(new Error('Invalid authentication token'));
  }
});

app.use(cors({
  origin: allowClientOrigin,
  credentials: true
}));
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));

// Vercel instances are ephemeral; use their writable temp directory for uploads.
const uploadsDirectory = process.env.VERCEL ? '/tmp/familyplate-uploads' : './uploads';
fs.mkdirSync(uploadsDirectory, { recursive: true });

app.use('/uploads', express.static(uploadsDirectory));

// Setup Sockets
setupFamilyChat(io);
setupCommunityChat(io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/mealRequests', mealRequestRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/weeklyMenu', weeklyMenuRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/groups', groupRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default server;
