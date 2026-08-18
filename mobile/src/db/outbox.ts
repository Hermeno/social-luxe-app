/**
 * Outbox — publicações feitas sem rede.
 *
 * O problema que isto resolve: o URI que a galeria devolve aponta para a pasta
 * de cache da app, que o sistema operativo pode limpar a qualquer momento. Se
 * enfileirássemos esse URI, a publicação podia chegar à hora do envio sem
 * ficheiro nenhum. Por isso copiamos a media para `documentDirectory`, que só
 * nós apagamos, e é essa cópia que fica na fila.
 */
import * as FileSystem from 'expo-file-system/legacy'
import type { Post } from '../types'

const OUTBOX_DIR = `${FileSystem.documentDirectory}luxe_outbox/`

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(OUTBOX_DIR)
  if (!info.exists) await FileSystem.makeDirectoryAsync(OUTBOX_DIR, { intermediates: true })
}

/** Copia a media para um sítio durável e devolve o novo URI. */
export async function persistOutboxMedia(uri: string, tempId: string, index = 0): Promise<string> {
  await ensureDir()
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg'
  const dest = `${OUTBOX_DIR}${tempId}_${index}.${ext}`
  await FileSystem.copyAsync({ from: uri, to: dest })
  return dest
}

/** Apaga as cópias de uma publicação já enviada (ou desistida). */
export async function clearOutboxMedia(uris: string[]): Promise<void> {
  await Promise.all(
    uris
      .filter((u) => u.startsWith(OUTBOX_DIR))
      .map((u) => FileSystem.deleteAsync(u, { idempotent: true }).catch(() => {})),
  )
}

/** Payload guardado na fila para `post:create`. */
export interface OutboxPost {
  tempId: string
  kind: 'text' | 'media' | 'album'
  /** URIs já duráveis (vazio em publicações de texto). */
  mediaUris: string[]
  mediaType: 'IMAGE' | 'VIDEO' | 'TEXT'
  caption?: string
  bgColor?: string
  /** Publicação de texto: chave da fonte escolhida no compositor. */
  fontKey?: string
  partnerUserId?: string
  isAnnouncement?: boolean
  deviceModel?: string
}

const LOCAL_PREFIX = 'local-'

export function makeTempPostId(): string {
  return `${LOCAL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function isTempPostId(id: string): boolean {
  return id.startsWith(LOCAL_PREFIX)
}

/**
 * Constrói o post que a feed mostra enquanto o verdadeiro não existe.
 * Os contadores começam a zero e o prazo é o mesmo que o servidor aplicaria.
 */
export function buildLocalPost(
  outbox: OutboxPost,
  author: Post['user'],
): Post {
  const now = new Date()
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const first = outbox.mediaUris[0] ?? null

  return {
    id: outbox.tempId,
    userId: author.id,
    mediaUrl: first,
    mediaUrls: outbox.kind === 'album' ? outbox.mediaUris : undefined,
    thumbnailUrl: first ?? '',
    mediaType: outbox.mediaType,
    caption: outbox.caption ?? null,
    bgColor: outbox.bgColor ?? null,
    fontKey: outbox.fontKey ?? null,
    expiresAt: expires.toISOString(),
    extended: false,
    deviceModel: outbox.deviceModel ?? null,
    createdAt: now.toISOString(),
    partnerUserId: outbox.partnerUserId ?? null,
    isAnnouncement: outbox.isAnnouncement ?? false,
    user: author,
    _count: { likes: 0, comments: 0, shares: 0, reposts: 0, views: 0 },
  }
}
