import type { MediaType, TasteSignal } from '@prisma/client'

const DAY_MS = 24 * 60 * 60 * 1000
const TASTE_HALF_LIFE_MS = 30 * DAY_MS
const TASTE_SHRINKAGE = 2
const TASTE_RANK_CHUNK = 4

export const TASTE_HISTORY_WINDOW_MS = 90 * DAY_MS
export const TASTE_HISTORY_LIMIT = 200

export interface TasteFeedbackRow {
  postId: string
  authorId: string
  mediaType: MediaType
  signal: TasteSignal
  dwellMs: number | null
  createdAt: Date
}

export interface TasteProfile {
  byAuthor: ReadonlyMap<string, number>
  byMediaType: ReadonlyMap<MediaType, number>
}

interface AffinityAccumulator {
  signed: number
  magnitude: number
}

interface TasteRankablePost {
  userId: string
  mediaType: MediaType
  isAnnouncement?: boolean | null
  repostOriginalAuthorId?: string | null
}

function addAffinity<K>(
  accumulators: Map<K, AffinityAccumulator>,
  key: K,
  signedWeight: number,
  magnitude: number,
): void {
  const current = accumulators.get(key) ?? { signed: 0, magnitude: 0 }
  current.signed += signedWeight
  current.magnitude += magnitude
  accumulators.set(key, current)
}

function finishAffinities<K>(accumulators: Map<K, AffinityAccumulator>): Map<K, number> {
  const affinities = new Map<K, number>()
  for (const [key, value] of accumulators) {
    // The prior keeps one answer from becoming a permanent verdict. Repeated,
    // recent answers gradually approach -1/+1 without ever exceeding it.
    affinities.set(key, value.signed / (value.magnitude + TASTE_SHRINKAGE))
  }
  return affinities
}

/**
 * Turns recent explicit MORE/LESS answers into small, decaying affinities.
 *
 * The client clock only supplies `dwellMs`, so it is deliberately a narrow
 * confidence adjustment (75-100%), never the main source of ranking power.
 */
export function buildTasteProfile(
  rows: readonly TasteFeedbackRow[],
  now: Date,
): TasteProfile {
  const authors = new Map<string, AffinityAccumulator>()
  const mediaTypes = new Map<MediaType, AffinityAccumulator>()
  const nowMs = now.getTime()

  for (const row of rows) {
    const createdAtMs = row.createdAt.getTime()
    if (!Number.isFinite(createdAtMs)) continue
    const ageMs = Math.max(0, nowMs - createdAtMs)
    if (ageMs > TASTE_HISTORY_WINDOW_MS) continue

    const recency = Math.pow(0.5, ageMs / TASTE_HALF_LIFE_MS)
    const dwell = Math.max(0, row.dwellMs ?? 0)
    const dwellConfidence = 0.75 + 0.25 * Math.min(1, dwell / 15_000)
    const magnitude = recency * dwellConfidence
    const direction = row.signal === 'MORE' ? 1 : -1
    const signedWeight = direction * magnitude

    addAffinity(authors, row.authorId, signedWeight, magnitude)
    addAffinity(mediaTypes, row.mediaType, signedWeight, magnitude)
  }

  return {
    byAuthor: finishAffinities(authors),
    byMediaType: finishAffinities(mediaTypes),
  }
}

function tasteScore(post: TasteRankablePost, profile: TasteProfile): number {
  // A repost is ranked by the content's author, not by the account that copied
  // it into the feed. `attachPostMeta` supplies this canonical author first.
  const authorId = post.repostOriginalAuthorId ?? post.userId
  const authorAffinity = profile.byAuthor.get(authorId) ?? 0
  const mediaAffinity = profile.byMediaType.get(post.mediaType) ?? 0
  return authorAffinity * 0.7 + mediaAffinity * 0.3
}

function rankChunk<T extends TasteRankablePost>(
  posts: readonly T[],
  profile: TasteProfile,
): T[] {
  return posts
    .map((post, index) => ({ post, index, score: tasteScore(post, profile) }))
    .sort((left, right) => {
      const scoreDelta = right.score - left.score
      return scoreDelta !== 0 ? scoreDelta : left.index - right.index
    })
    .map(({ post }) => post)
}

/**
 * Reorders only the already-paginated fresh page. Normal posts can move at
 * most three places inside a chronological chunk; announcements split chunks
 * and retain their exact position. No item is filtered or duplicated.
 */
export function rankFreshPageByTaste<T extends TasteRankablePost>(
  posts: readonly T[],
  profile: TasteProfile,
): T[] {
  const ranked: T[] = []
  let chunk: T[] = []

  const flush = () => {
    if (chunk.length === 0) return
    ranked.push(...rankChunk(chunk, profile))
    chunk = []
  }

  for (const post of posts) {
    if (post.isAnnouncement) {
      flush()
      ranked.push(post)
      continue
    }
    chunk.push(post)
    if (chunk.length === TASTE_RANK_CHUNK) flush()
  }
  flush()

  return ranked
}
