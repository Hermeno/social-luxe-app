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

  io.on('connection', (socket: Socket & { userId?: string }) => {
    const userId = socket.userId!

    // Add to online users map
    onlineUsers.set(userId, socket.id)
    socket.join(userId)

    // Notify all connected clients that this user is online
    io.emit('user:online', { userId })

    // ── message:typing ──────────────────────────────────────────────────────
    socket.on('message:typing', ({ toUserId, isTyping }: { toUserId: string; isTyping: boolean }) => {
      io.to(toUserId).emit('message:typing', { fromUserId: userId, isTyping })
    })

    // ── message:read ────────────────────────────────────────────────────────
    socket.on('message:read', async ({ messageId, senderId }: { messageId: string; senderId: string }) => {
      try {
        await prisma.message.update({
          where: { id: messageId },
          data: { readAt: new Date() },
        })
        io.to(senderId).emit('message:read', { messageId })
      } catch {
        // silently ignore db errors in socket context
      }
    })

    // ── group:message ───────────────────────────────────────────────────────
    socket.on(
      'group:message',
      async ({
        groupId,
        content,
        mediaUrl,
      }: {
        groupId: string
        content?: string
        mediaUrl?: string
      }) => {
        try {
          const message = await prisma.groupMessage.create({
            data: { groupId, senderId: userId, content, mediaUrl },
            include: { sender: { select: { id: true, name: true, avatar: true } } },
          })

          // Emit to all group members
          const members = await prisma.groupMember.findMany({ where: { groupId } })
          members.forEach((m) => {
            io.to(m.userId).emit('group:message:new', { groupId, message })
          })
        } catch {
          // silently ignore
        }
      },
    )

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
