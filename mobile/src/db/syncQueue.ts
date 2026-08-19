/**
 * SyncQueue — processes offline operations when connectivity is restored.
 *
 * Flow:
 *   1. App offline → operations saved to sync_queue in SQLite
 *   2. Connectivity restored → processQueue() sends them to the API
 *   3. On success → remove from queue
 *   4. On failure → increment retry counter (max 5 retries, then abandon)
 */

import { api } from '../services/api'
import {
  getPendingLikes,
  removePendingLike,
  getPendingSyncOps,
  removeSyncOp,
  incrementSyncRetry,
  cachePosts,
  deleteCachedPost,
} from './database'
import { clearOutboxMedia, type OutboxPost } from './outbox'
import { createPost, createAlbum, setRepost, sendTasteSignal } from '../services/post.service'
import { isConnected } from '../services/netinfo.service'
import { toggleFollow } from '../services/follow.service'

let processingPromise: Promise<void> | null = null

export function processQueue(): Promise<void> {
  if (!isConnected()) return Promise.resolve()
  // Quem chega durante um flush espera o mesmo trabalho. Isto é importante
  // para o refresh não pedir a feed antes de um repost offline terminar.
  if (processingPromise) return processingPromise

  processingPromise = (async () => {
    try {
      await flushLikes()
      await flushGenericQueue()
    } catch (err) {
      console.log('[SyncQueue] Error during flush:', err)
    } finally {
      processingPromise = null
    }
  })()
  return processingPromise
}

// ── Flush pending likes ────────────────────────────────────────────────────────

async function flushLikes(): Promise<void> {
  const pending = await getPendingLikes()
  if (pending.length === 0) return

  console.log(`[SyncQueue] Flushing ${pending.length} pending likes`)

  for (const { postId, liked } of pending) {
    try {
      // `/like` é um ALTERNADOR sem corpo — não aceita o estado desejado. Por
      // isso alterna, lê o que ficou, e alterna outra vez se não bater certo.
      // (Mesma abordagem já usada em `commentLike:update` mais abaixo.)
      const res = await api.post<any>(`/posts/${postId}/like`)
      const got = res.data?.data?.liked ?? res.data?.liked
      if (got !== liked) await api.post(`/posts/${postId}/like`)
      await removePendingLike(postId)
    } catch (err: any) {
      const status: number | undefined = err?.response?.status
      // 4xx não melhora com repetição — o post pode ter sido apagado.
      if (status && status >= 400 && status < 500) await removePendingLike(postId)
      // Erro de rede ou 5xx: fica para a próxima sincronização.
    }
  }
}

// ── Flush generic queue (creates, updates, deletes) ───────────────────────────

