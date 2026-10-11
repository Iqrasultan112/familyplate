import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();
const recipeImageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 1 } });

router.use(authenticate);

router.post('/images', (req, res, next) => {
  recipeImageUpload.single('image')(req, res, error => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Choose an image smaller than 6 MB' : 'Choose one JPG, PNG, or WebP image' });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a recipe photo first' });
  const signatures = {
    'image/jpeg': req.file.buffer[0] === 0xff && req.file.buffer[1] === 0xd8 && req.file.buffer[2] === 0xff,
    'image/png': req.file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/webp': req.file.buffer.toString('ascii', 0, 4) === 'RIFF' && req.file.buffer.toString('ascii', 8, 12) === 'WEBP'
  };
  if (!signatures[req.file.mimetype]) return res.status(400).json({ error: 'That file is not a supported image. Choose JPG, PNG, or WebP.' });
  const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[req.file.mimetype];
  const filename = `${randomUUID()}${extension}`;
  try {
    await fs.mkdir(path.resolve('uploads'), { recursive: true });
    await fs.writeFile(path.resolve('uploads', filename), req.file.buffer, { flag: 'wx' });
    res.status(201).json({ image: `/uploads/${filename}` });
  } catch { res.status(500).json({ error: 'Could not save this photo' }); }
});

