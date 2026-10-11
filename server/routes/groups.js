import crypto from 'crypto';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();
router.use(authenticate);

const isMember = (groupId, userId) => prisma.communityGroupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
const makeInviteCode = () => crypto.randomBytes(12).toString('hex').toUpperCase();

router.get('/', async (req, res) => {
  try {
    const memberships = await prisma.communityGroupMember.findMany({
      where: { userId: req.user.id },
      include: { group: { include: { _count: { select: { members: true, messages: true } } } } },
      orderBy: { joinedAt: 'desc' }
    });
    res.json(memberships.map(({ group, role }) => ({ ...group, myRole: role })));
  } catch { res.status(500).json({ error: 'Could not load your groups' }); }
});

router.post('/', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 60);
    const kind = ['friends', 'relatives', 'other'].includes(req.body.kind) ? req.body.kind : 'friends';
    if (!name) return res.status(400).json({ error: 'Give your group a name' });
    const group = await prisma.communityGroup.create({
      data: { name, kind, inviteCode: makeInviteCode(), creatorId: req.user.id, members: { create: { userId: req.user.id, role: 'maker' } } },
      include: { _count: { select: { members: true, messages: true } } }
    });
    res.status(201).json({ ...group, myRole: 'maker' });
  } catch { res.status(500).json({ error: 'Could not create group' }); }
});

router.post('/join', async (req, res) => {
  try {
    const inviteCode = String(req.body.inviteCode || '').trim().toUpperCase();
    if (!/^(?:[A-F0-9]{10}|[A-F0-9]{24})$/.test(inviteCode)) return res.status(400).json({ error: 'Enter a valid invite code from your group' });
    const group = await prisma.communityGroup.findUnique({ where: { inviteCode } });
    if (!group) return res.status(404).json({ error: 'That invite code was not found' });
    await prisma.communityGroupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: req.user.id } },
      create: { groupId: group.id, userId: req.user.id }, update: {}
    });
    res.json({ message: `You joined ${group.name}`, groupId: group.id });
  } catch { res.status(500).json({ error: 'Could not join group' }); }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const groupId = Number.parseInt(req.params.id, 10);
    if (!await isMember(groupId, req.user.id)) return res.status(403).json({ error: 'Join this group to see its chat' });
    const messages = await prisma.communityGroupMessage.findMany({
      where: { groupId }, include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' }, take: 200
    });
    res.json(messages);
  } catch { res.status(500).json({ error: 'Could not load group chat' }); }
});

router.post('/:id/messages', async (req, res) => {
  try {
    const groupId = Number.parseInt(req.params.id, 10);
    const content = String(req.body.content || '').trim().slice(0, 4000);
    const kind = req.body.kind === 'recipe' || req.body.kind === 'voice' ? req.body.kind : 'text';
    if (!content) return res.status(400).json({ error: 'Write a message first' });
    if (!await isMember(groupId, req.user.id)) return res.status(403).json({ error: 'Join this group to send messages' });
    const message = await prisma.communityGroupMessage.create({
      data: { groupId, userId: req.user.id, content, kind },
      include: { user: { select: { id: true, name: true, avatar: true } } }
    });
    res.status(201).json(message);
  } catch { res.status(500).json({ error: 'Could not send message' }); }
});

export default router;
