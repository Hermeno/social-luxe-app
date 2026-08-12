import { api } from './api'
import { ApiResponse, PublicPost } from '../types'

/**
 * Feed de quem chega sem conta. O servidor só devolve posts que a comunidade
 * manteve vivos até aos 30 dias — se não houver nenhum, vem vazio e a app
 * segue para a entrada normal.
 */
export async function getPublicFeed(page = 1): Promise<PublicPost[]> {
  const res = await api.get<ApiResponse<PublicPost[]>>('/public/feed', { params: { page } })
  return res.data.data ?? []
}
