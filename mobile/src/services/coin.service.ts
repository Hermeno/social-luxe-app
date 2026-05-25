import { api } from './api'
import { ApiResponse } from '../types'

export interface CoinTransaction {
  id: string
  amount: number
  message: string | null
  createdAt: string
  sender: { id: string; name: string; avatar: string | null }
  receiver: { id: string; name: string; avatar: string | null }
}

export async function getBalance(): Promise<number> {
  const res = await api.get<ApiResponse<{ balance: number }>>('/coins/balance')
  return res.data.data.balance
}

export async function getCoinHistory(): Promise<CoinTransaction[]> {
  const res = await api.get<ApiResponse<CoinTransaction[]>>('/coins/history')
  return res.data.data
}

export async function sendCoins(
  receiverId: string,
  amount: number,
  postId?: string,
  message?: string,
) {
  const res = await api.post('/coins/send', { receiverId, amount, postId, message })
  return res.data
}
