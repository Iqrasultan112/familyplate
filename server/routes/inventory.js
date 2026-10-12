import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { sameIngredient } from '../lib/foodMatching.js';

const router = express.Router();
const prisma = new PrismaClient();

// Pantry data is private to each account and can be managed without a family.
router.use(authenticate);

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

router.post('/bulk', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length > 100) return res.status(400).json({ error: 'Choose up to 100 pantry items' });
    const existing = await prisma.inventory.findMany({ where: { userId: req.user.id }, select: { ingredient: true } });
    const seen = [...existing.map(item => item.ingredient)];
    const data = [];
    for (const item of items) {
      const ingredient = String(item.ingredient || item.name || '').trim().slice(0, 100);
      const quantity = String(item.quantity || '1 unit').trim().slice(0, 60);
      if (!ingredient || seen.some(name => sameIngredient(name, ingredient))) continue;
      seen.push(ingredient);
      data.push({ ingredient, quantity, userId: req.user.id });
    }
    if (data.length) await prisma.inventory.createMany({ data });
    res.json({ message: 'Pantry updated', added: data.length, skipped: items.length - data.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add pantry items' });
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
