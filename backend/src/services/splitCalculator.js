export function calculateSplits(amount, splitType, participants) {
  const n = participants.length;
  let splits = [];

  switch (splitType) {
    case 'EQUAL': {
      const base = Math.floor((amount / n) * 100) / 100;
      const remainder = Math.round((amount - base * n) * 100) / 100;
      splits = participants.map((p, i) => ({
        userId: p.userId,
        amount: i === 0 ? base + remainder : base,
        splitType: 'EQUAL',
      }));
      break;
    }
    case 'EXACT': {
      const total = participants.reduce((s, p) => s + p.amount, 0);
      if (Math.abs(total - amount) > 0.01) throw new Error('Exact amounts must sum to the total');
      splits = participants.map(p => ({ userId: p.userId, amount: p.amount, splitType: 'EXACT' }));
      break;
    }
    case 'PERCENT': {
      const totalPct = participants.reduce((s, p) => s + p.percent, 0);
      if (Math.abs(totalPct - 100) > 0.01) throw new Error('Percentages must sum to 100');
      splits = participants.map(p => ({
        userId: p.userId,
        amount: Math.round((amount * p.percent / 100) * 100) / 100,
        splitType: 'PERCENT',
      }));
      break;
    }
    case 'SHARES': {
      const totalShares = participants.reduce((s, p) => s + p.shares, 0);
      splits = participants.map(p => ({
        userId: p.userId,
        amount: Math.round((amount * p.shares / totalShares) * 100) / 100,
        splitType: 'SHARES',
      }));
      break;
    }
    default:
      throw new Error('Invalid split type');
  }

  return splits;
}
