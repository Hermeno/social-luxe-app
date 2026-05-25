import { Router } from 'express'
import * as notificationController from '../controllers/notification.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.post('/token', notificationController.registerToken)

export default router
