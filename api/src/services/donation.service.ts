import { prisma } from '../config/database'
import { DonationType, DonationStatus } from '@prisma/client'

// ── Haversine distance in km ──────────────────────────────────────────────────
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Degree delta for ~radius km bounding box (rough pre-filter)
function degDelta(km: number) { return km / 111 }

const donorSelect = { id: true, name: true, avatar: true }

// ── Create donation ───────────────────────────────────────────────────────────
export async function createDonation(
  donorId: string,
  data: {
    title: string
    description?: string
    photos?: string[]
    lat: number
    lng: number
    radiusKm?: number
    type: DonationType
    expiresAt?: Date
  },
) {
  return prisma.donation.create({
    data: { donorId, ...data },
    include: { donor: { select: donorSelect } },
  })
}

// ── Nearby donations (Haversine post-filter) ──────────────────────────────────
export async function getNearby(viewerLat: number, viewerLng: number, maxKm = 50) {
  const delta = degDelta(maxKm)

  // Bounding-box pre-filter in SQL, then precise Haversine in JS
  const rows = await prisma.donation.findMany({
    where: {
      status: DonationStatus.AVAILABLE,
      lat: { gte: viewerLat - delta, lte: viewerLat + delta },
      lng: { gte: viewerLng - delta, lte: viewerLng + delta },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { donor: { select: donorSelect }, feedbacks: { select: { rating: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return rows
    .map((d) => {
      const dist = distanceKm(viewerLat, viewerLng, d.lat, d.lng)
      const avgRating = d.feedbacks.length
        ? d.feedbacks.reduce((s, f) => s + f.rating, 0) / d.feedbacks.length
        : null
      return { ...d, feedbacks: undefined, distanceKm: Math.round(dist * 10) / 10, avgRating }
    })
    .filter((d) => distanceKm(viewerLat, viewerLng, d.lat, d.lng) <= d.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
}

// ── Get single donation ───────────────────────────────────────────────────────
export async function getDonation(id: string) {
  return prisma.donation.findUnique({
    where: { id },
    include: {
      donor:     { select: { ...donorSelect, bio: true } },
      requester: { select: donorSelect },
      feedbacks: {
        include: { from: { select: donorSelect } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

// ── Request (reserve) donation — first come first served ─────────────────────
export async function requestDonation(donationId: string, requesterId: string) {
  const donation = await prisma.donation.findUnique({ where: { id: donationId } })
  if (!donation)                                    throw new Error('NOT_FOUND')
  if (donation.donorId === requesterId)             throw new Error('OWN_DONATION')
  if (donation.status !== DonationStatus.AVAILABLE) throw new Error('NOT_AVAILABLE')

  return prisma.donation.update({
    where: { id: donationId },
    data:  { status: DonationStatus.RESERVED, requesterId },
    include: { donor: { select: donorSelect } },
  })
}

// ── Confirm delivery (donor only) ─────────────────────────────────────────────
export async function confirmDelivery(donationId: string, donorId: string) {
  const donation = await prisma.donation.findUnique({ where: { id: donationId } })
  if (!donation)                              throw new Error('NOT_FOUND')
  if (donation.donorId !== donorId)           throw new Error('FORBIDDEN')
  if (donation.status !== DonationStatus.RESERVED) throw new Error('NOT_RESERVED')

  return prisma.donation.update({
    where: { id: donationId },
    data:  { status: DonationStatus.DELIVERED },
    include: { requester: { select: donorSelect } },
  })
}

// ── Leave feedback (recipient after delivery) ─────────────────────────────────
export async function leaveFeedback(
  donationId: string,
  fromUserId: string,
  rating: number,
  comment?: string,
) {
  const donation = await prisma.donation.findUnique({ where: { id: donationId } })
  if (!donation)                                     throw new Error('NOT_FOUND')
  if (donation.requesterId !== fromUserId)           throw new Error('FORBIDDEN')
  if (donation.status !== DonationStatus.DELIVERED)  throw new Error('NOT_DELIVERED')

  const existing = await prisma.donationFeedback.findFirst({ where: { donationId, fromUserId } })
  if (existing) throw new Error('ALREADY_REVIEWED')

  return prisma.donationFeedback.create({
    data: { donationId, fromUserId, rating: Math.min(5, Math.max(1, rating)), comment },
  })
}

// ── My donations (as donor) ───────────────────────────────────────────────────
export async function getMyDonations(donorId: string) {
  return prisma.donation.findMany({
    where:   { donorId },
    include: { requester: { select: donorSelect }, feedbacks: { select: { rating: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

// ── Expire stale donations (called by cron) ───────────────────────────────────
export async function expireDonations() {
  const result = await prisma.donation.updateMany({
    where: {
      status:    DonationStatus.AVAILABLE,
      expiresAt: { not: null, lte: new Date() },
    },
    data: { status: DonationStatus.EXPIRED },
  })
  return result.count
}
