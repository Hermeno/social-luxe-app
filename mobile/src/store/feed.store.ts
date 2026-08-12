import { create } from 'zustand'
import { Post } from '../types'

export interface FeedCommentTarget {
  postId: string
  authorId: string
  authorName: string
}

/** Shared signals between the feed and controls rendered outside its screen. */
interface FeedStore {
  pendingPost: Post | null
  setPendingPost: (post: Post | null) => void
  newPostsCount: number
  setNewPostsCount: (count: number) => void
  /**
   * Post aberto a partir de outro ecrã. Fica apenas em memória: a Feed mostra-o
   * no topo sem o misturar com o cache offline.
   */
  focusedPost: Post | null
  focusedPostRequest: number
  showPostInFeed: (post: Post) => void
  clearFocusedPost: () => void
  openSearch: boolean
  setOpenSearch: (v: boolean) => void
  // Tocar em Home (já no feed) refresca: incrementa este sinal, o feed reage.
  homeTap: number
  bumpHomeTap: () => void
  // Ponte mínima entre o post visível e o campo de comentário na TabBar.
  activeCommentTarget: FeedCommentTarget | null
  setActiveCommentTarget: (target: FeedCommentTarget | null) => void
  requestedCommentPostId: string | null
  requestComments: (postId: string) => void
  clearCommentRequest: () => void
  reset: () => void
}

const initialFeedState = {
  pendingPost: null,
  newPostsCount: 0,
  focusedPost: null,
  focusedPostRequest: 0,
  openSearch: false,
  homeTap: 0,
  activeCommentTarget: null,
  requestedCommentPostId: null,
} satisfies Pick<
  FeedStore,
  | 'pendingPost'
  | 'newPostsCount'
  | 'focusedPost'
  | 'focusedPostRequest'
  | 'openSearch'
  | 'homeTap'
  | 'activeCommentTarget'
  | 'requestedCommentPostId'
>

export const useFeedStore = create<FeedStore>((set) => ({
  ...initialFeedState,
  setPendingPost:   (post)  => set({ pendingPost: post }),
  setNewPostsCount: (count) => set({ newPostsCount: count }),
  showPostInFeed: (post) => set((s) => ({
    focusedPost: post,
    focusedPostRequest: s.focusedPostRequest + 1,
  })),
  clearFocusedPost: () => set({ focusedPost: null }),
  setOpenSearch:    (v)     => set({ openSearch: v }),
  bumpHomeTap:      ()      => set((s) => ({ homeTap: s.homeTap + 1 })),
  setActiveCommentTarget: (target) => set({ activeCommentTarget: target }),
  requestComments: (postId) => set({ requestedCommentPostId: postId }),
  clearCommentRequest: () => set({ requestedCommentPostId: null }),
  reset: () => set(initialFeedState),
}))
