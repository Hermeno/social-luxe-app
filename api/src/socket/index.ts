import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { verifyToken } from '../utils/jwt'
import { prisma } from '../config/database'

let io: Server

export const onlineUsers = new Map<string, string>() // userId → socketId

// ── Modo Juntos — ephemeral per-session state ────────────────────────────────
type TogetherRoom = {
  members:   Set<string>          // userId → has chat open
  consented: Map<string, boolean> // userId → agreed to show
  visibility: 'private' | 'public'
}
const togetherRooms = new Map<string, TogetherRoom>()

// ── Modo Dupla — ephemeral real-time pairing (chat-initiated) ─────────────────
type DuplaMoment = {
  userA:       string   // proposer
  userB:       string   // partner
  accepted:    boolean
  vibe?:       string
  vibeColors?: [string, string]
}
const duplaMoments = new Map<string, DuplaMoment>()

function duplaKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function getOrCreateRoom(unionId: string): TogetherRoom {
  if (!togetherRooms.has(unionId)) {
    togetherRooms.set(unionId, { members: new Set(), consented: new Map(), visibility: 'private' })
  }
  return togetherRooms.get(unionId)!
}

function broadcastTogetherStatus(unionId: string, union: { memberAId: string; memberBId: string }) {
  const room = togetherRooms.get(unionId)
  if (!room) return
  const bothPresent = room.members.has(union.memberAId) && room.members.has(union.memberBId)
  io.to(`union:${unionId}`).emit('union:together:status', {
    unionId,
    bothPresent,
    memberConsents: Object.fromEntries(room.consented),
    visibility: room.visibility,
  })
}

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

    // ── Modo Juntos ────────────────────────────────────────────────────────────

    // Member opened the union chat screen
    socket.on('union:chat:enter', async ({ unionId }: { unionId: string }) => {
      try {
        const union = await prisma.union.findUnique({
          where:  { id: unionId },
          select: { id: true, memberAId: true, memberBId: true, name: true, label: true,
                    memberA: { select: { name: true } }, memberB: { select: { name: true } } },
        })
        if (!union || (union.memberAId !== userId && union.memberBId !== userId)) return

        const room = getOrCreateRoom(unionId)
        room.members.add(userId)
        broadcastTogetherStatus(unionId, union)
      } catch {}
    })

    // Member closed / backgrounded the union chat screen
    socket.on('union:chat:leave', async ({ unionId }: { unionId: string }) => {
      try {
        const room = togetherRooms.get(unionId)
        if (!room) return

        const firstMember = room.members.values().next().value as string | undefined
        const wasPublicAndBoth = room.visibility === 'public'
          && !!firstMember && room.consented.get(firstMember) === true

        room.members.delete(userId)
        room.consented.delete(userId)

        const union = await prisma.union.findUnique({
          where: { id: unionId }, select: { memberAId: true, memberBId: true },
        })
        if (!union) return

        // If the pair was publicly live → notify followers that it ended
        if (wasPublicAndBoth) {
          const followers = await prisma.follow.findMany({
            where:  { followingId: { in: [union.memberAId, union.memberBId] } },
            select: { followerId: true },
          })
          const unique = [...new Set(followers.map((f) => f.followerId))]
          unique.forEach((fId) => emitToUser(fId, 'union:together:ended', { unionId }))
        }

        broadcastTogetherStatus(unionId, union)
      } catch {}
    })

    // Member toggles consent or changes visibility
    socket.on('union:together:consent', async ({
      unionId, consent, visibility,
    }: { unionId: string; consent: boolean; visibility?: 'private' | 'public' }) => {
      try {
        const union = await prisma.union.findUnique({
          where:  { id: unionId },
          select: { id: true, memberAId: true, memberBId: true, name: true, label: true,
                    memberA: { select: { name: true } }, memberB: { select: { name: true } } },
        })
        if (!union || (union.memberAId !== userId && union.memberBId !== userId)) return

        const room = getOrCreateRoom(unionId)
        room.consented.set(userId, consent)
        if (visibility) room.visibility = visibility

        // Check if both present, both consented, and public
        const bothPresent  = room.members.has(union.memberAId) && room.members.has(union.memberBId)
        const bothConsented = room.consented.get(union.memberAId) === true
                           && room.consented.get(union.memberBId) === true

        if (bothPresent && bothConsented && room.visibility === 'public') {
          // Broadcast "live" to followers of both members
          const followers = await prisma.follow.findMany({
            where:  { followingId: { in: [union.memberAId, union.memberBId] } },
            select: { followerId: true },
          })
          const unique = [...new Set(followers.map((f) => f.followerId))]
          unique.forEach((fId) => emitToUser(fId, 'union:together:live', {
            unionId,
            unionName:  union.name,
            label:      union.label,
            memberAName: union.memberA.name,
            memberBName: union.memberB.name,
          }))
        }

        broadcastTogetherStatus(unionId, union)
      } catch {}
    })

    // ── Modo Dupla ─────────────────────────────────────────────────────────────

    // User A invites User B to dupla from within their DM chat
    socket.on('dupla:invite', ({ toUserId }: { toUserId: string }) => {
      const key = duplaKey(userId, toUserId)
      if (duplaMoments.has(key)) return
      duplaMoments.set(key, { userA: userId, userB: toUserId, accepted: false })
      io.to(toUserId).emit('dupla:invited', { fromUserId: userId })
    })

    // Partner accepts or declines
    socket.on('dupla:respond', ({ toUserId, accept }: { toUserId: string; accept: boolean }) => {
      const key = duplaKey(userId, toUserId)
      const moment = duplaMoments.get(key)
      if (!moment) return
      if (accept) {
        moment.accepted = true
        // Notify proposer so they can open the vibe picker
        io.to(toUserId).emit('dupla:accepted', { byUserId: userId })
      } else {
        duplaMoments.delete(key)
        io.to(toUserId).emit('dupla:declined', { byUserId: userId })
      }
    })

    // Either partner sets the vibe → go live for both + all followers
    socket.on('dupla:setVibe', async ({
      toUserId, vibe, vibeColors,
    }: { toUserId: string; vibe: string; vibeColors: [string, string] }) => {
      const key = duplaKey(userId, toUserId)
      const moment = duplaMoments.get(key)
      if (!moment || !moment.accepted) return
      if (moment.vibe) return  // first pick wins

      moment.vibe      = vibe
      moment.vibeColors = vibeColors

      try {
        const [profA, profB] = await Promise.all([
          prisma.user.findUnique({ where: { id: moment.userA }, select: { name: true, avatar: true } }),
          prisma.user.findUnique({ where: { id: moment.userB }, select: { name: true, avatar: true } }),
        ])
        if (!profA || !profB) return

        const payload = {
          userAId:     moment.userA,
          userAName:   profA.name,
          userAAvatar: profA.avatar,
          userBId:     moment.userB,
          userBName:   profB.name,
          userBAvatar: profB.avatar,
          vibe,
          vibeColors,
        }

        io.to(moment.userA).emit('dupla:live', payload)
        io.to(moment.userB).emit('dupla:live', payload)

        const followers = await prisma.follow.findMany({
          where:  { followingId: { in: [moment.userA, moment.userB] } },
          select: { followerId: true },
        })
        const unique = [...new Set(followers.map((f) => f.followerId))]
          .filter((id) => id !== moment.userA && id !== moment.userB)
        unique.forEach((fId) => emitToUser(fId, 'dupla:live', payload))
      } catch {}
    })

    // Either user ends the dupla moment
    socket.on('dupla:end', async ({ toUserId }: { toUserId: string }) => {
      const key = duplaKey(userId, toUserId)
      const moment = duplaMoments.get(key)
      if (!moment) return
      const wasLive = !!moment.vibe
      duplaMoments.delete(key)

      const endPayload = { userAId: moment.userA, userBId: moment.userB }
      io.to(moment.userA).emit('dupla:ended', endPayload)
      io.to(moment.userB).emit('dupla:ended', endPayload)

      if (wasLive) {
        try {
          const followers = await prisma.follow.findMany({
            where:  { followingId: { in: [moment.userA, moment.userB] } },
            select: { followerId: true },
          })
          const unique = [...new Set(followers.map((f) => f.followerId))]
            .filter((id) => id !== moment.userA && id !== moment.userB)
          unique.forEach((fId) => emitToUser(fId, 'dupla:ended', endPayload))
        } catch {}
      }
    })

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      onlineUsers.delete(userId)
      io.emit('user:offline', { userId })

      // Clean up any dupla moments this user was in
      for (const [key, moment] of [...duplaMoments]) {
        if (moment.userA !== userId && moment.userB !== userId) continue
        const wasLive = !!moment.vibe
        const otherId = moment.userA === userId ? moment.userB : moment.userA
        duplaMoments.delete(key)
        const endPayload = { userAId: moment.userA, userBId: moment.userB }
        io.to(otherId).emit('dupla:ended', endPayload)
        if (wasLive) {
          prisma.follow.findMany({
            where:  { followingId: { in: [moment.userA, moment.userB] } },
            select: { followerId: true },
          }).then((followers) => {
            const unique = [...new Set(followers.map((f) => f.followerId))]
              .filter((id) => id !== moment.userA && id !== moment.userB)
            unique.forEach((fId) => emitToUser(fId, 'dupla:ended', endPayload))
          }).catch(() => {})
        }
      }

      // Clean up any together rooms this user was in
      for (const [unionId, room] of togetherRooms) {
        if (!room.members.has(userId)) continue
        room.members.delete(userId)
        room.consented.delete(userId)
        try {
          const union = await prisma.union.findUnique({
            where: { id: unionId }, select: { memberAId: true, memberBId: true },
          })
          if (union) broadcastTogetherStatus(unionId, union)
        } catch {}
      }
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
