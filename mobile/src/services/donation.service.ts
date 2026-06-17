import { api } from './api'

export type DonationType   = 'ITEM' | 'FINANCIAL'
export type DonationStatus = 'AVAILABLE' | 'RESERVED' | 'DELIVERED' | 'EXPIRED'

export interface DonationUser {
  id: string
  name: string
  avatar: string | null
}

export interface Donation {
  id: string
  title: string
  description: string | null
  photos: string[]
  lat: number
  lng: number
  radiusKm: number
  type: DonationType
  status: DonationStatus
  expiresAt: string | null
  createdAt: string
  distanceKm?: number
  avgRating?: number | null
  donorId: string
  donor: DonationUser & { bio?: string | null }
  requesterId: string | null
  requester?: DonationUser | null
  feedbacks?: { rating: number; comment: string | null; createdAt: string; from: DonationUser }[]
}

export async function getNearbyDonations(lat: number, lng: number, radius = 50): Promise<Donation[]> {
  const res = await api.get(`/donations/nearby?lat=${lat}&lng=${lng}&radius=${radius}`)
  return res.data.data ?? []
}

export async function getDonation(id: string): Promise<Donation> {
  const res = await api.get(`/donations/${id}`)
  return res.data.data
}

export async function createDonation(data: {
  title: string
  description?: string
  photos?: string[]
  lat: number
  lng: number
  radiusKm?: number
  type: DonationType
  expiresInDays?: number
}): Promise<Donation> {
  const res = await api.post('/donations', data)
  return res.data.data
}

export async function requestDonation(id: string): Promise<Donation> {
  const res = await api.post(`/donations/${id}/request`)
  return res.data.data
}

export async function confirmDelivery(id: string): Promise<Donation> {
  const res = await api.post(`/donations/${id}/deliver`)
  return res.data.data
}

export async function leaveFeedback(id: string, rating: number, comment?: string) {
  const res = await api.post(`/donations/${id}/feedback`, { rating, comment })
  return res.data.data
}

export async function getMyDonations(): Promise<Donation[]> {
  const res = await api.get('/donations/mine')
  return res.data.data ?? []
}
