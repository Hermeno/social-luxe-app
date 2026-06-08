import { create } from 'zustand'
import { Post } from '../types'

/**
 * Tiny bridge between CreateScreen and FeedScreen.
 * After publishing, CreateScreen pushes the new post here.
 * FeedScreen listens and prepends it immediately.
 */
interface FeedStore {
  pendingPost: Post | null
  setPendingPost: (post: Post | null) => void
  newPostsCount: number
  setNewPostsCount: (count: number) => void
  jumpToPostId: string | null
  setJumpToPostId: (id: string | null) => void
}

export const useFeedStore = create<FeedStore>((set) => ({
  pendingPost:      null,
  setPendingPost:   (post)  => set({ pendingPost: post }),
  newPostsCount:    0,
  setNewPostsCount: (count) => set({ newPostsCount: count }),
  jumpToPostId:     null,
  setJumpToPostId:  (id)    => set({ jumpToPostId: id }),
}))
