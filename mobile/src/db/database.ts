import * as SQLite from 'expo-sqlite'
import { Post } from '../types'

let db: SQLite.SQLiteDatabase | null = null

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db
  db = await SQLite.openDatabaseAsync('luxe.db')
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS posts_cache (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS viewed_posts (
      post_id TEXT PRIMARY KEY,
      viewed_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_likes (
      post_id TEXT PRIMARY KEY,
      liked INTEGER NOT NULL
    );
  `)
  return db
}

// ── Posts cache ────────────────────────────────────────────────────────────────

export async function cachePosts(posts: Post[]): Promise<void> {
  const database = await getDb()
  const now = Date.now()
  await database.withTransactionAsync(async () => {
    for (const post of posts) {
      await database.runAsync(
        'INSERT OR REPLACE INTO posts_cache (id, data, cached_at) VALUES (?, ?, ?)',
        [post.id, JSON.stringify(post), now],
      )
    }
  })
}

export async function getCachedPosts(): Promise<Post[]> {
  const database = await getDb()
  const rows = await database.getAllAsync<{ data: string }>(
    'SELECT data FROM posts_cache ORDER BY cached_at DESC LIMIT 100',
  )
  return rows.map((r) => JSON.parse(r.data) as Post)
}

export async function clearStaleCache(): Promise<void> {
  const database = await getDb()
  // Remove posts cached more than 24h ago
  const cutoff = Date.now() - 86400000
  await database.runAsync('DELETE FROM posts_cache WHERE cached_at < ?', [cutoff])
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
  const rows = await database.getAllAsync<{ post_id: string }>(
    'SELECT post_id FROM viewed_posts',
  )
  return new Set(rows.map((r) => r.post_id))
}

// ── Pending likes (offline queue) ─────────────────────────────────────────────

export async function queueLike(postId: string, liked: boolean): Promise<void> {
  const database = await getDb()
  await database.runAsync(
    'INSERT OR REPLACE INTO pending_likes (post_id, liked) VALUES (?, ?)',
    [postId, liked ? 1 : 0],
  )
}

export async function getPendingLikes(): Promise<{ postId: string; liked: boolean }[]> {
  const database = await getDb()
  const rows = await database.getAllAsync<{ post_id: string; liked: number }>(
    'SELECT post_id, liked FROM pending_likes',
  )
  return rows.map((r) => ({ postId: r.post_id, liked: r.liked === 1 }))
}

export async function removePendingLike(postId: string): Promise<void> {
  const database = await getDb()
  await database.runAsync('DELETE FROM pending_likes WHERE post_id = ?', [postId])
}
