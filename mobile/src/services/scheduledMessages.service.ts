import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'

export interface ScheduledMessage {
  id: string
  receiverId: string
  receiverName: string
  content: string
  scheduledAt: string // ISO
  sent: boolean
  cancelled?: boolean
  cancelReason?: string
  createdAt: string
}

const KEY = '@lux_scheduled_msgs_v1'

async function load(): Promise<ScheduledMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

async function persist(msgs: ScheduledMessage[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(msgs)) } catch {}
}

export async function getFor(receiverId: string): Promise<ScheduledMessage[]> {
  const all = await load()
  return all.filter((m) => !m.sent && !m.cancelled && m.receiverId === receiverId)
}

export async function getDue(receiverId?: string): Promise<ScheduledMessage[]> {
  const all = await load()
  const now = Date.now()
  return all.filter((m) =>
    !m.sent &&
    !m.cancelled &&
    new Date(m.scheduledAt).getTime() <= now &&
    (!receiverId || m.receiverId === receiverId),
  )
}

export async function add(
  receiverId: string,
  receiverName: string,
  content: string,
  scheduledAt: Date,
): Promise<ScheduledMessage> {
  const all = await load()
  const id = `sm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  const seconds = Math.max(5, Math.floor((scheduledAt.getTime() - Date.now()) / 1000))
  try {
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') await Notifications.requestPermissionsAsync()
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: `📬 Mensagem para ${receiverName}`,
        body: content.length > 60 ? content.slice(0, 60) + '…' : content,
        data: { type: 'scheduled_message', id, receiverId },
      },
      trigger: { seconds } as any,
    })
  } catch {}

  const msg: ScheduledMessage = {
    id, receiverId, receiverName, content,
    scheduledAt: scheduledAt.toISOString(),
    sent: false,
    createdAt: new Date().toISOString(),
  }
  await persist([...all, msg])
  return msg
}

export async function markSent(id: string): Promise<void> {
  const all = await load()
  await persist(all.map((m) => (m.id === id ? { ...m, sent: true } : m)))
  try { await Notifications.cancelScheduledNotificationAsync(id) } catch {}
}

export async function markCancelled(id: string, reason?: string): Promise<void> {
  const all = await load()
  await persist(all.map((m) => (m.id === id ? { ...m, cancelled: true, cancelReason: reason } : m)))
  try { await Notifications.cancelScheduledNotificationAsync(id) } catch {}
}

export async function cancel(id: string): Promise<void> {
  const all = await load()
  await persist(all.filter((m) => m.id !== id))
  try { await Notifications.cancelScheduledNotificationAsync(id) } catch {}
}

export async function cleanup(): Promise<void> {
  const all = await load()
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000
  await persist(
    all.filter((m) =>
      (!m.sent && !m.cancelled) || new Date(m.createdAt).getTime() > cutoff,
    ),
  )
}
