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
  jumpToPostId: string | null
  setJumpToPostId: (id: string | null) => void
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
}

export const useFeedStore = create<FeedStore>((set) => ({
  pendingPost:      null,
  setPendingPost:   (post)  => set({ pendingPost: post }),
  newPostsCount:    0,
  setNewPostsCount: (count) => set({ newPostsCount: count }),
  jumpToPostId:     null,
  setJumpToPostId:  (id)    => set({ jumpToPostId: id }),
  openSearch:       false,
  setOpenSearch:    (v)     => set({ openSearch: v }),
  homeTap:          0,
  bumpHomeTap:      ()      => set((s) => ({ homeTap: s.homeTap + 1 })),
  activeCommentTarget: null,
  setActiveCommentTarget: (target) => set({ activeCommentTarget: target }),
  requestedCommentPostId: null,
  requestComments: (postId) => set({ requestedCommentPostId: postId }),
  clearCommentRequest: () => set({ requestedCommentPostId: null }),
}))
