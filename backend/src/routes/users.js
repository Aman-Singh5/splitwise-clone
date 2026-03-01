import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, avatar: true, defaultCurrency: true, createdAt: true },
  });
  res.json(user);
});

router.put('/me', authenticate, upload.single('avatar'), async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).max(100).optional(),
    defaultCurrency: z.string().length(3).optional(),
  });
  const data = schema.parse(req.body);
  if (req.file) {
    data.avatar = `/uploads/${req.file.filename}`;
  }
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: { id: true, name: true, email: true, avatar: true, defaultCurrency: true },
  });
  res.json(user);
});

router.get('/search', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: req.user.id } },
        {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: { id: true, name: true, email: true, avatar: true },
    take: 10,
  });
  res.json(users);
});

export default router;
