import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import { calculateUserBalances, calculateGroupBalances, simplifyDebts } from '../services/balanceCalculator.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const balanceMap = await calculateUserBalances(req.user.id);

  const userIds = Object.keys(balanceMap);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, avatar: true, email: true },
      })
    : [];

  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const balances = userIds
    .map(uid => ({ user: userMap[uid], balance: Math.round(balanceMap[uid] * 100) / 100 }))
    .filter(b => b.user && Math.abs(b.balance) > 0.01);

  const totalOwed = balances.filter(b => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const totalOwing = balances.filter(b => b.balance < 0).reduce((s, b) => s + b.balance, 0);

  res.json({ balances, totalOwed, totalOwing });
});

router.get('/friends/:friendId', authenticate, async (req, res) => {
  const { friendId } = req.params;
  const userId = req.user.id;

  const expenses = await prisma.expense.findMany({
    where: {
      groupId: null,
      OR: [
        { paidById: userId, splits: { some: { userId: friendId } } },
        { paidById: friendId, splits: { some: { userId } } },
      ],
    },
    include: {
      paidBy: { select: { id: true, name: true, avatar: true } },
      splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
    },
    orderBy: { date: 'desc' },
  });

  const settlements = await prisma.settlement.findMany({
    where: {
      groupId: null,
      OR: [
        { fromUserId: userId, toUserId: friendId },
        { fromUserId: friendId, toUserId: userId },
      ],
    },
  });

  let balance = 0;
  for (const exp of expenses) {
    if (exp.paidById === userId) {
      const split = exp.splits.find(s => s.userId === friendId);
      if (split) balance += split.amount;
    } else {
      const split = exp.splits.find(s => s.userId === userId);
      if (split) balance -= split.amount;
    }
  }
  for (const s of settlements) {
    if (s.fromUserId === userId) balance += s.amount;
    else balance -= s.amount;
  }

  res.json({ expenses, settlements, balance: Math.round(balance * 100) / 100 });
});

router.get('/groups/:groupId', authenticate, async (req, res) => {
  const { groupId } = req.params;

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId, userId: req.user.id },
  });
  if (!isMember) return res.status(403).json({ message: 'Not a member of this group' });

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  const netBalances = await calculateGroupBalances(groupId);

  const userIds = Object.keys(netBalances);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatar: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  let transactions = simplifyDebts(netBalances);
  transactions = transactions.map(t => ({
    from: userMap[t.from],
    to: userMap[t.to],
    amount: t.amount,
  }));

  const memberBalances = userIds.map(uid => ({
    user: userMap[uid],
    balance: Math.round(netBalances[uid] * 100) / 100,
  }));

  res.json({ memberBalances, transactions, simplifyDebts: group?.simplifyDebts });
});

export default router;
