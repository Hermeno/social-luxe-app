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
}

export const useFeedStore = create<FeedStore>((set) => ({
  pendingPost:    null,
  setPendingPost: (post) => set({ pendingPost: post }),
}))
