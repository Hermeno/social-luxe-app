import { Router } from 'express'
import * as muteController from '../controllers/mute.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/', muteController.getMutedUsers)
router.put('/:userId', muteController.muteUser)
router.delete('/:userId', muteController.unmuteUser)

export default router

