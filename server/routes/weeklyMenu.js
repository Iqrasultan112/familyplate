import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { sameIngredient } from '../lib/foodMatching.js';

const router = express.Router();
const prisma = new PrismaClient();
const dishKey = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const menu = await prisma.weeklyMenu.findMany({ where: { userId: req.user.id, familyId: null }, include: { recipe: true, event: true }, orderBy: { date: 'asc' } });
    res.json(menu);
  } catch { res.status(500).json({ error: 'Failed to fetch weekly menu' }); }
});

router.get('/family/:familyId', async (req, res) => {
  try {
    const familyId = Number.parseInt(req.params.familyId, 10);
    const member = await prisma.familyMember.findUnique({ where: { userId_familyId: { userId: req.user.id, familyId } } });
    if (!member) return res.status(403).json({ error: 'You are not a member of this family' });
    const menu = await prisma.weeklyMenu.findMany({
      where: { familyId },
      include: { recipe: true, event: true }
    });
    res.json(menu);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weekly menu' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { familyId, recipeId, date, eventId, servings } = req.body;
    const mealType = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Side dish'].includes(req.body.mealType) ? req.body.mealType : 'Dinner';
    const parsedFamilyId = Number.parseInt(familyId, 10);
    const parsedRecipeId = Number.parseInt(recipeId, 10);
    const dateKey = typeof date === 'string' ? date.trim() : '';
    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
      && !Number.isNaN(new Date(`${dateKey}T00:00:00.000Z`).getTime())
      && new Date(`${dateKey}T00:00:00.000Z`).toISOString().slice(0, 10) === dateKey;
    if (!Number.isInteger(parsedRecipeId) || !isValidDate) return res.status(400).json({ error: 'Choose a recipe and valid date' });
    if (dateKey < localDateKey(new Date())) return res.status(400).json({ error: 'Meals can only be planned for today or a future date.' });
    const targetDate = new Date(`${dateKey}T00:00:00.000Z`);
    if (Number.isInteger(parsedFamilyId)) {
      const [member, family] = await Promise.all([
        prisma.familyMember.findUnique({ where: { userId_familyId: { userId: req.user.id, familyId: parsedFamilyId } } }),
        prisma.family.findUnique({ where: { id: parsedFamilyId }, select: { creatorId: true } })
      ]);
      if (!member) return res.status(403).json({ error: 'You are not a member of this family' });
      if (member.role !== 'maker' && family?.creatorId !== req.user.id) return res.status(403).json({ error: 'Only your family meal planner can change the shared menu' });
    }
    const parsedEventId = eventId ? Number.parseInt(eventId, 10) : null;
    if (eventId && !Number.isInteger(parsedEventId)) return res.status(400).json({ error: 'Choose a valid event' });
    if (parsedEventId) {
      const event = await prisma.event.findUnique({ where: { id: parsedEventId }, select: { familyId: true, date: true } });
      if (!event || event.familyId !== parsedFamilyId) return res.status(400).json({ error: 'Event must belong to the selected family' });
      const selectedRecipe = await prisma.recipe.findUnique({ where: { id: parsedRecipeId }, select: { name: true } });
      const eventDayStart = new Date(`${dateKey}T00:00:00.000Z`);
      const eventDayEnd = new Date(eventDayStart);
      eventDayEnd.setUTCDate(eventDayEnd.getUTCDate() + 1);
      const sameDayMenus = await prisma.weeklyMenu.findMany({
        where: { familyId: parsedFamilyId, eventId: parsedEventId, date: { gte: eventDayStart, lt: eventDayEnd } },
        include: { recipe: true }
      });
      const sameName = sameDayMenus.find(item => dishKey(item.recipe?.name) === dishKey(selectedRecipe?.name));
      if (sameName) return res.json(sameName);
    }
    
    // The same dish may appear again later in the week; only prevent a duplicate on this day.
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const duplicate = await prisma.weeklyMenu.findFirst({
      where: {
        ...(Number.isInteger(parsedFamilyId) ? { familyId: parsedFamilyId } : { familyId: null, userId: req.user.id }),
        recipeId: parsedRecipeId,
        date: { gte: dayStart, lt: dayEnd }
      }
    });
    if (duplicate) {
      return res.status(409).json({ error: 'This recipe is already planned for this day.' });
    }

    const item = await prisma.weeklyMenu.create({
      data: {
        ...(Number.isInteger(parsedFamilyId) ? { familyId: parsedFamilyId } : { userId: req.user.id }),
        recipeId: parsedRecipeId,
        date: targetDate,
        ...(parsedEventId ? { eventId: parsedEventId } : {}),
        servings: Math.min(100, Math.max(1, Number.parseInt(servings, 10) || 4)),
        mealType,
        userId: req.user.id
      },
      include: { recipe: true, event: true }
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add to menu' });
  }
});

router.patch('/:id/replace', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const recipeId = Number.parseInt(req.body.recipeId, 10);
    if (!Number.isInteger(id) || !Number.isInteger(recipeId)) return res.status(400).json({ error: 'Choose a planned meal and a saved recipe' });
    const item = await prisma.weeklyMenu.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Planned meal not found' });
    if (!await canManage(item, req.user.id)) return res.status(403).json({ error: 'Only this family’s meal planner can change the shared menu' });
    if (['completed', 'cooked', 'cooking'].includes(item.status)) return res.status(409).json({ error: 'A cooking or cooked meal cannot be replaced' });
    if (localDateKey(item.date) < localDateKey(new Date())) return res.status(409).json({ error: 'A past meal cannot be replaced' });
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
    if (!recipe) return res.status(404).json({ error: 'Saved recipe not found' });
    const dayStart = new Date(item.date); dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const duplicate = await prisma.weeklyMenu.findFirst({ where: { id: { not: id }, ...(item.familyId ? { familyId: item.familyId } : { familyId: null, userId: item.userId }), recipeId, date: { gte: dayStart, lt: dayEnd } } });
    if (duplicate) return res.status(409).json({ error: 'That recipe is already planned for this day' });
    const updated = await prisma.weeklyMenu.update({ where: { id }, data: { recipeId, status: 'planned', cookedAt: null }, include: { recipe: true, event: true } });
    res.json(updated);
  } catch { res.status(500).json({ error: 'Could not replace the planned meal' }); }
});

