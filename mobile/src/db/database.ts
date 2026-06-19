import * as SQLite from 'expo-sqlite'
import { Post, Message, Connection } from '../types'

let db: SQLite.SQLiteDatabase | null = null
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db
  if (initPromise) return initPromise
  initPromise = (async () => {
    // Retry once — on Expo Go reload the previous native DB handle may still be alive,
    // causing the first open to fail. A short pause lets the native side GC the old handle.
    let database: SQLite.SQLiteDatabase
    try {
      database = await SQLite.openDatabaseAsync('luxe.db')
    } catch {
      await new Promise<void>((r) => setTimeout(r, 120))
      database = await SQLite.openDatabaseAsync('luxe.db')
    }
    await database.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Posts cache with sync status
    CREATE TABLE IF NOT EXISTS posts_cache (
      id          TEXT PRIMARY KEY,
      data        TEXT NOT NULL,
      cached_at   INTEGER NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      updated_at  INTEGER
    );

    -- Viewed posts
    CREATE TABLE IF NOT EXISTS viewed_posts (
      post_id   TEXT PRIMARY KEY,
      viewed_at INTEGER NOT NULL
    );

    -- Pending likes (offline queue)
    CREATE TABLE IF NOT EXISTS pending_likes (
      post_id TEXT PRIMARY KEY,
      liked   INTEGER NOT NULL
    );

    -- Media file cache
    CREATE TABLE IF NOT EXISTS media_cache (
      url        TEXT PRIMARY KEY,
      local_path TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      cached_at  INTEGER NOT NULL
    );

    -- Generic sync queue for all offline operations
    CREATE TABLE IF NOT EXISTS sync_queue (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      entity     TEXT NOT NULL,
      entity_id  TEXT NOT NULL,
      operation  TEXT NOT NULL,
      payload    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      retries    INTEGER NOT NULL DEFAULT 0
    );

    -- Sync timestamps (incremental sync: only fetch changed records)
    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Users cache
    CREATE TABLE IF NOT EXISTS users_cache (
      id          TEXT PRIMARY KEY,
      data        TEXT NOT NULL,
      cached_at   INTEGER NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced'
    );

    -- Generic key-value cache (profile, bookmarks, challenges, highlights, groups…)
    CREATE TABLE IF NOT EXISTS generic_cache (
      key       TEXT PRIMARY KEY,
      data      TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    -- Messages cache (one row per message, keyed by conversation partner)
    CREATE TABLE IF NOT EXISTS messages_cache (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      data            TEXT NOT NULL,
      sender_id       TEXT NOT NULL,
      created_at      INTEGER NOT NULL,
      is_pending      INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_msg_convo
      ON messages_cache(conversation_id, created_at);

    -- Connections / inbox cache (one row per conversation partner)
    CREATE TABLE IF NOT EXISTS connections_cache (
      user_id   TEXT PRIMARY KEY,
      data      TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );
  `)

    // Schema migrations — add columns if they don't exist yet
    await database.execAsync(`
      ALTER TABLE posts_cache ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'synced';
    `).catch(() => {})
    await database.execAsync(`
      ALTER TABLE posts_cache ADD COLUMN updated_at INTEGER;
    `).catch(() => {})

    db = database
    return database
  })().catch((err) => {
    initPromise = null
    throw err
  })
  return initPromise
}

// ── Posts cache ────────────────────────────────────────────────────────────────

export async function cachePosts(posts: Post[], status: SyncStatus = 'synced'): Promise<void> {
  const database = await getDb()
  const now = Date.now()
  await database.withTransactionAsync(async () => {
    for (const post of posts) {
      await database.runAsync(
        `INSERT OR REPLACE INTO posts_cache (id, data, cached_at, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [post.id, JSON.stringify(post), now, status, now],
      )
    }
  })
}

export async function getCachedPosts(): Promise<Post[]> {
  const database = await getDb()
  const now = Date.now()
  const rows = await database.getAllAsync<{ data: string }>(
    `SELECT data FROM posts_cache
     WHERE sync_status != 'deleted'
     ORDER BY cached_at DESC LIMIT 100`,
  )
  return rows
    .map((r) => JSON.parse(r.data) as Post)
    .filter((p) => {
      if (!p.expiresAt || (p as any).isAnnouncement) return true
      return new Date(p.expiresAt).getTime() > now
    })
}

