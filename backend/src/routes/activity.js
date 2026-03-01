import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const { groupId, page = 1, limit = 30 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = groupId
    ? { groupId }
    : {
        OR: [
          { userId: req.user.id },
          {
            groupId: {
              in: (await prisma.groupMember.findMany({
                where: { userId: req.user.id },
                select: { groupId: true },
              })).map(gm => gm.groupId),
            },
          },
        ],
      };

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.activity.count({ where }),
  ]);

  res.json({ activities, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
});

export default router;
