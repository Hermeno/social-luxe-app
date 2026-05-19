import { useState, useCallback } from 'react'
import { Comment } from '../types'
import * as postService from '../services/post.service'

export function useComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await postService.getComments(postId)
      setComments(data)
    } catch {}
    finally { setLoading(false) }
  }, [postId])

  const send = useCallback(async (content: string, parentId?: string) => {
    if (!content.trim()) return
    setSending(true)
    try {
      const comment = await postService.addComment(postId, content, parentId)
      setComments((prev) => [comment, ...prev])
    } catch {}
    finally { setSending(false) }
  }, [postId])

  return { comments, loading, sending, load, send }
}
