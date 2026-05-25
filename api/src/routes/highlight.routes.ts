import { Router } from 'express'
import * as highlightController from '../controllers/highlight.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/:userId', highlightController.getUserHighlights)
router.post('/', highlightController.createHighlight)
router.delete('/:id', highlightController.deleteHighlight)

export default router
