import { Router } from 'express'
import * as halfController from '../controllers/half.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

// Metades — nada se faz sozinho: cria-se uma metade, alguém completa, nasce o post
router.post('/',              upload.single('media'), halfController.create)
router.get('/mine',           halfController.mine)
router.get('/incoming',       halfController.incoming)
router.get('/:id',            halfController.detail)
router.post('/:id/complete',  upload.single('media'), halfController.complete)
router.delete('/:id',         halfController.remove)

export default router
