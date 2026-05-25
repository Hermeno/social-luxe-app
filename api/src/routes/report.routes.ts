import { Router } from 'express'
import * as reportController from '../controllers/report.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.post('/', reportController.createReport)

export default router
