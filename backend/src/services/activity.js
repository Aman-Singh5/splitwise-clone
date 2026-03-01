import { prisma } from '../utils/prisma.js';

export async function createActivity(userId, type, metadata, groupId = null) {
  return prisma.activity.create({ data: { userId, type, metadata, groupId } });
}
