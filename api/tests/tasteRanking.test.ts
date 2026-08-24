import { MediaType, TasteSignal } from '@prisma/client'
import {
  buildTasteProfile,
  rankFreshPageByTaste,
  TASTE_HISTORY_WINDOW_MS,
  type TasteFeedbackRow,
  type TasteProfile,
} from '../src/services/tasteRanking'

const NOW = new Date('2026-08-24T09:00:00.000Z')

function feedback(
  overrides: Partial<TasteFeedbackRow> & Pick<TasteFeedbackRow, 'authorId' | 'signal'>,
): TasteFeedbackRow {
  return {
    postId: `${overrides.authorId}-${overrides.signal}`,
    mediaType: MediaType.IMAGE,
    dwellMs: 15_000,
    createdAt: NOW,
    ...overrides,
  }
}

function profile(authors: Array<[string, number]>): TasteProfile {
  return {
    byAuthor: new Map(authors),
    byMediaType: new Map(),
  }
}

function post(
  id: string,
  userId: string,
  overrides: Partial<{
    mediaType: MediaType
    isAnnouncement: boolean
    repostOriginalAuthorId: string | null
  }> = {},
) {
  return {
    id,
    userId,
    mediaType: MediaType.IMAGE,
    isAnnouncement: false,
    repostOriginalAuthorId: null,
    ...overrides,
  }
}

describe('Taste feed ranking', () => {
  it('decays feedback, shrinks sparse answers and ignores rows outside 90 days', () => {
    const rows = [
      feedback({ authorId: 'recent-more', signal: TasteSignal.MORE }),
      feedback({
        authorId: 'month-old-more',
        signal: TasteSignal.MORE,
        createdAt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000),
      }),
      feedback({
        authorId: 'expired-less',
        signal: TasteSignal.LESS,
        createdAt: new Date(NOW.getTime() - TASTE_HISTORY_WINDOW_MS - 1),
      }),
    ]

    const result = buildTasteProfile(rows, NOW)

    expect(result.byAuthor.get('recent-more')).toBeCloseTo(1 / 3, 6)
    expect(result.byAuthor.get('month-old-more')).toBeCloseTo(0.5 / 2.5, 6)
    expect(result.byAuthor.has('expired-less')).toBe(false)
  })

  it('ranks stably inside four-post chunks while announcements remain anchors', () => {
    const original = [
      post('neutral-1', 'neutral-1'),
      post('avoid-1', 'avoid'),
      post('fav-1', 'fav'),
      post('neutral-2', 'neutral-2'),
      post('announcement', 'fav', { isAnnouncement: true }),
      post('avoid-2', 'avoid'),
      post('fav-2', 'fav'),
    ]

    const ranked = rankFreshPageByTaste(original, profile([
      ['fav', 1],
      ['avoid', -1],
    ]))

    expect(ranked.map(({ id }) => id)).toEqual([
      'fav-1', 'neutral-1', 'neutral-2', 'avoid-1',
      'announcement',
      'fav-2', 'avoid-2',
    ])
    expect(ranked[4].id).toBe('announcement')
    expect(original.map(({ id }) => id)).toEqual([
      'neutral-1', 'avoid-1', 'fav-1', 'neutral-2',
      'announcement', 'avoid-2', 'fav-2',
    ])
  })

  it('never lets a preferred post cross a chronological chunk boundary', () => {
    const original = Array.from({ length: 8 }, (_, index) => (
      post(`post-${index + 1}`, index === 7 ? 'fav' : `neutral-${index + 1}`)
    ))

    const ranked = rankFreshPageByTaste(original, profile([['fav', 1]]))

    expect(ranked.slice(0, 4).map(({ id }) => id)).toEqual([
      'post-1', 'post-2', 'post-3', 'post-4',
    ])
    expect(ranked[4].id).toBe('post-8')
  })

  it('uses the canonical author for reposts and never removes LESS candidates', () => {
    const original = [
      post('ordinary', 'ordinary'),
      post('copy', 'reposter', { repostOriginalAuthorId: 'fav' }),
      post('less', 'avoid'),
    ]

    const ranked = rankFreshPageByTaste(original, profile([
      ['fav', 1],
      ['avoid', -1],
    ]))

    expect(ranked.map(({ id }) => id)).toEqual(['copy', 'ordinary', 'less'])
    expect(new Set(ranked.map(({ id }) => id))).toEqual(new Set(original.map(({ id }) => id)))
    expect(ranked).toHaveLength(original.length)
  })
})
