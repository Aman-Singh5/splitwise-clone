import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import { createNotification } from '../services/notifications.js';
import { createActivity } from '../services/activity.js';
import { sendEmail, friendInviteEmail } from '../utils/email.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const userId = req.user.id;
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userId }, { friendId: userId }],
      status: 'ACCEPTED',
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
      friend: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });

  const friends = friendships.map(f => {
    const friend = f.userId === userId ? f.friend : f.user;
    return { ...friend, friendshipId: f.id };
  });

  res.json(friends);
});

router.get('/requests', authenticate, async (req, res) => {
  const userId = req.user.id;
  const sent = await prisma.friendship.findMany({
    where: { userId, status: 'PENDING' },
    include: { friend: { select: { id: true, name: true, email: true, avatar: true } } },
  });
  const received = await prisma.friendship.findMany({
    where: { friendId: userId, status: 'PENDING' },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });
  res.json({ sent, received });
});

router.post('/request', authenticate, async (req, res) => {
  const { friendId, email } = z.object({
    friendId: z.string().optional(),
    email: z.string().email().optional(),
  }).parse(req.body);

  let targetUser;
  if (friendId) {
    targetUser = await prisma.user.findUnique({ where: { id: friendId } });
  } else if (email) {
    targetUser = await prisma.user.findUnique({ where: { email } });
  }

  // User not registered yet — send them an invite email
  if (!targetUser && email) {
    const signupUrl = `${process.env.FRONTEND_URL}/register`;
    await sendEmail({
      to: email,
      subject: `${req.user.name} invited you to Splitwise!`,
      html: friendInviteEmail(req.user.name, email, signupUrl),
    });
    return res.status(200).json({ message: 'Invitation email sent! They will be connected with you once they sign up.' });
  }

  if (!targetUser) return res.status(404).json({ message: 'User not found' });
  if (targetUser.id === req.user.id) return res.status(400).json({ message: 'Cannot add yourself' });

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: req.user.id, friendId: targetUser.id },
        { userId: targetUser.id, friendId: req.user.id },
      ],
    },
  });
  if (existing) return res.status(409).json({ message: 'Friend request already exists or already friends' });

  const friendship = await prisma.friendship.create({
    data: { userId: req.user.id, friendId: targetUser.id, status: 'PENDING' },
  });

  await createNotification(targetUser.id, 'FRIEND_REQUEST', {
    fromUserId: req.user.id,
    fromUserName: req.user.name,
    friendshipId: friendship.id,
  });

  await createActivity(req.user.id, 'FRIEND_REQUEST_SENT', { toUserId: targetUser.id, toUserName: targetUser.name });

  res.status(201).json({ message: 'Friend request sent', friendship });
});

router.put('/:id/accept', authenticate, async (req, res) => {
  const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!friendship || friendship.friendId !== req.user.id) {
    return res.status(404).json({ message: 'Friend request not found' });
  }
  const updated = await prisma.friendship.update({
    where: { id: req.params.id },
    data: { status: 'ACCEPTED' },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });

  await createNotification(friendship.userId, 'FRIEND_REQUEST_ACCEPTED', {
    fromUserId: req.user.id,
    fromUserName: req.user.name,
  });

  await createActivity(req.user.id, 'FRIEND_REQUEST_ACCEPTED', { friendId: friendship.userId });

  res.json(updated);
});

router.put('/:id/decline', authenticate, async (req, res) => {
  const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!friendship || friendship.friendId !== req.user.id) {
    return res.status(404).json({ message: 'Friend request not found' });
  }
  await prisma.friendship.update({ where: { id: req.params.id }, data: { status: 'DECLINED' } });
  res.json({ message: 'Friend request declined' });
});

router.delete('/:id', authenticate, async (req, res) => {
  const userId = req.user.id;
  const friendship = await prisma.friendship.findFirst({
    where: {
      id: req.params.id,
      OR: [{ userId }, { friendId: userId }],
    },
  });
  if (!friendship) return res.status(404).json({ message: 'Friendship not found' });
  await prisma.friendship.delete({ where: { id: req.params.id } });
  res.json({ message: 'Friend removed' });
});

export default router;
