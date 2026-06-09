import { prisma } from '../config/database'
import { emitToUser, onlineUsers } from '../socket'
import { sendPush } from './notification.service'

const MESSAGE_INCLUDE = {
  sender:  { select: { id: true, name: true, avatar: true } },
  replyTo: {
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  },
} as const

// ── Create group ──────────────────────────────────────────────────────────────

export async function createGroup(creatorId: string, name: string, memberIds: string[], type: 'COMMUNITY' | 'GROUP' = 'COMMUNITY') {
  return prisma.groupChat.create({
    data: {
      name, createdBy: creatorId, type,
      members: {
        create: [
          { userId: creatorId, isAdmin: true },
          ...memberIds.filter((id) => id !== creatorId).map((userId) => ({ userId })),
        ],
      },
    },
    select: { id: true, name: true, avatar: true, description: true, type: true, createdBy: true, createdAt: true },
  })
}

// ── List groups ───────────────────────────────────────────────────────────────

export async function getMyGroups(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, createdAt: true, sender: { select: { name: true } } },
          },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  return memberships.map((m) => ({
    id:          m.group.id,
    name:        m.group.name,
    avatar:      m.group.avatar,
    description: m.group.description,
    type:        m.group.type,
    memberCount: m.group._count.members,
    lastMessage: m.group.messages[0]
      ? { content: m.group.messages[0].content, createdAt: m.group.messages[0].createdAt.toISOString() }
      : null,
  }))
}

// ── Get group info (members + meta) ───────────────────────────────────────────

export async function getGroupInfo(groupId: string, requesterId: string) {
  const [membership, group] = await Promise.all([
    prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: requesterId } } }),
    prisma.groupChat.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: [{ isAdmin: 'desc' }, { joinedAt: 'asc' }],
        },
      },
    }),
  ])
  if (!membership) throw new Error('Not a member of this group')
  if (!group)      throw new Error('Group not found')

  return {
    id:          group.id,
    name:        group.name,
    avatar:      group.avatar,
    description: group.description,
    type:        group.type,
    createdBy:   group.createdBy,
    memberCount: group.members.length,
    myRole:      membership.isAdmin ? 'admin' : 'member',
    isCreator:   group.createdBy === requesterId,
    members:     group.members.map((m) => ({
      userId:   m.userId,
      isAdmin:  m.isAdmin,
      joinedAt: m.joinedAt,
      user:     m.user,
    })),
  }
}

// ── Get messages (with reply context) ────────────────────────────────────────

export async function getGroupMessages(groupId: string, userId: string, page = 1) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } })
  if (!member) throw new Error('Not a member of this group')

  return prisma.groupMessage.findMany({
    where: { groupId },
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * 30,
    take: 30,
  })
}

// ── Send message ──────────────────────────────────────────────────────────────

export async function sendGroupMessage(groupId: string, senderId: string, content?: string, replyToId?: string) {
  if (!content?.trim()) throw new Error('Message cannot be empty')

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: senderId } } })
  if (!member) throw new Error('Not a member of this group')

  const message = await prisma.groupMessage.create({
    data: { groupId, senderId, content: content.trim(), replyToId: replyToId ?? null },
    include: MESSAGE_INCLUDE,
  })

  const members = await prisma.groupMember.findMany({ where: { groupId } })

  for (const m of members) {
    if (m.userId === senderId) continue
    emitToUser(m.userId, 'group:message:new', { groupId, message })
    if (!onlineUsers.has(m.userId)) {
      await sendPush(m.userId, 'Nova mensagem', content.trim(), { groupId, messageId: message.id })
    }
  }

  return message
}

// ── Update group (admin only) ─────────────────────────────────────────────────

export async function updateGroup(groupId: string, adminId: string, data: { name?: string; avatar?: string; description?: string }) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: adminId } } })
  if (!member?.isAdmin) throw new Error('Only admins can update the group')

  const group = await prisma.groupChat.update({
    where: { id: groupId },
    data,
    select: { id: true, name: true, avatar: true, description: true, type: true },
  })

  const members = await prisma.groupMember.findMany({ where: { groupId } })
  members.forEach((m) => {
    if (m.userId !== adminId) emitToUser(m.userId, 'group:updated', { groupId, ...data })
  })

  return group
}

// ── Delete group (creator only) ───────────────────────────────────────────────

export async function deleteGroup(groupId: string, requesterId: string) {
  const group = await prisma.groupChat.findUnique({ where: { id: groupId }, select: { createdBy: true } })
  if (!group) throw new Error('Group not found')
  if (group.createdBy !== requesterId) throw new Error('Only the group creator can delete it')

  const members = await prisma.groupMember.findMany({ where: { groupId } })
  members.forEach((m) => {
    if (m.userId !== requesterId) emitToUser(m.userId, 'group:deleted', { groupId })
  })

  await prisma.groupChat.delete({ where: { id: groupId } })
}

// ── Promote to admin (creator only) ──────────────────────────────────────────

export async function promoteToAdmin(groupId: string, creatorId: string, targetUserId: string) {
  const group = await prisma.groupChat.findUnique({ where: { id: groupId }, select: { createdBy: true } })
  if (!group) throw new Error('Group not found')
  if (group.createdBy !== creatorId) throw new Error('Only the group creator can promote admins')

  return prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    data: { isAdmin: true },
  })
}

// ── Member management ─────────────────────────────────────────────────────────

export async function addMember(groupId: string, adminId: string, userId: string) {
  const admin = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: adminId } } })
  if (!admin?.isAdmin) throw new Error('Only admins can add members')

  return prisma.groupMember.create({
    data: { groupId, userId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
}

export async function removeMember(groupId: string, requesterId: string, userId: string) {
  const requester = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: requesterId } } })
  if (requesterId !== userId && !requester?.isAdmin) throw new Error('Only admins can remove members')

  await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } })
  emitToUser(userId, 'group:removed', { groupId })
}

export async function leaveGroup(groupId: string, userId: string) {
  const group = await prisma.groupChat.findUnique({ where: { id: groupId }, select: { createdBy: true } })
  if (!group) throw new Error('Group not found')
  if (group.createdBy === userId) throw new Error('The creator cannot leave — delete the group instead')

  await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } })
}
