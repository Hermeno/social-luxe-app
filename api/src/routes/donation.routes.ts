import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth.middleware'
import * as ctrl from '../controllers/donation.controller'

const router = Router()

router.use(authMiddleware)

router.get('/nearby',        ctrl.getNearby)
router.get('/mine',          ctrl.getMyDonations)
router.post('/',             ctrl.createDonation)
router.get('/:id',           ctrl.getDonation)
router.post('/:id/request',  ctrl.requestDonation)
router.post('/:id/deliver',  ctrl.confirmDelivery)
router.post('/:id/feedback', ctrl.leaveFeedback)

export default router
