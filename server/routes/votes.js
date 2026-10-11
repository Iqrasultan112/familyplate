import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.post('/', async (req, res) => {
  try {
    const { requestId, selectedOption } = req.body;
    const id = Number.parseInt(requestId, 10);
    if (!Number.isInteger(id) || !['yes', 'no', 'maybe'].includes(selectedOption)) {
      return res.status(400).json({ error: 'Choose yes, no, or maybe for a valid meal poll.' });
    }
    const request = await prisma.mealRequest.findUnique({ where: { id }, select: { familyId: true } });
    if (!request) return res.status(404).json({ error: 'Meal poll not found' });
    const member = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId: req.user.id, familyId: request.familyId } }
    });
    if (!member) return res.status(403).json({ error: 'Only family members can vote on this poll' });

    // Upsert lets a member change their mind while retaining one vote per poll.
    const vote = await prisma.vote.upsert({
      where: { userId_requestId: { userId: req.user.id, requestId: id } },
      create: { selectedOption, userId: req.user.id, requestId: id },
      update: { selectedOption }
    });
    res.json(vote);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

router.get('/request/:requestId', async (req, res) => {
  try {
    const request = await prisma.mealRequest.findUnique({ where: { id: parseInt(req.params.requestId, 10) }, select: { familyId: true } });
    if (!request) return res.status(404).json({ error: 'Meal poll not found' });
    const member = await prisma.familyMember.findUnique({ where: { userId_familyId: { userId: req.user.id, familyId: request.familyId } } });
    if (!member) return res.status(403).json({ error: 'Only family members can view this poll' });
    const votes = await prisma.vote.findMany({ where: { requestId: parseInt(req.params.requestId, 10) } });
    const counts = votes.reduce((acc, vote) => {
      acc[vote.selectedOption] = (acc[vote.selectedOption] || 0) + 1;
      return acc;
    }, {});
    res.json({ counts, total: votes.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

router.get('/request/:requestId/mine', async (req, res) => {
  try {
    const request = await prisma.mealRequest.findUnique({ where: { id: parseInt(req.params.requestId, 10) }, select: { familyId: true } });
    if (!request) return res.status(404).json({ error: 'Meal poll not found' });
    const member = await prisma.familyMember.findUnique({ where: { userId_familyId: { userId: req.user.id, familyId: request.familyId } } });
    if (!member) return res.status(403).json({ error: 'Only family members can view this poll' });
    const vote = await prisma.vote.findUnique({
      where: { userId_requestId: { userId: req.user.id, requestId: parseInt(req.params.requestId) } }
    });
    res.json(vote || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your vote' });
  }
});

export default router;
