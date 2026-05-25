import { Router } from 'express'
import * as momentoController from '../controllers/momento.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/', momentoController.getFriendsMomentos)
router.post('/', momentoController.createMomento)
router.delete('/:id', momentoController.deleteMomento)
router.post('/:id/view', momentoController.viewMomento)

export default router