const canManage = async (item, userId) => {
  if (item.familyId) {
    const [family, member] = await Promise.all([
      prisma.family.findUnique({ where: { id: item.familyId }, select: { creatorId: true } }),
      prisma.familyMember.findUnique({ where: { userId_familyId: { userId, familyId: item.familyId } } })
    ]);
    return !!member && (family?.creatorId === userId || member.role === 'maker');
  }
  return item.userId === userId;
};

router.patch('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Choose a valid planned meal' });
    const item = await prisma.weeklyMenu.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Planned meal not found' });
    if (!await canManage(item, req.user.id)) return res.status(403).json({ error: 'Only this family’s meal planner can change the shared menu' });
    if (['completed', 'cooked', 'cooking'].includes(item.status)) return res.status(409).json({ error: 'A cooking or cooked meal cannot be moved' });
    const dateKey = typeof req.body.date === 'string' ? req.body.date.trim() : localDateKey(item.date);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
      && !Number.isNaN(new Date(`${dateKey}T00:00:00.000Z`).getTime())
      && new Date(`${dateKey}T00:00:00.000Z`).toISOString().slice(0, 10) === dateKey;
    if (!validDate) return res.status(400).json({ error: 'Choose a valid meal date' });
    if (dateKey < localDateKey(new Date())) return res.status(400).json({ error: 'Meals can only be planned for today or a future date.' });
    const mealType = req.body.mealType || item.mealType || 'Dinner';
    if (!['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Side dish'].includes(mealType)) return res.status(400).json({ error: 'Choose a valid meal time' });
    const targetDate = new Date(`${dateKey}T00:00:00.000Z`);
    const dayStart = new Date(targetDate); const dayEnd = new Date(targetDate); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const duplicate = await prisma.weeklyMenu.findFirst({ where: { id: { not: id }, ...(item.familyId ? { familyId: item.familyId } : { familyId: null, userId: item.userId }), recipeId: item.recipeId, date: { gte: dayStart, lt: dayEnd } } });
    if (duplicate) return res.status(409).json({ error: 'This recipe is already planned for that day' });
    const updated = await prisma.weeklyMenu.update({ where: { id }, data: { date: targetDate, mealType }, include: { recipe: true, event: true } });
    res.json(updated);
  } catch { res.status(500).json({ error: 'Could not update the planned meal' }); }
});