const recipeFields = (body, partial = false) => {
  const fields = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || '').trim().slice(0, 120);
    if (!name) throw new Error('Recipe name is required');
    fields.name = name;
  }
  for (const key of ['ingredients', 'instructions']) {
    if (partial && body[key] === undefined) continue;
    let value = body[key];
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { throw new Error(`${key} must be valid recipe data`); }
    }
    if (!Array.isArray(value) || (!value.length && key === 'instructions') || value.length > 100) throw new Error(`Add up to 100 ${key}${key === 'instructions' ? ' and at least one cooking step' : ''}`);
    fields[key] = JSON.stringify(value);
  }
  for (const key of ['prepTime', 'cookTime', 'servings']) {
    if (!partial || body[key] !== undefined) fields[key] = body[key] == null ? null : String(body[key]).trim().slice(0, 40);
  }
  if (!partial || body.image !== undefined) {
    const image = body.image == null ? null : String(body.image).trim();
    if (image && !(image.startsWith('/uploads/') || /^https:\/\//i.test(image))) throw new Error('Recipe image must use a secure image URL');
    fields.image = image;
  }
  if (!partial || body.sourceUrl !== undefined) {
    const source = body.sourceUrl == null ? null : String(body.sourceUrl).trim();
    fields.sourceUrl = source && /^https:\/\//i.test(source) ? source : null;
  }
  if (!partial || body.nutrition !== undefined) {
    const nutrition = body.nutrition;
    fields.nutrition = nutrition == null ? null : typeof nutrition === 'string' ? nutrition.slice(0, 2000) : JSON.stringify(nutrition);
  }
  return fields;
};

router.post('/', async (req, res) => {
  try {
    let fields;
    try { fields = recipeFields(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
    const recipe = await prisma.recipe.create({
      data: {
        ...fields,
        creatorId: req.user.id
      }
    });
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 80);
    const where = search ? { OR: [{ name: { contains: search } }, { ingredients: { contains: search } }] } : {};
    const pageNum = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;
    const recipes = await prisma.recipe.findMany({
      where, skip, take: limitNum,
      include: { creator: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' }
    });
    const total = await prisma.recipe.count({ where });
    res.json({ recipes, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

router.get('/my/recipes', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 80);
    const where = { creatorId: req.user.id, ...(search ? { OR: [{ name: { contains: search } }, { ingredients: { contains: search } }] } : {}) };
    const recipes = await prisma.recipe.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch my recipes' });
  }
});

router.get('/saved/list', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 80);
    const where = { userId: req.user.id, ...(search ? { recipe: { OR: [{ name: { contains: search } }, { ingredients: { contains: search } }] } } : {}) };
    const saved = await prisma.savedRecipe.findMany({
      where,
      include: { recipe: true }
    });
    res.json(saved.map(s => s.recipe));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch saved recipes' });
  }
});

router.get('/collections', async (req, res) => {
  try {
    const collections = await prisma.recipeCollection.findMany({
      where: { userId: req.user.id },
      include: { items: { include: { recipe: true }, orderBy: { addedAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(collections.map(({ items, ...collection }) => ({ ...collection, recipes: items.map(item => item.recipe) })));
  } catch (error) {
    res.status(500).json({ error: 'Could not load your recipe collections' });
  }
});

router.post('/collections', async (req, res) => {
  const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (name.length < 2) return res.status(400).json({ error: 'Collection name must have at least 2 characters' });
  try {
    const existing = await prisma.recipeCollection.findMany({ where: { userId: req.user.id }, select: { name: true } });
    if (existing.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return res.status(409).json({ error: 'You already have a collection with that name' });
    }
    const collection = await prisma.recipeCollection.create({ data: { name, userId: req.user.id } });
    res.status(201).json({ ...collection, recipes: [] });
  } catch (error) {
    res.status(500).json({ error: 'Could not create this collection' });
  }
});

router.patch('/collections/:collectionId', async (req, res) => {
  const collectionId = Number.parseInt(req.params.collectionId, 10);
  const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!Number.isInteger(collectionId)) return res.status(400).json({ error: 'Invalid collection' });
  if (name.length < 2) return res.status(400).json({ error: 'Collection name must have at least 2 characters' });
  try {
    const collection = await prisma.recipeCollection.findFirst({ where: { id: collectionId, userId: req.user.id } });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    const existing = await prisma.recipeCollection.findMany({ where: { userId: req.user.id, NOT: { id: collectionId } }, select: { name: true } });
    if (existing.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return res.status(409).json({ error: 'You already have a collection with that name' });
    }
    res.json(await prisma.recipeCollection.update({ where: { id: collectionId }, data: { name } }));
  } catch (error) {
    res.status(500).json({ error: 'Could not rename this collection' });
  }
});

router.delete('/collections/:collectionId', async (req, res) => {
  const collectionId = Number.parseInt(req.params.collectionId, 10);
  if (!Number.isInteger(collectionId)) return res.status(400).json({ error: 'Invalid collection' });
  try {
    const collection = await prisma.recipeCollection.findFirst({ where: { id: collectionId, userId: req.user.id }, select: { id: true } });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    await prisma.recipeCollection.delete({ where: { id: collectionId } });
    res.json({ message: 'Collection deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete this collection' });
  }
});

router.post('/collections/:collectionId/recipes', async (req, res) => {
  const collectionId = Number.parseInt(req.params.collectionId, 10);
  const recipeId = Number.parseInt(req.body?.recipeId, 10);
  if (!Number.isInteger(collectionId) || !Number.isInteger(recipeId)) return res.status(400).json({ error: 'Choose a collection and recipe' });
  try {
    const collection = await prisma.recipeCollection.findFirst({ where: { id: collectionId, userId: req.user.id }, select: { id: true } });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    await prisma.recipeCollectionItem.upsert({
      where: { collectionId_recipeId: { collectionId, recipeId } },
      create: { collectionId, recipeId },
      update: {}
    });
    await prisma.recipeCollection.update({ where: { id: collectionId }, data: { updatedAt: new Date() } });
    res.json({ message: 'Recipe added to collection' });
  } catch (error) {
    res.status(500).json({ error: 'Could not add this recipe to the collection' });
  }
});

router.delete('/collections/:collectionId/recipes/:recipeId', async (req, res) => {
  const collectionId = Number.parseInt(req.params.collectionId, 10);
  const recipeId = Number.parseInt(req.params.recipeId, 10);
  if (!Number.isInteger(collectionId) || !Number.isInteger(recipeId)) return res.status(400).json({ error: 'Invalid collection or recipe' });
  try {
    const collection = await prisma.recipeCollection.findFirst({ where: { id: collectionId, userId: req.user.id }, select: { id: true } });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    await prisma.recipeCollectionItem.deleteMany({ where: { collectionId, recipeId } });
    await prisma.recipeCollection.update({ where: { id: collectionId }, data: { updatedAt: new Date() } });
    res.json({ message: 'Recipe removed from collection' });
  } catch (error) {
    res.status(500).json({ error: 'Could not remove this recipe' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid recipe' });
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: { creator: { select: { id: true, name: true, avatar: true } } }
    });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const recipeId = Number.parseInt(req.params.id, 10);
    const existing = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!existing) return res.status(404).json({ error: 'Recipe not found' });
    if (existing.creatorId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    let fields;
    try { fields = recipeFields(req.body, true); } catch (error) { return res.status(400).json({ error: error.message }); }
    const updated = await prisma.recipe.update({
      where: { id: recipeId },
      data: fields
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const recipeId = Number.parseInt(req.params.id, 10);
    const existing = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!existing) return res.status(404).json({ error: 'Recipe not found' });
    if (existing.creatorId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const [menuCount, postCount, suggestionCount, savedCount] = await Promise.all([
      prisma.weeklyMenu.count({ where: { recipeId } }),
      prisma.communityPost.count({ where: { recipeId } }),
      prisma.eventSuggestion.count({ where: { recipeId } }),
      prisma.savedRecipe.count({ where: { recipeId } })
    ]);
    if (menuCount || postCount || suggestionCount || savedCount) return res.status(409).json({ error: 'This recipe is already saved or used in a menu or community post. Keep it so those links remain available.' });

    await prisma.recipe.delete({ where: { id: recipeId } });
    res.json({ message: 'Recipe deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

router.post('/:id/save', async (req, res) => {
  try {
    const recipeId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(recipeId) || !await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } })) return res.status(404).json({ error: 'Recipe not found' });
    const existing = await prisma.savedRecipe.findUnique({
      where: { userId_recipeId: { userId: req.user.id, recipeId } }
    });

    if (existing) {
      await prisma.savedRecipe.delete({ where: { id: existing.id } });
      res.json({ message: 'Unsaved', saved: false });
    } else {
      await prisma.savedRecipe.create({ data: { userId: req.user.id, recipeId } });
      res.json({ message: 'Saved', saved: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle save' });
  }
});

export default router;
