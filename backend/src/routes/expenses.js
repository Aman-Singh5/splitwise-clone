import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import { calculateSplits } from '../services/splitCalculator.js';
import { createActivity } from '../services/activity.js';
import { createNotificationsForMany } from '../services/notifications.js';
import { sendEmail, expenseAddedEmail } from '../utils/email.js';
import { getExchangeRate } from '../services/currency.js';

const router = express.Router();

const participantSchema = z.object({
  userId: z.string(),
  amount: z.number().optional(),
  percent: z.number().optional(),
  shares: z.number().optional(),
});

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  paidById: z.string(),
  groupId: z.string().nullable().optional(),
  category: z.string().default('General'),
  date: z.string().optional(),
  splitType: z.enum(['EQUAL', 'EXACT', 'PERCENT', 'SHARES']).default('EQUAL'),
  participants: z.array(participantSchema).min(1),
  notes: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringInterval: z.string().optional(),
});

router.get('/', authenticate, async (req, res) => {
  const { groupId, friendId, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  let where = {
    OR: [
      { paidById: req.user.id },
      { splits: { some: { userId: req.user.id } } },
    ],
  };

  if (groupId) where.groupId = groupId;
  if (friendId) {
    where = {
      AND: [
        { groupId: null },
        { OR: [
          { paidById: req.user.id, splits: { some: { userId: friendId } } },
          { paidById: friendId, splits: { some: { userId: req.user.id } } },
        ]},
      ],
    };
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        paidBy: { select: { id: true, name: true, avatar: true } },
        splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.expense.count({ where }),
  ]);

  res.json({ expenses, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
});

router.post('/', authenticate, upload.single('receipt'), async (req, res) => {
  const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;
  const data = expenseSchema.parse(body);

  const exchangeRate = await getExchangeRate(data.currency);
  const amountInUsd = data.amount / exchangeRate;

  const splits = calculateSplits(data.amount, data.splitType, data.participants);

  const expense = await prisma.expense.create({
    data: {
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      amountInUsd,
      exchangeRate,
      paidById: data.paidById,
      groupId: data.groupId || null,
      category: data.category,
      date: data.date ? new Date(data.date) : new Date(),
      notes: data.notes,
      isRecurring: data.isRecurring,
      recurringInterval: data.recurringInterval,
      receiptUrl: req.file ? `/uploads/${req.file.filename}` : null,
      splits: { create: splits },
    },
    include: {
      paidBy: { select: { id: true, name: true, avatar: true } },
      splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
    },
  });

  const otherUserIds = splits.filter(s => s.userId !== req.user.id).map(s => s.userId);
  if (otherUserIds.length) {
    await createNotificationsForMany(otherUserIds, 'EXPENSE_ADDED', {
      expenseId: expense.id,
      description: expense.description,
      paidByName: req.user.name,
      amount: expense.amount,
      currency: expense.currency,
    });

    const otherUsers = await prisma.user.findMany({ where: { id: { in: otherUserIds } } });
    for (const u of otherUsers) {
      await sendEmail({
        to: u.email,
        subject: `New expense: ${expense.description}`,
        html: expenseAddedEmail(u.name, req.user.name, expense.description, expense.amount, expense.currency),
      });
    }
  }

  await createActivity(req.user.id, 'EXPENSE_ADDED', {
    expenseId: expense.id,
    description: expense.description,
    amount: expense.amount,
    currency: expense.currency,
  }, expense.groupId);

  res.status(201).json(expense);
});

router.get('/:id', authenticate, async (req, res) => {
  const expense = await prisma.expense.findFirst({
    where: {
      id: req.params.id,
      OR: [{ paidById: req.user.id }, { splits: { some: { userId: req.user.id } } }],
    },
    include: {
      paidBy: { select: { id: true, name: true, avatar: true } },
      splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
    },
  });
  if (!expense) return res.status(404).json({ message: 'Expense not found' });
  res.json(expense);
});

router.put('/:id', authenticate, upload.single('receipt'), async (req, res) => {
  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, paidById: req.user.id },
  });
  if (!existing) return res.status(404).json({ message: 'Expense not found or not authorized' });

  const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;
  const data = expenseSchema.partial().parse(body);

  const updateData = { ...data };
  if (data.currency && data.amount) {
    updateData.exchangeRate = await getExchangeRate(data.currency);
    updateData.amountInUsd = data.amount / updateData.exchangeRate;
  }
  if (req.file) updateData.receiptUrl = `/uploads/${req.file.filename}`;
  if (data.date) updateData.date = new Date(data.date);

  let newSplits;
  if (data.splitType && data.participants && data.amount) {
    newSplits = calculateSplits(data.amount, data.splitType, data.participants);
  }

  delete updateData.splitType;
  delete updateData.participants;

  const expense = await prisma.$transaction(async (tx) => {
    if (newSplits) {
      await tx.expenseSplit.deleteMany({ where: { expenseId: req.params.id } });
      await tx.expenseSplit.createMany({ data: newSplits.map(s => ({ ...s, expenseId: req.params.id })) });
    }
    return tx.expense.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        paidBy: { select: { id: true, name: true, avatar: true } },
        splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      },
    });
  });

  await createActivity(req.user.id, 'EXPENSE_UPDATED', { expenseId: expense.id, description: expense.description }, expense.groupId);

  res.json(expense);
});

router.delete('/:id', authenticate, async (req, res) => {
  const expense = await prisma.expense.findFirst({
    where: { id: req.params.id, paidById: req.user.id },
  });
  if (!expense) return res.status(404).json({ message: 'Expense not found or not authorized' });
  await prisma.expense.delete({ where: { id: req.params.id } });
  await createActivity(req.user.id, 'EXPENSE_DELETED', { description: expense.description }, expense.groupId);
  res.json({ message: 'Expense deleted' });
});

export default router;