router.post('/:id/start', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const item = await prisma.weeklyMenu.findUnique({ where: { id }, include: { recipe: true, event: true } });
    if (!item) return res.status(404).json({ error: 'Meal not found' });
    if (!await canManage(item, req.user.id)) return res.status(403).json({ error: 'You cannot update this menu' });
    if (['completed', 'cooked'].includes(item.status)) return res.status(409).json({ error: 'This meal is already marked cooked' });
    if (localDateKey(item.date) !== localDateKey(new Date())) return res.status(409).json({ error: 'Start cooking on the planned meal date' });
    const updated = await prisma.weeklyMenu.update({ where: { id }, data: { status: 'cooking' }, include: { recipe: true, event: true } });
    res.json(updated);
  } catch { res.status(500).json({ error: 'Could not start cooking this meal' }); }
});

router.patch('/:id/servings', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const servings = Number.parseInt(req.body.servings, 10);
    if (!Number.isInteger(servings) || servings < 1 || servings > 100) return res.status(400).json({ error: 'Servings must be between 1 and 100' });
    const item = await prisma.weeklyMenu.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Meal not found' });
    if (!await canManage(item, req.user.id)) return res.status(403).json({ error: 'You cannot change this menu' });
    if (['completed', 'cooked', 'cooking'].includes(item.status)) return res.status(409).json({ error: 'This meal is already cooking or cooked' });
    const updated = await prisma.weeklyMenu.update({ where: { id }, data: { servings }, include: { recipe: true, event: true } });
    res.json(updated);
  } catch { res.status(500).json({ error: 'Could not update servings' }); }
});

