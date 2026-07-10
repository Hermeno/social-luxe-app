import { Router } from 'express'
import * as circleController from '../controllers/circle.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/', circleController.getCurrent)
router.post('/spark', circleController.spark)
router.post('/captures', upload.single('media'), circleController.submitCapture)
router.post('/captures/:id/vote', circleController.vote)

export default router
