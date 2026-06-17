import { Response } from 'express'
import { AuthRequest as Request } from '../types'
import { DonationType } from '@prisma/client'
import { ok, created, badRequest, notFound, forbidden } from '../utils/response'
import { handleError } from '../utils/errors'
import { sendPush } from '../services/notification.service'
import * as svc from '../services/donation.service'

export async function createDonation(req: Request, res: Response) {
  try {
    const { title, description, photos, lat, lng, radiusKm, type, expiresInDays } = req.body
    if (!title || lat == null || lng == null || !type) return badRequest(res, 'title, lat, lng, type required')
    if (!['ITEM', 'FINANCIAL'].includes(type))         return badRequest(res, 'type must be ITEM or FINANCIAL')

    const expiresAt = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 86_400_000)
      : undefined

    const donation = await svc.createDonation(req.user!.userId, {
      title,
      description,
      photos: photos ?? [],
      lat: Number(lat),
      lng: Number(lng),
      radiusKm: radiusKm ? Number(radiusKm) : 10,
      type: type as DonationType,
      expiresAt,
    })
    return created(res, donation)
  } catch (err) {
    return handleError(res, err, 'createDonation')
  }
}

export async function getNearby(req: Request, res: Response) {
  try {
    const { lat, lng, radius } = req.query
    if (!lat || !lng) return badRequest(res, 'lat and lng required')
    const donations = await svc.getNearby(Number(lat), Number(lng), radius ? Number(radius) : 50)
    return ok(res, donations)
  } catch (err) {
    return handleError(res, err, 'getNearby')
  }
}

export async function getDonation(req: Request, res: Response) {
  try {
    const donation = await svc.getDonation(req.params.id)
    if (!donation) return notFound(res, 'Donation')
    return ok(res, donation)
  } catch (err) {
    return handleError(res, err, 'getDonation')
  }
}

export async function requestDonation(req: Request, res: Response) {
  try {
    const donation = await svc.requestDonation(req.params.id, req.user!.userId)

    // Notify donor
    sendPush(
      donation.donor.id,
      '🤲 Pedido de doação',
      `Alguém quer receber "${donation.title}"`,
      { type: 'donation_request', donationId: donation.id },
    ).catch(() => {})

    return ok(res, donation)
  } catch (err: any) {
    if (err.message === 'NOT_FOUND')      return notFound(res, 'Donation')
    if (err.message === 'OWN_DONATION')   return badRequest(res, 'Cannot request your own donation')
    if (err.message === 'NOT_AVAILABLE')  return badRequest(res, 'Donation is no longer available')
    return handleError(res, err, 'requestDonation')
  }
}

export async function confirmDelivery(req: Request, res: Response) {
  try {
    const donation = await svc.confirmDelivery(req.params.id, req.user!.userId)

    // Notify recipient
    if (donation.requester) {
      sendPush(
        donation.requester.id,
        '✅ Entrega confirmada',
        'O doador confirmou a entrega. Obrigado!',
        { type: 'donation_delivered', donationId: req.params.id },
      ).catch(() => {})
    }

    return ok(res, donation)
  } catch (err: any) {
    if (err.message === 'NOT_FOUND')    return notFound(res, 'Donation')
    if (err.message === 'FORBIDDEN')    return forbidden(res)
    if (err.message === 'NOT_RESERVED') return badRequest(res, 'Donation is not reserved')
    return handleError(res, err, 'confirmDelivery')
  }
}

export async function leaveFeedback(req: Request, res: Response) {
  try {
    const { rating, comment } = req.body
    if (!rating || rating < 1 || rating > 5) return badRequest(res, 'rating must be 1–5')
    const feedback = await svc.leaveFeedback(req.params.id, req.user!.userId, Number(rating), comment)
    return created(res, feedback)
  } catch (err: any) {
    if (err.message === 'NOT_FOUND')       return notFound(res, 'Donation')
    if (err.message === 'FORBIDDEN')       return forbidden(res)
    if (err.message === 'NOT_DELIVERED')   return badRequest(res, 'Donation not delivered yet')
    if (err.message === 'ALREADY_REVIEWED') return badRequest(res, 'Already reviewed')
    return handleError(res, err, 'leaveFeedback')
  }
}

export async function getMyDonations(req: Request, res: Response) {
  try {
    const donations = await svc.getMyDonations(req.user!.userId)
    return ok(res, donations)
  } catch (err) {
    return handleError(res, err, 'getMyDonations')
  }
}
