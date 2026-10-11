import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { sameIngredient } from '../lib/foodMatching.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const requestedStart = String(req.query.weekStart || '').trim();
    if (requestedStart && !/^\d{4}-\d{2}-\d{2}$/.test(requestedStart)) {
      return res.status(400).json({ error: 'Choose a valid week start date' });
    }
    let startKey = requestedStart;
    if (!startKey) {
      const today = new Date();
      const weekday = today.getUTCDay();
      today.setUTCDate(today.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
      startKey = today.toISOString().slice(0, 10);
    }
    const start = new Date(`${startKey}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== startKey) {
      return res.status(400).json({ error: 'Choose a valid week start date' });
    }
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const menu = await prisma.weeklyMenu.findMany({
      where: {
        userId: req.user.id,
        familyId: null, // Personal menu
        date: { gte: start, lt: end }
      },
      include: { recipe: true }
    });
    res.json(menu);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch personal menu' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { recipeId, date } = req.body;
    const parsedRecipeId = Number.parseInt(recipeId, 10);
    const dateKey = String(date || '').slice(0, 10);
    if (!Number.isInteger(parsedRecipeId) || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return res.status(400).json({ error: 'Choose a recipe and valid date' });
    const targetDate = new Date(`${dateKey}T00:00:00.000Z`);
    if (Number.isNaN(targetDate.getTime()) || targetDate.toISOString().slice(0, 10) !== dateKey) return res.status(400).json({ error: 'Choose a recipe and valid date' });
    
    const day = targetDate.getUTCDay(); // 0=Sun, 1=Mon...
    const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
    const weekStart = new Date(targetDate);
    weekStart.setUTCDate(targetDate.getUTCDate() + diff);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    const duplicate = await prisma.weeklyMenu.findFirst({
      where: {
        userId: req.user.id,
        familyId: null,
        recipeId: parsedRecipeId,
        date: { gte: weekStart, lt: weekEnd }
      }
    });
    if (duplicate) {
      return res.status(409).json({ error: 'This recipe is already planned for this week.' });
    }

    const item = await prisma.weeklyMenu.create({
      data: {
        userId: req.user.id,
        recipeId: parsedRecipeId,
        date: targetDate
      },
      include: { recipe: true }
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add to personal menu' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid menu entry' });
    const result = await prisma.weeklyMenu.deleteMany({ where: { id, userId: req.user.id, familyId: null } });
    if (!result.count) return res.status(404).json({ error: 'Personal menu entry not found' });
    res.json({ message: 'Removed from personal menu' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove from personal menu' });
  }
});

router.post('/check-ingredients', async (req, res) => {
  try {
    const { recipeId } = req.body;
    const recipe = await prisma.recipe.findUnique({ where: { id: parseInt(recipeId) } });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const inventory = await prisma.inventory.findMany({ where: { userId: req.user.id } });
    const inventoryNames = inventory.map(i => i.ingredient.toLowerCase());

    const INGREDIENT_SUBSTITUTES = {
      "heavy cream": "3/4 cup Whole Milk + 1/4 cup Melted Butter, or Thick Greek Yogurt / Malai",
      "cream": "3/4 cup Milk + 1/4 cup Butter, or Plain Yogurt",
      "buttermilk": "1 cup Milk + 1 tbsp White Vinegar or Lemon Juice",
      "sour cream": "Plain Greek Yogurt or Hung Curd",
      "garam masala": "Blend Cumin + Coriander + pinch of Cinnamon and Cardamom",
      "soy sauce": "Tamari (Gluten-Free) or Worcestershire sauce + pinch of salt",
      "tomato paste": "Simmered fresh mashed tomatoes / tomato puree",
      "eggs": "1/4 cup Applesauce or 1 tbsp Flaxseed + 3 tbsp Water",
      "butter": "Olive Oil, Coconut Oil, or Ghee",
      "parmesan cheese": "Nutritional Yeast or sharp cheddar",
      "mayonnaise": "Plain Greek Yogurt with lemon juice and mustard"
    };

    let ingredients = [];
    try {
      ingredients = typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : recipe.ingredients;
    } catch (e) {
      ingredients = [];
    }

    const present = [];
    const missing = [];

    ingredients.forEach(ing => {
      const name = (ing.name || ing).toString();
      const lower = name.toLowerCase();
      const isPresent = inventoryNames.some(inv => sameIngredient(name, inv));

      if (isPresent) {
        present.push({ name, quantity: ing.quantity || '' });
      } else {
        let substitute = null;
        for (const [key, sub] of Object.entries(INGREDIENT_SUBSTITUTES)) {
          if (lower.includes(key)) {
            substitute = sub;
            break;
          }
        }
        missing.push({
          name,
          quantity: ing.quantity || '1 pack',
          substitute: substitute || 'Can be substituted with a similar pantry staple or omitted.'
        });
      }
    });

    res.json({ present, missing });
  } catch (error) {
    console.error('Check ingredients error:', error);
    res.status(500).json({ error: 'Failed to check ingredients' });
  }
});

export default router;
