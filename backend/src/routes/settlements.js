import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import { createActivity } from '../services/activity.js';
import { createNotification } from '../services/notifications.js';
import { sendEmail, settlementEmail } from '../utils/email.js';

const router = express.Router();

const settlementSchema = z.object({
  toUserId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  groupId: z.string().nullable().optional(),
  notes: z.string().optional(),
  date: z.string().optional(),
});

router.get('/', authenticate, async (req, res) => {
  const { groupId } = req.query;
  const where = {
    OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }],
  };
  if (groupId) where.groupId = groupId;

  const settlements = await prisma.settlement.findMany({
    where,
    include: {
      fromUser: { select: { id: true, name: true, avatar: true } },
      toUser: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { date: 'desc' },
  });
  res.json(settlements);
});

router.post('/', authenticate, async (req, res) => {
  const data = settlementSchema.parse(req.body);

  const settlement = await prisma.settlement.create({
    data: {
      fromUserId: req.user.id,
      toUserId: data.toUserId,
      amount: data.amount,
      currency: data.currency,
      groupId: data.groupId || null,
      notes: data.notes,
      date: data.date ? new Date(data.date) : new Date(),
    },
    include: {
      fromUser: { select: { id: true, name: true, avatar: true } },
      toUser: { select: { id: true, name: true, avatar: true } },
    },
  });

  await createActivity(req.user.id, 'SETTLEMENT_CREATED', {
    settlementId: settlement.id,
    toUserId: data.toUserId,
    amount: data.amount,
    currency: data.currency,
  }, data.groupId);

  await createNotification(data.toUserId, 'SETTLEMENT_RECEIVED', {
    settlementId: settlement.id,
    fromUserId: req.user.id,
    fromUserName: req.user.name,
    amount: data.amount,
    currency: data.currency,
  });

  const toUser = await prisma.user.findUnique({ where: { id: data.toUserId } });
  if (toUser) {
    await sendEmail({
      to: toUser.email,
      subject: `${req.user.name} recorded a payment to you`,
      html: settlementEmail(toUser.name, req.user.name, data.amount, data.currency),
    });
  }

  res.status(201).json(settlement);
});

router.delete('/:id', authenticate, async (req, res) => {
  const settlement = await prisma.settlement.findFirst({
    where: { id: req.params.id, fromUserId: req.user.id },
  });
  if (!settlement) return res.status(404).json({ message: 'Settlement not found or not authorized' });
  await prisma.settlement.delete({ where: { id: req.params.id } });
  res.json({ message: 'Settlement deleted' });
});

export default router;
