import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Shopping lists belong to an individual account, so family planner roles do
// not gate them. Family-specific actions still check family membership in
// their own routes.
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const items = await prisma.shoppingItem.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shopping items' });
  }
});

router.post('/', async (req, res) => {
  try {
    const ingredient = String(req.body.ingredient || '').trim().slice(0, 100);
    const quantity = String(req.body.quantity || '1').trim().slice(0, 60);
    if (!ingredient) return res.status(400).json({ error: 'Ingredient is required' });
    const item = await prisma.shoppingItem.create({
      data: { ingredient, quantity, userId: req.user.id }
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add item' });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length > 100) return res.status(400).json({ error: 'Choose up to 100 shopping items' });
    const data = items.map(i => ({
      ingredient: String(i.ingredient || i.name || i || '').trim().slice(0, 100),
      quantity: String(i.quantity || '1').trim().slice(0, 60),
      userId: req.user.id
    })).filter(item => item.ingredient);
    if (!data.length) return res.status(400).json({ error: 'Add at least one valid shopping item' });
    await prisma.shoppingItem.createMany({ data });
    res.json({ message: 'Items added successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add items' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const { isPurchased, quantity } = req.body;
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid shopping item' });
    const data = {};
    if (isPurchased !== undefined) {
      if (typeof isPurchased !== 'boolean') return res.status(400).json({ error: 'Purchased status must be true or false' });
      data.isPurchased = isPurchased;
    }
    if (quantity !== undefined) data.quantity = String(quantity).trim().slice(0, 60);
    if (!Object.keys(data).length) return res.status(400).json({ error: 'There is nothing to update' });
    const owned = await prisma.shoppingItem.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) return res.status(404).json({ error: 'Shopping item not found' });

    const item = await prisma.shoppingItem.update({
      where: { id },
      data
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.delete('/purchased/clear', async (req, res) => {
  try {
    await prisma.shoppingItem.deleteMany({
      where: { userId: req.user.id, isPurchased: true }
    });
    res.json({ message: 'Cleared purchased items' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear items' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid shopping item' });
    const result = await prisma.shoppingItem.deleteMany({ where: { id, userId: req.user.id } });
    if (!result.count) return res.status(404).json({ error: 'Shopping item not found' });
    res.json({ message: 'Item removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

export default router;
