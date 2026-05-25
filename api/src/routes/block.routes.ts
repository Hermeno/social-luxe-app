import { Router } from 'express'
import * as blockController from '../controllers/block.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/', blockController.getBlockedUsers)
router.post('/', blockController.blockUser)
router.delete('/:userId', blockController.unblockUser)

export default router