async function flushGenericQueue(): Promise<void> {
  const ops = await getPendingSyncOps()
  if (ops.length === 0) return

  console.log(`[SyncQueue] Flushing ${ops.length} pending operations`)

  for (const op of ops) {
    try {
      switch (`${op.entity}:${op.operation}`) {
        // Publicação feita sem rede. O post local já está na cache com o id
        // temporário; aqui envia-se a sério e troca-se o temporário pelo real.
        case 'post:create': {
          const out = op.payload as unknown as OutboxPost
          const real = out.kind === 'album'
            ? await createAlbum(out.mediaUris, out.caption, out.deviceModel)
            : await createPost(
                out.mediaUris[0] ?? null,
                out.mediaType,
                out.caption,
                out.bgColor,
                out.partnerUserId,
                out.isAnnouncement,
                out.deviceModel,
                out.fontKey,
              )
          // Ordem importa: primeiro grava o real, só depois apaga o temporário.
          // Ao contrário, uma falha a meio deixava a feed sem post nenhum.
          if (real) await cachePosts([real], 'synced')
          await deleteCachedPost(out.tempId)
          await clearOutboxMedia(out.mediaUris)
          break
        }
        case 'post:update':
          await api.patch(`/posts/${op.entityId}`, op.payload)
          break
        case 'post:delete':
          await api.delete(`/posts/${op.entityId}`)
          break
        case 'profile:update':
          await api.put('/users/profile', op.payload)
          break
        case 'interests:update':
          await api.put('/users/interests', op.payload)
          break
        case 'business:update':
          await api.put('/users/business', op.payload)
          break
        case 'social:update':
          await api.put('/users/social', op.payload)
          break
        case 'comment:create':
          await api.post(`/posts/${(op.payload as any).postId}/comments`, op.payload)
          break
        case 'comment:update':
          await api.put(`/posts/comments/${op.entityId}`, op.payload)
          break
        case 'comment:delete':
          await api.delete(`/posts/comments/${op.entityId}`)
          break
        // Seguir também é alternável — mesma leitura de volta que o gosto.
        // `entityId` é o utilizador; `payload.following` é o estado pretendido.
        case 'follow:update': {
          const want = (op.payload as any).following as boolean
          const duration = (op.payload as any).duration
          // Pelo serviço, não pela API em cru: só ele sabe que 'forever' não
          // leva corpo. Duplicar essa regra aqui era garantir que divergiam.
          const first = await toggleFollow(op.entityId, duration)
          if (first.following !== want) await toggleFollow(op.entityId, duration)
          break
        }
        // Gosto de comentário é alternável: reenviamos só se o estado no
        // servidor ainda não bate certo com o que o utilizador escolheu.
        case 'commentLike:update': {
          const want = (op.payload as any).liked as boolean
          const res  = await api.post(`/posts/comments/${op.entityId}/like`)
          const got  = res.data?.data?.liked ?? res.data?.liked
          if (got !== want) await api.post(`/posts/comments/${op.entityId}/like`)
          break
        }
        // Repost usa estado explícito (PUT liga / DELETE desliga), portanto é
        // naturalmente idempotente e seguro para repetir depois de uma falha.
        case 'repost:update': {
          const want = (op.payload as any).reposted as boolean
          const result = await setRepost(op.entityId, want)
          if (result.repostedPost) await cachePosts([result.repostedPost], 'synced')
          if (result.removedPostId) await deleteCachedPost(result.removedPostId)
          break
        }
        // O sinal de gosto é a matéria-prima do algoritmo: perder um por não
        // haver rede é perder aprendizagem. O servidor faz upsert por
        // (pessoa, conteúdo), portanto repetir é inofensivo.
        case 'taste:update': {
          const { signal, dwellMs } = op.payload as any
          await sendTasteSignal(op.entityId, signal, dwellMs ?? 0)
          break
        }
        default:
          console.log(`[SyncQueue] Unknown op: ${op.entity}:${op.operation}`)
      }
      await removeSyncOp(op.id)
      console.log(`[SyncQueue] ✓ ${op.entity}:${op.operation} ${op.entityId}`)
    } catch (err: any) {
      const status: number | undefined = err?.response?.status
      if (status && status >= 400 && status < 500) {
        // Client error (404, 403, 409…) — won't succeed on retry, discard immediately
        // Uma publicação recusada tem de levar consigo o post local e os
        // ficheiros copiados, senão ficam a ocupar disco e a feed para sempre.
        if (op.entity === 'post' && op.operation === 'create') {
          const out = op.payload as unknown as OutboxPost
          await deleteCachedPost(out.tempId).catch(() => {})
          await clearOutboxMedia(out.mediaUris ?? []).catch(() => {})
        }
        await removeSyncOp(op.id)
        console.log(`[SyncQueue] ✗ Discarded ${op.entity}:${op.operation} — HTTP ${status}`)
      } else {
        // Network error or 5xx — retry up to limit
        await incrementSyncRetry(op.id)
        console.log(`[SyncQueue] ✗ Retry ${op.retries + 1}/5 for ${op.entity}:${op.operation}`)
      }
    }
  }
}
