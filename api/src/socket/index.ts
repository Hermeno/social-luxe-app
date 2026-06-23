import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { verifyToken } from '../utils/jwt'
import { prisma } from '../config/database'

let io: Server

export const onlineUsers = new Map<string, string>() // userId → socketId

export function setupSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token as string
      if (!token) return next(new Error('Authentication error'))
      const payload = verifyToken(token)
      ;(socket as Socket & { userId: string }).userId = payload.userId
      next()
    } catch {
      next(new Error('Authentication error'))
    }
  })

  io.on('connection', async (socket: Socket & { userId?: string }) => {
    const userId = socket.userId!

    onlineUsers.set(userId, socket.id)
    socket.join(userId)

    // Auto-join all group rooms so messages arrive without explicit group:join
    try {
      const memberships = await prisma.groupMember.findMany({
        where: { userId },
        select: { groupId: true },
      })
      memberships.forEach(({ groupId }) => socket.join(`group:${groupId}`))
    } catch {}

    socket.emit('users:online:snapshot', { userIds: Array.from(onlineUsers.keys()) })
    socket.broadcast.emit('user:online', { userId })

    // ── message:typing ──────────────────────────────────────────────────────
    socket.on('message:typing', ({ toUserId, isTyping }: { toUserId: string; isTyping: boolean }) => {
      io.to(toUserId).emit('message:typing', { fromUserId: userId, isTyping })
    })

    // ── message:read ────────────────────────────────────────────────────────
    socket.on('message:read', async ({ messageId, senderId }: { messageId: string; senderId: string }) => {
      try {
        await prisma.message.update({ where: { id: messageId }, data: { readAt: new Date() } })
        io.to(senderId).emit('message:read', { messageId })
      } catch {}
    })

    // ── group:join ──────────────────────────────────────────────────────────
    // Client calls this after creating a group or when navigating into one
    socket.on('group:join', ({ groupId }: { groupId: string }) => {
      socket.join(`group:${groupId}`)
    })

    // ── group:leave ─────────────────────────────────────────────────────────
    socket.on('group:leave', ({ groupId }: { groupId: string }) => {
      socket.leave(`group:${groupId}`)
    })

    // ── group:message ───────────────────────────────────────────────────────
    // Broadcasts via room — O(1) vs O(n members) with individual emits
    socket.on(
      'group:message',
      async ({ groupId, content, replyToId }: { groupId: string; content?: string; replyToId?: string }) => {
        try {
          const member = await prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId } },
          })
          if (!member) return

          const message = await prisma.groupMessage.create({
            data: { groupId, senderId: userId, content, replyToId: replyToId ?? null },
            include: {
              sender:  { select: { id: true, name: true, avatar: true } },
              replyTo: { include: { sender: { select: { id: true, name: true, avatar: true } } } },
            },
          })

          // socket.to() excludes the sender — they already see the message locally
          socket.to(`group:${groupId}`).emit('group:message:new', { groupId, message })
        } catch {}
      },
    )

    // ── group:typing ────────────────────────────────────────────────────────
    socket.on('group:typing', ({ groupId, isTyping }: { groupId: string; isTyping: boolean }) => {
      socket.to(`group:${groupId}`).emit('group:typing', { groupId, userId, isTyping })
    })

    // ── union:join — auto-join rooms for both unions ─────────────────────────
    try {
      const userUnions = await prisma.union.findMany({
        where: { OR: [{ memberAId: userId }, { memberBId: userId }] },
        select: { id: true },
      })
      userUnions.forEach(({ id }) => socket.join(`union:${id}`))
    } catch {}

    // ── union:typing ─────────────────────────────────────────────────────────
    socket.on('union:typing', ({ toUnionId, fromUnionId, isTyping }: { toUnionId: string; fromUnionId: string; isTyping: boolean }) => {
      socket.to(`union:${toUnionId}`).emit('union:typing', { fromUnionId, isTyping })
    })

    // ── union:message:read ────────────────────────────────────────────────────
    socket.on('union:message:read', async ({ fromUnionId, toUnionId }: { fromUnionId: string; toUnionId: string }) => {
      try {
        await prisma.unionMessage.updateMany({
          where: { fromUnionId, toUnionId, readAt: null },
          data:  { readAt: new Date() },
        })
        io.to(`union:${fromUnionId}`).emit('union:message:read', { fromUnionId, toUnionId })
      } catch {}
    })

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(userId)
      io.emit('user:offline', { userId })
    })
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized')
  return io
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  getIO().to(userId).emit(event, data)
}
