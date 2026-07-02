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

// ── Live Chat Pair — automatic 1:1 presence + opt-in follower broadcast ───────
type DmPair = {
  members:   Set<string>          // userId → has this DM chat open right now
  consented: Map<string, boolean> // userId → agreed to share with followers
}
const dmPairs = new Map<string, DmPair>()

const LIVE_CHAT_TITLES = [
  'os dois estão a conversar agora',
  'os dois estão namorando',
  'estão a viver um romance',
]

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function getOrCreateDmPair(key: string): DmPair {
  if (!dmPairs.has(key)) dmPairs.set(key, { members: new Set(), consented: new Map() })
  return dmPairs.get(key)!
}

async function emitDmLive(userAId: string, userBId: string) {
  const [profA, profB] = await Promise.all([
    prisma.user.findUnique({ where: { id: userAId }, select: { name: true, avatar: true } }),
    prisma.user.findUnique({ where: { id: userBId }, select: { name: true, avatar: true } }),
  ])
  if (!profA || !profB) return null
  const title = LIVE_CHAT_TITLES[Math.floor(Math.random() * LIVE_CHAT_TITLES.length)]
  const payload = {
    userAId, userAName: profA.name, userAAvatar: profA.avatar,
    userBId, userBName: profB.name, userBAvatar: profB.avatar,
    title,
  }
  io.to(userAId).emit('dm:live:status', payload)
  io.to(userBId).emit('dm:live:status', payload)
  return payload
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

    // ── Live Chat Pair ─────────────────────────────────────────────────────────

    // Either user opened a normal 1:1 chat screen
    socket.on('dm:chat:enter', ({ otherUserId }: { otherUserId: string }) => {
      const key = pairKey(userId, otherUserId)
      const pair = getOrCreateDmPair(key)
      pair.members.add(userId)
      if (pair.members.has(otherUserId)) {
        emitDmLive(userId, otherUserId).catch(() => {})
      }
    })

    // Either user closed / backgrounded / left the chat screen
    socket.on('dm:chat:leave', async ({ otherUserId }: { otherUserId: string }) => {
      const key = pairKey(userId, otherUserId)
      const pair = dmPairs.get(key)
      if (!pair) return

      const wasLive   = pair.members.has(userId) && pair.members.has(otherUserId)
      const wasPublic = wasLive && pair.consented.get(userId) === true && pair.consented.get(otherUserId) === true

      pair.members.delete(userId)
      pair.consented.delete(userId)

      if (wasLive) {
        const endPayload = { userAId: userId, userBId: otherUserId }
        io.to(userId).emit('dm:live:ended', endPayload)
        io.to(otherUserId).emit('dm:live:ended', endPayload)

        if (wasPublic) {
          try {
            const followers = await prisma.follow.findMany({
              where:  { followingId: { in: [userId, otherUserId] } },
              select: { followerId: true },
            })
            const unique = [...new Set(followers.map((f) => f.followerId))]
              .filter((id) => id !== userId && id !== otherUserId)
            unique.forEach((fId) => emitToUser(fId, 'dm:live:public:ended', endPayload))
          } catch {}
        }
      }
      if (pair.members.size === 0) dmPairs.delete(key)
    })

    // Either user opts in to sharing this live chat with their followers
    socket.on('dm:live:consent', async ({ otherUserId, consent }: { otherUserId: string; consent: boolean }) => {
      const key = pairKey(userId, otherUserId)
      const pair = dmPairs.get(key)
      if (!pair) return
      pair.consented.set(userId, consent)

      const bothPresent   = pair.members.has(userId) && pair.members.has(otherUserId)
      const bothConsented = pair.consented.get(userId) === true && pair.consented.get(otherUserId) === true
      if (!bothPresent || !bothConsented) return

      try {
        const payload = await emitDmLive(userId, otherUserId)
        if (!payload) return
        const followers = await prisma.follow.findMany({
          where:  { followingId: { in: [userId, otherUserId] } },
          select: { followerId: true },
        })
        const unique = [...new Set(followers.map((f) => f.followerId))]
          .filter((id) => id !== userId && id !== otherUserId)
        unique.forEach((fId) => emitToUser(fId, 'dm:live:public', payload))
      } catch {}
    })

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      onlineUsers.delete(userId)
      io.emit('user:offline', { userId })

      // Clean up any live chat pairs this user was in
      for (const [key, pair] of [...dmPairs]) {
        if (!pair.members.has(userId)) continue
        const otherId = [...pair.members].find((id) => id !== userId)
        const wasPublic = !!otherId && pair.consented.get(userId) === true && pair.consented.get(otherId) === true
        pair.members.delete(userId)
        pair.consented.delete(userId)
        if (otherId) {
          const endPayload = { userAId: userId, userBId: otherId }
          io.to(otherId).emit('dm:live:ended', endPayload)
          if (wasPublic) {
            prisma.follow.findMany({
              where:  { followingId: { in: [userId, otherId] } },
              select: { followerId: true },
            }).then((followers) => {
              const unique = [...new Set(followers.map((f) => f.followerId))]
                .filter((id) => id !== userId && id !== otherId)
              unique.forEach((fId) => emitToUser(fId, 'dm:live:public:ended', endPayload))
            }).catch(() => {})
          }
        }
        if (pair.members.size === 0) dmPairs.delete(key)
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
