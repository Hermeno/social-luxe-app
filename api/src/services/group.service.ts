import { prisma } from '../config/database'
import { emitToUser, onlineUsers } from '../socket'
import { sendPush } from './notification.service'

export async function createGroup(creatorId: string, name: string, memberIds: string[]) {
  const group = await prisma.groupChat.create({
    data: {
      name,
      createdBy: creatorId,
      members: {
        create: [
          { userId: creatorId, isAdmin: true },
          ...memberIds
            .filter((id) => id !== creatorId)
            .map((userId) => ({ userId, isAdmin: false })),
        ],
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatar: true } } },
      },
    },
  })
  return group
}

export async function getMyGroups(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { id: true, name: true, avatar: true } } },
          },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  return memberships.map((m) => ({
    groupId: m.groupId,
    isAdmin: m.isAdmin,
    joinedAt: m.joinedAt,
    group: {
      id: m.group.id,
      name: m.group.name,
      avatar: m.group.avatar,
      memberCount: m.group._count.members,
      lastMessage: m.group.messages[0] ?? null,
    },
  }))
}

export async function getGroupMessages(groupId: string, userId: string, page = 1) {
  const limit = 20
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  })
  if (!member) throw new Error('Not a member of this group')

  return prisma.groupMessage.findMany({
    where: { groupId },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })
}

export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  content?: string,
  mediaUrl?: string,
) {
  if (!content && !mediaUrl) throw new Error('Message must have content or media')

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: senderId } },
  })
  if (!member) throw new Error('Not a member of this group')

  const message = await prisma.groupMessage.create({
    data: { groupId, senderId, content, mediaUrl },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  })

  // Get all group members
  const members = await prisma.groupMember.findMany({ where: { groupId } })

  // Emit to all members via socket and send push to offline members
  for (const m of members) {
    emitToUser(m.userId, 'group:message:new', { groupId, message })

    if (!onlineUsers.has(m.userId) && m.userId !== senderId) {
      await sendPush(
        m.userId,
        'New Group Message',
        content ?? 'Sent a media file',
        { groupId, messageId: message.id },
      )
    }
  }

  return message
}

export async function addMember(groupId: string, adminId: string, userId: string) {
  const admin = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: adminId } },
  })
  if (!admin || !admin.isAdmin) throw new Error('Only admins can add members')

  return prisma.groupMember.create({
    data: { groupId, userId, isAdmin: false },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
}

export async function removeMember(groupId: string, requesterId: string, userId: string) {
  const requester = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: requesterId } },
  })

  // Allow self-leave or admin removal
  if (requesterId !== userId && (!requester || !requester.isAdmin)) {
    throw new Error('Only admins can remove members')
  }

  const target = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  })
  if (!target) throw new Error('Member not found')

  return prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } })
}