export async function purgeExpiredPosts(): Promise<void> {
  const database = await getDb()
  const now = Date.now()
  const rows = await database.getAllAsync<{ id: string; data: string }>(
    `SELECT id, data FROM posts_cache WHERE sync_status = 'synced'`,
  )
  const expiredIds = rows
    .filter((r) => {
      try {
        const p = JSON.parse(r.data) as Post
        if ((p as any).isAnnouncement) return false
        return p.expiresAt && new Date(p.expiresAt).getTime() <= now
      } catch { return false }
    })
    .map((r) => r.id)
  if (expiredIds.length === 0) return
  const ph = expiredIds.map(() => '?').join(',')
  await database.runAsync(`DELETE FROM posts_cache WHERE id IN (${ph})`, expiredIds)
}

export async function updateCachedPost(postId: string, partial: Partial<Post>): Promise<void> {
  const database = await getDb()
  const row = await database.getFirstAsync<{ data: string }>(
    'SELECT data FROM posts_cache WHERE id = ?', [postId],
  )
  if (!row) return
  const post = { ...JSON.parse(row.data), ...partial }
  await database.runAsync(
    `UPDATE posts_cache SET data = ?, sync_status = 'updated', updated_at = ? WHERE id = ?`,
    [JSON.stringify(post), Date.now(), postId],
  )
}

export async function deleteCachedPost(postId: string): Promise<void> {
  const database = await getDb()
  await database.runAsync(
    `UPDATE posts_cache SET sync_status = 'deleted', updated_at = ? WHERE id = ?`,
    [Date.now(), postId],
  )
}

export async function getPendingLocalPostIds(): Promise<Set<string>> {
  const database = await getDb()
  const rows = await database.getAllAsync<{ id: string }>(
    `SELECT id FROM posts_cache WHERE sync_status IN ('pending', 'updated')`,
  )
  return new Set(rows.map((r) => r.id))
}

export async function purgeSyncedDeletes(): Promise<void> {
  const database = await getDb()
  await database.runAsync(`DELETE FROM posts_cache WHERE sync_status = 'deleted'`)
}

export async function clearStaleCache(): Promise<void> {
  const database = await getDb()
  const cutoff = Date.now() - 86400000 // 24h
  await database.runAsync(
    `DELETE FROM posts_cache WHERE cached_at < ? AND sync_status = 'synced'`,
    [cutoff],
  )
  await purgeExpiredPosts()
}

// ── Users cache ────────────────────────────────────────────────────────────────

export async function cacheUser(user: object): Promise<void> {
  const database = await getDb()
  const u = user as any
  await database.runAsync(
    `INSERT OR REPLACE INTO users_cache (id, data, cached_at, sync_status) VALUES (?, ?, ?, 'synced')`,
    [u.id, JSON.stringify(user), Date.now()],
  )
}

export async function getCachedUser(userId: string): Promise<any | null> {
  const database = await getDb()
  const row = await database.getFirstAsync<{ data: string }>(
    'SELECT data FROM users_cache WHERE id = ?', [userId],
  )
  return row ? JSON.parse(row.data) : null
}

// ── Media file cache ───────────────────────────────────────────────────────────

export async function getMediaCacheEntry(url: string): Promise<string | null> {
  const database = await getDb()
  const row = await database.getFirstAsync<{ local_path: string }>(
    'SELECT local_path FROM media_cache WHERE url = ?', [url],
  )
  return row?.local_path ?? null
}

export async function saveMediaCacheEntry(url: string, localPath: string, sizeBytes = 0): Promise<void> {
  const database = await getDb()
  await database.runAsync(
    'INSERT OR REPLACE INTO media_cache (url, local_path, size_bytes, cached_at) VALUES (?, ?, ?, ?)',
    [url, localPath, sizeBytes, Date.now()],
  )
}

export async function deleteMediaCacheEntry(url: string): Promise<void> {
  const database = await getDb()
  await database.runAsync('DELETE FROM media_cache WHERE url = ?', [url])
}

export async function getStaleMediaEntries(maxAgeMs: number): Promise<{ url: string; local_path: string }[]> {
  const database = await getDb()
  const cutoff = Date.now() - maxAgeMs
  return database.getAllAsync<{ url: string; local_path: string }>(
    'SELECT url, local_path FROM media_cache WHERE cached_at < ?', [cutoff],
  )
}

