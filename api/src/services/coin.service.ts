import { prisma } from '../config/database'
import { sendPush } from './notification.service'

export async function getBalance(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coinBalance: true },
  })
  if (!user) throw new Error('User not found')
  return { coinBalance: user.coinBalance }
}

export async function getHistory(userId: string) {
  return prisma.luxeCoin.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
      receiver: { select: { id: true, name: true, avatar: true } },
      post: { select: { id: true, mediaUrl: true, mediaType: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function sendCoins(
  senderId: string,
  receiverId: string,
  amount: number,
  postId?: string,
  message?: string,
) {
  if (amount <= 0) throw new Error('Amount must be positive')
  if (senderId === receiverId) throw new Error('Cannot send coins to yourself')

  const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { coinBalance: true, name: true } })
  if (!sender) throw new Error('Sender not found')
  if (sender.coinBalance < amount) throw new Error('Insufficient coin balance')

  const receiver = await prisma.user.findUnique({ where: { id: receiverId } })
  if (!receiver) throw new Error('Receiver not found')

  const [, , coin] = await prisma.$transaction([
    prisma.user.update({
      where: { id: senderId },
      data: { coinBalance: { decrement: amount } },
    }),
    prisma.user.update({
      where: { id: receiverId },
      data: { coinBalance: { increment: amount } },
    }),
    prisma.luxeCoin.create({
      data: { senderId, receiverId, amount, postId, message },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
    }),
  ])

  await sendPush(
    receiverId,
    'You received Luxe Coins!',
    `${sender.name} sent you ${amount} coin${amount !== 1 ? 's' : ''}${message ? `: ${message}` : ''}`,
    { coinId: coin.id, senderId, amount },
  )

  return coin
}
