import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import { createActivity } from '../services/activity.js';
import { createNotification } from '../services/notifications.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: req.user.id } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      _count: { select: { expenses: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(groups);
});

router.post('/', authenticate, upload.single('image'), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['TRIP', 'HOME', 'COUPLE', 'OTHER']).default('OTHER'),
    simplifyDebts: z.coerce.boolean().default(false),
    memberIds: z.string().optional(),
  });
  const data = schema.parse(req.body);
  const memberIds = data.memberIds ? JSON.parse(data.memberIds) : [];

  const group = await prisma.group.create({
    data: {
      name: data.name,
      type: data.type,
      simplifyDebts: data.simplifyDebts,
      createdById: req.user.id,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      members: {
        create: [
          { userId: req.user.id, role: 'ADMIN' },
          ...memberIds.filter(id => id !== req.user.id).map(userId => ({ userId, role: 'MEMBER' })),
        ],
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
    },
  });

  await createActivity(req.user.id, 'GROUP_CREATED', { groupId: group.id, groupName: group.name }, group.id);
  for (const memberId of memberIds) {
    if (memberId !== req.user.id) {
      await createNotification(memberId, 'GROUP_INVITE', { groupId: group.id, groupName: group.name, invitedBy: req.user.name });
    }
  }

  res.status(201).json(group);
});

router.get('/:id', authenticate, async (req, res) => {
  const group = await prisma.group.findFirst({
    where: { id: req.params.id, members: { some: { userId: req.user.id } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true, avatar: true } },
          splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        },
        orderBy: { date: 'desc' },
        take: 50,
      },
    },
  });
  if (!group) return res.status(404).json({ message: 'Group not found' });
  res.json(group);
});

router.put('/:id', authenticate, upload.single('image'), async (req, res) => {
  const group = await prisma.group.findFirst({
    where: { id: req.params.id, members: { some: { userId: req.user.id, role: 'ADMIN' } } },
  });
  if (!group) return res.status(404).json({ message: 'Group not found or not authorized' });

  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    type: z.enum(['TRIP', 'HOME', 'COUPLE', 'OTHER']).optional(),
    simplifyDebts: z.coerce.boolean().optional(),
  });
  const data = schema.parse(req.body);
  if (req.file) data.image = `/uploads/${req.file.filename}`;

  const updated = await prisma.group.update({
    where: { id: req.params.id },
    data,
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
    },
  });
  res.json(updated);
});

router.delete('/:id', authenticate, async (req, res) => {
  const group = await prisma.group.findFirst({
    where: { id: req.params.id, createdById: req.user.id },
  });
  if (!group) return res.status(404).json({ message: 'Group not found or not authorized' });
  await prisma.group.delete({ where: { id: req.params.id } });
  res.json({ message: 'Group deleted' });
});

router.post('/:id/members', authenticate, async (req, res) => {
  const { userId, email } = z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
  }).parse(req.body);

  const isAdmin = await prisma.groupMember.findFirst({
    where: { groupId: req.params.id, userId: req.user.id, role: 'ADMIN' },
  });
  if (!isAdmin) return res.status(403).json({ message: 'Only admins can add members' });

  let targetUser;
  if (userId) targetUser = await prisma.user.findUnique({ where: { id: userId } });
  else if (email) targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser) return res.status(404).json({ message: 'User not found' });

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: req.params.id, userId: targetUser.id } },
  });
  if (existing) return res.status(409).json({ message: 'User already in group' });

  const member = await prisma.groupMember.create({
    data: { groupId: req.params.id, userId: targetUser.id },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });

  await createActivity(req.user.id, 'GROUP_MEMBER_ADDED', { groupId: req.params.id, userId: targetUser.id, userName: targetUser.name }, req.params.id);
  await createNotification(targetUser.id, 'GROUP_INVITE', { groupId: req.params.id, invitedBy: req.user.name });

  res.status(201).json(member);
});

router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  const isSelf = req.params.userId === req.user.id;
  const isAdmin = await prisma.groupMember.findFirst({
    where: { groupId: req.params.id, userId: req.user.id, role: 'ADMIN' },
  });
  if (!isSelf && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } },
  });
  res.json({ message: isSelf ? 'Left group' : 'Member removed' });
});

export default router;
