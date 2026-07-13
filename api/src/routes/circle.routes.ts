import { Router } from 'express'
import * as circleController from '../controllers/circle.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

// Sessão de foto em grupo, ao vivo com pessoas próximas
router.post('/open',        circleController.open)
router.get('/incoming',     circleController.incoming)
router.post('/call',        circleController.call)
router.post('/join',        circleController.join)
router.post('/photo',       upload.single('media'), circleController.photo)
router.post('/publish',     circleController.publish)
router.get('/session/:id',  circleController.state)

export default router