export async function clearAllMediaCache(): Promise<void> {
  const database = await getDb()
  await database.runAsync('DELETE FROM media_cache')
}

// ── Viewed posts ───────────────────────────────────────────────────────────────

export async function markPostViewed(postId: string): Promise<void> {
  const database = await getDb()
  await database.runAsync(
    'INSERT OR IGNORE INTO viewed_posts (post_id, viewed_at) VALUES (?, ?)',
    [postId, Date.now()],
  )
}

export async function getViewedPostIds(): Promise<Set<string>> {
  const database = await getDb()
  const rows = await database.getAllAsync<{ post_id: string }>('SELECT post_id FROM viewed_posts')
  return new Set(rows.map((r) => r.post_id))
}

// ── Pending likes ──────────────────────────────────────────────────────────────

export async function queueLike(postId: string, liked: boolean): Promise<void> {
  const database = await getDb()
  await database.runAsync(
    'INSERT OR REPLACE INTO pending_likes (post_id, liked) VALUES (?, ?)',
    [postId, liked ? 1 : 0],
  )
}

export async function getPendingLikes(): Promise<{ postId: string; liked: boolean }[]> {
  const database = await getDb()
  const rows = await database.getAllAsync<{ post_id: string; liked: number }>('SELECT post_id, liked FROM pending_likes')
  return rows.map((r) => ({ postId: r.post_id, liked: r.liked === 1 }))
}

export async function removePendingLike(postId: string): Promise<void> {
  const database = await getDb()
  await database.runAsync('DELETE FROM pending_likes WHERE post_id = ?', [postId])
}

// ── Sync queue ─────────────────────────────────────────────────────────────────

export type SyncStatus = 'pending' | 'synced' | 'updated' | 'deleted'

export interface SyncQueueItem {
  id: number
  entity: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  payload: object
  createdAt: number
  retries: number
}

export async function enqueueSyncOp(
  entity: string,
  entityId: string,
  operation: 'create' | 'update' | 'delete',
  payload: object,
): Promise<void> {
  const database = await getDb()
  await database.runAsync(
    `INSERT INTO sync_queue (entity, entity_id, operation, payload, created_at, retries)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [entity, entityId, operation, JSON.stringify(payload), Date.now()],
  )
}

export async function getPendingSyncOps(): Promise<SyncQueueItem[]> {
  const database = await getDb()
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM sync_queue WHERE retries < 5 ORDER BY created_at ASC LIMIT 50',
  )
  return rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    entityId: r.entity_id,
    operation: r.operation,
    payload: JSON.parse(r.payload),
    createdAt: r.created_at,
    retries: r.retries,
  }))
}

export async function removeSyncOp(id: number): Promise<void> {
  const database = await getDb()
  await database.runAsync('DELETE FROM sync_queue WHERE id = ?', [id])
}

export async function incrementSyncRetry(id: number): Promise<void> {
  const database = await getDb()
  await database.runAsync('UPDATE sync_queue SET retries = retries + 1 WHERE id = ?', [id])
}

// ── Sync meta (last sync timestamps) ──────────────────────────────────────────

export async function getSyncMeta(key: string): Promise<string | null> {
  const database = await getDb()
  const row = await database.getFirstAsync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', [key])
  return row?.value ?? null
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const database = await getDb()
  await database.runAsync('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', [key, value])
}

// ── Generic key-value cache ────────────────────────────────────────────────────
// Use for any JSON data: profile:{id}, bookmarks, challenges, highlights:{id}, etc.

export async function getCache<T>(key: string): Promise<T | null> {
  const database = await getDb()
  const row = await database.getFirstAsync<{ data: string }>(
    'SELECT data FROM generic_cache WHERE key = ?', [key],
  )
  return row ? (JSON.parse(row.data) as T) : null
}

export async function setCache<T>(key: string, value: T): Promise<void> {
  const database = await getDb()
  await database.runAsync(
    'INSERT OR REPLACE INTO generic_cache (key, data, cached_at) VALUES (?, ?, ?)',
    [key, JSON.stringify(value), Date.now()],
  )
}

// ── Messages cache ─────────────────────────────────────────────────────────────

export async function cacheMessages(conversationId: string, messages: Message[]): Promise<void> {
  if (messages.length === 0) return
  const database = await getDb()
  await database.withTransactionAsync(async () => {
    for (const msg of messages) {
      await database.runAsync(
        `INSERT OR REPLACE INTO messages_cache
           (id, conversation_id, data, sender_id, created_at, is_pending)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [msg.id, conversationId, JSON.stringify(msg), msg.senderId, new Date(msg.createdAt).getTime()],
      )
    }
  })
}

