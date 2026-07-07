import { Router } from 'express'
import * as pairingController from '../controllers/pairing.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/me',              pairingController.getMyPairing)
router.get('/user/:id',        pairingController.getUserPairing)
router.post('/invite',         pairingController.invitePairing)
router.post('/:id/respond',    pairingController.respondPairing)
router.post('/:id/end',        pairingController.endPairing)

export default router
