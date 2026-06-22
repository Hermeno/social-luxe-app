import { api } from './api'
import { TravelData, TravelObject } from '../types'

export async function getTravelData(postId: string): Promise<TravelData> {
  const res = await api.get(`/travel/${postId}`)
  return res.data.data
}

export async function addObject(
  postId: string,
  value:  string,
  type:   string = 'emoji',
): Promise<TravelObject> {
  const res = await api.post(`/travel/${postId}/objects`, { type, value })
  return res.data.data
}

export async function removeObject(objectId: string): Promise<void> {
  await api.delete(`/travel/objects/${objectId}`)
}
