import { Expo, ExpoPushMessage } from 'expo-server-sdk'
import { prisma } from '../config/database'

const expo = new Expo()

export async function sendPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const tokens = await prisma.deviceToken.findMany({ where: { userId } })
  if (tokens.length === 0) return

  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t.token))
    .map((t) => ({
      to: t.token,
      sound: 'default' as const,
      title,
      body,
      data: data ?? {},
    }))

  if (messages.length === 0) return

  const chunks = expo.chunkPushNotifications(messages)
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk)
    } catch {
      // log but don't throw — push failures are non-critical
    }
  }
}

export async function registerToken(userId: string, token: string, platform: string): Promise<void> {
  await prisma.deviceToken.upsert({
    where: { userId_token: { userId, token } },
    update: { platform },
    create: { userId, token, platform },
  })
}
