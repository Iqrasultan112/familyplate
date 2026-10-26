import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();
router.use(authenticate);

const familyMembership = (familyId, userId) => prisma.familyMember.findUnique({ where: { userId_familyId: { userId, familyId } } });
const canManageFamily = async (familyId, userId) => {
  const [family, member] = await Promise.all([
    prisma.family.findUnique({ where: { id: familyId }, select: { creatorId: true } }),
    familyMembership(familyId, userId)
  ]);
  return !!member && (family?.creatorId === userId || member.role === 'maker');
};

router.post('/', async (req, res) => {
  try {
    const familyId = Number.parseInt(req.body.familyId, 10);
    const mealName = String(req.body.mealName || '').trim().slice(0, 120);
    const requestedDate = req.body.requestedDate ? new Date(req.body.requestedDate) : new Date();
    if (!mealName || !Number.isInteger(familyId) || Number.isNaN(requestedDate.getTime())) return res.status(400).json({ error: 'Enter a meal, family, and valid date' });
    if (!await familyMembership(familyId, req.user.id)) return res.status(403).json({ error: 'Only family members can request meals' });
    const recipeId = req.body.recipeId ? Number.parseInt(req.body.recipeId, 10) : null;
    if (req.body.recipeId && !Number.isInteger(recipeId)) return res.status(400).json({ error: 'Choose a valid recipe' });
    if (recipeId && !await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } })) return res.status(404).json({ error: 'Recipe not found' });
    const request = await prisma.mealRequest.create({
      data: { mealName, recipeId, requestedDate, message: String(req.body.message || '').trim().slice(0, 1000), familyId, userId: req.user.id },
      include: { user: { select: { id: true, name: true, avatar: true, role: true } }, votes: true }
    });
    const familyMembers = await prisma.familyMember.findMany({ where: { familyId, userId: { not: req.user.id } }, select: { userId: true } });
    if (familyMembers.length) await prisma.notification.createMany({ data: familyMembers.map(member => ({ userId: member.userId, message: `${req.user.name || 'A family member'} requested ${mealName}` })) });
    res.status(201).json(request);
  } catch { res.status(500).json({ error: 'Failed to create meal request' }); }
});

router.get('/family/:familyId', async (req, res) => {
  try {
    const familyId = Number.parseInt(req.params.familyId, 10);
    if (!Number.isInteger(familyId)) return res.status(400).json({ error: 'Invalid family' });
    if (!await familyMembership(familyId, req.user.id)) return res.status(403).json({ error: 'Only family members can view meal requests' });
    const requests = await prisma.mealRequest.findMany({
      where: { familyId },
      include: { user: { select: { id: true, name: true, avatar: true, role: true } }, votes: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch { res.status(500).json({ error: 'Failed to fetch requests' }); }
});

const approveRequest = async (requestId, userId, schedule = {}) => {
  const existing = await prisma.mealRequest.findUnique({ where: { id: requestId }, include: { family: true } });
  if (!existing) return { error: 'Meal request not found', status: 404 };
  if (!await canManageFamily(existing.familyId, userId)) return { error: 'Only this family’s meal maker can approve requests', status: 403 };

  let recipeId = existing.recipeId;
  if (!recipeId) {
    let recipe = await prisma.recipe.findFirst({ where: { name: { equals: existing.mealName } } });
    if (!recipe) recipe = await prisma.recipe.create({ data: {
      name: existing.mealName,
      ingredients: JSON.stringify([{ name: existing.mealName, quantity: 'As desired' }, { name: 'Cooking Oil / Ghee', quantity: '2 tbsp' }, { name: 'Salt / Seasoning', quantity: 'To taste' }]),
      instructions: JSON.stringify(['Cook according to the family’s recipe and taste.', 'Serve when ready.']),
      prepTime: '15 mins', cookTime: '30 mins', servings: String(existing.family.expectedMembers || 4), creatorId: userId
    } });
    recipeId = recipe.id;
  }

  const dateKey = typeof schedule.date === 'string' ? schedule.date : '';
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && !Number.isNaN(new Date(`${dateKey}T00:00:00.000Z`).getTime()) && new Date(`${dateKey}T00:00:00.000Z`).toISOString().slice(0, 10) === dateKey;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (schedule.date && (!validDate || dateKey < todayKey)) return { error: 'Choose today or a future date for the meal plan', status: 400 };
  const date = schedule.date ? new Date(`${dateKey}T00:00:00.000Z`) : new Date(existing.requestedDate);
  if (!schedule.date) date.setHours(0, 0, 0, 0);
  const mealType = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Side dish'].includes(schedule.mealType) ? schedule.mealType : 'Dinner';
  const [request, menuItem] = await prisma.$transaction([
    prisma.mealRequest.update({ where: { id: requestId }, data: { status: 'approved', isApproved: true, approvedBy: userId } }),
    prisma.weeklyMenu.upsert({
      where: { familyId_recipeId_date: { familyId: existing.familyId, recipeId, date } },
      create: { familyId: existing.familyId, recipeId, date, mealType, servings: existing.family.expectedMembers || 4 },
      update: { servings: existing.family.expectedMembers || 4, mealType },
      include: { recipe: true, event: true }
    })
  ]);
  if (existing.userId !== userId) await prisma.notification.create({ data: { userId: existing.userId, message: `${existing.mealName} was approved and added to the family menu` } });
  return { request, menuItem };
};

router.patch('/:id/approve', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid request' });
    const result = await approveRequest(id, req.user.id, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ message: 'Meal approved and added to the family menu', request: result.request, menuItem: result.menuItem });
  } catch { res.status(500).json({ error: 'Failed to approve meal request' }); }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || !['approved', 'rejected'].includes(req.body.status)) return res.status(400).json({ error: 'Choose approve or decline for a valid request' });
    if (req.body.status === 'approved') {
      const result = await approveRequest(id, req.user.id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json({ ...result.request, menuItem: result.menuItem });
    }
    const existing = await prisma.mealRequest.findUnique({ where: { id }, select: { familyId: true } });
    if (!existing) return res.status(404).json({ error: 'Meal request not found' });
    if (!await canManageFamily(existing.familyId, req.user.id)) return res.status(403).json({ error: 'Only this family’s meal maker can update requests' });
    const request = await prisma.mealRequest.update({ where: { id }, data: { status: 'rejected', isApproved: false } });
    res.json(request);
  } catch { res.status(500).json({ error: 'Failed to update request' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid request' });
    const existing = await prisma.mealRequest.findUnique({ where: { id }, select: { familyId: true, userId: true } });
    if (!existing) return res.status(404).json({ error: 'Meal request not found' });
    const isMaker = await canManageFamily(existing.familyId, req.user.id);
    if (existing.userId !== req.user.id && !isMaker) return res.status(403).json({ error: 'You can only remove your own request' });
    await prisma.mealRequest.delete({ where: { id } });
    res.json({ message: 'Request removed' });
  } catch { res.status(500).json({ error: 'Failed to remove request' }); }
});

export default router;
