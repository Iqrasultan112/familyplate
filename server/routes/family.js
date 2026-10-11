import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireMaker } from '../middleware/auth.js';
import { randomBytes } from 'crypto';

const router = express.Router();
const prisma = new PrismaClient();

const generateCode = () => randomBytes(8).toString('hex').toUpperCase();

router.use(authenticate);

router.post('/create', requireMaker, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    const expectedMembers = Math.min(50, Math.max(1, Number.parseInt(req.body.expectedMembers, 10) || 4));
    if (!name) return res.status(400).json({ error: 'Enter a family name' });
    let code;
    let isUnique = false;
    while (!isUnique) {
      code = generateCode();
      const existing = await prisma.family.findUnique({ where: { code } });
      if (!existing) isUnique = true;
    }

    const family = await prisma.family.create({
      data: {
        name,
        code,
        expectedMembers: parseInt(expectedMembers) || 4,
        creatorId: req.user.id,
        members: {
          create: [{ userId: req.user.id, role: 'maker' }]
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, role: true, allergies: true, dietaryPreferences: true }
            }
          }
        }
      }
    });

    // Ensure creator user role is maker
    await prisma.user.update({
      where: { id: req.user.id },
      data: { role: 'maker' }
    });

    res.json({ family, code: family.code });
  } catch (error) {
    console.error('Create family error:', error);
    res.status(500).json({ error: 'Failed to create family' });
  }
});

router.post('/join', async (req, res) => {
  try {
    const { code, allergies, dietaryPreferences, dislikes } = req.body;
    if (!code || String(code).trim().length < 6 || String(code).trim().length > 32) return res.status(400).json({ error: 'Enter a valid family invite code' });

    const family = await prisma.family.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!family) {
      return res.status(404).json({ error: 'Family not found with this code' });
    }

    const existingMember = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId: req.user.id, familyId: family.id } }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'You are already a member of this family' });
    }

    const member = await prisma.familyMember.create({
      data: { userId: req.user.id, familyId: family.id, role: 'member' }
    });

    // Update user preferences if provided
    const userUpdate = {};
    if (allergies !== undefined) userUpdate.allergies = typeof allergies === 'object' ? JSON.stringify(allergies) : allergies;
    if (dietaryPreferences !== undefined) userUpdate.dietaryPreferences = typeof dietaryPreferences === 'object' ? JSON.stringify(dietaryPreferences) : dietaryPreferences;
    if (dislikes !== undefined) userUpdate.dislikes = dislikes;

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: userUpdate
      });
    }

    res.json({ message: 'Joined family successfully', member, family });
  } catch (error) {
    console.error('Join family error:', error);
    res.status(500).json({ error: 'Failed to join family' });
  }
});

// GET /api/family/details/:code (lookup family by code)
router.get('/details/:code', async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const family = await prisma.family.findUnique({
      where: { code },
      include: {
        creator: { select: { name: true, avatar: true } },
        members: { select: { id: true } }
      }
    });
    if (!family) return res.status(404).json({ error: 'Family not found' });
    res.json({
      name: family.name,
      code: family.code,
      creatorName: family.creator.name,
      currentMembers: family.members.length,
      expectedMembers: family.expectedMembers
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to lookup family' });
  }
});

router.get('/mine', async (req, res) => {
  try {
    const memberships = await prisma.familyMember.findMany({
      where: { userId: req.user.id },
      include: {
        family: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                    role: true,
                    allergies: true,
                    dietaryPreferences: true,
                    dislikes: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (memberships.length === 0) {
      return res.json({ family: null, families: [] });
    }

    const families = memberships.map(m => {
      const fam = m.family;
      const canViewFamilyFoodNeeds = m.role === 'maker' || fam.creatorId === req.user.id;
      const formattedMembers = fam.members.map(mem => {
        const user = {
          id: mem.user.id,
          name: mem.user.name,
          avatar: mem.user.avatar,
          role: mem.user.role
        };
        if (canViewFamilyFoodNeeds || mem.user.id === req.user.id) {
          user.allergies = mem.user.allergies ? JSON.parse(mem.user.allergies) : [];
          user.dietaryPreferences = mem.user.dietaryPreferences ? JSON.parse(mem.user.dietaryPreferences) : [];
          user.dislikes = mem.user.dislikes || '';
        }
        return { ...mem, user };
      });

      // Calculate family allergy shield
      const allergyMap = {};
      const preferenceSet = new Set();
      (canViewFamilyFoodNeeds ? formattedMembers : []).forEach(mem => {
        (mem.user.allergies || []).forEach(allergy => {
          if (!allergyMap[allergy]) allergyMap[allergy] = [];
          allergyMap[allergy].push(mem.user.name);
        });
        (mem.user.dietaryPreferences || []).forEach(pref => {
          preferenceSet.add(pref);
        });
      });

      const allergyShield = Object.entries(allergyMap).map(([allergen, members]) => ({ allergen, members }));

      const familyDetails = { ...fam };
      if (!canViewFamilyFoodNeeds) delete familyDetails.code;
      return {
        ...familyDetails,
        members: formattedMembers,
        allergyShield,
        dietaryPreferences: Array.from(preferenceSet)
      };
    });

    const currentFamily = families[0];
    // Return both formats so res.data.family and res.data array consumers both work seamlessly
    res.json({ family: currentFamily, families, ...currentFamily });
  } catch (error) {
    console.error('Fetch family error:', error);
    res.status(500).json({ error: 'Failed to fetch families' });
  }
});

router.get('/:id/members', async (req, res) => {
  try {
    const familyId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(familyId)) return res.status(400).json({ error: 'Invalid family' });
    const membership = await prisma.familyMember.findUnique({ where: { userId_familyId: { userId: req.user.id, familyId } } });
    if (!membership) return res.status(403).json({ error: 'Only family members can view this list' });
    const members = await prisma.familyMember.findMany({
      where: { familyId },
      include: { user: { select: { id: true, name: true, avatar: true, ...(membership.role === 'maker' ? { email: true } : {}) } } }
    });
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

router.delete('/leave', async (req, res) => {
  try {
    const { familyId } = req.body;
    const id = Number.parseInt(familyId, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Choose a valid family' });
    const membership = await prisma.familyMember.findUnique({ where: { userId_familyId: { userId: req.user.id, familyId: id } } });
    const family = await prisma.family.findUnique({ where: { id }, select: { creatorId: true } });
    if (!membership) return res.status(404).json({ error: 'Family membership not found' });
    if (membership.role === 'maker' || family?.creatorId === req.user.id) return res.status(403).json({ error: 'The family meal planner cannot leave until planner controls are transferred' });
    await prisma.familyMember.delete({
      where: { userId_familyId: { userId: req.user.id, familyId: id } }
    });
    res.json({ message: 'Left family successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to leave family' });
  }
});

// GET /api/family/messages/:familyId - get chat history for a family
router.get('/messages/:familyId', authenticate, async (req, res) => {
  try {
    const { familyId } = req.params;
    // Verify user is in this family
    const member = await prisma.familyMember.findFirst({
      where: { familyId: parseInt(familyId), userId: req.user.id }
    });
    if (!member) return res.status(403).json({ error: 'Not a family member' });

    const messages = await prisma.familyMessage.findMany({
      where: { familyId: parseInt(familyId) },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
