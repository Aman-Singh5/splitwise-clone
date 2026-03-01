import { prisma } from '../utils/prisma.js';

export async function createNotification(userId, type, data) {
  return prisma.notification.create({ data: { userId, type, data } });
}

export async function createNotificationsForMany(userIds, type, data) {
  return prisma.notification.createMany({
    data: userIds.map(userId => ({ userId, type, data })),
  });
}