export async function getCachedMessages(conversationId: string): Promise<Message[]> {
  const database = await getDb()
  const rows = await database.getAllAsync<{ data: string }>(
    `SELECT data FROM messages_cache
     WHERE conversation_id = ?
     ORDER BY created_at ASC`,
    [conversationId],
  )
  return rows.map((r) => JSON.parse(r.data) as Message)
}

export async function upsertCachedMessage(conversationId: string, msg: Message): Promise<void> {
  const database = await getDb()
  await database.runAsync(
    `INSERT OR REPLACE INTO messages_cache
       (id, conversation_id, data, sender_id, created_at, is_pending)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [msg.id, conversationId, JSON.stringify(msg), msg.senderId, new Date(msg.createdAt).getTime()],
  )
}

export async function replacePendingMessage(tempId: string, real: Message, conversationId: string): Promise<void> {
  const database = await getDb()
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM messages_cache WHERE id = ?', [tempId])
    await database.runAsync(
      `INSERT OR REPLACE INTO messages_cache
         (id, conversation_id, data, sender_id, created_at, is_pending)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [real.id, conversationId, JSON.stringify(real), real.senderId, new Date(real.createdAt).getTime()],
    )
  })
}

// ── Connections / inbox cache ──────────────────────────────────────────────────

export async function cacheConnections(connections: Connection[]): Promise<void> {
  if (connections.length === 0) return
  const database = await getDb()
  const now = Date.now()
  await database.withTransactionAsync(async () => {
    for (const conn of connections) {
      await database.runAsync(
        `INSERT OR REPLACE INTO connections_cache (user_id, data, cached_at) VALUES (?, ?, ?)`,
        [conn.user.id, JSON.stringify(conn), now],
      )
    }
  })
}

export async function getCachedConnections(): Promise<Connection[]> {
  const database = await getDb()
  const rows = await database.getAllAsync<{ data: string }>(
    // Sort by last message time descending (most recent conversation first)
    `SELECT data FROM connections_cache
     ORDER BY json_extract(data, '$.lastMessage.createdAt') DESC NULLS LAST`,
  )
  return rows.map((r) => JSON.parse(r.data) as Connection)
}

export async function updateCachedConnection(
  userId: string,
  partial: Partial<Connection>,
  fallback?: Partial<Connection>,
): Promise<void> {
  const database = await getDb()
  const row = await database.getFirstAsync<{ data: string }>(
    'SELECT data FROM connections_cache WHERE user_id = ?', [userId],
  )
  // If no existing entry, seed from fallback (or minimal default)
  const existing: Connection = row
    ? JSON.parse(row.data)
    : { user: { id: userId, name: '', avatar: null }, postIds: [], unreadCount: 0, lastMessage: null, ...fallback }
  const updated = { ...existing, ...partial }
  await database.runAsync(
    `INSERT OR REPLACE INTO connections_cache (user_id, data, cached_at) VALUES (?, ?, ?)`,
    [userId, JSON.stringify(updated), Date.now()],
  )
}

// ── Full local wipe (on logout) ───────────────────────────────────────────────

export async function clearAllLocalData(): Promise<void> {
  const database = await getDb()
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM posts_cache')
    await database.runAsync('DELETE FROM viewed_posts')
    await database.runAsync('DELETE FROM pending_likes')
    await database.runAsync('DELETE FROM media_cache')
    await database.runAsync('DELETE FROM sync_queue')
    await database.runAsync('DELETE FROM sync_meta')
    await database.runAsync('DELETE FROM users_cache')
    await database.runAsync('DELETE FROM messages_cache')
    await database.runAsync('DELETE FROM connections_cache')
    await database.runAsync('DELETE FROM generic_cache')
  })
}
