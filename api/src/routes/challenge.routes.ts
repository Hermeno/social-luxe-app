import { Router } from 'express'
import * as challengeController from '../controllers/challenge.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/', challengeController.getActiveChallenges)

export default router
