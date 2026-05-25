import { api } from './api'
import { ApiResponse } from '../types'

export interface Challenge {
  id: string
  title: string
  description: string
  hashtag: string
  coverUrl: string | null
  endsAt: string
}

export async function getActiveChallenges(): Promise<Challenge[]> {
  const res = await api.get<ApiResponse<Challenge[]>>('/challenges')
  return res.data.data
}
