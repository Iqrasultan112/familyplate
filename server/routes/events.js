import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();
router.use(authenticate);

const familyMember = (familyId, userId) => prisma.familyMember.findUnique({ where: { userId_familyId: { userId, familyId } } });
const dishKey = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const uniqueDishes = (items, getName) => {
  const seen = new Set();
  return items.filter(item => {
    const key = dishKey(getName(item));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const presentEvent = event => ({
  ...event,
  suggestions: uniqueDishes(event.suggestions.map(({ ballots = [], ...item }) => ({ ...item, myVote: ballots.length > 0 })), item => item.recipeName || item.recipe?.name),
  weeklyMenus: uniqueDishes(event.weeklyMenus || [], item => item.recipe?.name || `recipe-${item.recipeId}`)
});
const canManageFamily = async (familyId, userId) => {
  const [family, member] = await Promise.all([
    prisma.family.findUnique({ where: { id: familyId }, select: { creatorId: true } }),
    familyMember(familyId, userId)
  ]);
  return !!member && (family?.creatorId === userId || member.role === 'maker');
};
const eventForMember = async (id, userId) => {
  const event = await prisma.event.findUnique({ where: { id }, include: { suggestions: { include: { recipe: true, ballots: { where: { userId } } }, orderBy: { voteCount: 'desc' } }, weeklyMenus: { include: { recipe: true }, orderBy: { mealType: 'asc' } } } });
  if (!event || !await familyMember(event.familyId, userId)) return null;
  return presentEvent(event);
};

router.post('/', async (req, res) => {
  try {
    const familyId = Number.parseInt(req.body.familyId, 10);
    const name = String(req.body.name || '').trim().slice(0, 100);
    const date = new Date(req.body.date);
    const guestCount = Math.min(500, Math.max(1, Number.parseInt(req.body.guestCount, 10) || 4));
    const eventType = ['eid', 'birthday', 'dawat', 'gathering', 'other'].includes(req.body.eventType) ? req.body.eventType : 'gathering';
    if (!name || !Number.isInteger(familyId) || Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Add an event name and valid date' });
    if (!await canManageFamily(familyId, req.user.id)) return res.status(403).json({ error: 'Only your family meal planner can create events' });
    const event = await prisma.event.create({ data: { familyId, name, date, description: String(req.body.description || '').slice(0, 1000), eventType, guestCount } });
    res.status(201).json({ ...event, suggestions: [] });
  } catch { res.status(500).json({ error: 'Failed to create event' }); }
});

router.get('/family/:familyId', async (req, res) => {
  try {
    const familyId = Number.parseInt(req.params.familyId, 10);
    if (!await familyMember(familyId, req.user.id)) return res.status(403).json({ error: 'Only family members can see these events' });
    const events = await prisma.event.findMany({ where: { familyId }, include: { suggestions: { include: { recipe: true, ballots: { where: { userId: req.user.id } } }, orderBy: { voteCount: 'desc' } }, weeklyMenus: { include: { recipe: true }, orderBy: { mealType: 'asc' } } }, orderBy: { date: 'asc' } });
    res.json(events.map(presentEvent));
  } catch { res.status(500).json({ error: 'Failed to fetch events' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const event = await eventForMember(Number.parseInt(req.params.id, 10), req.user.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch { res.status(500).json({ error: 'Failed to fetch event' }); }
});

router.post('/:id/suggest', async (req, res) => {
  try {
    const eventId = Number.parseInt(req.params.id, 10);
    const event = await eventForMember(eventId, req.user.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const recipeId = Number.parseInt(req.body.recipeId, 10);
    const recipeName = String(req.body.recipeName || '').trim().slice(0, 120);
    if (!recipeName) return res.status(400).json({ error: 'Add a recipe name' });
    const recipe = Number.isInteger(recipeId) ? await prisma.recipe.findUnique({ where: { id: recipeId } }) : null;
    const key = dishKey(recipeName);
    const existing = event.suggestions.find(item => dishKey(item.recipeName || item.recipe?.name) === key);
    if (existing) return res.json({ ...existing, recipe: existing.recipe || recipe, duplicate: true });
    const suggestion = await prisma.eventSuggestion.create({ data: { eventId, recipeName, recipeId: recipe?.id || null } });
    res.status(201).json({ ...suggestion, recipe });
  } catch { res.status(500).json({ error: 'Failed to suggest dish' }); }
});

router.post('/suggestions/:suggestionId/vote', async (req, res) => {
  try {
    const suggestionId = Number.parseInt(req.params.suggestionId, 10);
    const suggestion = await prisma.eventSuggestion.findUnique({ where: { id: suggestionId }, include: { event: true } });
    if (!suggestion || !await familyMember(suggestion.event.familyId, req.user.id)) return res.status(404).json({ error: 'Suggestion not found' });
    const updated = await prisma.$transaction(async tx => {
      await tx.eventSuggestionVote.create({ data: { suggestionId, userId: req.user.id } });
      return tx.eventSuggestion.update({ where: { id: suggestionId }, data: { voteCount: { increment: 1 } } });
    });
    res.json(updated);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'You have already voted for this recipe' });
    res.status(500).json({ error: 'Failed to vote' });
  }
});

router.post('/suggestions/:suggestionId/approve', async (req, res) => {
  try {
    const suggestionId = Number.parseInt(req.params.suggestionId, 10);
    if (!Number.isInteger(suggestionId)) return res.status(400).json({ error: 'Invalid suggestion' });
    const suggestion = await prisma.eventSuggestion.findUnique({ where: { id: suggestionId }, include: { event: true } });
    if (!suggestion || !await canManageFamily(suggestion.event.familyId, req.user.id)) {
      return res.status(404).json({ error: 'Suggestion not found or you cannot approve it' });
    }

    let recipeId = suggestion.recipeId;
    if (!recipeId) {
      const family = await prisma.family.findUnique({ where: { id: suggestion.event.familyId }, select: { expectedMembers: true } });
      const recipe = await prisma.recipe.create({ data: {
        name: suggestion.recipeName,
        ingredients: JSON.stringify([]),
        instructions: JSON.stringify(['Add ingredients and preparation steps to complete this family recipe.']),
        servings: String(family?.expectedMembers || suggestion.event.guestCount || 4),
        creatorId: req.user.id
      } });
      recipeId = recipe.id;
    }

    const result = await prisma.$transaction(async tx => {
      const approvedSuggestion = await tx.eventSuggestion.update({ where: { id: suggestionId }, data: { recipeId, isFinal: true } });
      const menuItem = await tx.weeklyMenu.upsert({
        where: { familyId_recipeId_date: { familyId: suggestion.event.familyId, recipeId, date: suggestion.event.date } },
        create: { familyId: suggestion.event.familyId, recipeId, date: suggestion.event.date, eventId: suggestion.event.id, servings: suggestion.event.guestCount },
        update: { eventId: suggestion.event.id, servings: suggestion.event.guestCount }
      });
      return { approvedSuggestion, menuItem };
    });
    res.json({ message: `${suggestion.recipeName} approved and added to the meal plan`, ...result });
  } catch { res.status(500).json({ error: 'Could not approve this meal' }); }
});

router.patch('/:id/finalize', async (req, res) => {
  try {
    const eventId = Number.parseInt(req.params.id, 10);
    const event = await eventForMember(eventId, req.user.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!await canManageFamily(event.familyId, req.user.id)) return res.status(403).json({ error: 'Only your family meal planner can finalize an event menu' });
    let ids = Array.isArray(req.body.suggestionIds) ? req.body.suggestionIds.map(Number).filter(Number.isInteger) : [];
    if (!Array.isArray(req.body.suggestionIds)) {
      const topScore = Math.max(0, ...event.suggestions.map(suggestion => suggestion.voteCount));
      if (!topScore) return res.status(400).json({ error: 'Ask your family to vote before finalizing the event menu' });
      ids = event.suggestions.filter(suggestion => suggestion.voteCount === topScore).map(suggestion => suggestion.id);
    }
    await prisma.eventSuggestion.updateMany({ where: { eventId, id: { in: ids } }, data: { isFinal: false } });
    await prisma.eventSuggestion.updateMany({ where: { eventId, id: { in: ids } }, data: { isFinal: true } });
    const finalRecipes = await prisma.eventSuggestion.findMany({ where: { eventId, isFinal: true, recipeId: { not: null } } });
    const menuItems = [];
    for (const suggestion of finalRecipes) {
      const menuItem = await prisma.weeklyMenu.upsert({
        where: { familyId_recipeId_date: { familyId: event.familyId, recipeId: suggestion.recipeId, date: event.date } },
        create: { familyId: event.familyId, recipeId: suggestion.recipeId, date: event.date, eventId, servings: event.guestCount },
        update: { eventId, servings: event.guestCount },
        include: { recipe: true, event: true }
      });
      menuItems.push(menuItem);
    }
    res.json({ message: 'Event menu finalized and added to the meal calendar', addedToCalendar: finalRecipes.length, menuItems });
  } catch { res.status(500).json({ error: 'Failed to finalize event menu' }); }
});

export default router;
