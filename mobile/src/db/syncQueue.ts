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
} from './database'
import { isConnected } from '../services/netinfo.service'

let processing = false

export async function processQueue(): Promise<void> {
  if (processing || !isConnected()) return
  processing = true

  try {
    await flushLikes()
    await flushGenericQueue()
  } catch (err) {
    console.log('[SyncQueue] Error during flush:', err)
  } finally {
    processing = false
  }
}

// ── Flush pending likes ────────────────────────────────────────────────────────

async function flushLikes(): Promise<void> {
  const pending = await getPendingLikes()
  if (pending.length === 0) return

  console.log(`[SyncQueue] Flushing ${pending.length} pending likes`)

  for (const { postId, liked } of pending) {
    try {
      await api.post(`/posts/${postId}/like`, { liked })
      await removePendingLike(postId)
    } catch {
      // Keep in queue for next sync
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
        case 'post:create':
          // Posts are sent via CreateScreen directly — nothing to do, discard
          break
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
        // Gosto de comentário é alternável: reenviamos só se o estado no
        // servidor ainda não bate certo com o que o utilizador escolheu.
        case 'commentLike:update': {
          const want = (op.payload as any).liked as boolean
          const res  = await api.post(`/posts/comments/${op.entityId}/like`)
          const got  = res.data?.data?.liked ?? res.data?.liked
          if (got !== want) await api.post(`/posts/comments/${op.entityId}/like`)
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