const parseAmount = (value, ingredientName = '') => {
  const match = String(value || '').match(/^\s*(\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
  if (!match) return null;
  const qty = match[1].includes('/') ? match[1].split('/').map(Number).reduce((a, b) => a / b) : Number(match[1]);
  let unit = (match[2] || '').toLowerCase();
  const name = String(ingredientName || '').toLowerCase().replace(/[^a-z]+/g, ' ');
  const convert = {
    kg: ['g', 1000], g: ['g', 1], gram: ['g', 1], grams: ['g', 1],
    l: ['ml', 1000], litre: ['ml', 1000], litres: ['ml', 1000], liter: ['ml', 1000], liters: ['ml', 1000], ml: ['ml', 1],
    cup: ['ml', 240], cups: ['ml', 240], tablespoon: ['ml', 15], tablespoons: ['ml', 15], tbsp: ['ml', 15],
    teaspoon: ['ml', 5], teaspoons: ['ml', 5], tsp: ['ml', 5],
    piece: ['piece', 1], pieces: ['piece', 1], pc: ['piece', 1], pcs: ['piece', 1],
    clove: ['piece', 1], cloves: ['piece', 1], stalk: ['piece', 1], stalks: ['piece', 1],
    egg: ['piece', 1], eggs: ['piece', 1],
    bunch: ['bunch', 1], bunches: ['bunch', 1], bulb: ['bulb', 1], bulbs: ['bulb', 1],
    small: ['piece', 0.75], medium: ['piece', 1], large: ['piece', 1.4]
  };
  // Convert common package counts to the recipe's natural count unit.
  if ((unit === 'bunch' || unit === 'bunches') && /spring onion|green onion|scallion/.test(name)) return { amount: qty * 6, unit: 'piece' };
  if ((unit === 'bulb' || unit === 'bulbs') && /garlic/.test(name)) return { amount: qty * 10, unit: 'piece' };
  if (!unit && /\b(egg|eggs|spring onion|green onion|scallion|garlic clove)\b/.test(name)) unit = 'piece';
  const normalized = convert[unit] || (unit ? [unit, 1] : ['', 1]);
  let amount = qty * normalized[1], baseUnit = normalized[0];
  const gramsPerPiece = /\b(tomato|tomatoes)\b/.test(name) ? 123
    : /\b(onion|onions)\b/.test(name) ? 110
    : /\b(potato|potatoes)\b/.test(name) ? 170
    : null;
  if (gramsPerPiece && baseUnit === 'piece') { amount *= gramsPerPiece; baseUnit = 'g'; }
  // Recipe volumes for common dry/chopped ingredients are converted to an
  // approximate weight so they can use pantry stock recorded in grams.
  if (baseUnit === 'ml') {
    const gramsPerCup = /\b(rice|cooked rice)\b/.test(name) ? 158
      : /\b(lentil|lentils|daal|dal|moong|masoor|chana dal)\b/.test(name) ? 190
      : /\b(carrot|carrots)\b/.test(name) ? 128
      : /\b(pea|peas)\b/.test(name) ? 145
      : /\b(chopped onion|onion)\b/.test(name) ? 160
      : /\b(flour|atta|maida)\b/.test(name) ? 120
      : /\b(sugar)\b/.test(name) ? 200
      : null;
    const gramsPerTsp = /\b(cumin|zeera)\b/.test(name) ? 2.1
      : /\b(salt)\b/.test(name) ? 6
      : /\b(turmeric|haldi)\b/.test(name) ? 2.2
      : /\b(garam masala|masala|spice|spices)\b/.test(name) ? 2.5
      : null;
    if (gramsPerTsp && /^(tsp|teaspoon|teaspoons)$/.test(unit)) {
      amount = amount / 5 * gramsPerTsp;
      baseUnit = 'g';
    } else if (gramsPerCup && !/tbsp|tablespoon|tsp|teaspoon|ml|liter|litre/.test(unit)) {
      amount = amount / 240 * gramsPerCup;
      baseUnit = 'g';
    }
  }
  return { amount, unit: baseUnit };
};

router.post('/:id/complete', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const result = await prisma.$transaction(async tx => {
      const item = await tx.weeklyMenu.findUnique({ where: { id }, include: { recipe: true } });
      if (!item) return { error: 'Meal not found', status: 404 };
      if (!await canManage(item, req.user.id)) return { error: 'You cannot update this menu', status: 403 };
      if (item.status === 'cooked') return { error: 'This historical meal is already marked cooked', status: 409 };
      if (localDateKey(item.date) < localDateKey(new Date()) && !['completed', 'cooking'].includes(item.status)) return { error: 'Past planned meals cannot be cooked now', status: 409 };
      const retryingPantryUpdate = item.status === 'completed';
      if (retryingPantryUpdate) {
        // A completed meal with no pantry-use entries can be safely retried after
        // the user fixes pantry names or quantities. Prevent a second deduction
        // when the original cooking action already recorded any pantry changes.
        const cookedAt = item.cookedAt || item.updatedAt;
        if (Date.now() - cookedAt.getTime() > 24 * 60 * 60 * 1000) return { error: 'Pantry correction is available for one day after cooking', status: 409 };
        const retryWindowStart = new Date(cookedAt.getTime() - 60_000);
        const priorUsage = await tx.pantryUse.findFirst({
          where: { userId: req.user.id, recipeName: item.recipe.name, createdAt: { gte: retryWindowStart } }
        });
        if (priorUsage) return { error: 'Pantry deductions for this cooking session were already recorded.', status: 409 };
      }
      let ingredients = item.recipe.ingredients;
      try { if (typeof ingredients === 'string') ingredients = JSON.parse(ingredients); } catch { ingredients = []; }
      const baseServings = Number.parseFloat(item.recipe.servings) || 4;
      const factor = (item.servings || baseServings) / baseServings;
      const family = item.familyId ? await tx.family.findUnique({ where: { id: item.familyId }, select: { creatorId: true } }) : null;
      const pantryOwnerId = family?.creatorId || item.userId || req.user.id;
      let pantry = await tx.inventory.findMany({ where: { userId: pantryOwnerId } });
      const changed = [], skipped = [];
      for (const ing of Array.isArray(ingredients) ? ingredients : []) {
        const name = String(ing.name || ing.ingredient || '').trim();
        const needed = parseAmount(ing.quantity || ing.amount, name);
        if (!name || !needed) { if (name) skipped.push(name); continue; }
        const stock = pantry.find(p => sameIngredient(p.ingredient, name));
        const available = stock && parseAmount(stock.quantity, stock.ingredient);
        if (!stock || !available || available.unit !== needed.unit || available.amount < needed.amount * factor) { skipped.push(name); continue; }
        const remain = available.amount - needed.amount * factor;
        const unit = available.unit;
        const displayRemain = unit === 'tsp' ? remain : remain;
        await tx.inventory.update({ where: { id: stock.id }, data: { quantity: `${Number(displayRemain.toFixed(2))} ${unit}`.trim() } });
        pantry = pantry.map(entry => entry.id === stock.id ? { ...entry, quantity: `${Number(displayRemain.toFixed(2))} ${unit}`.trim() } : entry);
        changed.push({ ingredient: stock.ingredient, used: `${Number((needed.amount * factor).toFixed(2))} ${unit}`.trim(), remaining: `${Number(displayRemain.toFixed(2))} ${unit}`.trim() });
      }
      if (changed.length) await tx.pantryUse.createMany({ data: changed.map(entry => ({
        userId: req.user.id,
        recipeName: item.recipe.name,
        ingredient: entry.ingredient,
        quantityUsed: entry.used,
        quantityRemaining: entry.remaining
      })) });
      const updated = retryingPantryUpdate
        ? item
        : await tx.weeklyMenu.update({ where: { id }, data: { status: 'completed', cookedAt: new Date() } });
      return { item: updated, changed, skipped };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch { res.status(500).json({ error: 'Could not finish cooking and update pantry' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const item = await prisma.weeklyMenu.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Meal not found' });
    if (!await canManage(item, req.user.id)) return res.status(403).json({ error: 'You cannot change this menu' });
    if (['completed', 'cooked', 'cooking'].includes(item.status)) return res.status(409).json({ error: 'A cooking or cooked meal cannot be removed' });
    await prisma.weeklyMenu.delete({ where: { id } });
    res.json({ message: 'Removed from menu' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove from menu' });
  }
});

router.get('/family/:familyId/week/:weekStart', async (req, res) => {
  try {
    const familyId = Number.parseInt(req.params.familyId, 10);
    if (!await prisma.familyMember.findUnique({ where: { userId_familyId: { userId: req.user.id, familyId } } })) return res.status(403).json({ error: 'You are not a member of this family' });
    const start = new Date(req.params.weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const menu = await prisma.weeklyMenu.findMany({
      where: {
        familyId,
        date: { gte: start, lt: end }
      },
      include: { recipe: true, event: true }
    });
    res.json(menu);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weekly menu' });
  }
});

export default router;
