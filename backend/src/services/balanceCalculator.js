import { prisma } from '../utils/prisma.js';

export async function calculateUserBalances(userId) {
  const expenses = await prisma.expense.findMany({
    where: {
      OR: [
        { paidById: userId },
        { splits: { some: { userId } } },
      ],
    },
    include: {
      splits: true,
      paidBy: { select: { id: true, name: true, avatar: true } },
    },
  });

  const settlements = await prisma.settlement.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
  });

  const balanceMap = {};

  for (const expense of expenses) {
    const userSplit = expense.splits.find(s => s.userId === userId);
    if (!userSplit) continue;

    const paidById = expense.paidById;
    if (paidById === userId) {
      for (const split of expense.splits) {
        if (split.userId === userId) continue;
        if (!balanceMap[split.userId]) balanceMap[split.userId] = 0;
        balanceMap[split.userId] += split.amount;
      }
    } else {
      if (!balanceMap[paidById]) balanceMap[paidById] = 0;
      balanceMap[paidById] -= userSplit.amount;
    }
  }

  for (const s of settlements) {
    if (s.fromUserId === userId) {
      if (!balanceMap[s.toUserId]) balanceMap[s.toUserId] = 0;
      balanceMap[s.toUserId] += s.amount;
    } else {
      if (!balanceMap[s.fromUserId]) balanceMap[s.fromUserId] = 0;
      balanceMap[s.fromUserId] -= s.amount;
    }
  }

  return balanceMap;
}

export async function calculateGroupBalances(groupId) {
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { splits: true },
  });

  const settlements = await prisma.settlement.findMany({ where: { groupId } });

  const netBalances = {};

  for (const expense of expenses) {
    if (!netBalances[expense.paidById]) netBalances[expense.paidById] = 0;
    netBalances[expense.paidById] += expense.amount;
    for (const split of expense.splits) {
      if (!netBalances[split.userId]) netBalances[split.userId] = 0;
      netBalances[split.userId] -= split.amount;
    }
  }

  for (const s of settlements) {
    if (!netBalances[s.fromUserId]) netBalances[s.fromUserId] = 0;
    if (!netBalances[s.toUserId]) netBalances[s.toUserId] = 0;
    netBalances[s.fromUserId] += s.amount;
    netBalances[s.toUserId] -= s.amount;
  }

  return netBalances;
}

export function simplifyDebts(netBalances) {
  const creditors = [];
  const debtors = [];

  for (const [userId, balance] of Object.entries(netBalances)) {
    if (balance > 0.01) creditors.push({ userId, amount: balance });
    else if (balance < -0.01) debtors.push({ userId, amount: -balance });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let ci = 0, di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.amount, debt.amount);

    transactions.push({ from: debt.userId, to: credit.userId, amount: Math.round(amount * 100) / 100 });

    credit.amount -= amount;
    debt.amount -= amount;

    if (credit.amount < 0.01) ci++;
    if (debt.amount < 0.01) di++;
  }

  return transactions;
}
