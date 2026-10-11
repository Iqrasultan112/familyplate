import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res) => {
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
        dislikes: true,
        createdAt: true
      }
    });
    const recipeCount = await prisma.recipe.count({ where: { creatorId: req.user.id } });
    const savedCount = await prisma.savedRecipe.count({ where: { userId: req.user.id } });
    
    res.json({
      ...user,
      allergies: user.allergies ? JSON.parse(user.allergies) : [],
      dietaryPreferences: user.dietaryPreferences ? JSON.parse(user.dietaryPreferences) : [],
      recipeCount,
      savedCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/', async (req, res) => {
  try {
    const { allergies, dietaryPreferences, dislikes } = req.body;
    const updateData = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim().slice(0, 80);
      if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
      updateData.name = name;
    }
    if (allergies !== undefined) updateData.allergies = JSON.stringify(Array.isArray(allergies) ? allergies.slice(0, 50).map(String) : String(allergies).split(',').map(item => item.trim()).filter(Boolean).slice(0, 50));
    if (dietaryPreferences !== undefined) updateData.dietaryPreferences = JSON.stringify(Array.isArray(dietaryPreferences) ? dietaryPreferences.slice(0, 50).map(String) : String(dietaryPreferences).split(',').map(item => item.trim()).filter(Boolean).slice(0, 50));
    if (dislikes !== undefined) updateData.dislikes = String(dislikes).trim().slice(0, 1000);
    if (!Object.keys(updateData).length) return res.status(400).json({ error: 'There is nothing to update' });

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
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
    res.json({
      ...user,
      allergies: user.allergies ? JSON.parse(user.allergies) : [],
      dietaryPreferences: user.dietaryPreferences ? JSON.parse(user.dietaryPreferences) : []
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/avatar', uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const avatarPath = `/uploads/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: avatarPath },
      select: { id: true, name: true, email: true, avatar: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid notification' });
    const result = await prisma.notification.updateMany({ where: { id, userId: req.user.id }, data: { isRead: true } });
    if (!result.count) return res.status(404).json({ error: 'Notification not found' });
    const notif = await prisma.notification.findUnique({ where: { id } });
    res.json(notif);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read notification' });
  }
});

router.patch('/notifications/read-all', async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
    res.json({ updated: result.count });
  } catch { res.status(500).json({ error: 'Failed to update notifications' }); }
});

export default router;
