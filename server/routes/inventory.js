import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireMaker } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate, requireMaker);

router.get('/', async (req, res) => {
  try {
    const inventory = await prisma.inventory.findMany({
      where: { userId: req.user.id },
      orderBy: { ingredient: 'asc' }
    });
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const history = await prisma.pantryUse.findMany({ where: { userId: req.user.id, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 250 });
    res.json(history);
  } catch { res.status(500).json({ error: 'Failed to fetch pantry history' }); }
});

router.post('/', async (req, res) => {
  try {
    const ingredient = String(req.body.ingredient || '').trim().slice(0, 100);
    const quantity = String(req.body.quantity || '').trim().slice(0, 60);
    if (!ingredient || !quantity) return res.status(400).json({ error: 'Ingredient and quantity are required' });
    const item = await prisma.inventory.create({
      data: { ingredient, quantity, userId: req.user.id }
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add inventory item' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const ingredient = String(req.body.ingredient || '').trim().slice(0, 100);
    const quantity = String(req.body.quantity || '').trim().slice(0, 60);
    if (!Number.isInteger(id) || !ingredient || !quantity) return res.status(400).json({ error: 'Enter a valid ingredient and quantity' });
    const owned = await prisma.inventory.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) return res.status(404).json({ error: 'Pantry item not found' });
    const item = await prisma.inventory.update({
      where: { id },
      data: { ingredient, quantity }
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update pantry item' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid pantry item' });
    const result = await prisma.inventory.deleteMany({ where: { id, userId: req.user.id } });
    if (!result.count) return res.status(404).json({ error: 'Pantry item not found' });
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

export default router;
